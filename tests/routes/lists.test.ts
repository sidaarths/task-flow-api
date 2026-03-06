import request from 'supertest';
import app from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { createTestUser, generateTestToken, getAuthHeader } from '../helpers/auth';

let token: string;
let boardId: string;
let listId: string;

beforeAll(async () => {
  await connectTestDB();
});
afterAll(() => disconnectTestDB());
beforeEach(async () => {
  await clearTestDB();
  const user = await createTestUser();
  token = generateTestToken(user._id);

  const boardRes = await request(app)
    .post('/api/v1/boards')
    .set(getAuthHeader(token))
    .send({ title: 'Test Board' });
  boardId = boardRes.body._id;

  const listRes = await request(app)
    .post(`/api/v1/boards/${boardId}/lists`)
    .set(getAuthHeader(token))
    .send({ title: 'Initial List' });
  listId = listRes.body._id;
});

// ─── Create list ──────────────────────────────────────────────────────────────
describe('POST /api/v1/boards/:boardId/lists', () => {
  it('creates a list in a board', async () => {
    const res = await request(app)
      .post(`/api/v1/boards/${boardId}/lists`)
      .set(getAuthHeader(token))
      .send({ title: 'To Do' })
      .expect(201);
    expect(res.body.title).toBe('To Do');
    expect(res.body.boardId).toBe(boardId);
    expect(res.body.position).toBe(1); // 0 is taken by Initial List
  });

  it('returns 400 for missing title', async () => {
    await request(app)
      .post(`/api/v1/boards/${boardId}/lists`)
      .set(getAuthHeader(token))
      .send({})
      .expect(400);
  });

  it('returns 401 without auth', async () => {
    await request(app)
      .post(`/api/v1/boards/${boardId}/lists`)
      .send({ title: 'To Do' })
      .expect(401);
  });

  it('returns 403 for non-member', async () => {
    const other = await createTestUser('other@example.com');
    const otherToken = generateTestToken(other._id);
    await request(app)
      .post(`/api/v1/boards/${boardId}/lists`)
      .set(getAuthHeader(otherToken))
      .send({ title: 'Sneaky List' })
      .expect(403);
  });
});

// ─── Update list ──────────────────────────────────────────────────────────────
describe('PUT /api/v1/lists/:listId', () => {
  it('updates list title', async () => {
    const res = await request(app)
      .put(`/api/v1/lists/${listId}`)
      .set(getAuthHeader(token))
      .send({ title: 'Updated Title' })
      .expect(200);
    expect(res.body.title).toBe('Updated Title');
  });

  it('returns 400 for empty body', async () => {
    await request(app)
      .put(`/api/v1/lists/${listId}`)
      .set(getAuthHeader(token))
      .send({})
      .expect(400);
  });

  it('returns 401 without auth', async () => {
    await request(app)
      .put(`/api/v1/lists/${listId}`)
      .send({ title: 'No Auth' })
      .expect(401);
  });

  it('returns 404 for non-existent list', async () => {
    await request(app)
      .put('/api/v1/lists/000000000000000000000000')
      .set(getAuthHeader(token))
      .send({ title: 'Ghost' })
      .expect(404);
  });

  it('returns 403 for non-member', async () => {
    const other = await createTestUser('other2@example.com');
    const otherToken = generateTestToken(other._id);
    await request(app)
      .put(`/api/v1/lists/${listId}`)
      .set(getAuthHeader(otherToken))
      .send({ title: 'Unauthorized' })
      .expect(403);
  });
});

