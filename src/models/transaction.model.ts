import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface ITransaction extends Document {
  project: ObjectId;
  party: ObjectId;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  currency: string;
  date: Date;
  reference?: string;
  notes?: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

const TransactionSchema: Schema = new Schema({
  project: { 
    type: Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true, 
    index: true
  },
  party: { 
    type: Schema.Types.ObjectId, 
    ref: 'Party',
    required: true
  }, 
  type: { 
    type: String, 
    enum: ['INCOME', 'EXPENSE'], 
    required: true,
    index: true
  },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'PKR', trim: true },
  date: { type: Date, default: Date.now, index: true },
  reference: { type: String, trim: true },
  notes: { type: String, trim: true },
  
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  isDeleted: { type: Boolean, default: false } 
});

TransactionSchema.index({ project: 1, date: -1, type: 1 });

const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
export default Transaction;