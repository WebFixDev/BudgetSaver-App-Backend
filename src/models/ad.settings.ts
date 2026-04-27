// src/models/AdSettings.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IAdSettings extends Document {
  thresholds: {
    projects: number;
    parties: number;
    transactions: number;
    shares: number;
    edits: number;
    deletes: number;
  };
  globalAdsEnabled: boolean; // Agar kabhi poori app se ads band karne hon
}

const adSettingsSchema = new Schema<IAdSettings>({
  thresholds: {
    projects: { type: Number, default: 1 },
    parties: { type: Number, default: 1 },
    transactions: { type: Number, default: 5 },
    shares: { type: Number, default: 1 },
    edits: { type: Number, default: 10 },
    deletes: { type: Number, default: 5 },
  },
  globalAdsEnabled: { type: Boolean, default: true }
}, { timestamps: true });

const AdSettings = mongoose.model<IAdSettings>("AdSettings", adSettingsSchema);
export default AdSettings;