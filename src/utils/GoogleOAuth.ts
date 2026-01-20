import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client("914626190076-hb3496enlino79uhhi9okc3liovs4qc2.apps.googleusercontent.com");

export async function verifyGoogleToken(idToken: string) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: "914626190076-hb3496enlino79uhhi9okc3liovs4qc2.apps.googleusercontent.com", // frontend se jo client ID hai wahi
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.sub) {
    throw new Error("Invalid Google token payload");
  }
  console.log(payload)
  return {
    email: payload.email,
    name: payload.name,
    googleId: payload.sub,
    picture: payload.picture,
  };
}
