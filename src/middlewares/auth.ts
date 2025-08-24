import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Authorization 헤더에서 토큰 확인 (쿠키는 사용하지 않음)
  let token: string | undefined;
  const header = req.headers.authorization;

  if (header?.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Missing access token" });
  }

  try {
    const decoded = verifyToken<JwtPayload>(token);
    
    // JWT 메타데이터 제거하고 필요한 필드만 추출
    req.user = {
      sub: decoded.sub,
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired access token" });
  }
};
