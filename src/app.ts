import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { userRouter } from "./routes/user";
import { postRouter } from "./routes/post";
import { searchRouter } from "./routes/search";
import { auraRouter } from "./routes/aura";
import { errorHandler } from "./middlewares/error";

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use("/auth", authRouter);
  app.use("/users", userRouter);
  app.use("/posts", postRouter);
  app.use("/search", searchRouter);
  app.use("/aura", auraRouter);
  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
  app.use(errorHandler);

  return app;
};
