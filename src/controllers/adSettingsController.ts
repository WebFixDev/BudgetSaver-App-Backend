// src/controllers/adSettings.controller.ts
import { Request, Response, NextFunction } from "express";
import AdSettings from "../models/ad.settings";


export const getAdSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let settings = await AdSettings.findOne();
    
    if (!settings) {
      settings = await AdSettings.create({});
    }

    res.status(200).json({
      success: true,
      data: {
        globalAdsEnabled: settings.globalAdsEnabled,
        thresholds: settings.thresholds
      }
    });
  } catch (error) {   
    next(error);
  }
};