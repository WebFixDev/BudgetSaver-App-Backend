import mongoose, { Schema, Document } from 'mongoose';

export interface IUserActivityLog extends Document {
  userId: mongoose.Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: mongoose.Types.ObjectId;
  description: string;
  status: "success" | "failure";
}

const UserActivityLogSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId },
    description: { type: String, required: true },
    status: { type: String, enum: ["success", "failure"], default: "success" },
  },
  { timestamps: true }
);

export default mongoose.model<IUserActivityLog>('UserActivityLog', UserActivityLogSchema);
