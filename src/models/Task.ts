import mongoose from 'mongoose';

export interface ITask extends mongoose.Document {
  title: string;
  description: string;
  listId: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId[];
  labels: string[];
  dueDate: Date;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 1 },
  description: { type: String, trim: true },
  listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List', required: true },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  labels: [{ type: String, trim: true }],
  dueDate: { type: Date },
  position: { type: Number, required: true, default: 0 },
}, { timestamps: true });

export const Task = mongoose.model<ITask>('Task', taskSchema);
