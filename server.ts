import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  authenticateToken,
  requireRoles,
  checkPropertyAccess,
  hashPassword,
  verifyPassword,
  generateToken,
  AuthenticatedRequest,
  TokenPayload
} from './src/server/auth.js';
import {
  prisma,
  checkDatabaseHealth,
  hasSuperAdminInDb,
  LEGACY_DB_FILE
} from './src/server/db.js';
import {
  processDailyReservation,
  processLeaseContract,
  checkUnitConflict
} from './src/server/reservationService.js';
import {
  computeCostAllocation
} from './src/server/financialEngine.js';

const ROOT_DIR = process.cwd();
const BACKUP_DIR = path.resolve(ROOT_DIR, 'backups');
const UPLOADS_DIR = path.resolve(ROOT_DIR, 'uploads');
const PRIVATE_DOCS_DIR = path.resolve(ROOT_DIR, 'private_docs');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const SERVER_DB_FILE = path.resolve(ROOT_DIR, 'server-db.json');

// Ensure system directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PRIVATE_DOCS_DIR)) fs.mkdirSync(PRIVATE_DOCS_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Server state management
let dbState: any = null;
let lastServerUpdateTimestamp = Date.now();

// In-memory registered users with secure hashed passwords
interface StoredUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'SUPER_ADMIN' | 'PROPERTY_MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPING' | 'MAINTENANCE' | 'ACCOUNTANT' | 'TENANT';
  allowedProperties: string[];
  isActive: boolean;
  createdAt: string;
}

let storedUsers: StoredUser[] = [];

async function initializeSecurityAndState() {
  // Load state from server-db.json if available
  if (fs.existsSync(LEGACY_DB_FILE)) {
    try {
      const data = fs.readFileSync(LEGACY_DB_FILE, 'utf-8');
      dbState = JSON.parse(data);
      console.log('[Server] Successfully loaded initial state from disk.');
    } catch (e) {
      console.error('[Server] Error loading state from disk:', e);
    }
  }

  if (!dbState) {
    dbState = {
      settings: {
        companyName: 'Luxury home منزل الفخامة',
        companyNameEn: 'Luxury Home',
        tagline: 'تجربة سكنية فاخرة تدمج بين خصوصية المنزل وخدمات الضيافة الراقية'
      },
      properties: [],
      units: [],
      bookings: [],
      leases: [],
      expenses: [],
      auditLogs: []
    };
  }

  // Initialize stored users from state if exists
  if (Array.isArray(dbState.users) && dbState.users.length > 0) {
    storedUsers = dbState.users;
  } else {
    // Check if initial admin is configured via environment variables
    const initialAdminUsername = process.env.INITIAL_ADMIN_USERNAME || process.env.SUPER_ADMIN_INITIAL_USERNAME;
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || process.env.SUPER_ADMIN_INITIAL_PASSWORD;

    if (initialAdminUsername && initialAdminPassword) {
      const hashedPassword = await hashPassword(initialAdminPassword);
      storedUsers.push({
        id: 'usr_super_admin_env',
        username: initialAdminUsername,
        email: process.env.INITIAL_ADMIN_EMAIL || 'admin@luxuryhome.sa',
        passwordHash: hashedPassword,
        name: 'مدير النظام الرئيسي',
        role: 'SUPER_ADMIN',
        allowedProperties: ['all'],
        isActive: true,
        createdAt: new Date().toISOString()
      });
      console.log(`[Security] Seeded initial Super Admin (${initialAdminUsername}) securely from environment variables.`);
    }
  }
}

