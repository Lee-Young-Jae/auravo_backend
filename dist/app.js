"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = require("./config/env");
const auth_1 = require("./routes/auth");
const user_1 = require("./routes/user");
const post_1 = require("./routes/post");
const error_1 = require("./middlewares/error");
const createApp = () => {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({ origin: env_1.env.CORS_ORIGIN, credentials: true }));
    app.use(express_1.default.json());
    app.use((0, cookie_parser_1.default)());
    app.use("/auth", auth_1.authRouter);
    app.use("/users", user_1.userRouter);
    app.use("/posts", post_1.postRouter);
    app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
    app.use(error_1.errorHandler);
    return app;
};
exports.createApp = createApp;
