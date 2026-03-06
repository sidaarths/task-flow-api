import request from 'supertest';
import app from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db';
import { createTestUser, generateTestToken, getAuthHeader } from '../helpers/auth';

let token: string;
let boardId: string;
let listId: string;

beforeAll(async () => {
  process.env.MONGODB_URI = 'mongodb://placeholder';
  process.env.JWT_SECRET = 'test-secret-key-must-be-at-least-32-chars!!';
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
    .send({ title: 'To Do' });
  listId = listRes.body._id;
});

describe('POST /api/v1/lists/:listId/tasks', () => {
  it('creates a task in a list', async () => {
    const res = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'My Task' })
      .expect(201);
    expect(res.body.title).toBe('My Task');
    expect(res.body.listId).toBe(listId);
    expect(res.body.position).toBe(0);
  });

  it('returns 400 for missing title', async () => {
    await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({})
      .expect(400);
  });

  it('returns 401 without auth', async () => {
    await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .send({ title: 'Task' })
      .expect(401);
  });
});

describe('PUT /api/v1/tasks/:taskId', () => {
  let taskId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Original Task' });
    taskId = res.body._id;
  });

  it('updates task fields', async () => {
    const res = await request(app)
      .put(`/api/v1/tasks/${taskId}`)
      .set(getAuthHeader(token))
      .send({ title: 'Updated Task', description: 'New description' })
      .expect(200);
    expect(res.body.title).toBe('Updated Task');
    expect(res.body.description).toBe('New description');
  });

  it('returns 400 for empty body', async () => {
    await request(app)
      .put(`/api/v1/tasks/${taskId}`)
      .set(getAuthHeader(token))
      .send({})
      .expect(400);
  });

  it('returns 403 for non-member', async () => {
    const other = await createTestUser('other@example.com');
    const otherToken = generateTestToken(other._id);
    await request(app)
      .put(`/api/v1/tasks/${taskId}`)
      .set(getAuthHeader(otherToken))
      .send({ title: 'Hack' })
      .expect(403);
  });
});

describe('DELETE /api/v1/tasks/:taskId', () => {
  it('deletes a task', async () => {
    const res = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Delete Me' });
    await request(app)
      .delete(`/api/v1/tasks/${res.body._id}`)
      .set(getAuthHeader(token))
      .expect(200);
  });
});

describe('GET /api/v1/tasks/:taskId', () => {
  it('returns task details', async () => {
    const createRes = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Fetch Me' });
    const res = await request(app)
      .get(`/api/v1/tasks/${createRes.body._id}`)
      .set(getAuthHeader(token))
      .expect(200);
    expect(res.body.title).toBe('Fetch Me');
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/v1/tasks/000000000000000000000000').expect(401);
  });

  it('returns 403 for non-member', async () => {
    const createRes = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Private Task' });
    const other = await createTestUser('spy@example.com');
    const otherToken = generateTestToken(other._id);
    await request(app)
      .get(`/api/v1/tasks/${createRes.body._id}`)
      .set(getAuthHeader(otherToken))
      .expect(403);
  });
});

describe('PUT /api/v1/tasks/:taskId/position', () => {
  it('moves a task to a new position', async () => {
    const t1 = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Task 1' });
    await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Task 2' });
    await request(app)
      .put(`/api/v1/tasks/${t1.body._id}/position`)
      .set(getAuthHeader(token))
      .send({ position: 1 })
      .expect(200);
  });

  it('returns 400 for invalid position', async () => {
    const t1 = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Task' });
    await request(app)
      .put(`/api/v1/tasks/${t1.body._id}/position`)
      .set(getAuthHeader(token))
      .send({ position: 'invalid' })
      .expect(400);
  });
});

