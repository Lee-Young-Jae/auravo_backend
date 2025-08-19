"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserSession = createUserSession;
exports.clearRefreshTokens = clearRefreshTokens;
const db_1 = require("../config/db");
const jwt_1 = require("./jwt");
const parseTTL_1 = require("./parseTTL");
const env_1 = require("../config/env");
async function createUserSession(userId, res) {
    // 1) 기존 토큰 전부 삭제
    await db_1.prisma.refreshToken.deleteMany({ where: { userId } });
    // 2) 사용자 정보 조회 (JWT 페이로드에 필요한 정보)
    const user = await db_1.prisma.user.findUnique({
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
    const accessToken = (0, jwt_1.signAccessToken)(payload);
    const refreshToken = (0, jwt_1.signRefreshToken)(payload);
    // 4) DB에 리프레시 토큰 저장
    await db_1.prisma.refreshToken.create({
        data: {
            token: refreshToken,
            userId,
            expiresAt: new Date(Date.now() + (0, parseTTL_1.parseTTL)(env_1.env.REFRESH_TOKEN_TTL)),
        },
    });
    // 5) HTTP-Only 쿠키 세팅
    const maxAgeA = (0, parseTTL_1.parseTTL)(env_1.env.ACCESS_TOKEN_TTL);
    const maxAgeR = (0, parseTTL_1.parseTTL)(env_1.env.REFRESH_TOKEN_TTL);
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: maxAgeA,
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: maxAgeR,
    });
    return { accessToken, refreshToken };
}
async function clearRefreshTokens(userId) {
    await db_1.prisma.refreshToken.deleteMany({
        where: { userId },
    });
}
