import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

export const createBoardSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(100).trim(),
    description: z.string().max(500).trim().optional(),
  }),
});

export const updateBoardSchema = z.object({
  params: z.object({ boardId: objectIdSchema }),
  body: z
    .object({
      title: z.string().min(1).max(100).trim().optional(),
      description: z.string().max(500).trim().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, 'At least one field is required'),
});

export const boardParamSchema = z.object({
  params: z.object({ boardId: objectIdSchema }),
});

export const boardUserParamSchema = z.object({
  params: z.object({
    boardId: objectIdSchema,
    userId: objectIdSchema,
  }),
});

export const createListInBoardSchema = z.object({
  params: z.object({ boardId: objectIdSchema }),
  body: z.object({
    title: z.string().min(1, 'Title is required').max(100).trim(),
  }),
});
