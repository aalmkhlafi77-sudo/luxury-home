// server.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import path2 from "path";
import fs from "fs";

// src/server/auth.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// src/server/db.ts
import { PrismaClient, Role } from "@prisma/client";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});
async function checkDatabaseHealth() {
  if (!process.env.DATABASE_URL) {
    return {
      connected: false,
      type: "postgresql",
      details: "DATABASE_URL environment variable is not defined"
    };
  }
  try {
    await prisma.$queryRaw`SELECT 1 as health_check`;
    return {
      connected: true,
      type: "postgresql",
      details: "PostgreSQL connection verified active"
    };
  } catch (error) {
    return {
      connected: false,
      type: "postgresql",
      details: error?.message || "Failed to connect to PostgreSQL"
    };
  }
}
async function hasSuperAdminInDb() {
  try {
    const adminCount = await prisma.user.count({
      where: {
        role: Role.SUPER_ADMIN,
        isActive: true
      }
    });
    return adminCount > 0;
  } catch (err) {
    return false;
  }
}
var LEGACY_DB_FILE = path.resolve(__dirname, "../../server-db.json");

// src/server/auth.ts
var IS_PROD = process.env.NODE_ENV === "production";
var JWT_SECRET = process.env.JWT_SECRET || "";
if (IS_PROD && !JWT_SECRET) {
  const errMsg = "CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is required in production mode.";
  console.error(`[Security Fatal] ${errMsg}`);
  if (process.env.TEST_SUITE_RUNNER !== "true") {
    throw new Error(errMsg);
  }
  JWT_SECRET = "luxury_home_test_secret_key_fixed_for_isolated_test_runner";
} else if (!JWT_SECRET) {
  JWT_SECRET = "luxury_home_dev_session_secret_" + crypto.randomBytes(16).toString("hex");
}
var TOKEN_EXPIRY = "24h";
async function hashPassword(plainText) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}
async function verifyPassword(plainText, hashed) {
  if (!plainText || !hashed) return false;
  return bcrypt.compare(plainText, hashed);
}
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}
function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    phone: user.phone || null,
    role: user.role,
    allowedProperties: user.allowedProperties || ["all"],
    isActive: Boolean(user.isActive),
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt
  };
}
async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader && authHeader.trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      message: "\u0645\u0637\u0644\u0648\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0648\u062A\u0648\u0641\u064A\u0631 \u0631\u0645\u0632 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0627\u0644\u0645\u0639\u062A\u0645\u062F \u0644\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629."
    });
  }
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({
      success: false,
      code: "TOKEN_INVALID_OR_EXPIRED",
      message: "\u0631\u0645\u0632 \u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u062A\u0647. \u064A\u0631\u062C\u0649 \u0625\u0639\u0627\u062F\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644."
    });
  }
  if (process.env.DATABASE_URL) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId }
      });
      if (!dbUser) {
        return res.status(401).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0635\u0627\u062D\u0628 \u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0623\u0648 \u062A\u0645 \u062D\u0630\u0641\u0647."
        });
      }
      if (!dbUser.isActive) {
        return res.status(403).json({
          success: false,
          code: "ACCOUNT_DEACTIVATED",
          message: "\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629. \u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u0634\u0631\u0641."
        });
      }
      payload.role = dbUser.role;
      payload.allowedProperties = dbUser.allowedProperties || [];
      req.dbUser = dbUser;
    } catch (dbErr) {
      if (IS_PROD) {
        return res.status(503).json({
          success: false,
          code: "DATABASE_UNAVAILABLE",
          message: "\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0647\u0648\u064A\u0629 \u0648\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0633\u0628\u0628 \u062A\u0639\u0637\u0644 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A."
        });
      }
      console.warn("[Auth] Database check error during token auth:", dbErr?.message);
    }
  }
  req.user = payload;
  next();
}
function requireRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "\u0645\u0637\u0644\u0648\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A."
      });
    }
    if (req.user.role === "SUPER_ADMIN") {
      return next();
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        code: "INSUFFICIENT_PERMISSIONS",
        message: `\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0643\u0627\u0641\u064A\u0629 \u0644\u0644\u0648\u0635\u0648\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631 (\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0645\u0637\u0644\u0648\u0628: ${allowedRoles.join(", ")}).`
      });
    }
    next();
  };
}
function checkPropertyAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: "\u0645\u0637\u0644\u0648\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644." });
  if (req.user.role === "SUPER_ADMIN") return next();
  const propertyId = req.params.propertyId || req.body.propertyId || req.query.propertyId;
  if (!propertyId) return next();
  const allowed = req.user.allowedProperties || [];
  if (allowed.includes("all") || allowed.includes(String(propertyId))) {
    return next();
  }
  return res.status(403).json({
    success: false,
    code: "PROPERTY_ACCESS_DENIED",
    message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u062F\u0627\u0631\u0629 \u0623\u0648 \u0639\u0631\u0636 \u0628\u064A\u0627\u0646\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631 \u0627\u0644\u0645\u062D\u062F\u062F."
  });
}

