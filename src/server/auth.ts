import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Secret key management: use env var or secure fallback for session
const JWT_SECRET = process.env.JWT_SECRET || 'luxury_home_jwt_production_secret_key_2026_secure_hash';
const TOKEN_EXPIRY = '24h';

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  role: 'SUPER_ADMIN' | 'PROPERTY_MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPING' | 'MAINTENANCE' | 'ACCOUNTANT' | 'TENANT';
  allowedProperties: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

// Password hashing
export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

export async function verifyPassword(plainText: string, hashed: string): Promise<boolean> {
  if (!plainText || !hashed) return false;
  return bcrypt.compare(plainText, hashed);
}

// JWT Token Generation
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// Token Verification
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}

// Express Middleware: Authenticate Token
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7).trim() 
    : (authHeader && authHeader.trim());

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      message: 'مطلوب تسجيل الدخول وتوفير رمز المصادقة المعتمد لتنفيذ هذه العملية.'
    });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID_OR_EXPIRED',
      message: 'رمز الجلسة غير صالح أو انتهت صلاحيته. يرجى إعادة تسجيل الدخول.'
    });
  }

  req.user = payload;
  next();
}

// Express Middleware: Require Specific Roles
export function requireRoles(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'مطلوب تسجيل الدخول للتحقق من الصلاحيات.'
      });
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next(); // Super admin has universal access
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `ليس لديك الصلاحية الكافية للوصول لهذا المسار (الدور المطلوب: ${allowedRoles.join(', ')}).`
      });
    }

    next();
  };
}

// Express Middleware: Restrict Staff to Allowed Properties
export function checkPropertyAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, message: 'مطلوب تسجيل الدخول.' });
  if (req.user.role === 'SUPER_ADMIN') return next();

  const propertyId = req.params.propertyId || req.body.propertyId || req.query.propertyId;
  if (!propertyId) return next();

  const allowed = req.user.allowedProperties || [];
  if (allowed.includes('all') || allowed.includes(String(propertyId))) {
    return next();
  }

  return res.status(403).json({
    success: false,
    code: 'PROPERTY_ACCESS_DENIED',
    message: 'غير مصرح لك بإدارة أو عرض بيانات هذا العقار المحدد.'
  });
}
