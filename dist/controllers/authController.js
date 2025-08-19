"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkNameDuplicate = exports.checkEmailDuplicate = exports.upsertSocialUser = exports.me = exports.refresh = exports.kakaoCallback = exports.kakaoRedirect = exports.login = exports.register = void 0;
const db_1 = require("../config/db");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jwt_1 = require("../utils/jwt");
const env_1 = require("../config/env");
const dayjs_1 = __importDefault(require("dayjs"));
const duration_1 = __importDefault(require("dayjs/plugin/duration"));
const auth_1 = require("../utils/auth");
const auth_2 = require("../utils/auth");
const parseTTL_1 = require("../utils/parseTTL");
const userDefaults_1 = require("../utils/userDefaults");
const jsonHelpers_1 = require("../utils/jsonHelpers");
dayjs_1.default.extend(duration_1.default);
const REFRESH_COOKIE = "refreshToken";
const ACCESS_COOKIE = "accessToken";
const cookieOpts = (maxAge) => {
    const isProd = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: "strict",
        maxAge,
    };
};
const setAuthCookies = (res, accessToken, refreshToken) => {
    const accessMaxAge = (0, parseTTL_1.parseTTL)(env_1.env.ACCESS_TOKEN_TTL);
    const refreshMaxAge = (0, parseTTL_1.parseTTL)(env_1.env.REFRESH_TOKEN_TTL);
    res.cookie(ACCESS_COOKIE, accessToken, cookieOpts(accessMaxAge));
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts(refreshMaxAge));
};
const register = async (req, res, next) => {
    try {
        const { email, password, name } = req.body;
        const hashed = await bcrypt_1.default.hash(password, 12);
        const existingUser = await db_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "이미 사용 중인 이메일입니다" });
        }
        const existingName = await db_1.prisma.user.findFirst({ where: { name } });
        if (existingName) {
            return res.status(400).json({ message: "이미 사용 중인 이름입니다" });
        }
        const defaultData = (0, userDefaults_1.getDefaultUserData)();
        await db_1.prisma.user.create({
            data: {
                email,
                password: hashed,
                name,
                preferences: (0, jsonHelpers_1.toPrismaJson)(defaultData.preferences),
                achievements: (0, jsonHelpers_1.toPrismaJson)(defaultData.achievements),
                socialLinks: (0, jsonHelpers_1.toPrismaJson)(defaultData.socialLinks),
            },
        });
        res.status(201).json({ message: "User registered" });
    }
    catch (err) {
        next(err);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await db_1.prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt_1.default.compare(password, user.password))) {
            return res
                .status(400)
                .json({ message: "사용자 정보를 다시 확인해주세요" });
        }
        // 공통 헬퍼로 세션 생성 & 토큰 발급
        const { accessToken } = await (0, auth_2.createUserSession)(user.id, res);
        // 비밀번호 제거한 사용자 정보 반환
        const { password: _, ...safeUser } = user;
        res.json({ accessToken, user: safeUser });
    }
    catch (err) {
        next(err);
    }
};
exports.login = login;
// [5] Kakao OAuth Redirect
const kakaoRedirect = (_req, res) => {
    const url = new URL("https://kauth.kakao.com/oauth/authorize");
    url.searchParams.set("client_id", env_1.env.KAKAO_CLIENT_ID);
    url.searchParams.set("redirect_uri", env_1.env.KAKAO_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    res.redirect(url.toString());
};
exports.kakaoRedirect = kakaoRedirect;
// [6] Kakao OAuth Callback
const kakaoCallback = async (req, res, next) => {
    try {
        const code = String(req.query.code);
        // 1) 카카오 토큰 교환
        const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: env_1.env.KAKAO_CLIENT_ID,
                client_secret: env_1.env.KAKAO_CLIENT_SECRET,
                redirect_uri: env_1.env.KAKAO_REDIRECT_URI,
                code,
            }),
        });
        const { access_token: kakaoToken } = await tokenRes.json();
        // 2) 프로필 조회
        const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
            headers: { Authorization: `Bearer ${kakaoToken}` },
        });
        const profile = await profileRes.json();
        const email = profile.kakao_account?.email;
        const name = profile.properties?.nickname || `kakao-${profile.id}`;
        // 3) 사용자 upsert
        const uniqueKey = email ?? `kakao_${profile.id}`;
        const user = await db_1.prisma.user.upsert({
            where: { email: uniqueKey }, // email 대신 uniqueKey
            update: {},
            create: {
                email: uniqueKey, // email 대신 uniqueKey
                password: "", // 소셜로그인 비밀번호 불필요
                name,
            },
        });
        // 4) 우리 JWT 발급 & 쿠키 세팅
        await (0, auth_2.createUserSession)(user.id, res);
        // 5) 프론트로 리다이렉트
        res.redirect(env_1.env.FRONTEND_REDIRECT);
    }
    catch (err) {
        next(err);
    }
};
exports.kakaoCallback = kakaoCallback;
const refresh = async (req, res, next) => {
    try {
        const refreshToken = req.cookies[REFRESH_COOKIE];
        if (!refreshToken)
            return res.status(401).json({ message: "No refresh token" });
        const stored = await db_1.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });
        if (!stored || stored.expiresAt < new Date()) {
            return res.status(401).json({ message: "Refresh token expired" });
        }
        const payload = (0, jwt_1.verifyToken)(refreshToken);
        await db_1.prisma.refreshToken.delete({ where: { token: refreshToken } });
        const newRefresh = (0, jwt_1.signRefreshToken)(payload);
        await db_1.prisma.refreshToken.create({
            data: {
                token: newRefresh,
                userId: payload.sub,
                expiresAt: new Date(Date.now() + (0, parseTTL_1.parseTTL)(env_1.env.REFRESH_TOKEN_TTL)),
            },
        });
        const newAccess = (0, jwt_1.signAccessToken)(payload);
        setAuthCookies(res, newAccess, newRefresh);
        res.json({ accessToken: newAccess });
    }
    catch (err) {
        next(err);
    }
};
exports.refresh = refresh;
const me = (req, res) => {
    res.json({ user: req.user });
};
exports.me = me;
const upsertSocialUser = async (req, res, next) => {
    try {
        const { email, name, providerId } = req.body; // NextAuth 프로바이더 콜백에서 전달
        // providerId: 카카오 프로필 내 profile.id
        const uniqueKey = email ?? `${providerId}@kakao`;
        // DB upsert
        const user = await db_1.prisma.user.upsert({
            where: { email: uniqueKey },
            update: {},
            create: { email: uniqueKey, name, password: "" },
        });
        await (0, auth_1.clearRefreshTokens)(user.id);
        // JWT 발급
        const { accessToken } = await (0, auth_2.createUserSession)(user.id, res);
        res.json({
            user,
            accessToken,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.upsertSocialUser = upsertSocialUser;
// 이메일 중복체크
const checkEmailDuplicate = async (req, res, next) => {
    try {
        const { email } = req.query;
        if (!email || typeof email !== "string") {
            return res.status(400).json({
                message: "이메일을 입력해주세요",
                isDuplicate: false,
            });
        }
        const existingUser = await db_1.prisma.user.findUnique({
            where: { email: email.trim() },
        });
        res.json({
            isDuplicate: !!existingUser,
            message: existingUser
                ? "이미 사용 중인 이메일입니다"
                : "사용 가능한 이메일입니다",
        });
    }
    catch (err) {
        next(err);
    }
};
exports.checkEmailDuplicate = checkEmailDuplicate;
// 이름 중복체크
const checkNameDuplicate = async (req, res, next) => {
    try {
        const { name } = req.query;
        if (!name || typeof name !== "string") {
            return res.status(400).json({
                message: "이름을 입력해주세요",
                isDuplicate: false,
            });
        }
        const existingUser = await db_1.prisma.user.findFirst({
            where: { name: name.trim() },
        });
        res.json({
            isDuplicate: !!existingUser,
            message: existingUser
                ? "이미 사용 중인 이름입니다"
                : "사용 가능한 이름입니다",
        });
    }
    catch (err) {
        next(err);
    }
};
exports.checkNameDuplicate = checkNameDuplicate;
