// src/controllers/projectController.ts
import { Request, Response, NextFunction } from 'express';
import Project, { IProject } from '../models/project.model';
import Party from '../models/party.model';
import { ObjectId } from 'mongodb';
import { ErrorResponse } from '../utils/errorResponse';

// Get all projects with filtering and pagination
export const getAllProjects = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const {
      status,
      createdBy,
      page = '1',
      limit = '10',
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query: any = {};

    // Filter by status
    if (status && ['PLANNED', 'ACTIVE', 'COMPLETED', 'ON_HOLD'].includes(status as string)) {
      query.status = status;
    }

    // Filter by createdBy
    if (createdBy && ObjectId.isValid(createdBy as string)) {
      query.createdBy = new ObjectId(createdBy as string);
    }

    // Search by title or code
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Get total count for pagination
    const total = await Project.countDocuments(query);

    // Get projects
    const projects = await Project.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get parties count for each project
    const projectsWithParties = await Promise.all(
      projects.map(async (project) => {
        const [clientsCount, vendorsCount] = await Promise.all([
          Party.countDocuments({ 
            project: project._id, 
            partyType: 'CLIENT',
            status: 'ACTIVE'
          }),
          Party.countDocuments({ 
            project: project._id, 
            partyType: 'VENDOR',
            status: 'ACTIVE'
          })
        ]);

        return {
          ...project,
          partiesSummary: {
            total: clientsCount + vendorsCount,
            clients: clientsCount,
            vendors: vendorsCount
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      data: projectsWithParties,
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

// Get single project by ID with parties
export const getProjectById = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return next(new ErrorResponse('Invalid project ID format', 400));
    }

    // Get project
    const project = await Project.findById(id).lean();

    if (!project) {
      return next(new ErrorResponse('Project not found', 404));
    }

    // Get all parties for this project
    const [clients, vendors] = await Promise.all([
      Party.find({ 
        project: id, 
        partyType: 'CLIENT' 
      })
        .select('name uniqueId contact status createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      Party.find({ 
        project: id, 
        partyType: 'VENDOR' 
      })
        .select('name uniqueId contact status createdAt')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    // Get financial summary from parties (if applicable)
    const financialSummary = {
      totalIncome: project.totalIncome || 0,
      totalExpense: project.totalExpense || 0,
      netProfit: project.netProfit || 0,
      initialBudget: project.initialBudget || 0,
      remainingBudget: (project.initialBudget || 0) - (project.totalExpense || 0)
    };

    // Add parties to project response
    const projectWithDetails = {
      ...project,
      parties: {
        clients,
        vendors
      },
      counts: {
        total: clients.length + vendors.length,
        clients: clients.length,
        vendors: vendors.length,
        activeClients: clients.length,
        activeVendors: vendors.length
      },
      financial: financialSummary
    };

    res.status(200).json({
      success: true,
      data: projectWithDetails
    });
  } catch (error) {
    next(error);
  }
};

// Get project by code
export const getProjectByCode = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { code } = req.params;

    // Get project
    const project = await Project.findOne({ code: code.toUpperCase() }).lean();

    if (!project) {
      return next(new ErrorResponse('Project not found', 404));
    }

    // Get parties for this project
    const [clients, vendors] = await Promise.all([
      Party.find({ 
        project: project._id, 
        partyType: 'CLIENT' 
      })
        .select('name uniqueId contact.email contact.phone status')
        .limit(10)
        .lean(),
      Party.find({ 
        project: project._id, 
        partyType: 'VENDOR' 
      })
        .select('name uniqueId contact.email contact.phone status')
        .limit(10)
        .lean()
    ]);

    const projectWithParties = {
      ...project,
      quickView: {
        clientsCount: clients.length,
        vendorsCount: vendors.length,
        recentClients: clients.slice(0, 5),
        recentVendors: vendors.slice(0, 5)
      }
    };

    res.status(200).json({
      success: true,
      data: projectWithParties
    });
  } catch (error) {
    next(error);
  }
};

// Create new project
export const createProject = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const {
      title,
      code,
      description,
      projectImage,
      initialBudget = 0,
      status = 'ACTIVE',
      startDate,
      endDate
    } = req.body;

    // Validate required fields
    if (!title?.trim()) {
      return next(new ErrorResponse('Title is required', 400));
    }

    if (!code?.trim()) {
      return next(new ErrorResponse('Project code is required', 400));
    }

    // Validate initial budget
    if (initialBudget < 0) {
      return next(new ErrorResponse('Initial budget cannot be negative', 400));
    }

    // Validate status
    if (status && !['PLANNED', 'ACTIVE', 'COMPLETED', 'ON_HOLD'].includes(status)) {
      return next(new ErrorResponse('Invalid status value', 400));
    }

    // Format code to uppercase
    const formattedCode = code.trim().toUpperCase();

    // Check if project code already exists
    const existingProject = await Project.findOne({ code: formattedCode });
    if (existingProject) {
      return next(new ErrorResponse(`Project code '${formattedCode}' already exists`, 409));
    }

    // Validate dates
    let startDateObj: Date | undefined;
    let endDateObj: Date | undefined;

    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return next(new ErrorResponse('Invalid start date format', 400));
      }
    }

    if (endDate) {
      endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return next(new ErrorResponse('Invalid end date format', 400));
      }

      // Check if end date is before start date
      if (startDateObj && endDateObj < startDateObj) {
        return next(new ErrorResponse('End date cannot be before start date', 400));
      }
    }

    // Create project data
    const projectData: Partial<IProject> = {
      title: title.trim(),
      code: formattedCode,
      description: description?.trim(),
      initialBudget,
      projectImage,
      status,
      startDate: startDateObj,
      endDate: endDateObj,
    };

    // Add createdBy if user is authenticated
    if (req.user?.id && ObjectId.isValid(req.user.id)) {
      projectData.createdBy = new ObjectId(req.user.id);
    }

    // Create new project
    const project = new Project(projectData);
    await project.save();

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project
    });
  } catch (error) {
    next(error);
  }
};

