import "dotenv/config";
import { z } from "zod";

const strip = (val: unknown) =>
  typeof val === "string" ? val.replace(/^"|"$/g, "") : val;

export const env = z
  .object({
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.preprocess(strip, z.string().url()),
    JWT_SECRET: z.string().min(16),
    ACCESS_TOKEN_TTL: z.string().default("15m"),
    REFRESH_TOKEN_TTL: z.string().default("7d"),
    CORS_ORIGIN: z.preprocess(strip, z.string().url()),
    KAKAO_CLIENT_ID: z.string().min(1),
    KAKAO_CLIENT_SECRET: z.string().min(1),
    KAKAO_REDIRECT_URI: z.string().url(),
    FRONTEND_REDIRECT: z.string().url(),
  })
  .parse(process.env);
