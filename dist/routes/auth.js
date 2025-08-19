"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middlewares/auth");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/register", authController_1.register);
exports.authRouter.post("/login", authController_1.login);
exports.authRouter.post("/refresh", authController_1.refresh);
exports.authRouter.get("/me", auth_1.authenticate, authController_1.me);
exports.authRouter.get("/kakao", authController_1.kakaoRedirect);
exports.authRouter.get("/kakao/callback", authController_1.kakaoCallback);
exports.authRouter.post("/upsert", authController_1.upsertSocialUser);
// 중복체크 엔드포인트
exports.authRouter.get("/check-email", authController_1.checkEmailDuplicate);
exports.authRouter.get("/check-name", authController_1.checkNameDuplicate);
