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

export const PricingSetupSchema = z.object({
  base_price: z.number().positive('Base price must be greater than 0'),
  currency: z.string().length(3).default('VND'),
  early_bird_price: z.number().positive().optional(),
  early_bird_deadline: z.string().datetime().optional(),
}).refine((data) => {
  if (data.early_bird_price !== undefined && data.early_bird_price >= data.base_price) {
    return false;
  }
  return true;
}, {
  message: 'Early bird price must be less than base price',
  path: ['early_bird_price'],
});

export type PricingSetupInput = z.infer<typeof PricingSetupSchema>;

export const UpdateWorkshopSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  capacity: z.number().int().positive().optional(),
}).refine((data) => {
  if (data.starts_at && data.ends_at) {
    return new Date(data.ends_at) > new Date(data.starts_at);
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['ends_at'],
});

export type UpdateWorkshopInput = z.infer<typeof UpdateWorkshopSchema>;
