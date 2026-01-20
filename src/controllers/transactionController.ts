// src/controllers/transaction.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import Transaction, { ITransaction } from "../models/transaction.model";
import Project, { IProject } from "../models/project.model";
import Party, { IParty } from "../models/party.model";

interface ITransactionRequest extends Request {
  body: {
    project: string;
    party: string;
    type: 'income' | 'expense';
    amount: number;
    date?: Date | string;
    note?: string;
    fileUrl?: string;
    fileName?: string;
  };
  query: {
    page?: string;
    limit?: string;
    startDate?: string;
    endDate?: string;
    type?: 'income' | 'expense';
    project?: string;
    party?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}


// Parameter type ko Types.ObjectId kar dein
const getProjectsByUser = async (userId: Types.ObjectId): Promise<Types.ObjectId[]> => {
  const projects = await Project.find({ createdBy: userId }).select('_id');
  return projects.map(p => p._id as Types.ObjectId);
};
// Create a new transaction
export const createTransaction = async (
  req: ITransactionRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: "Unauthorized: User not authenticated" 
      });
      return;
    }

    const { project, party, type, amount, date, note, fileUrl, fileName } = req.body;

    if (!project || !party || !type || !amount) {
      res.status(400).json({ 
        success: false, 
        message: "Project, Party, Type, and Amount are required fields" 
      });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({ 
        success: false, 
        message: "Amount must be greater than 0" 
      });
      return;
    }

    if (!['income', 'expense'].includes(type)) {
      res.status(400).json({ 
        success: false, 
        message: "Type must be either 'income' or 'expense'" 
      });
      return;
    }

    // Check if project exists and belongs to user
    const projectExists = await Project.findOne({ 
      _id: project, 
      createdBy: userId 
    });
    
    if (!projectExists) {
      res.status(404).json({ 
        success: false, 
        message: "Project not found" 
      });
      return;
    }

    // Check if party exists and belongs to the same project
    const partyExists = await Party.findOne({ 
      _id: party, 
      project: project 
    });
    
    if (!partyExists) {
      res.status(404).json({ 
        success: false, 
        message: "Party not found or not associated with this project" 
      });
      return;
    }

    // IMPORTANT: Validate party type with transaction type
    if (partyExists.partyType === 'CLIENT' && type !== 'income') {
      res.status(400).json({ 
        success: false, 
        message: "CLIENT party can only have INCOME transactions" 
      });
      return;
    }

    if (partyExists.partyType === 'VENDOR' && type !== 'expense') {
      res.status(400).json({ 
        success: false, 
        message: "VENDOR party can only have EXPENSE transactions" 
      });
      return;
    }

    let transactionDate = new Date();
    if (date) {
      transactionDate = new Date(date);
      if (isNaN(transactionDate.getTime())) {
        res.status(400).json({ 
          success: false, 
          message: "Invalid date format" 
        });
        return;
      }
    }

    // Calculate net profit based on transaction type
    let updatedTotalIncome = projectExists.totalIncome || 0;
    let updatedTotalExpense = projectExists.totalExpense || 0;
    
    if (type === 'income') {
      updatedTotalIncome += amount;
    } else if (type === 'expense') {
      updatedTotalExpense += amount;
    }
    

    // Update project totals
    await Project.findByIdAndUpdate(project, {
      totalIncome: updatedTotalIncome,
      totalExpense: updatedTotalExpense,
      balance: updatedTotalIncome - updatedTotalExpense
    });

    // Create transaction
    const transaction = await Transaction.create({
      project: new Types.ObjectId(project),
      party: new Types.ObjectId(party),
      type,
      amount,
      date: transactionDate,
      note,
      fileUrl,
      fileName,
      createdBy: userId
    });

    // Populate references for response
    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate('project', 'title code')
      .populate('party', 'name partyType')
      .populate('createdBy', 'name email');

      console.log(populatedTransaction, "populatedTransaction");

    res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: populatedTransaction
    });

  } catch (error: any) {
    console.error("Create transaction error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err: any) => err.message).join(", ");
      res.status(400).json({ 
        success: false, 
        message: errors 
      });
      return;
    }

    if (error.code === 11000) {
      res.status(400).json({ 
        success: false, 
        message: "Duplicate transaction detected" 
      });
      return;
    }

    next(error);
  }
};

