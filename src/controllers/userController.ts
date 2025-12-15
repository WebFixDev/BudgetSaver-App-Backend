// src/controllers/userController.ts
import { Request, Response, NextFunction } from "express";
import User, { IUser } from "../models/user.model";
import { ObjectId } from "mongodb";
import { ErrorResponse } from "../utils/errorResponse";

// Get all users (admin only)
export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      role,
      isActive,
      search,
      page = '1',
      limit = '10',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query: any = {};

    // Filter by role
    if (role && ['agent', 'admin'].includes(role as string)) {
      query.role = role;
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Get total count
    const total = await User.countDocuments(query);

    // Get users
    const users = await User.find(query)
      .select('-__v')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get user by ID
export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return next(new ErrorResponse('Invalid user ID format', 400));
    }

    const user = await User.findById(id)
      .select('-__v')
      .lean();

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// Get current user from token
export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return next(new ErrorResponse('User not authenticated', 401));
    }

    const user = await User.findById(userId)
      .select('-__v')
      .lean();

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// Create new user (admin only)
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      email,
      phone,
      role = 'agent',
      isActive = true,
      address,
      dateOfBirth,
      gender,
      bio
    } = req.body;

    // Validate required fields
    if (!name || !email) {
      return next(new ErrorResponse('Name and email are required', 400));
    }

    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return next(new ErrorResponse('Please provide a valid email address', 400));
    }

    // Validate phone format if provided
    if (phone) {
      const phoneRegex = /^\+?\d{10,15}$/;
      if (!phoneRegex.test(phone)) {
        return next(new ErrorResponse('Please provide a valid phone number', 400));
      }
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return next(new ErrorResponse('Email already registered', 409));
    }

    // Create user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim(),
      role,
      isActive,
      address: address?.trim(),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender,
      bio: bio?.trim()
    });

    await user.save();

    // Remove sensitive data from response
    const userResponse = user.toObject();
    delete (userResponse as any).__v;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userResponse
    });
  } catch (error) {
    next(error);
  }
};

