import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";

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
  }

  if (!token) {
    console.log("인증 실패: 토큰이 Authorization 헤더에 없음");
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    console.log("토큰 검증 시도:", token.substring(0, 20) + "...");
    const decoded = verifyToken<JwtPayload>(token);
    
    // JWT 메타데이터 제거하고 필요한 필드만 추출
    req.user = {
      sub: decoded.sub,
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    
    console.log("토큰 검증 성공:", req.user);
    next();
  } catch (error) {
    console.log("토큰 검증 실패:", error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
