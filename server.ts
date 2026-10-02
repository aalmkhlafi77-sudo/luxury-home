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
  sanitizeUser,
  AuthenticatedRequest,
  TokenPayload
} from './src/server/auth.js';
import {
  prisma,
  checkDatabaseHealth,
  hasSuperAdminInDb
} from './src/server/db.js';
import crypto from 'crypto';
import {
  serializeDecimals,
  getCompanySettingsFromDb,
  updateCompanySettingsInDb,
  getPropertiesFromDb,
  createPropertyInDb,
  updatePropertyInDb,
  deletePropertyInDb,
  createFloorInDb,
  updateFloorInDb,
  deleteFloorInDb,
  getUnitsFromDb,
  createUnitInDb,
  updateUnitInDb,
  deleteUnitInDb,
  createBatchUnitsInDb,
  getBookingsFromDb,
  getLeasesFromDb,
  getExpensesFromDb,
  createExpenseInDb,
  updateExpenseInDb,
  deleteExpenseInDb,
  getAuditLogsFromDb,
  recordAuditLogInDb,
  importDataIntoDb,
  exportFullDatabase,
  restoreFullDatabaseInDb,
  validateBackupPackageIntegrity,
  REQUIRED_FULL_BACKUP_COLLECTIONS,
  saveDocumentRecordInDb,
  getDocumentRecordFromDb
} from './src/server/repository.js';
import {
  processDailyReservation,
  processLeaseContract,
  checkUnitConflict,
  cancelBooking,
  processSecurityDepositRefund
} from './src/server/reservationService.js';
import {
  refundDeposit,
  applyDepositToRent,
  RefundError
} from './src/server/depositRefundService.js';
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

// Standalone in-memory fallback cache only if DATABASE_URL is not set
let memoryState: any = null;

export function getMemoryState() {
  return memoryState;
}

async function initializeFallbackState() {
  if (fs.existsSync(SERVER_DB_FILE)) {
    try {
      const raw = fs.readFileSync(SERVER_DB_FILE, 'utf-8');
      memoryState = JSON.parse(raw);
    } catch (e) {
      console.warn('[Server] Note on reading server-db.json:', e);
    }
  }
  if (!memoryState) {
    memoryState = {
      users: [],
      settings: {
        companyName: 'Luxury home منزل الفخامة',
        companyNameEn: 'Luxury Home',
        tagline: 'تجربة سكنية فاخرة تدمج بين خصوصية المنزل وخدمات الضيافة الراقية'
      },
      properties: [],
      floors: [],
      amenities: [],
      units: [],
      parkingSpots: [],
      allocations: [],
      bookings: [],
      leases: [],
      installments: [],
      securityDeposits: [],
      securityDepositTransactions: [],
      payments: [],
      expenses: [],
      expenseAllocations: [],
      expensePayments: [],
      expenseCategories: [],
      recurringSchedules: [],
      tenantAdjustments: [],
      contentSections: [],
      documentRecords: [],
      idempotencyRecords: [],
      auditLogs: []
    };
  } else {
    for (const key of REQUIRED_FULL_BACKUP_COLLECTIONS) {
      if (!Array.isArray(memoryState[key])) memoryState[key] = [];
    }
    if (memoryState.settings === undefined) {
      memoryState.settings = {
        companyName: 'Luxury home منزل الفخامة',
        companyNameEn: 'Luxury Home'
      };
    }
    // Clean up any historical orphaned test records to preserve strict relational integrity
    const unitIds = new Set((memoryState.units || []).map((u: any) => u.id));
    const propIds = new Set((memoryState.properties || []).map((p: any) => p.id));
    if (propIds.size > 0) {
      memoryState.floors = (memoryState.floors || []).filter((f: any) => !f.propertyId || propIds.has(f.propertyId));
      memoryState.units = (memoryState.units || []).filter((u: any) => !u.propertyId || propIds.has(u.propertyId));
    }
    if (unitIds.size > 0) {
      memoryState.bookings = (memoryState.bookings || []).filter((b: any) => unitIds.has(b.unitId));
      memoryState.allocations = (memoryState.allocations || []).filter((a: any) => unitIds.has(a.unitId));
      memoryState.leases = (memoryState.leases || []).filter((l: any) => unitIds.has(l.unitId));
    }
    const bookingIds = new Set((memoryState.bookings || []).map((b: any) => b.id));
    const leaseIds = new Set((memoryState.leases || []).map((l: any) => l.id));
    memoryState.securityDeposits = (memoryState.securityDeposits || []).filter((sd: any) => {
      if (sd.bookingId && !bookingIds.has(sd.bookingId)) return false;
      if (sd.leaseId && !leaseIds.has(sd.leaseId)) return false;
      return true;
    }).map((sd: any) => ({
      ...sd,
      collectedAmount: sd.collectedAmount ?? 0,
      collectionReference: sd.collectionReference ?? null,
      collectionVerifiedAt: sd.collectionVerifiedAt ?? null,
      refundedAmount: sd.refundedAmount ?? 0,
      deductedAmount: sd.deductedAmount ?? 0,
    }));
    const depositIds = new Set((memoryState.securityDeposits || []).map((d: any) => d.id));
    memoryState.securityDepositTransactions = (memoryState.securityDepositTransactions || []).filter((sdt: any) => depositIds.has(sdt.depositId));
  }
}

