// src/controllers/partyController.ts
import { Request, Response, NextFunction } from 'express';
import Party from '../models/party.model';
import Project from '../models/project.model';
import { ObjectId } from 'mongodb';
import { ErrorResponse } from '../utils/errorResponse';

// Create party for a project
export const createParty = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const {
      name,
      partyType,
      description,
      profileImage,
      contact
    } = req.body;

    // Validate required fields
    if (!projectId || !ObjectId.isValid(projectId)) {
      return next(new ErrorResponse('Valid project ID is required', 400));
    }

    if (!name || !partyType) {
      return next(new ErrorResponse('Name and partyType are required', 400));
    }

    // Validate partyType
    if (!['CLIENT', 'VENDOR'].includes(partyType)) {
      return next(new ErrorResponse('partyType must be CLIENT or VENDOR', 400));
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return next(new ErrorResponse('Project not found', 404));
    }

    // Check if party with same name already exists in same project
    const existingParty = await Party.findOne({ 
      project: projectId, 
      name: name.trim()
    });
    
    if (existingParty) {
      return next(new ErrorResponse(`Party with name '${name}' already exists in this project`, 409));
    }

    // Create party
    const party = new Party({
      name: name.trim(),
      partyType,
      description: description?.trim(),
      profileImage: profileImage?.trim(),
      contact: contact || {},
      project: new ObjectId(projectId)
    });

    await party.save();

    res.status(201).json({
      success: true,
      message: `${partyType} created successfully`,
      data: party
    });
  } catch (error) {
    next(error);
  }
};

// Get all parties for a project
export const getProjectParties = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { 
      partyType, 
      search,
      page = '1',
      limit = '10'
    } = req.query;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return next(new ErrorResponse('Valid project ID is required', 400));
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return next(new ErrorResponse('Project not found', 404));
    }

    const query: any = { project: projectId };

    // Filter by partyType
    if (partyType && ['CLIENT', 'VENDOR'].includes(partyType as string)) {
      query.partyType = partyType;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } },
        { 'contact.phone': { $regex: search, $options: 'i' } },
        { 'contact.address': { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await Party.countDocuments(query);

    // Get parties
    const parties = await Party.find(query)
      .select('name partyType description profileImage contact createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get counts
    const clients = parties.filter(p => p.partyType === 'CLIENT');
    const vendors = parties.filter(p => p.partyType === 'VENDOR');

    res.status(200).json({
      success: true,
      data: {
        project: {
          id: project._id,
          title: project.title,
          code: project.code
        },
        parties,
        summary: {
          total: parties.length,
          clients: clients.length,
          vendors: vendors.length,
          withProfileImage: parties.filter(p => p.profileImage).length,
          withEmail: parties.filter(p => p.contact?.email).length,
          withPhone: parties.filter(p => p.contact?.phone).length
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single party by ID
export const getPartyById = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId, partyId } = req.params;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return next(new ErrorResponse('Valid project ID is required', 400));
    }

    if (!partyId || !ObjectId.isValid(partyId)) {
      return next(new ErrorResponse('Valid party ID is required', 400));
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return next(new ErrorResponse('Project not found', 404));
    }

    // Get party
    const party = await Party.findOne({
      _id: partyId,
      project: projectId
    }).lean();

    if (!party) {
      return next(new ErrorResponse('Party not found', 404));
    }

    res.status(200).json({
      success: true,
      data: party
    });
  } catch (error) {
    next(error);
  }
};

// Update party
export const updateParty = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId, partyId } = req.params;
    const updateData = req.body;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return next(new ErrorResponse('Valid project ID is required', 400));
    }

    if (!partyId || !ObjectId.isValid(partyId)) {
      return next(new ErrorResponse('Valid party ID is required', 400));
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return next(new ErrorResponse('Project not found', 404));
    }

    // Check if party exists
    const existingParty = await Party.findOne({
      _id: partyId,
      project: projectId
    });
    
    if (!existingParty) {
      return next(new ErrorResponse('Party not found', 404));
    }

    // Prepare update
    const updateFields: any = {};

    // Update name with duplicate check
    if (updateData.name !== undefined && updateData.name !== existingParty.name) {
      const duplicate = await Party.findOne({
        project: projectId,
        name: updateData.name.trim(),
        _id: { $ne: partyId }
      });
      
      if (duplicate) {
        return next(new ErrorResponse(`Party with name '${updateData.name}' already exists in this project`, 409));
      }
      updateFields.name = updateData.name.trim();
    }

    // Update partyType
    if (updateData.partyType !== undefined) {
      if (!['CLIENT', 'VENDOR'].includes(updateData.partyType)) {
        return next(new ErrorResponse('partyType must be CLIENT or VENDOR', 400));
      }
      updateFields.partyType = updateData.partyType;
    }

    // Update description
    if (updateData.description !== undefined) {
      updateFields.description = updateData.description?.trim() || undefined;
    }

    // Update profileImage
    if (updateData.profileImage !== undefined) {
      updateFields.profileImage = updateData.profileImage?.trim() || undefined;
    }

    // Update contact
    if (updateData.contact) {
      updateFields.contact = { ...existingParty.contact };

      if (updateData.contact.email !== undefined) {
        updateFields.contact.email = updateData.contact.email?.trim().toLowerCase() || undefined;
      }

      if (updateData.contact.phone !== undefined) {
        updateFields.contact.phone = updateData.contact.phone?.trim() || undefined;
      }

      if (updateData.contact.address !== undefined) {
        updateFields.contact.address = updateData.contact.address?.trim() || undefined;
      }
    }

    // Update party
    const updatedParty = await Party.findByIdAndUpdate(
      partyId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    res.status(200).json({
      success: true,
      message: 'Party updated successfully',
      data: updatedParty
    });
  } catch (error) {
    next(error);
  }
};