// src/server/repository.ts
import { Decimal } from "@prisma/client/runtime/library";
function serializeDecimals(obj) {
  if (obj === null || obj === void 0) return obj;
  if (obj instanceof Decimal) return Number(obj.toString());
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeDecimals);
  if (typeof obj === "object") {
    const result = {};
    for (const key of Object.keys(obj)) {
      result[key] = serializeDecimals(obj[key]);
    }
    return result;
  }
  return obj;
}
async function getCompanySettingsFromDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    let settings = await prisma.companySettings.findUnique({
      where: { id: "default" }
    });
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          id: "default",
          companyName: "Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629",
          companyNameEn: "Luxury Home",
          tagline: "\u062A\u062C\u0631\u0628\u0629 \u0633\u0643\u0646\u064A\u0629 \u0641\u0627\u062E\u0631\u0629 \u062A\u062F\u0645\u062C \u0628\u064A\u0646 \u062E\u0635\u0648\u0635\u064A\u0629 \u0627\u0644\u0645\u0646\u0632\u0644 \u0648\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0636\u064A\u0627\u0641\u0629 \u0627\u0644\u0631\u0627\u0642\u064A\u0629",
          phone: "+966 11 000 0000",
          whatsapp: "+966 50 000 0000",
          email: "vip@luxuryhome.sa",
          crNumber: "1010000000",
          taxNumber: "300000000000003",
          nationalAddress: "\u0627\u0644\u0631\u064A\u0627\u0636 - \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
          checkInTime: "15:00",
          checkOutTime: "12:00"
        }
      });
    }
    return serializeDecimals(settings);
  } catch (e) {
    return null;
  }
}
async function updateCompanySettingsInDb(data) {
  if (!process.env.DATABASE_URL) return null;
  const updated = await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {
      companyName: data.companyName,
      companyNameEn: data.companyNameEn,
      tagline: data.tagline,
      logoUrl: data.logoUrl,
      iconUrl: data.iconUrl,
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      crNumber: data.crNumber,
      taxNumber: data.taxNumber,
      nationalAddress: data.nationalAddress,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      navigation: data.navigation,
      themeConfig: data.themeConfig
    },
    create: {
      id: "default",
      ...data
    }
  });
  return serializeDecimals(updated);
}
async function getPropertiesFromDb(allowedPropertyIds) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes("all");
  const properties = await prisma.property.findMany({
    where: isUniversal ? {} : { id: { in: allowedPropertyIds } },
    include: {
      floors: { orderBy: { number: "asc" } },
      units: { orderBy: { unitNumber: "asc" } },
      parkingSpots: true
    },
    orderBy: { createdAt: "asc" }
  });
  return serializeDecimals(properties);
}
async function createPropertyInDb(data) {
  if (!process.env.DATABASE_URL) return null;
  const created = await prisma.property.create({
    data: {
      name: data.name,
      code: data.code,
      address: data.address,
      city: data.city || "\u0627\u0644\u0631\u064A\u0627\u0636",
      district: data.district,
      floorsCount: Number(data.floorsCount) || 1,
      unitsCount: Number(data.unitsCount) || 0,
      totalAreaSqm: Number(data.totalAreaSqm) || 0,
      rooftopPayment: new Decimal(data.rooftopPayment || 0),
      description: data.description || null,
      images: Array.isArray(data.images) ? data.images : [],
      isActive: data.isActive !== false
    },
    include: { floors: true, units: true, parkingSpots: true }
  });
  return serializeDecimals(created);
}
async function updatePropertyInDb(id, data) {
  if (!process.env.DATABASE_URL) return null;
  const updateData = {};
  if (data.name !== void 0) updateData.name = data.name;
  if (data.code !== void 0) updateData.code = data.code;
  if (data.address !== void 0) updateData.address = data.address;
  if (data.city !== void 0) updateData.city = data.city;
  if (data.district !== void 0) updateData.district = data.district;
  if (data.floorsCount !== void 0) updateData.floorsCount = Number(data.floorsCount);
  if (data.unitsCount !== void 0) updateData.unitsCount = Number(data.unitsCount);
  if (data.totalAreaSqm !== void 0) updateData.totalAreaSqm = Number(data.totalAreaSqm);
  if (data.rooftopPayment !== void 0) updateData.rooftopPayment = new Decimal(data.rooftopPayment);
  if (data.description !== void 0) updateData.description = data.description;
  if (data.images !== void 0) updateData.images = Array.isArray(data.images) ? data.images : [];
  if (data.isActive !== void 0) updateData.isActive = Boolean(data.isActive);
  const updated = await prisma.property.update({
    where: { id },
    data: updateData,
    include: { floors: true, units: true, parkingSpots: true }
  });
  return serializeDecimals(updated);
}
async function deletePropertyInDb(id) {
  if (!process.env.DATABASE_URL) return null;
  const activeAllocations = await prisma.unitAllocation.findFirst({
    where: {
      unit: { propertyId: id },
      status: "active",
      endDate: { gte: /* @__PURE__ */ new Date() }
    }
  });
  if (activeAllocations) {
    throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0639\u0642\u0627\u0631 \u0644\u0648\u062C\u0648\u062F \u0648\u062D\u062F\u0627\u062A \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u062D\u062C\u0648\u0632\u0627\u062A \u0623\u0648 \u0639\u0642\u0648\u062F \u0625\u064A\u062C\u0627\u0631 \u0646\u0634\u0637\u0629 \u062D\u0627\u0644\u064A\u0627\u064B.");
  }
  const deleted = await prisma.property.delete({
    where: { id }
  });
  return serializeDecimals(deleted);
}
async function getUnitsFromDb(allowedPropertyIds) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes("all");
  const units = await prisma.unit.findMany({
    where: isUniversal ? {} : { propertyId: { in: allowedPropertyIds } },
    include: {
      property: true,
      floor: true,
      allocations: {
        where: { status: "active", endDate: { gte: /* @__PURE__ */ new Date() } }
      }
    },
    orderBy: { unitNumber: "asc" }
  });
  return serializeDecimals(units);
}
async function createUnitInDb(data) {
  if (!process.env.DATABASE_URL) return null;
  const existing = await prisma.unit.findFirst({
    where: {
      propertyId: data.propertyId,
      unitNumber: data.unitNumber
    }
  });
  if (existing) {
    throw new Error(`\u0627\u0644\u0648\u062D\u062F\u0629 \u0631\u0642\u0645 (${data.unitNumber}) \u0645\u0648\u062C\u0648\u062F\u0629 \u0645\u0633\u0628\u0642\u0627\u064B \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631.`);
  }
  const created = await prisma.unit.create({
    data: {
      propertyId: data.propertyId,
      floorId: data.floorId || null,
      unitNumber: data.unitNumber,
      type: data.type || "apartment",
      areaSqm: Number(data.areaSqm) || 0,
      dailyRate: new Decimal(data.dailyRate || 0),
      monthlyRate: new Decimal(data.monthlyRate || 0),
      annualRate: new Decimal(data.annualRate || 0),
      occupancyStatus: data.occupancyStatus || "vacant",
      isClean: data.isClean !== false,
      publicationStatus: data.publicationStatus || "published",
      images: Array.isArray(data.images) ? data.images : [],
      spaces: data.spaces || null,
      fittings: data.fittings || null,
      smartLockPin: data.smartLockPin || null
    },
    include: { property: true, floor: true }
  });
  await prisma.property.update({
    where: { id: data.propertyId },
    data: { unitsCount: { increment: 1 } }
  }).catch(() => {
  });
  return serializeDecimals(created);
}
async function updateUnitInDb(id, data) {
  if (!process.env.DATABASE_URL) return null;
  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
  if (data.unitNumber && data.unitNumber !== existing.unitNumber) {
    const duplicate = await prisma.unit.findFirst({
      where: {
        id: { not: id },
        propertyId: data.propertyId || existing.propertyId,
        unitNumber: data.unitNumber
      }
    });
    if (duplicate) {
      throw new Error(`\u0627\u0644\u0648\u062D\u062F\u0629 \u0631\u0642\u0645 (${data.unitNumber}) \u0645\u0633\u062C\u0644\u0629 \u0633\u0644\u0641\u0627\u064B \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0639\u0642\u0627\u0631.`);
    }
  }
  const updateData = {};
  if (data.floorId !== void 0) updateData.floorId = data.floorId || null;
  if (data.unitNumber !== void 0) updateData.unitNumber = data.unitNumber;
  if (data.type !== void 0) updateData.type = data.type;
  if (data.areaSqm !== void 0) updateData.areaSqm = Number(data.areaSqm);
  if (data.dailyRate !== void 0) updateData.dailyRate = new Decimal(data.dailyRate);
  if (data.monthlyRate !== void 0) updateData.monthlyRate = new Decimal(data.monthlyRate);
  if (data.annualRate !== void 0) updateData.annualRate = new Decimal(data.annualRate);
  if (data.occupancyStatus !== void 0) updateData.occupancyStatus = data.occupancyStatus;
  if (data.isClean !== void 0) updateData.isClean = Boolean(data.isClean);
  if (data.publicationStatus !== void 0) updateData.publicationStatus = data.publicationStatus;
  if (data.images !== void 0) updateData.images = Array.isArray(data.images) ? data.images : [];
  if (data.spaces !== void 0) updateData.spaces = data.spaces;
  if (data.fittings !== void 0) updateData.fittings = data.fittings;
  if (data.smartLockPin !== void 0) updateData.smartLockPin = data.smartLockPin;
  const updated = await prisma.unit.update({
    where: { id },
    data: updateData,
    include: { property: true, floor: true }
  });
  return serializeDecimals(updated);
}
async function deleteUnitInDb(id) {
  if (!process.env.DATABASE_URL) return null;
  const activeAlloc = await prisma.unitAllocation.findFirst({
    where: { unitId: id, status: "active", endDate: { gte: /* @__PURE__ */ new Date() } }
  });
  if (activeAlloc) {
    throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0623\u0648 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0648\u062D\u062F\u0629 \u0644\u0648\u062C\u0648\u062F \u062D\u062C\u0632 \u0623\u0648 \u0639\u0642\u062F \u0646\u0634\u0637 \u0645\u0631\u062A\u0628\u0637 \u0628\u0647\u0627.");
  }
  const unit = await prisma.unit.findUnique({ where: { id } });
  const deleted = await prisma.unit.delete({ where: { id } });
  if (unit?.propertyId) {
    await prisma.property.update({
      where: { id: unit.propertyId },
      data: { unitsCount: { decrement: 1 } }
    }).catch(() => {
    });
  }
  return serializeDecimals(deleted);
}
async function getBookingsFromDb(allowedPropertyIds) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes("all");
  const bookings = await prisma.booking.findMany({
    where: isUniversal ? {} : { unit: { propertyId: { in: allowedPropertyIds } } },
    include: {
      unit: { include: { property: true } },
      payments: true
    },
    orderBy: { createdAt: "desc" }
  });
  return serializeDecimals(bookings);
}
async function getLeasesFromDb(allowedPropertyIds) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes("all");
  const leases = await prisma.lease.findMany({
    where: isUniversal ? {} : { unit: { propertyId: { in: allowedPropertyIds } } },
    include: {
      unit: { include: { property: true } },
      installments: { orderBy: { number: "asc" } },
      securityDeposits: true,
      payments: true
    },
    orderBy: { createdAt: "desc" }
  });
  return serializeDecimals(leases);
}
async function getExpensesFromDb(allowedPropertyIds) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes("all");
  const expenses = await prisma.operationalExpense.findMany({
    where: isUniversal ? {} : {
      OR: [
        { propertyId: null },
        { propertyId: { in: allowedPropertyIds } }
      ]
    },
    include: {
      property: true,
      unit: true,
      allocations: { include: { unit: true } },
      payments: true
    },
    orderBy: { expenseDate: "desc" }
  });
  return serializeDecimals(expenses);
}
async function createExpenseInDb(data) {
  if (!process.env.DATABASE_URL) return null;
  const expenseNumber = `EXP-${Date.now().toString().slice(-6)}`;
  const now = /* @__PURE__ */ new Date();
  const start = data.startDate ? new Date(data.startDate) : now;
  const end = data.endDate ? new Date(data.endDate) : now;
  const created = await prisma.operationalExpense.create({
    data: {
      expenseNumber,
      title: data.title,
      amount: new Decimal(data.amount),
      costCenterLevel: data.costCenterLevel || "PROPERTY",
      propertyId: data.propertyId || null,
      unitId: data.unitId || null,
      categoryCode: data.categoryCode || "OPERATIONS_OTHER",
      subcategory: data.subcategory || null,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : now,
      startDate: start,
      endDate: end,
      temporalType: data.temporalType || "NONE",
      allocationMethod: data.allocationMethod || "EQUAL_UNITS",
      status: data.status || "approved",
      isCapitalAsset: Boolean(data.isCapitalAsset),
      notes: data.notes || null,
      createdById: data.createdById || null,
      allocations: data.allocations && data.allocations.length > 0 ? {
        create: data.allocations.map((a) => ({
          unitId: a.unitId,
          shareAmount: new Decimal(a.shareAmount),
          percentage: Number(a.percentage) || 0,
          monthPeriod: a.monthPeriod || now.toISOString().slice(0, 7)
        }))
      } : void 0,
      payments: data.payments && data.payments.length > 0 ? {
        create: data.payments.map((p) => ({
          amount: new Decimal(p.amount),
          paymentMethod: p.paymentMethod || "bank_transfer",
          referenceNo: p.referenceNo || null,
          notes: p.notes || null
        }))
      } : void 0
    },
    include: {
      property: true,
      unit: true,
      allocations: { include: { unit: true } },
      payments: true
    }
  });
  return serializeDecimals(created);
}
async function updateExpenseInDb(id, data) {
  if (!process.env.DATABASE_URL) return null;
  const updateData = {};
  if (data.title !== void 0) updateData.title = data.title;
  if (data.amount !== void 0) updateData.amount = new Decimal(data.amount);
  if (data.status !== void 0) updateData.status = data.status;
  if (data.notes !== void 0) updateData.notes = data.notes;
  if (data.categoryCode !== void 0) updateData.categoryCode = data.categoryCode;
  if (data.subcategory !== void 0) updateData.subcategory = data.subcategory;
  const updated = await prisma.operationalExpense.update({
    where: { id },
    data: updateData,
    include: {
      property: true,
      unit: true,
      allocations: { include: { unit: true } },
      payments: true
    }
  });
  return serializeDecimals(updated);
}
async function deleteExpenseInDb(id) {
  if (!process.env.DATABASE_URL) return null;
  const deleted = await prisma.operationalExpense.delete({
    where: { id }
  });
  return serializeDecimals(deleted);
}
async function recordAuditLogInDb(data) {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        userName: data.userName,
        action: data.action,
        module: data.module,
        details: data.details,
        ipAddress: data.ipAddress || null
      }
    });
  } catch (err) {
    return null;
  }
}
async function getAuditLogsFromDb(limit = 100) {
  if (!process.env.DATABASE_URL) return [];
  try {
    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: true }
    });
    return serializeDecimals(logs);
  } catch (e) {
    return [];
  }
}
async function importDataIntoDb(payload) {
  if (!process.env.DATABASE_URL) {
    throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A PostgreSQL \u063A\u064A\u0631 \u0645\u062A\u0635\u0644\u0629.");
  }
  const results = {
    properties: { total: 0, imported: 0, duplicatesSkipped: 0 },
    floors: { total: 0, imported: 0, duplicatesSkipped: 0 },
    units: { total: 0, imported: 0, duplicatesSkipped: 0 },
    bookings: { total: 0, imported: 0, duplicatesSkipped: 0 },
    leases: { total: 0, imported: 0, duplicatesSkipped: 0 },
    expenses: { total: 0, imported: 0, duplicatesSkipped: 0 }
  };
  const properties = Array.isArray(payload.properties) ? payload.properties : [];
  const units = Array.isArray(payload.units) ? payload.units : [];
  const bookings = Array.isArray(payload.bookings) ? payload.bookings : [];
  const leases = Array.isArray(payload.leases) ? payload.leases : [];
  const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
  results.properties.total = properties.length;
  results.units.total = units.length;
  results.bookings.total = bookings.length;
  results.leases.total = leases.length;
  results.expenses.total = expenses.length;
  await prisma.$transaction(async (tx) => {
    if (payload.settings) {
      await tx.companySettings.upsert({
        where: { id: "default" },
        update: {
          companyName: payload.settings.companyName || void 0,
          companyNameEn: payload.settings.companyNameEn || void 0,
          tagline: payload.settings.tagline || void 0,
          phone: payload.settings.phone || void 0,
          whatsapp: payload.settings.whatsapp || void 0,
          email: payload.settings.email || void 0,
          logoUrl: payload.settings.logoUrl || void 0,
          iconUrl: payload.settings.iconUrl || void 0,
          checkInTime: payload.settings.checkInTime || void 0,
          checkOutTime: payload.settings.checkOutTime || void 0
        },
        create: {
          id: "default",
          companyName: payload.settings.companyName || "Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629",
          companyNameEn: payload.settings.companyNameEn || "Luxury Home",
          tagline: payload.settings.tagline || "\u062A\u062C\u0631\u0628\u0629 \u0633\u0643\u0646\u064A\u0629 \u0641\u0627\u062E\u0631\u0629",
          phone: payload.settings.phone || "+966 11 000 0000",
          whatsapp: payload.settings.whatsapp || "+966 50 000 0000",
          email: payload.settings.email || "vip@luxuryhome.sa",
          checkInTime: payload.settings.checkInTime || "15:00",
          checkOutTime: payload.settings.checkOutTime || "12:00"
        }
      });
    }
    for (const prop of properties) {
      const existing = await tx.property.findFirst({
        where: { OR: [{ id: prop.id }, { code: prop.code || prop.id }] }
      });
      if (existing) {
        results.properties.duplicatesSkipped++;
        continue;
      }
      await tx.property.create({
        data: {
          id: prop.id,
          name: prop.name || "\u0645\u0628\u0646\u0649 \u0633\u0643\u0646\u064A",
          code: prop.code || prop.id || `P-${Date.now()}`,
          address: prop.address || "\u0627\u0644\u0631\u064A\u0627\u0636",
          city: prop.city || "\u0627\u0644\u0631\u064A\u0627\u0636",
          district: prop.district || "\u062D\u064A \u0627\u0644\u0646\u0631\u062C\u0633",
          floorsCount: Number(prop.floorsCount) || 1,
          unitsCount: Number(prop.unitsCount) || 0,
          totalAreaSqm: Number(prop.totalAreaSqm) || 0,
          rooftopPayment: new Decimal(prop.rooftopPayment || 0),
          description: prop.description || null,
          images: Array.isArray(prop.images) ? prop.images : [],
          isActive: prop.isActive !== false
        }
      });
      results.properties.imported++;
    }
    for (const u of units) {
      const existing = await tx.unit.findFirst({
        where: { OR: [{ id: u.id }, { AND: [{ propertyId: u.propertyId }, { unitNumber: u.unitNumber }] }] }
      });
      if (existing) {
        results.units.duplicatesSkipped++;
        continue;
      }
      const propExists = await tx.property.findUnique({ where: { id: u.propertyId } });
      if (!propExists) {
        results.units.duplicatesSkipped++;
        continue;
      }
      await tx.unit.create({
        data: {
          id: u.id,
          propertyId: u.propertyId,
          floorId: u.floorId || null,
          unitNumber: u.unitNumber || "101",
          type: u.type || "apartment",
          areaSqm: Number(u.areaSqm) || 0,
          dailyRate: new Decimal(u.dailyRate || 0),
          monthlyRate: new Decimal(u.monthlyRate || 0),
          annualRate: new Decimal(u.annualRate || u.yearlyRate || 0),
          occupancyStatus: u.occupancyStatus || "vacant",
          isClean: u.isClean !== false,
          publicationStatus: u.publicationStatus || "published",
          images: Array.isArray(u.images) ? u.images : u.media ? u.media.map((m) => m.url || m) : [],
          spaces: u.spaces || null,
          fittings: u.fittings || null,
          smartLockPin: u.smartLockPin || null
        }
      });
      results.units.imported++;
    }
    for (const b of bookings) {
      const bNumber = b.bookingNumber || b.id;
      const existing = await tx.booking.findFirst({
        where: { OR: [{ id: b.id }, { bookingNumber: bNumber }] }
      });
      if (existing) {
        results.bookings.duplicatesSkipped++;
        continue;
      }
      const unit = await tx.unit.findUnique({ where: { id: b.unitId } });
      if (!unit) {
        results.bookings.duplicatesSkipped++;
        continue;
      }
      const checkIn = new Date(b.startDate || b.checkIn);
      const checkOut = new Date(b.endDate || b.checkOut);
      await tx.booking.create({
        data: {
          id: b.id,
          bookingNumber: bNumber,
          unitId: b.unitId,
          guestName: b.guestName || b.guest?.fullName || "\u0646\u0632\u064A\u0644 \u062D\u062C\u0632",
          guestPhone: b.guestPhone || b.guest?.phone || "+966500000000",
          guestEmail: b.guestEmail || b.guest?.email || null,
          startDate: checkIn,
          endDate: checkOut,
          rentalType: (b.rentalType || "daily").toUpperCase(),
          totalAmount: new Decimal(b.totalAmount || b.pricing?.total || 0),
          paidAmount: new Decimal(b.paidAmount || 0),
          status: (b.status || "confirmed").toUpperCase()
        }
      });
      await tx.unitAllocation.create({
        data: {
          unitId: b.unitId,
          startDate: checkIn,
          endDate: checkOut,
          rentalType: "DAILY",
          referenceId: bNumber,
          purpose: "booking",
          status: "active"
        }
      });
      results.bookings.imported++;
    }
    for (const l of leases) {
      const cNumber = l.contractNumber || l.id;
      const existing = await tx.lease.findFirst({
        where: { OR: [{ id: l.id }, { contractNumber: cNumber }] }
      });
      if (existing) {
        results.leases.duplicatesSkipped++;
        continue;
      }
      const unit = await tx.unit.findUnique({ where: { id: l.unitId } });
      if (!unit) {
        results.leases.duplicatesSkipped++;
        continue;
      }
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      await tx.lease.create({
        data: {
          id: l.id,
          contractNumber: cNumber,
          unitId: l.unitId,
          tenantName: l.tenantName || l.tenant?.fullName || "\u0645\u0633\u062A\u0623\u062C\u0631 \u0645\u0639\u062A\u0645\u062F",
          tenantPhone: l.tenantPhone || l.tenant?.phone || "+966500000000",
          tenantEmail: l.tenantEmail || l.tenant?.email || null,
          tenantIdNumber: l.tenantIdNumber || l.tenant?.nationalIdOrPassport || "1000000000",
          startDate: start,
          endDate: end,
          rentalType: (l.rentalType || "annual").toUpperCase(),
          annualRent: new Decimal(l.annualRent || l.totalRent || 0),
          paymentOption: l.paymentOption || "1_payment",
          paymentFrequency: l.paymentFrequency || "1_payment",
          securityDeposit: new Decimal(l.securityDeposit || 0),
          status: (l.status || "active").toUpperCase()
        }
      });
      await tx.unitAllocation.create({
        data: {
          unitId: l.unitId,
          startDate: start,
          endDate: end,
          rentalType: (l.rentalType || "annual").toUpperCase(),
          referenceId: cNumber,
          purpose: "lease",
          status: "active"
        }
      });
      results.leases.imported++;
    }
    for (const exp of expenses) {
      const expNumber = exp.expenseNumber || exp.id || `EXP-${Date.now()}`;
      const existing = await tx.operationalExpense.findFirst({
        where: { OR: [{ id: exp.id }, { expenseNumber: expNumber }] }
      });
      if (existing) {
        results.expenses.duplicatesSkipped++;
        continue;
      }
      await tx.operationalExpense.create({
        data: {
          id: exp.id,
          expenseNumber: expNumber,
          title: exp.title || exp.description || "\u0645\u0635\u0631\u0648\u0641 \u062A\u0634\u063A\u064A\u0644\u064A",
          amount: new Decimal(exp.amount || 0),
          costCenterLevel: (exp.costCenterLevel || exp.level || "PROPERTY").toUpperCase(),
          propertyId: exp.propertyId || null,
          unitId: exp.unitId || null,
          categoryCode: exp.categoryCode || "OPERATIONS_OTHER",
          startDate: exp.startDate ? new Date(exp.startDate) : /* @__PURE__ */ new Date(),
          endDate: exp.endDate ? new Date(exp.endDate) : /* @__PURE__ */ new Date(),
          status: exp.status || "approved"
        }
      });
      results.expenses.imported++;
    }
  });
  return results;
}
async function exportFullDatabase() {
  if (!process.env.DATABASE_URL) return null;
  const [
    settings,
    properties,
    floors,
    units,
    amenities,
    parkingSpots,
    allocations,
    bookings,
    leases,
    installments,
    payments,
    securityDeposits,
    expenses,
    expenseAllocations,
    auditLogs
  ] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.property.findMany(),
    prisma.floor.findMany(),
    prisma.unit.findMany(),
    prisma.amenity.findMany(),
    prisma.parkingSpot.findMany(),
    prisma.unitAllocation.findMany(),
    prisma.booking.findMany(),
    prisma.lease.findMany(),
    prisma.leaseInstallment.findMany(),
    prisma.paymentRecord.findMany(),
    prisma.securityDepositRecord.findMany(),
    prisma.operationalExpense.findMany(),
    prisma.expenseAllocation.findMany(),
    prisma.auditLog.findMany({ take: 500, orderBy: { createdAt: "desc" } })
  ]);
  return serializeDecimals({
    metadata: {
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: "2.0.0",
      schema: "PostgreSQL-LuxuryHome"
    },
    settings,
    properties,
    floors,
    units,
    amenities,
    parkingSpots,
    allocations,
    bookings,
    leases,
    installments,
    payments,
    securityDeposits,
    expenses,
    expenseAllocations,
    auditLogs
  });
}

