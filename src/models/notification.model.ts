import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId; 
  title: string; 
  message: string;
  entityType: 'PROJECT' | 'PARTY' | 'TRANSACTION' | 'SYSTEM';
  entityId?: Types.ObjectId; 
  isRead: boolean;
  type: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS'; 
  pushSent: boolean; 
  
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema({
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  
  entityType: {
    type: String,
    enum: ['PROJECT', 'PARTY', 'TRANSACTION', 'SYSTEM'],
    required: true,
    index: true,
  },
  entityId: { type: Schema.Types.ObjectId, required: false },
  
  isRead: { type: Boolean, default: false, index: true },
  type: {
    type: String,
    enum: ['INFO', 'WARNING', 'CRITICAL', 'SUCCESS'],
    default: 'INFO',
  },

  // New field
  pushSent: { type: Boolean, default: false }, 
  
  createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
export default Notification;