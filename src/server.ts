import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/db";

(async () => {
  const app = createApp();
  await prisma.$connect();
  app.listen(env.PORT, () => console.log(`Auth service on :${env.PORT}`));
})();