// Get all transactions with filtering and pagination
export const getAllTransactions = async (
  req: ITransactionRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
      return;
    }

    const {
      page = "1",
      limit = "20",
      startDate,
      endDate,
      type,
      project,
      party,
      search,
      sortBy = "date",
      sortOrder = "desc"
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter query - only show transactions from user's projects
    const userProjectIds = await getProjectsByUser(userId);
    const filter: any = { 
      isDeleted: false,
      project: { $in: userProjectIds }
    };
    
    // Filter by specific project if provided
    if (project) {
      // Verify project belongs to user
      const userProject = await Project.findOne({ 
        _id: project, 
        createdBy: userId 
      });
      if (!userProject) {
        res.status(403).json({ 
          success: false, 
          message: "Access denied to this project" 
        });
        return;
      }
      filter.project = new Types.ObjectId(project);
    }

    // Filter by party if provided
    if (party) {
      filter.party = new Types.ObjectId(party);
    }

    // Filter by type if provided
    if (type) {
      filter.type = type;
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.date.$lte = new Date(endDate);
      }
    }

    // Search in note if search query provided
    if (search) {
      filter.$or = [
        { note: { $regex: search, $options: "i" } },
        { 'party.name': { $regex: search, $options: "i" } }
      ];
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const transactions = await Transaction.find(filter)
      .populate({
        path: 'project',
        select: 'title code'
      })
      .populate({
        path: 'party',
        select: 'name partyType'
      })
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Transaction.countDocuments(filter);

    // Calculate summary stats
    const summary = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format summary
    const incomeTotal = summary.find(s => s._id === 'income')?.totalAmount || 0;
    const expenseTotal = summary.find(s => s._id === 'expense')?.totalAmount || 0;
    const netAmount = incomeTotal - expenseTotal;

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      summary: {
        totalIncome: incomeTotal,
        totalExpense: expenseTotal,
        netAmount,
        totalTransactions: total
      }
    });

  } catch (error: any) {
    next(error);
  }
};

// Get transaction by ID
export const getTransactionById = async (
  req: ITransactionRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
      return;
    }

    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid transaction ID" 
      });
      return;
    }

    // Check if transaction belongs to user's project
    const transaction = await Transaction.findOne({
      _id: id,
      isDeleted: false,
      project: { $in: await getProjectsByUser(userId) }
    })
      .populate('project', 'title code')
      .populate('party', 'name partyType email phone address')
      .populate('createdBy', 'name email');

    if (!transaction) {
      res.status(404).json({ 
        success: false, 
        message: "Transaction not found" 
      });
      return;
    }

    res.json({
      success: true,
      data: transaction
    });

  } catch (error: any) {
    next(error);
  }
};

// Get transactions by project
export const getTransactionsByProject = async (
  req: ITransactionRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
      return;
    }

    const { projectId } = req.params;
    const {
      page = "1",
      limit = "20",
      type,
      startDate,
      endDate
    } = req.query;

    if (!Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid project ID" 
      });
      return;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Check if project exists and belongs to user
    const projectExists = await Project.findOne({ 
      _id: projectId, 
      createdBy: userId 
    });
    
    if (!projectExists) {
      res.status(404).json({ 
        success: false, 
        message: "Project not found" 
      });
      return;
    }

    // Build filter query
    const filter: any = { 
      project: new Types.ObjectId(projectId),
      isDeleted: false 
    };

    if (type) {
      filter.type = type;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.date.$lte = new Date(endDate);
      }
    }

    // Get transactions
  const transactions = await Transaction.find(filter)
.populate(
  'party',
  'name partyType profileImage description contact.email contact.phone contact.address'
)
  .populate('createdBy', 'name email')
  .sort({ date: -1 })
  .skip(Number(skip))
  .limit(Number(limitNum))
  .lean(); // optional but recommended

