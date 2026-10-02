import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './db.js';

// Secret key management: in production, JWT_SECRET is mandatory
const IS_PROD = process.env.NODE_ENV === 'production';
let JWT_SECRET = process.env.JWT_SECRET || '';

if (IS_PROD && !JWT_SECRET) {
  const errMsg = 'CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is required in production mode.';
  console.error(`[Security Fatal] ${errMsg}`);
  if (process.env.TEST_SUITE_RUNNER !== 'true') {
    // In production runtime, throw to prevent insecure execution
    throw new Error(errMsg);
  }
  JWT_SECRET = 'luxury_home_test_secret_key_fixed_for_isolated_test_runner';
} else if (!JWT_SECRET) {
  // Ephemeral development secret
  JWT_SECRET = 'luxury_home_dev_session_secret_' + crypto.randomBytes(16).toString('hex');
}

const TOKEN_EXPIRY = '24h';

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  phone?: string;
  role: 'SUPER_ADMIN' | 'PROPERTY_MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPING' | 'MAINTENANCE' | 'ACCOUNTANT' | 'TENANT';
  allowedProperties: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  dbUser?: any;
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

// Allowed user properties whitelist (Strict Sanitization)
export function sanitizeUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    phone: user.phone || null,
    role: user.role,
    allowedProperties: user.allowedProperties || ['all'],
    isActive: Boolean(user.isActive),
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt
  };
}

// Express Middleware: Authenticate Token & Validate against Live Database
export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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
  if (!payload || !payload.userId) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID_OR_EXPIRED',
      message: 'رمز الجلسة غير صالح أو انتهت صلاحيته. يرجى إعادة تسجيل الدخول.'
    });
  }

  // Check user status in PostgreSQL database
  if (process.env.DATABASE_URL) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId }
      });

      if (!dbUser) {
        return res.status(401).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'المستخدم صاحب الجلسة غير موجود في النظام أو تم حذفه.'
        });
      }

      if (!dbUser.isActive) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DEACTIVATED',
          message: 'تم تعطيل هذا الحساب من قبل الإدارة. يرجى مراجعة المشرف.'
        });
      }

      // Update payload with real-time DB roles and permissions
      payload.role = dbUser.role as any;
      payload.allowedProperties = dbUser.allowedProperties || [];
      req.dbUser = dbUser;
    } catch (dbErr: any) {
      if (IS_PROD) {
        return res.status(503).json({
          success: false,
          code: 'DATABASE_UNAVAILABLE',
          message: 'تعذر التحقق من هوية وصلاحيات المستخدم بسبب تعطل الاتصال بقاعدة البيانات.'
        });
      }
      console.warn('[Auth] Database check error during token auth:', dbErr?.message);
    }
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

  // Route parameter matching: handles :propertyId or :id on /properties/:id
  const propertyId = req.params.propertyId || req.params.id || req.body.propertyId || req.query.propertyId;
  
  if (!propertyId) {
    // If no specific property is targeted on a property-scoped route:
    // Only SUPER_ADMIN and ACCOUNTANT can manage unassigned / company-level scope
    if (req.user.role === 'ACCOUNTANT') return next();
    return res.status(403).json({
      success: false,
      code: 'PROPERTY_ACCESS_DENIED',
      message: 'غير مصرح لمدير العقار بالوصول لبيانات عامة خارج نطاق المباني المخصصة له.'
    });
  }

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
