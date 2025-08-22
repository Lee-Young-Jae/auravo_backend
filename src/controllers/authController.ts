import { prisma } from "../config/db";
import bcrypt from "bcrypt";
import { Request, Response, NextFunction } from "express";
import {
  JwtPayload,
  signAccessToken,
  signRefreshToken,
  verifyToken,
} from "../utils/jwt";
import { env } from "../config/env";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { clearRefreshTokens } from "../utils/auth";
import { createUserSession } from "../utils/auth";
import { parseTTL } from "../utils/parseTTL";
import { getDefaultUserData } from "../utils/userDefaults";
import { toPrismaJson } from "../utils/jsonHelpers";

dayjs.extend(duration);

const REFRESH_COOKIE = "refreshToken";

const cookieOpts = (maxAge: number) => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict" as const,
    maxAge,
  };
};

const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  // const accessMaxAge = parseTTL(env.ACCESS_TOKEN_TTL);
  const refreshMaxAge = parseTTL(env.REFRESH_TOKEN_TTL);
  // res.cookie(ACCESS_COOKIE, accessToken, cookieOpts(accessMaxAge));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts(refreshMaxAge));
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, name } = req.body;
    const hashed = await bcrypt.hash(password, 12);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "이미 사용 중인 이메일입니다" });
    }

    const existingName = await prisma.user.findFirst({ where: { name } });
    if (existingName) {
      return res.status(400).json({ message: "이미 사용 중인 이름입니다" });
    }

    const defaultData = getDefaultUserData();
    await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        preferences: toPrismaJson(defaultData.preferences),
        achievements: toPrismaJson(defaultData.achievements),
        socialLinks: toPrismaJson(defaultData.socialLinks),
      },
    });

    res.status(201).json({ message: "User registered" });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res
        .status(400)
        .json({ message: "사용자 정보를 다시 확인해주세요" });
    }

    // 공통 헬퍼로 세션 생성 & 토큰 발급
    const { accessToken, refreshToken } = await createUserSession(user.id, res);

    // 비밀번호 제거한 사용자 정보 반환
    const { password: _, ...safeUser } = user;
    res.json({ accessToken, user: safeUser });
  } catch (err) {
    next(err);
  }
};

// [5] Kakao OAuth Redirect
export const kakaoRedirect = (_req: Request, res: Response) => {
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("client_id", env.KAKAO_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.KAKAO_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  res.redirect(url.toString());
};

// [6] Kakao OAuth Callback
export const kakaoCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const code = String(req.query.code);

    // 1) 카카오 토큰 교환
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.KAKAO_CLIENT_ID,
        client_secret: env.KAKAO_CLIENT_SECRET,
        redirect_uri: env.KAKAO_REDIRECT_URI,
        code,
      }),
    });
    const { access_token: kakaoToken } = await tokenRes.json();

    // 2) 프로필 조회
    const profileRes = await fetch(
      `https://kapi.kakao.com/v2/user/me?property_keys=["kakao_account.profile","kakao_account.name"]`,
      {
        headers: { Authorization: `Bearer ${kakaoToken}` },
      }
    );
    const profile = await profileRes.json();

    const email = `${profile.id}@kakao`;

    const kakaoProfile = profile.kakao_account?.profile;
    const name = kakaoProfile?.nickname || `kakao-${profile.id}`;
    const nickname = kakaoProfile?.nickname
      ? `${kakaoProfile.nickname}-${profile.id}`
      : name;

    const profileImage = kakaoProfile?.profile_image_url;

    // 3) 사용자 upsert
    const uniqueKey = email ?? `kakao_${profile.id}`;
    const user = await prisma.user.upsert({
      where: { email: uniqueKey }, // email 대신 uniqueKey
      update: {},
      create: {
        email: uniqueKey, // email 대신 uniqueKey
        password: "", // 소셜로그인 비밀번호 불필요
        name: nickname,
        profileImageUrl: profileImage ?? "",
      },
    });

    // 4) 우리 JWT 발급 & 쿠키 세팅
    await createUserSession(user.id, res);

    // 5) 프론트로 리다이렉트
    res.redirect(env.FRONTEND_REDIRECT);
  } catch (err) {
    next(err);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];

    if (!refreshToken)
      return res.status(401).json({ message: "No refresh token" });

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });
    console.log({ stored });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ message: "Refresh token expired" });
    }

    const payload = verifyToken<JwtPayload>(refreshToken);
    console.log({ payload });

    const cleanPayload: JwtPayload = {
      sub: payload.sub,
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };

    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    const newRefresh = signRefreshToken(cleanPayload);
    await prisma.refreshToken.create({
      data: {
        token: newRefresh,
        userId: payload.sub,
        expiresAt: new Date(Date.now() + parseTTL(env.REFRESH_TOKEN_TTL)),
      },
    });
    const newAccess = signAccessToken(cleanPayload);
    setAuthCookies(res, newAccess, newRefresh);

    res.json({ accessToken: newAccess });
  } catch (err) {
    next(err);
  }
};

export const me = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user?.id },
  });

  res.json({
    user: {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      role: user?.role,
      profileImageUrl: user?.profileImageUrl,
    },
  });
};

export const upsertSocialUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, name, providerId } = req.body; // NextAuth 프로바이더 콜백에서 전달
    // providerId: 카카오 프로필 내 profile.id
    const uniqueKey = email ?? `${providerId}@kakao`;
    // DB upsert
    const user = await prisma.user.upsert({
      where: { email: uniqueKey },
      update: {},
      create: { email: uniqueKey, name, password: "" },
    });

    await clearRefreshTokens(user.id);

    // JWT 발급
    const { accessToken, refreshToken } = await createUserSession(user.id, res);

    res.json({
      user,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

// 이메일 중복체크
export const checkEmailDuplicate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        message: "이메일을 입력해주세요",
        isDuplicate: false,
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    res.json({
      isDuplicate: !!existingUser,
      message: existingUser
        ? "이미 사용 중인 이메일입니다"
        : "사용 가능한 이메일입니다",
    });
  } catch (err) {
    next(err);
  }
};

// 이름 중복체크
export const checkNameDuplicate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name } = req.query;

    if (!name || typeof name !== "string") {
      return res.status(400).json({
        message: "이름을 입력해주세요",
        isDuplicate: false,
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: { name: name.trim() },
    });

    res.json({
      isDuplicate: !!existingUser,
      message: existingUser
        ? "이미 사용 중인 이름입니다"
        : "사용 가능한 이름입니다",
    });
  } catch (err) {
    next(err);
  }
};
