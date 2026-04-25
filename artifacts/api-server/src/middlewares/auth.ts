import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  soldier?: { name: string; pkal: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "נדרשת התחברות" });
    return;
  }
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    res.status(500).json({ error: "שגיאת תצורת שרת" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), secret) as { name: string; pkal: string };
    req.soldier = payload;
    next();
  } catch {
    res.status(401).json({ error: "session פג תוקף — התחבר מחדש" });
  }
}
