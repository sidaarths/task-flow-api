import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

export const searchUsersSchema = z.object({
  query: z.object({
    email: z.string().min(1, 'Search term required'),
  }),
});

export const userParamSchema = z.object({
  params: z.object({ userId: objectIdSchema }),
});
