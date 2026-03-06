import request from 'supertest';
import app from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { createTestUser, generateTestToken, getAuthHeader } from '../helpers/auth';

let token: string;

beforeAll(async () => {
  await connectTestDB();
});
afterAll(() => disconnectTestDB());
beforeEach(async () => {
  await clearTestDB();
  const user = await createTestUser();
  token = generateTestToken(user._id);
});

describe('GET /api/v1/users/me', () => {
  it('returns current user profile', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set(getAuthHeader(token))
      .expect(200);
    expect(res.body.email).toBe('test@example.com');
    expect(res.body.password).toBeUndefined();
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/v1/users/me').expect(401);
  });
});

describe('GET /api/v1/users', () => {
  it('returns users matching email query', async () => {
    await createTestUser('alice@example.com');
    await createTestUser('bob@example.com');

    const res = await request(app)
      .get('/api/v1/users?email=alice')
      .set(getAuthHeader(token))
      .expect(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].email).toBe('alice@example.com');
  });

  it('returns 400 without email query param', async () => {
    await request(app)
      .get('/api/v1/users')
      .set(getAuthHeader(token))
      .expect(400);
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/v1/users?email=test').expect(401);
  });
});

describe('GET /api/v1/users/:userId', () => {
  it('returns user by ID', async () => {
    const other = await createTestUser('other@example.com');
    const res = await request(app)
      .get(`/api/v1/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(200);
    expect(res.body.email).toBe('other@example.com');
    expect(res.body.password).toBeUndefined();
  });

  it('returns 404 for non-existent user', async () => {
    await request(app)
      .get('/api/v1/users/000000000000000000000000')
      .set(getAuthHeader(token))
      .expect(404);
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/v1/users/000000000000000000000000').expect(401);
  });
});
