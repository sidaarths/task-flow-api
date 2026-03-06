import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validate =
  (schema: z.ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const errors = (result.error as z.ZodError).flatten().fieldErrors;
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const data = result.data as { body?: unknown; query?: unknown; params?: unknown };
    if (data.body !== undefined) req.body = data.body;
    // Express 5: req.query is a read-only getter (no setter). Do NOT reassign it.
    // Validation above already confirmed query is valid; the route reads req.query directly.
    if (data.params !== undefined) req.params = data.params as typeof req.params;

    next();
  };
