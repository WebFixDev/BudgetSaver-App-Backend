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
  netProfit: number;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
  createdBy?: ObjectId;
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
    minlength: 3,
    maxlength: 200
  },
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true,
    uppercase: true
  }, 
  description: { 
    type: String, 
    trim: true,
    maxlength: 1000
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
  netProfit: { 
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
    ref: 'User'
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


ProjectSchema.index({ status: 1 });
ProjectSchema.index({ createdAt: -1 });

const Project = mongoose.model<IProject>('Project', ProjectSchema);
export default Project;