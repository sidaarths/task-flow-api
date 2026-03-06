# Task Flow API

A RESTful API for a Kanban-style task management application. Built with Express.js, MongoDB, and TypeScript.

## Features

- **JWT authentication** via HTTP Basic Auth (register/login)
- **Real-time updates** via Server-Sent Events (SSE) — no WebSocket dependency
- **Input validation** on every endpoint using Zod schemas
- **Security hardening** — Helmet headers, CORS whitelist, rate limiting
- **Demo accounts** — single endpoint creates an isolated sandbox with sample data
- **Full test suite** — 118 tests, 82%+ coverage via Jest + Supertest + mongodb-memory-server

## Tech Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express 5 |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Validation | Zod |
| Real-time | Server-Sent Events |
| Security | Helmet, express-rate-limit, CORS |
| Logging | Winston (structured JSON) |
| Testing | Jest + Supertest + mongodb-memory-server |

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas). A `docker-compose.yml` is included for local dev.

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and fill in your values
cp .env.example .env

# 3. Start MongoDB (if using Docker)
docker-compose up -d

# 4. Start the dev server
npm run dev
```

The server starts on `http://localhost:3001`.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret key — **minimum 32 characters** |
| `PORT` | No | HTTP port (default: `3001`) |
| `NODE_ENV` | No | `development` or `production` |
| `CLIENT_URL` | No | Frontend origin for CORS (default: `http://localhost:3000`) |
| `LOG_LEVEL` | No | Winston log level (default: `info`) |

### Running Tests

```bash
npm test                    # run all tests
npm test -- --coverage      # with coverage report
npm test -- --watch         # watch mode
```

Coverage thresholds: 80% statements/lines, 70% branches, 80% functions.

## API Reference

All routes are prefixed with `/api/v1`.

### Authentication

Credentials for `/register` and `/login` are passed via **HTTP Basic Auth** header:
```
Authorization: Basic base64(email:password)
```

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Create a new account |
| `POST` | `/auth/login` | None | Get a JWT token |
| `POST` | `/auth/demo` | None | Create isolated demo account with sample data |

**Demo response** also includes `boardId` so clients can redirect straight to the demo board:
```json
{ "token": "eyJ...", "boardId": "64abc..." }
```

All other endpoints require a Bearer token:
```
Authorization: Bearer <jwt>
```

---

### Boards

| Method | Path | Description |
|---|---|---|
| `GET` | `/boards` | List all boards the user belongs to |
| `POST` | `/boards` | Create a board |
| `GET` | `/boards/:boardId` | Get board with its lists and tasks |
| `PUT` | `/boards/:boardId` | Update board title/description (owner only) |
| `DELETE` | `/boards/:boardId` | Delete board and all its lists/tasks (owner only) |
| `POST` | `/boards/:boardId/lists` | Create a list in the board |
| `POST` | `/boards/:boardId/users/:userId` | Add a member (owner only) |
| `DELETE` | `/boards/:boardId/users/:userId` | Remove a member (owner only) |

---

### Lists

| Method | Path | Description |
|---|---|---|
| `PUT` | `/lists/:listId` | Update list title |
| `DELETE` | `/lists/:listId` | Delete list and all its tasks |
| `PUT` | `/lists/:listId/position` | Reorder list within the board |
| `GET` | `/lists/:listId/tasks` | Get all tasks in a list |
| `POST` | `/lists/:listId/tasks` | Create a task in the list |

**List position body:**
```json
{ "position": 2 }
```

---

### Tasks

| Method | Path | Description |
|---|---|---|
| `GET` | `/tasks/:taskId` | Get task details |
| `PUT` | `/tasks/:taskId` | Update task fields |
| `DELETE` | `/tasks/:taskId` | Delete task |
| `PUT` | `/tasks/:taskId/position` | Reorder task within or across lists |
| `POST` | `/tasks/:taskId/users/:userId` | Assign a board member to the task |
| `DELETE` | `/tasks/:taskId/users/:userId` | Unassign a user from the task |

**Task position body:**
```json
{ "position": 1, "listId": "64abc..." }
```

---

### Users

| Method | Path | Description |
|---|---|---|
| `GET` | `/users/me` | Get current user profile |
| `GET` | `/users?email=alice` | Search users by email (for invite flow) |

---

### Real-Time (SSE)

| Method | Path | Description |
|---|---|---|
| `GET` | `/sse/boards/:boardId?token=<jwt>` | Subscribe to board events |

The JWT is passed as a query param because the browser's `EventSource` API cannot send custom headers.

**Events emitted:**

| Event name | Trigger |
|---|---|
| `connected` | On first connection |
| `list:created` | List added to board |
| `list:updated` | List title changed |
| `list:deleted` | List removed |
| `task:created` | Task added to list |
| `task:updated` | Task fields changed |
| `task:deleted` | Task removed |
| `board:updated` | Board title/description changed |
| `board:member-added` | Member invited |
| `board:member-removed` | Member removed |

---

## Architecture

```
src/
├── app.ts              # Express app (exported for Supertest)
├── index.ts            # HTTP server entry point
├── config/
│   └── env.ts          # Zod-validated environment variables
├── middleware/
│   ├── auth.ts         # JWT Bearer verification
│   ├── validate.ts     # Zod schema middleware factory
│   └── errorHandler.ts # Centralised error handler + AppError class
├── models/             # Mongoose models (User, Board, List, Task)
├── routes/             # Express routers (auth, boards, lists, tasks, users, sse)
├── schemas/            # Zod request schemas
└── utils/
    ├── sseManager.ts   # In-memory SSE pub/sub
    └── logger.ts       # Winston logger
```

## Rate Limits

| Scope | Limit |
|---|---|
| All routes | 200 requests / 15 min |
| Auth routes | 20 requests / 15 min |

## Error Responses

All errors follow a consistent shape:

```json
{ "message": "Human-readable description" }
```

Validation errors (400) include field-level detail:

```json
{
  "message": "Validation failed",
  "errors": { "body": { "title": ["Required"] } }
}
```
