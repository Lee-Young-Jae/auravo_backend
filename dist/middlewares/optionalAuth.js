"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuthenticate = void 0;
const jwt_1 = require("../utils/jwt");
// 선택적 인증 미들웨어 (토큰이 있으면 인증, 없으면 비회원으로 처리)
const optionalAuthenticate = (req, res, next) => {
    try {
        // 1. Authorization 헤더에서 토큰 확인
        let token;
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
        if (token) {
            try {
                // 토큰이 있으면 인증 처리
                const decoded = (0, jwt_1.verifyToken)(token);
                req.user = decoded;
            }
            catch (error) {
                // 토큰이 유효하지 않으면 비회원으로 처리 (에러 발생시키지 않음)
                req.user = undefined;
            }
        }
        else {
            // 토큰이 없으면 비회원으로 처리
            req.user = undefined;
        }
        next();
    }
    catch (error) {
        // 예외 발생시에도 비회원으로 처리
        req.user = undefined;
        next();
    }
};
exports.optionalAuthenticate = optionalAuthenticate;
