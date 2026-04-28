// src/models/AppConfig.ts
import mongoose, { Schema, Document } from 'mongoose';

// TypeScript Interface
export interface IAppConfig extends Document {
  requiredVersionCode: number;
  forceUpdate: boolean;
  playStoreUrl: string;
}

// Mongoose Schema
const AppConfigSchema: Schema = new Schema(
  {
    requiredVersionCode: { 
      type: Number, 
      required: true, 
      default: 1 
    },
    forceUpdate: { 
      type: Boolean, 
      required: true, 
      default: false 
    },
    playStoreUrl: { 
      type: String, 
      required: true, 
      default: "market://details?id=com.budgetsaver" 
    }
  }, 
  { 
    timestamps: true // Yeh automatically createdAt aur updatedAt add kar dega
  }
);

// Export the model
export default mongoose.model<IAppConfig>('AppConfig', AppConfigSchema);