import request from 'supertest';
import app from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { getBasicAuthHeader } from '../helpers/auth';

beforeAll(async () => {
  process.env.MONGODB_URI = 'mongodb://placeholder'; // overridden by memory server
  process.env.JWT_SECRET = 'test-secret-key-must-be-at-least-32-chars!!';
  await connectTestDB();
});
afterAll(() => disconnectTestDB());
afterEach(() => clearTestDB());

describe('POST /api/v1/auth/register', () => {
  it('registers a new user and returns a token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set(getBasicAuthHeader('new@example.com', 'password123'))
      .expect(201);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 without Basic Auth header', async () => {
    await request(app).post('/api/v1/auth/register').expect(401);
  });

  it('returns 400 for invalid email format', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .set(getBasicAuthHeader('not-an-email', 'password123'))
      .expect(400);
  });

  it('returns 400 for password shorter than 6 characters', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .set(getBasicAuthHeader('user@example.com', 'abc'))
      .expect(400);
  });

  it('returns 400 if email already registered', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .set(getBasicAuthHeader('dup@example.com', 'password123'));
    await request(app)
      .post('/api/v1/auth/register')
      .set(getBasicAuthHeader('dup@example.com', 'password123'))
      .expect(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .set(getBasicAuthHeader('login@example.com', 'password123'));
  });

  it('logs in with valid credentials and returns a token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set(getBasicAuthHeader('login@example.com', 'password123'))
      .expect(200);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .set(getBasicAuthHeader('login@example.com', 'wrongpass'))
      .expect(401);
  });

  it('returns 401 for non-existent user', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .set(getBasicAuthHeader('nobody@example.com', 'password123'))
      .expect(401);
  });

  it('returns 401 without Basic Auth header', async () => {
    await request(app).post('/api/v1/auth/login').expect(401);
  });
});