// Update project
export const updateProject = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!ObjectId.isValid(id)) {
      return next(new ErrorResponse('Invalid project ID format', 400));
    }

    // Find project first
    const existingProject = await Project.findById(id);
    if (!existingProject) {
      return next(new ErrorResponse('Project not found', 404));
    }

    const updateFields: any = {};

    // Update title
    if (updateData.title !== undefined) {
      if (!updateData.title.trim()) {
        return next(new ErrorResponse('Title cannot be empty', 400));
      }
      updateFields.title = updateData.title.trim();
    }

    // Update code with duplicate check
    if (updateData.code !== undefined && updateData.code !== existingProject.code) {
      const formattedCode = updateData.code.trim().toUpperCase();
      
      const duplicateProject = await Project.findOne({ 
        code: formattedCode,
        _id: { $ne: id }
      });
      
      if (duplicateProject) {
        return next(new ErrorResponse(`Project code '${formattedCode}' already exists`, 409));
      }
      updateFields.code = formattedCode;
    }

    // Update description
    if (updateData.description !== undefined) {
      updateFields.description = updateData.description?.trim() || undefined;
    }

    // Update initial budget
    if (updateData.initialBudget !== undefined) {
      if (updateData.initialBudget < 0) {
        return next(new ErrorResponse('Initial budget cannot be negative', 400));
      }
      updateFields.initialBudget = updateData.initialBudget;
    }

    // Update status
    if (updateData.status !== undefined) {
      if (!['PLANNED', 'ACTIVE', 'COMPLETED', 'ON_HOLD'].includes(updateData.status)) {
        return next(new ErrorResponse('Invalid status value', 400));
      }
      updateFields.status = updateData.status;
    }

    // Update dates
    if (updateData.startDate !== undefined) {
      const startDate = new Date(updateData.startDate);
      if (isNaN(startDate.getTime())) {
        return next(new ErrorResponse('Invalid start date format', 400));
      }
      updateFields.startDate = startDate;
    }

    if (updateData.endDate !== undefined) {
      const endDate = new Date(updateData.endDate);
      if (isNaN(endDate.getTime())) {
        return next(new ErrorResponse('Invalid end date format', 400));
      }
      
      // Validate end date against start date
      const startDate = updateFields.startDate || existingProject.startDate;
      if (startDate && endDate < startDate) {
        return next(new ErrorResponse('End date cannot be before start date', 400));
      }
      updateFields.endDate = endDate;
    }

    // Update financial fields (if allowed)
    if (updateData.totalIncome !== undefined) {
      if (updateData.totalIncome < 0) {
        return next(new ErrorResponse('Total income cannot be negative', 400));
      }
      updateFields.totalIncome = updateData.totalIncome;
      // Auto-calculate net profit
      updateFields.netProfit = updateData.totalIncome - (updateFields.totalExpense || existingProject.totalExpense);
    }

    if (updateData.totalExpense !== undefined) {
      if (updateData.totalExpense < 0) {
        return next(new ErrorResponse('Total expense cannot be negative', 400));
      }
      updateFields.totalExpense = updateData.totalExpense;
      // Auto-calculate net profit
      updateFields.netProfit = (updateFields.totalIncome || existingProject.totalIncome) - updateData.totalExpense;
    }

    // Update project
    const updatedProject = await Project.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject
    });
  } catch (error) {
    next(error);
  }
};

