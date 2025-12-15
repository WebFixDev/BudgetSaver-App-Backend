import crypto from "crypto";

export function createOTP(length = 6): string {
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += crypto.randomInt(0, 10).toString(); // 0-9
  }
  return otp;
}

export function hashOTP(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export function verifyOTP(inputOTP: string, hashedOTP: string): boolean {
  const inputHashed = crypto.createHash("sha256").update(inputOTP).digest("hex");
  console.log(inputHashed, hashedOTP, "hashed values")
  return inputHashed === hashedOTP;
}
