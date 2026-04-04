import { NextFunction, Response } from "express";
import { Role } from "@prisma/client";
import { verifyToken } from "../services/auth";
import { AuthRequest } from "../types";

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const token = header.replace("Bearer ", "");
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireRoleMiddleware(role: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}
