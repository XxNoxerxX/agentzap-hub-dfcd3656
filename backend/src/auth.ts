import type { Request, Response, NextFunction } from "express";

export function requireToken(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token !== process.env.API_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
