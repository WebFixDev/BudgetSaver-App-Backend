import mongoose, { Document, Schema, Types } from 'mongoose';

// Defines the structure for storing a user's device token for push notifications
export interface IDeviceToken extends Document {
  _id: Types.ObjectId;
  
  user: Types.ObjectId; // The user who owns this device
  token: string; // The push notification token (e.g., FCM, Expo token)
  platform: 'ios' | 'android' | 'web' | 'unknown'; // Device OS
  
  // To manage token lifecycle
  lastUsed: Date; 
  isActive: boolean; // Flag to deactivate tokens that failed to send
  
  createdAt: Date;
}

const DeviceTokenSchema: Schema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    unique: true, // A token should be unique across all users/devices
    trim: true,
  },
  platform: {
    type: String,
    enum: ['ios', 'android', 'web', 'unknown'],
    default: 'unknown',
    required: true,
  },
  
  lastUsed: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

// Compound index for quick lookup and token management
DeviceTokenSchema.index({ user: 1, platform: 1, isActive: 1 });

const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
export default DeviceToken;