console.log('Fetched Transactions:', transactions);


    // Get total count
    const total = await Transaction.countDocuments(filter);

    // Calculate summary for this project
    const summary = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    const incomeTotal = summary.find(s => s._id === 'income')?.totalAmount || 0;
    const expenseTotal = summary.find(s => s._id === 'expense')?.totalAmount || 0;
    const netAmount = incomeTotal - expenseTotal;

    res.json({
      success: true,
      data: transactions,
      project: {
        id: projectExists._id,
        title: projectExists.title,
        code: projectExists.code,
        budget: projectExists.initialBudget,
        totalExpense: projectExists.totalExpense,
        totalIncome: projectExists.totalIncome,
        balance: projectExists.balance
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      summary: {
        totalIncome: incomeTotal,
        totalExpense: expenseTotal,
        netAmount,
        totalTransactions: total
      }
    });

  } catch (error: any) {
    next(error);
  }
};

// Update transaction
export const updateTransaction = async (
  req: ITransactionRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
      return;
    }

    const { id } = req.params;
    const updates = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid transaction ID" 
      });
      return;
    }

    // Find existing transaction and check ownership
    const existingTransaction = await Transaction.findOne({
      _id: id,
      isDeleted: false,
      project: { $in: await getProjectsByUser(userId) }
    });

    if (!existingTransaction) {
      res.status(404).json({ 
        success: false, 
        message: "Transaction not found" 
      });
      return;
    }

    // If type is being updated, validate with party type
    if (updates.type !== undefined) {
      const party = await Party.findById(existingTransaction.party);
      
      if (party) {
        if (party.partyType === 'CLIENT' && updates.type !== 'income') {
          res.status(400).json({ 
            success: false, 
            message: "CLIENT party can only have INCOME transactions" 
          });
          return;
        }

        if (party.partyType === 'VENDOR' && updates.type !== 'expense') {
          res.status(400).json({ 
            success: false, 
            message: "VENDOR party can only have EXPENSE transactions" 
          });
          return;
        }
      }
    }

    // If amount is being updated, update project totals
    if (updates.amount !== undefined || updates.type !== undefined) {
      const project = await Project.findById(existingTransaction.project);
      
      if (project) {
        let updatedTotalIncome = project.totalIncome || 0;
        let updatedTotalExpense = project.totalExpense || 0;
        
        // Remove old transaction amount
        if (existingTransaction.type === 'income') {
          updatedTotalIncome -= existingTransaction.amount;
        } else if (existingTransaction.type === 'expense') {
          updatedTotalExpense -= existingTransaction.amount;
        }
        
        // Add new transaction amount
        const newType = updates.type !== undefined ? updates.type : existingTransaction.type;
        const newAmount = updates.amount !== undefined ? updates.amount : existingTransaction.amount;
        
        if (newType === 'income') {
          updatedTotalIncome += newAmount;
        } else if (newType === 'expense') {
          updatedTotalExpense += newAmount;
        }
        
        const updatedNetProfit = updatedTotalIncome - updatedTotalExpense;

        // Update project
        await Project.findByIdAndUpdate(project._id, {
          totalIncome: updatedTotalIncome,
          totalExpense: updatedTotalExpense,
          netProfit: updatedNetProfit
        });
      }
    }

    // Update transaction
    Object.assign(existingTransaction, updates);
    await existingTransaction.save();

    // Get updated transaction with populated fields
    const updatedTransaction = await Transaction.findById(id)
      .populate('project', 'title code')
      .populate('party', 'name partyType')
      .populate('createdBy', 'name email');

    res.json({
      success: true,
      message: "Transaction updated successfully",
      data: updatedTransaction
    });

  } catch (error: any) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err: any) => err.message).join(", ");
      res.status(400).json({ 
        success: false, 
        message: errors 
      });
      return;
    }
    next(error);
  }
};

// Soft delete transaction
export const deleteTransaction = async (
  req: ITransactionRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: "Unauthorized" 
      });
      return;
    }

    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid transaction ID" 
      });
      return;
    }

    // Find transaction and check ownership
    const transaction = await Transaction.findOne({
      _id: id,
      isDeleted: false,
      project: { $in: await getProjectsByUser(userId) }
    });

    if (!transaction) {
      res.status(404).json({ 
        success: false, 
        message: "Transaction not found" 
      });
      return;
    }

    // Update project totals (subtract this transaction)
    const project = await Project.findById(transaction.project);
    if (project) {
      let updatedTotalIncome = project.totalIncome || 0;
      let updatedTotalExpense = project.totalExpense || 0;
      
      if (transaction.type === 'income') {
        updatedTotalIncome -= transaction.amount;
      } else if (transaction.type === 'expense') {
        updatedTotalExpense -= transaction.amount;
      }
      
      const updatedNetProfit = updatedTotalIncome - updatedTotalExpense;

      await Project.findByIdAndUpdate(project._id, {
        totalIncome: updatedTotalIncome,
        totalExpense: updatedTotalExpense,
        netProfit: updatedNetProfit
      });
    }

    // Soft delete
    transaction.isDeleted = true;
    await transaction.save();

    res.json({
      success: true,
      message: "Transaction deleted successfully"
    });

  } catch (error: any) {
    next(error);
  }
};

