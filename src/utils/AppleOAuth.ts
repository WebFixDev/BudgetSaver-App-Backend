import appleSigninAuth from "apple-signin-auth";

export async function verifyAppleToken(idToken: string) {
  try {
    const audience = process.env.APPLE_CLIENT_ID || "com.webfix.budgetsaver.ios";
    
    console.log(`Verifying Apple Token for audience: ${audience}`);
    const payload = await appleSigninAuth.verifyIdToken(idToken, {
      audience: audience,
      ignoreExpiration: false,
    });

    if (!payload || !payload.sub) {
      throw new Error("Invalid Apple token payload");
    }

    return {
      email: payload.email,
      appleId: payload.sub,
    };
  } catch (error: any) {
    console.error("Apple verification error details:", error);
    throw new Error(`Apple token verification failed: ${error.message}`);
  }
}
