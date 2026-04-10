// import crypto from 'crypto';
import jwt from "jsonwebtoken";

// export const signLocalAccessToken = (data: { id: string; email: string }) => {
//   try {
//     if (!process.env.JWT_SECRET_KEY) {
//       throw new Error('JWT secret key is not defined.');
//     }

//     const token = jwt.sign({ ...data, isCustomToken: true }, process.env.JWT_SECRET_KEY, {
//       expiresIn: process.env.JWT_EXPIRES_IN || '1h'
//     });

//     return token;
//   } catch (error) {
//     console.error('Error signing token:', error);
//     throw error;
//   }
// };

// export const signLocalRefreshToken = (data: { id: string; email: string }) => {
//   try {
//     if (!process.env.JWT_REFRESH_KEY) {
//       throw new Error('JWT refresh secret key is not defined.');
//     }

//     const token = jwt.sign({ ...data, isCustomToken: true }, process.env.JWT_REFRESH_KEY, {
//       expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
//     });

//     return token;
//   } catch (error) {
//     console.error('Error signing token:', error);
//     throw error;
//   }
// };

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

export const verifyLocalRefreshToken = (token: string) => {
  try {
    if (!process.env.JWT_REFRESH_KEY) {
      throw new Error("JWT refresh secret key is not defined.");
    }

    const decodedToken = jwt.verify(
      token,
      process.env.JWT_REFRESH_KEY,
    ) as jwt.JwtPayload;
    return decodedToken;
  } catch (error) {
    console.error("Error Verifying Refresh Token.");
    throw error;
  }
};
