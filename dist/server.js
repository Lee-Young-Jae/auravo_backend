"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const db_1 = require("./config/db");
(async () => {
    const app = (0, app_1.createApp)();
    await db_1.prisma.$connect();
    app.listen(env_1.env.PORT, () => console.log(`Auth service on :${env_1.env.PORT}`));
})();
