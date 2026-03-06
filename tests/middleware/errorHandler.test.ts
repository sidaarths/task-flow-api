import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { errorHandler, AppError } from '../../src/middleware/errorHandler';

function makeMockRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

const req = {} as Request;
const next = jest.fn() as unknown as NextFunction;

describe('errorHandler middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('AppError: returns correct statusCode and message', () => {
    const res = makeMockRes();
    errorHandler(new AppError(404, 'Resource not found'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Resource not found' });
  });

  it('AppError: works with 400 status', () => {
    const res = makeMockRes();
    errorHandler(new AppError(400, 'Bad request'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('AppError: works with 403 status', () => {
    const res = makeMockRes();
    errorHandler(new AppError(403, 'Access denied'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('ZodError: returns 400 with validation errors', () => {
    const res = makeMockRes();
    // ZodError.create is internal; use parse to get one
    let zodErr: ZodError;
    const { z } = require('zod');
    try {
      z.object({ name: z.string() }).parse({});
    } catch (e) {
      zodErr = e as ZodError;
    }
    errorHandler(zodErr!, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Validation failed' })
    );
  });

  it('Mongoose ValidationError: returns 400 with errors array', () => {
    const res = makeMockRes();
    const validationErr = new mongoose.Error.ValidationError();
    validationErr.errors['name'] = new mongoose.Error.ValidatorError({
      message: 'Name is required',
      path: 'name',
      type: 'required',
      value: undefined,
    });
    errorHandler(validationErr, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid data' })
    );
  });

  it('Mongoose CastError: returns 400 with ID format message', () => {
    const res = makeMockRes();
    const castErr = new mongoose.Error.CastError('ObjectId', 'bad-id', '_id');
    errorHandler(castErr, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid ID format' });
  });

  it('Generic Error: returns 500 Internal server error', () => {
    const res = makeMockRes();
    errorHandler(new Error('Something unexpected'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
  });

  it('AppError class has correct name', () => {
    const err = new AppError(422, 'Unprocessable');
    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(422);
    expect(err.message).toBe('Unprocessable');
  });
});
