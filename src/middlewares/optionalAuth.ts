import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";

// 선택적 인증 미들웨어 (토큰이 있으면 인증, 없으면 비회원으로 처리)
export const optionalAuthenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Authorization 헤더에서 토큰 확인
    let token: string | undefined;
    const header = req.headers.authorization;

    if (header?.startsWith("Bearer ")) {
      token = header.split(" ")[1];
    }
    // 2. Authorization 헤더가 없으면 쿠키에서 확인
    else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      try {
        // 토큰이 있으면 인증 처리
        const decoded = verifyToken<JwtPayload>(token);
        
        // JWT 메타데이터 제거하고 필요한 필드만 추출
        req.user = {
          sub: decoded.sub,
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
        };
      } catch (error) {
        // 토큰이 유효하지 않으면 비회원으로 처리 (에러 발생시키지 않음)
        req.user = undefined;
      }
    } else {
      // 토큰이 없으면 비회원으로 처리
      req.user = undefined;
    }

    next();
  } catch (error) {
    // 예외 발생시에도 비회원으로 처리
    req.user = undefined;
    next();
  }
};
