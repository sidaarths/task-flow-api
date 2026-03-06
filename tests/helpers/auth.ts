import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../../src/models/User';

const TEST_JWT_SECRET = 'test-secret-key-must-be-at-least-32-chars!!';

// Override env for tests
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.NODE_ENV = 'test';

export const createTestUser = async (email = 'test@example.com', password = 'password123') => {
  const user = new User({ email, password });
  await user.save();
  return user;
};

export const generateTestToken = (userId: mongoose.Types.ObjectId | string): string => {
  return jwt.sign({ userId: userId.toString() }, TEST_JWT_SECRET, { expiresIn: '1h' });
};

export const getAuthHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

export const getBasicAuthHeader = (email: string, password: string) => ({
  Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`,
});