function persistState() {
  try {
    lastServerUpdateTimestamp = Date.now();
    dbState.users = storedUsers;
    fs.writeFileSync(LEGACY_DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[Server] Failed to persist state to disk:', e);
    return false;
  }
}

// Record an official audit log on the server using verified identity
function recordServerAuditLog(
  user: TokenPayload | undefined,
  action: string,
  module: string,
  details: string,
  ipAddress?: string
) {
  const logEntry = {
    id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    userId: user?.userId || 'system',
    userName: user?.username ? `${user.username} (${user.role})` : 'زائر / نظام',
    action,
    module,
    details,
    ipAddress: ipAddress || '127.0.0.1',
    createdAt: new Date().toISOString()
  };

  if (!dbState.auditLogs) dbState.auditLogs = [];
  dbState.auditLogs.unshift(logEntry);
  if (dbState.auditLogs.length > 2000) {
    dbState.auditLogs = dbState.auditLogs.slice(0, 2000); // keep most recent 2000 logs
  }
}

export async function startServer(customPort?: number) {
  await initializeSecurityAndState();

  const PORT = customPort || Number(process.env.PORT) || 3000;
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Static uploads directory
  app.use('/uploads', express.static(UPLOADS_DIR));

  // CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  const apiRouter = express.Router();

  // 1. Health & Database Readiness Check
  apiRouter.get('/health', async (req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();
    
    // In production with DATABASE_URL configured, failure to connect to PostgreSQL must report status 503
    const isProd = process.env.NODE_ENV === 'production';
    const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

    if (isProd && isDatabaseConfigured && !dbHealth.connected) {
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: dbHealth,
        error: 'فشل الاتصال بقاعدة بيانات PostgreSQL في بيئة الإنتاج'
      });
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      database: dbHealth.connected ? 'postgresql_active' : (process.env.DATABASE_URL ? 'postgresql_connection_error' : 'unconfigured_local_preview'),
      databaseDetails: dbHealth.details,
      hasAdminInitialized: storedUsers.some(u => u.role === 'SUPER_ADMIN' && u.isActive),
      environment: process.env.NODE_ENV || 'development',
      externalServicesStatus: {
        paymentGateway: Boolean(process.env.PAYMENT_API_KEY) ? 'configured' : 'disabled_manual_only',
        smartLocks: Boolean(process.env.SMART_LOCK_API_KEY) ? 'configured' : 'disabled_manual_only',
        yakeenId: Boolean(process.env.YAKEEN_APP_ID) ? 'configured' : 'disabled_manual_only',
        smsGateway: Boolean(process.env.SMS_API_KEY) ? 'configured' : 'disabled_manual_only'
      }
    });
  });

  // 2. Authentication APIs
  apiRouter.post('/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم وكلمة المرور مطلوبان.' });
    }

    // Lookup user in storedUsers (or DB if active)
    let user = storedUsers.find(u => u.username.toLowerCase() === username.toLowerCase() && u.isActive);

    // Fallback: If no users registered yet and custom env admin matches
    if (!user && storedUsers.length === 0) {
      const envUser = process.env.INITIAL_ADMIN_USERNAME || process.env.SUPER_ADMIN_INITIAL_USERNAME;
      const envPass = process.env.INITIAL_ADMIN_PASSWORD || process.env.SUPER_ADMIN_INITIAL_PASSWORD;
      if (envUser && envPass && username === envUser && password === envPass) {
        const hashedPassword = await hashPassword(password);
        user = {
          id: 'usr_super_admin_env',
          username: envUser,
          email: 'admin@luxuryhome.sa',
          passwordHash: hashedPassword,
          name: 'مدير النظام الرئيسي',
          role: 'SUPER_ADMIN',
          allowedProperties: ['all'],
          isActive: true,
          createdAt: new Date().toISOString()
        };
        storedUsers.push(user);
        persistState();
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      allowedProperties: user.allowedProperties
    };

    const token = generateToken(tokenPayload);

    recordServerAuditLog(
      tokenPayload,
      'تسجيل دخول ناجح',
      'المصادقة والأمان',
      `قام المستخدم ${user.username} بتسجيل الدخول بنجاح إلى النظام بصلاحية ${user.role}.`,
      req.ip
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        allowedProperties: user.allowedProperties
      }
    });
  });

  // PROTECTED Initial Admin Registration & Setup:
  // Strictly closes public setup once any Super Admin exists in the system.
  // Subsequent admin creation REQUIRES a signed JWT from an existing SUPER_ADMIN!
  apiRouter.post('/auth/register-admin', async (req: Request, res: Response) => {
    const { username, password, name, email, allowedProperties } = req.body;

    const hasAdmin = storedUsers.some(u => u.role === 'SUPER_ADMIN' && u.isActive);

    // If an admin already exists, the request MUST be authenticated by an active SUPER_ADMIN
    if (hasAdmin) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
      
      if (!token) {
        return res.status(403).json({
          success: false,
          code: 'SETUP_CLOSED',
          message: 'مرفوض: تم إعداد مسؤول النظام الرئيسي مسبقاً، والتهيئة العامة مغلقة تماماً. يتطلب تسجيل مسؤول جديد مصادقة مسؤول حالي بـ JWT صالح.'
        });
      }

      // Verify token
      const authReq: AuthenticatedRequest = req as any;
      authenticateToken(authReq, res, async () => {
        if (authReq.user?.role !== 'SUPER_ADMIN') {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'فقط المسؤول الرئيسي (SUPER_ADMIN) يملك صلاحية إنشاء حسابات إدارية جديدة.'
          });
        }

        // Proceed to create additional admin
        await createAdminRecord();
      });
      return;
    }

    // Initial setup: No admin exists yet -> Check ADMIN_SETUP_SECRET if configured
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    const providedSecret = req.headers['x-admin-setup-secret'] || req.body.setupSecret;
    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(403).json({
        success: false,
        code: 'INVALID_SETUP_SECRET',
        message: 'مرفوض: رمز التهيئة الإدارية الأولية (ADMIN_SETUP_SECRET) غير صحيح.'
      });
    }

    await createAdminRecord();

    async function createAdminRecord() {
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'اسم المستخدم وكلمة المرور مطلوبان.' });
      }

      if (username.length < 3) {
        return res.status(400).json({ success: false, message: 'يجب أن يتكون اسم المستخدم من ٣ أحرف على الأقل.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'يجب أن تتكون كلمة المرور من ٦ خانات على الأقل لضمان الأمان.' });
      }

      // Check username duplicate
      if (storedUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(409).json({ success: false, message: 'اسم المستخدم مسجل مسبقاً.' });
      }

      const hashedPassword = await hashPassword(password);
      const newAdmin: StoredUser = {
        id: `usr_${Date.now()}`,
        username,
        email: email || `${username}@luxuryhome.sa`,
        passwordHash: hashedPassword,
        name: name || username,
        role: 'SUPER_ADMIN',
        allowedProperties: allowedProperties || ['all'],
        isActive: true,
        createdAt: new Date().toISOString()
      };

      storedUsers.push(newAdmin);
      persistState();

      const payload: TokenPayload = {
        userId: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        allowedProperties: newAdmin.allowedProperties
      };

      const token = generateToken(payload);

      recordServerAuditLog(
        payload,
        'إنشاء مسؤول نظام',
        'الأمان والمسؤولين',
        `تم إنشاء الحساب الإداري الرئيسي (${newAdmin.username}) وإغلاق مسار التهيئة العامة.`,
        req.ip
      );

      return res.json({
        success: true,
        message: 'تم إنشاء حساب المسؤول بنجاح وإغلاق التهيئة العامة.',
        token,
        user: {
          id: newAdmin.id,
          username: newAdmin.username,
          name: newAdmin.name,
          role: newAdmin.role,
          allowedProperties: newAdmin.allowedProperties
        }
      });
    }
  });

  // Verify Current Session User
  apiRouter.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const user = storedUsers.find(u => u.id === req.user?.userId);
    if (!user) {
      return res.json({ success: true, user: req.user });
    }
    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        allowedProperties: user.allowedProperties
      }
    });
  });

  // Logout Endpoint
  apiRouter.post('/auth/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    recordServerAuditLog(
      req.user,
      'تسجيل خروج',
      'المصادقة والأمان',
      `قام المستخدم ${req.user?.username} بتسجيل الخروج من الجلسة.`,
      req.ip
    );
    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح.' });
  });

  // 3. Public APIs for Unauthenticated Visitors (No Financial or Tenant Secrets exposed)
  apiRouter.get('/public/settings', (req: Request, res: Response) => {
    const settings = dbState?.settings || {};
    // Return sanitized public info only
    res.json({
      success: true,
      settings: {
        companyName: settings.companyName || 'Luxury home منزل الفخامة',
        companyNameEn: settings.companyNameEn || 'Luxury Home',
        tagline: settings.tagline || 'تجربة سكنية فاخرة',
        logoUrl: settings.logoUrl || null,
        iconUrl: settings.iconUrl || null,
        phone: settings.phone || '+966 11 000 0000',
        whatsapp: settings.whatsapp || '+966 50 000 0000',
        email: settings.email || 'vip@luxuryhome.sa',
        checkInTime: settings.checkInTime || '15:00',
        checkOutTime: settings.checkOutTime || '12:00',
        navigation: settings.navigation || null
      }
    });
  });

  apiRouter.get('/public/properties', (req: Request, res: Response) => {
    const properties = (dbState?.properties || []).filter((p: any) => p.isActive !== false);
    res.json({ success: true, properties });
  });

  apiRouter.get('/public/units', (req: Request, res: Response) => {
    const units = (dbState?.units || []).filter((u: any) => u.publicationStatus !== 'archived');
    res.json({ success: true, units });
  });

  apiRouter.get('/public/content', (req: Request, res: Response) => {
    const sections = (dbState?.contentSections || []).filter((s: any) => s.enabled !== false);
    res.json({ success: true, contentSections: sections });
  });

  // 4. Protected State API with RBAC & Filtering
  apiRouter.get('/state', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!dbState) {
      return res.status(404).json({ success: false, message: 'لا توجد بيانات متاحة.' });
    }

    const user = req.user!;
    
    // Super Admin gets complete system state
    if (user.role === 'SUPER_ADMIN') {
      return res.json({ success: true, state: dbState, timestamp: lastServerUpdateTimestamp });
    }

    // Property Manager / Staff gets state filtered by allowedProperties
    const allowed = user.allowedProperties || [];
    const isUniversal = allowed.includes('all');

    const filteredProperties = isUniversal
      ? dbState.properties
      : (dbState.properties || []).filter((p: any) => allowed.includes(p.id));

    const allowedPropIds = new Set(filteredProperties.map((p: any) => p.id));

    const filteredUnits = isUniversal
      ? dbState.units
      : (dbState.units || []).filter((u: any) => allowedPropIds.has(u.propertyId));

    const filteredBookings = isUniversal
      ? dbState.bookings
      : (dbState.bookings || []).filter((b: any) => allowedPropIds.has(b.propertyId));

    const filteredLeases = isUniversal
      ? dbState.leases
      : (dbState.leases || []).filter((l: any) => allowedPropIds.has(l.propertyId));

    const filteredExpenses = isUniversal
      ? dbState.expenses
      : (dbState.expenses || []).filter((e: any) => !e.propertyId || allowedPropIds.has(e.propertyId));

    return res.json({
      success: true,
      state: {
        ...dbState,
        properties: filteredProperties,
        units: filteredUnits,
        bookings: filteredBookings,
        leases: filteredLeases,
        expenses: filteredExpenses,
        // Non-super admins cannot view full company settings or users
        users: undefined
      },
      timestamp: lastServerUpdateTimestamp
    });
  });

  // State synchronization: requires authenticated token
  apiRouter.post('/state/sync', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const incomingState = req.body;
    const userRole = req.user?.role;

    if (!incomingState || typeof incomingState !== 'object') {
      return res.status(400).json({ success: false, message: 'صيغة البيانات غير صالحة.' });
    }

    // Retain server audit logs: client cannot purge or edit server audit history
    if (dbState && Array.isArray(dbState.auditLogs)) {
      const existingAuditIds = new Set(dbState.auditLogs.map((l: any) => l.id));
      const newLogs = (incomingState.auditLogs || []).filter((l: any) => !existingAuditIds.has(l.id));
      incomingState.auditLogs = [...dbState.auditLogs, ...newLogs];
    }

    // Non-super_admin users cannot modify company settings or user permissions
    if (userRole !== 'SUPER_ADMIN' && dbState?.settings) {
      incomingState.settings = dbState.settings;
    }

    // Maintain secure users table
    incomingState.users = storedUsers;

    dbState = incomingState;
    const saved = persistState();

    if (saved) {
      res.json({ success: true, timestamp: lastServerUpdateTimestamp });
    } else {
      res.status(500).json({ success: false, message: 'فشل حفظ التعديلات في قاعدة البيانات.' });
    }
  });

  // 5. Unified Reservation & Lease API with Atomic Overlap Prevention
  // Daily Booking
  apiRouter.post('/bookings/daily', async (req: Request, res: Response) => {
    try {
      const result = await processDailyReservation(req.body);
      
      // Update in-memory state for immediate sync
      if (dbState && Array.isArray(dbState.bookings)) {
        dbState.bookings.push(result.booking);
        if (Array.isArray(dbState.allocations)) {
          dbState.allocations.push(result.allocation);
        }
        persistState();
      }

      recordServerAuditLog(
        undefined,
        'حجز يومي جديد',
        'الحجوزات الفندقية',
        `تم تأكيد حجز يومي للوحدة ${req.body.unitId} للنزيل ${req.body.guestName} بقيمة ${result.totalAmount} ر.س. الدفع قيد التحقق.`
      );

      return res.json({
        success: true,
        message: 'تم تسجيل الحجز اليومي وإقفال الفترة الزمنية لمنع أي تداخل متزامن.',
        ...result
      });
    } catch (err: any) {
      const status = err.statusCode || 400;
      return res.status(status).json({
        success: false,
        message: err.message || 'فشل تسجيل الحجز.'
      });
    }
  });

  // Annual / Monthly Lease Contract
  apiRouter.post('/leases/contract', async (req: Request, res: Response) => {
    try {
      const result = await processLeaseContract(req.body);

      // Update in-memory state
      if (dbState && Array.isArray(dbState.leases)) {
        dbState.leases.push(result.lease);
        if (Array.isArray(dbState.allocations)) {
          dbState.allocations.push(result.allocation);
        }
        persistState();
      }

      recordServerAuditLog(
        undefined,
        'عقد تأجير جديد',
        'عقود الإيجار',
        `تم تسجيل عقد إيجار ${req.body.rentalType === 'annual' ? 'سنوي' : 'شهري'} للوحدة ${req.body.unitId} للمستأجر ${req.body.tenantName}.`
      );

      return res.json({
        success: true,
        message: 'تم اعتماد عقد الإيجار بنجاح وجدولة الأقساط وحجز كامل فترة العقد.',
        ...result
      });
    } catch (err: any) {
      const status = err.statusCode || 400;
      return res.status(status).json({
        success: false,
        message: err.message || 'فشل تسجيل عقد الإيجار.'
      });
    }
  });

  // Legacy Check and Reserve Endpoint (maintains compatibility with existing tests)
  apiRouter.post('/bookings/check-and-reserve', async (req: Request, res: Response) => {
    const { unitId, startDate, endDate, guestName, rentalType, totalAmount } = req.body;

    if (!unitId || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'معلومات الحجز غير مكتملة.' });
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    if (isNaN(start) || isNaN(end) || start >= end) {
      return res.status(400).json({ success: false, message: 'تواريخ الحجز غير صالحة.' });
    }

    // Atomic Conflict Check across bookings and active allocations
    const existingBookings = (dbState?.bookings || []).filter((b: any) => b.unitId === unitId && b.status !== 'cancelled');
    const existingAllocations = (dbState?.allocations || []).filter((a: any) => a.unitId === unitId && a.status === 'active');

    const hasBookingConflict = existingBookings.some((b: any) => {
      const bStart = new Date(b.startDate || b.checkIn).getTime();
      const bEnd = new Date(b.endDate || b.checkOut).getTime();
      return (start < bEnd && end > bStart);
    });

    const hasAllocConflict = existingAllocations.some((a: any) => {
      const aStart = new Date(a.startDate).getTime();
      const aEnd = new Date(a.endDate).getTime();
      return (start < aEnd && end > aStart);
    });

    if (hasBookingConflict || hasAllocConflict) {
      return res.status(409).json({
        success: false,
        conflict: true,
        message: 'عذراً، هذه الوحدة محجوزة بالفعل في الفترة المحددة. تم إعمال قفل منع التداخل بنجاح.'
      });
    }

    const bookingNumber = `LH-${Math.floor(100000 + Math.random() * 900000)}`;
    const newBooking = {
      id: `bk_srv_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      bookingNumber,
      unitId,
      guestName: guestName || 'عميل محجوز',
      startDate,
      endDate,
      checkIn: startDate,
      checkOut: endDate,
      rentalType: rentalType || 'daily',
      totalAmount: totalAmount || 850,
      status: 'confirmed',
      paymentStatus: 'pending',
      identityStatus: 'pending_verification',
      createdAt: new Date().toISOString()
    };

    const newAllocation = {
      id: `alloc_${Date.now()}`,
      unitId,
      startDate,
      endDate,
      rentalType: (rentalType || 'daily').toUpperCase(),
      referenceId: newBooking.id,
      purpose: 'booking',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    if (!dbState.bookings) dbState.bookings = [];
    if (!dbState.allocations) dbState.allocations = [];

    dbState.bookings.push(newBooking);
    dbState.allocations.push(newAllocation);
    persistState();

    return res.json({
      success: true,
      booking: newBooking,
      allocation: newAllocation,
      message: 'تم تأكيد الحجز وإقفال الفترة الزمنية لمنع أي تداخل متزامن.'
    });
  });

  // 6. Cost Allocation & Financial Distribution Engine Endpoint
  apiRouter.post('/financials/allocate', (req: Request, res: Response) => {
    try {
      const result = computeCostAllocation(req.body);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // Unified financial calculation endpoint
  apiRouter.post('/financials/calculate-distribution', (req: Request, res: Response) => {
    try {
      const { buildingRent, guardSalary, adminSalary, electricityBill, directMaintenance, units, allocationMethod } = req.body;

      // Ensure 0 is recognized as a valid numeric amount, not overwritten by default
      const bRent = buildingRent !== undefined && buildingRent !== null ? Number(buildingRent) : 120000;
      const gSalary = guardSalary !== undefined && guardSalary !== null ? Number(guardSalary) : 3000;
      const aSalary = adminSalary !== undefined && adminSalary !== null ? Number(adminSalary) : 10000;
      const eBill = electricityBill !== undefined && electricityBill !== null ? Number(electricityBill) : 1500;
      const dMaint = directMaintenance !== undefined && directMaintenance !== null ? Number(directMaintenance) : 500;

      const monthlyBuildingRent = Math.round((bRent / 12) * 100) / 100;
      const totalBuildingOPEX = Math.round((monthlyBuildingRent + gSalary + aSalary + eBill) * 100) / 100;
      const totalDirectUnitOPEX = dMaint;
      const companyTotalOPEX = Math.round((totalBuildingOPEX + totalDirectUnitOPEX) * 100) / 100;

      const unitsList = Array.isArray(units) && units.length > 0 ? units : [
        { id: '101', unitNumber: '101', areaSqm: 50, isOccupied: true },
        { id: '102', unitNumber: '102', areaSqm: 50, isOccupied: true },
        { id: '103', unitNumber: '103', areaSqm: 50, isOccupied: false },
        { id: '104', unitNumber: '104', areaSqm: 50, isOccupied: false },
        { id: '105', unitNumber: '105', areaSqm: 50, isOccupied: true },
        { id: '106', unitNumber: '106', areaSqm: 50, isOccupied: true },
        { id: '107', unitNumber: '107', areaSqm: 50, isOccupied: true },
        { id: '108', unitNumber: '108', areaSqm: 50, isOccupied: true },
        { id: '109', unitNumber: '109', areaSqm: 50, isOccupied: false },
        { id: '110', unitNumber: '110', areaSqm: 50, isOccupied: true }
      ];

      // Execute verified allocation engine
      const allocationResult = computeCostAllocation({
        title: 'المصاريف التشغيلية للمبنى',
        amount: totalBuildingOPEX,
        costCenterLevel: 'PROPERTY',
        allocationMethod: allocationMethod || 'EQUAL_UNITS',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        units: unitsList
      });

      const allocatedUnits = unitsList.map(u => {
        const share = allocationResult.shares.find(s => s.unitId === u.id);
        const allocatedShare = share ? share.shareAmount : 0;
        const direct = u.id === '101' ? dMaint : 0;
        return {
          unitId: u.id,
          unitNumber: u.unitNumber,
          isOccupied: u.isOccupied,
          allocatedShare,
          directExpense: direct,
          totalFullCost: Math.round((allocatedShare + direct) * 100) / 100
        };
      });

      const sumAllocatedAllUnits = Math.round(allocatedUnits.reduce((acc, curr) => acc + curr.totalFullCost, 0) * 100) / 100;
      const discrepancy = Math.abs(Math.round((companyTotalOPEX - sumAllocatedAllUnits) * 100) / 100);

      res.json({
        success: true,
        calculationEngine: 'Verified Server Accrual & Exact Cost Allocation Engine',
        summary: {
          annualBuildingRent: bRent,
          monthlyBuildingRent,
          guardSalary: gSalary,
          adminSalary: aSalary,
          electricityBill: eBill,
          totalBuildingOPEX,
          totalDirectUnitOPEX,
          companyTotalOPEX,
          sumAllocatedAllUnits,
          discrepancyHalalas: discrepancy
        },
        allocatedUnits,
        engineDetails: allocationResult
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // 7. Controlled Data Migration & Import Endpoint (with duplicate prevention and record count preview)
  apiRouter.post('/admin/import-data', authenticateToken, requireRoles(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
    const { mode, payload } = req.body; // mode: 'preview' | 'commit'
    const dataToImport = payload || dbState;

    if (!dataToImport || typeof dataToImport !== 'object') {
      return res.status(400).json({ success: false, message: 'البيانات المراد استيرادها غير صالحة.' });
    }

    const properties = dataToImport.properties || [];
    const units = dataToImport.units || [];
    const bookings = dataToImport.bookings || [];
    const leases = dataToImport.leases || [];
    const expenses = dataToImport.expenses || [];

    // Duplicate detection
    const existingPropertyCodes = new Set((dbState?.properties || []).map((p: any) => p.code));
    const newProperties = properties.filter((p: any) => !existingPropertyCodes.has(p.code));
    const duplicateProperties = properties.length - newProperties.length;

    const existingUnitKeys = new Set((dbState?.units || []).map((u: any) => `${u.propertyId}_${u.unitNumber}`));
    const newUnits = units.filter((u: any) => !existingUnitKeys.has(`${u.propertyId}_${u.unitNumber}`));
    const duplicateUnits = units.length - newUnits.length;

    const existingBookingNumbers = new Set((dbState?.bookings || []).map((b: any) => b.bookingNumber));
    const newBookings = bookings.filter((b: any) => !existingBookingNumbers.has(b.bookingNumber));
    const duplicateBookings = bookings.length - newBookings.length;

    const previewSummary = {
      properties: { total: properties.length, newRecords: newProperties.length, duplicatesSkipped: duplicateProperties },
      units: { total: units.length, newRecords: newUnits.length, duplicatesSkipped: duplicateUnits },
      bookings: { total: bookings.length, newRecords: newBookings.length, duplicatesSkipped: duplicateBookings },
      leases: { total: leases.length, newRecords: leases.length, duplicatesSkipped: 0 },
      expenses: { total: expenses.length, newRecords: expenses.length, duplicatesSkipped: 0 }
    };

    if (mode === 'preview') {
      return res.json({
        success: true,
        mode: 'preview',
        message: 'تمت معاينة وحصر السجلات بنجاح مع كشف العناصر المكررة.',
        preview: previewSummary
      });
    }

    if (mode === 'commit') {
      // Append non-duplicate records to state
      dbState.properties = [...(dbState.properties || []), ...newProperties];
      dbState.units = [...(dbState.units || []), ...newUnits];
      dbState.bookings = [...(dbState.bookings || []), ...newBookings];
      dbState.leases = [...(dbState.leases || []), ...leases];
      dbState.expenses = [...(dbState.expenses || []), ...expenses];

      persistState();

      recordServerAuditLog(
        req.user,
        'استيراد بيانات منضبط',
        'إدارة البيانات والترحيل',
        `تم استيراد ${newProperties.length} مباني و ${newUnits.length} وحدات و ${newBookings.length} حجوزات مع تخطي السجلات المكررة.`,
        req.ip
      );

      return res.json({
        success: true,
        mode: 'commit',
        message: 'تم استيراد البيانات وحفظها بنجاح مع استبعاد السجلات المكررة.',
        imported: previewSummary
      });
    }

    return res.status(400).json({ success: false, message: 'وضع الاستيراد يجب أن يكون preview أو commit.' });
  });

  // 8. Backup & Restore Endpoints (Protected for Super Admin Only)
  apiRouter.post('/backup/export', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
    if (!dbState) return res.status(400).json({ success: false, message: 'لا توجد بيانات للتصدير.' });

    const backupFileName = `backup_${Date.now()}.json`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    try {
      // Export state with sensitive user hashes redacted
      const sanitizedState = {
        ...dbState,
        users: storedUsers.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          name: u.name,
          role: u.role,
          allowedProperties: u.allowedProperties,
          createdAt: u.createdAt
        }))
      };

      fs.writeFileSync(backupFilePath, JSON.stringify(sanitizedState, null, 2), 'utf-8');

      recordServerAuditLog(
        req.user,
        'تصدير نسخة احتياطية',
        'النسخ الاحتياطي',
        `تم تصدير نسخة احتياطية جديدة للنظام: ${backupFileName}`,
        req.ip
      );

      res.json({
        success: true,
        message: 'تم إنشاء وحفظ النسخة الاحتياطية بنجاح على الخادم.',
        backupFile: backupFileName,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      res.status(500).json({ success: false, message: 'فشل إنشاء ملف النسخة الاحتياطية.' });
    }
  });

  apiRouter.post('/backup/restore', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
    const { backupFileName } = req.body;
    if (!backupFileName) return res.status(400).json({ success: false, message: 'اسم ملف النسخة الاحتياطية مطلوب.' });

    const backupFilePath = path.join(BACKUP_DIR, backupFileName);
    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, message: 'ملف النسخة الاحتياطية المطلوب غير موجود.' });
    }

    try {
      const data = fs.readFileSync(backupFilePath, 'utf-8');
      const restoredState = JSON.parse(data);

      if (!restoredState || typeof restoredState !== 'object') {
        return res.status(400).json({ success: false, message: 'ملف النسخة الاحتياطية تالف أو غير صالح.' });
      }

      // Preserve current admin users so access is never locked out during restore
      restoredState.users = storedUsers;

      dbState = restoredState;
      persistState();

      recordServerAuditLog(
        req.user,
        'استعادة نسخة احتياطية',
        'النسخ الاحتياطي',
        `تمت استعادة حالة النظام بالكامل من الملف: ${backupFileName}`,
        req.ip
      );

      res.json({
        success: true,
        message: 'تمت استعادة البيانات بنجاح وتحديث النظام بالكامل.',
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      res.status(500).json({ success: false, message: 'فشل قراءة واستعادة ملف النسخة الاحتياطية.' });
    }
  });

  app.use('/api', apiRouter);

  // Serve static dist in production, or mount Vite dev middleware
  if (process.env.NODE_ENV === 'production') {
    if (fs.existsSync(DIST_DIR)) {
      app.use(express.static(DIST_DIR));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.resolve(DIST_DIR, 'index.html'));
      });
    } else {
      app.get('*', (req: Request, res: Response) => {
        res.send('Server running. Dist directory not built.');
      });
    }
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const serverInstance = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  });

  return serverInstance;
}

// Start server directly if executed in Node/TSX, but skip when imported by test runner
const execPath = process.argv[1] || '';
const isDirectExecution = (
  execPath.endsWith('server.ts') ||
  execPath.endsWith('server.js') ||
  execPath.includes('dist-server')
) && !process.env.TEST_SUITE_RUNNER;

if (isDirectExecution) {
  startServer().catch(err => {
    console.error('[Server Start Error]:', err);
    process.exit(1);
  });
}
