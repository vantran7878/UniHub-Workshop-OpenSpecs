const REQUEST_MS = 10_000;

export type ChargeResult =
  | { ok: true; transaction_id: string; raw: unknown }
  | { ok: false; kind: "pending"; transaction_id: string; raw: unknown }
  | { ok: false; kind: "declined"; status: number; raw: unknown }
  | { ok: false; kind: "timeout" | "network"; message: string }
  | { ok: false; kind: "server"; status: number; raw: unknown };

export async function postCharge(params: {
  amount: number;
  scenarioHeader?: string;
}): Promise<ChargeResult> {
  const base = process.env.PAYMENT_GATEWAY_URL?.replace(/\/$/, "");
  if (!base) throw new Error("PAYMENT_GATEWAY_URL is required");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_MS);
  try {
    const res = await fetch(`${base}/charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(params.scenarioHeader ? { "X-Sandbox-Scenario": params.scenarioHeader } : {})
      },
      body: JSON.stringify({ amount: params.amount }),
      signal: ctrl.signal
    });
    clearTimeout(t);
    const raw = await res.json().catch(() => ({}));

    if (res.ok && raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      if (o.status === "success" && o.transaction_id != null) {
        return { ok: true, transaction_id: String(o.transaction_id), raw };
      }
      if (o.status === "pending" && o.transaction_id != null) {
        return { ok: false, kind: "pending", transaction_id: String(o.transaction_id), raw };
      }
    }
    if (res.status === 402) return { ok: false, kind: "declined", status: res.status, raw };
    if (res.status >= 500) return { ok: false, kind: "server", status: res.status, raw };
    return { ok: false, kind: "server", status: res.status, raw };
  } catch (e: any) {
    clearTimeout(t);
    if (e?.name === "AbortError") return { ok: false, kind: "timeout", message: "timeout" };
    return { ok: false, kind: "network", message: String(e?.message ?? e) };
  }
}

export async function getTransactionStatus(transactionId: string): Promise<{ status: string } | null> {
  const base = process.env.PAYMENT_GATEWAY_URL?.replace(/\/$/, "");
  if (!base) throw new Error("PAYMENT_GATEWAY_URL is required");
  const res = await fetch(`${base}/transactions/${transactionId}`);
  if (!res.ok) return null;
  return res.json() as Promise<{ status: string }>;
}
