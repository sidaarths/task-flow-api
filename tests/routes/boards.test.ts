import request from 'supertest';
import app from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { createTestUser, generateTestToken, getAuthHeader, getBasicAuthHeader } from '../helpers/auth';

let token: string;
let userId: string;

beforeAll(async () => {
  process.env.MONGODB_URI = 'mongodb://placeholder';
  process.env.JWT_SECRET = 'test-secret-key-must-be-at-least-32-chars!!';
  await connectTestDB();
});
afterAll(() => disconnectTestDB());
beforeEach(async () => {
  await clearTestDB();
  const user = await createTestUser();
  userId = user._id.toString();
  token = generateTestToken(user._id);
});

describe('GET /api/v1/boards', () => {
  it('returns 401 without auth token', async () => {
    await request(app).get('/api/v1/boards').expect(401);
  });

  it('returns empty array for new user', async () => {
    const res = await request(app)
      .get('/api/v1/boards')
      .set(getAuthHeader(token))
      .expect(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/v1/boards', () => {
  it('returns 401 without auth token', async () => {
    await request(app).post('/api/v1/boards').send({ title: 'Test' }).expect(401);
  });

  it('returns 400 for missing title', async () => {
    await request(app)
      .post('/api/v1/boards')
      .set(getAuthHeader(token))
      .send({})
      .expect(400);
  });

  it('creates a board and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/boards')
      .set(getAuthHeader(token))
      .send({ title: 'My Board', description: 'A test board' })
      .expect(201);
    expect(res.body.title).toBe('My Board');
    expect(res.body.createdBy).toBe(userId);
  });

  it('returns 400 for title exceeding 100 chars', async () => {
    await request(app)
      .post('/api/v1/boards')
      .set(getAuthHeader(token))
      .send({ title: 'x'.repeat(101) })
      .expect(400);
  });
});

describe('GET /api/v1/boards/:boardId', () => {
  let boardId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/boards')
      .set(getAuthHeader(token))
      .send({ title: 'Board for tests' });
    boardId = res.body._id;
  });

  it('returns 401 without auth', async () => {
    await request(app).get(`/api/v1/boards/${boardId}`).expect(401);
  });

  it('returns board with lists and tasks', async () => {
    const res = await request(app)
      .get(`/api/v1/boards/${boardId}`)
      .set(getAuthHeader(token))
      .expect(200);
    expect(res.body.board._id).toBe(boardId);
    expect(res.body.lists).toEqual([]);
    expect(res.body.tasks).toEqual([]);
  });

  it('returns 403 for user who is not a member', async () => {
    const otherUser = await createTestUser('other@example.com');
    const otherToken = generateTestToken(otherUser._id);
    await request(app)
      .get(`/api/v1/boards/${boardId}`)
      .set(getAuthHeader(otherToken))
      .expect(403);
  });

  it('returns 404 for non-existent board', async () => {
    await request(app)
      .get('/api/v1/boards/000000000000000000000000')
      .set(getAuthHeader(token))
      .expect(404);
  });
});

describe('PUT /api/v1/boards/:boardId', () => {
  let boardId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/boards')
      .set(getAuthHeader(token))
      .send({ title: 'Update Test Board' });
    boardId = res.body._id;
  });

  it('updates board title', async () => {
    const res = await request(app)
      .put(`/api/v1/boards/${boardId}`)
      .set(getAuthHeader(token))
      .send({ title: 'Updated Title' })
      .expect(200);
    expect(res.body.title).toBe('Updated Title');
  });

  it('returns 403 for non-creator', async () => {
    const otherUser = await createTestUser('other2@example.com');
    // Add as member first
    await request(app)
      .post(`/api/v1/boards/${boardId}/users/${otherUser._id}`)
      .set(getAuthHeader(token));
    const otherToken = generateTestToken(otherUser._id);
    await request(app)
      .put(`/api/v1/boards/${boardId}`)
      .set(getAuthHeader(otherToken))
      .send({ title: 'Hacked' })
      .expect(403);
  });
});

describe('DELETE /api/v1/boards/:boardId', () => {
  it('deletes board and returns 200', async () => {
    const res = await request(app)
      .post('/api/v1/boards')
      .set(getAuthHeader(token))
      .send({ title: 'Delete Me' });
    await request(app)
      .delete(`/api/v1/boards/${res.body._id}`)
      .set(getAuthHeader(token))
      .expect(200);
  });

  it('returns 403 for non-creator', async () => {
    const boardRes = await request(app)
      .post('/api/v1/boards')
      .set(getAuthHeader(token))
      .send({ title: 'Protected Board' });
    const other = await createTestUser('other3@example.com');
    const otherToken = generateTestToken(other._id);
    await request(app)
      .delete(`/api/v1/boards/${boardRes.body._id}`)
      .set(getAuthHeader(otherToken))
      .expect(403);
  });
});

describe('POST /api/v1/boards/:boardId/users/:userId (member management)', () => {
  let boardId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/boards')
      .set(getAuthHeader(token))
      .send({ title: 'Member Test Board' });
    boardId = res.body._id;
  });

  it('adds a member to the board', async () => {
    const other = await createTestUser('newmember@example.com');
    const res = await request(app)
      .post(`/api/v1/boards/${boardId}/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(200);
    expect(res.body.members).toContain(other._id.toString());
  });

  it('returns 400 for duplicate member', async () => {
    const other = await createTestUser('dup@example.com');
    await request(app)
      .post(`/api/v1/boards/${boardId}/users/${other._id}`)
      .set(getAuthHeader(token));
    await request(app)
      .post(`/api/v1/boards/${boardId}/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(400);
  });

  it('returns 403 for non-creator adding member', async () => {
    const other = await createTestUser('membertry@example.com');
    const otherToken = generateTestToken(other._id);
    await request(app)
      .post(`/api/v1/boards/${boardId}/users/${other._id}`)
      .set(getAuthHeader(otherToken))
      .expect(403);
  });
});

describe('DELETE /api/v1/boards/:boardId/users/:userId (member removal)', () => {
  let boardId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/boards')
      .set(getAuthHeader(token))
      .send({ title: 'Remove Test Board' });
    boardId = res.body._id;
  });

  it('removes a member from the board', async () => {
    const other = await createTestUser('removeme@example.com');
    await request(app)
      .post(`/api/v1/boards/${boardId}/users/${other._id}`)
      .set(getAuthHeader(token));
    const res = await request(app)
      .delete(`/api/v1/boards/${boardId}/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(200);
    expect(res.body.members).not.toContain(other._id.toString());
  });

  it('returns 404 for member not on board', async () => {
    const other = await createTestUser('notamember@example.com');
    await request(app)
      .delete(`/api/v1/boards/${boardId}/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(404);
  });
});
