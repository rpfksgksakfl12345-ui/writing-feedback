import { Request } from "express";
import { Role } from "@prisma/client";

export interface AuthPayload {
  userId: number;
  role: Role;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}
