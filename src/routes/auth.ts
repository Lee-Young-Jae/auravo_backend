import { Router } from "express";
import {
  login,
  register,
  refresh,
  me,
  kakaoRedirect,
  kakaoCallback,
  upsertSocialUser,
  checkEmailDuplicate,
  checkNameDuplicate,
  logout,
} from "../controllers/authController";
import { authenticate } from "../middlewares/auth";

export const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/refresh", refresh);
authRouter.get("/me", authenticate, me);
authRouter.get("/kakao/login", kakaoRedirect);
authRouter.get("/kakao/callback", kakaoCallback);
authRouter.post("/upsert", upsertSocialUser);
authRouter.post("/logout", authenticate, logout);

// 중복체크 엔드포인트
authRouter.get("/check-email", checkEmailDuplicate);
authRouter.get("/check-name", checkNameDuplicate);
