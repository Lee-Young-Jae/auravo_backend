import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

export const signAccessToken = (payload: JwtPayload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as any,
  });
};

export const signRefreshToken = (payload: JwtPayload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL as any,
  });
};

export const verifyToken = <T = any>(token: string) =>
  jwt.verify(token, env.JWT_SECRET as jwt.Secret) as T;
