import * as amqplib from "amqplib";

// NOTE: amqplib typings expose a "ChannelModel" (promise API) rather than a strict Connection type.
let _conn: amqplib.ChannelModel | undefined;
let _channel: amqplib.Channel | undefined;

export async function getAmqpChannel() {
  if (_channel) return _channel;
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error("RABBITMQ_URL is required");

  const conn = await amqplib.connect(url);
  const ch = await conn.createChannel();

  _conn = conn;
  _channel = ch;
  return _channel;
}

export async function publishJson(queue: string, payload: unknown) {
  const ch = await getAmqpChannel();
  await ch.assertQueue(queue, { durable: true });
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  ch.sendToQueue(queue, body, { contentType: "application/json", persistent: true });
}

export async function consumeJson(
  queue: string,
  handler: (msg: { body: any; raw: amqplib.ConsumeMessage }) => Promise<void>
) {
  const ch = await getAmqpChannel();
  await ch.assertQueue(queue, { durable: true });
  await ch.prefetch(10);

  await ch.consume(queue, async (raw) => {
    if (!raw) return;
    try {
      const body = JSON.parse(raw.content.toString("utf8"));
      await handler({ body, raw });
      ch.ack(raw);
    } catch (err) {
      console.error(err);
      // best-effort: reject and requeue once
      ch.nack(raw, false, true);
    }
  });
}

export async function closeAmqp() {
  try {
    await _channel?.close();
  } finally {
    _channel = undefined;
  }
  try {
    await _conn?.close();
  } finally {
    _conn = undefined;
  }
}

