import { z } from 'zod';

export const CreateWorkshopSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  location: z.string().optional(),
  starts_at: z.string().datetime({ message: 'Invalid start time format' }),
  ends_at: z.string().datetime({ message: 'Invalid end time format' }),
  capacity: z.number().int().positive('Capacity must be greater than 0'),
  pricing_type: z.enum(['free', 'paid']),
}).refine((data) => new Date(data.ends_at) > new Date(data.starts_at), {
  message: 'End time must be after start time',
  path: ['ends_at'],
});

export type CreateWorkshopInput = z.infer<typeof CreateWorkshopSchema>;

export const WorkshopQuerySchema = z.object({
  status: z.enum(['active', 'cancelled', 'completed']).optional(),
  pricing_type: z.enum(['free', 'paid']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
});
