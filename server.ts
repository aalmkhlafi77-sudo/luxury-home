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
import {
  serializeDecimals,
  getCompanySettingsFromDb,
  updateCompanySettingsInDb,
  getPropertiesFromDb,
  createPropertyInDb,
  updatePropertyInDb,
  deletePropertyInDb,
  getUnitsFromDb,
  createUnitInDb,
  updateUnitInDb,
  deleteUnitInDb,
  getBookingsFromDb,
  getLeasesFromDb,
  getExpensesFromDb,
  createExpenseInDb,
  updateExpenseInDb,
  deleteExpenseInDb,
  getAuditLogsFromDb,
  recordAuditLogInDb,
  importDataIntoDb,
  exportFullDatabase
} from './src/server/repository.js';
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

// Standalone in-memory fallback cache only if DATABASE_URL is not set
let memoryState: any = null;

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
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-setup-secret');
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

            const newAdmin = await tx.user.create({
              data: {
                username,
                email: email || `${username}@luxuryhome.sa`,
                passwordHash: hashedPassword,
                name: name || username,
                role: 'SUPER_ADMIN',
                allowedProperties: allowedProperties || ['all'],
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
            details: `تم إنشاء الحساب الإداري (${result.username}) وإغلاق مسار التهيئة.`,
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
        const newAdmin = {
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
      return res.json({ success: true, properties: props.filter((p: any) => p.isActive !== false) });
    }
    const properties = (memoryState?.properties || []).filter((p: any) => p.isActive !== false);
    res.json({ success: true, properties });
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
      return res.json({ success: true, properties });
    }
    const isUniversal = allowed.includes('all');
    const filtered = isUniversal ? (memoryState?.properties || []) : (memoryState?.properties || []).filter((p: any) => allowed.includes(p.id));
    res.json({ success: true, properties: filtered });
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
        return res.json({ success: true, property: prop, message: 'تم حفظ المبنى بنجاح في قاعدة البيانات.' });
      }

      const newProp = {
        id: req.body.id || `prop_${Date.now()}`,
        name,
        code,
        address,
        city: city || 'الرياض',
        district,
        floorsCount: Number(floorsCount) || 1,
        unitsCount: Number(unitsCount) || 0,
        totalAreaSqm: Number(totalAreaSqm) || 0,
        rooftopPayment: Number(rooftopPayment) || 0,
        description: description || null,
        images: Array.isArray(images) ? images : [],
        isActive: isActive !== false,
        createdAt: new Date().toISOString()
      };
      if (!memoryState.properties) memoryState.properties = [];
      memoryState.properties.push(newProp);
      return res.json({ success: true, property: newProp, message: 'تم حفظ المبنى بنجاح.' });
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
        return res.json({ success: true, property: memoryState.properties[idx], message: 'تم تحديث بيانات المبنى.' });
      }
      return res.status(404).json({ success: false, message: 'المبنى غير موجود.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل تحديث المبنى.' });
    }
  });

  apiRouter.delete('/properties/:id', authenticateToken, requireRoles(['SUPER_ADMIN']), checkPropertyAccess, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
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

      if (memoryState.properties) {
        memoryState.properties = memoryState.properties.filter((p: any) => p.id !== id);
      }
      return res.json({ success: true, message: 'تم حذف المبنى بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل حذف المبنى.' });
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

      const newUnit = {
        id: req.body.id || `unit_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString()
      };
      if (!memoryState.units) memoryState.units = [];
      memoryState.units.push(newUnit);
      return res.json({ success: true, unit: newUnit, message: 'تم حفظ الوحدة بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل حفظ الوحدة.' });
    }
  });

  apiRouter.put('/units/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
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
        memoryState.units[idx] = { ...memoryState.units[idx], ...req.body };
        return res.json({ success: true, unit: memoryState.units[idx], message: 'تم تحديث بيانات الوحدة.' });
      }
      return res.status(404).json({ success: false, message: 'الوحدة غير موجودة.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل تحديث الوحدة.' });
    }
  });

  apiRouter.delete('/units/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
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
      const { title, amount, costCenterLevel } = req.body;
      if (!title || amount === undefined) {
        return res.status(400).json({ success: false, message: 'عنوان المصروف وقيمته مطلوبان.' });
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
      return res.json({ success: true, expense: newExp, message: 'تم حفظ المصروف بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل حفظ المصروف.' });
    }
  });

  apiRouter.put('/expenses/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
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
        return res.json({ success: true, expense: memoryState.expenses[idx], message: 'تم تحديث بيانات المصروف.' });
      }
      return res.status(404).json({ success: false, message: 'المصروف غير موجود.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل تحديث المصروف.' });
    }
  });

  apiRouter.delete('/expenses/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'ACCOUNTANT']), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
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
      return res.json({ success: true, settings: memoryState.settings, message: 'تم تحديث إعدادات المنشأة بنجاح.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'فشل تحديث الإعدادات.' });
    }
  });

  // Media & Documents Upload API
  apiRouter.post('/media/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { base64Data, fileName, isPrivate } = req.body;
      if (!base64Data || !fileName) {
        return res.status(400).json({ success: false, message: 'بيانات الملف واسم الملف مطلوبان.' });
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

        return res.json({
          success: true,
          state: {
            settings,
            properties,
            units,
            bookings,
            leases,
            expenses,
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
      state: memoryState,
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

  // 8. Protected Private Documents Endpoint with Path Traversal Defense
  apiRouter.get('/documents/private/:docName', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    const safeDocName = path.basename(req.params.docName);
    const docPath = path.join(PRIVATE_DOCS_DIR, safeDocName);

    if (!docPath.startsWith(PRIVATE_DOCS_DIR)) {
      return res.status(403).json({ success: false, message: 'مسار مستند غير مصرح به.' });
    }

    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ success: false, message: 'المستند غير موجود.' });
    }

    res.sendFile(docPath);
  });

  // 9. Protected Real Backup Export & Restore
  apiRouter.post('/backup/export', authenticateToken, requireRoles(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
    const backupFileName = `backup_${Date.now()}.json`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    try {
      let stateToExport: any = null;
      if (process.env.DATABASE_URL) {
        stateToExport = await exportFullDatabase();
      } else {
        stateToExport = memoryState;
      }

      fs.writeFileSync(backupFilePath, JSON.stringify(stateToExport, null, 2), 'utf-8');

      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || 'المسؤول',
        action: 'تصدير نسخة احتياطية',
        module: 'النسخ الاحتياطي',
        details: `تصدير نسخة احتياطية جديدة: ${backupFileName}`
      });

      res.json({
        success: true,
        message: 'تم إنشاء وحفظ النسخة الاحتياطية بنجاح.',
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
      const data = fs.readFileSync(backupFilePath, 'utf-8');
      const restored = JSON.parse(data);

      if (process.env.DATABASE_URL) {
        await importDataIntoDb(restored);
      } else {
        memoryState = restored;
      }

      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || 'المسؤول',
        action: 'استعادة نسخة احتياطية',
        module: 'النسخ الاحتياطي',
        details: `استعادة حالة النظام من الملف: ${safeFileName}`
      });

      res.json({
        success: true,
        message: 'تمت استعادة البيانات بنجاح من النسخة الاحتياطية إلى قاعدة البيانات.',
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
