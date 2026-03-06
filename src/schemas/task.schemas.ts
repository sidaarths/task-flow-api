import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

export const taskParamSchema = z.object({
  params: z.object({ taskId: objectIdSchema }),
});

export const taskUserParamSchema = z.object({
  params: z.object({
    taskId: objectIdSchema,
    userId: objectIdSchema,
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({ taskId: objectIdSchema }),
  body: z
    .object({
      title: z.string().min(1).max(200).trim().optional(),
      description: z.string().max(2000).trim().optional(),
      labels: z.array(z.string().max(50)).optional(),
      dueDate: z.coerce.date().nullable().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, 'At least one field is required'),
});

export const updateTaskPositionSchema = z.object({
  params: z.object({ taskId: objectIdSchema }),
  body: z.object({
    position: z.number().int().min(0),
    listId: objectIdSchema.optional(),
  }),
});
