import { z } from "zod";

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: "invalid datetime" });

export const createWorkshopBodySchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    speaker: z.string().max(255).optional(),
    room: z.string().max(255).optional(),
    capacity: z.number().int().positive(),
    is_paid: z.boolean(),
    price: z.number().nonnegative(),
    registration_open_at: isoDate,
    registration_close_at: isoDate,
    start_time: isoDate,
    end_time: isoDate
  })
  .superRefine((data, ctx) => {
    const ro = new Date(data.registration_open_at);
    const rc = new Date(data.registration_close_at);
    const st = new Date(data.start_time);
    const en = new Date(data.end_time);
    const now = new Date();
    if (st <= now) {
      ctx.addIssue({ code: "custom", message: "start_time must be in the future", path: ["start_time"] });
    }
    if (en <= st) {
      ctx.addIssue({ code: "custom", message: "end_time must be after start_time", path: ["end_time"] });
    }
    if (ro >= rc) {
      ctx.addIssue({ code: "custom", message: "registration_open_at must be before registration_close_at", path: ["registration_open_at"] });
    }
    if (rc >= st) {
      ctx.addIssue({ code: "custom", message: "registration must close before workshop starts", path: ["registration_close_at"] });
    }
    if (data.is_paid) {
      if (!data.price || data.price <= 0) {
        ctx.addIssue({ code: "custom", message: "paid workshop requires price > 0", path: ["price"] });
      }
    } else if (data.price > 0) {
      ctx.addIssue({ code: "custom", message: "free workshop must have price 0", path: ["price"] });
    }
  });

export const updateWorkshopBodySchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    speaker: z.string().max(255).optional(),
    room: z.string().max(255).optional(),
    capacity: z.number().int().positive().optional(),
    is_paid: z.boolean().optional(),
    price: z.number().nonnegative().optional(),
    registration_open_at: isoDate.optional(),
    registration_close_at: isoDate.optional(),
    start_time: isoDate.optional(),
    end_time: isoDate.optional()
  })
  .strict();

export function assertRegistrationWindow(open: Date, close: Date, start: Date) {
  if (open >= close) return "registration_open_at must be before registration_close_at";
  if (close >= start) return "registration_close_at must be before start_time";
  return null;
}
