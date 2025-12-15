// services/activityLog.service.ts
import UserActivityLog, { IUserActivityLog } from '../models/UserActivityLog.model';

export interface ActivityLogData {
  userId: any;
  action: string;
  resource: string;
  resourceId?: any;
  description: string;
  status?: "success" | "failure";
}

export class ActivityLogService {
  /**
   * Log user activity
   */
  static async logActivity(data: ActivityLogData): Promise<IUserActivityLog> {
    try {
      const log = new UserActivityLog(data);
      return await log.save();
    } catch (error) {
      console.error('Failed to log activity:', error);
      throw error;
    }
  }

  /**
   * Get activity logs for a user
   */
  static async getUserActivityLogs(
    userId: string, 
    page: number = 1, 
    limit: number = 50
  ): Promise<{ logs: IUserActivityLog[], total: number }> {
    try {
      const skip = (page - 1) * limit;
      
      const [logs, total] = await Promise.all([
        UserActivityLog.find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        UserActivityLog.countDocuments({ userId })
      ]);
      
      return { logs, total };
    } catch (error) {
      console.error('Failed to get user activity logs:', error);
      throw error;
    }
  }

  /**
   * Get activity logs by filters
   */
  static async getActivityLogs(
    filters: any = {},
    page: number = 1, 
    limit: number = 50
  ): Promise<{ logs: IUserActivityLog[], total: number }> {
    try {
      const skip = (page - 1) * limit;
      
      const [logs, total] = await Promise.all([
        UserActivityLog.find(filters)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        UserActivityLog.countDocuments(filters)
      ]);
      
      return { logs, total };
    } catch (error) {
      console.error('Failed to get activity logs:', error);
      throw error;
    }
  }
}