// Delete project
export const deleteProject = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return next(new ErrorResponse('Invalid project ID format', 400));
    }

    // Check if project exists
    const project = await Project.findById(id);
    if (!project) {
      return next(new ErrorResponse('Project not found', 404));
    }

    // Check if project has any parties
    const partiesCount = await Party.countDocuments({ project: id });
    
    if (partiesCount > 0) {
      return next(new ErrorResponse(
        `Cannot delete project. It has ${partiesCount} associated parties. Delete parties first or use force delete.`,
        400
      ));
    }

    // Delete the project
    await Project.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      data: {
        id: project._id,
        title: project.title,
        code: project.code
      }
    });
  } catch (error) {
    next(error);
  }
};

// Force delete project (with all parties)
export const forceDeleteProject = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return next(new ErrorResponse('Invalid project ID format', 400));
    }

    // Check if project exists
    const project = await Project.findById(id);
    if (!project) {
      return next(new ErrorResponse('Project not found', 404));
    }

    // Delete all parties associated with this project
    const deleteResult = await Party.deleteMany({ project: id });

    // Delete the project
    await Project.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Project and all associated parties deleted successfully',
      data: {
        project: {
          id: project._id,
          title: project.title,
          code: project.code
        },
        partiesDeleted: deleteResult.deletedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update project status
export const updateProjectStatus = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return next(new ErrorResponse('Invalid project ID format', 400));
    }

    // Validate status
    if (!['PLANNED', 'ACTIVE', 'COMPLETED', 'ON_HOLD'].includes(status)) {
      return next(new ErrorResponse('Invalid status value', 400));
    }

    const updatedProject = await Project.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedProject) {
      return next(new ErrorResponse('Project not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Project status updated successfully',
      data: updatedProject
    });
  } catch (error) {
    next(error);
  }
};

