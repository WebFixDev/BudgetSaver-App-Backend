// middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/authToken';
import User from '../models/user.model';
import { Types } from 'mongoose';
import { ErrorResponse } from '../utils/errorResponse';

// Extend the Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user: {
        id: Types.ObjectId | string;
        role: string;
      };
    }
  }
}

// Verify JWT token middleware
export const verifyTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ message: 'Access token required' });
    return;
  }

  try {
    // ✅ Decode token
    const decoded: any = await verifyToken(token);
    if (!decoded?.id) {
      res.status(403).json({ message: 'Invalid token payload' });
      return;
    }

    // ✅ Fetch user from DB
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // ✅ Attach user to request
    req.user = {
      id: user._id,
      role: user.role, // assuming role field exists in user model

    };

    // ✅ Extra: Check if role is admin
    if (user.role === 'admin') {
      console.log('✅ Admin user authenticated:', user.email);
    } else {
      console.log('✅ Normal user authenticated:', user.email);
    }

    next();
  } catch (error: any) {
    console.error('Auth middleware error:', error);

    if (error.name === 'TokenExpiredError') {
      res.status(403).json({ message: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      res.status(403).json({ message: 'Invalid token' });
    } else {
      res.status(403).json({ message: 'Failed to authenticate token' });
    }
  }
};

export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ErrorResponse('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ErrorResponse('Access denied. Insufficient permissions.', 403));
    }

    next();
  };
};