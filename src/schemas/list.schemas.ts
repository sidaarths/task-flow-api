import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

export const listParamSchema = z.object({
  params: z.object({ listId: objectIdSchema }),
});

export const updateListSchema = z.object({
  params: z.object({ listId: objectIdSchema }),
  body: z
    .object({
      title: z.string().min(1).max(100).trim().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, 'At least one field is required'),
});

export const updateListPositionSchema = z.object({
  params: z.object({ listId: objectIdSchema }),
  body: z.object({
    position: z.number().int().min(0),
  }),
});

export const createTaskInListSchema = z.object({
  params: z.object({ listId: objectIdSchema }),
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200).trim(),
    description: z.string().max(2000).trim().optional(),
    labels: z.array(z.string().max(50)).optional(),
    dueDate: z.coerce.date().optional(),
  }),
});
