// src/models/party.model.ts
import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IParty extends Document {
  name: string;
  partyType: 'CLIENT' | 'VENDOR';
  profileImage?: string;
  description?: string;
  contact: {
    email?: string;
    phone?: string;
    address?: string;
  };
  project: ObjectId; 
  createdAt: Date;
}

const PartySchema: Schema = new Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    trim: true 
  },
  profileImage: {
    type: String,
    trim: true
  },
  partyType: { 
    type: String, 
    enum: ['CLIENT', 'VENDOR'], 
    required: true
  },
  contact: {
    email: { 
      type: String, 
      trim: true, 
      lowercase: true 
    },
    phone: { 
      type: String, 
      trim: true 
    },
    address: { 
      type: String, 
      trim: true 
    }
  },
  project: { 
    type: Schema.Types.ObjectId, 
    ref: 'Project',
    required: true
  },

  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

// Indexes
PartySchema.index({ partyType: 1, status: 1 });
PartySchema.index({ project: 1, partyType: 1 });

const Party = mongoose.model<IParty>('Party', PartySchema);
export default Party;
