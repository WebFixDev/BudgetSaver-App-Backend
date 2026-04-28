// src/controllers/appVersion.controller.ts
import { Request, Response } from 'express';
import AppConfig from '../models/app.Config';

export const checkAppVersion = async (req: Request, res: Response) => {
  try {
    // Database se configuration fetch karein (sirf ek hi document hoga)
    const versionConfig = await AppConfig.findOne();

    // Agar database empty ho (first time run par), toh default values bhej dein
    if (!versionConfig) {
      return res.status(200).json({ 
        success: true, 
        data: {
          requiredVersionCode: 1, 
          forceUpdate: false,      
          playStoreUrl: "market://details?id=com.budgetsaver", 
        } 
      });
    }

    // Agar data mil jaye toh use return karein
    res.status(200).json({ 
      success: true, 
      data: versionConfig 
    });

  } catch (error) {
    console.error("Error fetching app version:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server Error" 
    });
  }
};