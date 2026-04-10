import jwt from "jsonwebtoken";

export const verifyLocalAccessToken = (token: string) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT secret key is not defined.");
    }

    const decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET,
    ) as jwt.JwtPayload;
    return decodedToken;
  } catch (error) {
    console.error("Error Verifying Token.");
    throw error;
  }
};


