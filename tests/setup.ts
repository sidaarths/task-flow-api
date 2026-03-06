// This runs before any module imports in each test worker.
// Set required env vars before env.ts is evaluated.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/taskflow-test';
process.env.JWT_SECRET = 'test-secret-key-must-be-at-least-32-chars!!';
process.env.PORT = '3001';
process.env.LOG_LEVEL = 'error'; // suppress logs in tests
