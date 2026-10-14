import jwt from "jsonwebtoken";

function secret() {
  const value = String(process.env.JWT_SECRET || "").trim();
  if (!value || value === "SUPER_SECRET_TOKEN" || value.length < 32) return null;
  return value;
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const jwtSecret = secret();
  if (!jwtSecret) return res.status(500).json({ ok: false, error: "Server JWT_SECRET is not configured securely" });
  if (!token) return res.status(401).json({ ok: false, error: "Access token required" });

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(403).json({ ok: false, error: "Invalid or expired token" });
  }
}

export function isAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ ok: false, error: "Admin access required" });
  next();
}

export function isStudent(req, res, next) {
  if (req.user?.role !== "student") return res.status(403).json({ ok: false, error: "Student access required" });
  next();
}

export function isSelfOrAdmin(paramName = "userId") {
  return (req, res, next) => {
    if (req.user?.role === "admin") return next();
    if (req.user?.role === "student" && String(req.user.id) === String(req.params[paramName])) return next();
    return res.status(403).json({ ok: false, error: "Not allowed" });
  };
}

export function verifyWsToken(token) {
  const jwtSecret = secret();
  if (!jwtSecret || !token) return null;
  try { return jwt.verify(token, jwtSecret); } catch { return null; }
}