// src/server/reservationService.ts
import { Decimal as Decimal2 } from "@prisma/client/runtime/library";
import { RentalType, BookingStatus, LeaseStatus, InstallmentStatus } from "@prisma/client";
function calculateContractEndDate(startDateStr, months) {
  const d = new Date(startDateStr);
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function generateInstallments(totalAnnualRent, startDateStr, frequency, monthsCount = 12) {
  const installments = [];
  let count = 1;
  let intervalMonths = 12;
  if (frequency === "2_payments") {
    count = 2;
    intervalMonths = 6;
  } else if (frequency === "4_payments") {
    count = 4;
    intervalMonths = 3;
  } else if (frequency === "monthly") {
    count = monthsCount;
    intervalMonths = 1;
  }
  const baseAmount = Math.floor(totalAnnualRent / count * 100) / 100;
  const totalBase = baseAmount * count;
  const roundingDifference = Math.round((totalAnnualRent - totalBase) * 100) / 100;
  for (let i = 0; i < count; i++) {
    const dueDate = new Date(startDateStr);
    dueDate.setMonth(dueDate.getMonth() + i * intervalMonths);
    const instAmount = i === count - 1 ? baseAmount + roundingDifference : baseAmount;
    installments.push({
      number: i + 1,
      label: count === 1 ? "\u062F\u0641\u0639\u0629 \u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0643\u0627\u0645\u0644\u0629" : `\u0627\u0644\u062F\u0641\u0639\u0629 ${i + 1} \u0645\u0646 ${count}`,
      dueDate: dueDate.toISOString().slice(0, 10),
      amount: instAmount,
      paidAmount: 0,
      remainingAmount: instAmount,
      status: "UPCOMING"
    });
  }
  return installments;
}
async function processDailyReservation(input) {
  const { unitId, checkIn, checkOut, guestName, guestPhone, guestEmail, guestIdNumber, notes, idempotencyKey } = input;
  const start = /* @__PURE__ */ new Date(`${checkIn}T15:00:00.000Z`);
  const end = /* @__PURE__ */ new Date(`${checkOut}T12:00:00.000Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw new Error("\u062A\u0648\u0627\u0631\u064A\u062E \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629. \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u062A\u0627\u0631\u064A\u062E \u0645\u063A\u0627\u062F\u0631\u0629 \u0628\u0639\u062F \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0648\u0635\u0648\u0644.");
  }
  const diffMs = end.getTime() - start.getTime();
  const totalNights = Math.max(1, Math.round(diffMs / (1e3 * 60 * 60 * 24)));
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.booking.findUnique({
          where: { idempotencyKey },
          include: { unit: { include: { property: true } } }
        });
        if (existing) {
          return serializeDecimals({
            booking: existing,
            allocation: null,
            totalAmount: Number(existing.totalAmount),
            subtotal: Number(existing.subtotal),
            taxes: Number(existing.taxes),
            cleaningFee: Number(existing.cleaningFee),
            securityDeposit: Number(existing.securityDeposit)
          });
        }
      }
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: { property: true }
      });
      if (!unit) {
        throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
      }
      if (unit.occupancyStatus === "blocked") {
        throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0645\u062D\u062C\u0648\u0628\u0629 \u0625\u062F\u0627\u0631\u064A\u0627\u064B \u062D\u0627\u0644\u064A\u0627\u064B.");
      }
      const conflict = await tx.unitAllocation.findFirst({
        where: {
          unitId,
          status: "active",
          startDate: { lt: new Date(end.getTime() + 3 * 3600 * 1e3) },
          endDate: { gt: start }
        }
      });
      if (conflict) {
        const err = new Error("\u0639\u0630\u0631\u0627\u064B\u060C \u0647\u0630\u0647 \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0645\u062D\u062C\u0648\u0632\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0623\u0648 \u0641\u064A \u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0641\u0646\u062F\u0642\u064A.");
        err.statusCode = 409;
        throw err;
      }
      const nightlyRate2 = Number(unit.dailyRate) || 850;
      const subtotal2 = nightlyRate2 * totalNights;
      const cleaningFee2 = 150;
      const taxes2 = Math.round(subtotal2 * 0.15 * 100) / 100;
      const securityDeposit2 = 500;
      const totalAmount2 = subtotal2 + cleaningFee2 + taxes2 + securityDeposit2;
      const bookingNumber2 = `LH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const booking = await tx.booking.create({
        data: {
          bookingNumber: bookingNumber2,
          idempotencyKey: idempotencyKey || null,
          unitId,
          guestName,
          guestPhone,
          guestEmail,
          guestIdNumber,
          startDate: start,
          endDate: end,
          rentalType: RentalType.DAILY,
          totalNights,
          guestsCount: input.guestsCount || 1,
          nightlyRate: new Decimal2(nightlyRate2),
          subtotal: new Decimal2(subtotal2),
          cleaningFee: new Decimal2(cleaningFee2),
          taxes: new Decimal2(taxes2),
          securityDeposit: new Decimal2(securityDeposit2),
          totalAmount: new Decimal2(totalAmount2),
          paidAmount: new Decimal2(0),
          status: BookingStatus.CONFIRMED,
          paymentStatus: "pending",
          identityStatus: "pending_verification",
          smartLockPin: null,
          notes: notes || null
        }
      });
      const allocation = await tx.unitAllocation.create({
        data: {
          unitId,
          startDate: start,
          endDate: end,
          rentalType: RentalType.DAILY,
          referenceId: booking.id,
          purpose: "booking",
          status: "active",
          notes: `\u062D\u062C\u0632 \u064A\u0648\u0645\u064A ${bookingNumber2} - \u0627\u0644\u0646\u0632\u064A\u0644: ${guestName}`
        }
      });
      await tx.securityDepositRecord.create({
        data: {
          bookingId: booking.id,
          amount: new Decimal2(securityDeposit2),
          status: "held",
          notes: `\u062A\u0623\u0645\u064A\u0646 \u0645\u0633\u062A\u0631\u062F \u0644\u062D\u062C\u0632 ${bookingNumber2}`
        }
      });
      return serializeDecimals({ booking, allocation, totalAmount: totalAmount2, subtotal: subtotal2, taxes: taxes2, cleaningFee: cleaningFee2, securityDeposit: securityDeposit2 });
    });
  }
  const nightlyRate = 850;
  const subtotal = nightlyRate * totalNights;
  const cleaningFee = 150;
  const taxes = Math.round(subtotal * 0.15 * 100) / 100;
  const securityDeposit = 500;
  const totalAmount = subtotal + cleaningFee + taxes + securityDeposit;
  const bookingNumber = `LH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  return {
    booking: {
      id: `bk_${Date.now()}`,
      bookingNumber,
      unitId,
      guestName,
      guestPhone,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rentalType: "daily",
      totalNights,
      totalAmount,
      status: "confirmed",
      paymentStatus: "pending",
      identityStatus: "pending_verification",
      smartLockPin: null
    },
    allocation: {
      id: `alloc_${Date.now()}`,
      unitId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rentalType: "DAILY",
      referenceId: bookingNumber,
      purpose: "booking",
      status: "active"
    },
    totalAmount,
    subtotal,
    taxes,
    cleaningFee,
    securityDeposit
  };
}
async function processLeaseContract(input) {
  const {
    unitId,
    rentalType,
    startDate,
    paymentFrequency,
    tenantName,
    tenantPhone,
    tenantEmail,
    tenantIdNumber,
    contractServices,
    termsConditions,
    idempotencyKey
  } = input;
  const durationMonths = rentalType === "monthly" ? input.durationMonths || 1 : 12;
  const endDate = input.endDate || calculateContractEndDate(startDate, durationMonths);
  const start = /* @__PURE__ */ new Date(`${startDate}T15:00:00.000Z`);
  const end = /* @__PURE__ */ new Date(`${endDate}T12:00:00.000Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw new Error("\u062A\u0648\u0627\u0631\u064A\u062E \u0627\u0644\u0639\u0642\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
  }
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.lease.findUnique({
          where: { idempotencyKey },
          include: { unit: { include: { property: true } }, installments: true }
        });
        if (existing) {
          return serializeDecimals({
            lease: existing,
            allocation: null,
            installments: existing.installments
          });
        }
      }
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: { property: true }
      });
      if (!unit) {
        throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
      }
      const conflict = await tx.unitAllocation.findFirst({
        where: {
          unitId,
          status: "active",
          startDate: { lt: end },
          endDate: { gt: start }
        }
      });
      if (conflict) {
        const err = new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0645\u0634\u063A\u0648\u0644\u0629 \u0628\u0639\u0642\u062F \u0623\u0648 \u062D\u062C\u0632 \u0622\u062E\u0631 \u062E\u0644\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.");
        err.statusCode = 409;
        throw err;
      }
      const annualRentRate = rentalType === "annual" ? Number(unit.annualRate) || 85e3 : (Number(unit.monthlyRate) || 8500) * 12;
      const totalRentForPeriod2 = rentalType === "annual" ? annualRentRate : (Number(unit.monthlyRate) || 8500) * durationMonths;
      const installmentsData2 = generateInstallments(
        totalRentForPeriod2,
        startDate,
        paymentFrequency,
        durationMonths
      );
      const contractNumber2 = `CNT-${rentalType === "annual" ? "ANN" : "MTH"}-${Date.now().toString().slice(-6)}`;
      const securityDeposit = 2500;
      const lease = await tx.lease.create({
        data: {
          contractNumber: contractNumber2,
          idempotencyKey: idempotencyKey || null,
          unitId,
          tenantName,
          tenantPhone,
          tenantEmail,
          tenantIdNumber,
          startDate: start,
          endDate: end,
          rentalType: rentalType === "annual" ? RentalType.ANNUAL : RentalType.MONTHLY,
          annualRent: new Decimal2(totalRentForPeriod2),
          paymentOption: paymentFrequency,
          paymentFrequency,
          installmentsCount: installmentsData2.length,
          securityDeposit: new Decimal2(securityDeposit),
          contractServices: contractServices || ["wifi", "parking", "maintenance"],
          termsConditions: termsConditions || "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0633\u0643\u0646\u064A \u0631\u0633\u0645\u064A \u0645\u0639\u062A\u0645\u062F \u0628\u0646\u0638\u0627\u0645 \u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0645\u0648\u062D\u062F.",
          status: LeaseStatus.ACTIVE
        }
      });
      for (const inst of installmentsData2) {
        await tx.leaseInstallment.create({
          data: {
            leaseId: lease.id,
            number: inst.number,
            label: inst.label,
            dueDate: new Date(inst.dueDate),
            amount: new Decimal2(inst.amount),
            paidAmount: new Decimal2(0),
            remainingAmount: new Decimal2(inst.amount),
            status: InstallmentStatus.UPCOMING
          }
        });
      }
      const allocation = await tx.unitAllocation.create({
        data: {
          unitId,
          startDate: start,
          endDate: end,
          rentalType: rentalType === "annual" ? RentalType.ANNUAL : RentalType.MONTHLY,
          referenceId: lease.id,
          purpose: "lease",
          status: "active",
          notes: `\u0639\u0642\u062F ${rentalType === "annual" ? "\u0633\u0646\u0648\u064A" : "\u0634\u0647\u0631\u064A"} \u0631\u0642\u0645 ${contractNumber2} - \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631: ${tenantName}`
        }
      });
      await tx.securityDepositRecord.create({
        data: {
          leaseId: lease.id,
          amount: new Decimal2(securityDeposit),
          status: "held",
          notes: `\u062A\u0623\u0645\u064A\u0646 \u062A\u0623\u062C\u064A\u0631\u064A \u0644\u0639\u0642\u062F ${contractNumber2}`
        }
      });
      return serializeDecimals({ lease, allocation, installments: installmentsData2 });
    });
  }
  const contractNumber = `CNT-${rentalType === "annual" ? "ANN" : "MTH"}-${Date.now().toString().slice(-6)}`;
  const totalRentForPeriod = rentalType === "annual" ? 85e3 : 8500 * durationMonths;
  const installmentsData = generateInstallments(totalRentForPeriod, startDate, paymentFrequency, durationMonths);
  return {
    lease: {
      id: `lease_${Date.now()}`,
      contractNumber,
      unitId,
      tenantName,
      tenantPhone,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rentalType,
      annualRent: totalRentForPeriod,
      paymentOption: paymentFrequency,
      status: "active"
    },
    allocation: {
      id: `alloc_${Date.now()}`,
      unitId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rentalType: rentalType.toUpperCase(),
      referenceId: contractNumber,
      purpose: "lease",
      status: "active"
    },
    installments: installmentsData
  };
}

