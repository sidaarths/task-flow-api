import mongoose from 'mongoose';

export interface IBoard extends mongoose.Document {
  title: string;
  description: string;
  createdBy: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  backgroundColor: string;
  createdAt: Date;
  updatedAt: Date;
}

const boardSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  backgroundColor: { type: String, default: '#E2E8F0' }
}, { timestamps: true });

export const Board = mongoose.model<IBoard>('Board', boardSchema);
