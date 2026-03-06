import request from 'supertest';
import app from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { createTestUser, generateTestToken } from '../helpers/auth';
import jwt from 'jsonwebtoken';

let token: string;
let boardId: string;

beforeAll(async () => {
  await connectTestDB();
});
afterAll(() => disconnectTestDB());
beforeEach(async () => {
  await clearTestDB();
  const user = await createTestUser();
  token = generateTestToken(user._id);

  // Create a board so we have a valid boardId
  const res = await request(app)
    .post('/api/v1/boards')
    .set({ Authorization: `Bearer ${token}` })
    .send({ title: 'SSE Test Board' });
  boardId = res.body._id;
});

describe('GET /api/v1/sse/boards/:boardId', () => {
  it('returns 401 when no token is provided', async () => {
    await request(app)
      .get(`/api/v1/sse/boards/${boardId}`)
      .expect(401);
  });

  it('returns 401 for an invalid/expired token', async () => {
    await request(app)
      .get(`/api/v1/sse/boards/${boardId}?token=invalid.jwt.token`)
      .expect(401);
  });

  it('returns 400 for an invalid boardId format', async () => {
    await request(app)
      .get(`/api/v1/sse/boards/not-a-valid-id?token=${token}`)
      .expect(400);
  });

  it('returns 404 when board does not exist', async () => {
    await request(app)
      .get(`/api/v1/sse/boards/000000000000000000000000?token=${token}`)
      .expect(404);
  });

  it('returns 403 when user is not a board member', async () => {
    const other = await createTestUser('other@example.com');
    const otherToken = generateTestToken(other._id);
    await request(app)
      .get(`/api/v1/sse/boards/${boardId}?token=${otherToken}`)
      .expect(403);
  });

  it('returns 401 for a token with invalid payload (no userId)', async () => {
    // Sign a token that has no userId field
    const badToken = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    await request(app)
      .get(`/api/v1/sse/boards/${boardId}?token=${badToken}`)
      .expect(401);
  });
});