// src/server/financialEngine.ts
function computeCostAllocation(input) {
  const {
    title,
    amount,
    allocationMethod,
    targetUnitId,
    units,
    customRatios,
    isCapitalAsset
  } = input;
  if (amount === void 0 || amount === null || isNaN(amount)) {
    throw new Error("\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
  }
  const totalAmount = Math.max(0, Math.round(Number(amount) * 100) / 100);
  if (isCapitalAsset) {
    return {
      expenseTitle: title,
      totalExpenseAmount: totalAmount,
      allocationMethod: "CAPITAL_ASSET_FFE",
      unitsCount: units.length,
      distributedAmount: 0,
      unallocatedAmount: totalAmount,
      roundingAdjustmentHalalas: 0,
      shares: [],
      validationNotes: ["\u062A\u0645 \u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0643\u0623\u0635\u0644 \u0631\u0623\u0633\u0645\u0627\u0644\u064A (FF&E) \u0645\u0633\u062A\u062B\u0646\u0649 \u0645\u0646 \u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A \u0627\u0644\u0645\u0628\u0627\u0634\u0631 (OPEX)."]
    };
  }
  if (totalAmount === 0) {
    return {
      expenseTitle: title,
      totalExpenseAmount: 0,
      allocationMethod,
      unitsCount: units.length,
      distributedAmount: 0,
      unallocatedAmount: 0,
      roundingAdjustmentHalalas: 0,
      shares: units.map((u) => ({
        unitId: u.id,
        unitNumber: u.unitNumber,
        shareAmount: 0,
        percentage: 0,
        basisValue: 0
      })),
      validationNotes: ["\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0635\u0641\u0631\u064A\u0629 \u0645\u0639\u062A\u0645\u062F\u0629\u061B \u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062D\u0635\u0635 \u0628\u0642\u064A\u0645\u0629 \u0635\u0641\u0631 \u062F\u0648\u0646 \u0627\u0641\u062A\u0631\u0627\u0636 \u0623\u0631\u0642\u0627\u0645 \u062A\u062C\u0631\u064A\u0628\u064A\u0629."]
    };
  }
  if (allocationMethod === "DIRECT_UNIT") {
    const targetUnit = units.find((u) => u.id === targetUnitId);
    if (!targetUnit) {
      return {
        expenseTitle: title,
        totalExpenseAmount: totalAmount,
        allocationMethod,
        unitsCount: 0,
        distributedAmount: 0,
        unallocatedAmount: totalAmount,
        roundingAdjustmentHalalas: 0,
        shares: [],
        validationNotes: ["\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629\u061B \u0628\u0642\u064A \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u0632\u0639 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0639\u0642\u0627\u0631."]
      };
    }
    return {
      expenseTitle: title,
      totalExpenseAmount: totalAmount,
      allocationMethod,
      unitsCount: 1,
      distributedAmount: totalAmount,
      unallocatedAmount: 0,
      roundingAdjustmentHalalas: 0,
      shares: [{
        unitId: targetUnit.id,
        unitNumber: targetUnit.unitNumber,
        shareAmount: totalAmount,
        percentage: 100,
        basisValue: 1
      }],
      validationNotes: ["\u062A\u0645 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0645\u0628\u0627\u0634\u0631\u0629 \u0648\u0628\u0646\u0633\u0628\u0629 100% \u0639\u0644\u0649 \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641\u0629."]
    };
  }
  if (units.length === 0) {
    return {
      expenseTitle: title,
      totalExpenseAmount: totalAmount,
      allocationMethod,
      unitsCount: 0,
      distributedAmount: 0,
      unallocatedAmount: totalAmount,
      roundingAdjustmentHalalas: 0,
      shares: [],
      validationNotes: ["\u0644\u0627 \u062A\u0648\u062C\u062F \u0648\u062D\u062F\u0627\u062A \u0645\u0631\u062A\u0628\u0637\u0629\u061B \u062A\u0645 \u0627\u0644\u0625\u0628\u0642\u0627\u0621 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u0632\u0639 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u0627\u0644\u064A."]
    };
  }
  let basisValues = [];
  const validationNotes = [];
  if (allocationMethod === "EQUAL_UNITS") {
    basisValues = units.map((u) => ({ unit: u, basis: 1 }));
  } else if (allocationMethod === "SQM_AREA") {
    const missingAreaUnits = units.filter((u) => !u.areaSqm || u.areaSqm <= 0);
    if (missingAreaUnits.length > 0) {
      throw new Error(`\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u062D\u0633\u0628 \u0627\u0644\u0645\u0633\u0627\u062D\u0629: \u062A\u0648\u062C\u062F ${missingAreaUnits.length} \u0648\u062D\u062F\u0629 \u0628\u062F\u0648\u0646 \u0645\u0633\u0627\u062D\u0629 \u0645\u0633\u062C\u0644\u0629 (\u0645\u062B\u0627\u0644: \u0634\u0642\u0629 ${missingAreaUnits[0].unitNumber}). \u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062B \u0645\u0633\u0627\u062D\u0627\u062A \u0627\u0644\u0648\u062D\u062F\u0627\u062A \u0623\u0648\u0644\u0627\u064B.`);
    }
    basisValues = units.map((u) => ({ unit: u, basis: u.areaSqm }));
  } else if (allocationMethod === "OCCUPANCY_DAYS") {
    basisValues = units.map((u) => ({ unit: u, basis: u.occupancyDaysInPeriod || 0 }));
    const totalDays = basisValues.reduce((sum, item) => sum + item.basis, 0);
    if (totalDays === 0) {
      return {
        expenseTitle: title,
        totalExpenseAmount: totalAmount,
        allocationMethod,
        unitsCount: units.length,
        distributedAmount: 0,
        unallocatedAmount: totalAmount,
        roundingAdjustmentHalalas: 0,
        shares: [],
        validationNotes: ["\u0627\u0646\u0639\u062F\u0627\u0645 \u0627\u0644\u0625\u0634\u063A\u0627\u0644 \u062E\u0644\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629: \u062A\u0645 \u0627\u0644\u0625\u0628\u0642\u0627\u0621 \u0639\u0644\u0649 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0643\u0639\u0628\u0621 \u062A\u0634\u063A\u064A\u0644\u064A \u063A\u064A\u0631 \u0645\u0648\u0632\u0639 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0645\u0628\u0646\u0649."]
      };
    }
  } else if (allocationMethod === "REVENUE_RATIO") {
    basisValues = units.map((u) => ({ unit: u, basis: Math.max(0, u.periodRevenue || 0) }));
    const totalRev = basisValues.reduce((sum, item) => sum + item.basis, 0);
    if (totalRev === 0) {
      return {
        expenseTitle: title,
        totalExpenseAmount: totalAmount,
        allocationMethod,
        unitsCount: units.length,
        distributedAmount: 0,
        unallocatedAmount: totalAmount,
        roundingAdjustmentHalalas: 0,
        shares: [],
        validationNotes: ["\u0627\u0646\u0639\u062F\u0627\u0645 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u062E\u0644\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629: \u0628\u0642\u064A \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u0632\u0639 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0645\u0628\u0646\u0649."]
      };
    }
  } else if (allocationMethod === "CUSTOM_RATIO") {
    basisValues = units.map((u) => ({ unit: u, basis: customRatios && customRatios[u.id] || 0 }));
  }
  const totalBasis = basisValues.reduce((acc, item) => acc + item.basis, 0);
  if (totalBasis <= 0) {
    return {
      expenseTitle: title,
      totalExpenseAmount: totalAmount,
      allocationMethod,
      unitsCount: units.length,
      distributedAmount: 0,
      unallocatedAmount: totalAmount,
      roundingAdjustmentHalalas: 0,
      shares: [],
      validationNotes: ["\u0625\u062C\u0645\u0627\u0644\u064A \u0623\u0633\u0627\u0633 \u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u064A\u0633\u0627\u0648\u064A \u0635\u0641\u0631\u0627\u064B\u061B \u0644\u0645 \u064A\u062A\u0645 \u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0644\u062A\u0641\u0627\u062F\u064A \u0627\u0644\u0642\u0633\u0645\u0629 \u0639\u0644\u0649 \u0635\u0641\u0631."]
    };
  }
  let calculatedShares = [];
  let runningSum = 0;
  for (let i = 0; i < basisValues.length; i++) {
    const { unit, basis } = basisValues[i];
    const percentage = basis / totalBasis * 100;
    const shareAmount = Math.floor(totalAmount * basis / totalBasis * 100) / 100;
    runningSum = Math.round((runningSum + shareAmount) * 100) / 100;
    calculatedShares.push({
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      shareAmount,
      percentage: Math.round(percentage * 100) / 100,
      basisValue: basis
    });
  }
  const difference = Math.round((totalAmount - runningSum) * 100) / 100;
  if (difference !== 0 && calculatedShares.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < calculatedShares.length; i++) {
      if (calculatedShares[i].basisValue > calculatedShares[maxIdx].basisValue) {
        maxIdx = i;
      }
    }
    calculatedShares[maxIdx].shareAmount = Math.round((calculatedShares[maxIdx].shareAmount + difference) * 100) / 100;
  }
  const finalSum = calculatedShares.reduce((acc, c) => acc + c.shareAmount, 0);
  const distributedAmount = Math.round(finalSum * 100) / 100;
  return {
    expenseTitle: title,
    totalExpenseAmount: totalAmount,
    allocationMethod,
    unitsCount: calculatedShares.length,
    distributedAmount,
    unallocatedAmount: Math.round((totalAmount - distributedAmount) * 100) / 100,
    roundingAdjustmentHalalas: difference,
    shares: calculatedShares,
    validationNotes
  };
}

