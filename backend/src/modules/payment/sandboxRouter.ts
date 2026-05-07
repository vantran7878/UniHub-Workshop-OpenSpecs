import { randomUUID } from "node:crypto";
import express from "express";
import { z } from "zod";

function delayFlipSuccess(transaction_id: string, amount: number, createdAt: number) {
  setTimeout(() => {
    const tx = sandboxTransactions.get(transaction_id);
    if (!tx) return;
    sandboxTransactions.set(transaction_id, {
      ...tx,
      status: "success",
      amount,
      createdAt,
      updatedAt: Date.now()
    });
  }, 12_000);
}

type TxRecord = {
  status: "pending" | "success" | "declined" | "failed";
  amount: number;
  createdAt: number;
  updatedAt: number;
};

/** In-memory sandbox store (dev — single process). */
export const sandboxTransactions = new Map<string, TxRecord>();

function inferScenario(amount: number, header?: string): "success" | "timeout" | "declined" | "gateway_error" {
  const h = header?.toLowerCase();
  if (h === "timeout") return "timeout";
  if (h === "declined") return "declined";
  if (h === "error") return "gateway_error";
  const fixed = amount.toFixed(2);
  if (fixed.endsWith(".99")) return "timeout";
  if (fixed.endsWith(".00")) return "declined";
  return "success";
}

export function sandboxRouter() {
  const router = express.Router();

  router.post("/charge", async (req, res) => {
    const body = z.object({ amount: z.coerce.number() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ status: "error" });

    const amount = body.data.amount;
    const headerScenario = req.get("x-sandbox-scenario") ?? undefined;
    const scenario = inferScenario(amount, headerScenario);

    const transaction_id = randomUUID();
    const now = Date.now();
    sandboxTransactions.set(transaction_id, { status: "pending", amount, createdAt: now, updatedAt: now });

    if (scenario === "gateway_error") {
      sandboxTransactions.set(transaction_id, { status: "failed", amount, createdAt: now, updatedAt: Date.now() });
      return res.status(500).json({ status: "error" });
    }

    if (scenario === "declined") {
      sandboxTransactions.set(transaction_id, { status: "declined", amount, createdAt: now, updatedAt: Date.now() });
      return res.status(402).json({ status: "declined", reason: "insufficient_funds", transaction_id });
    }

    if (scenario === "timeout") {
      delayFlipSuccess(transaction_id, amount, now);
      return res.json({ status: "pending", transaction_id });
    }

    sandboxTransactions.set(transaction_id, { status: "success", amount, createdAt: now, updatedAt: Date.now() });
    return res.json({ status: "success", transaction_id });
  });

  router.get("/transactions/:id", (req, res) => {
    const id = req.params.id;
    const tx = sandboxTransactions.get(id);
    if (!tx) return res.status(404).json({ status: "not_found" });
    if (tx.status === "pending") return res.json({ status: "pending", transaction_id: id });
    if (tx.status === "success") return res.json({ status: "success", transaction_id: id });
    return res.json({ status: tx.status, transaction_id: id });
  });

  return router;
}
