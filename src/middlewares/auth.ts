import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 1. Authorization 헤더에서 토큰 확인
  let token: string | undefined;
  const header = req.headers.authorization;

  if (header?.startsWith("Bearer ")) {
    token = header.split(" ")[1];
    console.log("Authorization 헤더에서 토큰 발견");
  }
  // 2. Authorization 헤더가 없으면 쿠키에서 확인
  else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
    console.log("쿠키에서 토큰 발견");
  }

  if (!token) {
    console.log("인증 실패: 토큰이 Authorization 헤더나 쿠키에 없음");
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    console.log("토큰 검증 시도:", token.substring(0, 20) + "...");
    req.user = verifyToken(token);
    console.log("토큰 검증 성공:", req.user);
    next();
  } catch (error) {
    console.log("토큰 검증 실패:", error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
