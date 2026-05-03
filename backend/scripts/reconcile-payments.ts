import "dotenv/config";
import { tryFinalizePendingPayments } from "../src/modules/payment/paymentService.js";

const n = await tryFinalizePendingPayments();
console.log(`reconcile-payments: finalized ${n} payment(s)`);