// Get transaction statistics
// export const getTransactionStats = async (
//   req: ITransactionRequest,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const userId = req.user?.id;
//     if (!userId) {
//       res.status(401).json({ 
//         success: false, 
//         message: "Unauthorized" 
//       });
//       return;
//     }

//     const { projectId, startDate, endDate } = req.query;

//     // Build filter - only user's projects
//     const userProjectIds = await getProjectsByUser(userId);
//     const filter: any = { 
//       isDeleted: false,
//       project: { $in: userProjectIds }
//     };
    
//     if (projectId && Types.ObjectId.isValid(projectId as string)) {
//       // Verify project belongs to user
//       const userProject = await Project.findOne({ 
//         _id: projectId, 
//         createdBy: userId 
//       });
//       if (!userProject) {
//         res.status(403).json({ 
//           success: false, 
//           message: "Access denied to this project" 
//         });
//         return;
//       }
//       filter.project = new Types.ObjectId(projectId as string);
//     }

//     if (startDate || endDate) {
//       filter.date = {};
//       if (startDate) {
//         filter.date.$gte = new Date(startDate as string);
//       }
//       if (endDate) {
//         filter.date.$lte = new Date(endDate as string);
//       }
//     }

//     // Get total statistics
//     const stats = await Transaction.aggregate([
//       { $match: filter },
//       {
//         $group: {
//           _id: "$type",
//           totalAmount: { $sum: "$amount" },
//           count: { $sum: 1 },
//           avgAmount: { $avg: "$amount" }
//         }
//       }
//     ]);

//     // Get monthly breakdown
//     const monthlyBreakdown = await Transaction.aggregate([
//       { $match: filter },
//       {
//         $group: {
//           _id: {
//             year: { $year: "$date" },
//             month: { $month: "$date" },
//             type: "$type"
//           },
//           totalAmount: { $sum: "$amount" },
//           count: { $sum: 1 }
//         }
//       },
//       { $sort: { "_id.year": -1, "_id.month": -1 } },
//       { $limit: 12 }
//     ]);

//     // Get top parties (clients for income, vendors for expense)
//     const topParties = await Transaction.aggregate([
//       { $match: filter },
//       {
//         $group: {
//           _id: "$party",
//           totalAmount: { $sum: "$amount" },
//           count: { $sum: 1 }
//         }
//       },
//       { $sort: { totalAmount: -1 } },
//       { $limit: 5 },
//       {
//         $lookup: {
//           from: "parties",
//           localField: "_id",
//           foreignField: "_id",
//           as: "party"
//         }
//       },
//       { $unwind: "$party" },
//       {
//         $project: {
//           partyId: "$_id",
//           partyName: "$party.name",
//           partyType: "$party.partyType",
//           totalAmount: 1,
//           count: 1
//         }
//       }
//     ]);

//     // Format response
//     const incomeStats = stats.find(s => s._id === 'income') || { totalAmount: 0, count: 0, avgAmount: 0 };
//     const expenseStats = stats.find(s => s._id === 'expense') || { totalAmount: 0, count: 0, avgAmount: 0 };
//     const netAmount = incomeStats.totalAmount - expenseStats.totalAmount;

//     res.json({
//       success: true,
//       data: {
//         summary: {
//           totalIncome: incomeStats.totalAmount,
//           totalExpense: expenseStats.totalAmount,
//           netAmount,
//           totalTransactions: incomeStats.count + expenseStats.count
//         },
//         averages: {
//           avgIncome: incomeStats.avgAmount,
//           avgExpense: expenseStats.avgAmount
//         },
//         monthlyBreakdown,
//         topParties
//       }
//     });

//   } catch (error: any) {
//     next(error);
//   }
// };