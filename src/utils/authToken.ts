import jwt, { JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";

interface TokenPayload extends JwtPayload {
  id: Types.ObjectId | string;
  role: string;
}

export const generateToken = (payload: { id: Types.ObjectId | string, role: string }): string => {
  const secretKey = process.env.JWT_SECRET || "default_secret_key_please_change_me_in_production"; 
  
  return jwt.sign(
    payload,     
    secretKey,     
    { expiresIn: "7d" }
  );
};

export const verifyToken = (token: string): Promise<TokenPayload> => {
  return new Promise((resolve, reject) => {
    const secretKey = process.env.JWT_SECRET || "default_secret_key_please_change_me_in_production";
    
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as TokenPayload);
      }
    });
  });
};