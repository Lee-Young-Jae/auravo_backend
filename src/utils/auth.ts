import { prisma } from "../config/db";

import { signAccessToken, signRefreshToken } from "./jwt";
import { parseTTL } from "./parseTTL";
import { Response } from "express";
import { env } from "../config/env";

const isProd = process.env.NODE_ENV === "production";

export const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd, // 운영 필수(HTTPS)
  sameSite: "lax" as const, // auravo.site <-> api.auravo.site는 same-site
  path: "/", // refresh/logout 등 최소 범위
  maxAge: 1000 * 60 * 60 * 24 * 14, // 14d
};

export async function createUserSession(
  userId: number,
  res: Response
): Promise<{ accessToken: string; refreshToken: string }> {
  // 1) 기존 토큰 전부 삭제
  await prisma.refreshToken.deleteMany({ where: { userId } });

  // 2) 사용자 정보 조회 (JWT 페이로드에 필요한 정보)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    throw new Error("사용자를 찾을 수 없습니다");
  }

  // 3) 완전한 JWT 페이로드 생성
  const payload = {
    sub: user.id,
    id: user.id, // 편의를 위해 id 필드도 추가
    email: user.email,
    role: user.role,
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // 4) DB에 리프레시 토큰 저장
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt: new Date(Date.now() + parseTTL(env.REFRESH_TOKEN_TTL)),
    },
  });

  // 5) Refresh Token만 HTTP-Only 쿠키로 설정 (Access Token은 JSON으로만 반환)
  res.cookie("refresh_token", refreshToken, refreshCookieOptions);

  return { accessToken, refreshToken };
}

export async function clearRefreshTokens(userId: number) {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}