// Delete party
export const deleteParty = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId, partyId } = req.params;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return next(new ErrorResponse('Valid project ID is required', 400));
    }

    if (!partyId || !ObjectId.isValid(partyId)) {
      return next(new ErrorResponse('Valid party ID is required', 400));
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return next(new ErrorResponse('Project not found', 404));
    }

    // Check if party exists
    const party = await Party.findOne({
      _id: partyId,
      project: projectId
    });

    if (!party) {
      return next(new ErrorResponse('Party not found', 404));
    }

    // Delete party
    await Party.findByIdAndDelete(partyId);

    res.status(200).json({
      success: true,
      message: 'Party deleted successfully',
      data: {
        id: party._id,
        name: party.name,
        partyType: party.partyType
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get party statistics for project
export const getPartyStatistics = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return next(new ErrorResponse('Valid project ID is required', 400));
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return next(new ErrorResponse('Project not found', 404));
    }

    // Get statistics
    const stats = await Party.aggregate([
      { $match: { project: new ObjectId(projectId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          clients: { $sum: { $cond: [{ $eq: ['$partyType', 'CLIENT'] }, 1, 0] } },
          vendors: { $sum: { $cond: [{ $eq: ['$partyType', 'VENDOR'] }, 1, 0] } },
          withDescription: { $sum: { $cond: [{ $ifNull: ['$description', false] }, 1, 0] } },
          withProfileImage: { $sum: { $cond: [{ $ifNull: ['$profileImage', false] }, 1, 0] } },
          withEmail: { $sum: { $cond: [{ $ifNull: ['$contact.email', false] }, 1, 0] } },
          withPhone: { $sum: { $cond: [{ $ifNull: ['$contact.phone', false] }, 1, 0] } },
          withAddress: { $sum: { $cond: [{ $ifNull: ['$contact.address', false] }, 1, 0] } }
        }
      }
    ]);

    const statistics = stats[0] || {
      total: 0,
      clients: 0,
      vendors: 0,
      withDescription: 0,
      withProfileImage: 0,
      withEmail: 0,
      withPhone: 0,
      withAddress: 0
    };

    res.status(200).json({
      success: true,
      data: {
        project: {
          id: project._id,
          title: project.title,
          code: project.code
        },
        statistics
      }
    });
  } catch (error) {
    next(error);
  }
};