import dotenv from 'dotenv';

dotenv.config();

interface Config {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  MONGO_URI: string;
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  JWT_EXPIRES_IN: string;
  REFRESH_EXPIRES_IN: string;
  CLIENT_URL: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string | number;
  CLOUDINARY_API_SECRET: string;
}

const config: Config = {
  PORT: parseInt(process.env.PORT || '3000'),
  NODE_ENV: (process.env.NODE_ENV as Config['NODE_ENV']) || 'development',
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/agenttracker',
// for cloudinary

CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'dbfc6vcze',
CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || 973497672396387,
CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || 'XY4jbQccUxzA4CFQDr5KxwMuTQs',

  // New token configs
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'default-access-secret',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'default-refresh-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_EXPIRES_IN: process.env.REFRESH_EXPIRES_IN || '7d',

  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000'



};

export { config };
