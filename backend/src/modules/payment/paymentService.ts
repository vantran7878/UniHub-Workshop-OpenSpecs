import { randomUUID } from "node:crypto";
import { getPool } from "../../db/pool.js";
import { publishJson } from "../../rabbitmq/client.js";
import { QUEUE_NOTIFICATION } from "../notifications/eventTypes.js";
import { invalidateWorkshopCaches } from "../workshops/workshopCache.js";
import * as cb from "./circuitBreaker.js";
import * as idem from "./idempotency.js";
import { getTransactionStatus, postCharge } from "./gatewayClient.js";

export async function rollbackPendingRegistration(registrationId: string) {
  const pool = getPool();
  await pool.query(`delete from registrations where id = $1 and status = 'pending'`, [registrationId]);
}

type FinalizeOpts = {
  paymentId: string;
  registrationId: string;
  userId: string;
  workshopId: string;
  idempotencyKey: string;
  amount: number;
  workshopTitle: string;
  startTime: Date;
  room?: string | null;
  speaker?: string | null;
  transactionId: string;
  gatewayRaw: unknown;
};

async function finalizeSuccessfulCharge(o: FinalizeOpts): Promise<string> {
  await cb.recordSuccess();
  const qrNew = randomUUID();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const u = await client.query<{ qr_code: string | null }>(
      `update registrations set status = 'confirmed', qr_code = $1, updated_at = now() where id = $2 and status = 'pending' returning qr_code`,
      [qrNew, o.registrationId]
    );
    if (u.rows.length === 0) {
      const ex = await client.query<{ status: string; qr_code: string | null }>(
        `select status, qr_code from registrations where id = $1`,
        [o.registrationId]
      );
      const reg = ex.rows[0];
      await client.query("ROLLBACK");
      if (reg?.status === "confirmed" && reg.qr_code) {
        await pool.query(
          `update payments set status = 'success', transaction_id = coalesce(transaction_id, $2), gateway_response = $3::jsonb where id = $1`,
          [o.paymentId, o.transactionId, JSON.stringify(o.gatewayRaw)]
        );
        await idem.setPaymentIdem(o.idempotencyKey, {
          status: "success",
          qr_code: reg.qr_code,
          registration_id: o.registrationId,
          transaction_id: o.transactionId
        });
        return reg.qr_code;
      }
      throw new Error("registration_not_pending");
    }
    await client.query(`update workshops set confirmed_count = confirmed_count + 1, updated_at = now() where id = $1`, [o.workshopId]);
    await client.query(
      `update payments set status = 'success', transaction_id = $2, gateway_response = $3::jsonb where id = $1`,
      [o.paymentId, o.transactionId, JSON.stringify(o.gatewayRaw)]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const qr = qrNew;
  await idem.setPaymentIdem(o.idempotencyKey, {
    status: "success",
    qr_code: qr,
    registration_id: o.registrationId,
    transaction_id: o.transactionId
  });

  try {
    await publishJson(QUEUE_NOTIFICATION, {
      eventId: randomUUID(),
      eventType: "REGISTRATION_CONFIRMED_PAID",
      userId: o.userId,
      workshopId: o.workshopId,
      registrationId: o.registrationId,
      payload: {
        workshopTitle: o.workshopTitle,
        workshopDate: o.startTime.toISOString(),
        workshopRoom: o.room ?? "",
        speakerName: o.speaker ?? "",
        qrCode: qr,
        price: o.amount
      },
      publishedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error("notify publish failed", e);
  }
  try {
    await invalidateWorkshopCaches(o.workshopId);
  } catch (e) {
    console.warn("cache invalidate", e);
  }
  return qr;
}

export async function chargePaidRegistration(opts: {
  userId: string;
  workshopId: string;
  registrationId: string;
  idempotencyClientKey: string;
  amount: number;
  workshopTitle: string;
  startTime: Date;
  room?: string | null;
  speaker?: string | null;
}): Promise<{ status: 200; qr_code: string } | { status: 202 } | { status: 402 } | { status: 503 }> {
  const pool = getPool();
  const key = idem.paymentIdemKey(opts.userId, opts.workshopId, opts.idempotencyClientKey);

  const existing = await idem.getPaymentIdem(key);
  if (existing?.status === "success" && existing.qr_code) {
    return { status: 200, qr_code: existing.qr_code };
  }
  if (existing?.status === "processing" || existing?.status === "pending") {
    return { status: 202 };
  }
  if (existing?.status === "failed") {
    return { status: 402 };
  }

  const gotLock = await idem.tryMarkProcessing(key);
  if (!gotLock) {
    const again = await idem.getPaymentIdem(key);
    if (again?.status === "success" && again.qr_code) return { status: 200, qr_code: again.qr_code };
    return { status: 202 };
  }

  if (!(await cb.circuitAllows())) {
    await idem.setPaymentIdem(key, { status: "failed", reason: "circuit_open" });
    await rollbackPendingRegistration(opts.registrationId);
    return { status: 503 };
  }

  let paymentId: string;
  try {
    const payIns = await pool.query<{ id: string }>(
      `insert into payments (user_id, workshop_id, registration_id, idempotency_key, amount, status, attempted_at)
       values ($1,$2,$3,$4,$5,'processing', now()) returning id`,
      [opts.userId, opts.workshopId, opts.registrationId, key, opts.amount]
    );
    paymentId = payIns.rows[0]!.id;
  } catch {
    await rollbackPendingRegistration(opts.registrationId);
    await idem.setPaymentIdem(key, { status: "failed", reason: "payment_insert" });
    return { status: 503 };
  }

  const result = await postCharge({ amount: opts.amount });

  if (result.ok) {
    const qr = await finalizeSuccessfulCharge({
      paymentId,
      registrationId: opts.registrationId,
      userId: opts.userId,
      workshopId: opts.workshopId,
      idempotencyKey: key,
      amount: opts.amount,
      workshopTitle: opts.workshopTitle,
      startTime: opts.startTime,
      room: opts.room,
      speaker: opts.speaker,
      transactionId: result.transaction_id,
      gatewayRaw: result.raw
    });
    return { status: 200, qr_code: qr };
  }

  if (result.kind === "pending") {
    await pool.query(`update payments set status = 'pending', transaction_id = $2, gateway_response = $3::jsonb where id = $1`, [
      paymentId,
      result.transaction_id,
      JSON.stringify(result.raw)
    ]);
    await idem.setPaymentIdem(key, { status: "pending", transaction_id: result.transaction_id });
    return { status: 202 };
  }

  if (result.kind === "declined") {
    await pool.query(`update payments set status = 'failed', gateway_response = $2::jsonb where id = $1`, [
      paymentId,
      JSON.stringify(result.raw)
    ]);
    await rollbackPendingRegistration(opts.registrationId);
    await idem.setPaymentIdem(key, { status: "failed", reason: "declined" });
    return { status: 402 };
  }

  if (result.kind === "timeout") {
    await cb.recordFailure(true);
    await pool.query(`update payments set status = 'pending', gateway_response = $2::jsonb where id = $1`, [
      paymentId,
      JSON.stringify({ note: "client_timeout" })
    ]);
    await idem.setPaymentIdem(key, { status: "pending" });
    return { status: 202 };
  }

  await cb.recordFailure(true);
  const gatewayPayload = result.kind === "server" ? result.raw : { message: result.message };
  await pool.query(`update payments set status = 'pending', gateway_response = $2::jsonb where id = $1`, [
    paymentId,
    JSON.stringify(gatewayPayload)
  ]);
  await rollbackPendingRegistration(opts.registrationId);
  await idem.setPaymentIdem(key, { status: "failed", reason: "gateway" });
  return { status: 503 };
}

/** Poll gateway for pending payments and finalize success / failure (idempotent). */
export async function tryFinalizePendingPayments(): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(
    `select id from payments where status = 'pending' and transaction_id is not null order by created_at asc limit 100`
  );
  let n = 0;
  for (const { id } of rows) {
    const done = await tryFinalizeOnePendingPayment(id);
    if (done) n += 1;
  }
  return n;
}

async function tryFinalizeOnePendingPayment(paymentId: string): Promise<boolean> {
  const pool = getPool();
  const r = await pool.query<{
    id: string;
    user_id: string;
    workshop_id: string;
    registration_id: string;
    idempotency_key: string;
    amount: string;
    transaction_id: string;
    workshop_title: string;
    start_time: Date;
    room: string | null;
    speaker: string | null;
  }>(
    `
    select p.id, p.user_id, p.workshop_id, p.registration_id, p.idempotency_key, p.amount::text as amount, p.transaction_id,
           w.title as workshop_title, w.start_time, w.room, w.speaker
    from payments p
    join workshops w on w.id = p.workshop_id
    where p.id = $1 and p.status = 'pending'
    `,
    [paymentId]
  );
  const row = r.rows[0];
  if (!row?.transaction_id) return false;

  const remote = await getTransactionStatus(row.transaction_id);
  if (!remote) return false;
  const st = typeof remote.status === "string" ? remote.status : "";
  if (st === "pending") return false;

  if (st === "success") {
    try {
      await finalizeSuccessfulCharge({
        paymentId: row.id,
        registrationId: row.registration_id,
        userId: row.user_id,
        workshopId: row.workshop_id,
        idempotencyKey: row.idempotency_key,
        amount: Number(row.amount),
        workshopTitle: row.workshop_title,
        startTime: new Date(row.start_time),
        room: row.room,
        speaker: row.speaker,
        transactionId: row.transaction_id,
        gatewayRaw: remote
      });
    } catch (e) {
      console.error("finalize pending payment failed", paymentId, e);
      return false;
    }
    return true;
  }

  await pool.query(`update payments set status = 'failed', gateway_response = $2::jsonb where id = $1`, [
    paymentId,
    JSON.stringify(remote)
  ]);
  await rollbackPendingRegistration(row.registration_id);
  await idem.setPaymentIdem(row.idempotency_key, { status: "failed", reason: st || "gateway" });
  return true;
}