// ─── Delete list ──────────────────────────────────────────────────────────────
describe('DELETE /api/v1/lists/:listId', () => {
  it('deletes a list and its tasks', async () => {
    // Create a task in the list
    await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Task to delete' });

    const res = await request(app)
      .delete(`/api/v1/lists/${listId}`)
      .set(getAuthHeader(token))
      .expect(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 401 without auth', async () => {
    await request(app).delete(`/api/v1/lists/${listId}`).expect(401);
  });

  it('returns 404 for non-existent list', async () => {
    await request(app)
      .delete('/api/v1/lists/000000000000000000000000')
      .set(getAuthHeader(token))
      .expect(404);
  });

  it('returns 403 for non-member', async () => {
    const other = await createTestUser('other3@example.com');
    const otherToken = generateTestToken(other._id);
    await request(app)
      .delete(`/api/v1/lists/${listId}`)
      .set(getAuthHeader(otherToken))
      .expect(403);
  });
});

// ─── Update list position ─────────────────────────────────────────────────────
describe('PUT /api/v1/lists/:listId/position', () => {
  let listId2: string;

  beforeEach(async () => {
    const res = await request(app)
      .post(`/api/v1/boards/${boardId}/lists`)
      .set(getAuthHeader(token))
      .send({ title: 'Second List' });
    listId2 = res.body._id;
  });

  it('updates list position', async () => {
    const res = await request(app)
      .put(`/api/v1/lists/${listId}/position`)
      .set(getAuthHeader(token))
      .send({ position: 1 })
      .expect(200);
    expect(res.body.message).toMatch(/position updated/i);
  });

  it('returns 400 for non-numeric position', async () => {
    await request(app)
      .put(`/api/v1/lists/${listId}/position`)
      .set(getAuthHeader(token))
      .send({ position: 'first' })
      .expect(400);
  });

  it('returns 400 for missing position', async () => {
    await request(app)
      .put(`/api/v1/lists/${listId}/position`)
      .set(getAuthHeader(token))
      .send({})
      .expect(400);
  });

  it('returns 404 for non-existent list', async () => {
    await request(app)
      .put('/api/v1/lists/000000000000000000000000/position')
      .set(getAuthHeader(token))
      .send({ position: 0 })
      .expect(404);
  });

  it('returns 403 for non-member', async () => {
    const other = await createTestUser('other4@example.com');
    const otherToken = generateTestToken(other._id);
    await request(app)
      .put(`/api/v1/lists/${listId}/position`)
      .set(getAuthHeader(otherToken))
      .send({ position: 0 })
      .expect(403);
  });

  it('returns 401 without auth', async () => {
    await request(app)
      .put(`/api/v1/lists/${listId}/position`)
      .send({ position: 0 })
      .expect(401);
  });
});

// ─── Get tasks in list ────────────────────────────────────────────────────────
describe('GET /api/v1/lists/:listId/tasks', () => {
  beforeEach(async () => {
    await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Task 1' });
  });

  it('returns tasks in a list', async () => {
    const res = await request(app)
      .get(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Task 1');
  });

  it('returns 401 without auth', async () => {
    await request(app).get(`/api/v1/lists/${listId}/tasks`).expect(401);
  });

  it('returns 404 for non-existent list', async () => {
    await request(app)
      .get('/api/v1/lists/000000000000000000000000/tasks')
      .set(getAuthHeader(token))
      .expect(404);
  });

  it('returns 403 for non-member', async () => {
    const other = await createTestUser('other5@example.com');
    const otherToken = generateTestToken(other._id);
    await request(app)
      .get(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(otherToken))
      .expect(403);
  });
});

// ─── Create task in list ──────────────────────────────────────────────────────
describe('POST /api/v1/lists/:listId/tasks', () => {
  it('creates a task in the list', async () => {
    const res = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'New Task' })
      .expect(201);
    expect(res.body.title).toBe('New Task');
    expect(res.body.listId).toBe(listId);
    expect(res.body.position).toBe(0);
  });

  it('auto-increments position', async () => {
    await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Task 1' });
    const res = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Task 2' })
      .expect(201);
    expect(res.body.position).toBe(1);
  });

  it('returns 401 without auth', async () => {
    await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .send({ title: 'Ghost' })
      .expect(401);
  });

  it('returns 404 for non-existent list', async () => {
    await request(app)
      .post('/api/v1/lists/000000000000000000000000/tasks')
      .set(getAuthHeader(token))
      .send({ title: 'Ghost' })
      .expect(404);
  });

  it('returns 403 for non-member', async () => {
    const other = await createTestUser('other6@example.com');
    const otherToken = generateTestToken(other._id);
    await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(otherToken))
      .send({ title: 'Sneaky Task' })
      .expect(403);
  });
});
