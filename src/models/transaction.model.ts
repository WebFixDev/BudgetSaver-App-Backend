import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface ITransaction extends Document {
  project: ObjectId;
  party: ObjectId;
  type: 'income' | 'expense'; 
  amount: number;
  date: Date;
  note?: string; // Frontend ke 'note' field se match karne ke liye
  fileUrl?: string; // Image/Receipt ka public URL
  fileName?: string; // File ka naam (e.g., receipt_123.jpg)
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
    enum: ['income', 'expense'], 
    required: true,
    index: true
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 0 
  },

  date: { 
    type: Date, 
    default: Date.now, 
    index: true 
  },
  note: {
    type: String, 
    trim: true 
  },
  // File details
  fileUrl: { 
    type: String,
    trim: true 
  },
  fileName: { 
    type: String,
    trim: true 
  },
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  isDeleted: { 
    type: Boolean, 
    default: false 
  } 
}, {
  timestamps: true 
});

TransactionSchema.index({ project: 1, date: -1 });

const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
export default Transaction;