describe('POST /api/v1/tasks/:taskId/users/:userId (assign)', () => {
  it('assigns a board member to a task', async () => {
    const other = await createTestUser('assign@example.com');
    // Add other as board member
    await request(app)
      .post(`/api/v1/boards/${boardId}/users/${other._id}`)
      .set(getAuthHeader(token));
    const taskRes = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Assign Task' });
    const res = await request(app)
      .post(`/api/v1/tasks/${taskRes.body._id}/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(200);
    expect(res.body.assignedTo).toContain(other._id.toString());
  });

  it('returns 400 if user is not a board member', async () => {
    const other = await createTestUser('nonmember@example.com');
    const taskRes = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Unassignable' });
    await request(app)
      .post(`/api/v1/tasks/${taskRes.body._id}/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(400);
  });
});

describe('DELETE /api/v1/tasks/:taskId/users/:userId (unassign)', () => {
  it('unassigns a user from a task', async () => {
    const other = await createTestUser('unassign@example.com');
    await request(app)
      .post(`/api/v1/boards/${boardId}/users/${other._id}`)
      .set(getAuthHeader(token));
    const taskRes = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Task to unassign' });
    await request(app)
      .post(`/api/v1/tasks/${taskRes.body._id}/users/${other._id}`)
      .set(getAuthHeader(token));
    const res = await request(app)
      .delete(`/api/v1/tasks/${taskRes.body._id}/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(200);
    expect(res.body.assignedTo).not.toContain(other._id.toString());
  });

  it('returns 404 for non-existent task', async () => {
    const other = await createTestUser('no-task@example.com');
    await request(app)
      .delete(`/api/v1/tasks/000000000000000000000000/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(404);
  });

  it('returns 403 for non-member caller', async () => {
    const other = await createTestUser('spy-unassign@example.com');
    const otherToken = generateTestToken(other._id);
    const taskRes = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Protected' });
    await request(app)
      .delete(`/api/v1/tasks/${taskRes.body._id}/users/${other._id}`)
      .set(getAuthHeader(otherToken))
      .expect(403);
  });

  it('returns 404 when user is not assigned', async () => {
    const other = await createTestUser('notassigned@example.com');
    await request(app)
      .post(`/api/v1/boards/${boardId}/users/${other._id}`)
      .set(getAuthHeader(token));
    const taskRes = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Unassigned Task' });
    await request(app)
      .delete(`/api/v1/tasks/${taskRes.body._id}/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(404);
  });
});

describe('POST /api/v1/tasks/:taskId/users/:userId — extra coverage', () => {
  it('returns 404 for non-existent task', async () => {
    const other = await createTestUser('assign-404@example.com');
    await request(app)
      .post(`/api/v1/tasks/000000000000000000000000/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(404);
  });

  it('returns 403 when caller is not a board member', async () => {
    const spy = await createTestUser('assign-spy@example.com');
    const spyToken = generateTestToken(spy._id);
    const taskRes = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Protected Task' });
    const target = await createTestUser('assign-target@example.com');
    await request(app)
      .post(`/api/v1/tasks/${taskRes.body._id}/users/${target._id}`)
      .set(getAuthHeader(spyToken))
      .expect(403);
  });

  it('returns 400 when user is already assigned', async () => {
    const other = await createTestUser('double-assign@example.com');
    await request(app)
      .post(`/api/v1/boards/${boardId}/users/${other._id}`)
      .set(getAuthHeader(token));
    const taskRes = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Task' });
    // Assign once
    await request(app)
      .post(`/api/v1/tasks/${taskRes.body._id}/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(200);
    // Try to assign again
    await request(app)
      .post(`/api/v1/tasks/${taskRes.body._id}/users/${other._id}`)
      .set(getAuthHeader(token))
      .expect(400);
  });
});

describe('GET /api/v1/tasks/:taskId — extra coverage', () => {
  it('returns 404 for non-existent task', async () => {
    await request(app)
      .get('/api/v1/tasks/000000000000000000000000')
      .set(getAuthHeader(token))
      .expect(404);
  });
});

describe('PUT /api/v1/tasks/:taskId — extra coverage', () => {
  it('returns 404 for non-existent task', async () => {
    await request(app)
      .put('/api/v1/tasks/000000000000000000000000')
      .set(getAuthHeader(token))
      .send({ title: 'Ghost' })
      .expect(404);
  });
});

describe('PUT /api/v1/tasks/:taskId/position — extra coverage', () => {
  it('returns 404 for non-existent task', async () => {
    await request(app)
      .put('/api/v1/tasks/000000000000000000000000/position')
      .set(getAuthHeader(token))
      .send({ position: 0 })
      .expect(404);
  });

  it('returns 403 for non-member', async () => {
    const taskRes = await request(app)
      .post(`/api/v1/lists/${listId}/tasks`)
      .set(getAuthHeader(token))
      .send({ title: 'Private' });
    const spy = await createTestUser('pos-spy@example.com');
    const spyToken = generateTestToken(spy._id);
    await request(app)
      .put(`/api/v1/tasks/${taskRes.body._id}/position`)
      .set(getAuthHeader(spyToken))
      .send({ position: 0 })
      .expect(403);
  });
});
