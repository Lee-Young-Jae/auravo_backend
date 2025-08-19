import { JwtPayload } from "../utils/jwt";
import "express";

declare module "express" {
  interface Request {
    user?: JwtPayload;
  }
}
