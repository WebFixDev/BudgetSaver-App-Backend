// src/models/project.model.ts
import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IProject extends Document {
  title: string;
  code: string;
  description?: string;
  initialBudget: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  currency: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
  createdBy: ObjectId; // Changed from optional to required
  projectImage?: string;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 2,
    maxlength: 200
  },
  code: { 
    type: String, 
    required: true, 
    trim: true,
    uppercase: true
    // REMOVED: unique: true - We'll handle uniqueness with createdBy
  }, 
  description: { 
    type: String, 
    trim: true,
    maxlength: 1000
  },
    currency: { 
    type: String, 
    default: 'USD',
    trim: true 
  },
  initialBudget: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  totalIncome: { 
    type: Number, 
    default: 0,
    min: 0
  },
  totalExpense: { 
    type: Number, 
    default: 0,
    min: 0
  },
  balance: { 
    type: Number, 
    default: 0
  },

  status: { 
    type: String, 
    enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'ON_HOLD'], 
    default: 'ACTIVE',
  },
  createdBy: { 
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true // Made required
  },
  projectImage: { 
    type: String, 
    trim: true 
  },
  startDate: { 
    type: Date, 
    default: Date.now 
  },
  endDate: { 
    type: Date 
  }
}, {
  timestamps: true
});

// Add compound index for code + createdBy to ensure uniqueness per user
ProjectSchema.index({ code: 1, createdBy: 1 }, { unique: true });

// Other indexes
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ createdBy: 1 });
ProjectSchema.index({ createdAt: -1 });

const Project = mongoose.model<IProject>('Project', ProjectSchema);
export default Project;