// Update user
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!ObjectId.isValid(id)) {
      return next(new ErrorResponse('Invalid user ID format', 400));
    }

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return next(new ErrorResponse('User not found', 404));
    }

    const updateFields: any = {};

    // Update name
    if (updateData.name !== undefined) {
      if (!updateData.name.trim()) {
        return next(new ErrorResponse('Name cannot be empty', 400));
      }
      updateFields.name = updateData.name.trim();
    }

    // Update email with validation and duplicate check
    if (updateData.email !== undefined && updateData.email !== existingUser.email) {
      const email = updateData.email.toLowerCase().trim();
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      
      if (!emailRegex.test(email)) {
        return next(new ErrorResponse('Please provide a valid email address', 400));
      }

      const duplicateUser = await User.findOne({ 
        email,
        _id: { $ne: id }
      });
      
      if (duplicateUser) {
        return next(new ErrorResponse('Email already registered', 409));
      }
      updateFields.email = email;
    }

    // Update phone with validation
    if (updateData.phone !== undefined) {
      if (updateData.phone === '') {
        updateFields.phone = undefined;
      } else {
        const phoneRegex = /^\+?\d{10,15}$/;
        if (!phoneRegex.test(updateData.phone)) {
          return next(new ErrorResponse('Please provide a valid phone number', 400));
        }
        updateFields.phone = updateData.phone.trim();
      }
    }

    // Update role
    if (updateData.role !== undefined) {
      if (!['agent', 'admin'].includes(updateData.role)) {
        return next(new ErrorResponse('Role must be either agent or admin', 400));
      }
      updateFields.role = updateData.role;
    }

    // Update isActive
    if (updateData.isActive !== undefined) {
      if (typeof updateData.isActive !== 'boolean') {
        return next(new ErrorResponse('isActive must be a boolean value', 400));
      }
      updateFields.isActive = updateData.isActive;
    }

    // Update other fields
    if (updateData.address !== undefined) {
      updateFields.address = updateData.address?.trim() || undefined;
    }

    if (updateData.dateOfBirth !== undefined) {
      if (updateData.dateOfBirth === '') {
        updateFields.dateOfBirth = undefined;
      } else {
        const date = new Date(updateData.dateOfBirth);
        if (isNaN(date.getTime())) {
          return next(new ErrorResponse('Invalid date of birth format', 400));
        }
        updateFields.dateOfBirth = date;
      }
    }

    if (updateData.gender !== undefined) {
      if (updateData.gender === '') {
        updateFields.gender = undefined;
      } else if (!['male', 'female', 'other'].includes(updateData.gender)) {
        return next(new ErrorResponse('Gender must be male, female, or other', 400));
      }
      updateFields.gender = updateData.gender;
    }

    if (updateData.bio !== undefined) {
      updateFields.bio = updateData.bio?.trim() || undefined;
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .select('-__v')
      .lean();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

// Update current user profile
export const updateCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const updateData = req.body;

    if (!userId) {
      return next(new ErrorResponse('User not authenticated', 401));
    }

    // Check if user exists
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return next(new ErrorResponse('User not found', 404));
    }

    const updateFields: any = {};

    // Update name
    if (updateData.name !== undefined) {
      if (!updateData.name.trim()) {
        return next(new ErrorResponse('Name cannot be empty', 400));
      }
      updateFields.name = updateData.name.trim();
    }

    // Update email with validation and duplicate check
    if (updateData.email !== undefined && updateData.email !== existingUser.email) {
      const email = updateData.email.toLowerCase().trim();
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      
      if (!emailRegex.test(email)) {
        return next(new ErrorResponse('Please provide a valid email address', 400));
      }

      const duplicateUser = await User.findOne({ 
        email,
        _id: { $ne: userId }
      });
      
      if (duplicateUser) {
        return next(new ErrorResponse('Email already registered', 409));
      }
      updateFields.email = email;
    }

    // Update phone with validation
    if (updateData.phone !== undefined) {
      if (updateData.phone === '') {
        updateFields.phone = undefined;
      } else {
        const phoneRegex = /^\+?\d{10,15}$/;
        if (!phoneRegex.test(updateData.phone)) {
          return next(new ErrorResponse('Please provide a valid phone number', 400));
        }
        updateFields.phone = updateData.phone.trim();
      }
    }

    // Users cannot change their own role or isActive
    // Remove these fields if present
    delete updateData.role;
    delete updateData.isActive;

    // Update other fields
    if (updateData.address !== undefined) {
      updateFields.address = updateData.address?.trim() || undefined;
    }

    if (updateData.dateOfBirth !== undefined) {
      if (updateData.dateOfBirth === '') {
        updateFields.dateOfBirth = undefined;
      } else {
        const date = new Date(updateData.dateOfBirth);
        if (isNaN(date.getTime())) {
          return next(new ErrorResponse('Invalid date of birth format', 400));
        }
        updateFields.dateOfBirth = date;
      }
    }

    if (updateData.gender !== undefined) {
      if (updateData.gender === '') {
        updateFields.gender = undefined;
      } else if (!['male', 'female', 'other'].includes(updateData.gender)) {
        return next(new ErrorResponse('Gender must be male, female, or other', 400));
      }
      updateFields.gender = updateData.gender;
    }

    if (updateData.bio !== undefined) {
      updateFields.bio = updateData.bio?.trim() || undefined;
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .select('-__v')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

// Delete user
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return next(new ErrorResponse('Invalid user ID format', 400));
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Prevent deleting yourself (optional)
    const currentUserId = (req as any).user?.id;
    if (currentUserId === id) {
      return next(new ErrorResponse('You cannot delete your own account', 400));
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
};

// Toggle user active status
export const toggleUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return next(new ErrorResponse('Invalid user ID format', 400));
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Prevent toggling your own status (optional)
    const currentUserId = (req as any).user?.id;
    if (currentUserId === id) {
      return next(new ErrorResponse('You cannot change your own status', 400));
    }

    const newStatus = !user.isActive;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: newStatus } },
      { new: true, runValidators: true }
    )
      .select('-__v')
      .lean();

    res.status(200).json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

// Get user statistics
export const getUserStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const statistics = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
          inactiveUsers: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } },
          totalAgents: { $sum: { $cond: [{ $eq: ['$role', 'agent'] }, 1, 0] } },
          totalAdmins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          usersWithPhone: { $sum: { $cond: [{ $ifNull: ['$phone', false] }, 1, 0] } },
          usersWithAddress: { $sum: { $cond: [{ $ifNull: ['$address', false] }, 1, 0] } },
          maleUsers: { $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] } },
          femaleUsers: { $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] } },
          otherGenderUsers: { $sum: { $cond: [{ $eq: ['$gender', 'other'] }, 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          totalUsers: 1,
          activeUsers: 1,
          inactiveUsers: 1,
          totalAgents: 1,
          totalAdmins: 1,
          usersWithPhone: 1,
          usersWithAddress: 1,
          maleUsers: 1,
          femaleUsers: 1,
          otherGenderUsers: 1,
          usersWithoutGender: {
            $subtract: [
              '$totalUsers',
              { $add: ['$maleUsers', '$femaleUsers', '$otherGenderUsers'] }
            ]
          }
        }
      }
    ]);

    const stats = statistics[0] || {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      totalAgents: 0,
      totalAdmins: 0,
      usersWithPhone: 0,
      usersWithAddress: 0,
      maleUsers: 0,
      femaleUsers: 0,
      otherGenderUsers: 0,
      usersWithoutGender: 0
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};