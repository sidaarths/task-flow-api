import mongoose from 'mongoose';

export interface IList extends mongoose.Document {
  title: string;
  boardId: mongoose.Types.ObjectId;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

const listSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  position: { type: Number, required: true, default: 0 }
}, { timestamps: true });

export const List = mongoose.model<IList>('List', listSchema);