export function persistFallbackState() {
  if (memoryState) {
    try {
      fs.writeFileSync(SERVER_DB_FILE, JSON.stringify(memoryState, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Server DB] Error persisting server-db.json:', e);
    }
  }
}

export async function startServer(customPort?: number) {
  await initializeFallbackState();

  const PORT = customPort || Number(process.env.PORT) || 3000;
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Public static uploads directory
  app.use('/uploads', express.static(UPLOADS_DIR));

  // CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-setup-secret, X-Idempotency-Key, x-idempotency-key');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  const apiRouter = express.Router();

  // 1. Health & Database Readiness Check
  apiRouter.get('/health', async (req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();
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

    const hasAdmin = process.env.DATABASE_URL
      ? await hasSuperAdminInDb()
      : (Array.isArray(memoryState?.users) && memoryState.users.some((u: any) => u.role === 'SUPER_ADMIN' && u.isActive));

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      database: dbHealth.connected ? 'postgresql_active' : (process.env.DATABASE_URL ? 'postgresql_connection_error' : 'unconfigured_local_preview'),
      databaseDetails: dbHealth.details,
      hasAdminInitialized: hasAdmin,
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

    try {
      let user: any = null;

      if (process.env.DATABASE_URL) {
        user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: { equals: username, mode: 'insensitive' } },
              { email: { equals: username, mode: 'insensitive' } }
            ]
          }
        });
      } else if (memoryState?.users) {
        user = memoryState.users.find((u: any) => u.username.toLowerCase() === username.toLowerCase() && u.isActive);
      }

      if (!user) {
        return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
      }

      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'تم تعطيل هذا الحساب. يرجى مراجعة إدارة النظام.' });
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
        allowedProperties: user.allowedProperties || ['all']
      };

      const token = generateToken(tokenPayload);

      await recordAuditLogInDb({
        userId: user.id,
        userName: `${user.name || user.username} (${user.role})`,
        action: 'تسجيل دخول ناجح',
        module: 'المصادقة والأمان',
        details: `تسجيل دخول مستخدم بصلاحية ${user.role}`,
        ipAddress: req.ip
      });

      return res.json({
        success: true,
        token,
        user: sanitizeUser(user)
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'فشل معالجة تسجيل الدخول.' });
    }
  });

  // Initial Admin Registration:
  // Requires ADMIN_SETUP_SECRET for initial setup, with strict DB lock preventing race conditions.
  apiRouter.post('/auth/register-admin', async (req: Request, res: Response) => {
    const { username, password, name, email, allowedProperties, setupSecret } = req.body;

    try {
      const hasAdmin = process.env.DATABASE_URL
        ? await hasSuperAdminInDb()
        : (Array.isArray(memoryState?.users) && memoryState.users.some((u: any) => u.role === 'SUPER_ADMIN' && u.isActive));

      if (hasAdmin) {
        // If an admin already exists, request MUST have a valid token from an existing SUPER_ADMIN
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;

        if (!token) {
          return res.status(403).json({
            success: false,
            code: 'SETUP_CLOSED',
            message: 'مرفوض: تم إعداد مسؤول النظام الرئيسي مسبقاً، والتهيئة العامة مغلقة تماماً. يتطلب تسجيل مسؤول جديد مصادقة بـ JWT مسؤول حالي.'
          });
        }

        const authReq: AuthenticatedRequest = req as any;
        return authenticateToken(authReq, res, async () => {
          if (authReq.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({
              success: false,
              code: 'FORBIDDEN',
              message: 'فقط المسؤول الرئيسي (SUPER_ADMIN) يملك صلاحية إنشاء حسابات إدارية جديدة.'
            });
          }
          await executeCreateAdmin();
        });
      }

      // Initial setup: Validate ADMIN_SETUP_SECRET if configured
      const expectedSecret = process.env.ADMIN_SETUP_SECRET;
      const providedSecret = req.headers['x-admin-setup-secret'] || setupSecret;
      if (expectedSecret && providedSecret !== expectedSecret) {
        return res.status(403).json({
          success: false,
          code: 'INVALID_SETUP_SECRET',
          message: 'مرفوض: رمز التهيئة الإدارية الأولية (ADMIN_SETUP_SECRET) غير صحيح.'
        });
      }

      await executeCreateAdmin();

      async function executeCreateAdmin() {
        if (!username || !password) {
          return res.status(400).json({ success: false, message: 'اسم المستخدم وكلمة المرور مطلوبان.' });
        }
        if (username.length < 3) {
          return res.status(400).json({ success: false, message: 'يجب أن يتكون اسم المستخدم من ٣ أحرف على الأقل.' });
        }
        if (password.length < 6) {
          return res.status(400).json({ success: false, message: 'يجب أن تتكون كلمة المرور من ٦ خانات على الأقل لضمان الأمان.' });
        }

        const hashedPassword = await hashPassword(password);

        if (process.env.DATABASE_URL) {
          const result = await prisma.$transaction(async (tx) => {
            // Concurrent race condition check inside transaction
            const count = await tx.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
            if (!hasAdmin && count > 0) {
              const err: any = new Error('تم إنشاء المسؤول الأول بالفعل بواسطة طلب متزامن.');
              err.statusCode = 409;
              throw err;
            }

            const existingUser = await tx.user.findFirst({
              where: {
                OR: [
                  { username: { equals: username, mode: 'insensitive' } },
                  { email: { equals: email || `${username}@luxuryhome.sa`, mode: 'insensitive' } }
                ]
              }
            });

            if (existingUser) {
              const err: any = new Error('اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً.');
              err.statusCode = 409;
              throw err;
            }

            const assignedRole = req.body.role || (hasAdmin ? 'PROPERTY_MANAGER' : 'SUPER_ADMIN');
            const newAdmin = await tx.user.create({
              data: {
                username,
                email: email || `${username}@luxuryhome.sa`,
                passwordHash: hashedPassword,
                name: name || username,
                role: assignedRole as any,
                allowedProperties: Array.isArray(allowedProperties) ? allowedProperties : ['all'],
                isActive: true
              }
            });

            return newAdmin;
          });

          const tokenPayload: TokenPayload = {
            userId: result.id,
            username: result.username,
            email: result.email,
            role: result.role,
            allowedProperties: result.allowedProperties
          };

          const token = generateToken(tokenPayload);

          await recordAuditLogInDb({
            userId: result.id,
            userName: result.username,
            action: 'إنشاء مسؤول نظام',
            module: 'الأمان والمسؤولين',
            details: `تم إنشاء الحساب الإداري (${result.username}) بصلاحية ${result.role}.`,
            ipAddress: req.ip
          });

          return res.json({
            success: true,
            message: 'تم إنشاء حساب المسؤول بنجاح.',
            token,
            user: sanitizeUser(result)
          });
        }

        // Fallback memory state
        const assignedRole = req.body.role || (hasAdmin ? 'PROPERTY_MANAGER' : 'SUPER_ADMIN');
        const newAdmin = {
          id: `usr_${Date.now()}`,
          username,
          email: email || `${username}@luxuryhome.sa`,
          passwordHash: hashedPassword,
          name: name || username,
          role: assignedRole,
          allowedProperties: Array.isArray(allowedProperties) ? allowedProperties : ['all'],
          isActive: true,
          createdAt: new Date().toISOString()
        };

        if (!memoryState.users) memoryState.users = [];
        memoryState.users.push(newAdmin);

        const tokenPayload: TokenPayload = {
          userId: newAdmin.id,
          username: newAdmin.username,
          email: newAdmin.email,
          role: newAdmin.role as any,
          allowedProperties: newAdmin.allowedProperties
        };

        const token = generateToken(tokenPayload);

        return res.json({
          success: true,
          message: 'تم إنشاء حساب المسؤول بنجاح.',
          token,
          user: sanitizeUser(newAdmin)
        });
      }
    } catch (err: any) {
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'فشل إنشاء الحساب.' });
    }
  });

  // Current session endpoint
  apiRouter.get('/auth/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.dbUser) {
        return res.json({ success: true, user: sanitizeUser(req.dbUser) });
      }
      return res.json({ success: true, user: req.user });
    } catch (err) {
      return res.json({ success: true, user: req.user });
    }
  });

  // Logout
  apiRouter.post('/auth/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    await recordAuditLogInDb({
      userId: req.user?.userId,
      userName: req.user?.username || 'مستخدم',
      action: 'تسجيل خروج',
      module: 'المصادقة والأمان',
      details: 'تسجيل الخروج من الجلسة',
      ipAddress: req.ip
    });
    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح.' });
  });

  // 3. Public APIs (Sanitized Public Content)
  apiRouter.get('/public/settings', async (req: Request, res: Response) => {
    if (process.env.DATABASE_URL) {
      const settings = await getCompanySettingsFromDb();
      if (settings) {
        return res.json({
          success: true,
          settings: {
            companyName: settings.companyName,
            companyNameEn: settings.companyNameEn,
            tagline: settings.tagline,
            logoUrl: settings.logoUrl,
            iconUrl: settings.iconUrl,
            phone: settings.phone,
            whatsapp: settings.whatsapp,
            email: settings.email,
            checkInTime: settings.checkInTime,
            checkOutTime: settings.checkOutTime,
            navigation: settings.navigation
          }
        });
      }
    }
    const settings = memoryState?.settings || {};
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

  apiRouter.get('/public/properties', async (req: Request, res: Response) => {
    if (process.env.DATABASE_URL) {
      const props = await getPropertiesFromDb();
      const activeProps = props.filter((p: any) => p.isActive !== false);
      const floors = activeProps.flatMap((p: any) => p.floors || []);
      return res.json({ success: true, properties: activeProps, floors });
    }
    const properties = (memoryState?.properties || []).filter((p: any) => p.isActive !== false);
    const allowedIds = new Set(properties.map((p: any) => p.id));
    const floors = (memoryState?.floors || []).filter((f: any) => allowedIds.has(f.propertyId));
    res.json({ success: true, properties, floors });
  });

  apiRouter.get('/public/units', async (req: Request, res: Response) => {
    if (process.env.DATABASE_URL) {
      const units = await getUnitsFromDb();
      return res.json({ success: true, units: units.filter((u: any) => u.publicationStatus !== 'archived') });
    }
    const units = (memoryState?.units || []).filter((u: any) => u.publicationStatus !== 'archived');
    res.json({ success: true, units });
  });

  // 4. Granular Protected APIs with RBAC
  // Properties API (Read & Mutations)
  apiRouter.get('/properties', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const allowed = user.role === 'SUPER_ADMIN' ? ['all'] : user.allowedProperties;
    if (process.env.DATABASE_URL) {
      const properties = await getPropertiesFromDb(allowed);
      const floors = properties.flatMap((p: any) => p.floors || []);
      return res.json({ success: true, properties, floors });
    }
    const isUniversal = allowed.includes('all');
    const filtered = isUniversal ? (memoryState?.properties || []) : (memoryState?.properties || []).filter((p: any) => allowed.includes(p.id));
    const allowedIds = new Set(filtered.map((p: any) => p.id));
    const floors = (memoryState?.floors || []).filter((f: any) => allowedIds.has(f.propertyId));
    res.json({ success: true, properties: filtered, floors });
  });

  apiRouter.post('/properties', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, code, address, city, district, floorsCount, unitsCount, totalAreaSqm, rooftopPayment, description, images, isActive } = req.body;
      if (!name || !code || !address || !district) {
        return res.status(400).json({ success: false, message: 'بيانات المبنى غير مكتملة (الاسم، الكود، العنوان، الحي مطلوبة).' });
      }

      if (process.env.DATABASE_URL) {
        const prop = await createPropertyInDb(req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول',
          action: 'إنشاء مبنى / عقار جديد',
          module: 'إدارة العقارات',
          details: `إنشاء المبنى ${name} (${code})`,
          ipAddress: req.ip
        });
        return res.json({ success: true, property: prop, floors: prop?.floors || [], message: 'تم حفظ المبنى بنجاح في قاعدة البيانات.' });
      }

      if (!memoryState.properties) memoryState.properties = [];
      if (!memoryState.floors) memoryState.floors = [];

      // Check duplicate code
      const duplicate = memoryState.properties.find((p: any) => p.code?.toLowerCase() === code.trim().toLowerCase());
      if (duplicate) {
        return res.status(409).json({ success: false, message: `كود تصنيف المبنى (${code}) مسجل لمبنى آخر سلفاً!` });
      }

      const propId = req.body.id || `prop_${Date.now()}`;
      const fCount = Math.max(1, Number(floorsCount) || 1);
      const newFloors = [
        { id: `flr_${propId}_b1`, propertyId: propId, number: -1, floorNumber: -1, name: 'طابق القبو الأول (مواقف سيارات)', label: 'القبو الأول' },
        { id: `flr_${propId}_0`, propertyId: propId, number: 0, floorNumber: 0, name: 'طابق الاستقبال (البهو والبهو المشترك)', label: 'البهو الأرضي' },
        ...Array.from({ length: fCount }, (_, i) => ({
          id: `flr_${propId}_${i + 1}`,
          propertyId: propId,
          number: i + 1,
          floorNumber: i + 1,
          name: `طابق الدور رقم ${i + 1}`,
          label: `الدور رقم ${i + 1}`
        }))
      ];

      const newProp = {
        id: propId,
        name: name.trim(),
        code: code.trim(),
        address: address.trim(),
        city: city || 'الرياض',
        district: district.trim(),
        floorsCount: fCount,
        unitsCount: Number(unitsCount) || 0,
        totalAreaSqm: Number(totalAreaSqm) || 0,
        rooftopPayment: Number(rooftopPayment) || 0,
        description: description || null,
        images: Array.isArray(images) ? images : [],
        isActive: isActive !== false,
        floors: newFloors,
        createdAt: new Date().toISOString()
      };

      memoryState.properties.push(newProp);
      memoryState.floors.push(...newFloors);
      persistFallbackState();

      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || 'المسؤول',
        action: 'إنشاء مبنى / عقار جديد',
        module: 'إدارة العقارات',
        details: `إنشاء المبنى ${name} (${code})`,
        ipAddress: req.ip
      });

      return res.json({ success: true, property: newProp, floors: newFloors, message: 'تم حفظ المبنى بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل حفظ المبنى.' });
    }
  });

  apiRouter.put('/properties/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), checkPropertyAccess, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
        const updated = await updatePropertyInDb(id, req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول',
          action: 'تعديل بيانات مبنى',
          module: 'إدارة العقارات',
          details: `تعديل المبنى ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, property: updated, message: 'تم تحديث بيانات المبنى بنجاح.' });
      }

      if (!memoryState.properties) memoryState.properties = [];
      const idx = memoryState.properties.findIndex((p: any) => p.id === id);
      if (idx !== -1) {
        memoryState.properties[idx] = { ...memoryState.properties[idx], ...req.body };
        persistFallbackState();
        return res.json({ success: true, property: memoryState.properties[idx], message: 'تم تحديث بيانات المبنى.' });
      }
      return res.status(404).json({ success: false, message: 'المبنى غير موجود.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل تحديث المبنى.' });
    }
  });

  apiRouter.put('/properties/:id/archive', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), checkPropertyAccess, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
        const updated = await updatePropertyInDb(id, { isActive: false });
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول',
          action: 'أرشفة مبنى / عقار',
          module: 'إدارة العقارات',
          details: `أرشفة المبنى ${id} مع الاحتفاظ بكافة السجلات والتعاقدات التاريخية`,
          ipAddress: req.ip
        });
        return res.json({ success: true, property: updated, message: 'تم أرشفة المبنى بنجاح مع الحفاظ على السجلات والتعاقدات التاريخية.' });
      }

      if (!memoryState.properties) memoryState.properties = [];
      const idx = memoryState.properties.findIndex((p: any) => p.id === id);
      if (idx !== -1) {
        memoryState.properties[idx] = { ...memoryState.properties[idx], isActive: false, status: 'unlisted' };
        persistFallbackState();
        return res.json({ success: true, property: memoryState.properties[idx], message: 'تم أرشفة المبنى بنجاح مع الحفاظ على السجلات التاريخية.' });
      }
      return res.status(404).json({ success: false, message: 'المبنى غير موجود.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل أرشفة المبنى.' });
    }
  });

  apiRouter.delete('/properties/:id', authenticateToken, requireRoles(['SUPER_ADMIN']), checkPropertyAccess, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
        // Enforce preserving historical records: prevent hard delete if allocations/leases exist
        const hasHistory = await prisma.unitAllocation.findFirst({
          where: { unit: { propertyId: id } }
        });
        if (hasHistory) {
          return res.status(400).json({
            success: false,
            message: 'لا يمكن الحذف النهائي للمبنى لوجود سجلات مالية أو تعاقدات تاريخية مرتبطة به. يرجى أرشفة المبنى بدلاً من حذفه للحفاظ على النزاهة المحاسبية والتاريخية.'
          });
        }

        await deletePropertyInDb(id);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول',
          action: 'حذف مبنى / عقار',
          module: 'إدارة العقارات',
          details: `حذف المبنى ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, message: 'تم حذف المبنى بنجاح.' });
      }

      const propUnits = (memoryState?.units || []).filter((u: any) => u.propertyId === id);
      const propUnitIds = new Set(propUnits.map((u: any) => u.id));
      const hasBookings = (memoryState?.bookings || []).some((b: any) => propUnitIds.has(b.unitId));
      const hasLeases = (memoryState?.leases || []).some((l: any) => propUnitIds.has(l.unitId));
      if (hasBookings || hasLeases) {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن الحذف النهائي للمبنى لوجود سجلات مالية أو تعاقدات تاريخية مرتبطة به. يرجى أرشفة المبنى بدلاً من حذفه للحفاظ على النزاهة المحاسبية والتاريخية.'
        });
      }

      if (memoryState.properties) {
        memoryState.properties = memoryState.properties.filter((p: any) => p.id !== id);
      }
      if (memoryState.floors) {
        memoryState.floors = memoryState.floors.filter((f: any) => f.propertyId !== id);
      }
      if (memoryState.units) {
        memoryState.units = memoryState.units.filter((u: any) => u.propertyId !== id);
      }
      persistFallbackState();
      return res.json({ success: true, message: 'تم حذف المبنى بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل حذف المبنى.' });
    }
  });

  // Floors API
  apiRouter.post('/floors', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { propertyId, number, name } = req.body;
      if (!propertyId || name === undefined) {
        return res.status(400).json({ success: false, message: 'معرف المبنى واسم الطابق مطلوبان.' });
      }

      const user = req.user!;
      if (user.role !== 'SUPER_ADMIN' && !user.allowedProperties?.includes(propertyId)) {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بإضافة طوابق في هذا العقار.' });
      }

      if (process.env.DATABASE_URL) {
        const floor = await createFloorInDb(propertyId, Number(number) || 1, name);
        return res.json({ success: true, floor, message: 'تم حفظ الطابق بنجاح.' });
      }

      if (!memoryState.floors) memoryState.floors = [];
      const newFloor = {
        id: `flr_${propertyId}_${Date.now()}`,
        propertyId,
        number: Number(number) || 1,
        floorNumber: Number(number) || 1,
        name,
        label: req.body.label || name
      };
      memoryState.floors.push(newFloor);
      persistFallbackState();
      return res.json({ success: true, floor: newFloor, message: 'تم حفظ الطابق بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل حفظ الطابق.' });
    }
  });

  apiRouter.put('/floors/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Floor Property Scoping
      if (user.role !== 'SUPER_ADMIN') {
        let floorPropId: string | null = null;
        if (process.env.DATABASE_URL) {
          const flr = await prisma.floor.findUnique({ where: { id } });
          floorPropId = flr?.propertyId || null;
        } else {
          const flr = (memoryState?.floors || []).find((f: any) => f.id === id);
          floorPropId = flr?.propertyId || null;
        }
        if (floorPropId && !user.allowedProperties?.includes(floorPropId)) {
          return res.status(403).json({ success: false, message: 'غير مصرح لك بتعديل طوابق هذا العقار.' });
        }
      }

      if (process.env.DATABASE_URL) {
        const updated = await updateFloorInDb(id, req.body);
        return res.json({ success: true, floor: updated, message: 'تم تحديث الطابق بنجاح.' });
      }

      if (!memoryState.floors) memoryState.floors = [];
      const idx = memoryState.floors.findIndex((f: any) => f.id === id);
      if (idx !== -1) {
        memoryState.floors[idx] = { ...memoryState.floors[idx], ...req.body };
        persistFallbackState();
        return res.json({ success: true, floor: memoryState.floors[idx], message: 'تم تحديث الطابق.' });
      }
      return res.status(404).json({ success: false, message: 'الطابق غير موجود.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل تحديث الطابق.' });
    }
  });

  apiRouter.delete('/floors/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Floor Property Scoping
      if (user.role !== 'SUPER_ADMIN') {
        let floorPropId: string | null = null;
        if (process.env.DATABASE_URL) {
          const flr = await prisma.floor.findUnique({ where: { id } });
          floorPropId = flr?.propertyId || null;
        } else {
          const flr = (memoryState?.floors || []).find((f: any) => f.id === id);
          floorPropId = flr?.propertyId || null;
        }
        if (floorPropId && !user.allowedProperties?.includes(floorPropId)) {
          return res.status(403).json({ success: false, message: 'غير مصرح لك بحذف طوابق هذا العقار.' });
        }
      }

      if (process.env.DATABASE_URL) {
        await deleteFloorInDb(id);
        return res.json({ success: true, message: 'تم حذف الطابق بنجاح.' });
      }

      if (memoryState.floors) {
        memoryState.floors = memoryState.floors.filter((f: any) => f.id !== id);
        persistFallbackState();
      }
      return res.json({ success: true, message: 'تم حذف الطابق بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل حذف الطابق.' });
    }
  });

  // Units API (Read & Mutations)
  apiRouter.get('/units', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const allowed = user.role === 'SUPER_ADMIN' ? ['all'] : user.allowedProperties;
    if (process.env.DATABASE_URL) {
      const units = await getUnitsFromDb(allowed);
      return res.json({ success: true, units });
    }
    const isUniversal = allowed.includes('all');
    const filtered = isUniversal ? (memoryState?.units || []) : (memoryState?.units || []).filter((u: any) => allowed.includes(u.propertyId));
    res.json({ success: true, units: filtered });
  });

  apiRouter.post('/units', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { propertyId, unitNumber } = req.body;
      if (!propertyId || !unitNumber) {
        return res.status(400).json({ success: false, message: 'معرف العقار ورقم الوحدة مطلوبان.' });
      }

      const user = req.user!;
      if (user.role !== 'SUPER_ADMIN' && !user.allowedProperties?.includes(propertyId)) {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بإضافة وحدات في هذا العقار.' });
      }

      if (process.env.DATABASE_URL) {
        const unit = await createUnitInDb(req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول',
          action: 'إنشاء وحدة سكنية جديدة',
          module: 'إدارة الوحدات',
          details: `إنشاء الوحدة ${unitNumber} في العقار ${propertyId}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, unit, message: 'تم حفظ الوحدة بنجاح في قاعدة البيانات.' });
      }

      // Check that property exists in fallback
      const prop = (memoryState?.properties || []).find((p: any) => p.id === propertyId);
      if (!prop) {
        return res.status(400).json({ success: false, message: 'المبنى المحدد غير موجود في قاعدة البيانات.' });
      }

      if (req.body.floorId) {
        const floor = (memoryState?.floors || []).find((f: any) => f.id === req.body.floorId);
        if (!floor) return res.status(400).json({ success: false, message: 'الطابق المحدد غير موجود في قاعدة البيانات.' });
        if (floor.propertyId !== propertyId) return res.status(400).json({ success: false, message: 'الطابق المحدد لا ينتمي إلى هذا المبنى.' });
      }

      // Check uniqueness in fallback
      const duplicateUnit = (memoryState?.units || []).some(
        (u: any) => u.propertyId === propertyId && String(u.unitNumber).trim() === String(unitNumber).trim() && u.publicationStatus !== 'archived'
      );
      if (duplicateUnit) {
        return res.status(409).json({ success: false, message: `شقة بالرقم "${unitNumber}" مسجلة ومحفوظة حالياً في نفس المبنى.` });
      }

      const newUnit = {
        id: req.body.id || `unit_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
        propertyId,
        floorId: req.body.floorId || null,
        unitNumber: String(unitNumber).trim(),
        title: req.body.title || `شقة منزل الفخامة رقم #${unitNumber}`,
        titleEn: req.body.titleEn || `Unit #${unitNumber}`,
        type: req.body.type || 'apartment',
        areaSqm: req.body.areaSqm !== undefined ? Number(req.body.areaSqm) : 0,
        floorNumber: req.body.floorNumber !== undefined ? Number(req.body.floorNumber) : 1,
        maxGuests: req.body.maxGuests !== undefined ? Number(req.body.maxGuests) : 3,
        bedroomsCount: req.body.bedroomsCount !== undefined ? Number(req.body.bedroomsCount) : 1,
        bathroomsCount: req.body.bathroomsCount !== undefined ? Number(req.body.bathroomsCount) : 1,
        bedsCount: req.body.bedsCount !== undefined ? Number(req.body.bedsCount) : 1,
        furnishingStatus: req.body.furnishingStatus || 'furnished',
        allowDaily: req.body.allowDaily !== false,
        dailyRate: req.body.dailyRate !== undefined ? Number(req.body.dailyRate) : 0,
        dailySecurityDeposit: req.body.dailySecurityDeposit !== undefined ? Number(req.body.dailySecurityDeposit) : 0,
        allowMonthly: req.body.allowMonthly !== false,
        monthlyRate: req.body.monthlyRate !== undefined ? Number(req.body.monthlyRate) : 0,
        monthlySecurityDeposit: req.body.monthlySecurityDeposit !== undefined ? Number(req.body.monthlySecurityDeposit) : 0,
        allowYearly: req.body.allowYearly !== false,
        annualRate: (req.body.annualRate !== undefined || req.body.yearlyRate !== undefined) ? Number(req.body.annualRate ?? req.body.yearlyRate) : 0,
        yearlyRate: (req.body.annualRate !== undefined || req.body.yearlyRate !== undefined) ? Number(req.body.annualRate ?? req.body.yearlyRate) : 0,
        yearlySecurityDeposit: req.body.yearlySecurityDeposit !== undefined ? Number(req.body.yearlySecurityDeposit) : 0,
        yearlyPaymentOptions: Array.isArray(req.body.yearlyPaymentOptions) ? req.body.yearlyPaymentOptions : ['single_annual', 'semi_annual'],
        semiAnnualSurchargePercent: req.body.semiAnnualSurchargePercent !== undefined ? Number(req.body.semiAnnualSurchargePercent) : 0,
        cleaningFee: req.body.cleaningFee !== undefined ? Number(req.body.cleaningFee) : 0,
        securityDeposit: req.body.securityDeposit !== undefined ? Number(req.body.securityDeposit) : 0,
        taxPercentage: req.body.taxPercentage !== undefined ? Number(req.body.taxPercentage) : 15,
        operationalStatus: req.body.operationalStatus || 'ready',
        occupancyStatus: req.body.occupancyStatus || 'vacant',
        isClean: req.body.isClean !== false,
        publicationStatus: req.body.publicationStatus || 'published',
        amenities: Array.isArray(req.body.amenities) ? req.body.amenities : [],
        images: Array.isArray(req.body.images) ? req.body.images : [],
        media: req.body.media || null,
        spaces: req.body.spaces || null,
        fittings: req.body.fittings || null,
        floorPlanUrl: req.body.floorPlanUrl || null,
        assignedParkingId: req.body.assignedParkingId || null,
        notes: req.body.notes || null,
        smartLockPin: req.body.smartLockPin || null,
        createdAt: new Date().toISOString()
      };

      if (!memoryState.units) memoryState.units = [];
      memoryState.units.push(newUnit);
      prop.unitsCount = (prop.unitsCount || 0) + 1;
      persistFallbackState();

      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || 'المسؤول',
        action: 'إنشاء وحدة سكنية جديدة',
        module: 'إدارة الوحدات',
        details: `إنشاء الوحدة ${unitNumber} في العقار ${propertyId}`,
        ipAddress: req.ip
      });

      return res.json({ success: true, unit: newUnit, message: 'تم حفظ الوحدة بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل حفظ الوحدة.' });
    }
  });

  // Batch Units Creation API (Transactional Single Request)
  apiRouter.post('/units/batch', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { propertyId, floorId, units, idempotencyKey } = req.body;
      if (!propertyId || !floorId || !Array.isArray(units) || units.length === 0) {
        return res.status(400).json({ success: false, message: 'معرف المبنى، الطابق، ومصفوفة الوحدات مطلوبة.' });
      }

      const user = req.user!;
      if (user.role !== 'SUPER_ADMIN' && !user.allowedProperties?.includes(propertyId)) {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بإضافة وحدات في هذا العقار.' });
      }

      // Check duplicates within incoming batch
      const unitNumbers = units.map(u => String(u.unitNumber).trim());
      const uniqueNumbers = new Set(unitNumbers);
      if (uniqueNumbers.size !== unitNumbers.length) {
        return res.status(400).json({ success: false, message: 'تحتوي المجموعة على أرقام وحدات مكررة ضمن نفس الطلب.' });
      }

      if (process.env.DATABASE_URL) {
        const createdUnits = await createBatchUnitsInDb({
          propertyId,
          floorId,
          units,
          idempotencyKey,
          userId: user.userId
        });

        await recordAuditLogInDb({
          userId: user.userId,
          userName: user.username || 'المسؤول',
          action: 'إنشاء وحدات بالجملة',
          module: 'إدارة الوحدات',
          details: `إنشاء عدد ${createdUnits?.length} وحدة في العقار ${propertyId}`,
          ipAddress: req.ip
        });

        return res.json({
          success: true,
          count: createdUnits?.length || 0,
          units: createdUnits,
          message: `تم إنشاء عدد ${createdUnits?.length} وحدة بنجاح ضمن معاملة واحدة.`
        });
      }

      // Fallback in-memory / JSON persistence
      const property = (memoryState?.properties || []).find((p: any) => p.id === propertyId);
      if (!property) {
        return res.status(400).json({ success: false, message: 'المبنى المحدد غير موجود في قاعدة البيانات.' });
      }

      const floor = (memoryState?.floors || []).find((f: any) => f.id === floorId);
      if (!floor) {
        return res.status(400).json({ success: false, message: 'الطابق المحدد غير موجود في قاعدة البيانات.' });
      }
      if (floor.propertyId !== propertyId) {
        return res.status(400).json({ success: false, message: 'الطابق المحدد لا ينتمي إلى هذا المبنى.' });
      }

      // Idempotency check in fallback with content fingerprint
      const normalizedPayload = JSON.stringify({
        propertyId,
        floorId,
        units: units.map(u => ({
          unitNumber: String(u.unitNumber).trim(),
          type: u.type,
          areaSqm: Number(u.areaSqm ?? 0),
          dailyRate: Number(u.dailyRate ?? 0),
          monthlyRate: Number(u.monthlyRate ?? 0),
          annualRate: Number(u.annualRate ?? u.yearlyRate ?? 0)
        }))
      });
      const requestHash = crypto.createHash('sha256').update(normalizedPayload).digest('hex');

      if (idempotencyKey) {
        if (!memoryState.idempotencyRecords) memoryState.idempotencyRecords = [];
        const existingRecord = memoryState.idempotencyRecords.find(
          (r: any) => r.key === idempotencyKey && r.operationType === 'batch_units_create'
        );

        if (existingRecord) {
          if (existingRecord.requestHash === requestHash) {
            return res.json({
              success: true,
              count: existingRecord.responseBody.length,
              units: existingRecord.responseBody,
              message: 'تم استرجاع المجموعة المنفذة مسبقاً (Idempotent).'
            });
          } else {
            return res.status(409).json({
              success: false,
              message: 'تعارض مفتاح منع التكرار: تم استخدام نفس المفتاح مع بيانات حمولة مختلفة.'
            });
          }
        }
      }

      // Check duplicates against existing units in this property
      const existingInProp = (memoryState?.units || []).filter(
        (u: any) => u.propertyId === propertyId && unitNumbers.includes(String(u.unitNumber).trim()) && u.publicationStatus !== 'archived'
      );
      if (existingInProp.length > 0) {
        const duplicateList = existingInProp.map((u: any) => u.unitNumber).join(', ');
        return res.status(409).json({
          success: false,
          message: `تعذر إنشاء المجموعة لوجود وحدات مسجلة سلفاً في المبنى بنفس الأرقام: (${duplicateList}). لم يتم حفظ أي وحدة.`
        });
      }

      if (!memoryState.units) memoryState.units = [];
      const now = new Date().toISOString();
      const createdBatch: any[] = [];

      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const newUnit = {
          id: `unit_${Date.now()}_${i}_${Math.floor(100 + Math.random() * 900)}`,
          propertyId,
          floorId,
          unitNumber: String(u.unitNumber).trim(),
          title: u.title || `شقة منزل الفخامة رقم #${u.unitNumber}`,
          titleEn: u.titleEn || `Unit #${u.unitNumber}`,
          type: u.type || 'apartment',
          areaSqm: u.areaSqm !== undefined ? Number(u.areaSqm) : 0,
          floorNumber: floor.number ?? floor.floorNumber ?? 1,
          maxGuests: u.maxGuests !== undefined ? Number(u.maxGuests) : 3,
          bedroomsCount: u.bedroomsCount !== undefined ? Number(u.bedroomsCount) : 1,
          bathroomsCount: u.bathroomsCount !== undefined ? Number(u.bathroomsCount) : 1,
          bedsCount: u.bedsCount !== undefined ? Number(u.bedsCount) : 1,
          furnishingStatus: u.furnishingStatus || 'furnished',
          allowDaily: u.allowDaily !== false,
          dailyRate: u.dailyRate !== undefined ? Number(u.dailyRate) : 0,
          dailySecurityDeposit: u.dailySecurityDeposit !== undefined ? Number(u.dailySecurityDeposit) : 0,
          allowMonthly: u.allowMonthly !== false,
          monthlyRate: u.monthlyRate !== undefined ? Number(u.monthlyRate) : 0,
          monthlySecurityDeposit: u.monthlySecurityDeposit !== undefined ? Number(u.monthlySecurityDeposit) : 0,
          allowYearly: u.allowYearly !== false,
          annualRate: (u.annualRate !== undefined || u.yearlyRate !== undefined) ? Number(u.annualRate ?? u.yearlyRate) : 0,
          yearlyRate: (u.annualRate !== undefined || u.yearlyRate !== undefined) ? Number(u.annualRate ?? u.yearlyRate) : 0,
          yearlySecurityDeposit: u.yearlySecurityDeposit !== undefined ? Number(u.yearlySecurityDeposit) : 0,
          yearlyPaymentOptions: Array.isArray(u.yearlyPaymentOptions) ? u.yearlyPaymentOptions : ['single_annual', 'semi_annual'],
          semiAnnualSurchargePercent: u.semiAnnualSurchargePercent !== undefined ? Number(u.semiAnnualSurchargePercent) : 0,
          cleaningFee: u.cleaningFee !== undefined ? Number(u.cleaningFee) : 0,
          securityDeposit: u.securityDeposit !== undefined ? Number(u.securityDeposit) : 0,
          taxPercentage: u.taxPercentage !== undefined ? Number(u.taxPercentage) : 15,
          operationalStatus: u.operationalStatus || 'ready',
          occupancyStatus: u.occupancyStatus || 'vacant',
          isClean: u.isClean !== false,
          publicationStatus: u.publicationStatus || 'published',
          amenities: Array.isArray(u.amenities) ? u.amenities : [],
          images: Array.isArray(u.images) ? u.images : [],
          media: u.media || null,
          spaces: u.spaces || null,
          fittings: u.fittings || null,
          floorPlanUrl: u.floorPlanUrl || null,
          assignedParkingId: u.assignedParkingId || null,
          notes: u.notes || null,
          smartLockPin: u.smartLockPin || null,
          createdAt: now
        };
        createdBatch.push(newUnit);
      }

      memoryState.units.push(...createdBatch);
      property.unitsCount = (property.unitsCount || 0) + createdBatch.length;

      if (idempotencyKey) {
        if (!memoryState.processedBatchKeys) memoryState.processedBatchKeys = [];
        memoryState.processedBatchKeys.push(idempotencyKey);
        if (!memoryState.idempotencyRecords) memoryState.idempotencyRecords = [];
        memoryState.idempotencyRecords.push({
          id: `idem_${Date.now()}`,
          key: idempotencyKey,
          operationType: 'batch_units_create',
          userId: user.userId,
          requestHash,
          statusCode: 200,
          responseBody: createdBatch,
          createdAt: now
        });
      }

      persistFallbackState();

      await recordAuditLogInDb({
        userId: user.userId,
        userName: user.username || 'المسؤول',
        action: 'إنشاء وحدات بالجملة',
        module: 'إدارة الوحدات',
        details: `إنشاء عدد ${createdBatch.length} وحدة في العقار ${propertyId}`,
        ipAddress: req.ip
      });

      return res.json({
        success: true,
        count: createdBatch.length,
        units: createdBatch,
        message: `تم إنشاء عدد ${createdBatch.length} وحدة بنجاح ضمن معاملة واحدة.`
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل إنشاء مجموعة الوحدات.' });
    }
  });

  apiRouter.put('/units/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Unit Property Scoping
      if (user.role !== 'SUPER_ADMIN') {
        let unitPropId: string | null = null;
        if (process.env.DATABASE_URL) {
          const u = await prisma.unit.findUnique({ where: { id } });
          unitPropId = u?.propertyId || null;
        } else {
          const u = (memoryState?.units || []).find((unit: any) => unit.id === id);
          unitPropId = u?.propertyId || null;
        }
        if (unitPropId && !user.allowedProperties?.includes(unitPropId)) {
          return res.status(403).json({ success: false, message: 'غير مصرح لك بإدارة وتعديل وحدات هذا العقار.' });
        }
      }

      if (process.env.DATABASE_URL) {
        const updated = await updateUnitInDb(id, req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول',
          action: 'تعديل بيانات وحدة',
          module: 'إدارة الوحدات',
          details: `تعديل الوحدة ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, unit: updated, message: 'تم تحديث بيانات الوحدة بنجاح.' });
      }

      if (!memoryState.units) memoryState.units = [];
      const idx = memoryState.units.findIndex((u: any) => u.id === id);
      if (idx !== -1) {
        const existing = memoryState.units[idx];
        if (req.body.unitNumber && String(req.body.unitNumber).trim() !== String(existing.unitNumber).trim()) {
          const duplicate = memoryState.units.some(
            (u: any) => u.id !== id && u.propertyId === existing.propertyId && String(u.unitNumber).trim() === String(req.body.unitNumber).trim() && u.publicationStatus !== 'archived'
          );
          if (duplicate) {
            return res.status(409).json({ success: false, message: `شقة بالرقم "${req.body.unitNumber}" مسجلة ومحفوظة حالياً في نفس المبنى.` });
          }
        }

        memoryState.units[idx] = {
          ...existing,
          ...req.body,
          annualRate: req.body.annualRate !== undefined ? req.body.annualRate : (req.body.yearlyRate !== undefined ? req.body.yearlyRate : existing.annualRate),
          yearlyRate: req.body.yearlyRate !== undefined ? req.body.yearlyRate : (req.body.annualRate !== undefined ? req.body.annualRate : existing.yearlyRate),
          updatedAt: new Date().toISOString()
        };
        persistFallbackState();
        return res.json({ success: true, unit: memoryState.units[idx], message: 'تم تحديث بيانات الوحدة بنجاح.' });
      }
      return res.status(404).json({ success: false, message: 'الوحدة غير موجودة.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل تحديث الوحدة.' });
    }
  });

  apiRouter.delete('/units/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Unit Property Scoping
      if (user.role !== 'SUPER_ADMIN') {
        let unitPropId: string | null = null;
        if (process.env.DATABASE_URL) {
          const u = await prisma.unit.findUnique({ where: { id } });
          unitPropId = u?.propertyId || null;
        } else {
          const u = (memoryState?.units || []).find((unit: any) => unit.id === id);
          unitPropId = u?.propertyId || null;
        }
        if (unitPropId && !user.allowedProperties?.includes(unitPropId)) {
          return res.status(403).json({ success: false, message: 'غير مصرح لك بحذف وحدات هذا العقار.' });
        }
      }

      if (process.env.DATABASE_URL) {
        await deleteUnitInDb(id);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول',
          action: 'حذف وحدة سكنية',
          module: 'إدارة الوحدات',
          details: `حذف الوحدة ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, message: 'تم حذف الوحدة بنجاح.' });
      }

      if (memoryState.units) {
        memoryState.units = memoryState.units.filter((u: any) => u.id !== id);
        persistFallbackState();
      }
      return res.json({ success: true, message: 'تم حذف الوحدة بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل حذف الوحدة.' });
    }
  });

  // Bookings API
  apiRouter.get('/bookings', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const allowed = user.role === 'SUPER_ADMIN' ? ['all'] : user.allowedProperties;
    if (process.env.DATABASE_URL) {
      const bookings = await getBookingsFromDb(allowed);
      return res.json({ success: true, bookings });
    }
    res.json({ success: true, bookings: memoryState?.bookings || [] });
  });

  // Leases API
  apiRouter.get('/leases', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const allowed = user.role === 'SUPER_ADMIN' ? ['all'] : user.allowedProperties;
    if (process.env.DATABASE_URL) {
      const leases = await getLeasesFromDb(allowed);
      return res.json({ success: true, leases });
    }
    res.json({ success: true, leases: memoryState?.leases || [] });
  });

  // Expenses API (Read & Mutations)
  apiRouter.get('/expenses', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const allowed = user.role === 'SUPER_ADMIN' ? ['all'] : user.allowedProperties;
    if (process.env.DATABASE_URL) {
      const expenses = await getExpensesFromDb(allowed);
      return res.json({ success: true, expenses });
    }
    res.json({ success: true, expenses: memoryState?.expenses || [] });
  });

  apiRouter.post('/expenses', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, amount, costCenterLevel, propertyId } = req.body;
      if (!title || amount === undefined) {
        return res.status(400).json({ success: false, message: 'عنوان المصروف وقيمته مطلوبان.' });
      }

      const user = req.user!;
      if (user.role === 'PROPERTY_MANAGER') {
        if (!propertyId || !user.allowedProperties?.includes(propertyId)) {
          return res.status(403).json({ success: false, message: 'غير مصرح لك بتسجيل مصاريف خارج نطاق العقارات المخصصة لك.' });
        }
      }

      if (process.env.DATABASE_URL) {
        const exp = await createExpenseInDb({
          ...req.body,
          createdById: req.user?.userId
        });
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول المالي',
          action: 'تسجيل مصروف تشغيلي',
          module: 'الإدارة المالية',
          details: `تسجيل مصروف ${title} بقيمة ${amount} ر.س`,
          ipAddress: req.ip
        });
        return res.json({ success: true, expense: exp, message: 'تم حفظ المصروف بنجاح في قاعدة البيانات.' });
      }

      const newExp = {
        id: req.body.id || `exp_${Date.now()}`,
        expenseNumber: `EXP-${Date.now().toString().slice(-6)}`,
        ...req.body,
        createdAt: new Date().toISOString()
      };
      if (!memoryState.expenses) memoryState.expenses = [];
      memoryState.expenses.push(newExp);
      persistFallbackState();

      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || 'المسؤول المالي',
        action: 'تسجيل مصروف تشغيلي',
        module: 'الإدارة المالية',
        details: `تسجيل مصروف ${title} بقيمة ${amount} ر.س`,
        ipAddress: req.ip
      });

      return res.json({ success: true, expense: newExp, message: 'تم حفظ المصروف بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل حفظ المصروف.' });
    }
  });

  apiRouter.put('/expenses/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Fetch real expense from DB or fallback first
      let realExpense: any = null;
      if (process.env.DATABASE_URL) {
        realExpense = await prisma.operationalExpense.findUnique({ where: { id } });
      } else {
        realExpense = (memoryState?.expenses || []).find((e: any) => e.id === id);
      }

      if (!realExpense) {
        return res.status(404).json({ success: false, message: 'المصروف غير موجود.' });
      }

      // Strict Property Manager Scoping based on REAL entity in DB
      if (user.role === 'PROPERTY_MANAGER') {
        if (!realExpense.propertyId) {
          return res.status(403).json({
            success: false,
            message: 'غير مصرح لمدير العقار بتعديل مصاريف عامة على مستوى الشركة.'
          });
        }
        if (!user.allowedProperties?.includes(realExpense.propertyId)) {
          return res.status(403).json({
            success: false,
            message: 'غير مصرح لك بتعديل مصاريف هذا العقار.'
          });
        }
        // If attempting to transfer to another property, check destination permissions
        if (req.body.propertyId && req.body.propertyId !== realExpense.propertyId) {
          if (!user.allowedProperties?.includes(req.body.propertyId)) {
            return res.status(403).json({
              success: false,
              message: 'غير مصرح لك بنقل المصروف إلى هذا العقار الهدف.'
            });
          }
        }
      }

      if (process.env.DATABASE_URL) {
        const updated = await updateExpenseInDb(id, req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول المالي',
          action: 'تعديل مصروف تشغيلي',
          module: 'الإدارة المالية',
          details: `تعديل المصروف ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, expense: updated, message: 'تم تحديث بيانات المصروف بنجاح.' });
      }

      if (!memoryState.expenses) memoryState.expenses = [];
      const idx = memoryState.expenses.findIndex((e: any) => e.id === id);
      if (idx !== -1) {
        memoryState.expenses[idx] = { ...memoryState.expenses[idx], ...req.body };
        persistFallbackState();
        return res.json({ success: true, expense: memoryState.expenses[idx], message: 'تم تحديث بيانات المصروف.' });
      }
      return res.status(404).json({ success: false, message: 'المصروف غير موجود.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل تحديث المصروف.' });
    }
  });

  apiRouter.delete('/expenses/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'ACCOUNTANT', 'PROPERTY_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Fetch real expense from DB or fallback first
      let realExpense: any = null;
      if (process.env.DATABASE_URL) {
        realExpense = await prisma.operationalExpense.findUnique({ where: { id } });
      } else {
        realExpense = (memoryState?.expenses || []).find((e: any) => e.id === id);
      }

      if (!realExpense) {
        return res.status(404).json({ success: false, message: 'المصروف غير موجود.' });
      }

      if (user.role === 'PROPERTY_MANAGER') {
        if (!realExpense.propertyId) {
          return res.status(403).json({
            success: false,
            message: 'غير مصرح لمدير العقار بحذف مصاريف عامة على مستوى الشركة.'
          });
        }
        if (!user.allowedProperties?.includes(realExpense.propertyId)) {
          return res.status(403).json({
            success: false,
            message: 'غير مصرح لك بحذف مصاريف هذا العقار.'
          });
        }
      }

      if (process.env.DATABASE_URL) {
        await deleteExpenseInDb(id);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول المالي',
          action: 'حذف مصروف تشغيلي',
          module: 'الإدارة المالية',
          details: `حذف المصروف ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, message: 'تم حذف المصروف بنجاح.' });
      }

      if (memoryState.expenses) {
        memoryState.expenses = memoryState.expenses.filter((e: any) => e.id !== id);
        persistFallbackState();
      }
      return res.json({ success: true, message: 'تم حذف المصروف بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل حذف المصروف.' });
    }
  });

  // Settings API Mutation
  apiRouter.put('/settings', authenticateToken, requireRoles(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (process.env.DATABASE_URL) {
        const updated = await updateCompanySettingsInDb(req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول',
          action: 'تحديث إعدادات وهوية المنشأة',
          module: 'الإعدادات العامة',
          details: 'تحديث إعدادات وهوية الشركة وساعات الدخول والموقع',
          ipAddress: req.ip
        });
        return res.json({ success: true, settings: updated, message: 'تم تحديث إعدادات وهوية المنشأة بنجاح في قاعدة البيانات.' });
      }

      memoryState.settings = { ...memoryState.settings, ...req.body };
      persistFallbackState();
      return res.json({ success: true, settings: memoryState.settings, message: 'تم تحديث إعدادات المنشأة بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل تحديث الإعدادات.' });
    }
  });

  // Media & Documents Upload API
  apiRouter.post('/media/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { base64Data, fileName, isPrivate, propertyId } = req.body;
      if (!base64Data || !fileName) {
        return res.status(400).json({ success: false, message: 'بيانات الملف واسم الملف مطلوبان.' });
      }

      const user = req.user!;
      if (isPrivate && propertyId && user.role === 'PROPERTY_MANAGER') {
        if (!user.allowedProperties?.includes(propertyId)) {
          return res.status(403).json({ success: false, message: 'غير مصرح لك برفع مستندات خاصة لهذا العقار.' });
        }
      }

      const safeName = `${Date.now()}_${path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const targetDir = isPrivate ? PRIVATE_DOCS_DIR : UPLOADS_DIR;
      const targetPath = path.join(targetDir, safeName);

      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      if (buffer.length > 15 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'حجم الملف يتجاوز الحد المسموح (15 ميغابايت).' });
      }

      fs.writeFileSync(targetPath, buffer);

      if (isPrivate) {
        if (process.env.DATABASE_URL) {
          await saveDocumentRecordInDb({
            fileName: safeName,
            originalName: fileName,
            fileSize: buffer.length,
            mimeType: req.body.mimeType || null,
            isPrivate: true,
            ownerUserId: user.userId,
            propertyId: propertyId || null,
            unitId: req.body.unitId || null,
            bookingId: req.body.bookingId || null,
            leaseId: req.body.leaseId || null,
            notes: req.body.notes || null
          });
        }
        if (!memoryState.privateDocs) memoryState.privateDocs = [];
        memoryState.privateDocs.push({
          fileName: safeName,
          originalName: fileName,
          fileSize: buffer.length,
          ownerUserId: user.userId,
          propertyId: propertyId || null,
          createdAt: new Date().toISOString()
        });
        persistFallbackState();
      }

      const publicUrl = isPrivate ? `/api/documents/private/${safeName}` : `/uploads/${safeName}`;

      return res.json({
        success: true,
        url: publicUrl,
        fileName: safeName,
        message: 'تم رفع وتأمين الملف بنجاح.'
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'فشل رفع الملف.' });
    }
  });

  // Full Protected State API (Aggregated from DB)
  apiRouter.get('/state', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const allowed = user.role === 'SUPER_ADMIN' ? ['all'] : user.allowedProperties;

    if (process.env.DATABASE_URL) {
      try {
        const [settings, properties, units, bookings, leases, expenses, auditLogs] = await Promise.all([
          getCompanySettingsFromDb(),
          getPropertiesFromDb(allowed),
          getUnitsFromDb(allowed),
          getBookingsFromDb(allowed),
          getLeasesFromDb(allowed),
          getExpensesFromDb(allowed),
          user.role === 'SUPER_ADMIN' ? getAuditLogsFromDb(100) : []
        ]);

        const floors = properties.flatMap((p: any) => p.floors || []);

        const securityDeposits = [
          ...bookings.flatMap((b: any) => (b.securityDeposits || []).map((sd: any) => ({
            id: sd.id,
            bookingId: b.id,
            leaseId: null,
            guestName: b.guestName,
            bookingOrLeaseId: b.id,
            amount: Number(sd.amount),
            collectedAmount: Number(sd.collectedAmount),
            collectionReference: sd.collectionReference,
            collectionVerifiedAt: sd.collectionVerifiedAt,
            status: sd.status,
            heldType: b.paymentStatus === 'paid_online' ? 'authorized_hold' : 'cash_or_transfer',
            deductions: (sd.transactions || []).filter((t: any) => t.type === 'deduction' || t.type === 'rent_application').map((t: any) => ({
              id: t.id,
              amount: Number(t.amount),
              reason: t.reason,
              deductedAt: t.executedAt,
              approvedBy: t.executedByUserId || 'النظام',
            })),
            createdAt: sd.createdAt
          }))),
          ...leases.flatMap((l: any) => (l.securityDeposits || []).map((sd: any) => ({
            id: sd.id,
            bookingId: null,
            leaseId: l.id,
            guestName: l.tenantName,
            bookingOrLeaseId: l.id,
            amount: Number(sd.amount),
            collectedAmount: Number(sd.collectedAmount),
            collectionReference: sd.collectionReference,
            collectionVerifiedAt: sd.collectionVerifiedAt,
            status: sd.status,
            heldType: 'cash_or_transfer',
            deductions: (sd.transactions || []).filter((t: any) => t.type === 'deduction' || t.type === 'rent_application').map((t: any) => ({
              id: t.id,
              amount: Number(t.amount),
              reason: t.reason,
              deductedAt: t.executedAt,
              approvedBy: t.executedByUserId || 'النظام',
            })),
            createdAt: sd.createdAt
          })))
        ];

        const payments = [
          ...leases.flatMap((l: any) => (l.payments || []).map((p: any) => ({
            id: p.id,
            receiptNumber: p.receiptNo || `REC-${p.id.slice(-6)}`,
            referenceId: l.id,
            amount: Number(p.amount),
            method: p.paymentMethod,
            notes: p.notes,
            createdAt: p.paidAt,
          }))),
          ...bookings.flatMap((b: any) => (b.payments || []).map((p: any) => ({
            id: p.id,
            receiptNumber: p.receiptNo || `REC-${p.id.slice(-6)}`,
            referenceId: b.id,
            amount: Number(p.amount),
            method: p.paymentMethod,
            notes: p.notes,
            createdAt: p.paidAt,
          })))
        ];

        return res.json({
          success: true,
          state: {
            settings,
            properties,
            floors,
            units,
            bookings,
            leases,
            expenses,
            securityDeposits,
            payments,
            auditLogs,
            users: undefined // Never return user list with hashes
          },
          timestamp: Date.now()
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, message: 'فشل تحميل بيانات النظام من قاعدة البيانات.' });
      }
    }

    // Fallback
    res.json({
      success: true,
      state: {
        ...memoryState,
        floors: memoryState?.floors || []
      },
      timestamp: Date.now()
    });
  });

  // 5. Unified Reservation & Lease API with Atomic Overlap Prevention
  apiRouter.post('/bookings/daily', async (req: Request, res: Response) => {
    try {
      const result = await processDailyReservation(req.body);

      await recordAuditLogInDb({
        userName: req.body.guestName || 'حجز إلكتروني',
        action: 'حجز يومي جديد',
        module: 'الحجوزات الفندقية',
        details: `حجز يومي للوحدة ${req.body.unitId} للنزيل ${req.body.guestName} بقيمة ${result.totalAmount} ر.س.`
      });

      return res.json({
        success: true,
        message: 'تم تسجيل الحجز وإقفال الفترة لمنع أي تداخل متزامن.',
        ...result
      });
    } catch (err: any) {
      const status = err.statusCode || 400;
      return res.status(status).json({ success: false, message: err.message || 'فشل تسجيل الحجز.' });
    }
  });

  apiRouter.post('/leases/contract', async (req: Request, res: Response) => {
    try {
      const result = await processLeaseContract(req.body);

      await recordAuditLogInDb({
        userName: req.body.tenantName || 'عقد إيجار',
        action: 'عقد تأجير جديد',
        module: 'عقود الإيجار',
        details: `عقد إيجار ${req.body.rentalType === 'annual' ? 'سنوي' : 'شهري'} للوحدة ${req.body.unitId} للمستأجر ${req.body.tenantName}.`
      });

      return res.json({
        success: true,
        message: 'تم اعتماد عقد الإيجار بنجاح وجدولة الأقساط وحجز كامل فترة العقد.',
        ...result
      });
    } catch (err: any) {
      const status = err.statusCode || 400;
      return res.status(status).json({ success: false, message: err.message || 'فشل تسجيل عقد الإيجار.' });
    }
  });

  // Legacy Check & Reserve compatibility endpoint
  apiRouter.post('/bookings/check-and-reserve', async (req: Request, res: Response) => {
    try {
      const { unitId, startDate, endDate, guestName, rentalType, totalAmount } = req.body;

      if (!unitId || !startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'معلومات الحجز غير مكتملة.' });
      }

      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();

      if (isNaN(start) || isNaN(end) || start >= end) {
        return res.status(400).json({ success: false, message: 'تواريخ الحجز غير صالحة.' });
      }

      // Check conflict against memory state
      if (!memoryState.bookings) memoryState.bookings = [];
      if (!memoryState.allocations) memoryState.allocations = [];

      const existingBookings = (memoryState.bookings || []).filter((b: any) => b.unitId === unitId && b.status !== 'cancelled');
      const existingAllocations = (memoryState.allocations || []).filter((a: any) => a.unitId === unitId && a.status === 'active');

      const hasConflict = existingBookings.some((b: any) => {
        const bStart = new Date(b.startDate || b.checkIn).getTime();
        const bEnd = new Date(b.endDate || b.checkOut).getTime();
        return (start < bEnd && end > bStart);
      }) || existingAllocations.some((a: any) => {
        const aStart = new Date(a.startDate).getTime();
        const aEnd = new Date(a.endDate).getTime();
        return (start < aEnd && end > aStart);
      });

      if (hasConflict) {
        return res.status(409).json({
          success: false,
          conflict: true,
          message: 'عذراً، هذه الوحدة محجوزة بالفعل في الفترة المحددة.'
        });
      }

      if (process.env.DATABASE_URL) {
        const result = await processDailyReservation({
          unitId,
          checkIn: startDate,
          checkOut: endDate,
          guestName: guestName || 'عميل حجز',
          guestPhone: req.body.guestPhone || '+966500000000'
        });
        return res.json({
          success: true,
          booking: result.booking,
          allocation: result.allocation,
          message: 'تم تأكيد الحجز وإقفال الفترة الزمنية لمنع أي تداخل متزامن.'
        });
      }

      // Memory registration
      const bookingNumber = `LH-${Math.floor(100000 + Math.random() * 900000)}`;
      const newBooking = {
        id: `bk_${Date.now()}`,
        bookingNumber,
        unitId,
        guestName: guestName || 'عميل حجز',
        startDate,
        endDate,
        rentalType: rentalType || 'daily',
        totalAmount: totalAmount || 850,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };

      const newAllocation = {
        id: `alloc_${Date.now()}`,
        unitId,
        startDate,
        endDate,
        rentalType: (rentalType || 'daily').toUpperCase(),
        referenceId: bookingNumber,
        purpose: 'booking',
        status: 'active'
      };

      memoryState.bookings.push(newBooking);
      memoryState.allocations.push(newAllocation);

      if (!memoryState.securityDeposits) memoryState.securityDeposits = [];
      const newDeposit = {
        id: `sd_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        bookingId: newBooking.id,
        amount: 1000,
        collectedAmount: 0,
        collectionReference: null,
        collectionVerifiedAt: null,
        status: 'held',
        refundedAmount: 0,
        deductedAmount: 0,
        createdAt: new Date().toISOString()
      };
      memoryState.securityDeposits.push(newDeposit);

      return res.json({
        success: true,
        booking: newBooking,
        allocation: newAllocation,
        message: 'تم تأكيد الحجز وإقفال الفترة الزمنية لمنع أي تداخل متزامن.'
      });
    } catch (err: any) {
      const status = err.statusCode || 409;
      return res.status(status).json({
        success: false,
        conflict: true,
        message: err.message || 'عذراً، هذه الوحدة محجوزة بالفعل في الفترة المحددة.'
      });
    }
  });

  // Booking Cancellation Endpoint with Strict Multi-Tenant RBAC & Security Validation
  apiRouter.post('/bookings/:id/cancel', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // 1. Fetch real booking and associated unit/property from DB or memory
      let bookingRecord: any = null;
      let unitPropertyId: string | null = null;

      if (process.env.DATABASE_URL) {
        bookingRecord = await prisma.booking.findUnique({
          where: { id },
          include: { unit: true }
        });
        if (bookingRecord?.unit) {
          unitPropertyId = bookingRecord.unit.propertyId;
        }
      } else {
        bookingRecord = (memoryState?.bookings || []).find((b: any) => b.id === id);
        if (bookingRecord) {
          const unit = (memoryState?.units || []).find((u: any) => u.id === bookingRecord.unitId);
          unitPropertyId = unit?.propertyId || null;
        }
      }

      if (!bookingRecord) {
        return res.status(404).json({ success: false, message: 'الحجز المطلوب إلغاؤه غير موجود.' });
      }

      // 2. Strict Role & Property Authorization Verification (Never trust client body)
      if (user.role === 'SUPER_ADMIN') {
        // Super Admin is always authorized
      } else if (user.role === 'PROPERTY_MANAGER') {
        if (!unitPropertyId || !user.allowedProperties?.includes(unitPropertyId)) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN_PROPERTY_ACCESS',
            message: 'غير مصرح لمدير العقار بإلغاء حجز يتبع مبنى خارج نطاق صلاحياته المعتمدة.'
          });
        }
      } else if (user.role === 'TENANT') {
        const isOwner = (bookingRecord.userId && bookingRecord.userId === user.userId) ||
                        (bookingRecord.guestEmail && bookingRecord.guestEmail === user.email) ||
                        (bookingRecord.guestPhone && bookingRecord.guestPhone === user.phone);
        if (!isOwner) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN_TENANT_ACCESS',
            message: 'غير مصرح للمستأجر بإلغاء حجز يخص عميلاً آخر.'
          });
        }

        // Validate cancellation policy for tenant (e.g. cannot cancel occupied or past check-in)
        const checkInTime = new Date(bookingRecord.startDate || bookingRecord.checkIn).getTime();
        if (Date.now() >= checkInTime) {
          return res.status(400).json({
            success: false,
            message: 'لا يمكن للمستأجر إلغاء الحجز ذاتياً بعد حلول موعد أو بدء فترة الإشغال.'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          code: 'ROLE_NOT_AUTHORIZED',
          message: 'ليس لديك الصلاحية لإلغاء الحجوزات في النظام.'
        });
      }

      // 3. State machine validation & Idempotency
      const currentStatus = String(bookingRecord.status).toLowerCase();
      if (currentStatus === 'cancelled') {
        return res.json({
          success: true,
          booking: bookingRecord,
          alreadyCancelled: true,
          message: 'هذا الحجز ملغى بالفعل ومحرر سلفاً.'
        });
      }

      if (currentStatus === 'checked_in' || currentStatus === 'checked_out') {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن إلغاء حجز بدأ إشغاله أو مكتمل بالفعل.'
        });
      }

      // 4. Execute atomic cancellation & allocation release
      if (process.env.DATABASE_URL) {
        const cancelled = await cancelBooking(id);
        await recordAuditLogInDb({
          userId: user.userId,
          userName: `${user.username || 'المستخدم'} (${user.role})`,
          action: 'إلغاء حجز معتمد',
          module: 'إدارة الحجوزات',
          details: `إلغاء الحجز رقم ${id} وتحرير تخصيص الوحدة ونقل التأمين إلى حالة بانتظار الاسترداد`,
          ipAddress: req.ip
        });
        return res.json({ success: true, booking: cancelled, message: 'تم إلغاء الحجز بنجاح وتحرير الفترة للوحدة.' });
      }

      // Fallback in-memory cancellation
      bookingRecord.status = 'cancelled';
      if (memoryState.allocations) {
        memoryState.allocations.forEach((a: any) => {
          if (a.referenceId === bookingRecord.id || a.referenceId === bookingRecord.bookingNumber) {
            a.status = 'cancelled';
          }
        });
      }

      // Move held deposits to pending_refund in fallback (never auto-refund)
      if (memoryState.securityDeposits) {
        memoryState.securityDeposits.forEach((sd: any) => {
          if (sd.bookingId === bookingRecord.id && sd.status === 'held') {
            sd.status = 'pending_refund';
          }
        });
      }
      persistFallbackState();

      await recordAuditLogInDb({
        userId: user.userId,
        userName: `${user.username || 'المستخدم'} (${user.role})`,
        action: 'إلغاء حجز معتمد',
        module: 'إدارة الحجوزات',
        details: `إلغاء الحجز رقم ${id} وتحرير تخصيص الوحدة ونقل التأمين إلى حالة بانتظار الاسترداد`,
        ipAddress: req.ip
      });

      return res.json({ success: true, booking: bookingRecord, message: 'تم إلغاء الحجز بنجاح وتحرير الفترة للوحدة.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل إلغاء الحجز.' });
    }
  });

  // Security Deposit Processing & Refund Endpoint (Explicit Financial Action)
  apiRouter.post(
    '/security-deposits/:id/refund',
    authenticateToken,
    requireRoles(['SUPER_ADMIN', 'ACCOUNTANT', 'PROPERTY_MANAGER']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'تسجيل الدخول مطلوب.',
          });
        }

        const body = req.body;

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return res.status(400).json({
            success: false,
            message: 'صيغة الطلب غير صالحة.',
          });
        }

        if (Object.prototype.hasOwnProperty.call(
          body,
          'providerConfirmation',
        )) {
          return res.status(400).json({
            success: false,
            message: 'لا يُقبل تأكيد مزود الدفع من المتصفح.',
          });
        }

        const result = await refundDeposit({
          depositId: req.params.id,
          actorId: req.user.userId,
          idempotencyKey: req.get('X-Idempotency-Key'),
          refundAmount: body.refundAmount,
          deductedAmount: body.deductedAmount,
          deductionReason: body.deductionReason,
          refundMethod: body.refundMethod,
          refundReference: body.refundReference,
          refundType: body.refundType,
        });

        return res.status(200).json(result);
      } catch (error: unknown) {
        if (error instanceof RefundError) {
          return res.status(error.statusCode).json({
            success: false,
            message: error.message,
          });
        }

        console.error('[Deposit refund failed]', {
          errorType: error instanceof Error
            ? error.name
            : 'UnknownError',
        });

        return res.status(503).json({
          success: false,
          message:
            'تعذر إتمام العملية. أعد المحاولة بمفتاح العملية نفسه.',
        });
      }
    },
  );

  // Security Deposit Settle against Lease Rent Endpoint (Explicit Financial Action)
  apiRouter.post(
    '/security-deposits/:id/apply-to-rent',
    authenticateToken,
    requireRoles(['SUPER_ADMIN', 'ACCOUNTANT', 'PROPERTY_MANAGER']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'تسجيل الدخول مطلوب.',
          });
        }

        const body = req.body;

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return res.status(400).json({
            success: false,
            message: 'صيغة الطلب غير صالحة.',
          });
        }

        const result = await applyDepositToRent({
          depositId: req.params.id,
          installmentId: body.installmentId,
          amount: body.amount,
          reason: body.reason,
          actorId: req.user.userId,
          idempotencyKey: req.get('X-Idempotency-Key') || body?.idempotencyKey,
        });

        return res.status(200).json(result);
      } catch (error: unknown) {
        if (error instanceof RefundError) {
          return res.status(error.statusCode).json({
            success: false,
            message: error.message,
          });
        }

        console.error('[Apply deposit to rent failed]', {
          errorType: error instanceof Error
            ? error.name
            : 'UnknownError',
        });

        return res.status(503).json({
          success: false,
          message:
            'تعذر إتمام العملية. أعد المحاولة بمفتاح العملية نفسه.',
        });
      }
    },
  );

  // 6. Cost Allocation & Financial Distribution Engine Endpoint
  apiRouter.post('/financials/allocate', (req: Request, res: Response) => {
    try {
      const result = computeCostAllocation(req.body);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  apiRouter.post('/financials/calculate-distribution', (req: Request, res: Response) => {
    try {
      const { buildingRent, guardSalary, adminSalary, electricityBill, directMaintenance, units, allocationMethod } = req.body;

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

  // Tenant Account Statement API with strict role & ownership authorization
  apiRouter.get('/financials/statement/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      if (process.env.DATABASE_URL) {
        const lease = await prisma.lease.findFirst({
          where: { OR: [{ id }, { contractNumber: id }, { unitId: id }] },
          include: {
            unit: { include: { property: true } },
            installments: { orderBy: { number: 'asc' } },
            payments: { orderBy: { paidAt: 'desc' } },
            securityDeposits: true
          }
        });

        if (!lease) {
          return res.status(404).json({ success: false, message: 'لم يتم العثور على عقد أو كشف حساب للبيانات المحددة.' });
        }

        // Authorization check
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        const isPropertyAllowed = Array.isArray(user.allowedProperties) && (user.allowedProperties.includes('all') || user.allowedProperties.includes(lease.unit?.propertyId));
        const isTenantOwner = (user.role === 'TENANT' && (user.email === lease.tenantEmail || user.userId === lease.tenantIdNumber));

        if (!isSuperAdmin && !isPropertyAllowed && !isTenantOwner) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'غير مصرح لك بعرض كشف الحساب المالي لهذا العقد.'
          });
        }

        const totalRent = Number(lease.annualRent);
        const totalPaid = lease.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalDeposit = lease.securityDeposits.reduce((sum, d) => sum + Number(d.amount), 0);

        return res.json({
          success: true,
          statement: {
            contractNumber: lease.contractNumber,
            tenantName: lease.tenantName,
            tenantPhone: lease.tenantPhone,
            tenantEmail: lease.tenantEmail,
            unitNumber: lease.unit?.unitNumber,
            propertyName: lease.unit?.property?.name,
            startDate: lease.startDate,
            endDate: lease.endDate,
            rentalType: lease.rentalType,
            totalRent,
            totalPaid,
            remainingBalance: Math.max(0, totalRent - totalPaid),
            securityDeposit: {
              totalHeld: totalDeposit,
              status: lease.securityDeposits[0]?.status || 'held'
            },
            installments: serializeDecimals(lease.installments),
            payments: serializeDecimals(lease.payments)
          }
        });
      }

      const lease = (memoryState?.leases || []).find((l: any) => l.id === id || l.contractNumber === id || l.unitId === id);
      if (!lease) {
        return res.status(404).json({ success: false, message: 'لم يتم العثور على عقد أو كشف حساب للبيانات المحددة.' });
      }

      return res.json({ success: true, statement: lease });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'فشل توليد كشف الحساب.' });
    }
  });

  // 7. Protected Data Import Endpoint with Transactional Execution & Exact Statistics
  apiRouter.post('/admin/import-data', authenticateToken, requireRoles(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
    const { mode, payload } = req.body;
    const dataToImport = payload || memoryState;

    if (!dataToImport || typeof dataToImport !== 'object') {
      return res.status(400).json({ success: false, message: 'البيانات المراد استيرادها غير صالحة.' });
    }

    const properties = Array.isArray(dataToImport.properties) ? dataToImport.properties : [];
    const units = Array.isArray(dataToImport.units) ? dataToImport.units : [];
    const bookings = Array.isArray(dataToImport.bookings) ? dataToImport.bookings : [];
    const leases = Array.isArray(dataToImport.leases) ? dataToImport.leases : [];
    const expenses = Array.isArray(dataToImport.expenses) ? dataToImport.expenses : [];

    const previewSummary = {
      properties: { total: properties.length, newRecords: properties.length, duplicatesSkipped: 0 },
      units: { total: units.length, newRecords: units.length, duplicatesSkipped: 0 },
      bookings: { total: bookings.length, newRecords: bookings.length, duplicatesSkipped: 0 },
      leases: { total: leases.length, newRecords: leases.length, duplicatesSkipped: 0 },
      expenses: { total: expenses.length, newRecords: expenses.length, duplicatesSkipped: 0 }
    };

    if (mode === 'preview') {
      return res.json({
        success: true,
        mode: 'preview',
        message: 'تمت معاينة وحصر السجلات بنجاح.',
        preview: previewSummary
      });
    }

    if (mode === 'commit') {
      try {
        let importedStats: any = null;

        if (process.env.DATABASE_URL) {
          importedStats = await importDataIntoDb(dataToImport);
        } else {
          memoryState = {
            ...memoryState,
            ...dataToImport
          };
          importedStats = previewSummary;
        }

        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || 'المسؤول',
          action: 'استيراد بيانات منضبط',
          module: 'إدارة البيانات والترحيل',
          details: `استيراد واعتماد بيانات تشغيلية جديدة في قاعدة البيانات.`
        });

        return res.json({
          success: true,
          mode: 'commit',
          message: 'تم اعتماد واستيراد البيانات بنجاح في قاعدة البيانات.',
          imported: importedStats
        });
      } catch (importErr: any) {
        return res.status(500).json({ success: false, message: `فشل استيراد البيانات: ${importErr.message}` });
      }
    }

    return res.status(400).json({ success: false, message: 'وضع الاستيراد يجب أن يكون preview أو commit.' });
  });

  // 8. Protected Private Documents Endpoint with Path Traversal Defense & Ownership Verification
  apiRouter.get('/documents/private/:docName', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const safeDocName = path.basename(req.params.docName);
    const docPath = path.join(PRIVATE_DOCS_DIR, safeDocName);

    if (!docPath.startsWith(PRIVATE_DOCS_DIR)) {
      return res.status(403).json({ success: false, message: 'مسار مستند غير مصرح به.' });
    }

    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ success: false, message: 'المستند غير موجود.' });
    }

    // Ownership and RBAC Verification: Super Admins access all; others must own the doc or manage its property
    const user = req.user!;
    if (user.role !== 'SUPER_ADMIN') {
      let docRecord: any = null;
      if (process.env.DATABASE_URL) {
        docRecord = await getDocumentRecordFromDb(safeDocName);
      } else {
        docRecord = (memoryState?.privateDocs || []).find((d: any) => d.fileName === safeDocName);
      }

      if (!docRecord) {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بالوصول لهذا المستند الخاص أو غير مسجل.' });
      }

      if (user.role === 'PROPERTY_MANAGER') {
        if (!docRecord.propertyId || !user.allowedProperties?.includes(docRecord.propertyId)) {
          return res.status(403).json({ success: false, message: 'غير مصرح لك بالوصول لمستندات هذا العقار.' });
        }
      } else if (user.role === 'TENANT') {
        if (!docRecord.ownerUserId || docRecord.ownerUserId !== user.userId) {
          return res.status(403).json({ success: false, message: 'غير مصرح لك بالوصول لمستند مستأجر آخر.' });
        }
      } else {
        if (!docRecord.ownerUserId || docRecord.ownerUserId !== user.userId) {
          return res.status(403).json({ success: false, message: 'غير مصرح لك بالوصول لهذا المستند الخاص.' });
        }
      }
    }

    res.sendFile(docPath);
  });

  // 9. Protected Real Backup Export & Restore (Complete with DB Data & Static Files)
  apiRouter.post('/backup/export', authenticateToken, requireRoles(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
    const backupFileName = `backup_${Date.now()}.json`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    try {
      let stateToExport: any = null;
      if (process.env.DATABASE_URL) {
        stateToExport = await exportFullDatabase();
      } else {
        const fullMemoryExport: any = {
          metadata: {
            exportedAt: new Date().toISOString(),
            version: '2.0.0',
            schema: 'MemoryFallback-LuxuryHome'
          },
          settings: memoryState.settings || {
            companyName: 'Luxury home منزل الفخامة',
            companyNameEn: 'Luxury Home'
          }
        };
        for (const collName of REQUIRED_FULL_BACKUP_COLLECTIONS) {
          fullMemoryExport[collName] = Array.isArray(memoryState[collName]) ? memoryState[collName] : [];
        }
        stateToExport = fullMemoryExport;
      }

      // Read files from uploads and private_docs
      const filesPayload: { uploads: Record<string, string>; private_docs: Record<string, string> } = {
        uploads: {},
        private_docs: {}
      };

      if (fs.existsSync(UPLOADS_DIR)) {
        const uFiles = fs.readdirSync(UPLOADS_DIR);
        for (const uf of uFiles) {
          const fp = path.join(UPLOADS_DIR, uf);
          if (fs.statSync(fp).isFile()) {
            filesPayload.uploads[uf] = fs.readFileSync(fp).toString('base64');
          }
        }
      }

      if (fs.existsSync(PRIVATE_DOCS_DIR)) {
        const pFiles = fs.readdirSync(PRIVATE_DOCS_DIR);
        for (const pf of pFiles) {
          const fp = path.join(PRIVATE_DOCS_DIR, pf);
          if (fs.statSync(fp).isFile()) {
            filesPayload.private_docs[pf] = fs.readFileSync(fp).toString('base64');
          }
        }
      }

      const backupPackage = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        data: stateToExport,
        files: filesPayload
      };

      fs.writeFileSync(backupFilePath, JSON.stringify(backupPackage, null, 2), 'utf-8');

      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || 'المسؤول',
        action: 'تصدير نسخة احتياطية',
        module: 'النسخ الاحتياطي',
        details: `تصدير نسخة احتياطية جديدة كاملة: ${backupFileName}`
      });

      res.json({
        success: true,
        message: 'تم إنشاء وحفظ النسخة الاحتياطية الشاملة بنجاح.',
        backupFile: backupFileName,
        timestamp: new Date().toISOString()
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: `فشل إنشاء ملف النسخة الاحتياطية: ${e?.message}` });
    }
  });

  apiRouter.post('/backup/restore', authenticateToken, requireRoles(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
    const { backupFileName } = req.body;
    if (!backupFileName) return res.status(400).json({ success: false, message: 'اسم ملف النسخة الاحتياطية مطلوب.' });

    const safeFileName = path.basename(backupFileName);
    const backupFilePath = path.join(BACKUP_DIR, safeFileName);

    if (!backupFilePath.startsWith(BACKUP_DIR) || !fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, message: 'ملف النسخة الاحتياطية غير موجود.' });
    }

    try {
      const rawData = fs.readFileSync(backupFilePath, 'utf-8');
      const parsedPackage = JSON.parse(rawData);
      const restored = parsedPackage.data || parsedPackage;

      // Always validate package integrity before any database or memory state mutation
      const validation = validateBackupPackageIntegrity(restored);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: `تم رفض استعادة النسخة الاحتياطية لعدم اكتمالها أو وجود أخطاء في بنيتها: ${validation.errors.join(' | ')}`
        });
      }

      if (process.env.DATABASE_URL) {
        await restoreFullDatabaseInDb(restored);
      } else {
        memoryState = restored;
        persistFallbackState();
      }

      // Restore files into uploads and private_docs
      if (parsedPackage.files) {
        if (parsedPackage.files.uploads) {
          if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
          for (const [fname, b64] of Object.entries(parsedPackage.files.uploads as Record<string, string>)) {
            const dest = path.join(UPLOADS_DIR, path.basename(fname));
            fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
          }
        }
        if (parsedPackage.files.private_docs) {
          if (!fs.existsSync(PRIVATE_DOCS_DIR)) fs.mkdirSync(PRIVATE_DOCS_DIR, { recursive: true });
          for (const [fname, b64] of Object.entries(parsedPackage.files.private_docs as Record<string, string>)) {
            const dest = path.join(PRIVATE_DOCS_DIR, path.basename(fname));
            fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
          }
        }
      }

      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || 'المسؤول',
        action: 'استعادة نسخة احتياطية',
        module: 'النسخ الاحتياطي',
        details: `استعادة حالة النظام والملفات بالكامل من الملف: ${safeFileName}`
      });

      res.json({
        success: true,
        message: 'تمت استعادة البيانات والملفات بنجاح من النسخة الاحتياطية إلى قاعدة البيانات والبيئة.',
        timestamp: new Date().toISOString()
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: `فشل قراءة واستعادة ملف النسخة الاحتياطية: ${e?.message}` });
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