// Get project statistics
export const getProjectStatistics = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { createdBy } = req.query;

    const matchStage: any = {};
    
    // Filter by createdBy if provided
    if (createdBy && ObjectId.isValid(createdBy as string)) {
      matchStage.createdBy = new ObjectId(createdBy as string);
    }

    const statistics = await Project.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          totalBudget: { $sum: '$initialBudget' },
          totalIncome: { $sum: '$totalIncome' },
          totalExpense: { $sum: '$totalExpense' },
          totalNetProfit: { $sum: '$netProfit' },
          activeProjects: {
            $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] }
          },
          completedProjects: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          },
          plannedProjects: {
            $sum: { $cond: [{ $eq: ['$status', 'PLANNED'] }, 1, 0] }
          },
          onHoldProjects: {
            $sum: { $cond: [{ $eq: ['$status', 'ON_HOLD'] }, 1, 0] }
          },
          overdueProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'ACTIVE'] },
                    { $ne: ['$endDate', null] },
                    { $lt: ['$endDate', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          budgetUtilization: {
            $cond: [
              { $eq: ['$totalBudget', 0] },
              0,
              { $divide: ['$totalExpense', '$totalBudget'] }
            ]
          },
          averageBudget: {
            $cond: [
              { $eq: ['$totalProjects', 0] },
              0,
              { $divide: ['$totalBudget', '$totalProjects'] }
            ]
          },
          successRate: {
            $cond: [
              { $eq: ['$totalProjects', 0] },
              0,
              { $divide: ['$completedProjects', '$totalProjects'] }
            ]
          }
        }
      }
    ]);

    const stats = statistics[0] || {
      totalProjects: 0,
      totalBudget: 0,
      totalIncome: 0,
      totalExpense: 0,
      totalNetProfit: 0,
      activeProjects: 0,
      completedProjects: 0,
      plannedProjects: 0,
      onHoldProjects: 0,
      overdueProjects: 0,
      budgetUtilization: 0,
      averageBudget: 0,
      successRate: 0
    };

    // Get parties statistics
    const partiesStats = await Party.aggregate([
      {
        $lookup: {
          from: 'projects',
          localField: 'project',
          foreignField: '_id',
          as: 'projectInfo'
        }
      },
      { $unwind: '$projectInfo' },
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalParties: { $sum: 1 },
          totalClients: {
            $sum: { $cond: [{ $eq: ['$partyType', 'CLIENT'] }, 1, 0] }
          },
          totalVendors: {
            $sum: { $cond: [{ $eq: ['$partyType', 'VENDOR'] }, 1, 0] }
          },
          activeParties: {
            $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] }
          }
        }
      }
    ]);

    const partiesData = partiesStats[0] || {
      totalParties: 0,
      totalClients: 0,
      totalVendors: 0,
      activeParties: 0
    };

    res.status(200).json({
      success: true,
      data: {
        projects: stats,
        parties: partiesData,
        combined: {
          totalEntities: stats.totalProjects + partiesData.totalParties,
          activeEntities: stats.activeProjects + partiesData.activeParties
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update project financials
export const updateProjectFinancials = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { totalIncome, totalExpense } = req.body;

    if (!ObjectId.isValid(id)) {
      return next(new ErrorResponse('Invalid project ID format', 400));
    }

    // Validate financial values
    if (totalIncome !== undefined && totalIncome < 0) {
      return next(new ErrorResponse('Total income cannot be negative', 400));
    }

    if (totalExpense !== undefined && totalExpense < 0) {
      return next(new ErrorResponse('Total expense cannot be negative', 400));
    }

    const updateFields: any = {};

    if (totalIncome !== undefined) {
      updateFields.totalIncome = totalIncome;
    }

    if (totalExpense !== undefined) {
      updateFields.totalExpense = totalExpense;
    }

    // Calculate net profit
    const project = await Project.findById(id);
    if (!project) {
      return next(new ErrorResponse('Project not found', 404));
    }

    const finalIncome = totalIncome !== undefined ? totalIncome : project.totalIncome;
    const finalExpense = totalExpense !== undefined ? totalExpense : project.totalExpense;
    updateFields.netProfit = finalIncome - finalExpense;

    // Update project
    const updatedProject = await Project.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    res.status(200).json({
      success: true,
      message: 'Project financials updated successfully',
      data: updatedProject
    });
  } catch (error) {
    next(error);
  }
};