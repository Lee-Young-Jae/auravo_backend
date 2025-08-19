"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const strip = (val) => typeof val === "string" ? val.replace(/^"|"$/g, "") : val;
exports.env = zod_1.z
    .object({
    PORT: zod_1.z.coerce.number().default(4000),
    DATABASE_URL: zod_1.z.preprocess(strip, zod_1.z.string().url()),
    JWT_SECRET: zod_1.z.string().min(16),
    ACCESS_TOKEN_TTL: zod_1.z.string().default("15m"),
    REFRESH_TOKEN_TTL: zod_1.z.string().default("7d"),
    CORS_ORIGIN: zod_1.z.preprocess(strip, zod_1.z.string().url()),
    KAKAO_CLIENT_ID: zod_1.z.string().min(1),
    KAKAO_CLIENT_SECRET: zod_1.z.string().min(1),
    KAKAO_REDIRECT_URI: zod_1.z.string().url(),
    FRONTEND_REDIRECT: zod_1.z.string().url(),
})
    .parse(process.env);
