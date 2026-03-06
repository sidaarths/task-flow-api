import mongoose from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: mongoose.Types.ObjectId;
      };
    }
  }
}