// server.ts
var ROOT_DIR = process.cwd();
var BACKUP_DIR = path2.resolve(ROOT_DIR, "backups");
var UPLOADS_DIR = path2.resolve(ROOT_DIR, "uploads");
var PRIVATE_DOCS_DIR = path2.resolve(ROOT_DIR, "private_docs");
var DIST_DIR = path2.resolve(ROOT_DIR, "dist");
var SERVER_DB_FILE = path2.resolve(ROOT_DIR, "server-db.json");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PRIVATE_DOCS_DIR)) fs.mkdirSync(PRIVATE_DOCS_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
var memoryState = null;
async function initializeFallbackState() {
  if (fs.existsSync(SERVER_DB_FILE)) {
    try {
      const raw = fs.readFileSync(SERVER_DB_FILE, "utf-8");
      memoryState = JSON.parse(raw);
    } catch (e) {
      console.warn("[Server] Note on reading server-db.json:", e);
    }
  }
  if (!memoryState) {
    memoryState = {
      settings: {
        companyName: "Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629",
        companyNameEn: "Luxury Home",
        tagline: "\u062A\u062C\u0631\u0628\u0629 \u0633\u0643\u0646\u064A\u0629 \u0641\u0627\u062E\u0631\u0629 \u062A\u062F\u0645\u062C \u0628\u064A\u0646 \u062E\u0635\u0648\u0635\u064A\u0629 \u0627\u0644\u0645\u0646\u0632\u0644 \u0648\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0636\u064A\u0627\u0641\u0629 \u0627\u0644\u0631\u0627\u0642\u064A\u0629"
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
async function startServer(customPort) {
  await initializeFallbackState();
  const PORT = customPort || Number(process.env.PORT) || 3e3;
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use("/uploads", express.static(UPLOADS_DIR));
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-setup-secret");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
  const apiRouter = express.Router();
  apiRouter.get("/health", async (req, res) => {
    const dbHealth = await checkDatabaseHealth();
    const isProd = process.env.NODE_ENV === "production";
    const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);
    if (isProd && isDatabaseConfigured && !dbHealth.connected) {
      return res.status(503).json({
        status: "unhealthy",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        database: dbHealth,
        error: "\u0641\u0634\u0644 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A PostgreSQL \u0641\u064A \u0628\u064A\u0626\u0629 \u0627\u0644\u0625\u0646\u062A\u0627\u062C"
      });
    }
    const hasAdmin = process.env.DATABASE_URL ? await hasSuperAdminInDb() : Array.isArray(memoryState?.users) && memoryState.users.some((u) => u.role === "SUPER_ADMIN" && u.isActive);
    res.json({
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      version: "2.0.0",
      database: dbHealth.connected ? "postgresql_active" : process.env.DATABASE_URL ? "postgresql_connection_error" : "unconfigured_local_preview",
      databaseDetails: dbHealth.details,
      hasAdminInitialized: hasAdmin,
      environment: process.env.NODE_ENV || "development",
      externalServicesStatus: {
        paymentGateway: Boolean(process.env.PAYMENT_API_KEY) ? "configured" : "disabled_manual_only",
        smartLocks: Boolean(process.env.SMART_LOCK_API_KEY) ? "configured" : "disabled_manual_only",
        yakeenId: Boolean(process.env.YAKEEN_APP_ID) ? "configured" : "disabled_manual_only",
        smsGateway: Boolean(process.env.SMS_API_KEY) ? "configured" : "disabled_manual_only"
      }
    });
  });
  apiRouter.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
    }
    try {
      let user = null;
      if (process.env.DATABASE_URL) {
        user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: { equals: username, mode: "insensitive" } },
              { email: { equals: username, mode: "insensitive" } }
            ]
          }
        });
      } else if (memoryState?.users) {
        user = memoryState.users.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.isActive);
      }
      if (!user) {
        return res.status(401).json({ success: false, message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." });
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: "\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628. \u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0646\u0638\u0627\u0645." });
      }
      const isValidPassword = await verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ success: false, message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." });
      }
      const tokenPayload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        allowedProperties: user.allowedProperties || ["all"]
      };
      const token = generateToken(tokenPayload);
      await recordAuditLogInDb({
        userId: user.id,
        userName: `${user.name || user.username} (${user.role})`,
        action: "\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0646\u0627\u062C\u062D",
        module: "\u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0648\u0627\u0644\u0623\u0645\u0627\u0646",
        details: `\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0635\u0644\u0627\u062D\u064A\u0629 ${user.role}`,
        ipAddress: req.ip
      });
      return res.json({
        success: true,
        token,
        user: sanitizeUser(user)
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u0645\u0639\u0627\u0644\u062C\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644." });
    }
  });
  apiRouter.post("/auth/register-admin", async (req, res) => {
    const { username, password, name, email, allowedProperties, setupSecret } = req.body;
    try {
      const hasAdmin = process.env.DATABASE_URL ? await hasSuperAdminInDb() : Array.isArray(memoryState?.users) && memoryState.users.some((u) => u.role === "SUPER_ADMIN" && u.isActive);
      if (hasAdmin) {
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;
        if (!token) {
          return res.status(403).json({
            success: false,
            code: "SETUP_CLOSED",
            message: "\u0645\u0631\u0641\u0648\u0636: \u062A\u0645 \u0625\u0639\u062F\u0627\u062F \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0645\u0633\u0628\u0642\u0627\u064B\u060C \u0648\u0627\u0644\u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0645\u063A\u0644\u0642\u0629 \u062A\u0645\u0627\u0645\u0627\u064B. \u064A\u062A\u0637\u0644\u0628 \u062A\u0633\u062C\u064A\u0644 \u0645\u0633\u0624\u0648\u0644 \u062C\u062F\u064A\u062F \u0645\u0635\u0627\u062F\u0642\u0629 \u0628\u0640 JWT \u0645\u0633\u0624\u0648\u0644 \u062D\u0627\u0644\u064A."
          });
        }
        const authReq = req;
        return authenticateToken(authReq, res, async () => {
          if (authReq.user?.role !== "SUPER_ADMIN") {
            return res.status(403).json({
              success: false,
              code: "FORBIDDEN",
              message: "\u0641\u0642\u0637 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0631\u0626\u064A\u0633\u064A (SUPER_ADMIN) \u064A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628\u0627\u062A \u0625\u062F\u0627\u0631\u064A\u0629 \u062C\u062F\u064A\u062F\u0629."
            });
          }
          await executeCreateAdmin();
        });
      }
      const expectedSecret = process.env.ADMIN_SETUP_SECRET;
      const providedSecret = req.headers["x-admin-setup-secret"] || setupSecret;
      if (expectedSecret && providedSecret !== expectedSecret) {
        return res.status(403).json({
          success: false,
          code: "INVALID_SETUP_SECRET",
          message: "\u0645\u0631\u0641\u0648\u0636: \u0631\u0645\u0632 \u0627\u0644\u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u0627\u0644\u0623\u0648\u0644\u064A\u0629 (ADMIN_SETUP_SECRET) \u063A\u064A\u0631 \u0635\u062D\u064A\u062D."
        });
      }
      await executeCreateAdmin();
      async function executeCreateAdmin() {
        if (!username || !password) {
          return res.status(400).json({ success: false, message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
        }
        if (username.length < 3) {
          return res.status(400).json({ success: false, message: "\u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0646 \u0663 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644." });
        }
        if (password.length < 6) {
          return res.status(400).json({ success: false, message: "\u064A\u062C\u0628 \u0623\u0646 \u062A\u062A\u0643\u0648\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0646 \u0666 \u062E\u0627\u0646\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0644\u0636\u0645\u0627\u0646 \u0627\u0644\u0623\u0645\u0627\u0646." });
        }
        const hashedPassword = await hashPassword(password);
        if (process.env.DATABASE_URL) {
          const result = await prisma.$transaction(async (tx) => {
            const count = await tx.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
            if (!hasAdmin && count > 0) {
              const err = new Error("\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0623\u0648\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0628\u0648\u0627\u0633\u0637\u0629 \u0637\u0644\u0628 \u0645\u062A\u0632\u0627\u0645\u0646.");
              err.statusCode = 409;
              throw err;
            }
            const existingUser = await tx.user.findFirst({
              where: {
                OR: [
                  { username: { equals: username, mode: "insensitive" } },
                  { email: { equals: email || `${username}@luxuryhome.sa`, mode: "insensitive" } }
                ]
              }
            });
            if (existingUser) {
              const err = new Error("\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B.");
              err.statusCode = 409;
              throw err;
            }
            const newAdmin2 = await tx.user.create({
              data: {
                username,
                email: email || `${username}@luxuryhome.sa`,
                passwordHash: hashedPassword,
                name: name || username,
                role: "SUPER_ADMIN",
                allowedProperties: allowedProperties || ["all"],
                isActive: true
              }
            });
            return newAdmin2;
          });
          const tokenPayload2 = {
            userId: result.id,
            username: result.username,
            email: result.email,
            role: result.role,
            allowedProperties: result.allowedProperties
          };
          const token2 = generateToken(tokenPayload2);
          await recordAuditLogInDb({
            userId: result.id,
            userName: result.username,
            action: "\u0625\u0646\u0634\u0627\u0621 \u0645\u0633\u0624\u0648\u0644 \u0646\u0638\u0627\u0645",
            module: "\u0627\u0644\u0623\u0645\u0627\u0646 \u0648\u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064A\u0646",
            details: `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A (${result.username}) \u0648\u0625\u063A\u0644\u0627\u0642 \u0645\u0633\u0627\u0631 \u0627\u0644\u062A\u0647\u064A\u0626\u0629.`,
            ipAddress: req.ip
          });
          return res.json({
            success: true,
            message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0628\u0646\u062C\u0627\u062D.",
            token: token2,
            user: sanitizeUser(result)
          });
        }
        const newAdmin = {
          id: `usr_${Date.now()}`,
          username,
          email: email || `${username}@luxuryhome.sa`,
          passwordHash: hashedPassword,
          name: name || username,
          role: "SUPER_ADMIN",
          allowedProperties: allowedProperties || ["all"],
          isActive: true,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (!memoryState.users) memoryState.users = [];
        memoryState.users.push(newAdmin);
        const tokenPayload = {
          userId: newAdmin.id,
          username: newAdmin.username,
          email: newAdmin.email,
          role: newAdmin.role,
          allowedProperties: newAdmin.allowedProperties
        };
        const token = generateToken(tokenPayload);
        return res.json({
          success: true,
          message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0628\u0646\u062C\u0627\u062D.",
          token,
          user: sanitizeUser(newAdmin)
        });
      }
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628." });
    }
  });
  apiRouter.get("/auth/me", authenticateToken, async (req, res) => {
    try {
      if (req.dbUser) {
        return res.json({ success: true, user: sanitizeUser(req.dbUser) });
      }
      return res.json({ success: true, user: req.user });
    } catch (err) {
      return res.json({ success: true, user: req.user });
    }
  });
  apiRouter.post("/auth/logout", authenticateToken, async (req, res) => {
    await recordAuditLogInDb({
      userId: req.user?.userId,
      userName: req.user?.username || "\u0645\u0633\u062A\u062E\u062F\u0645",
      action: "\u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C",
      module: "\u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0648\u0627\u0644\u0623\u0645\u0627\u0646",
      details: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629",
      ipAddress: req.ip
    });
    res.json({ success: true, message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C \u0628\u0646\u062C\u0627\u062D." });
  });
  apiRouter.get("/public/settings", async (req, res) => {
    if (process.env.DATABASE_URL) {
      const settings2 = await getCompanySettingsFromDb();
      if (settings2) {
        return res.json({
          success: true,
          settings: {
            companyName: settings2.companyName,
            companyNameEn: settings2.companyNameEn,
            tagline: settings2.tagline,
            logoUrl: settings2.logoUrl,
            iconUrl: settings2.iconUrl,
            phone: settings2.phone,
            whatsapp: settings2.whatsapp,
            email: settings2.email,
            checkInTime: settings2.checkInTime,
            checkOutTime: settings2.checkOutTime,
            navigation: settings2.navigation
          }
        });
      }
    }
    const settings = memoryState?.settings || {};
    res.json({
      success: true,
      settings: {
        companyName: settings.companyName || "Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629",
        companyNameEn: settings.companyNameEn || "Luxury Home",
        tagline: settings.tagline || "\u062A\u062C\u0631\u0628\u0629 \u0633\u0643\u0646\u064A\u0629 \u0641\u0627\u062E\u0631\u0629",
        logoUrl: settings.logoUrl || null,
        iconUrl: settings.iconUrl || null,
        phone: settings.phone || "+966 11 000 0000",
        whatsapp: settings.whatsapp || "+966 50 000 0000",
        email: settings.email || "vip@luxuryhome.sa",
        checkInTime: settings.checkInTime || "15:00",
        checkOutTime: settings.checkOutTime || "12:00",
        navigation: settings.navigation || null
      }
    });
  });
  apiRouter.get("/public/properties", async (req, res) => {
    if (process.env.DATABASE_URL) {
      const props = await getPropertiesFromDb();
      return res.json({ success: true, properties: props.filter((p) => p.isActive !== false) });
    }
    const properties = (memoryState?.properties || []).filter((p) => p.isActive !== false);
    res.json({ success: true, properties });
  });
  apiRouter.get("/public/units", async (req, res) => {
    if (process.env.DATABASE_URL) {
      const units2 = await getUnitsFromDb();
      return res.json({ success: true, units: units2.filter((u) => u.publicationStatus !== "archived") });
    }
    const units = (memoryState?.units || []).filter((u) => u.publicationStatus !== "archived");
    res.json({ success: true, units });
  });
  apiRouter.get("/properties", authenticateToken, async (req, res) => {
    const user = req.user;
    const allowed = user.role === "SUPER_ADMIN" ? ["all"] : user.allowedProperties;
    if (process.env.DATABASE_URL) {
      const properties = await getPropertiesFromDb(allowed);
      return res.json({ success: true, properties });
    }
    const isUniversal = allowed.includes("all");
    const filtered = isUniversal ? memoryState?.properties || [] : (memoryState?.properties || []).filter((p) => allowed.includes(p.id));
    res.json({ success: true, properties: filtered });
  });
  apiRouter.post("/properties", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { name, code, address, city, district, floorsCount, unitsCount, totalAreaSqm, rooftopPayment, description, images, isActive } = req.body;
      if (!name || !code || !address || !district) {
        return res.status(400).json({ success: false, message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0628\u0646\u0649 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 (\u0627\u0644\u0627\u0633\u0645\u060C \u0627\u0644\u0643\u0648\u062F\u060C \u0627\u0644\u0639\u0646\u0648\u0627\u0646\u060C \u0627\u0644\u062D\u064A \u0645\u0637\u0644\u0648\u0628\u0629)." });
      }
      if (process.env.DATABASE_URL) {
        const prop = await createPropertyInDb(req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
          action: "\u0625\u0646\u0634\u0627\u0621 \u0645\u0628\u0646\u0649 / \u0639\u0642\u0627\u0631 \u062C\u062F\u064A\u062F",
          module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A",
          details: `\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0628\u0646\u0649 ${name} (${code})`,
          ipAddress: req.ip
        });
        return res.json({ success: true, property: prop, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
      }
      const newProp = {
        id: req.body.id || `prop_${Date.now()}`,
        name,
        code,
        address,
        city: city || "\u0627\u0644\u0631\u064A\u0627\u0636",
        district,
        floorsCount: Number(floorsCount) || 1,
        unitsCount: Number(unitsCount) || 0,
        totalAreaSqm: Number(totalAreaSqm) || 0,
        rooftopPayment: Number(rooftopPayment) || 0,
        description: description || null,
        images: Array.isArray(images) ? images : [],
        isActive: isActive !== false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (!memoryState.properties) memoryState.properties = [];
      memoryState.properties.push(newProp);
      return res.json({ success: true, property: newProp, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u0645\u0628\u0646\u0649." });
    }
  });
  apiRouter.put("/properties/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), checkPropertyAccess, async (req, res) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
        const updated = await updatePropertyInDb(id, req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
          action: "\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0628\u0646\u0649",
          module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A",
          details: `\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0628\u0646\u0649 ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, property: updated, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u062C\u0627\u062D." });
      }
      if (!memoryState.properties) memoryState.properties = [];
      const idx = memoryState.properties.findIndex((p) => p.id === id);
      if (idx !== -1) {
        memoryState.properties[idx] = { ...memoryState.properties[idx], ...req.body };
        return res.json({ success: true, property: memoryState.properties[idx], message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0628\u0646\u0649." });
      }
      return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0628\u0646\u0649 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0628\u0646\u0649." });
    }
  });
  apiRouter.delete("/properties/:id", authenticateToken, requireRoles(["SUPER_ADMIN"]), checkPropertyAccess, async (req, res) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
        await deletePropertyInDb(id);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
          action: "\u062D\u0630\u0641 \u0645\u0628\u0646\u0649 / \u0639\u0642\u0627\u0631",
          module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A",
          details: `\u062D\u0630\u0641 \u0627\u0644\u0645\u0628\u0646\u0649 ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u062C\u0627\u062D." });
      }
      if (memoryState.properties) {
        memoryState.properties = memoryState.properties.filter((p) => p.id !== id);
      }
      return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0645\u0628\u0646\u0649." });
    }
  });
  apiRouter.get("/units", authenticateToken, async (req, res) => {
    const user = req.user;
    const allowed = user.role === "SUPER_ADMIN" ? ["all"] : user.allowedProperties;
    if (process.env.DATABASE_URL) {
      const units = await getUnitsFromDb(allowed);
      return res.json({ success: true, units });
    }
    const isUniversal = allowed.includes("all");
    const filtered = isUniversal ? memoryState?.units || [] : (memoryState?.units || []).filter((u) => allowed.includes(u.propertyId));
    res.json({ success: true, units: filtered });
  });
  apiRouter.post("/units", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { propertyId, unitNumber } = req.body;
      if (!propertyId || !unitNumber) {
        return res.status(400).json({ success: false, message: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0639\u0642\u0627\u0631 \u0648\u0631\u0642\u0645 \u0627\u0644\u0648\u062D\u062F\u0629 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
      }
      const user = req.user;
      if (user.role !== "SUPER_ADMIN" && !user.allowedProperties?.includes(propertyId)) {
        return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u0636\u0627\u0641\u0629 \u0648\u062D\u062F\u0627\u062A \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
      }
      if (process.env.DATABASE_URL) {
        const unit = await createUnitInDb(req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
          action: "\u0625\u0646\u0634\u0627\u0621 \u0648\u062D\u062F\u0629 \u0633\u0643\u0646\u064A\u0629 \u062C\u062F\u064A\u062F\u0629",
          module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0648\u062D\u062F\u0627\u062A",
          details: `\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0648\u062D\u062F\u0629 ${unitNumber} \u0641\u064A \u0627\u0644\u0639\u0642\u0627\u0631 ${propertyId}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, unit, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
      }
      const newUnit = {
        id: req.body.id || `unit_${Date.now()}`,
        ...req.body,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (!memoryState.units) memoryState.units = [];
      memoryState.units.push(newUnit);
      return res.json({ success: true, unit: newUnit, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u0648\u062D\u062F\u0629." });
    }
  });
  apiRouter.put("/units/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
        const updated = await updateUnitInDb(id, req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
          action: "\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0648\u062D\u062F\u0629",
          module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0648\u062D\u062F\u0627\u062A",
          details: `\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0648\u062D\u062F\u0629 ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, unit: updated, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D." });
      }
      if (!memoryState.units) memoryState.units = [];
      const idx = memoryState.units.findIndex((u) => u.id === id);
      if (idx !== -1) {
        memoryState.units[idx] = { ...memoryState.units[idx], ...req.body };
        return res.json({ success: true, unit: memoryState.units[idx], message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0648\u062D\u062F\u0629." });
      }
      return res.status(404).json({ success: false, message: "\u0627\u0644\u0648\u062D\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0648\u062D\u062F\u0629." });
    }
  });
  apiRouter.delete("/units/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
        await deleteUnitInDb(id);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
          action: "\u062D\u0630\u0641 \u0648\u062D\u062F\u0629 \u0633\u0643\u0646\u064A\u0629",
          module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0648\u062D\u062F\u0627\u062A",
          details: `\u062D\u0630\u0641 \u0627\u0644\u0648\u062D\u062F\u0629 ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D." });
      }
      if (memoryState.units) {
        memoryState.units = memoryState.units.filter((u) => u.id !== id);
      }
      return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0648\u062D\u062F\u0629." });
    }
  });
  apiRouter.get("/bookings", authenticateToken, async (req, res) => {
    const user = req.user;
    const allowed = user.role === "SUPER_ADMIN" ? ["all"] : user.allowedProperties;
    if (process.env.DATABASE_URL) {
      const bookings = await getBookingsFromDb(allowed);
      return res.json({ success: true, bookings });
    }
    res.json({ success: true, bookings: memoryState?.bookings || [] });
  });
  apiRouter.get("/leases", authenticateToken, async (req, res) => {
    const user = req.user;
    const allowed = user.role === "SUPER_ADMIN" ? ["all"] : user.allowedProperties;
    if (process.env.DATABASE_URL) {
      const leases = await getLeasesFromDb(allowed);
      return res.json({ success: true, leases });
    }
    res.json({ success: true, leases: memoryState?.leases || [] });
  });
  apiRouter.get("/expenses", authenticateToken, async (req, res) => {
    const user = req.user;
    const allowed = user.role === "SUPER_ADMIN" ? ["all"] : user.allowedProperties;
    if (process.env.DATABASE_URL) {
      const expenses = await getExpensesFromDb(allowed);
      return res.json({ success: true, expenses });
    }
    res.json({ success: true, expenses: memoryState?.expenses || [] });
  });
  apiRouter.post("/expenses", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER", "ACCOUNTANT"]), async (req, res) => {
    try {
      const { title, amount, costCenterLevel } = req.body;
      if (!title || amount === void 0) {
        return res.status(400).json({ success: false, message: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0648\u0642\u064A\u0645\u062A\u0647 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
      }
      if (process.env.DATABASE_URL) {
        const exp = await createExpenseInDb({
          ...req.body,
          createdById: req.user?.userId
        });
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0627\u0644\u064A",
          action: "\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 \u062A\u0634\u063A\u064A\u0644\u064A",
          module: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
          details: `\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 ${title} \u0628\u0642\u064A\u0645\u0629 ${amount} \u0631.\u0633`,
          ipAddress: req.ip
        });
        return res.json({ success: true, expense: exp, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
      }
      const newExp = {
        id: req.body.id || `exp_${Date.now()}`,
        expenseNumber: `EXP-${Date.now().toString().slice(-6)}`,
        ...req.body,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (!memoryState.expenses) memoryState.expenses = [];
      memoryState.expenses.push(newExp);
      return res.json({ success: true, expense: newExp, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u0645\u0635\u0631\u0648\u0641." });
    }
  });
  apiRouter.put("/expenses/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER", "ACCOUNTANT"]), async (req, res) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
        const updated = await updateExpenseInDb(id, req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0627\u0644\u064A",
          action: "\u062A\u0639\u062F\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 \u062A\u0634\u063A\u064A\u0644\u064A",
          module: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
          details: `\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, expense: updated, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0628\u0646\u062C\u0627\u062D." });
      }
      if (!memoryState.expenses) memoryState.expenses = [];
      const idx = memoryState.expenses.findIndex((e) => e.id === id);
      if (idx !== -1) {
        memoryState.expenses[idx] = { ...memoryState.expenses[idx], ...req.body };
        return res.json({ success: true, expense: memoryState.expenses[idx], message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0635\u0631\u0648\u0641." });
      }
      return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0635\u0631\u0648\u0641." });
    }
  });
  apiRouter.delete("/expenses/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "ACCOUNTANT"]), async (req, res) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
        await deleteExpenseInDb(id);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0627\u0644\u064A",
          action: "\u062D\u0630\u0641 \u0645\u0635\u0631\u0648\u0641 \u062A\u0634\u063A\u064A\u0644\u064A",
          module: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
          details: `\u062D\u0630\u0641 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${id}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0628\u0646\u062C\u0627\u062D." });
      }
      if (memoryState.expenses) {
        memoryState.expenses = memoryState.expenses.filter((e) => e.id !== id);
      }
      return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0645\u0635\u0631\u0648\u0641." });
    }
  });
  apiRouter.put("/settings", authenticateToken, requireRoles(["SUPER_ADMIN"]), async (req, res) => {
    try {
      if (process.env.DATABASE_URL) {
        const updated = await updateCompanySettingsInDb(req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
          action: "\u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0648\u0647\u0648\u064A\u0629 \u0627\u0644\u0645\u0646\u0634\u0623\u0629",
          module: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629",
          details: "\u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0648\u0647\u0648\u064A\u0629 \u0627\u0644\u0634\u0631\u0643\u0629 \u0648\u0633\u0627\u0639\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0648\u0627\u0644\u0645\u0648\u0642\u0639",
          ipAddress: req.ip
        });
        return res.json({ success: true, settings: updated, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0648\u0647\u0648\u064A\u0629 \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
      }
      memoryState.settings = { ...memoryState.settings, ...req.body };
      return res.json({ success: true, settings: memoryState.settings, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A." });
    }
  });
  apiRouter.post("/media/upload", authenticateToken, async (req, res) => {
    try {
      const { base64Data, fileName, isPrivate } = req.body;
      if (!base64Data || !fileName) {
        return res.status(400).json({ success: false, message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0644\u0641 \u0648\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
      }
      const safeName = `${Date.now()}_${path2.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const targetDir = isPrivate ? PRIVATE_DOCS_DIR : UPLOADS_DIR;
      const targetPath = path2.join(targetDir, safeName);
      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      if (buffer.length > 15 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: "\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D (15 \u0645\u064A\u063A\u0627\u0628\u0627\u064A\u062A)." });
      }
      fs.writeFileSync(targetPath, buffer);
      const publicUrl = isPrivate ? `/api/documents/private/${safeName}` : `/uploads/${safeName}`;
      return res.json({
        success: true,
        url: publicUrl,
        fileName: safeName,
        message: "\u062A\u0645 \u0631\u0641\u0639 \u0648\u062A\u0623\u0645\u064A\u0646 \u0627\u0644\u0645\u0644\u0641 \u0628\u0646\u062C\u0627\u062D."
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641." });
    }
  });
  apiRouter.get("/state", authenticateToken, async (req, res) => {
    const user = req.user;
    const allowed = user.role === "SUPER_ADMIN" ? ["all"] : user.allowedProperties;
    if (process.env.DATABASE_URL) {
      try {
        const [settings, properties, units, bookings, leases, expenses, auditLogs] = await Promise.all([
          getCompanySettingsFromDb(),
          getPropertiesFromDb(allowed),
          getUnitsFromDb(allowed),
          getBookingsFromDb(allowed),
          getLeasesFromDb(allowed),
          getExpensesFromDb(allowed),
          user.role === "SUPER_ADMIN" ? getAuditLogsFromDb(100) : []
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
            users: void 0
            // Never return user list with hashes
          },
          timestamp: Date.now()
        });
      } catch (err) {
        return res.status(500).json({ success: false, message: "\u0641\u0634\u0644 \u062A\u062D\u0645\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645 \u0645\u0646 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
      }
    }
    res.json({
      success: true,
      state: memoryState,
      timestamp: Date.now()
    });
  });
  apiRouter.post("/bookings/daily", async (req, res) => {
    try {
      const result = await processDailyReservation(req.body);
      await recordAuditLogInDb({
        userName: req.body.guestName || "\u062D\u062C\u0632 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A",
        action: "\u062D\u062C\u0632 \u064A\u0648\u0645\u064A \u062C\u062F\u064A\u062F",
        module: "\u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0627\u0644\u0641\u0646\u062F\u0642\u064A\u0629",
        details: `\u062D\u062C\u0632 \u064A\u0648\u0645\u064A \u0644\u0644\u0648\u062D\u062F\u0629 ${req.body.unitId} \u0644\u0644\u0646\u0632\u064A\u0644 ${req.body.guestName} \u0628\u0642\u064A\u0645\u0629 ${result.totalAmount} \u0631.\u0633.`
      });
      return res.json({
        success: true,
        message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062D\u062C\u0632 \u0648\u0625\u0642\u0641\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629 \u0644\u0645\u0646\u0639 \u0623\u064A \u062A\u062F\u0627\u062E\u0644 \u0645\u062A\u0632\u0627\u0645\u0646.",
        ...result
      });
    } catch (err) {
      const status = err.statusCode || 400;
      return res.status(status).json({ success: false, message: err.message || "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062D\u062C\u0632." });
    }
  });
  apiRouter.post("/leases/contract", async (req, res) => {
    try {
      const result = await processLeaseContract(req.body);
      await recordAuditLogInDb({
        userName: req.body.tenantName || "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631",
        action: "\u0639\u0642\u062F \u062A\u0623\u062C\u064A\u0631 \u062C\u062F\u064A\u062F",
        module: "\u0639\u0642\u0648\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631",
        details: `\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 ${req.body.rentalType === "annual" ? "\u0633\u0646\u0648\u064A" : "\u0634\u0647\u0631\u064A"} \u0644\u0644\u0648\u062D\u062F\u0629 ${req.body.unitId} \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${req.body.tenantName}.`
      });
      return res.json({
        success: true,
        message: "\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0639\u0642\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0628\u0646\u062C\u0627\u062D \u0648\u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u0623\u0642\u0633\u0627\u0637 \u0648\u062D\u062C\u0632 \u0643\u0627\u0645\u0644 \u0641\u062A\u0631\u0629 \u0627\u0644\u0639\u0642\u062F.",
        ...result
      });
    } catch (err) {
      const status = err.statusCode || 400;
      return res.status(status).json({ success: false, message: err.message || "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0639\u0642\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631." });
    }
  });
  apiRouter.post("/bookings/check-and-reserve", async (req, res) => {
    try {
      const { unitId, startDate, endDate, guestName, rentalType, totalAmount } = req.body;
      if (!unitId || !startDate || !endDate) {
        return res.status(400).json({ success: false, message: "\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629." });
      }
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      if (isNaN(start) || isNaN(end) || start >= end) {
        return res.status(400).json({ success: false, message: "\u062A\u0648\u0627\u0631\u064A\u062E \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." });
      }
      if (!memoryState.bookings) memoryState.bookings = [];
      if (!memoryState.allocations) memoryState.allocations = [];
      const existingBookings = (memoryState.bookings || []).filter((b) => b.unitId === unitId && b.status !== "cancelled");
      const existingAllocations = (memoryState.allocations || []).filter((a) => a.unitId === unitId && a.status === "active");
      const hasConflict = existingBookings.some((b) => {
        const bStart = new Date(b.startDate || b.checkIn).getTime();
        const bEnd = new Date(b.endDate || b.checkOut).getTime();
        return start < bEnd && end > bStart;
      }) || existingAllocations.some((a) => {
        const aStart = new Date(a.startDate).getTime();
        const aEnd = new Date(a.endDate).getTime();
        return start < aEnd && end > aStart;
      });
      if (hasConflict) {
        return res.status(409).json({
          success: false,
          conflict: true,
          message: "\u0639\u0630\u0631\u0627\u064B\u060C \u0647\u0630\u0647 \u0627\u0644\u0648\u062D\u062F\u0629 \u0645\u062D\u062C\u0648\u0632\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629."
        });
      }
      if (process.env.DATABASE_URL) {
        const result = await processDailyReservation({
          unitId,
          checkIn: startDate,
          checkOut: endDate,
          guestName: guestName || "\u0639\u0645\u064A\u0644 \u062D\u062C\u0632",
          guestPhone: req.body.guestPhone || "+966500000000"
        });
        return res.json({
          success: true,
          booking: result.booking,
          allocation: result.allocation,
          message: "\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062D\u062C\u0632 \u0648\u0625\u0642\u0641\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0632\u0645\u0646\u064A\u0629 \u0644\u0645\u0646\u0639 \u0623\u064A \u062A\u062F\u0627\u062E\u0644 \u0645\u062A\u0632\u0627\u0645\u0646."
        });
      }
      const bookingNumber = `LH-${Math.floor(1e5 + Math.random() * 9e5)}`;
      const newBooking = {
        id: `bk_${Date.now()}`,
        bookingNumber,
        unitId,
        guestName: guestName || "\u0639\u0645\u064A\u0644 \u062D\u062C\u0632",
        startDate,
        endDate,
        rentalType: rentalType || "daily",
        totalAmount: totalAmount || 850,
        status: "confirmed",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const newAllocation = {
        id: `alloc_${Date.now()}`,
        unitId,
        startDate,
        endDate,
        rentalType: (rentalType || "daily").toUpperCase(),
        referenceId: bookingNumber,
        purpose: "booking",
        status: "active"
      };
      memoryState.bookings.push(newBooking);
      memoryState.allocations.push(newAllocation);
      return res.json({
        success: true,
        booking: newBooking,
        allocation: newAllocation,
        message: "\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062D\u062C\u0632 \u0648\u0625\u0642\u0641\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0632\u0645\u0646\u064A\u0629 \u0644\u0645\u0646\u0639 \u0623\u064A \u062A\u062F\u0627\u062E\u0644 \u0645\u062A\u0632\u0627\u0645\u0646."
      });
    } catch (err) {
      const status = err.statusCode || 409;
      return res.status(status).json({
        success: false,
        conflict: true,
        message: err.message || "\u0639\u0630\u0631\u0627\u064B\u060C \u0647\u0630\u0647 \u0627\u0644\u0648\u062D\u062F\u0629 \u0645\u062D\u062C\u0648\u0632\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629."
      });
    }
  });
  apiRouter.post("/financials/allocate", (req, res) => {
    try {
      const result = computeCostAllocation(req.body);
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });
  apiRouter.post("/financials/calculate-distribution", (req, res) => {
    try {
      const { buildingRent, guardSalary, adminSalary, electricityBill, directMaintenance, units, allocationMethod } = req.body;
      const bRent = buildingRent !== void 0 && buildingRent !== null ? Number(buildingRent) : 12e4;
      const gSalary = guardSalary !== void 0 && guardSalary !== null ? Number(guardSalary) : 3e3;
      const aSalary = adminSalary !== void 0 && adminSalary !== null ? Number(adminSalary) : 1e4;
      const eBill = electricityBill !== void 0 && electricityBill !== null ? Number(electricityBill) : 1500;
      const dMaint = directMaintenance !== void 0 && directMaintenance !== null ? Number(directMaintenance) : 500;
      const monthlyBuildingRent = Math.round(bRent / 12 * 100) / 100;
      const totalBuildingOPEX = Math.round((monthlyBuildingRent + gSalary + aSalary + eBill) * 100) / 100;
      const totalDirectUnitOPEX = dMaint;
      const companyTotalOPEX = Math.round((totalBuildingOPEX + totalDirectUnitOPEX) * 100) / 100;
      const unitsList = Array.isArray(units) && units.length > 0 ? units : [
        { id: "101", unitNumber: "101", areaSqm: 50, isOccupied: true },
        { id: "102", unitNumber: "102", areaSqm: 50, isOccupied: true },
        { id: "103", unitNumber: "103", areaSqm: 50, isOccupied: false },
        { id: "104", unitNumber: "104", areaSqm: 50, isOccupied: false },
        { id: "105", unitNumber: "105", areaSqm: 50, isOccupied: true },
        { id: "106", unitNumber: "106", areaSqm: 50, isOccupied: true },
        { id: "107", unitNumber: "107", areaSqm: 50, isOccupied: true },
        { id: "108", unitNumber: "108", areaSqm: 50, isOccupied: true },
        { id: "109", unitNumber: "109", areaSqm: 50, isOccupied: false },
        { id: "110", unitNumber: "110", areaSqm: 50, isOccupied: true }
      ];
      const allocationResult = computeCostAllocation({
        title: "\u0627\u0644\u0645\u0635\u0627\u0631\u064A\u0641 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A\u0629 \u0644\u0644\u0645\u0628\u0646\u0649",
        amount: totalBuildingOPEX,
        costCenterLevel: "PROPERTY",
        allocationMethod: allocationMethod || "EQUAL_UNITS",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        units: unitsList
      });
      const allocatedUnits = unitsList.map((u) => {
        const share = allocationResult.shares.find((s) => s.unitId === u.id);
        const allocatedShare = share ? share.shareAmount : 0;
        const direct = u.id === "101" ? dMaint : 0;
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
        calculationEngine: "Verified Server Accrual & Exact Cost Allocation Engine",
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
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });
  apiRouter.get("/financials/statement/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      if (process.env.DATABASE_URL) {
        const lease2 = await prisma.lease.findFirst({
          where: { OR: [{ id }, { contractNumber: id }, { unitId: id }] },
          include: {
            unit: { include: { property: true } },
            installments: { orderBy: { number: "asc" } },
            payments: { orderBy: { paidAt: "desc" } },
            securityDeposits: true
          }
        });
        if (!lease2) {
          return res.status(404).json({ success: false, message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0639\u0642\u062F \u0623\u0648 \u0643\u0634\u0641 \u062D\u0633\u0627\u0628 \u0644\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062D\u062F\u062F\u0629." });
        }
        const isSuperAdmin = user.role === "SUPER_ADMIN";
        const isPropertyAllowed = Array.isArray(user.allowedProperties) && (user.allowedProperties.includes("all") || user.allowedProperties.includes(lease2.unit?.propertyId));
        const isTenantOwner = user.role === "TENANT" && (user.email === lease2.tenantEmail || user.userId === lease2.tenantIdNumber);
        if (!isSuperAdmin && !isPropertyAllowed && !isTenantOwner) {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0639\u0631\u0636 \u0643\u0634\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u064A \u0644\u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u062F."
          });
        }
        const totalRent = Number(lease2.annualRent);
        const totalPaid = lease2.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalDeposit = lease2.securityDeposits.reduce((sum, d) => sum + Number(d.amount), 0);
        return res.json({
          success: true,
          statement: {
            contractNumber: lease2.contractNumber,
            tenantName: lease2.tenantName,
            tenantPhone: lease2.tenantPhone,
            tenantEmail: lease2.tenantEmail,
            unitNumber: lease2.unit?.unitNumber,
            propertyName: lease2.unit?.property?.name,
            startDate: lease2.startDate,
            endDate: lease2.endDate,
            rentalType: lease2.rentalType,
            totalRent,
            totalPaid,
            remainingBalance: Math.max(0, totalRent - totalPaid),
            securityDeposit: {
              totalHeld: totalDeposit,
              status: lease2.securityDeposits[0]?.status || "held"
            },
            installments: serializeDecimals(lease2.installments),
            payments: serializeDecimals(lease2.payments)
          }
        });
      }
      const lease = (memoryState?.leases || []).find((l) => l.id === id || l.contractNumber === id || l.unitId === id);
      if (!lease) {
        return res.status(404).json({ success: false, message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0639\u0642\u062F \u0623\u0648 \u0643\u0634\u0641 \u062D\u0633\u0627\u0628 \u0644\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062D\u062F\u062F\u0629." });
      }
      return res.json({ success: true, statement: lease });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message || "\u0641\u0634\u0644 \u062A\u0648\u0644\u064A\u062F \u0643\u0634\u0641 \u0627\u0644\u062D\u0633\u0627\u0628." });
    }
  });
  apiRouter.post("/admin/import-data", authenticateToken, requireRoles(["SUPER_ADMIN"]), async (req, res) => {
    const { mode, payload } = req.body;
    const dataToImport = payload || memoryState;
    if (!dataToImport || typeof dataToImport !== "object") {
      return res.status(400).json({ success: false, message: "\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0631\u0627\u062F \u0627\u0633\u062A\u064A\u0631\u0627\u062F\u0647\u0627 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." });
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
    if (mode === "preview") {
      return res.json({
        success: true,
        mode: "preview",
        message: "\u062A\u0645\u062A \u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u062D\u0635\u0631 \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0628\u0646\u062C\u0627\u062D.",
        preview: previewSummary
      });
    }
    if (mode === "commit") {
      try {
        let importedStats = null;
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
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
          action: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0646\u0636\u0628\u0637",
          module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u062A\u0631\u062D\u064A\u0644",
          details: `\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0634\u063A\u064A\u0644\u064A\u0629 \u062C\u062F\u064A\u062F\u0629 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.`
        });
        return res.json({
          success: true,
          mode: "commit",
          message: "\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0648\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.",
          imported: importedStats
        });
      } catch (importErr) {
        return res.status(500).json({ success: false, message: `\u0641\u0634\u0644 \u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A: ${importErr.message}` });
      }
    }
    return res.status(400).json({ success: false, message: "\u0648\u0636\u0639 \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 preview \u0623\u0648 commit." });
  });
  apiRouter.get("/documents/private/:docName", authenticateToken, (req, res) => {
    const safeDocName = path2.basename(req.params.docName);
    const docPath = path2.join(PRIVATE_DOCS_DIR, safeDocName);
    if (!docPath.startsWith(PRIVATE_DOCS_DIR)) {
      return res.status(403).json({ success: false, message: "\u0645\u0633\u0627\u0631 \u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647." });
    }
    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    res.sendFile(docPath);
  });
  apiRouter.post("/backup/export", authenticateToken, requireRoles(["SUPER_ADMIN"]), async (req, res) => {
    const backupFileName = `backup_${Date.now()}.json`;
    const backupFilePath = path2.join(BACKUP_DIR, backupFileName);
    try {
      let stateToExport = null;
      if (process.env.DATABASE_URL) {
        stateToExport = await exportFullDatabase();
      } else {
        stateToExport = memoryState;
      }
      fs.writeFileSync(backupFilePath, JSON.stringify(stateToExport, null, 2), "utf-8");
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
        action: "\u062A\u0635\u062F\u064A\u0631 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629",
        module: "\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A",
        details: `\u062A\u0635\u062F\u064A\u0631 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u062C\u062F\u064A\u062F\u0629: ${backupFileName}`
      });
      res.json({
        success: true,
        message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0648\u062D\u0641\u0638 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0628\u0646\u062C\u0627\u062D.",
        backupFile: backupFileName,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (e) {
      res.status(500).json({ success: false, message: `\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629: ${e?.message}` });
    }
  });
  apiRouter.post("/backup/restore", authenticateToken, requireRoles(["SUPER_ADMIN"]), async (req, res) => {
    const { backupFileName } = req.body;
    if (!backupFileName) return res.status(400).json({ success: false, message: "\u0627\u0633\u0645 \u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0645\u0637\u0644\u0648\u0628." });
    const safeFileName = path2.basename(backupFileName);
    const backupFilePath = path2.join(BACKUP_DIR, safeFileName);
    if (!backupFilePath.startsWith(BACKUP_DIR) || !fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, message: "\u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    try {
      const data = fs.readFileSync(backupFilePath, "utf-8");
      const restored = JSON.parse(data);
      if (process.env.DATABASE_URL) {
        await importDataIntoDb(restored);
      } else {
        memoryState = restored;
      }
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
        action: "\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629",
        module: "\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A",
        details: `\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u062D\u0627\u0644\u0629 \u0627\u0644\u0646\u0638\u0627\u0645 \u0645\u0646 \u0627\u0644\u0645\u0644\u0641: ${safeFileName}`
      });
      res.json({
        success: true,
        message: "\u062A\u0645\u062A \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D \u0645\u0646 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0625\u0644\u0649 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (e) {
      res.status(500).json({ success: false, message: `\u0641\u0634\u0644 \u0642\u0631\u0627\u0621\u0629 \u0648\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629: ${e?.message}` });
    }
  });
  app.use("/api", apiRouter);
  if (process.env.NODE_ENV === "production") {
    if (fs.existsSync(DIST_DIR)) {
      app.use(express.static(DIST_DIR));
      app.get("*", (req, res) => {
        res.sendFile(path2.resolve(DIST_DIR, "index.html"));
      });
    } else {
      app.get("*", (req, res) => {
        res.send("Server running. Dist directory not built.");
      });
    }
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  const serverInstance = app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  });
  return serverInstance;
}
var execPath = process.argv[1] || "";
var isDirectExecution = (execPath.endsWith("server.ts") || execPath.endsWith("server.js") || execPath.includes("dist-server")) && !process.env.TEST_SUITE_RUNNER;
if (isDirectExecution) {
  startServer().catch((err) => {
    console.error("[Server Start Error]:", err);
    process.exit(1);
  });
}
export {
  startServer
};
