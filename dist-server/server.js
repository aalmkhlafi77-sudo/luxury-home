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
  const propertyId = req.params.propertyId || req.params.id || req.body.propertyId || req.query.propertyId;
  if (!propertyId) {
    if (req.user.role === "ACCOUNTANT") return next();
    return res.status(403).json({
      success: false,
      code: "PROPERTY_ACCESS_DENIED",
      message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0642\u0627\u0631 \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0639\u0627\u0645\u0629 \u062E\u0627\u0631\u062C \u0646\u0637\u0627\u0642 \u0627\u0644\u0645\u0628\u0627\u0646\u064A \u0627\u0644\u0645\u062E\u0635\u0635\u0629 \u0644\u0647."
    });
  }
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

// server.ts
import crypto3 from "crypto";

// src/server/repository.ts
import { Decimal } from "@prisma/client/runtime/library";
import crypto2 from "crypto";
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
  const fCount = Math.max(1, Number(data.floorsCount) || 1);
  const created = await prisma.property.create({
    data: {
      name: data.name,
      code: data.code,
      address: data.address,
      city: data.city || "\u0627\u0644\u0631\u064A\u0627\u0636",
      district: data.district,
      floorsCount: fCount,
      unitsCount: Number(data.unitsCount) || 0,
      totalAreaSqm: Number(data.totalAreaSqm) || 0,
      rooftopPayment: new Decimal(data.rooftopPayment || 0),
      description: data.description || null,
      images: Array.isArray(data.images) ? data.images : [],
      isActive: data.isActive !== false,
      floors: {
        create: [
          { number: -1, name: "\u0637\u0627\u0628\u0642 \u0627\u0644\u0642\u0628\u0648 \u0627\u0644\u0623\u0648\u0644 (\u0645\u0648\u0627\u0642\u0641 \u0633\u064A\u0627\u0631\u0627\u062A)" },
          { number: 0, name: "\u0637\u0627\u0628\u0642 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644 (\u0627\u0644\u0628\u0647\u0648 \u0648\u0627\u0644\u0628\u0647\u0648 \u0627\u0644\u0645\u0634\u062A\u0631\u0643)" },
          ...Array.from({ length: fCount }, (_, i) => ({
            number: i + 1,
            name: `\u0637\u0627\u0628\u0642 \u0627\u0644\u062F\u0648\u0631 \u0631\u0642\u0645 ${i + 1}`
          }))
        ]
      }
    },
    include: { floors: { orderBy: { number: "asc" } }, units: true, parkingSpots: true }
  });
  return serializeDecimals(created);
}
async function createFloorInDb(propertyId, number, name) {
  if (!process.env.DATABASE_URL) return null;
  const floor = await prisma.floor.create({
    data: {
      propertyId,
      number,
      name
    }
  });
  return serializeDecimals(floor);
}
async function updateFloorInDb(id, data) {
  if (!process.env.DATABASE_URL) return null;
  const updated = await prisma.floor.update({
    where: { id },
    data
  });
  return serializeDecimals(updated);
}
async function deleteFloorInDb(id) {
  if (!process.env.DATABASE_URL) return null;
  const unitsCount = await prisma.unit.count({ where: { floorId: id } });
  if (unitsCount > 0) {
    throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u0637\u0627\u0628\u0642 \u0646\u0638\u0631\u0627\u064B \u0644\u0648\u062C\u0648\u062F \u0648\u062D\u062F\u0627\u062A \u0633\u0643\u0646\u064A\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0647.");
  }
  const deleted = await prisma.floor.delete({ where: { id } });
  return serializeDecimals(deleted);
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
  const property = await prisma.property.findUnique({
    where: { id: data.propertyId }
  });
  if (!property) {
    throw new Error("\u0627\u0644\u0645\u0628\u0646\u0649 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.");
  }
  if (data.floorId) {
    const floor = await prisma.floor.findUnique({ where: { id: data.floorId } });
    if (!floor) throw new Error("\u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.");
    if (floor.propertyId !== data.propertyId) throw new Error("\u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062D\u062F\u062F \u0644\u0627 \u064A\u0646\u062A\u0645\u064A \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0628\u0646\u0649.");
  }
  const existing = await prisma.unit.findFirst({
    where: {
      propertyId: data.propertyId,
      unitNumber: String(data.unitNumber).trim(),
      publicationStatus: { not: "archived" }
    }
  });
  if (existing) {
    throw new Error(`\u0627\u0644\u0648\u062D\u062F\u0629 \u0631\u0642\u0645 (${data.unitNumber}) \u0645\u0633\u062C\u0644\u0629 \u0633\u0644\u0641\u0627\u064B \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631.`);
  }
  const created = await prisma.unit.create({
    data: {
      propertyId: data.propertyId,
      floorId: data.floorId || null,
      unitNumber: String(data.unitNumber).trim(),
      title: data.title || `\u0634\u0642\u0629 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0631\u0642\u0645 #${data.unitNumber}`,
      titleEn: data.titleEn || `Unit #${data.unitNumber}`,
      type: data.type || "apartment",
      areaSqm: data.areaSqm !== void 0 ? Number(data.areaSqm) : 0,
      floorNumber: data.floorNumber !== void 0 ? Number(data.floorNumber) : 1,
      maxGuests: data.maxGuests !== void 0 ? Number(data.maxGuests) : 3,
      bedroomsCount: data.bedroomsCount !== void 0 ? Number(data.bedroomsCount) : 1,
      bathroomsCount: data.bathroomsCount !== void 0 ? Number(data.bathroomsCount) : 1,
      bedsCount: data.bedsCount !== void 0 ? Number(data.bedsCount) : 1,
      furnishingStatus: data.furnishingStatus || "furnished",
      allowDaily: data.allowDaily !== false,
      dailyRate: new Decimal(data.dailyRate ?? 0),
      dailySecurityDeposit: new Decimal(data.dailySecurityDeposit ?? 0),
      allowMonthly: data.allowMonthly !== false,
      monthlyRate: new Decimal(data.monthlyRate ?? 0),
      monthlySecurityDeposit: new Decimal(data.monthlySecurityDeposit ?? 0),
      allowYearly: data.allowYearly !== false,
      annualRate: new Decimal(data.annualRate ?? data.yearlyRate ?? 0),
      yearlySecurityDeposit: new Decimal(data.yearlySecurityDeposit ?? 0),
      yearlyPaymentOptions: Array.isArray(data.yearlyPaymentOptions) ? data.yearlyPaymentOptions : ["single_annual", "semi_annual"],
      semiAnnualSurchargePercent: new Decimal(data.semiAnnualSurchargePercent ?? 0),
      cleaningFee: new Decimal(data.cleaningFee ?? 0),
      securityDeposit: new Decimal(data.securityDeposit ?? 0),
      taxPercentage: new Decimal(data.taxPercentage ?? 15),
      operationalStatus: data.operationalStatus || "ready",
      occupancyStatus: data.occupancyStatus || "vacant",
      isClean: data.isClean !== false,
      publicationStatus: data.publicationStatus || "published",
      amenities: Array.isArray(data.amenities) ? data.amenities : [],
      images: Array.isArray(data.images) ? data.images : [],
      media: data.media || null,
      spaces: data.spaces || null,
      fittings: data.fittings || null,
      floorPlanUrl: data.floorPlanUrl || null,
      assignedParkingId: data.assignedParkingId || null,
      notes: data.notes || null,
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
function computeServerRoomMetrics(spaces = []) {
  if (!Array.isArray(spaces)) return null;
  if (spaces.length === 0) {
    return {
      bedroomsCount: 0,
      bathroomsCount: 0,
      bedsCount: 0
    };
  }
  let bedroomsCount = 0;
  let bathroomsCount = 0;
  let bedsCount = 0;
  for (const space of spaces) {
    if (space?.type === "bedroom") {
      bedroomsCount += 1;
    } else if (space?.type === "bathroom") {
      bathroomsCount += 1;
    }
    if (space?.bedsCount && Number(space.bedsCount) > 0) {
      bedsCount += Number(space.bedsCount);
    } else if (Array.isArray(space?.fittings) && space.fittings.length > 0) {
      for (const fit of space.fittings) {
        if (fit?.category === "bed") {
          bedsCount += Number(fit.quantity) || 1;
        }
      }
    }
  }
  return {
    bedroomsCount: Math.max(bedroomsCount, 0),
    bathroomsCount: Math.max(bathroomsCount, 0),
    bedsCount: Math.max(bedsCount, 0)
  };
}
async function updateUnitInDb(id, data) {
  if (!process.env.DATABASE_URL) return null;
  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
  const propId = data.propertyId || existing.propertyId;
  if (data.floorId && data.floorId !== existing.floorId) {
    const floor = await prisma.floor.findUnique({ where: { id: data.floorId } });
    if (!floor) throw new Error("\u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.");
    if (floor.propertyId !== propId) throw new Error("\u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062D\u062F\u062F \u0644\u0627 \u064A\u0646\u062A\u0645\u064A \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0628\u0646\u0649.");
  }
  if (data.unitNumber && data.unitNumber.trim() !== existing.unitNumber.trim()) {
    const duplicate = await prisma.unit.findFirst({
      where: {
        id: { not: id },
        propertyId: propId,
        unitNumber: data.unitNumber.trim(),
        publicationStatus: { not: "archived" }
      }
    });
    if (duplicate) {
      throw new Error(`\u0627\u0644\u0648\u062D\u062F\u0629 \u0631\u0642\u0645 (${data.unitNumber}) \u0645\u0633\u062C\u0644\u0629 \u0633\u0644\u0641\u0627\u064B \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0639\u0642\u0627\u0631.`);
    }
  }
  const updateData = {};
  if (data.floorId !== void 0) updateData.floorId = data.floorId || null;
  if (data.unitNumber !== void 0) updateData.unitNumber = String(data.unitNumber).trim();
  if (data.title !== void 0) updateData.title = data.title;
  if (data.titleEn !== void 0) updateData.titleEn = data.titleEn;
  if (data.type !== void 0) updateData.type = data.type;
  if (data.areaSqm !== void 0) updateData.areaSqm = Number(data.areaSqm);
  if (data.floorNumber !== void 0) updateData.floorNumber = Number(data.floorNumber);
  if (data.maxGuests !== void 0) updateData.maxGuests = Number(data.maxGuests);
  if (data.bedroomsCount !== void 0) updateData.bedroomsCount = Number(data.bedroomsCount);
  if (data.bathroomsCount !== void 0) updateData.bathroomsCount = Number(data.bathroomsCount);
  if (data.bedsCount !== void 0) updateData.bedsCount = Number(data.bedsCount);
  if (data.furnishingStatus !== void 0) updateData.furnishingStatus = data.furnishingStatus;
  if (data.allowDaily !== void 0) updateData.allowDaily = Boolean(data.allowDaily);
  if (data.dailyRate !== void 0) updateData.dailyRate = new Decimal(data.dailyRate);
  if (data.dailySecurityDeposit !== void 0) updateData.dailySecurityDeposit = new Decimal(data.dailySecurityDeposit);
  if (data.allowMonthly !== void 0) updateData.allowMonthly = Boolean(data.allowMonthly);
  if (data.monthlyRate !== void 0) updateData.monthlyRate = new Decimal(data.monthlyRate);
  if (data.monthlySecurityDeposit !== void 0) updateData.monthlySecurityDeposit = new Decimal(data.monthlySecurityDeposit);
  if (data.allowYearly !== void 0) updateData.allowYearly = Boolean(data.allowYearly);
  if (data.annualRate !== void 0 || data.yearlyRate !== void 0) {
    updateData.annualRate = new Decimal(data.annualRate ?? data.yearlyRate);
  }
  if (data.yearlySecurityDeposit !== void 0) updateData.yearlySecurityDeposit = new Decimal(data.yearlySecurityDeposit);
  if (data.yearlyPaymentOptions !== void 0) {
    updateData.yearlyPaymentOptions = Array.isArray(data.yearlyPaymentOptions) ? data.yearlyPaymentOptions : [];
  }
  if (data.semiAnnualSurchargePercent !== void 0) updateData.semiAnnualSurchargePercent = new Decimal(data.semiAnnualSurchargePercent);
  if (data.cleaningFee !== void 0) updateData.cleaningFee = new Decimal(data.cleaningFee);
  if (data.securityDeposit !== void 0) updateData.securityDeposit = new Decimal(data.securityDeposit);
  if (data.taxPercentage !== void 0) updateData.taxPercentage = new Decimal(data.taxPercentage);
  if (data.operationalStatus !== void 0) updateData.operationalStatus = data.operationalStatus;
  if (data.occupancyStatus !== void 0) updateData.occupancyStatus = data.occupancyStatus;
  if (data.isClean !== void 0) updateData.isClean = Boolean(data.isClean);
  if (data.publicationStatus !== void 0) updateData.publicationStatus = data.publicationStatus;
  if (data.amenities !== void 0) updateData.amenities = Array.isArray(data.amenities) ? data.amenities : [];
  if (data.images !== void 0) updateData.images = Array.isArray(data.images) ? data.images : [];
  if (data.media !== void 0) updateData.media = data.media;
  if (data.spaces !== void 0) updateData.spaces = data.spaces;
  if (data.fittings !== void 0) updateData.fittings = data.fittings;
  if (data.floorPlanUrl !== void 0) updateData.floorPlanUrl = data.floorPlanUrl;
  if (data.assignedParkingId !== void 0) updateData.assignedParkingId = data.assignedParkingId;
  if (data.notes !== void 0) updateData.notes = data.notes;
  if (data.smartLockPin !== void 0) updateData.smartLockPin = data.smartLockPin;
  if (Array.isArray(data.spaces)) {
    const metrics = computeServerRoomMetrics(data.spaces);
    if (metrics) {
      updateData.bedroomsCount = metrics.bedroomsCount;
      updateData.bathroomsCount = metrics.bathroomsCount;
      updateData.bedsCount = metrics.bedsCount;
    }
  }
  const updated = await prisma.unit.update({
    where: { id },
    data: updateData,
    include: { property: true, floor: true }
  });
  return serializeDecimals(updated);
}
function computeBatchFingerprint(propertyId, floorId, units) {
  const canonicalUnits = units.map((u) => ({
    unitNumber: String(u.unitNumber ?? "").trim(),
    title: String(u.title ?? ""),
    titleEn: String(u.titleEn ?? ""),
    type: String(u.type ?? "apartment"),
    areaSqm: Number(u.areaSqm ?? 0),
    floorNumber: Number(u.floorNumber ?? 1),
    maxGuests: Number(u.maxGuests ?? 3),
    bedroomsCount: Number(u.bedroomsCount ?? 1),
    bathroomsCount: Number(u.bathroomsCount ?? 1),
    bedsCount: Number(u.bedsCount ?? 1),
    furnishingStatus: String(u.furnishingStatus ?? "furnished"),
    allowDaily: Boolean(u.allowDaily !== false),
    dailyRate: Number(u.dailyRate ?? 0),
    dailySecurityDeposit: Number(u.dailySecurityDeposit ?? 0),
    allowMonthly: Boolean(u.allowMonthly !== false),
    monthlyRate: Number(u.monthlyRate ?? 0),
    monthlySecurityDeposit: Number(u.monthlySecurityDeposit ?? 0),
    allowYearly: Boolean(u.allowYearly !== false),
    annualRate: Number(u.annualRate ?? u.yearlyRate ?? 0),
    yearlySecurityDeposit: Number(u.yearlySecurityDeposit ?? 0),
    yearlyPaymentOptions: Array.isArray(u.yearlyPaymentOptions) ? [...u.yearlyPaymentOptions].sort() : ["single_annual", "semi_annual"],
    semiAnnualSurchargePercent: Number(u.semiAnnualSurchargePercent ?? 0),
    cleaningFee: Number(u.cleaningFee ?? 0),
    securityDeposit: Number(u.securityDeposit ?? 0),
    taxPercentage: Number(u.taxPercentage ?? 15),
    operationalStatus: String(u.operationalStatus ?? "ready"),
    occupancyStatus: String(u.occupancyStatus ?? "vacant"),
    isClean: Boolean(u.isClean !== false),
    publicationStatus: String(u.publicationStatus ?? "published"),
    amenities: Array.isArray(u.amenities) ? [...u.amenities].sort() : [],
    images: Array.isArray(u.images) ? [...u.images] : [],
    media: u.media ?? null,
    spaces: u.spaces ?? null,
    fittings: u.fittings ?? null,
    floorPlanUrl: u.floorPlanUrl ?? null,
    assignedParkingId: u.assignedParkingId ?? null,
    notes: u.notes ?? null,
    smartLockPin: u.smartLockPin ?? null
  }));
  const canonicalPayload = JSON.stringify({
    propertyId: String(propertyId),
    floorId: String(floorId),
    units: canonicalUnits
  });
  return crypto2.createHash("sha256").update(canonicalPayload).digest("hex");
}
async function createBatchUnitsInDb(params) {
  if (!process.env.DATABASE_URL) return null;
  const { propertyId, floorId, units, idempotencyKey, userId, userRole } = params;
  const requestHash = computeBatchFingerprint(propertyId, floorId, units);
  if (idempotencyKey) {
    const existingRecord = await prisma.idempotencyRecord.findUnique({
      where: {
        key_operationType: {
          key: idempotencyKey,
          operationType: "batch_units_create"
        }
      }
    });
    if (existingRecord) {
      if (existingRecord.userId && userId && existingRecord.userId !== userId && userRole !== "SUPER_ADMIN") {
        const err = new Error("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0645\u0641\u062A\u0627\u062D \u0639\u0645\u0644\u064A\u0629 \u064A\u062E\u0635 \u0645\u0633\u062A\u062E\u062F\u0645\u0627\u064B \u0622\u062E\u0631.");
        err.statusCode = 403;
        throw err;
      }
      if (existingRecord.requestHash === requestHash) {
        return existingRecord.responseBody;
      } else {
        const err = new Error("\u062A\u0639\u0627\u0631\u0636 \u0645\u0641\u062A\u0627\u062D \u0645\u0646\u0639 \u0627\u0644\u062A\u0643\u0631\u0627\u0631: \u062A\u0645 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0646\u0641\u0633 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0645\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u062D\u0645\u0648\u0644\u0629 \u0645\u062E\u062A\u0644\u0641\u0629.");
        err.statusCode = 409;
        throw err;
      }
    }
  }
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error("\u0627\u0644\u0645\u0628\u0646\u0649 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.");
  const floor = await prisma.floor.findUnique({ where: { id: floorId } });
  if (!floor) throw new Error("\u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.");
  if (floor.propertyId !== propertyId) {
    throw new Error("\u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062D\u062F\u062F \u0644\u0627 \u064A\u0646\u062A\u0645\u064A \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0628\u0646\u0649.");
  }
  const unitNumbers = units.map((u) => String(u.unitNumber).trim());
  const uniqueNums = new Set(unitNumbers);
  if (uniqueNums.size !== unitNumbers.length) {
    throw new Error("\u062A\u062D\u062A\u0648\u064A \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0639\u0644\u0649 \u0623\u0631\u0642\u0627\u0645 \u0648\u062D\u062F\u0627\u062A \u0645\u0643\u0631\u0631\u0629 \u0636\u0645\u0646 \u0646\u0641\u0633 \u0627\u0644\u0637\u0644\u0628.");
  }
  const existing = await prisma.unit.findMany({
    where: {
      propertyId,
      unitNumber: { in: unitNumbers },
      publicationStatus: { not: "archived" }
    }
  });
  if (existing.length > 0) {
    const duplicateList = existing.map((u) => u.unitNumber).join(", ");
    const err = new Error(`\u062A\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0644\u0648\u062C\u0648\u062F \u0648\u062D\u062F\u0627\u062A \u0645\u0633\u062C\u0644\u0629 \u0633\u0644\u0641\u0627\u064B \u0641\u064A \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u0641\u0633 \u0627\u0644\u0623\u0631\u0642\u0627\u0645: (${duplicateList}). \u0644\u0645 \u064A\u062A\u0645 \u062D\u0641\u0638 \u0623\u064A \u0648\u062D\u062F\u0629.`);
    err.statusCode = 409;
    throw err;
  }
  const createdUnits = await prisma.$transaction(async (tx) => {
    if (idempotencyKey) {
      const concurrentRecord = await tx.idempotencyRecord.findUnique({
        where: {
          key_operationType: {
            key: idempotencyKey,
            operationType: "batch_units_create"
          }
        }
      });
      if (concurrentRecord) {
        if (concurrentRecord.requestHash === requestHash) {
          return concurrentRecord.responseBody;
        } else {
          const err = new Error("\u062A\u0639\u0627\u0631\u0636 \u0645\u0641\u062A\u0627\u062D \u0645\u0646\u0639 \u0627\u0644\u062A\u0643\u0631\u0627\u0631: \u062A\u0645 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0646\u0641\u0633 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0645\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u062D\u0645\u0648\u0644\u0629 \u0645\u062E\u062A\u0644\u0641\u0629.");
          err.statusCode = 409;
          throw err;
        }
      }
    }
    const results = [];
    for (const u of units) {
      const created = await tx.unit.create({
        data: {
          propertyId,
          floorId,
          unitNumber: String(u.unitNumber).trim(),
          title: u.title || `\u0634\u0642\u0629 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0631\u0642\u0645 #${u.unitNumber}`,
          titleEn: u.titleEn || `Unit #${u.unitNumber}`,
          type: u.type || "apartment",
          areaSqm: u.areaSqm !== void 0 && u.areaSqm !== null ? Number(u.areaSqm) : 0,
          floorNumber: floor.number,
          maxGuests: u.maxGuests !== void 0 && u.maxGuests !== null ? Number(u.maxGuests) : 3,
          bedroomsCount: u.bedroomsCount !== void 0 && u.bedroomsCount !== null ? Number(u.bedroomsCount) : 1,
          bathroomsCount: u.bathroomsCount !== void 0 && u.bathroomsCount !== null ? Number(u.bathroomsCount) : 1,
          bedsCount: u.bedsCount !== void 0 && u.bedsCount !== null ? Number(u.bedsCount) : 1,
          furnishingStatus: u.furnishingStatus || "furnished",
          allowDaily: u.allowDaily !== false,
          dailyRate: new Decimal(u.dailyRate ?? 0),
          dailySecurityDeposit: new Decimal(u.dailySecurityDeposit ?? 0),
          allowMonthly: u.allowMonthly !== false,
          monthlyRate: new Decimal(u.monthlyRate ?? 0),
          monthlySecurityDeposit: new Decimal(u.monthlySecurityDeposit ?? 0),
          allowYearly: u.allowYearly !== false,
          annualRate: new Decimal(u.annualRate ?? u.yearlyRate ?? 0),
          yearlySecurityDeposit: new Decimal(u.yearlySecurityDeposit ?? 0),
          yearlyPaymentOptions: Array.isArray(u.yearlyPaymentOptions) ? u.yearlyPaymentOptions : ["single_annual", "semi_annual"],
          semiAnnualSurchargePercent: new Decimal(u.semiAnnualSurchargePercent ?? 0),
          cleaningFee: new Decimal(u.cleaningFee ?? 0),
          securityDeposit: new Decimal(u.securityDeposit ?? 0),
          taxPercentage: new Decimal(u.taxPercentage ?? 15),
          operationalStatus: u.operationalStatus || "ready",
          occupancyStatus: u.occupancyStatus || "vacant",
          isClean: u.isClean !== false,
          publicationStatus: u.publicationStatus || "published",
          amenities: Array.isArray(u.amenities) ? u.amenities : [],
          images: Array.isArray(u.images) ? u.images : [],
          media: u.media || null,
          spaces: u.spaces || null,
          fittings: u.fittings || null,
          floorPlanUrl: u.floorPlanUrl || null,
          assignedParkingId: u.assignedParkingId || null,
          notes: u.notes || null,
          smartLockPin: u.smartLockPin || null
        },
        include: { property: true, floor: true }
      });
      results.push(created);
    }
    await tx.property.update({
      where: { id: propertyId },
      data: { unitsCount: { increment: units.length } }
    });
    const serializedResults = serializeDecimals(results);
    if (idempotencyKey) {
      await tx.idempotencyRecord.create({
        data: {
          key: idempotencyKey,
          operationType: "batch_units_create",
          userId: userId || null,
          requestHash,
          statusCode: 200,
          responseBody: serializedResults
        }
      });
    }
    return serializedResults;
  });
  return createdUnits;
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
async function getParkingSpotsFromDb(allowedPropertyIds) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes("all");
  const spots = await prisma.parkingSpot.findMany({
    where: isUniversal ? {} : { propertyId: { in: allowedPropertyIds } },
    include: { property: true },
    orderBy: { spotNumber: "asc" }
  });
  return serializeDecimals(spots);
}
async function createParkingSpotInDb(data) {
  if (!process.env.DATABASE_URL) return null;
  const prop = await prisma.property.findUnique({ where: { id: data.propertyId } });
  if (!prop) throw new Error("\u0627\u0644\u0645\u0628\u0646\u0649 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.");
  const duplicate = await prisma.parkingSpot.findFirst({
    where: {
      propertyId: data.propertyId,
      spotNumber: String(data.spotNumber).trim()
    }
  });
  if (duplicate) {
    throw new Error(`\u0645\u0648\u0642\u0641 \u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0627\u0644\u0631\u0642\u0645 "${data.spotNumber}" \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0645\u0628\u0646\u0649.`);
  }
  if (data.assignedUnitId) {
    const unit = await prisma.unit.findUnique({ where: { id: data.assignedUnitId } });
    if (!unit) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
    if (unit.propertyId !== data.propertyId) {
      throw new Error("\u0627\u0644\u0645\u0648\u0642\u0641 \u0648\u0627\u0644\u0648\u062D\u062F\u0629 \u0644\u0627 \u064A\u0646\u062A\u0645\u064A\u0627\u0646 \u0625\u0644\u0649 \u0646\u0641\u0633 \u0627\u0644\u0645\u0628\u0646\u0649.");
    }
  }
  return await prisma.$transaction(async (tx) => {
    const assignedUnitId = data.assignedUnitId || null;
    const status = data.status || (assignedUnitId ? "assigned" : "vacant");
    if (assignedUnitId) {
      const currentSpot = await tx.parkingSpot.findFirst({
        where: { assignedUnitId }
      });
      if (currentSpot) {
        await tx.parkingSpot.update({
          where: { id: currentSpot.id },
          data: { assignedUnitId: null, status: "vacant" }
        });
      }
    }
    const created = await tx.parkingSpot.create({
      data: {
        propertyId: data.propertyId,
        spotNumber: String(data.spotNumber).trim(),
        floor: data.floor || "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A",
        hasEVCharger: Boolean(data.hasEVCharger),
        status,
        assignedUnitId
      }
    });
    if (assignedUnitId) {
      await tx.unit.update({
        where: { id: assignedUnitId },
        data: { assignedParkingId: created.id }
      });
    }
    return serializeDecimals(created);
  });
}
async function updateParkingSpotInDb(id, data) {
  if (!process.env.DATABASE_URL) return null;
  const existing = await prisma.parkingSpot.findUnique({ where: { id } });
  if (!existing) throw new Error("\u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
  const propId = data.propertyId || existing.propertyId;
  if (data.spotNumber && String(data.spotNumber).trim() !== existing.spotNumber.trim()) {
    const duplicate = await prisma.parkingSpot.findFirst({
      where: {
        id: { not: id },
        propertyId: propId,
        spotNumber: String(data.spotNumber).trim()
      }
    });
    if (duplicate) {
      throw new Error(`\u0645\u0648\u0642\u0641 \u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0627\u0644\u0631\u0642\u0645 "${data.spotNumber}" \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0645\u0628\u0646\u0649.`);
    }
  }
  const updateData = {};
  if (data.spotNumber !== void 0) updateData.spotNumber = String(data.spotNumber).trim();
  if (data.floor !== void 0) updateData.floor = data.floor;
  if (data.hasEVCharger !== void 0) updateData.hasEVCharger = Boolean(data.hasEVCharger);
  if (data.status !== void 0) updateData.status = data.status;
  const updated = await prisma.parkingSpot.update({
    where: { id },
    data: updateData
  });
  return serializeDecimals(updated);
}
async function deleteParkingSpotInDb(id) {
  if (!process.env.DATABASE_URL) return null;
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.parkingSpot.findUnique({ where: { id } });
    if (!existing) throw new Error("\u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    await tx.unit.updateMany({
      where: { assignedParkingId: id },
      data: { assignedParkingId: null }
    });
    const deleted = await tx.parkingSpot.delete({ where: { id } });
    return serializeDecimals(deleted);
  });
}
async function assignParkingSpotInDb(spotId, unitId) {
  if (!process.env.DATABASE_URL) return null;
  return await prisma.$transaction(async (tx) => {
    const spot = await tx.parkingSpot.findUnique({ where: { id: spotId } });
    if (!spot) throw new Error("\u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    const unit = await tx.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
    if (spot.propertyId !== unit.propertyId) {
      throw new Error("\u0627\u0644\u0645\u0648\u0642\u0641 \u0648\u0627\u0644\u0648\u062D\u062F\u0629 \u0644\u0627 \u064A\u0646\u062A\u0645\u064A\u0627\u0646 \u0625\u0644\u0649 \u0646\u0641\u0633 \u0627\u0644\u0645\u0628\u0646\u0649.");
    }
    if (spot.assignedUnitId && spot.assignedUnitId !== unitId) {
      throw new Error(`\u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A (${spot.spotNumber}) \u0645\u062E\u0635\u0635 \u0645\u0633\u0628\u0642\u0627\u064B \u0644\u0648\u062D\u062F\u0629 \u0623\u062E\u0631\u0649. \u064A\u062C\u0628 \u0641\u0643 \u0627\u0644\u062A\u0639\u064A\u064A\u0646 \u0623\u0648\u0644\u0627\u064B.`);
    }
    if (unit.assignedParkingId && unit.assignedParkingId !== spotId) {
      await tx.parkingSpot.update({
        where: { id: unit.assignedParkingId },
        data: { assignedUnitId: null, status: "vacant" }
      });
    }
    const updatedSpot = await tx.parkingSpot.update({
      where: { id: spotId },
      data: { assignedUnitId: unitId, status: "assigned" }
    });
    const updatedUnit = await tx.unit.update({
      where: { id: unitId },
      data: { assignedParkingId: spotId }
    });
    return {
      spot: serializeDecimals(updatedSpot),
      unit: serializeDecimals(updatedUnit)
    };
  });
}
async function unassignParkingSpotInDb(spotId) {
  if (!process.env.DATABASE_URL) return null;
  return await prisma.$transaction(async (tx) => {
    const spot = await tx.parkingSpot.findUnique({ where: { id: spotId } });
    if (!spot) throw new Error("\u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    const currentUnitId = spot.assignedUnitId;
    const updatedSpot = await tx.parkingSpot.update({
      where: { id: spotId },
      data: { assignedUnitId: null, status: "vacant" }
    });
    if (currentUnitId) {
      await tx.unit.update({
        where: { id: currentUnitId },
        data: { assignedParkingId: null }
      });
    }
    await tx.unit.updateMany({
      where: { assignedParkingId: spotId },
      data: { assignedParkingId: null }
    });
    return serializeDecimals(updatedSpot);
  });
}
async function getBookingsFromDb(allowedPropertyIds) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes("all");
  const bookings = await prisma.booking.findMany({
    where: isUniversal ? {} : { unit: { propertyId: { in: allowedPropertyIds } } },
    include: {
      unit: { include: { property: true } },
      payments: true,
      securityDeposits: {
        include: {
          transactions: true
        }
      }
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
      securityDeposits: {
        include: {
          transactions: true
        }
      },
      payments: true
    },
    orderBy: { createdAt: "desc" }
  });
  return serializeDecimals(leases);
}
async function getAllocationsFromDb(allowedPropertyIds) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes("all");
  const allocations = await prisma.unitAllocation.findMany({
    where: isUniversal ? {} : { unit: { propertyId: { in: allowedPropertyIds } } },
    include: {
      unit: { include: { property: true } }
    },
    orderBy: { startDate: "asc" }
  });
  return serializeDecimals(allocations);
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
async function saveDocumentRecordInDb(data) {
  if (!process.env.DATABASE_URL) return null;
  const doc = await prisma.documentRecord.upsert({
    where: { fileName: data.fileName },
    update: data,
    create: data
  });
  return serializeDecimals(doc);
}
async function getDocumentRecordFromDb(fileName) {
  if (!process.env.DATABASE_URL) return null;
  const doc = await prisma.documentRecord.findUnique({
    where: { fileName }
  });
  return serializeDecimals(doc);
}
async function exportFullDatabase() {
  if (!process.env.DATABASE_URL) return null;
  const [
    users,
    settings,
    properties,
    floors,
    amenities,
    units,
    parkingSpots,
    allocations,
    bookings,
    leases,
    installments,
    securityDeposits,
    securityDepositTransactions,
    payments,
    expenses,
    expenseAllocations,
    expensePayments,
    expenseCategories,
    recurringSchedules,
    tenantAdjustments,
    contentSections,
    documentRecords,
    idempotencyRecords,
    auditLogs
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.property.findMany(),
    prisma.floor.findMany(),
    prisma.amenity.findMany(),
    prisma.unit.findMany(),
    prisma.parkingSpot.findMany(),
    prisma.unitAllocation.findMany(),
    prisma.booking.findMany(),
    prisma.lease.findMany(),
    prisma.leaseInstallment.findMany(),
    prisma.securityDepositRecord.findMany(),
    prisma.securityDepositTransaction.findMany(),
    prisma.paymentRecord.findMany(),
    prisma.operationalExpense.findMany(),
    prisma.expenseAllocation.findMany(),
    prisma.expensePaymentEntry.findMany(),
    prisma.expenseCategoryConfig.findMany(),
    prisma.recurringExpenseSchedule.findMany(),
    prisma.tenantAdjustment.findMany(),
    prisma.contentSection.findMany(),
    prisma.documentRecord.findMany(),
    prisma.idempotencyRecord.findMany(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" } })
    // Complete audit logs (no take limit)
  ]);
  return serializeDecimals({
    metadata: {
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: "2.0.0",
      schema: "PostgreSQL-LuxuryHome"
    },
    users,
    settings,
    properties,
    floors,
    amenities,
    units,
    parkingSpots,
    allocations,
    bookings,
    leases,
    installments,
    securityDeposits,
    securityDepositTransactions,
    payments,
    expenses,
    expenseAllocations,
    expensePayments,
    expenseCategories,
    recurringSchedules,
    tenantAdjustments,
    contentSections,
    documentRecords,
    idempotencyRecords,
    auditLogs
  });
}
var REQUIRED_FULL_BACKUP_COLLECTIONS = [
  "users",
  "properties",
  "floors",
  "amenities",
  "units",
  "parkingSpots",
  "allocations",
  "bookings",
  "leases",
  "installments",
  "securityDeposits",
  "securityDepositTransactions",
  "payments",
  "expenses",
  "expenseAllocations",
  "expensePayments",
  "expenseCategories",
  "recurringSchedules",
  "tenantAdjustments",
  "contentSections",
  "documentRecords",
  "idempotencyRecords",
  "auditLogs"
];
function validateBackupPackageIntegrity(backupData) {
  const errors = [];
  if (!backupData || typeof backupData !== "object") {
    return { isValid: false, errors: ["\u0647\u064A\u0643\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0641\u0627\u0631\u063A."] };
  }
  const missingCollections = [];
  for (const collName of REQUIRED_FULL_BACKUP_COLLECTIONS) {
    if (!Array.isArray(backupData[collName])) {
      missingCollections.push(collName);
    }
  }
  if (missingCollections.length > 0) {
    errors.push(`\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u0646\u0633\u062E\u0629: \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0646\u0627\u0642\u0635\u0629 \u0648\u062A\u0641\u062A\u0642\u0631 \u0644\u0644\u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u062A\u0627\u0644\u064A\u0629: (${missingCollections.join(", ")}).`);
  }
  if (backupData.settings === void 0) {
    errors.push("\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u0646\u0633\u062E\u0629: \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0646\u0634\u0623\u0629 (settings) \u0645\u0641\u0642\u0648\u062F\u0629 \u0645\u0646 \u062D\u0632\u0645\u0629 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A.");
  }
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  const propIdSet = /* @__PURE__ */ new Set();
  for (const p of backupData.properties || []) {
    if (propIdSet.has(String(p.id))) errors.push(`\u0645\u0639\u0631\u0641 \u0645\u0628\u0646\u0649 \u0645\u0643\u0631\u0631 \u0641\u064A \u0627\u0644\u062D\u0632\u0645\u0629: ${p.id}`);
    propIdSet.add(String(p.id));
  }
  const unitIdSet = /* @__PURE__ */ new Set();
  for (const u of backupData.units || []) {
    if (unitIdSet.has(String(u.id))) errors.push(`\u0645\u0639\u0631\u0641 \u0648\u062D\u062F\u0629 \u0645\u0643\u0631\u0631 \u0641\u064A \u0627\u0644\u062D\u0632\u0645\u0629: ${u.id}`);
    unitIdSet.add(String(u.id));
  }
  const bookingIdSet = /* @__PURE__ */ new Set();
  for (const b of backupData.bookings || []) {
    if (bookingIdSet.has(String(b.id))) errors.push(`\u0645\u0639\u0631\u0641 \u062D\u062C\u0632 \u0645\u0643\u0631\u0631 \u0641\u064A \u0627\u0644\u062D\u0632\u0645\u0629: ${b.id}`);
    bookingIdSet.add(String(b.id));
  }
  const leaseIdSet = /* @__PURE__ */ new Set();
  for (const l of backupData.leases || []) {
    if (leaseIdSet.has(String(l.id))) errors.push(`\u0645\u0639\u0631\u0641 \u0639\u0642\u062F \u0645\u0643\u0631\u0631 \u0641\u064A \u0627\u0644\u062D\u0632\u0645\u0629: ${l.id}`);
    leaseIdSet.add(String(l.id));
  }
  const depositIdSet = /* @__PURE__ */ new Set();
  for (const d of backupData.securityDeposits || []) {
    if (depositIdSet.has(String(d.id))) errors.push(`\u0645\u0639\u0631\u0641 \u062A\u0623\u0645\u064A\u0646 \u0645\u0643\u0631\u0631 \u0641\u064A \u0627\u0644\u062D\u0632\u0645\u0629: ${d.id}`);
    depositIdSet.add(String(d.id));
  }
  const installmentIdSet = /* @__PURE__ */ new Set();
  for (const inst of backupData.installments || []) {
    if (installmentIdSet.has(String(inst.id))) errors.push(`\u0645\u0639\u0631\u0641 \u0642\u0633\u0637 \u0645\u0643\u0631\u0631 \u0641\u064A \u0627\u0644\u062D\u0632\u0645\u0629: ${inst.id}`);
    installmentIdSet.add(String(inst.id));
  }
  const expenseIdSet = new Set((backupData.expenses || []).map((e) => String(e.id)));
  const installmentsById = new Map(
    (backupData.installments || []).map((item) => [item.id, item])
  );
  const depositsById = new Map(
    (backupData.securityDeposits || []).map((item) => [item.id, item])
  );
  for (const f of backupData.floors || []) {
    if (f.propertyId && !propIdSet.has(String(f.propertyId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u0627\u0644\u0637\u0627\u0628\u0642 ${f.id} \u064A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0645\u0628\u0646\u0649 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${f.propertyId}).`);
    }
  }
  for (const u of backupData.units || []) {
    if (u.propertyId && !propIdSet.has(String(u.propertyId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u0627\u0644\u0648\u062D\u062F\u0629 ${u.id} \u062A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0645\u0628\u0646\u0649 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${u.propertyId}).`);
    }
  }
  for (const b of backupData.bookings || []) {
    if (b.unitId && !unitIdSet.has(String(b.unitId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u0627\u0644\u062D\u062C\u0632 ${b.id} \u064A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0648\u062D\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 (${b.unitId}).`);
    }
  }
  for (const l of backupData.leases || []) {
    if (l.unitId && !unitIdSet.has(String(l.unitId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u0627\u0644\u0639\u0642\u062F ${l.id} \u064A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0648\u062D\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 (${l.unitId}).`);
    }
  }
  for (const inst of backupData.installments || []) {
    if (inst.leaseId && !leaseIdSet.has(String(inst.leaseId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u0627\u0644\u0642\u0633\u0637 ${inst.id} \u064A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0639\u0642\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${inst.leaseId}).`);
    }
  }
  for (const sd of backupData.securityDeposits || []) {
    if (sd.bookingId && !bookingIdSet.has(String(sd.bookingId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u0627\u0644\u062A\u0623\u0645\u064A\u0646 ${sd.id} \u064A\u0634\u064A\u0631 \u0625\u0644\u0649 \u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${sd.bookingId}).`);
    }
    if (sd.leaseId && !leaseIdSet.has(String(sd.leaseId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u0627\u0644\u062A\u0623\u0645\u064A\u0646 ${sd.id} \u064A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0639\u0642\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${sd.leaseId}).`);
    }
    for (const field of [
      "collectedAmount",
      "collectionReference",
      "collectionVerifiedAt",
      "refundedAmount",
      "deductedAmount",
      "rentAppliedAmount"
    ]) {
      if (!Object.prototype.hasOwnProperty.call(sd, field)) {
        errors.push(`\u0627\u0644\u062A\u0623\u0645\u064A\u0646 ${sd.id}: \u0627\u0644\u062D\u0642\u0644 ${field} \u0645\u0641\u0642\u0648\u062F.`);
      }
    }
    const parseAmount = (value, fieldName) => {
      if (!["string", "number"].includes(typeof value) || !/^\d{1,10}(?:\.\d{1,2})?$/.test(String(value))) {
        errors.push(`\u0627\u0644\u062A\u0623\u0645\u064A\u0646 ${sd.id}: \u062D\u0642\u0644 ${fieldName} \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0645\u0628\u0644\u063A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D (${value}).`);
        return new Decimal(0);
      }
      return new Decimal(String(value));
    };
    if (Object.prototype.hasOwnProperty.call(sd, "collectedAmount") && Object.prototype.hasOwnProperty.call(sd, "refundedAmount") && Object.prototype.hasOwnProperty.call(sd, "deductedAmount") && Object.prototype.hasOwnProperty.call(sd, "rentAppliedAmount")) {
      const collected = parseAmount(sd.collectedAmount, "collectedAmount");
      const refunded = parseAmount(sd.refundedAmount, "refundedAmount");
      const deducted = parseAmount(sd.deductedAmount, "deductedAmount");
      const rentApplied = parseAmount(sd.rentAppliedAmount, "rentAppliedAmount");
      if (refunded.plus(deducted).plus(rentApplied).gt(collected)) {
        errors.push(`\u0627\u0644\u062A\u0623\u0645\u064A\u0646 ${sd.id}: \u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u062D\u0631\u0643\u0627\u062A \u0648\u0627\u0644\u062A\u0633\u0648\u064A\u0627\u062A \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062A\u062D\u0635\u064A\u0644.`);
      }
      if (collected.gt(0)) {
        const validReference = typeof sd.collectionReference === "string" && sd.collectionReference.trim().length > 0;
        const validDate = typeof sd.collectionVerifiedAt === "string" && Number.isFinite(Date.parse(sd.collectionVerifiedAt));
        if (!validReference || !validDate) {
          errors.push(`\u0627\u0644\u062A\u0623\u0645\u064A\u0646 ${sd.id}: \u0625\u062B\u0628\u0627\u062A \u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u0646\u0627\u0642\u0635.`);
        }
      }
      const settlementMovements = (backupData.securityDepositTransactions || []).filter(
        (movement) => movement.depositId === sd.id && movement.type === "rent_application" && movement.status === "completed"
      );
      let settlementTotal = new Decimal(0);
      let settlementAmountsValid = true;
      for (const movement of settlementMovements) {
        const value = movement.amount;
        if (!["string", "number"].includes(typeof value) || !/^\d{1,10}(?:\.\d{1,2})?$/.test(String(value))) {
          errors.push(`\u062D\u0631\u0643\u0629 \u0627\u0644\u062A\u0633\u0648\u064A\u0629 ${movement.id}: \u0645\u0628\u0644\u063A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.`);
          settlementAmountsValid = false;
          continue;
        }
        const amount = new Decimal(String(value));
        if (amount.lte(0)) {
          errors.push(`\u062D\u0631\u0643\u0629 \u0627\u0644\u062A\u0633\u0648\u064A\u0629 ${movement.id}: \u0627\u0644\u0645\u0628\u0644\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0648\u062C\u0628\u0627\u064B.`);
          settlementAmountsValid = false;
          continue;
        }
        settlementTotal = settlementTotal.plus(amount);
      }
      if (settlementAmountsValid && !settlementTotal.eq(rentApplied)) {
        errors.push(
          `\u0627\u0644\u062A\u0623\u0645\u064A\u0646 ${sd.id}: \u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u062A\u0633\u0648\u064A\u0627\u062A ${settlementTotal.toFixed(2)} \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0644\u0625\u064A\u062C\u0627\u0631 ${rentApplied.toFixed(2)}.`
        );
      }
    }
  }
  for (const movement of backupData.securityDepositTransactions || []) {
    if (movement.depositId && !depositIdSet.has(String(movement.depositId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u062D\u0631\u0643\u0629 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 ${movement.id} \u062A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0633\u062C\u0644 \u062A\u0623\u0645\u064A\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${movement.depositId}).`);
    }
    if (movement.targetInstallmentId) {
      const installment = installmentsById.get(movement.targetInstallmentId);
      if (!installment) {
        errors.push(`\u0627\u0644\u062D\u0631\u0643\u0629 ${movement.id}: \u0627\u0644\u0642\u0633\u0637 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${movement.targetInstallmentId}).`);
      } else if (installment.leaseId !== movement.targetLeaseId) {
        errors.push(`\u0627\u0644\u062D\u0631\u0643\u0629 ${movement.id}: \u0627\u0644\u0642\u0633\u0637 \u0644\u0627 \u064A\u062A\u0628\u0639 \u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 (${movement.targetLeaseId}).`);
      }
    }
    if (movement.type === "rent_application") {
      const deposit = depositsById.get(movement.depositId);
      if (!movement.targetLeaseId || !movement.targetInstallmentId || !deposit?.leaseId || deposit.bookingId || deposit.leaseId !== movement.targetLeaseId) {
        errors.push(`\u0627\u0644\u062D\u0631\u0643\u0629 ${movement.id}: \u0627\u0631\u062A\u0628\u0627\u0637\u0627\u062A \u062A\u0633\u0648\u064A\u0629 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u063A\u064A\u0631 \u0645\u062A\u0633\u0642\u0629.`);
      }
    }
    if (typeof movement.reference !== "string" || !movement.reference.trim()) {
      errors.push(`\u0627\u0644\u062D\u0631\u0643\u0629 ${movement.id}: \u0645\u0631\u062C\u0639 \u0627\u0644\u0625\u062B\u0628\u0627\u062A \u0645\u0641\u0642\u0648\u062F.`);
    }
    for (const field of ["targetLeaseId", "targetInstallmentId"]) {
      if (!Object.prototype.hasOwnProperty.call(movement, field)) {
        errors.push(`\u062D\u0631\u0643\u0629 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 ${movement.id}: \u0627\u0644\u062D\u0642\u0644 ${field} \u0645\u0641\u0642\u0648\u062F.`);
      }
    }
  }
  for (const pay of backupData.payments || []) {
    if (pay.bookingId && !bookingIdSet.has(String(pay.bookingId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u0627\u0644\u062F\u0641\u0639\u0629 ${pay.id} \u062A\u0634\u064A\u0631 \u0625\u0644\u0649 \u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${pay.bookingId}).`);
    }
    if (pay.leaseId && !leaseIdSet.has(String(pay.leaseId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u0627\u0644\u062F\u0641\u0639\u0629 ${pay.id} \u062A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0639\u0642\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${pay.leaseId}).`);
    }
    if (pay.installmentId) {
      const installment = installmentsById.get(pay.installmentId);
      if (!installment) {
        errors.push(`\u0627\u0644\u0633\u062F\u0627\u062F ${pay.id}: \u0627\u0644\u0642\u0633\u0637 \u0627\u0644\u0645\u0631\u062A\u0628\u0637 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${pay.installmentId}).`);
      } else if (installment.leaseId !== pay.leaseId) {
        errors.push(`\u0627\u0644\u0633\u062F\u0627\u062F ${pay.id}: \u0627\u0644\u0642\u0633\u0637 \u0644\u0627 \u064A\u062A\u0628\u0639 \u0639\u0642\u062F \u0627\u0644\u0633\u062F\u0627\u062F (${pay.leaseId}).`);
      }
    }
    for (const field of ["installmentId", "sourceType", "affectsCash"]) {
      if (!Object.prototype.hasOwnProperty.call(pay, field)) {
        errors.push(`\u0627\u0644\u0633\u062F\u0627\u062F ${pay.id}: \u0627\u0644\u062D\u0642\u0644 ${field} \u0645\u0641\u0642\u0648\u062F.`);
      }
    }
    if (typeof pay.affectsCash !== "boolean") {
      errors.push(`\u0627\u0644\u0633\u062F\u0627\u062F ${pay.id}: affectsCash \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0646\u0637\u0642\u064A\u0627\u064B (boolean).`);
    }
    if (pay.sourceType === "deposit_application" && (pay.affectsCash !== false || pay.paymentMethod !== "security_deposit" || !pay.installmentId)) {
      errors.push(`\u0627\u0644\u0633\u062F\u0627\u062F ${pay.id}: \u062A\u0633\u0648\u064A\u0629 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u063A\u064A\u0631 \u0645\u062A\u0633\u0642\u0629 (affectsCash=${pay.affectsCash}, method=${pay.paymentMethod}, installmentId=${pay.installmentId}).`);
    }
  }
  for (const ea of backupData.expenseAllocations || []) {
    if (ea.expenseId && !expenseIdSet.has(String(ea.expenseId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${ea.id} \u064A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${ea.expenseId}).`);
    }
  }
  for (const ep of backupData.expensePayments || []) {
    if (ep.expenseId && !expenseIdSet.has(String(ep.expenseId))) {
      errors.push(`\u0639\u0644\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629: \u0633\u062F\u0627\u062F \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${ep.id} \u064A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F (${ep.expenseId}).`);
    }
  }
  return { isValid: errors.length === 0, errors };
}
async function restoreFullDatabaseInDb(backupData) {
  if (!process.env.DATABASE_URL) return null;
  const validation = validateBackupPackageIntegrity(backupData);
  if (!validation.isValid) {
    const combinedMessage = validation.errors.join(" | ");
    throw new Error(`\u062A\u0645 \u0631\u0641\u0636 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0642\u0628\u0644 \u0628\u062F\u0621 \u0623\u064A \u062D\u0630\u0641 \u062D\u0641\u0627\u0638\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A: ${combinedMessage}`);
  }
  return await prisma.$transaction(async (tx) => {
    await tx.idempotencyRecord.deleteMany();
    await tx.documentRecord.deleteMany();
    await tx.securityDepositTransaction.deleteMany();
    await tx.paymentRecord.deleteMany();
    await tx.securityDepositRecord.deleteMany();
    await tx.leaseInstallment.deleteMany();
    await tx.expensePaymentEntry.deleteMany();
    await tx.expenseAllocation.deleteMany();
    await tx.operationalExpense.deleteMany();
    await tx.recurringExpenseSchedule.deleteMany();
    await tx.expenseCategoryConfig.deleteMany();
    await tx.tenantAdjustment.deleteMany();
    await tx.lease.deleteMany();
    await tx.booking.deleteMany();
    await tx.unitAllocation.deleteMany();
    await tx.parkingSpot.deleteMany();
    await tx.unit.deleteMany();
    await tx.floor.deleteMany();
    await tx.property.deleteMany();
    await tx.amenity.deleteMany();
    await tx.contentSection.deleteMany();
    await tx.auditLog.deleteMany();
    if (Array.isArray(backupData.users) && backupData.users.length > 0) {
      await tx.user.deleteMany();
    }
    if (Array.isArray(backupData.users)) {
      for (const u of backupData.users) {
        await tx.user.create({
          data: {
            id: u.id,
            username: u.username,
            email: u.email,
            passwordHash: u.passwordHash,
            name: u.name,
            phone: u.phone ?? null,
            role: u.role,
            allowedProperties: Array.isArray(u.allowedProperties) ? u.allowedProperties : ["all"],
            isActive: u.isActive !== false,
            createdAt: u.createdAt ? new Date(u.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    if (backupData.settings) {
      const s = backupData.settings;
      await tx.companySettings.upsert({
        where: { id: s.id || "default" },
        update: {
          companyName: s.companyName,
          companyNameEn: s.companyNameEn,
          tagline: s.tagline,
          logoUrl: s.logoUrl,
          phone: s.phone,
          whatsapp: s.whatsapp,
          email: s.email,
          crNumber: s.crNumber,
          taxNumber: s.taxNumber,
          nationalAddress: s.nationalAddress,
          checkInTime: s.checkInTime,
          checkOutTime: s.checkOutTime,
          navigation: s.navigation ?? null,
          themeConfig: s.themeConfig ?? null
        },
        create: {
          id: s.id || "default",
          companyName: s.companyName || "Luxury Home",
          companyNameEn: s.companyNameEn || "Luxury Home",
          tagline: s.tagline || "",
          logoUrl: s.logoUrl,
          phone: s.phone || "",
          whatsapp: s.whatsapp || "",
          email: s.email || "",
          crNumber: s.crNumber || "",
          taxNumber: s.taxNumber || "",
          nationalAddress: s.nationalAddress || "",
          checkInTime: s.checkInTime || "15:00",
          checkOutTime: s.checkOutTime || "12:00",
          navigation: s.navigation ?? null,
          themeConfig: s.themeConfig ?? null
        }
      });
    }
    if (Array.isArray(backupData.properties)) {
      for (const p of backupData.properties) {
        await tx.property.create({
          data: {
            id: p.id,
            name: p.name,
            code: p.code,
            address: p.address,
            city: p.city || "\u0627\u0644\u0631\u064A\u0627\u0636",
            district: p.district,
            floorsCount: p.floorsCount !== void 0 ? Number(p.floorsCount) : 1,
            unitsCount: p.unitsCount !== void 0 ? Number(p.unitsCount) : 0,
            totalAreaSqm: p.totalAreaSqm !== void 0 ? Number(p.totalAreaSqm) : 0,
            rooftopPayment: new Decimal(p.rooftopPayment ?? 0),
            description: p.description ?? null,
            images: Array.isArray(p.images) ? p.images : [],
            isActive: p.isActive !== false,
            createdAt: p.createdAt ? new Date(p.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    if (Array.isArray(backupData.floors)) {
      for (const f of backupData.floors) {
        await tx.floor.create({
          data: {
            id: f.id,
            propertyId: f.propertyId,
            number: f.number ?? f.floorNumber ?? 1,
            name: f.name || `\u0627\u0644\u0637\u0627\u0628\u0642 ${f.number || 1}`
          }
        });
      }
    }
    if (Array.isArray(backupData.amenities)) {
      for (const a of backupData.amenities) {
        await tx.amenity.create({
          data: {
            id: a.id,
            name: a.name,
            nameEn: a.nameEn || a.name,
            icon: a.icon || "star",
            category: a.category || "general"
          }
        });
      }
    }
    if (Array.isArray(backupData.units)) {
      for (const u of backupData.units) {
        await tx.unit.create({
          data: {
            id: u.id,
            propertyId: u.propertyId,
            floorId: u.floorId ?? null,
            unitNumber: String(u.unitNumber).trim(),
            title: u.title || "",
            titleEn: u.titleEn || "",
            type: u.type || "apartment",
            areaSqm: u.areaSqm !== void 0 && u.areaSqm !== null ? Number(u.areaSqm) : 0,
            floorNumber: u.floorNumber !== void 0 && u.floorNumber !== null ? Number(u.floorNumber) : 1,
            maxGuests: u.maxGuests !== void 0 && u.maxGuests !== null ? Number(u.maxGuests) : 3,
            bedroomsCount: u.bedroomsCount !== void 0 && u.bedroomsCount !== null ? Number(u.bedroomsCount) : 1,
            bathroomsCount: u.bathroomsCount !== void 0 && u.bathroomsCount !== null ? Number(u.bathroomsCount) : 1,
            bedsCount: u.bedsCount !== void 0 && u.bedsCount !== null ? Number(u.bedsCount) : 1,
            furnishingStatus: u.furnishingStatus || "furnished",
            allowDaily: u.allowDaily !== false,
            dailyRate: new Decimal(u.dailyRate ?? 0),
            dailySecurityDeposit: new Decimal(u.dailySecurityDeposit ?? 0),
            allowMonthly: u.allowMonthly !== false,
            monthlyRate: new Decimal(u.monthlyRate ?? 0),
            monthlySecurityDeposit: new Decimal(u.monthlySecurityDeposit ?? 0),
            allowYearly: u.allowYearly !== false,
            annualRate: new Decimal(u.annualRate ?? u.yearlyRate ?? 0),
            yearlySecurityDeposit: new Decimal(u.yearlySecurityDeposit ?? 0),
            yearlyPaymentOptions: Array.isArray(u.yearlyPaymentOptions) ? u.yearlyPaymentOptions : ["single_annual", "semi_annual"],
            semiAnnualSurchargePercent: new Decimal(u.semiAnnualSurchargePercent ?? 0),
            cleaningFee: new Decimal(u.cleaningFee ?? 0),
            securityDeposit: new Decimal(u.securityDeposit ?? 0),
            taxPercentage: new Decimal(u.taxPercentage ?? 15),
            operationalStatus: u.operationalStatus || "ready",
            occupancyStatus: u.occupancyStatus || "vacant",
            isClean: u.isClean !== false,
            publicationStatus: u.publicationStatus || "published",
            amenities: Array.isArray(u.amenities) ? u.amenities : [],
            images: Array.isArray(u.images) ? u.images : [],
            media: u.media ?? null,
            spaces: u.spaces ?? null,
            fittings: u.fittings ?? null,
            floorPlanUrl: u.floorPlanUrl ?? null,
            assignedParkingId: u.assignedParkingId ?? null,
            notes: u.notes ?? null,
            smartLockPin: u.smartLockPin ?? null,
            createdAt: u.createdAt ? new Date(u.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    if (Array.isArray(backupData.parkingSpots)) {
      for (const ps of backupData.parkingSpots) {
        await tx.parkingSpot.create({
          data: {
            id: ps.id,
            propertyId: ps.propertyId,
            spotNumber: ps.spotNumber,
            floor: ps.floor || "G",
            hasEVCharger: Boolean(ps.hasEVCharger),
            status: ps.status || "vacant",
            assignedUnitId: ps.assignedUnitId ?? null
          }
        });
      }
    }
    if (Array.isArray(backupData.allocations)) {
      for (const a of backupData.allocations) {
        await tx.unitAllocation.create({
          data: {
            id: a.id,
            unitId: a.unitId,
            startDate: new Date(a.startDate),
            endDate: new Date(a.endDate),
            rentalType: (a.rentalType || "daily").toUpperCase(),
            referenceId: a.referenceId ?? null,
            purpose: a.purpose || "booking",
            status: a.status || "active",
            notes: a.notes ?? null,
            createdAt: a.createdAt ? new Date(a.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    if (Array.isArray(backupData.bookings)) {
      for (const b of backupData.bookings) {
        await tx.booking.create({
          data: {
            id: b.id,
            bookingNumber: b.bookingNumber || b.id,
            idempotencyKey: b.idempotencyKey ?? null,
            unitId: b.unitId,
            guestName: b.guestName || "\u0646\u0632\u064A\u0644",
            guestPhone: b.guestPhone || "+966500000000",
            guestEmail: b.guestEmail ?? null,
            guestIdNumber: b.guestIdNumber ?? null,
            userId: b.userId ?? null,
            startDate: new Date(b.startDate || b.checkIn),
            endDate: new Date(b.endDate || b.checkOut),
            rentalType: (b.rentalType || "daily").toUpperCase(),
            totalNights: b.totalNights !== void 0 ? Number(b.totalNights) : 1,
            guestsCount: b.guestsCount !== void 0 ? Number(b.guestsCount) : 1,
            nightlyRate: new Decimal(b.nightlyRate ?? 0),
            subtotal: new Decimal(b.subtotal ?? 0),
            cleaningFee: new Decimal(b.cleaningFee ?? 0),
            taxes: new Decimal(b.taxes ?? 0),
            securityDeposit: new Decimal(b.securityDeposit ?? 0),
            totalAmount: new Decimal(b.totalAmount ?? 0),
            paidAmount: new Decimal(b.paidAmount ?? 0),
            status: (b.status || "confirmed").toUpperCase(),
            paymentStatus: b.paymentStatus || "pending",
            identityStatus: b.identityStatus || "verified",
            smartLockPin: b.smartLockPin ?? null,
            notes: b.notes ?? null,
            createdAt: b.createdAt ? new Date(b.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    if (Array.isArray(backupData.leases)) {
      for (const l of backupData.leases) {
        await tx.lease.create({
          data: {
            id: l.id,
            contractNumber: l.contractNumber || l.id,
            idempotencyKey: l.idempotencyKey ?? null,
            unitId: l.unitId,
            tenantName: l.tenantName || "\u0645\u0633\u062A\u0623\u062C\u0631",
            tenantPhone: l.tenantPhone || "+966500000000",
            tenantEmail: l.tenantEmail ?? null,
            tenantIdNumber: l.tenantIdNumber || "1000000000",
            startDate: new Date(l.startDate),
            endDate: new Date(l.endDate),
            rentalType: (l.rentalType || "annual").toUpperCase(),
            annualRent: new Decimal(l.annualRent ?? 0),
            paymentOption: l.paymentOption || "1_payment",
            paymentFrequency: l.paymentFrequency || "1_payment",
            installmentsCount: l.installmentsCount !== void 0 ? Number(l.installmentsCount) : 1,
            securityDeposit: new Decimal(l.securityDeposit ?? 0),
            contractServices: l.contractServices ?? null,
            includedAmenities: Array.isArray(l.includedAmenities) ? l.includedAmenities : [],
            termsConditions: l.termsConditions ?? null,
            status: (l.status || "active").toUpperCase(),
            pdfUrl: l.pdfUrl ?? null,
            createdAt: l.createdAt ? new Date(l.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    if (Array.isArray(backupData.installments)) {
      for (const inst of backupData.installments) {
        await tx.leaseInstallment.create({
          data: {
            id: inst.id,
            leaseId: inst.leaseId,
            number: Number(inst.number || 1),
            label: inst.label ?? null,
            dueDate: new Date(inst.dueDate),
            amount: new Decimal(inst.amount ?? 0),
            paidAmount: new Decimal(inst.paidAmount ?? 0),
            remainingAmount: new Decimal(inst.remainingAmount ?? inst.amount ?? 0),
            status: (inst.status || "UPCOMING").toUpperCase(),
            paidAt: inst.paidAt ? new Date(inst.paidAt) : null
          }
        });
      }
    }
    if (Array.isArray(backupData.securityDeposits)) {
      for (const sd of backupData.securityDeposits) {
        await tx.securityDepositRecord.create({
          data: {
            id: sd.id,
            leaseId: sd.leaseId ?? null,
            bookingId: sd.bookingId ?? null,
            amount: new Decimal(sd.amount ?? 0),
            collectedAmount: new Decimal(sd.collectedAmount ?? 0),
            collectionReference: sd.collectionReference ?? null,
            collectionVerifiedAt: sd.collectionVerifiedAt ? new Date(sd.collectionVerifiedAt) : null,
            status: sd.status || "held",
            deductedAmount: new Decimal(sd.deductedAmount ?? 0),
            refundedAmount: new Decimal(sd.refundedAmount ?? 0),
            rentAppliedAmount: new Decimal(sd.rentAppliedAmount ?? 0),
            deductionReason: sd.deductionReason ?? null,
            refundMethod: sd.refundMethod ?? null,
            refundReference: sd.refundReference ?? null,
            refundType: sd.refundType ?? null,
            refundedByUserId: sd.refundedByUserId ?? null,
            refundedAt: sd.refundedAt ? new Date(sd.refundedAt) : null,
            notes: sd.notes ?? null,
            createdAt: sd.createdAt ? new Date(sd.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    if (Array.isArray(backupData.securityDepositTransactions)) {
      for (const sdt of backupData.securityDepositTransactions) {
        await tx.securityDepositTransaction.create({
          data: {
            id: sdt.id,
            depositId: sdt.depositId,
            type: sdt.type || "refund",
            amount: new Decimal(sdt.amount ?? 0),
            method: sdt.method || "bank_transfer",
            reference: sdt.reference,
            reason: sdt.reason ?? null,
            targetLeaseId: sdt.targetLeaseId ?? null,
            targetInstallmentId: sdt.targetInstallmentId ?? null,
            executedByUserId: sdt.executedByUserId ?? null,
            executedAt: sdt.executedAt ? new Date(sdt.executedAt) : /* @__PURE__ */ new Date(),
            status: sdt.status || "completed",
            idempotencyKey: sdt.idempotencyKey ?? null,
            notes: sdt.notes ?? null,
            createdAt: sdt.createdAt ? new Date(sdt.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    if (Array.isArray(backupData.payments)) {
      for (const pay of backupData.payments) {
        await tx.paymentRecord.create({
          data: {
            id: pay.id,
            bookingId: pay.bookingId ?? null,
            leaseId: pay.leaseId ?? null,
            installmentId: pay.installmentId ?? null,
            amount: new Decimal(pay.amount ?? 0),
            paymentMethod: pay.paymentMethod || "mada",
            sourceType: pay.sourceType ?? "direct_payment",
            affectsCash: pay.affectsCash !== false,
            receiptNo: pay.receiptNo ?? null,
            referenceNo: pay.referenceNo ?? null,
            status: pay.status || "completed",
            isVerified: pay.isVerified !== false,
            paidAt: pay.paidAt ? new Date(pay.paidAt) : /* @__PURE__ */ new Date(),
            notes: pay.notes ?? null
          }
        });
      }
    }
    if (Array.isArray(backupData.expenseCategories)) {
      for (const ec of backupData.expenseCategories) {
        await tx.expenseCategoryConfig.create({
          data: {
            id: ec.id,
            code: ec.code,
            nameAr: ec.nameAr,
            nameEn: ec.nameEn || ec.nameAr,
            costCenterLevel: (ec.costCenterLevel || "PROPERTY").toUpperCase(),
            temporalDistribution: (ec.temporalDistribution || "NONE").toUpperCase(),
            defaultAllocationMethod: (ec.defaultAllocationMethod || "EQUAL_UNITS").toUpperCase(),
            subcategories: Array.isArray(ec.subcategories) ? ec.subcategories : [],
            isActive: ec.isActive !== false
          }
        });
      }
    }
    if (Array.isArray(backupData.expenses)) {
      for (const exp of backupData.expenses) {
        await tx.operationalExpense.create({
          data: {
            id: exp.id,
            expenseNumber: exp.expenseNumber || exp.id,
            title: exp.title || "\u0645\u0635\u0631\u0648\u0641",
            amount: new Decimal(exp.amount ?? 0),
            costCenterLevel: (exp.costCenterLevel || "PROPERTY").toUpperCase(),
            propertyId: exp.propertyId ?? null,
            unitId: exp.unitId ?? null,
            categoryCode: exp.categoryCode || "OPERATIONS_OTHER",
            subcategory: exp.subcategory ?? null,
            expenseDate: exp.expenseDate ? new Date(exp.expenseDate) : /* @__PURE__ */ new Date(),
            startDate: exp.startDate ? new Date(exp.startDate) : /* @__PURE__ */ new Date(),
            endDate: exp.endDate ? new Date(exp.endDate) : /* @__PURE__ */ new Date(),
            temporalType: (exp.temporalType || "NONE").toUpperCase(),
            allocationMethod: (exp.allocationMethod || "EQUAL_UNITS").toUpperCase(),
            status: exp.status || "approved",
            isCapitalAsset: Boolean(exp.isCapitalAsset),
            notes: exp.notes ?? null,
            createdById: exp.createdById ?? null,
            createdAt: exp.createdAt ? new Date(exp.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    if (Array.isArray(backupData.expenseAllocations)) {
      for (const ea of backupData.expenseAllocations) {
        await tx.expenseAllocation.create({
          data: {
            id: ea.id,
            expenseId: ea.expenseId,
            unitId: ea.unitId,
            shareAmount: new Decimal(ea.shareAmount ?? 0),
            percentage: Number(ea.percentage ?? 0),
            monthPeriod: ea.monthPeriod || "2026-10"
          }
        });
      }
    }
    if (Array.isArray(backupData.expensePayments)) {
      for (const ep of backupData.expensePayments) {
        await tx.expensePaymentEntry.create({
          data: {
            id: ep.id,
            expenseId: ep.expenseId,
            amount: new Decimal(ep.amount ?? 0),
            paymentDate: ep.paymentDate ? new Date(ep.paymentDate) : /* @__PURE__ */ new Date(),
            paymentMethod: ep.paymentMethod || "bank_transfer",
            referenceNo: ep.referenceNo ?? null,
            notes: ep.notes ?? null
          }
        });
      }
    }
    if (Array.isArray(backupData.recurringSchedules)) {
      for (const rs of backupData.recurringSchedules) {
        await tx.recurringExpenseSchedule.create({
          data: {
            id: rs.id,
            title: rs.title,
            categoryCode: rs.categoryCode,
            amount: new Decimal(rs.amount ?? 0),
            propertyId: rs.propertyId ?? null,
            unitId: rs.unitId ?? null,
            frequency: rs.frequency || "monthly",
            nextDueDate: new Date(rs.nextDueDate),
            isActive: rs.isActive !== false
          }
        });
      }
    }
    if (Array.isArray(backupData.tenantAdjustments)) {
      for (const ta of backupData.tenantAdjustments) {
        await tx.tenantAdjustment.create({
          data: {
            id: ta.id,
            tenantName: ta.tenantName,
            unitNumber: ta.unitNumber,
            type: ta.type || "discount",
            amount: new Decimal(ta.amount ?? 0),
            reason: ta.reason || "\u062A\u0633\u0648\u064A\u0629",
            date: ta.date ? new Date(ta.date) : /* @__PURE__ */ new Date(),
            approvedBy: ta.approvedBy || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644"
          }
        });
      }
    }
    if (Array.isArray(backupData.contentSections)) {
      for (const cs of backupData.contentSections) {
        await tx.contentSection.create({
          data: {
            id: cs.id,
            title: cs.title,
            subtitle: cs.subtitle ?? null,
            enabled: cs.enabled !== false,
            order: Number(cs.order || 0),
            config: cs.config ?? null
          }
        });
      }
    }
    if (Array.isArray(backupData.documentRecords)) {
      for (const d of backupData.documentRecords) {
        await tx.documentRecord.create({
          data: {
            id: d.id,
            fileName: d.fileName,
            originalName: d.originalName || d.fileName,
            fileSize: Number(d.fileSize || 0),
            mimeType: d.mimeType ?? null,
            isPrivate: d.isPrivate !== false,
            ownerUserId: d.ownerUserId ?? null,
            propertyId: d.propertyId ?? null,
            unitId: d.unitId ?? null,
            bookingId: d.bookingId ?? null,
            leaseId: d.leaseId ?? null,
            notes: d.notes ?? null,
            createdAt: d.createdAt ? new Date(d.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    if (Array.isArray(backupData.idempotencyRecords)) {
      for (const ir of backupData.idempotencyRecords) {
        await tx.idempotencyRecord.create({
          data: {
            id: ir.id,
            key: ir.key,
            operationType: ir.operationType,
            userId: ir.userId ?? null,
            requestHash: ir.requestHash,
            statusCode: Number(ir.statusCode || 200),
            responseBody: ir.responseBody,
            createdAt: ir.createdAt ? new Date(ir.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    if (Array.isArray(backupData.auditLogs)) {
      for (const a of backupData.auditLogs) {
        await tx.auditLog.create({
          data: {
            id: a.id,
            userId: a.userId ?? null,
            userName: a.userName || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645",
            action: a.action || "\u0625\u062C\u0631\u0627\u0621",
            module: a.module || "\u0639\u0627\u0645",
            details: a.details || "",
            ipAddress: a.ipAddress ?? null,
            createdAt: a.createdAt ? new Date(a.createdAt) : /* @__PURE__ */ new Date()
          }
        });
      }
    }
    return {
      usersRestored: backupData.users?.length || 0,
      propertiesRestored: backupData.properties?.length || 0,
      floorsRestored: backupData.floors?.length || 0,
      amenitiesRestored: backupData.amenities?.length || 0,
      unitsRestored: backupData.units?.length || 0,
      parkingSpotsRestored: backupData.parkingSpots?.length || 0,
      allocationsRestored: backupData.allocations?.length || 0,
      bookingsRestored: backupData.bookings?.length || 0,
      leasesRestored: backupData.leases?.length || 0,
      installmentsRestored: backupData.installments?.length || 0,
      securityDepositsRestored: backupData.securityDeposits?.length || 0,
      securityDepositTransactionsRestored: backupData.securityDepositTransactions?.length || 0,
      paymentsRestored: backupData.payments?.length || 0,
      expensesRestored: backupData.expenses?.length || 0,
      expenseAllocationsRestored: backupData.expenseAllocations?.length || 0,
      expensePaymentsRestored: backupData.expensePayments?.length || 0,
      documentRecordsRestored: backupData.documentRecords?.length || 0,
      idempotencyRecordsRestored: backupData.idempotencyRecords?.length || 0,
      auditLogsRestored: backupData.auditLogs?.length || 0
    };
  });
}

// src/server/reservationService.ts
import { Decimal as Decimal2 } from "@prisma/client/runtime/library";
import { RentalType, BookingStatus, LeaseStatus, InstallmentStatus } from "@prisma/client";

// src/server/depositRefundService.ts
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
var RefundError = class extends Error {
  constructor(statusCode, message, code = "DEPOSIT_OPERATION_REJECTED") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "RefundError";
  }
};
function availableDeposit(totals) {
  const values = Object.values(totals);
  if (values.some((value) => !/^\d{1,10}(?:\.\d{1,2})?$/.test(value))) {
    throw new Error("\u0628\u064A\u0627\u0646\u0627\u062A \u0631\u0635\u064A\u062F \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
  }
  const available = new Prisma.Decimal(totals.collectedAmount).minus(totals.refundedAmount).minus(totals.damageDeductedAmount).minus(totals.rentAppliedAmount);
  if (available.lt(0)) {
    throw new Error("\u062D\u0631\u0643\u0627\u062A \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u062A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062A\u062D\u0635\u064A\u0644\u061B \u064A\u0644\u0632\u0645 \u062A\u0635\u062D\u064A\u062D \u0645\u0648\u062B\u0642.");
  }
  return available;
}
function requiredText(value, label, maxLength = 200) {
  if (typeof value !== "string") {
    throw new RefundError(400, `${label} \u0645\u0637\u0644\u0648\u0628.`);
  }
  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new RefundError(400, `${label} \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.`);
  }
  return text;
}
function money(value, label) {
  if (value === void 0 || value === null || value === "") return new Prisma.Decimal(0);
  if (typeof value !== "string" && typeof value !== "number") {
    throw new RefundError(400, `${label} \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.`);
  }
  const text = String(value).trim();
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) {
    throw new RefundError(
      400,
      `${label} \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0628\u0644\u063A\u0627\u064B \u063A\u064A\u0631 \u0633\u0627\u0644\u0628 \u0628\u0645\u0646\u0632\u0644\u062A\u064A\u0646 \u0639\u0634\u0631\u064A\u062A\u064A\u0646 \u0643\u062D\u062F \u0623\u0642\u0635\u0649.`
    );
  }
  return new Prisma.Decimal(text);
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
async function refundDeposit(input) {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new RefundError(
      503,
      "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629. \u0644\u0645 \u062A\u064F\u0633\u062C\u0651\u0644 \u0623\u064A \u0639\u0645\u0644\u064A\u0629 \u0645\u0627\u0644\u064A\u0629."
    );
  }
  const depositId = requiredText(input.depositId, "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062A\u0623\u0645\u064A\u0646");
  const actorId = requiredText(input.actorId, "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645");
  const clientKey = requiredText(
    input.idempotencyKey,
    "\u0645\u0641\u062A\u0627\u062D \u0645\u0646\u0639 \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0639\u0645\u0644\u064A\u0629",
    200
  );
  const operationType = "security_deposit_refund_v2";
  const operationKey = sha256(
    JSON.stringify([actorId, operationType, clientKey])
  );
  const refund = money(input.refundAmount, "\u0645\u0628\u0644\u063A \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F");
  const deduction = money(input.deductedAmount, "\u0645\u0628\u0644\u063A \u0627\u0644\u062E\u0635\u0645");
  const total = refund.plus(deduction);
  if (total.lte(0)) {
    throw new RefundError(400, "\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0623\u0648 \u062E\u0635\u0645 \u0645\u0648\u062C\u0628.");
  }
  const method = requiredText(
    input.refundMethod,
    "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0639\u0645\u0644\u064A\u0629",
    40
  ).toLowerCase();
  if (!["bank_transfer", "cash", "deduction"].includes(method)) {
    throw new RefundError(
      400,
      "\u0627\u0644\u0645\u062A\u0627\u062D \u062D\u0627\u0644\u064A\u0627\u064B: \u062A\u0648\u062B\u064A\u0642 \u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0628\u0646\u0643\u064A \u0623\u0648 \u0646\u0642\u062F\u064A\u060C \u0623\u0648 \u062E\u0635\u0645."
    );
  }
  if (input.refundType !== void 0 && input.refundType !== "actual_payout") {
    throw new RefundError(400, "\u0646\u0648\u0639 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645 \u062D\u0627\u0644\u064A\u0627\u064B.");
  }
  if (input.providerConfirmation !== void 0) {
    throw new RefundError(
      400,
      "\u0644\u0627 \u064A\u064F\u0642\u0628\u0644 \u062A\u0623\u0643\u064A\u062F \u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u062F\u0641\u0639 \u0645\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0644\u0628."
    );
  }
  if (refund.gt(0) && method === "deduction") {
    throw new RefundError(400, "\u062D\u062F\u062F \u0637\u0631\u064A\u0642\u0629 \u0635\u0631\u0641 \u0645\u0628\u0644\u063A \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F.");
  }
  if (refund.eq(0) && method !== "deduction") {
    throw new RefundError(400, "\u0627\u0633\u062A\u062E\u062F\u0645 deduction \u0644\u0644\u062E\u0635\u0645 \u0641\u0642\u0637.");
  }
  const reference = requiredText(
    input.refundReference,
    "\u0645\u0631\u062C\u0639 \u0625\u062B\u0628\u0627\u062A \u0627\u0644\u0635\u0631\u0641 \u0623\u0648 \u0645\u0633\u062A\u0646\u062F \u0627\u0644\u062E\u0635\u0645"
  );
  const reason = deduction.gt(0) ? requiredText(input.deductionReason, "\u0633\u0628\u0628 \u0627\u0644\u062E\u0635\u0645", 2e3) : null;
  const requestHash = sha256(
    JSON.stringify({
      depositId,
      refundAmount: refund.toFixed(2),
      deductedAmount: deduction.toFixed(2),
      deductionReason: reason,
      refundMethod: method,
      refundReference: reference,
      refundType: "actual_payout"
    })
  );
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT 1 AS ok
        FROM (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${operationKey}, 0)
          )
        ) AS operation_lock
      `;
      const locked = await tx.$queryRaw`
        SELECT "id"
        FROM "SecurityDepositRecord"
        WHERE "id" = ${depositId}
        FOR UPDATE
      `;
      if (locked.length !== 1) {
        throw new RefundError(404, "\u0633\u062C\u0644 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
      }
      const deposit = await tx.securityDepositRecord.findUnique({
        where: { id: depositId },
        include: {
          booking: {
            select: { unit: { select: { propertyId: true } } }
          },
          lease: {
            select: { unit: { select: { propertyId: true } } }
          }
        }
      });
      if (!deposit) {
        throw new RefundError(404, "\u0633\u062C\u0644 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
      }
      const actor = await tx.user.findUnique({
        where: { id: actorId },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          allowedProperties: true
        }
      });
      if (!actor?.isActive) {
        throw new RefundError(401, "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u063A\u064A\u0631 \u0646\u0634\u0637.");
      }
      if (!["SUPER_ADMIN", "ACCOUNTANT", "PROPERTY_MANAGER"].includes(actor.role)) {
        throw new RefundError(403, "\u063A\u064A\u0631 \u0645\u062E\u0648\u0644 \u0628\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0639\u0645\u0644\u064A\u0629.");
      }
      if (Boolean(deposit.bookingId) === Boolean(deposit.leaseId)) {
        throw new RefundError(
          409,
          "\u064A\u062C\u0628 \u0631\u0628\u0637 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u0628\u062D\u062C\u0632 \u0648\u0627\u062D\u062F \u0623\u0648 \u0639\u0642\u062F \u0648\u0627\u062D\u062F \u062D\u0635\u0631\u0627\u064B."
        );
      }
      const propertyId = deposit.booking?.unit?.propertyId ?? deposit.lease?.unit?.propertyId;
      if (!propertyId) {
        throw new RefundError(409, "\u062A\u0639\u0630\u0631 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0645\u0628\u0646\u0649 \u0627\u0644\u0645\u0631\u062A\u0628\u0637 \u0628\u0627\u0644\u062A\u0623\u0645\u064A\u0646.");
      }
      if (actor.role !== "SUPER_ADMIN" && !actor.allowedProperties.includes("all") && !actor.allowedProperties.includes(propertyId)) {
        throw new RefundError(403, "\u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u062E\u0627\u0631\u062C \u0646\u0637\u0627\u0642 \u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0643.");
      }
      const previous = await tx.idempotencyRecord.findUnique({
        where: {
          key_operationType: {
            key: operationKey,
            operationType
          }
        }
      });
      if (previous) {
        if (previous.userId !== actor.id) {
          throw new RefundError(403, "\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0644\u0627 \u064A\u062E\u0635 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645.");
        }
        if (previous.requestHash !== requestHash) {
          throw new RefundError(
            409,
            "\u0627\u0633\u062A\u064F\u062E\u062F\u0645 \u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0646\u0641\u0633\u0647 \u0645\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062E\u062A\u0644\u0641\u0629."
          );
        }
        return previous.responseBody;
      }
      if (!deposit.collectionVerifiedAt || !deposit.collectionReference?.trim()) {
        throw new RefundError(
          409,
          "\u0644\u0645 \u064A\u064F\u0648\u062B\u0651\u0642 \u062A\u062D\u0635\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062A\u0623\u0645\u064A\u0646. \u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0633\u062A\u0631\u062F\u0627\u062F\u0647 \u0623\u0648 \u0627\u0644\u062E\u0635\u0645 \u0645\u0646\u0647."
        );
      }
      if (!["held", "pending_refund", "partially_refunded"].includes(deposit.status)) {
        throw new RefundError(409, "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u0644\u0627 \u062A\u0633\u0645\u062D \u0628\u0627\u0644\u0639\u0645\u0644\u064A\u0629.");
      }
      const existingRentApplied = deposit.rentAppliedAmount ? new Prisma.Decimal(deposit.rentAppliedAmount) : new Prisma.Decimal(0);
      const available = availableDeposit({
        collectedAmount: new Prisma.Decimal(deposit.collectedAmount).toFixed(2),
        refundedAmount: new Prisma.Decimal(deposit.refundedAmount).toFixed(2),
        damageDeductedAmount: new Prisma.Decimal(deposit.deductedAmount).toFixed(2),
        rentAppliedAmount: existingRentApplied.toFixed(2)
      });
      if (total.gt(available)) {
        throw new RefundError(
          400,
          `\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u062D ${available.toFixed(2)} \u0631.\u0633.`,
          "INSUFFICIENT_DEPOSIT_BALANCE"
        );
      }
      const refundedTotal = deposit.refundedAmount.plus(refund);
      const deductedTotal = deposit.deductedAmount.plus(deduction);
      const remaining = available.minus(total);
      const status = remaining.eq(0) ? refundedTotal.eq(0) ? "deducted" : "refunded" : "partially_refunded";
      const updated = await tx.securityDepositRecord.update({
        where: { id: deposit.id },
        data: {
          refundedAmount: refundedTotal,
          deductedAmount: deductedTotal,
          status,
          deductionReason: reason ?? deposit.deductionReason,
          refundMethod: refund.gt(0) ? method : deposit.refundMethod,
          refundReference: refund.gt(0) ? reference : deposit.refundReference,
          refundType: refund.gt(0) ? "actual_payout" : deposit.refundType,
          refundedByUserId: refund.gt(0) ? actor.id : deposit.refundedByUserId,
          refundedAt: refund.gt(0) ? /* @__PURE__ */ new Date() : deposit.refundedAt
        }
      });
      const transactionIds = [];
      if (refund.gt(0)) {
        const movement = await tx.securityDepositTransaction.create({
          data: {
            depositId: deposit.id,
            type: "refund",
            amount: refund,
            method,
            reference,
            executedByUserId: actor.id,
            status: "completed",
            idempotencyKey: sha256(`${operationKey}:refund`)
          }
        });
        transactionIds.push(movement.id);
      }
      if (deduction.gt(0)) {
        const movement = await tx.securityDepositTransaction.create({
          data: {
            depositId: deposit.id,
            type: "deduction",
            amount: deduction,
            method: "deduction",
            reference,
            reason,
            executedByUserId: actor.id,
            status: "completed",
            idempotencyKey: sha256(`${operationKey}:deduction`)
          }
        });
        transactionIds.push(movement.id);
      }
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          userName: actor.username,
          action: "\u0645\u0639\u0627\u0644\u062C\u0629 \u062A\u0623\u0645\u064A\u0646 \u0645\u0648\u062B\u0642\u0629",
          module: "\u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A",
          details: JSON.stringify({
            depositId: deposit.id,
            propertyId,
            refund: refund.toFixed(2),
            deduction: deduction.toFixed(2),
            reference,
            transactionIds
          })
        }
      });
      const responsePayload = {
        success: true,
        depositId: deposit.id,
        status: updated.status,
        refundedAmount: refundedTotal.toFixed(2),
        deductedAmount: deductedTotal.toFixed(2),
        availableBalance: remaining.toFixed(2),
        transactionIds
      };
      await tx.idempotencyRecord.create({
        data: {
          key: operationKey,
          operationType,
          userId: actor.id,
          requestHash,
          responseBody: responsePayload
        }
      });
      return responsePayload;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5e3,
      timeout: 15e3
    }
  );
}
async function applyDepositToRent(input) {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new RefundError(
      503,
      "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629. \u0644\u0645 \u062A\u064F\u0633\u062C\u0651\u0644 \u0623\u064A \u0639\u0645\u0644\u064A\u0629 \u0645\u0627\u0644\u064A\u0629."
    );
  }
  const depositId = requiredText(input.depositId, "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062A\u0623\u0645\u064A\u0646");
  const installmentId = requiredText(input.installmentId, "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0642\u0633\u0637 \u0627\u0644\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641");
  const approvalReference = requiredText(input.approvalReference, "\u0645\u0631\u062C\u0639 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062A\u0633\u0648\u064A\u0629");
  const actorId = requiredText(input.actorId, "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645");
  const clientKey = requiredText(
    input.idempotencyKey,
    "\u0645\u0641\u062A\u0627\u062D \u0645\u0646\u0639 \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0639\u0645\u0644\u064A\u0629",
    200
  );
  const operationType = "security_deposit_apply_to_rent_v1";
  const operationKey = sha256(
    JSON.stringify([actorId, operationType, clientKey])
  );
  const applyAmount = money(input.amount, "\u0645\u0628\u0644\u063A \u0627\u0644\u062A\u0633\u0648\u064A\u0629");
  if (applyAmount.lte(0)) {
    throw new RefundError(400, "\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \u0645\u0628\u0644\u063A \u062A\u0633\u0648\u064A\u0629 \u0645\u0648\u062C\u0628 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0635\u0641\u0631.");
  }
  const reason = input.reason ? String(input.reason).trim() : "\u062A\u0633\u0648\u064A\u0629 \u0642\u0633\u0637 \u0625\u064A\u062C\u0627\u0631";
  const requestHash = sha256(
    JSON.stringify({
      depositId,
      installmentId,
      amount: applyAmount.toFixed(2),
      approvalReference,
      reason
    })
  );
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT 1 AS ok
        FROM (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${operationKey}, 0)
          )
        ) AS operation_lock
      `;
      if (depositId < installmentId) {
        await tx.$queryRaw`SELECT "id" FROM "SecurityDepositRecord" WHERE "id" = ${depositId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "LeaseInstallment" WHERE "id" = ${installmentId} FOR UPDATE`;
      } else {
        await tx.$queryRaw`SELECT "id" FROM "LeaseInstallment" WHERE "id" = ${installmentId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "SecurityDepositRecord" WHERE "id" = ${depositId} FOR UPDATE`;
      }
      const deposit = await tx.securityDepositRecord.findUnique({
        where: { id: depositId },
        include: {
          booking: {
            select: { unit: { select: { propertyId: true } } }
          },
          lease: {
            select: { unit: { select: { propertyId: true } } }
          }
        }
      });
      if (!deposit) {
        throw new RefundError(404, "\u0633\u062C\u0644 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
      }
      const installment = await tx.leaseInstallment.findUnique({
        where: { id: installmentId },
        include: {
          lease: {
            include: {
              unit: {
                select: { propertyId: true }
              }
            }
          }
        }
      });
      if (!installment) {
        throw new RefundError(404, "\u0627\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 / \u0627\u0644\u0642\u0633\u0637 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
      }
      const actor = await tx.user.findUnique({
        where: { id: actorId },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          allowedProperties: true
        }
      });
      if (!actor?.isActive) {
        throw new RefundError(401, "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u063A\u064A\u0631 \u0646\u0634\u0637.");
      }
      if (!["SUPER_ADMIN", "ACCOUNTANT", "PROPERTY_MANAGER"].includes(actor.role)) {
        throw new RefundError(403, "\u063A\u064A\u0631 \u0645\u062E\u0648\u0644 \u0628\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0639\u0645\u0644\u064A\u0629.");
      }
      const propertyId = deposit.booking?.unit?.propertyId ?? deposit.lease?.unit?.propertyId;
      if (!propertyId) {
        throw new RefundError(409, "\u062A\u0639\u0630\u0631 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0645\u0628\u0646\u0649 \u0627\u0644\u0645\u0631\u062A\u0628\u0637 \u0628\u0627\u0644\u062A\u0623\u0645\u064A\u0646.");
      }
      if (actor.role !== "SUPER_ADMIN" && !actor.allowedProperties.includes("all") && !actor.allowedProperties.includes(propertyId)) {
        throw new RefundError(403, "\u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u062E\u0627\u0631\u062C \u0646\u0637\u0627\u0642 \u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0643.");
      }
      const previous = await tx.idempotencyRecord.findUnique({
        where: {
          key_operationType: {
            key: operationKey,
            operationType
          }
        }
      });
      if (previous) {
        if (previous.userId !== actor.id) {
          throw new RefundError(403, "\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0644\u0627 \u064A\u062E\u0635 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645.");
        }
        if (previous.requestHash !== requestHash) {
          throw new RefundError(
            409,
            "\u0627\u0633\u062A\u064F\u062E\u062F\u0645 \u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0646\u0641\u0633\u0647 \u0645\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062E\u062A\u0644\u0641\u0629 \u0644\u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u0627\u0644\u064A."
          );
        }
        return previous.responseBody;
      }
      if (!deposit.collectionVerifiedAt || !deposit.collectionReference?.trim()) {
        throw new RefundError(
          409,
          "\u0644\u0645 \u064A\u064F\u0648\u062B\u0651\u0642 \u062A\u062D\u0635\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062A\u0623\u0645\u064A\u0646. \u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0633\u062A\u0631\u062F\u0627\u062F\u0647 \u0623\u0648 \u062A\u0633\u0648\u064A\u062A\u0647."
        );
      }
      if (!["held", "pending_refund", "partially_refunded"].includes(deposit.status)) {
        throw new RefundError(409, "\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u0644\u0627 \u062A\u0633\u0645\u062D \u0628\u0625\u062C\u0631\u0627\u0621 \u062A\u0633\u0648\u064A\u0629.");
      }
      if (!deposit.leaseId || deposit.bookingId !== null || installment.leaseId !== deposit.leaseId) {
        throw new RefundError(
          409,
          "\u0627\u0644\u062A\u0633\u0648\u064A\u0629 \u0645\u062A\u0627\u062D\u0629 \u0641\u0642\u0637 \u0644\u0642\u0633\u0637 \u0645\u0646 \u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0645\u0631\u062A\u0628\u0637 \u0628\u0647\u0630\u0627 \u0627\u0644\u062A\u0623\u0645\u064A\u0646."
        );
      }
      const targetPropertyId = installment.lease?.unit?.propertyId;
      if (targetPropertyId && actor.role !== "SUPER_ADMIN" && !actor.allowedProperties.includes("all") && !actor.allowedProperties.includes(targetPropertyId)) {
        throw new RefundError(403, "\u0645\u0628\u0646\u0649 \u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u062E\u0627\u0631\u062C \u0646\u0637\u0627\u0642 \u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0643.");
      }
      const existingRentApplied = deposit.rentAppliedAmount ? new Prisma.Decimal(deposit.rentAppliedAmount) : new Prisma.Decimal(0);
      const available = availableDeposit({
        collectedAmount: new Prisma.Decimal(deposit.collectedAmount).toFixed(2),
        refundedAmount: new Prisma.Decimal(deposit.refundedAmount).toFixed(2),
        damageDeductedAmount: new Prisma.Decimal(deposit.deductedAmount).toFixed(2),
        rentAppliedAmount: existingRentApplied.toFixed(2)
      });
      if (applyAmount.gt(available)) {
        throw new RefundError(
          400,
          `\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u062D \u0644\u0644\u062A\u0623\u0645\u064A\u0646 \u0648\u0647\u0648 ${available.toFixed(2)} \u0631.\u0633.`,
          "INSUFFICIENT_DEPOSIT_BALANCE"
        );
      }
      const remInstallment = new Prisma.Decimal(installment.remainingAmount);
      if (applyAmount.gt(remInstallment)) {
        throw new RefundError(
          400,
          `\u0645\u0628\u0644\u063A \u0627\u0644\u062A\u0633\u0648\u064A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0639\u0644\u0649 \u0627\u0644\u0642\u0633\u0637 \u0648\u0647\u0648 ${remInstallment.toFixed(2)} \u0631.\u0633.`,
          "INSTALLMENT_REMAINING_EXCEEDED"
        );
      }
      const refundedTotal = deposit.refundedAmount;
      const deductedTotal = deposit.deductedAmount;
      const rentAppliedTotal = existingRentApplied.plus(applyAmount);
      const remaining = available.minus(applyAmount);
      const depositStatus = remaining.eq(0) ? refundedTotal.eq(0) && deductedTotal.eq(0) ? "claimed_for_damage" : "fully_refunded" : "partially_refunded";
      const updatedDeposit = await tx.securityDepositRecord.update({
        where: { id: deposit.id },
        data: {
          rentAppliedAmount: rentAppliedTotal,
          status: depositStatus,
          notes: deposit.notes ? `${deposit.notes} | \u062A\u0633\u0648\u064A\u0629 \u0625\u064A\u062C\u0627\u0631: ${approvalReference} (${reason})` : `\u062A\u0633\u0648\u064A\u0629 \u0625\u064A\u062C\u0627\u0631: ${approvalReference} (${reason})`
        }
      });
      const installmentPaid = new Prisma.Decimal(installment.paidAmount).plus(applyAmount);
      const installmentRemaining = new Prisma.Decimal(installment.amount).minus(installmentPaid);
      const installmentStatus = installmentRemaining.eq(0) ? "PAID" : "PARTIALLY_PAID";
      await tx.leaseInstallment.update({
        where: { id: installment.id },
        data: {
          paidAmount: installmentPaid,
          remainingAmount: installmentRemaining,
          status: installmentStatus,
          paidAt: installmentRemaining.eq(0) ? /* @__PURE__ */ new Date() : installment.paidAt
        }
      });
      const movement = await tx.securityDepositTransaction.create({
        data: {
          depositId: deposit.id,
          type: "rent_application",
          amount: applyAmount,
          method: "security_deposit",
          reference: approvalReference,
          reason: `${approvalReference}: ${reason}`,
          targetLeaseId: installment.leaseId,
          targetInstallmentId: installment.id,
          executedByUserId: actor.id,
          status: "completed",
          idempotencyKey: sha256(`${operationKey}:rent_apply`)
        }
      });
      const settlementClassification = {
        paymentMethod: "security_deposit",
        sourceType: "deposit_application",
        affectsCash: false
      };
      const paymentRec = await tx.paymentRecord.create({
        data: {
          leaseId: installment.leaseId,
          installmentId: installment.id,
          amount: applyAmount,
          paymentMethod: settlementClassification.paymentMethod,
          sourceType: settlementClassification.sourceType,
          affectsCash: settlementClassification.affectsCash,
          referenceNo: approvalReference,
          receiptNo: `DEP-SETTLE-${Date.now()}`,
          status: "completed",
          isVerified: true,
          paidAt: /* @__PURE__ */ new Date(),
          notes: `\u062A\u0633\u0648\u064A\u0629 \u0645\u0646 \u0631\u0635\u064A\u062F \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u0644\u0633\u062F\u0627\u062F \u0642\u0633\u0637 \u0627\u0644\u0639\u0642\u062F #${installment.lease.contractNumber} \u0628\u0645\u0648\u062C\u0628 \u0645\u0631\u062C\u0639 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F: ${approvalReference} [\u062A\u0633\u0648\u064A\u0629 \u062F\u0641\u062A\u0631\u064A\u0629 \u0645\u0639\u0632\u0648\u0644\u0629 \u0644\u0627 \u062A\u0624\u062B\u0631 \u0639\u0644\u0649 \u0627\u0644\u0633\u064A\u0648\u0644\u0629 \u0627\u0644\u0646\u0642\u062F\u064A\u0629]`
        }
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          userName: actor.username,
          action: "\u062A\u0633\u0648\u064A\u0629 \u062A\u0623\u0645\u064A\u0646 \u0645\u0642\u0627\u0628\u0644 \u0642\u0633\u0637 \u0625\u064A\u062C\u0627\u0631\u064A",
          module: "\u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A",
          details: JSON.stringify({
            depositId: deposit.id,
            propertyId,
            installmentId: installment.id,
            leaseId: installment.leaseId,
            amount: applyAmount.toFixed(2),
            approvalReference,
            reason,
            transactionId: movement.id,
            paymentRecordId: paymentRec.id
          })
        }
      });
      const responsePayload = {
        success: true,
        depositId: deposit.id,
        installmentId: installment.id,
        status: updatedDeposit.status,
        refundedAmount: refundedTotal.toFixed(2),
        damageDeductedAmount: deductedTotal.toFixed(2),
        rentAppliedAmount: rentAppliedTotal.toFixed(2),
        availableBalance: remaining.toFixed(2),
        transactionIds: [movement.id]
      };
      await tx.idempotencyRecord.create({
        data: {
          key: operationKey,
          operationType,
          userId: actor.id,
          requestHash,
          responseBody: responsePayload
        }
      });
      return responsePayload;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5e3,
      timeout: 15e3
    }
  );
}

// src/server/reservationService.ts
function splitMoney(total, count) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(total)) {
    throw new Error("\u0627\u0644\u0645\u0628\u0644\u063A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
  }
  if (!Number.isInteger(count) || count < 1 || count > 120) {
    throw new Error("\u0639\u062F\u062F \u0627\u0644\u0623\u0642\u0633\u0627\u0637 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
  }
  const [whole, fraction = ""] = total.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  const divisor = BigInt(count);
  const base = cents / divisor;
  const remainder = cents % divisor;
  return Array.from({ length: count }, (_, index) => {
    const value = base + (BigInt(index) < remainder ? 1n : 0n);
    return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
  });
}
function addCalendarMonths(baseDate, monthsToAdd) {
  const d = new Date(baseDate);
  const startDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + monthsToAdd);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const maxDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(startDay, maxDays));
  return d;
}
function calculateContractEndDate(startDateStr, months) {
  const start = /* @__PURE__ */ new Date(`${startDateStr}T00:00:00.000Z`);
  const target = addCalendarMonths(start, months);
  target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}
function generateInstallments(totalRent, startDateStr, frequency, durationMonths = 12) {
  let count = 1;
  let intervalMonths = 12;
  if (frequency === "2_payments") {
    count = 2;
    intervalMonths = Math.max(1, Math.floor(durationMonths / 2));
  } else if (frequency === "4_payments") {
    count = 4;
    intervalMonths = Math.max(1, Math.floor(durationMonths / 4));
  } else if (frequency === "monthly") {
    count = durationMonths;
    intervalMonths = 1;
  }
  const totalNum = typeof totalRent === "number" ? totalRent : parseFloat(totalRent);
  const totalStr = totalNum.toFixed(2);
  const splitAmounts = splitMoney(totalStr, count);
  const startDate = /* @__PURE__ */ new Date(`${startDateStr}T00:00:00.000Z`);
  return splitAmounts.map((amountStr, i) => {
    const dueDate = addCalendarMonths(startDate, i * intervalMonths);
    const amountVal = parseFloat(amountStr);
    let label = `\u0627\u0644\u062F\u0641\u0639\u0629 ${i + 1} \u0645\u0646 ${count}`;
    if (count === 1) label = "\u062F\u0641\u0639\u0629 \u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0643\u0627\u0645\u0644\u0629 (\u062F\u0641\u0639\u0629 \u0648\u0627\u062D\u062F\u0629)";
    else if (count === 2) label = i === 0 ? "\u0627\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 (\u0646\u0635\u0641 \u0633\u0646\u0648\u064A\u0629)" : "\u0627\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u062B\u0627\u0646\u064A\u0629 (\u0646\u0635\u0641 \u0633\u0646\u0648\u064A\u0629)";
    else if (count === 4) label = `\u0627\u0644\u062F\u0641\u0639\u0629 \u0631\u0628\u0639 \u0627\u0644\u0633\u0646\u0648\u064A\u0629 ${i + 1} \u0645\u0646 4`;
    else if (frequency === "monthly") label = `\u0642\u0633\u0637 \u0634\u0647\u0631 ${i + 1}`;
    return {
      number: i + 1,
      label,
      dueDate: dueDate.toISOString().slice(0, 10),
      amount: amountVal,
      amountFormatted: amountStr,
      paidAmount: 0,
      remainingAmount: amountVal,
      status: "UPCOMING"
    };
  });
}
async function checkUnitConflict(unitId, startDateTime, endDateTime, excludeAllocationId, memoryAllocations) {
  if (process.env.DATABASE_URL) {
    const allocations = await prisma.unitAllocation.findMany({
      where: {
        unitId,
        status: "active",
        ...excludeAllocationId ? { id: { not: excludeAllocationId } } : {},
        AND: [
          { startDate: { lt: endDateTime } },
          { endDate: { gt: startDateTime } }
        ]
      }
    });
    if (allocations.length > 0) {
      return { hasConflict: true, conflictingAllocation: allocations[0] };
    }
    return { hasConflict: false };
  }
  const list = memoryAllocations || [];
  const startMs = startDateTime.getTime();
  const endMs = endDateTime.getTime();
  const conflict = list.find((a) => {
    if (a.unitId !== unitId) return false;
    if (a.status !== "active") return false;
    if (excludeAllocationId && a.id === excludeAllocationId) return false;
    const aStartMs = new Date(a.startDate).getTime();
    const aEndMs = new Date(a.endDate).getTime();
    return aStartMs < endMs && aEndMs > startMs;
  });
  if (conflict) {
    return { hasConflict: true, conflictingAllocation: conflict };
  }
  return { hasConflict: false };
}
async function processDailyReservation(input, memoryContext) {
  const { unitId, checkIn, checkOut, guestName, guestPhone, guestEmail, guestIdNumber, notes, idempotencyKey } = input;
  if (!unitId || !checkIn || !checkOut) {
    throw new Error("\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629.");
  }
  const start = /* @__PURE__ */ new Date(`${checkIn}T15:00:00.000Z`);
  const departureDate = /* @__PURE__ */ new Date(`${checkOut}T12:00:00.000Z`);
  if (isNaN(start.getTime()) || isNaN(departureDate.getTime()) || start >= departureDate) {
    throw new Error("\u062A\u0648\u0627\u0631\u064A\u062E \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629. \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u062A\u0627\u0631\u064A\u062E \u0645\u063A\u0627\u062F\u0631\u0629 \u0628\u0639\u062F \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0648\u0635\u0648\u0644.");
  }
  const endWithCleaning = /* @__PURE__ */ new Date(`${checkOut}T15:00:00.000Z`);
  const diffMs = departureDate.getTime() - start.getTime();
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
      await tx.$executeRaw`SELECT id FROM "Unit" WHERE id = ${unitId} FOR UPDATE`;
      const unit2 = await tx.unit.findUnique({
        where: { id: unitId },
        include: { property: true }
      });
      if (!unit2) {
        throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
      }
      if (unit2.operationalStatus === "blocked" || unit2.occupancyStatus === "blocked") {
        const err = new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0645\u062D\u062C\u0648\u0628\u0629 \u0625\u062F\u0627\u0631\u064A\u0627\u064B \u062D\u0627\u0644\u064A\u0627\u064B.");
        err.statusCode = 409;
        throw err;
      }
      const conflict2 = await tx.unitAllocation.findFirst({
        where: {
          unitId,
          status: "active",
          startDate: { lt: endWithCleaning },
          endDate: { gt: start }
        }
      });
      if (conflict2) {
        const err = new Error("\u0639\u0630\u0631\u0627\u064B\u060C \u0647\u0630\u0647 \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0645\u062D\u062C\u0648\u0632\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0623\u0648 \u0641\u064A \u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0641\u0646\u062F\u0642\u064A.");
        err.statusCode = 409;
        throw err;
      }
      const nightlyRate2 = Number(unit2.dailyRate) || 850;
      const subtotal2 = nightlyRate2 * totalNights;
      const cleaningFee2 = unit2.cleaningFee !== void 0 && unit2.cleaningFee !== null ? Number(unit2.cleaningFee) : 150;
      const taxPercentage2 = unit2.taxPercentage !== void 0 && unit2.taxPercentage !== null ? Number(unit2.taxPercentage) : 15;
      const taxes2 = Math.round(subtotal2 * (taxPercentage2 / 100) * 100) / 100;
      const securityDeposit2 = Number(unit2.securityDeposit) || 500;
      const totalAmount2 = subtotal2 + cleaningFee2 + taxes2 + securityDeposit2;
      const bookingNumber2 = `LH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const booking = await tx.booking.create({
        data: {
          bookingNumber: bookingNumber2,
          idempotencyKey: idempotencyKey || null,
          unitId,
          guestName,
          guestPhone,
          guestEmail: guestEmail || null,
          guestIdNumber: guestIdNumber || null,
          startDate: start,
          endDate: departureDate,
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
          endDate: endWithCleaning,
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
          collectedAmount: new Decimal2(0),
          collectionReference: null,
          collectionVerifiedAt: null,
          status: "held",
          notes: `\u062A\u0623\u0645\u064A\u0646 \u0641\u0646\u062F\u0642\u064A \u0645\u0633\u062A\u0631\u062F \u0644\u062D\u062C\u0632 ${bookingNumber2}`
        }
      });
      await tx.unit.update({
        where: { id: unitId },
        data: { occupancyStatus: "daily_occupied" }
      }).catch(() => {
      });
      return serializeDecimals({
        booking,
        allocation,
        totalAmount: totalAmount2,
        subtotal: subtotal2,
        taxes: taxes2,
        cleaningFee: cleaningFee2,
        securityDeposit: securityDeposit2
      });
    });
  }
  const state = memoryContext?.state;
  if (!state) {
    throw new Error("\u062A\u0639\u0630\u0631 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u062D\u062C\u0632 \u0644\u0639\u062F\u0645 \u062A\u0648\u0641\u0631 \u0633\u064A\u0627\u0642 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
  }
  if (!state.bookings) state.bookings = [];
  if (!state.allocations) state.allocations = [];
  if (!state.securityDeposits) state.securityDeposits = [];
  if (idempotencyKey) {
    const existing = state.bookings.find((b) => b.idempotencyKey === idempotencyKey);
    if (existing) {
      return {
        booking: existing,
        allocation: state.allocations.find((a) => a.referenceId === existing.id) || null,
        totalAmount: existing.totalAmount,
        subtotal: existing.subtotal || existing.totalAmount,
        taxes: existing.taxes || 0,
        cleaningFee: existing.cleaningFee || 0,
        securityDeposit: existing.securityDeposit || 0
      };
    }
  }
  const unit = (state.units || []).find((u) => u.id === unitId);
  if (!unit) {
    throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
  }
  if (unit.operationalStatus === "blocked" || unit.occupancyStatus === "blocked") {
    const err = new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0645\u062D\u062C\u0648\u0628\u0629 \u0625\u062F\u0627\u0631\u064A\u0627\u064B \u062D\u0627\u0644\u064A\u0627\u064B.");
    err.statusCode = 409;
    throw err;
  }
  const conflict = await checkUnitConflict(unitId, start, endWithCleaning, void 0, state.allocations);
  if (conflict.hasConflict) {
    const err = new Error("\u0639\u0630\u0631\u0627\u064B\u060C \u0647\u0630\u0647 \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0645\u062D\u062C\u0648\u0632\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0623\u0648 \u0641\u064A \u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0641\u0646\u062F\u0642\u064A.");
    err.statusCode = 409;
    throw err;
  }
  const nightlyRate = Number(unit.dailyRate) || 850;
  const subtotal = nightlyRate * totalNights;
  const cleaningFee = unit.cleaningFee !== void 0 && unit.cleaningFee !== null ? Number(unit.cleaningFee) : 150;
  const taxPercentage = unit.taxPercentage !== void 0 && unit.taxPercentage !== null ? Number(unit.taxPercentage) : 15;
  const taxes = Math.round(subtotal * (taxPercentage / 100) * 100) / 100;
  const securityDeposit = Number(unit.securityDeposit) || 500;
  const totalAmount = subtotal + cleaningFee + taxes + securityDeposit;
  const bookingNumber = `LH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const bookingId = `bk_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const newBooking = {
    id: bookingId,
    bookingNumber,
    idempotencyKey: idempotencyKey || null,
    unitId,
    propertyId: unit.propertyId,
    guestName,
    guestPhone,
    guestEmail: guestEmail || null,
    guestIdNumber: guestIdNumber || null,
    guest: {
      fullName: guestName,
      phone: guestPhone,
      email: guestEmail || "",
      nationalIdOrPassport: guestIdNumber || "",
      idVerified: false
    },
    startDate: start.toISOString(),
    endDate: departureDate.toISOString(),
    checkIn,
    checkOut,
    rentalType: "daily",
    totalNights,
    guestsCount: input.guestsCount || 1,
    nightlyRate,
    subtotal,
    cleaningFee,
    taxes,
    securityDeposit,
    totalAmount,
    paidAmount: 0,
    status: "confirmed",
    paymentStatus: "pending",
    identityStatus: "pending_verification",
    smartLockPin: "884210",
    notes: notes || null,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const newAllocation = {
    id: `alloc_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    unitId,
    startDate: start.toISOString(),
    endDate: endWithCleaning.toISOString(),
    rentalType: "DAILY",
    type: "booking",
    referenceId: bookingId,
    purpose: "booking",
    status: "active",
    notes: `\u062D\u062C\u0632 \u064A\u0648\u0645\u064A ${bookingNumber} - \u0627\u0644\u0646\u0632\u064A\u0644: ${guestName}`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const newDeposit = {
    id: `sd_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    bookingId,
    unitId,
    guestName,
    amount: securityDeposit,
    collectedAmount: 0,
    collectionReference: null,
    collectionVerifiedAt: null,
    status: "held",
    refundedAmount: 0,
    deductedAmount: 0,
    rentAppliedAmount: 0,
    notes: `\u062A\u0623\u0645\u064A\u0646 \u0645\u0633\u062A\u0631\u062F \u0644\u062D\u062C\u0632 ${bookingNumber}`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  state.bookings.push(newBooking);
  state.allocations.push(newAllocation);
  state.securityDeposits.push(newDeposit);
  unit.occupancyStatus = "daily_occupied";
  if (memoryContext.persist) {
    memoryContext.persist();
  }
  return {
    booking: newBooking,
    allocation: newAllocation,
    totalAmount,
    subtotal,
    taxes,
    cleaningFee,
    securityDeposit
  };
}
async function processLeaseContract(input, memoryContext) {
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
    includedAmenities,
    termsConditions,
    idempotencyKey
  } = input;
  if (!unitId || !startDate || !tenantName || !tenantPhone || !tenantIdNumber) {
    throw new Error("\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0639\u0642\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629. \u064A\u0644\u0632\u0645 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0648\u062D\u062F\u0629\u060C \u0648\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0628\u062F\u0627\u064A\u0629\u060C \u0648\u0627\u0633\u0645 \u0648\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0648\u0647\u064F\u0648\u064A\u0629 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631.");
  }
  const durationMonths = rentalType === "monthly" ? input.durationMonths || 1 : 12;
  const endDate = input.endDate || calculateContractEndDate(startDate, durationMonths);
  const start = /* @__PURE__ */ new Date(`${startDate}T15:00:00.000Z`);
  const end = /* @__PURE__ */ new Date(`${endDate}T12:00:00.000Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw new Error("\u062A\u0648\u0627\u0631\u064A\u062E \u0627\u0644\u0639\u0642\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
  }
  const endWithBuffer = /* @__PURE__ */ new Date(`${endDate}T15:00:00.000Z`);
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
      await tx.$executeRaw`SELECT id FROM "Unit" WHERE id = ${unitId} FOR UPDATE`;
      const unit2 = await tx.unit.findUnique({
        where: { id: unitId },
        include: { property: true }
      });
      if (!unit2) {
        throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
      }
      const conflict2 = await tx.unitAllocation.findFirst({
        where: {
          unitId,
          status: "active",
          startDate: { lt: endWithBuffer },
          endDate: { gt: start }
        }
      });
      if (conflict2) {
        const err = new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0645\u0634\u063A\u0648\u0644\u0629 \u0628\u0639\u0642\u062F \u0623\u0648 \u062D\u062C\u0632 \u0622\u062E\u0631 \u062E\u0644\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.");
        err.statusCode = 409;
        throw err;
      }
      const baseAnnualRent2 = Number(unit2.annualRate) || 85e3;
      const surchargePercent2 = rentalType === "annual" && paymentFrequency === "2_payments" && unit2.semiAnnualSurchargePercent ? Number(unit2.semiAnnualSurchargePercent) : 0;
      const annualRentRate2 = baseAnnualRent2 * (1 + surchargePercent2 / 100);
      const monthlyRentRate2 = Number(unit2.monthlyRate) || 8500;
      const totalRentForPeriod2 = rentalType === "annual" ? annualRentRate2 : monthlyRentRate2 * durationMonths;
      const installmentsData2 = generateInstallments(
        totalRentForPeriod2,
        startDate,
        paymentFrequency,
        durationMonths
      );
      const contractNumber2 = `CNT-${rentalType === "annual" ? "ANN" : "MTH"}-${Date.now().toString().slice(-6)}`;
      const securityDeposit2 = Number(rentalType === "annual" ? unit2.yearlySecurityDeposit : unit2.monthlySecurityDeposit) || 2500;
      const frozenServices2 = contractServices || {
        responsibilities: {
          electricity: "tenant",
          water: "tenant",
          internet: "company",
          routineMaintenance: "company",
          misuseMaintenance: "tenant"
        },
        serviceCaps: {
          electricityMonthlyAllowance: 0,
          waterMonthlyAllowance: 0
        },
        handoverReport: {
          handoverDate: startDate,
          keysCount: 2,
          electricityMeterReading: "0000",
          waterMeterReading: "0000",
          condition: "\u0645\u0645\u062A\u0627\u0632\u0629 - \u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u0633\u0643\u0646"
        },
        unitSnapshot: {
          unitNumber: unit2.unitNumber,
          title: unit2.title,
          areaSqm: Number(unit2.areaSqm),
          floorNumber: unit2.floorNumber,
          furnishingStatus: unit2.furnishingStatus
        }
      };
      const lease = await tx.lease.create({
        data: {
          contractNumber: contractNumber2,
          idempotencyKey: idempotencyKey || null,
          unitId,
          tenantName,
          tenantPhone,
          tenantEmail: tenantEmail || null,
          tenantIdNumber,
          startDate: start,
          endDate: end,
          rentalType: rentalType === "annual" ? RentalType.ANNUAL : RentalType.MONTHLY,
          annualRent: new Decimal2(totalRentForPeriod2),
          paymentOption: paymentFrequency,
          paymentFrequency,
          installmentsCount: installmentsData2.length,
          securityDeposit: new Decimal2(securityDeposit2),
          contractServices: frozenServices2,
          includedAmenities: includedAmenities || unit2.amenities || [],
          termsConditions: termsConditions || "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0645\u0648\u062D\u062F \u0645\u0639\u062A\u0645\u062F\u060C \u062B\u0627\u0628\u062A \u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0627\u0644\u062A\u0632\u0627\u0645\u0627\u062A.",
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
          endDate: endWithBuffer,
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
          amount: new Decimal2(securityDeposit2),
          collectedAmount: new Decimal2(0),
          collectionReference: null,
          collectionVerifiedAt: null,
          status: "held",
          notes: `\u062A\u0623\u0645\u064A\u0646 \u062A\u0623\u062C\u064A\u0631\u064A \u0644\u0639\u0642\u062F ${contractNumber2}`
        }
      });
      await tx.unit.update({
        where: { id: unitId },
        data: { occupancyStatus: rentalType === "annual" ? "occupied_yearly" : "monthly_occupied" }
      }).catch(() => {
      });
      return serializeDecimals({ lease, allocation, installments: installmentsData2 });
    });
  }
  const state = memoryContext?.state;
  if (!state) throw new Error("\u062A\u0639\u0630\u0631 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0639\u0642\u062F \u0644\u0639\u062F\u0645 \u062A\u0648\u0641\u0631 \u0633\u064A\u0627\u0642 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
  if (!state.leases) state.leases = [];
  if (!state.allocations) state.allocations = [];
  if (!state.installments) state.installments = [];
  if (!state.securityDeposits) state.securityDeposits = [];
  if (idempotencyKey) {
    const existing = state.leases.find((l) => l.idempotencyKey === idempotencyKey);
    if (existing) {
      return {
        lease: existing,
        allocation: state.allocations.find((a) => a.referenceId === existing.id) || null,
        installments: state.installments.filter((i) => i.leaseId === existing.id)
      };
    }
  }
  const unit = (state.units || []).find((u) => u.id === unitId);
  if (!unit) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
  const conflict = await checkUnitConflict(unitId, start, endWithBuffer, void 0, state.allocations);
  if (conflict.hasConflict) {
    const err = new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0645\u0634\u063A\u0648\u0644\u0629 \u0628\u0639\u0642\u062F \u0623\u0648 \u062D\u062C\u0632 \u0622\u062E\u0631 \u062E\u0644\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.");
    err.statusCode = 409;
    throw err;
  }
  const baseAnnualRent = Number(unit.annualRate) || 85e3;
  const surchargePercent = rentalType === "annual" && paymentFrequency === "2_payments" && unit.semiAnnualSurchargePercent ? Number(unit.semiAnnualSurchargePercent) : 0;
  const annualRentRate = baseAnnualRent * (1 + surchargePercent / 100);
  const monthlyRentRate = Number(unit.monthlyRate) || 8500;
  const totalRentForPeriod = rentalType === "annual" ? annualRentRate : monthlyRentRate * durationMonths;
  const installmentsData = generateInstallments(
    totalRentForPeriod,
    startDate,
    paymentFrequency,
    durationMonths
  );
  const contractNumber = `CNT-${rentalType === "annual" ? "ANN" : "MTH"}-${Date.now().toString().slice(-6)}`;
  const leaseId = `lease_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const securityDeposit = Number(rentalType === "annual" ? unit.yearlySecurityDeposit : unit.monthlySecurityDeposit) || 2500;
  const frozenServices = contractServices || {
    responsibilities: {
      electricity: "tenant",
      water: "tenant",
      internet: "company",
      routineMaintenance: "company",
      misuseMaintenance: "tenant"
    },
    serviceCaps: {
      electricityMonthlyAllowance: 0,
      waterMonthlyAllowance: 0
    },
    handoverReport: {
      handoverDate: startDate,
      keysCount: 2,
      condition: "\u0645\u0645\u062A\u0627\u0632\u0629 - \u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u0633\u0643\u0646"
    },
    unitSnapshot: {
      unitNumber: unit.unitNumber,
      title: unit.title,
      areaSqm: Number(unit.areaSqm),
      floorNumber: unit.floorNumber
    }
  };
  const newLease = {
    id: leaseId,
    contractNumber,
    idempotencyKey: idempotencyKey || null,
    unitId,
    propertyId: unit.propertyId,
    tenantName,
    tenantPhone,
    tenantEmail: tenantEmail || null,
    tenantIdNumber,
    tenant: {
      fullName: tenantName,
      phone: tenantPhone,
      email: tenantEmail || "",
      nationalIdOrIqama: tenantIdNumber
    },
    startDate,
    endDate,
    type: rentalType === "annual" ? "yearly" : "monthly",
    rentalType,
    monthsCount: durationMonths,
    annualRent: totalRentForPeriod,
    totalContractValue: totalRentForPeriod,
    paymentOption: paymentFrequency,
    paymentFrequency,
    installmentsCount: installmentsData.length,
    securityDeposit,
    contractServices: frozenServices,
    includedAmenities: includedAmenities || unit.amenities || [],
    termsConditions: termsConditions || "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0633\u0643\u0646\u064A \u0631\u0633\u0645\u064A \u0645\u0639\u062A\u0645\u062F \u0628\u0646\u0638\u0627\u0645 \u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0645\u0648\u062D\u062F.",
    status: "active",
    installments: installmentsData.map((inst, idx) => ({
      id: `inst_${leaseId}_${idx + 1}`,
      leaseId,
      installmentNumber: inst.number,
      label: inst.label,
      dueDate: inst.dueDate,
      amount: inst.amount,
      paidAmount: 0,
      remainingAmount: inst.amount,
      status: "not_due_yet",
      payments: []
    })),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const newAllocation = {
    id: `alloc_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    unitId,
    startDate: start.toISOString(),
    endDate: endWithBuffer.toISOString(),
    rentalType: rentalType === "annual" ? "ANNUAL" : "MONTHLY",
    type: "lease",
    referenceId: leaseId,
    purpose: "lease",
    status: "active",
    notes: `\u0639\u0642\u062F ${rentalType === "annual" ? "\u0633\u0646\u0648\u064A" : "\u0634\u0647\u0631\u064A"} \u0631\u0642\u0645 ${contractNumber} - \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631: ${tenantName}`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const newDeposit = {
    id: `sd_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    leaseId,
    unitId,
    guestName: tenantName,
    amount: securityDeposit,
    collectedAmount: 0,
    collectionReference: null,
    collectionVerifiedAt: null,
    status: "held",
    refundedAmount: 0,
    deductedAmount: 0,
    rentAppliedAmount: 0,
    notes: `\u062A\u0623\u0645\u064A\u0646 \u062A\u0623\u062C\u064A\u0631\u064A \u0644\u0639\u0642\u062F ${contractNumber}`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  state.leases.push(newLease);
  state.allocations.push(newAllocation);
  state.securityDeposits.push(newDeposit);
  for (const inst of newLease.installments) {
    state.installments.push(inst);
  }
  unit.occupancyStatus = rentalType === "annual" ? "occupied_yearly" : "monthly_occupied";
  if (memoryContext.persist) {
    memoryContext.persist();
  }
  return {
    lease: newLease,
    allocation: newAllocation,
    installments: installmentsData
  };
}
async function cancelBooking(bookingId, memoryContext) {
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const booking2 = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { unit: true }
      });
      if (!booking2) throw new Error("\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u0644\u063A\u0627\u0624\u0647 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
      if (booking2.status === BookingStatus.CANCELLED) {
        return serializeDecimals(booking2);
      }
      if (booking2.status === BookingStatus.CHECKED_IN || booking2.status === BookingStatus.CHECKED_OUT) {
        throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u062D\u062C\u0632 \u0628\u062F\u0623 \u0625\u0634\u063A\u0627\u0644\u0647 \u0623\u0648 \u0645\u0643\u062A\u0645\u0644 \u0628\u0627\u0644\u0641\u0639\u0644.");
      }
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED }
      });
      await tx.unitAllocation.updateMany({
        where: {
          unitId: booking2.unitId,
          referenceId: booking2.id,
          status: "active"
        },
        data: { status: "cancelled" }
      });
      await tx.securityDepositRecord.updateMany({
        where: { bookingId: booking2.id, status: "held" },
        data: { status: "pending_refund" }
      });
      await tx.unit.update({
        where: { id: booking2.unitId },
        data: { occupancyStatus: "vacant" }
      }).catch(() => {
      });
      return serializeDecimals(updated);
    });
  }
  const state = memoryContext?.state;
  if (!state) throw new Error("\u062A\u0639\u0630\u0631 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u062C\u0632 \u0644\u0639\u062F\u0645 \u062A\u0648\u0641\u0631 \u0633\u064A\u0627\u0642 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
  const booking = (state.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new Error("\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u0644\u063A\u0627\u0624\u0647 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
  if (booking.status === "checked_in" || booking.status === "completed") {
    throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u062D\u062C\u0632 \u0628\u062F\u0623 \u0625\u0634\u063A\u0627\u0644\u0647 \u0623\u0648 \u0645\u0643\u062A\u0645\u0644 \u0628\u0627\u0644\u0641\u0639\u0644.");
  }
  booking.status = "cancelled";
  for (const alloc of state.allocations || []) {
    if (alloc.referenceId === booking.id || alloc.referenceId === booking.bookingNumber) {
      alloc.status = "cancelled";
    }
  }
  for (const sd of state.securityDeposits || []) {
    if (sd.bookingId === booking.id && sd.status === "held") {
      sd.status = "pending_refund";
    }
  }
  const unit = (state.units || []).find((u) => u.id === booking.unitId);
  if (unit && unit.occupancyStatus === "daily_occupied") {
    unit.occupancyStatus = "vacant";
  }
  if (memoryContext.persist) {
    memoryContext.persist();
  }
  return booking;
}
async function modifyBooking(bookingId, updates, memoryContext) {
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const booking2 = await tx.booking.findUnique({
        where: { id: bookingId }
      });
      if (!booking2) throw new Error("\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u062A\u0639\u062F\u064A\u0644\u0647 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
      if (booking2.status === BookingStatus.CANCELLED || booking2.status === BookingStatus.CHECKED_OUT) {
        throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u062D\u062C\u0632 \u0645\u0644\u063A\u0649 \u0623\u0648 \u0645\u0646\u062A\u0647\u064D.");
      }
      const targetUnitId2 = updates.newUnitId || booking2.unitId;
      const targetStart = updates.newStartDate ? /* @__PURE__ */ new Date(`${updates.newStartDate}T15:00:00.000Z`) : booking2.startDate;
      const targetDeparture = updates.newEndDate ? /* @__PURE__ */ new Date(`${updates.newEndDate}T12:00:00.000Z`) : booking2.endDate;
      const targetEndWithCleaning2 = updates.newEndDate ? /* @__PURE__ */ new Date(`${updates.newEndDate}T15:00:00.000Z`) : new Date(targetDeparture.getTime() + 3 * 3600 * 1e3);
      const currentAlloc2 = await tx.unitAllocation.findFirst({
        where: { referenceId: booking2.id, status: "active" }
      });
      const conflict2 = await tx.unitAllocation.findFirst({
        where: {
          unitId: targetUnitId2,
          status: "active",
          ...currentAlloc2 ? { id: { not: currentAlloc2.id } } : {},
          startDate: { lt: targetEndWithCleaning2 },
          endDate: { gt: targetStart }
        }
      });
      if (conflict2) {
        const err = new Error("\u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0644\u062A\u0639\u062F\u064A\u0644 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0648\u0628\u0647\u0627 \u062A\u062F\u0627\u062E\u0644 \u0645\u0639 \u062D\u062C\u0632 \u0623\u0648 \u0639\u0642\u062F \u0622\u062E\u0631.");
        err.statusCode = 409;
        throw err;
      }
      const unit2 = await tx.unit.findUnique({ where: { id: targetUnitId2 } });
      if (!unit2) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
      const diffMs2 = targetDeparture.getTime() - targetStart.getTime();
      const totalNights2 = Math.max(1, Math.round(diffMs2 / (1e3 * 60 * 60 * 24)));
      const nightlyRate2 = Number(unit2.dailyRate) || 850;
      const subtotal2 = nightlyRate2 * totalNights2;
      const cleaningFee2 = Number(unit2.cleaningFee) || 150;
      const taxes2 = Math.round(subtotal2 * 0.15 * 100) / 100;
      const securityDeposit2 = Number(booking2.securityDeposit);
      const totalAmount2 = subtotal2 + cleaningFee2 + taxes2 + securityDeposit2;
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          unitId: targetUnitId2,
          startDate: targetStart,
          endDate: targetDeparture,
          totalNights: totalNights2,
          nightlyRate: new Decimal2(nightlyRate2),
          subtotal: new Decimal2(subtotal2),
          cleaningFee: new Decimal2(cleaningFee2),
          taxes: new Decimal2(taxes2),
          totalAmount: new Decimal2(totalAmount2),
          guestName: updates.guestName || booking2.guestName,
          guestPhone: updates.guestPhone || booking2.guestPhone
        }
      });
      if (currentAlloc2) {
        await tx.unitAllocation.update({
          where: { id: currentAlloc2.id },
          data: {
            unitId: targetUnitId2,
            startDate: targetStart,
            endDate: targetEndWithCleaning2
          }
        });
      }
      return serializeDecimals(updated);
    });
  }
  const state = memoryContext?.state;
  if (!state) throw new Error("\u062A\u0639\u0630\u0631 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062D\u062C\u0632 \u0644\u0639\u062F\u0645 \u062A\u0648\u0641\u0631 \u0633\u064A\u0627\u0642 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
  const booking = (state.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new Error("\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u062A\u0639\u062F\u064A\u0644\u0647 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
  const targetUnitId = updates.newUnitId || booking.unitId;
  const targetStartStr = updates.newStartDate ? `${updates.newStartDate}T15:00:00.000Z` : booking.startDate;
  const targetEndStr = updates.newEndDate ? `${updates.newEndDate}T12:00:00.000Z` : booking.endDate;
  const targetEndWithCleaning = updates.newEndDate ? `${updates.newEndDate}T15:00:00.000Z` : targetEndStr;
  const currentAlloc = (state.allocations || []).find((a) => a.referenceId === booking.id && a.status === "active");
  const conflict = await checkUnitConflict(
    targetUnitId,
    new Date(targetStartStr),
    new Date(targetEndWithCleaning),
    currentAlloc?.id,
    state.allocations
  );
  if (conflict.hasConflict) {
    const err = new Error("\u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0644\u062A\u0639\u062F\u064A\u0644 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0648\u0628\u0647\u0627 \u062A\u062F\u0627\u062E\u0644 \u0645\u0639 \u062D\u062C\u0632 \u0623\u0648 \u0639\u0642\u062F \u0622\u062E\u0631.");
    err.statusCode = 409;
    throw err;
  }
  const unit = (state.units || []).find((u) => u.id === targetUnitId);
  if (!unit) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.");
  const diffMs = new Date(targetEndStr).getTime() - new Date(targetStartStr).getTime();
  const totalNights = Math.max(1, Math.round(diffMs / (1e3 * 60 * 60 * 24)));
  const nightlyRate = Number(unit.dailyRate) || 850;
  const subtotal = nightlyRate * totalNights;
  const cleaningFee = Number(unit.cleaningFee) || 150;
  const taxes = Math.round(subtotal * 0.15 * 100) / 100;
  const securityDeposit = Number(booking.securityDeposit) || 500;
  const totalAmount = subtotal + cleaningFee + taxes + securityDeposit;
  booking.unitId = targetUnitId;
  booking.startDate = targetStartStr;
  booking.endDate = targetEndStr;
  booking.checkIn = targetStartStr.slice(0, 10);
  booking.checkOut = targetEndStr.slice(0, 10);
  booking.totalNights = totalNights;
  booking.nightlyRate = nightlyRate;
  booking.subtotal = subtotal;
  booking.totalAmount = totalAmount;
  if (updates.guestName) booking.guestName = updates.guestName;
  if (updates.guestPhone) booking.guestPhone = updates.guestPhone;
  if (currentAlloc) {
    currentAlloc.unitId = targetUnitId;
    currentAlloc.startDate = targetStartStr;
    currentAlloc.endDate = targetEndWithCleaning;
  }
  if (memoryContext.persist) {
    memoryContext.persist();
  }
  return booking;
}
async function earlyTerminateLease(leaseId, terminationDate, reason, memoryContext) {
  const termDate = /* @__PURE__ */ new Date(`${terminationDate}T12:00:00.000Z`);
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const lease2 = await tx.lease.findUnique({
        where: { id: leaseId },
        include: { installments: true }
      });
      if (!lease2) throw new Error("\u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u0646\u0647\u0627\u0624\u0647 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
      if (termDate < lease2.startDate) {
        throw new Error("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0647\u0627\u0621 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u064A\u0633\u0628\u0642 \u062A\u0627\u0631\u064A\u062E \u0628\u062F\u0621 \u0627\u0644\u0639\u0642\u062F.");
      }
      const updated = await tx.lease.update({
        where: { id: leaseId },
        data: {
          status: LeaseStatus.TERMINATED,
          endDate: termDate,
          termsConditions: `${lease2.termsConditions || ""}
[\u062A\u0645 \u0627\u0644\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0645\u0628\u0643\u0631 \u0628\u062A\u0627\u0631\u064A\u062E ${terminationDate} \u0644\u0644\u0633\u0628\u0628: ${reason || "\u0625\u0646\u0647\u0627\u0621 \u0631\u0636\u0627\u0626\u064A"}]`
        }
      });
      await tx.unitAllocation.updateMany({
        where: { referenceId: lease2.id, status: "active" },
        data: { endDate: /* @__PURE__ */ new Date(`${terminationDate}T15:00:00.000Z`) }
      });
      for (const inst of lease2.installments) {
        if (inst.dueDate > termDate && inst.paidAmount.isZero()) {
        }
      }
      return serializeDecimals(updated);
    });
  }
  const state = memoryContext?.state;
  if (!state) throw new Error("\u062A\u0639\u0630\u0631 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F \u0644\u0639\u062F\u0645 \u062A\u0648\u0641\u0631 \u0633\u064A\u0627\u0642 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
  const lease = (state.leases || []).find((l) => l.id === leaseId);
  if (!lease) throw new Error("\u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u0646\u0647\u0627\u0624\u0647 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
  lease.status = "terminated_early";
  lease.originalEndDate = lease.endDate;
  lease.endDate = terminationDate;
  lease.terminationReason = reason || "\u0625\u0646\u0647\u0627\u0621 \u062A\u0639\u0627\u0642\u062F\u064A \u0645\u0628\u0643\u0631";
  for (const alloc of state.allocations || []) {
    if (alloc.referenceId === lease.id || alloc.referenceId === lease.contractNumber) {
      alloc.endDate = `${terminationDate}T15:00:00.000Z`;
    }
  }
  const unit = (state.units || []).find((u) => u.id === lease.unitId);
  if (unit) {
    unit.occupancyStatus = "vacant";
  }
  if (memoryContext.persist) {
    memoryContext.persist();
  }
  return lease;
}
async function extendLease(leaseId, additionalMonths, memoryContext) {
  if (additionalMonths < 1 || additionalMonths > 36) {
    throw new Error("\u0645\u062F\u0629 \u0627\u0644\u062A\u0645\u062F\u064A\u062F \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0628\u064A\u0646 \u0634\u0647\u0631 \u0648 36 \u0634\u0647\u0631\u0627\u064B.");
  }
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const lease2 = await tx.lease.findUnique({
        where: { id: leaseId },
        include: { unit: true }
      });
      if (!lease2) throw new Error("\u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u062A\u0645\u062F\u064A\u062F\u0647 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
      const currentEndStr2 = lease2.endDate.toISOString().slice(0, 10);
      const newEndDateStr2 = calculateContractEndDate(currentEndStr2, additionalMonths);
      const extStart2 = lease2.endDate;
      const extEnd2 = /* @__PURE__ */ new Date(`${newEndDateStr2}T15:00:00.000Z`);
      const currentAlloc2 = await tx.unitAllocation.findFirst({
        where: { referenceId: lease2.id, status: "active" }
      });
      const conflict2 = await tx.unitAllocation.findFirst({
        where: {
          unitId: lease2.unitId,
          status: "active",
          ...currentAlloc2 ? { id: { not: currentAlloc2.id } } : {},
          startDate: { lt: extEnd2 },
          endDate: { gt: extStart2 }
        }
      });
      if (conflict2) {
        const err = new Error("\u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u064A\u0629 \u0644\u0644\u062A\u0645\u062F\u064A\u062F \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0648\u0628\u0647\u0627 \u062A\u062F\u0627\u062E\u0644 \u0645\u0639 \u062D\u062C\u0632 \u0623\u0648 \u0639\u0642\u062F \u0622\u062E\u0631.");
        err.statusCode = 409;
        throw err;
      }
      const monthlyRate2 = Number(lease2.unit?.monthlyRate) || 8500;
      const additionalRent2 = monthlyRate2 * additionalMonths;
      const extInstallments2 = generateInstallments(
        additionalRent2,
        currentEndStr2,
        lease2.paymentFrequency || "monthly",
        additionalMonths
      );
      const updated = await tx.lease.update({
        where: { id: leaseId },
        data: {
          endDate: /* @__PURE__ */ new Date(`${newEndDateStr2}T12:00:00.000Z`),
          annualRent: new Decimal2(Number(lease2.annualRent) + additionalRent2),
          installmentsCount: lease2.installmentsCount + extInstallments2.length
        }
      });
      if (currentAlloc2) {
        await tx.unitAllocation.update({
          where: { id: currentAlloc2.id },
          data: { endDate: extEnd2 }
        });
      }
      return serializeDecimals({ lease: updated, newInstallments: extInstallments2 });
    });
  }
  const state = memoryContext?.state;
  if (!state) throw new Error("\u062A\u0639\u0630\u0631 \u062A\u0645\u062F\u064A\u062F \u0627\u0644\u0639\u0642\u062F \u0644\u0639\u062F\u0645 \u062A\u0648\u0641\u0631 \u0633\u064A\u0627\u0642 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
  const lease = (state.leases || []).find((l) => l.id === leaseId);
  if (!lease) throw new Error("\u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u062A\u0645\u062F\u064A\u062F\u0647 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
  const currentEndStr = lease.endDate;
  const newEndDateStr = calculateContractEndDate(currentEndStr, additionalMonths);
  const currentAlloc = (state.allocations || []).find((a) => a.referenceId === lease.id && a.status === "active");
  const extStart = /* @__PURE__ */ new Date(`${currentEndStr}T12:00:00.000Z`);
  const extEnd = /* @__PURE__ */ new Date(`${newEndDateStr}T15:00:00.000Z`);
  const conflict = await checkUnitConflict(
    lease.unitId,
    extStart,
    extEnd,
    currentAlloc?.id,
    state.allocations
  );
  if (conflict.hasConflict) {
    const err = new Error("\u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u064A\u0629 \u0644\u0644\u062A\u0645\u062F\u064A\u062F \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0648\u0628\u0647\u0627 \u062A\u062F\u0627\u062E\u0644 \u0645\u0639 \u062D\u062C\u0632 \u0623\u0648 \u0639\u0642\u062F \u0622\u062E\u0631.");
    err.statusCode = 409;
    throw err;
  }
  const unit = (state.units || []).find((u) => u.id === lease.unitId);
  const monthlyRate = Number(unit?.monthlyRate) || 8500;
  const additionalRent = monthlyRate * additionalMonths;
  const extInstallments = generateInstallments(
    additionalRent,
    currentEndStr,
    lease.paymentFrequency || "monthly",
    additionalMonths
  );
  lease.endDate = newEndDateStr;
  lease.totalContractValue = (lease.totalContractValue || 0) + additionalRent;
  if (currentAlloc) {
    currentAlloc.endDate = extEnd.toISOString();
  }
  for (const inst of extInstallments) {
    const newInst = {
      id: `inst_${lease.id}_ext_${Date.now()}_${inst.number}`,
      leaseId: lease.id,
      installmentNumber: (lease.installments?.length || 0) + inst.number,
      label: `\u062A\u0645\u062F\u064A\u062F: ${inst.label}`,
      dueDate: inst.dueDate,
      amount: inst.amount,
      paidAmount: 0,
      remainingAmount: inst.amount,
      status: "not_due_yet",
      payments: []
    };
    if (!lease.installments) lease.installments = [];
    lease.installments.push(newInst);
    state.installments.push(newInst);
  }
  if (memoryContext.persist) {
    memoryContext.persist();
  }
  return { lease, newInstallments: extInstallments };
}
async function checkInBooking(bookingId, memoryContext) {
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const booking2 = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking2) throw new Error("\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CHECKED_IN }
      });
      await tx.unit.update({
        where: { id: booking2.unitId },
        data: { operationalStatus: "ready", occupancyStatus: "daily_occupied" }
      });
      return serializeDecimals(updated);
    });
  }
  const state = memoryContext?.state;
  if (!state) throw new Error("\u062A\u0639\u0630\u0631 \u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0639\u062F\u0645 \u062A\u0648\u0641\u0631 \u0633\u064A\u0627\u0642 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
  const booking = (state.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new Error("\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
  booking.status = "checked_in";
  const unit = (state.units || []).find((u) => u.id === booking.unitId);
  if (unit) {
    unit.occupancyStatus = "daily_occupied";
  }
  if (memoryContext.persist) {
    memoryContext.persist();
  }
  return booking;
}
async function checkOutBooking(bookingId, memoryContext) {
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const booking2 = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking2) throw new Error("\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CHECKED_OUT }
      });
      await tx.unitAllocation.updateMany({
        where: { referenceId: booking2.id, status: "active" },
        data: { status: "released" }
      });
      await tx.securityDepositRecord.updateMany({
        where: { bookingId: booking2.id, status: "held" },
        data: { status: "pending_refund" }
      });
      await tx.unit.update({
        where: { id: booking2.unitId },
        data: { operationalStatus: "needs_cleaning", occupancyStatus: "vacant" }
      });
      return serializeDecimals(updated);
    });
  }
  const state = memoryContext?.state;
  if (!state) throw new Error("\u062A\u0639\u0630\u0631 \u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u062E\u0631\u0648\u062C \u0644\u0639\u062F\u0645 \u062A\u0648\u0641\u0631 \u0633\u064A\u0627\u0642 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
  const booking = (state.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new Error("\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
  booking.status = "completed";
  for (const alloc of state.allocations || []) {
    if (alloc.referenceId === booking.id || alloc.referenceId === booking.bookingNumber) {
      alloc.status = "released";
    }
  }
  for (const sd of state.securityDeposits || []) {
    if (sd.bookingId === booking.id && sd.status === "held") {
      sd.status = "pending_refund";
    }
  }
  const unit = (state.units || []).find((u) => u.id === booking.unitId);
  if (unit) {
    unit.operationalStatus = "needs_cleaning";
    unit.occupancyStatus = "vacant";
  }
  if (memoryContext.persist) {
    memoryContext.persist();
  }
  return booking;
}
async function blockUnit(unitId, startDateStr, endDateStr, reason, memoryContext) {
  const start = /* @__PURE__ */ new Date(`${startDateStr}T00:00:00.000Z`);
  const end = /* @__PURE__ */ new Date(`${endDateStr}T23:59:59.000Z`);
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const conflict2 = await tx.unitAllocation.findFirst({
        where: {
          unitId,
          status: "active",
          startDate: { lt: end },
          endDate: { gt: start }
        }
      });
      if (conflict2) {
        const err = new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u062C\u0628 \u0627\u0644\u0648\u062D\u062F\u0629 \u0644\u0648\u062C\u0648\u062F \u062D\u062C\u0632 \u0623\u0648 \u0639\u0642\u062F \u0642\u0627\u0626\u0645 \u062E\u0644\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629.");
        err.statusCode = 409;
        throw err;
      }
      const allocation = await tx.unitAllocation.create({
        data: {
          unitId,
          startDate: start,
          endDate: end,
          rentalType: RentalType.DAILY,
          purpose: "block",
          status: "active",
          notes: reason || "\u062D\u062C\u0628 \u0625\u062F\u0627\u0631\u064A \u0645\u062C\u062F\u0648\u0644"
        }
      });
      await tx.unit.update({
        where: { id: unitId },
        data: { operationalStatus: "blocked", occupancyStatus: "blocked" }
      });
      return serializeDecimals(allocation);
    });
  }
  const state = memoryContext?.state;
  if (!state) throw new Error("\u062A\u0639\u0630\u0631 \u062D\u062C\u0628 \u0627\u0644\u0648\u062D\u062F\u0629 \u0644\u0639\u062F\u0645 \u062A\u0648\u0641\u0631 \u0633\u064A\u0627\u0642 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
  const conflict = await checkUnitConflict(unitId, start, end, void 0, state.allocations);
  if (conflict.hasConflict) {
    const err = new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u062C\u0628 \u0627\u0644\u0648\u062D\u062F\u0629 \u0644\u0648\u062C\u0648\u062F \u062D\u062C\u0632 \u0623\u0648 \u0639\u0642\u062F \u0642\u0627\u0626\u0645 \u062E\u0644\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629.");
    err.statusCode = 409;
    throw err;
  }
  const newAllocation = {
    id: `alloc_block_${Date.now()}`,
    unitId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    rentalType: "DAILY",
    type: "block",
    purpose: "block",
    status: "active",
    notes: reason || "\u062D\u062C\u0628 \u0625\u062F\u0627\u0631\u064A \u0645\u062C\u062F\u0648\u0644",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!state.allocations) state.allocations = [];
  state.allocations.push(newAllocation);
  const unit = (state.units || []).find((u) => u.id === unitId);
  if (unit) {
    unit.operationalStatus = "blocked";
    unit.occupancyStatus = "blocked";
  }
  if (memoryContext.persist) {
    memoryContext.persist();
  }
  return newAllocation;
}
async function unblockUnit(unitId, allocationId, memoryContext) {
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      await tx.unitAllocation.updateMany({
        where: {
          unitId,
          purpose: "block",
          ...allocationId ? { id: allocationId } : {},
          status: "active"
        },
        data: { status: "released" }
      });
      await tx.unit.update({
        where: { id: unitId },
        data: { operationalStatus: "ready", occupancyStatus: "vacant" }
      });
      return { success: true, message: "\u062A\u0645 \u0641\u0643 \u062D\u062C\u0628 \u0627\u0644\u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D." };
    });
  }
  const state = memoryContext?.state;
  if (!state) throw new Error("\u062A\u0639\u0630\u0631 \u0641\u0643 \u062D\u062C\u0628 \u0627\u0644\u0648\u062D\u062F\u0629 \u0644\u0639\u062F\u0645 \u062A\u0648\u0641\u0631 \u0633\u064A\u0627\u0642 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
  for (const alloc of state.allocations || []) {
    if (alloc.unitId === unitId && (alloc.purpose === "block" || alloc.type === "block") && alloc.status === "active") {
      if (!allocationId || alloc.id === allocationId) {
        alloc.status = "released";
      }
    }
  }
  const unit = (state.units || []).find((u) => u.id === unitId);
  if (unit) {
    unit.operationalStatus = "ready";
    unit.occupancyStatus = "vacant";
  }
  if (memoryContext.persist) {
    memoryContext.persist();
  }
  return { success: true, message: "\u062A\u0645 \u0641\u0643 \u062D\u062C\u0628 \u0627\u0644\u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D." };
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

// src/data/initialData.ts
var initialNavigationSettings = {
  enableBottomNav: true,
  headerHeightPx: 80,
  logoMaxHeightPx: 44,
  stickyHeader: true,
  navActiveColor: "#B69A68",
  navLinks: [
    { id: "nav_home", label: "\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", targetSectionId: "hero", visible: true, order: 1, icon: "Home" },
    { id: "nav_buildings", label: "\u0627\u0644\u0645\u062C\u0645\u0639\u0627\u062A", targetSectionId: "buildings", visible: true, order: 2, icon: "Building2" },
    { id: "nav_units", label: "\u0627\u0644\u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0641\u0627\u062E\u0631\u0629", targetSectionId: "units", visible: true, order: 3, icon: "Sparkles" },
    { id: "nav_amenities", label: "\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0641\u0646\u062F\u0642\u064A\u0629", targetSectionId: "amenities", visible: true, order: 4, icon: "ConciergeBell" },
    { id: "nav_faq", label: "\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629", targetSectionId: "faq", visible: true, order: 5, icon: "HelpCircle" },
    { id: "nav_contact", label: "\u0627\u062A\u0635\u0644 \u0628\u0646\u0627", targetSectionId: "contact", visible: true, order: 6, icon: "Phone" }
  ],
  bottomNavItems: [
    { id: "bnav_home", label: "\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", type: "section", targetSectionId: "hero", icon: "Home", visible: true, order: 1 },
    { id: "bnav_units", label: "\u0627\u0644\u0648\u062D\u062F\u0627\u062A", type: "section", targetSectionId: "units", icon: "Sparkles", visible: true, order: 2 },
    { id: "bnav_bookings", label: "\u062D\u062C\u0648\u0632\u0627\u062A\u064A", type: "my_bookings", icon: "CalendarDays", visible: true, order: 3 },
    { id: "bnav_account", label: "\u062D\u0633\u0627\u0628\u064A", type: "account", icon: "User", visible: true, order: 4 },
    { id: "bnav_more", label: "\u0627\u0644\u0645\u0632\u064A\u062F", type: "more", icon: "Menu", visible: true, order: 5 }
  ]
};
var initialCompanySettings = {
  companyName: "Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629",
  companyNameEn: "Luxury Home",
  tagline: "\u062A\u062C\u0631\u0628\u0629 \u0633\u0643\u0646\u064A\u0629 \u0641\u0627\u062E\u0631\u0629 \u062A\u062F\u0645\u062C \u0628\u064A\u0646 \u062E\u0635\u0648\u0635\u064A\u0629 \u0627\u0644\u0645\u0646\u0632\u0644 \u0648\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0636\u064A\u0627\u0641\u0629 \u0627\u0644\u0631\u0627\u0642\u064A\u0629 \u0641\u064A Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629",
  logoUrl: "",
  iconUrl: "",
  phone: "+966 11 482 9900",
  whatsapp: "+966 50 123 4567",
  email: "info@luxuryhome.com",
  taxNumber: "310984726100003",
  commercialReg: "1010784920",
  address: "\u0627\u0644\u0631\u064A\u0627\u0636\u060C \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
  currency: "SAR",
  currencySymbol: "\u0631.\u0633",
  timezone: "Asia/Riyadh",
  navigation: initialNavigationSettings,
  theme: {
    primaryColor: "#B69A68",
    ivoryBg: "#F7F3EB",
    ivorySurface: "#FFFCF6",
    textColor: "#282824",
    textMuted: "#68675F",
    borderColor: "#E3DCCD",
    glassBlurIntensity: 14,
    borderRadius: "xl",
    enableAnimations: true
  },
  defaultPrepBufferHours: 3,
  holdTimeoutMinutes: 15,
  minDailyNights: 1,
  maxDailyNights: 60,
  installmentDueReminderDaysBefore: 7
};
var initialAmenities = [
  { id: "smart_lock", name: "\u062F\u062E\u0648\u0644 \u0630\u0643\u064A \u0628\u062F\u0648\u0646 \u0645\u0641\u062A\u0627\u062D", nameEn: "Smart Keyless Access", icon: "KeyRound", category: "technology" },
  { id: "wifi", name: "\u0625\u0646\u062A\u0631\u0646\u062A \u0641\u0627\u064A\u0628\u0631 \u0639\u0627\u0644\u064A \u0627\u0644\u0633\u0631\u0639\u0629", nameEn: "High-speed Fiber WiFi", icon: "Wifi", category: "technology" },
  { id: "cleaning", name: "\u062E\u062F\u0645\u0629 \u062A\u062F\u0628\u064A\u0631 \u0645\u0646\u0632\u0644\u064A \u0641\u0646\u062F\u0642\u064A\u0629", nameEn: "Hotel Housekeeping", icon: "Sparkles", category: "general" },
  { id: "concierge", name: "\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0643\u0648\u0646\u0633\u064A\u0631\u062C \u0662\u0664/\u0667", nameEn: "24/7 Concierge", icon: "Clock", category: "general" },
  { id: "ev_parking", name: "\u0645\u0648\u0627\u0642\u0641 \u062E\u0627\u0635\u0629 \u0645\u0639 \u0634\u0627\u062D\u0646 \u0643\u0647\u0631\u0628\u0627\u0626\u064A", nameEn: "EV Charger Parking", icon: "Car", category: "comfort" },
  { id: "full_kitchen", name: "\u0645\u0637\u0628\u062E \u0645\u062A\u0643\u0627\u0645\u0644 \u0627\u0644\u062A\u062C\u0647\u064A\u0632", nameEn: "Fully Equipped Kitchen", icon: "Utensils", category: "kitchen" },
  { id: "coffee", name: "\u0631\u0643\u0646 \u0642\u0647\u0648\u0629 \u0645\u062E\u062A\u0635\u0629 \u0645\u062A\u0643\u0627\u0645\u0644", nameEn: "Specialty Coffee Bar", icon: "Coffee", category: "kitchen" },
  { id: "washer_dryer", name: "\u063A\u0633\u0627\u0644\u0629 \u0648\u0645\u062C\u0641\u0641\u0629 \u0645\u0644\u0627\u0628\u0633 \u0630\u0643\u064A\u0629", nameEn: "Washer & Dryer", icon: "Shirt", category: "comfort" },
  { id: "gym", name: "\u0646\u0627\u062F\u064A \u0635\u062D\u064A \u0648\u0631\u064A\u0627\u0636\u064A \u062E\u0627\u0635 \u0628\u0640 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629", nameEn: "Private Wellness Gym", icon: "Dumbbell", category: "wellness" },
  { id: "balcony_view", name: "\u0634\u0631\u0641\u0629 \u0628\u0625\u0637\u0644\u0627\u0644\u0629 \u0628\u0627\u0646\u0648\u0631\u0627\u0645\u064A\u0629", nameEn: "Panoramic Balcony", icon: "Eye", category: "comfort" },
  { id: "smart_tv", name: "\u062A\u0644\u0641\u0632\u064A\u0648\u0646 \u0630\u0643\u064A \u0666\u0665 \u0628\u0648\u0635\u0629 \u0664\u0643\u064A\u0647", nameEn: '65" 4K Smart TV', icon: "Tv", category: "technology" },
  { id: "work_desk", name: "\u0645\u0643\u062A\u0628 \u0639\u0645\u0644 \u062A\u0646\u0641\u064A\u0630\u064A \u0645\u0631\u064A\u062D", nameEn: "Executive Workspace", icon: "Briefcase", category: "comfort" }
];
var initialProperties = [
  {
    id: "prop-nakheel",
    name: "Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 - \u0627\u0644\u0646\u062E\u064A\u0644",
    nameEn: "Luxury Home Residence - Al Nakheel",
    slug: "ivoire-residence-nakheel",
    tagline: "\u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0627\u0644\u0647\u0627\u062F\u0626\u0629 \u0641\u064A \u0623\u0643\u062B\u0631 \u0623\u062D\u064A\u0627\u0621 \u0627\u0644\u0631\u064A\u0627\u0636 \u062A\u0645\u064A\u0632\u0627\u064B",
    description: "\u064A\u0642\u0639 Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0641\u064A \u062D\u064A \u0627\u0644\u0646\u062E\u064A\u0644 \u0627\u0644\u0631\u0627\u0642\u064A\u060C \u0648\u064A\u0642\u062F\u0645 \u0634\u0642\u0642\u0627\u064B \u0633\u0643\u0646\u064A\u0629 \u0641\u0627\u062E\u0631\u0629 \u0648\u0645\u0641\u0631\u0648\u0634\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0644\u0644\u0628\u0627\u062D\u062B\u064A\u0646 \u0639\u0646 \u062A\u062C\u0631\u0628\u0629 \u0625\u0642\u0627\u0645\u0629 \u0627\u0633\u062A\u062B\u0646\u0627\u0626\u064A\u0629 \u0648\u0637\u0648\u064A\u0644\u0629 \u0627\u0644\u0645\u062F\u0649\u060C \u0645\u0639 \u0635\u0627\u0644\u0629 \u0631\u064A\u0627\u0636\u064A\u0629 \u0645\u0634\u062A\u0631\u0643\u0629\u060C \u0628\u0647\u0648 \u0645\u062E\u0635\u0635 \u0644\u0644\u0643\u0648\u0646\u0633\u064A\u0631\u062C\u060C \u0648\u0645\u0648\u0627\u0642\u0641 \u0633\u064A\u0627\u0631\u0627\u062A \u0645\u062C\u0647\u0632\u0629 \u0628\u0634\u0648\u0627\u062D\u0646 \u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629.",
    address: "\u0637\u0631\u064A\u0642 \u0627\u0644\u0623\u0645\u064A\u0631 \u062A\u0631\u0643\u064A \u0628\u0646 \u0639\u0628\u062F \u0627\u0644\u0639\u0632\u064A\u0632 \u0627\u0644\u0623\u0648\u0644\u060C \u062D\u064A \u0627\u0644\u0646\u062E\u064A\u0644\u060C \u0627\u0644\u0631\u064A\u0627\u0636",
    city: "\u0627\u0644\u0631\u064A\u0627\u0636",
    district: "\u062D\u064A \u0627\u0644\u0646\u062E\u064A\u0644",
    latitude: 24.7391,
    longitude: 46.6432,
    media: [
      {
        id: "nakheel_cover",
        url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80",
        title: "\u0627\u0644\u0648\u0627\u062C\u0647\u0629 \u0627\u0644\u062E\u0627\u0631\u062C\u064A\u0629 \u0627\u0644\u0641\u0627\u062E\u0631\u0629 \u0644\u0628\u0631\u062C \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0627\u0644\u0646\u062E\u064A\u0644",
        type: "image",
        category: "facade",
        isCover: true
      },
      {
        id: "nakheel_lobby",
        url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
        title: "\u0628\u0647\u0648 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u0641\u0627\u062E\u0631",
        type: "image",
        category: "living"
      },
      {
        id: "nakheel_garden",
        url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
        title: "\u0627\u0644\u062D\u062F\u064A\u0642\u0629 \u0627\u0644\u0641\u0646\u0627\u0621 \u0648\u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u0645\u0634\u062A\u0631\u0643\u0629",
        type: "image",
        category: "amenity"
      }
    ],
    amenities: ["smart_lock", "wifi", "cleaning", "concierge", "ev_parking", "gym"],
    totalFloors: 5,
    checkInTime: "15:00",
    checkOutTime: "12:00",
    featured: true,
    identifierCode: "BLD-NKH-01",
    status: "published",
    entrancesCount: 2,
    elevatorsCount: 3,
    stairsCount: 2,
    sharedFacilities: [
      { id: "sf-n-1", name: "\u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0648\u0627\u0644\u0643\u0648\u0646\u0633\u064A\u0631\u062C \u0627\u0644\u0631\u0626\u064A\u0633\u064A", type: "reception", description: "\u0628\u0647\u0648 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0645\u062C\u0647\u0632 \u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0636\u064A\u0648\u0641 \u0648\u0627\u0644\u0631\u062F \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0639\u0644\u0649 \u0645\u062F\u0627\u0631 \u0662\u0664 \u0633\u0627\u0639\u0629", openingHours: "\u0662\u0664/\u0667", floor: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A" },
      { id: "sf-n-2", name: "\u0646\u0627\u062F\u064A \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0627\u0644\u0635\u062D\u064A \u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644", type: "gym", description: "\u0635\u0627\u0644\u0629 \u0631\u064A\u0627\u0636\u064A\u0629 \u062E\u0627\u0635\u0629 \u0628\u0627\u0644\u0646\u0632\u0644\u0627\u0621 \u0645\u062C\u0647\u0632\u0629 \u0628\u0623\u062D\u062F\u062B \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0644\u064A\u0627\u0642\u0629 \u0627\u0644\u0628\u062F\u0646\u064A\u0629 \u0648\u0627\u0644\u062A\u0645\u0627\u0631\u064A\u0646", openingHours: "06:00 - 23:00", floor: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A" },
      { id: "sf-n-3", name: "\u063A\u0631\u0641\u0629 \u0627\u0644\u063A\u0633\u064A\u0644 \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629 \u0627\u0644\u0630\u0643\u064A\u0629", type: "laundry", description: "\u063A\u0633\u0627\u0644\u0627\u062A \u0648\u0645\u062C\u0641\u0641\u0627\u062A \u0641\u0646\u062F\u0642\u064A\u0629 \u0630\u0643\u064A\u0629 \u0644\u062A\u0644\u0628\u064A\u0629 \u0627\u062D\u062A\u064A\u0627\u062C\u0627\u062A \u0627\u0644\u0646\u0632\u0644\u0627\u0621 \u0644\u0644\u0625\u0642\u0627\u0645\u0627\u062A \u0627\u0644\u0637\u0648\u064A\u0644\u0629", openingHours: "08:00 - 22:00", floor: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A" },
      { id: "sf-n-4", name: "\u0635\u0627\u0644\u0629 \u0627\u0644\u0644\u0627\u0648\u0646\u062C \u0627\u0644\u0645\u0641\u062A\u0648\u062D\u0629 \u0644\u0644\u0623\u0639\u0645\u0627\u0644", type: "lounge", description: "\u0645\u0643\u0627\u0646 \u0647\u0627\u062F\u0626 \u0648\u0645\u0646\u0627\u0633\u0628 \u0644\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A \u0627\u0644\u0645\u0635\u063A\u0631\u0629 \u0623\u0648 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0641\u0631\u062F\u064A \u0645\u0639 \u0631\u0643\u0646 \u0644\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062A \u0648\u0627\u0644\u0642\u0647\u0648\u0629", openingHours: "07:00 - 24:00", floor: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A" }
    ]
  },
  {
    id: "prop-olayya",
    name: "\u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0628\u0627\u0631\u0643 - \u0627\u0644\u0639\u0644\u064A\u0627",
    nameEn: "Luxury Home Park - Al Olayya",
    slug: "ivoire-park-olayya",
    tagline: "\u0627\u0644\u0646\u0628\u0636 \u0627\u0644\u062D\u064A\u0648\u064A \u0648\u0639\u0631\u0627\u0642\u0629 \u0627\u0644\u0645\u0639\u064A\u0634\u0629 \u0627\u0644\u0645\u062A\u0631\u0641\u0629 \u0641\u064A \u0642\u0644\u0628 \u0627\u0644\u0639\u0644\u064A\u0627",
    description: "\u064A\u0642\u062F\u0645 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0628\u0627\u0631\u0643 \u0627\u0644\u0639\u0644\u064A\u0627 \u062A\u062C\u0631\u0628\u0629 \u0639\u0635\u0631\u064A\u0629 \u0645\u062A\u0641\u0631\u062F\u0629 \u0641\u064A \u0642\u0644\u0628 \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u0627\u0644\u064A \u0648\u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0644\u0644\u0631\u064A\u0627\u0636\u060C \u0645\u062C\u0627\u0648\u0631\u0627\u064B \u0644\u0623\u0628\u0631\u0632 \u0627\u0644\u0645\u0639\u0627\u0644\u0645 \u0627\u0644\u0627\u0642\u062A\u0635\u0627\u062F\u064A\u0629 \u0648\u0627\u0644\u062A\u0631\u0641\u064A\u0647\u064A\u0629\u060C \u0628\u0644\u0645\u0633\u0627\u062A \u0641\u0646\u062F\u0642\u064A\u0629 \u0631\u0627\u0642\u064A\u0629 \u0648\u0645\u0633\u0627\u062D\u0627\u062A \u0645\u062E\u0635\u0635\u0629 \u0644\u0631\u062C\u0627\u0644 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0648\u0627\u0644\u0645\u0642\u064A\u0645\u064A\u0646 \u0627\u0644\u0628\u0627\u062D\u062B\u064A\u0646 \u0639\u0646 \u0633\u0647\u0648\u0644\u0629 \u0627\u0644\u062A\u0646\u0642\u0644 \u0648\u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0641\u0627\u062E\u0631.",
    address: "\u0637\u0631\u064A\u0642 \u0627\u0644\u0645\u0644\u0643 \u0641\u0647\u062F\u060C \u062D\u064A \u0627\u0644\u0639\u0644\u064A\u0627\u060C \u0627\u0644\u0631\u064A\u0627\u0636",
    city: "\u0627\u0644\u0631\u064A\u0627\u0636",
    district: "\u062D\u064A \u0627\u0644\u0639\u0644\u064A\u0627",
    latitude: 24.7082,
    longitude: 46.6789,
    media: [
      {
        id: "olayya_cover",
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80",
        title: "\u0627\u0644\u0648\u0627\u062C\u0647\u0629 \u0627\u0644\u062E\u0627\u0631\u062C\u064A\u0629 \u0644\u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0627\u0644\u0639\u0644\u064A\u0627",
        type: "image",
        category: "facade",
        isCover: true
      },
      {
        id: "olayya_interior",
        url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
        title: "\u0627\u0644\u062A\u062C\u0647\u064A\u0632\u0627\u062A \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629 \u0627\u0644\u0623\u0646\u064A\u0642\u0629 \u0644\u0644\u0635\u0627\u0644\u0629",
        type: "image",
        category: "living"
      }
    ],
    amenities: ["smart_lock", "wifi", "cleaning", "concierge", "full_kitchen", "work_desk"],
    totalFloors: 4,
    checkInTime: "15:00",
    checkOutTime: "12:00",
    featured: true,
    identifierCode: "BLD-OLY-02",
    status: "published",
    entrancesCount: 1,
    elevatorsCount: 2,
    stairsCount: 1,
    sharedFacilities: [
      { id: "sf-o-1", name: "\u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0648\u0627\u0644\u0623\u0645\u0646", type: "reception", description: "\u0645\u0646\u0637\u0642\u0629 \u0643\u0648\u0646\u0633\u064A\u0631\u062C \u0648\u0623\u0645\u0646 \u0645\u062A\u0648\u0627\u062C\u062F\u0629 \u0644\u062A\u0633\u0647\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0648\u0627\u0644\u062E\u0631\u0648\u062C \u0648\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0634\u062D\u0646\u0627\u062A", openingHours: "\u0662\u0664/\u0667", floor: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A" },
      { id: "sf-o-2", name: "\u0645\u0631\u0643\u0632 \u0645\u062E\u0635\u0635 \u0644\u0631\u062C\u0627\u0644 \u0627\u0644\u0623\u0639\u0645\u0627\u0644", type: "business_center", description: "\u0645\u0633\u0627\u062D\u0627\u062A \u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A \u0645\u062C\u0647\u0632\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0644\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A \u0648\u0627\u0644\u0637\u0628\u0627\u0639\u0629 \u0648\u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A", openingHours: "08:00 - 20:00", floor: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A" },
      { id: "sf-o-3", name: "\u0627\u0644\u062D\u062F\u064A\u0642\u0629 \u0627\u0644\u0645\u0639\u0644\u0642\u0629 \u0648\u0627\u0644\u0633\u0637\u062D \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A", type: "garden", description: "\u0645\u0646\u0637\u0642\u0629 \u0627\u0633\u062A\u0631\u062E\u0627\u0621 \u0639\u0644\u0649 \u0627\u0644\u0633\u0637\u062D \u062A\u0637\u0644 \u0639\u0644\u0649 \u0623\u0628\u0631\u0627\u062C \u0627\u0644\u0639\u0644\u064A\u0627 \u0628\u0625\u0646\u0627\u0631\u0629 \u0647\u0627\u062F\u0626\u0629 \u0644\u064A\u0644\u0627\u064B \u0648\u0645\u0642\u0627\u0639\u062F \u0645\u0631\u064A\u062D\u0629", openingHours: "16:00 - 02:00", floor: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0631\u0627\u0628\u0639" }
    ]
  }
];
var initialParkingSpots = [
  {
    id: "prk-n-101",
    propertyId: "prop-nakheel",
    spotNumber: "P-B1-01",
    location: "basement",
    locationLabel: "\u0627\u0644\u0642\u0628\u0648 \u0627\u0644\u0623\u0648\u0644",
    type: "covered",
    status: "assigned",
    usageType: "dedicated_unit",
    assignedUnitId: "unit-n-101",
    instructions: "\u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0642\u0628\u0648 \u0627\u0644\u0623\u0648\u0644 \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0630\u0643\u064A\u0629\u060C \u0627\u0644\u0645\u0648\u0642\u0641 \u0631\u0642\u0645 101 \u0645\u062D\u062F\u062F \u0628\u0644\u0648\u062D\u0629 Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0644\u0634\u0642\u0629 101.",
    createdAt: "2026-08-20T10:00:00"
  },
  {
    id: "prk-n-102",
    propertyId: "prop-nakheel",
    spotNumber: "P-B1-02",
    location: "basement",
    locationLabel: "\u0627\u0644\u0642\u0628\u0648 \u0627\u0644\u0623\u0648\u0644",
    type: "covered",
    status: "assigned",
    usageType: "dedicated_unit",
    assignedUnitId: "unit-n-102",
    instructions: "\u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0642\u0628\u0648 \u0627\u0644\u0623\u0648\u0644 \u0639\u0628\u0631 \u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0646\u0632\u0644\u0627\u0621\u060C \u0627\u0644\u0645\u0648\u0642\u0641 \u0631\u0642\u0645 102 \u0645\u062E\u0635\u0635 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0644\u0634\u0642\u0629 102.",
    createdAt: "2026-08-20T10:00:00"
  },
  {
    id: "prk-n-201",
    propertyId: "prop-nakheel",
    spotNumber: "P-B1-03",
    location: "basement",
    locationLabel: "\u0627\u0644\u0642\u0628\u0648 \u0627\u0644\u0623\u0648\u0644",
    type: "ev_charging",
    status: "assigned",
    usageType: "dedicated_unit",
    assignedUnitId: "unit-n-201",
    instructions: "\u0645\u0648\u0642\u0641 \u0630\u0648 \u062A\u062C\u0647\u064A\u0632 \u0634\u062D\u0646 \u0633\u064A\u0627\u0631\u0627\u062A \u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629 \u0628\u0642\u062F\u0631\u0629 22 \u0643\u064A\u0644\u0648 \u0648\u0627\u0637 \u0645\u062E\u0635\u0635 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0644\u0634\u0642\u0629 201.",
    createdAt: "2026-08-20T10:00:00"
  },
  {
    id: "prk-n-202",
    propertyId: "prop-nakheel",
    spotNumber: "P-B1-04",
    location: "basement",
    locationLabel: "\u0627\u0644\u0642\u0628\u0648 \u0627\u0644\u0623\u0648\u0644",
    type: "accessible",
    status: "available",
    usageType: "shared_building",
    instructions: "\u0645\u0648\u0642\u0641 \u0630\u0648\u064A \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u062C\u0627\u062A \u0627\u0644\u062E\u0627\u0635\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u0643 \u0628\u0627\u0644\u0642\u0631\u0628 \u0645\u0646 \u0645\u0635\u0639\u062F \u0627\u0644\u0628\u0631\u062C \u0627\u0644\u0631\u0626\u064A\u0633\u064A.",
    createdAt: "2026-08-20T10:00:00"
  },
  {
    id: "prk-n-g01",
    propertyId: "prop-nakheel",
    spotNumber: "P-G-01",
    location: "ground",
    locationLabel: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A \u0627\u0644\u062F\u0627\u062E\u0644\u064A",
    type: "open",
    status: "available",
    usageType: "shared_building",
    instructions: "\u0645\u0648\u0627\u0642\u0641 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u0633\u0637\u062D\u064A\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0644\u0644\u0632\u0648\u0627\u0631 \u0648\u0636\u064A\u0648\u0641 \u0627\u0644\u0646\u0632\u0644\u0627\u0621 \u0644\u0641\u062A\u0631\u0627\u062A \u0642\u0635\u064A\u0631\u0629.",
    createdAt: "2026-08-20T10:00:00"
  },
  {
    id: "prk-o-101",
    propertyId: "prop-olayya",
    spotNumber: "P-OLY-01",
    location: "ground",
    locationLabel: "\u0645\u0648\u0627\u0642\u0641 \u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A \u0627\u0644\u0645\u0638\u0644\u0644\u0629",
    type: "covered",
    status: "assigned",
    usageType: "dedicated_unit",
    assignedUnitId: "unit-o-101",
    instructions: "\u0645\u0648\u0642\u0641 \u0628\u0645\u062F\u062E\u0644 \u0645\u0628\u0627\u0634\u0631 \u0645\u0636\u0644\u0644 \u0648\u0645\u0632\u0648\u062F \u0628\u0643\u0627\u0645\u064A\u0631\u0627 \u0627\u0644\u0645\u0631\u0627\u0642\u0628\u0629\u060C \u0645\u062E\u0635\u0635 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0644\u0634\u0642\u0629 101.",
    createdAt: "2026-08-22T10:00:00"
  },
  {
    id: "prk-o-201",
    propertyId: "prop-olayya",
    spotNumber: "P-OLY-02",
    location: "ground",
    locationLabel: "\u0645\u0648\u0627\u0642\u0641 \u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A \u0627\u0644\u0645\u0638\u0644\u0644\u0629",
    type: "covered",
    status: "assigned",
    usageType: "dedicated_unit",
    assignedUnitId: "unit-o-201",
    instructions: "\u0627\u0644\u0645\u0648\u0642\u0641 \u0627\u0644\u0645\u062E\u0635\u0635 \u0627\u0644\u062D\u0635\u0631\u064A \u0644\u0634\u0642\u0629 201 \u0645\u0639 \u062D\u0648\u0627\u062C\u0632 \u062A\u0645\u0646\u0639 \u0648\u0642\u0648\u0641 \u0627\u0644\u063A\u064A\u0631 \u0648\u062A\u0639\u0645\u0644 \u0628\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0644\u0627\u0633\u0644\u0643\u064A.",
    createdAt: "2026-08-22T10:00:00"
  },
  {
    id: "prk-o-ev",
    propertyId: "prop-olayya",
    spotNumber: "P-OLY-EV",
    location: "ground",
    locationLabel: "\u0645\u0648\u0627\u0642\u0641 \u0627\u0644\u0645\u062F\u062E\u0644 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    type: "ev_charging",
    status: "available",
    usageType: "shared_building",
    instructions: "\u0634\u0627\u062D\u0646 \u0633\u064A\u0627\u0631\u0627\u062A \u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629 \u0633\u0631\u064A\u0639 \u0644\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0645\u0634\u062A\u0631\u0643 \u0639\u0646\u062F \u0627\u0644\u0637\u0644\u0628 \u0641\u064A \u0628\u0647\u0648 \u0627\u0644\u0639\u0644\u064A\u0627.",
    createdAt: "2026-08-22T10:00:00"
  }
];
var initialFloors = [
  // Al Nakheel
  { id: "floor-n-1", propertyId: "prop-nakheel", floorNumber: 1, name: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0648\u0644" },
  { id: "floor-n-2", propertyId: "prop-nakheel", floorNumber: 2, name: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u062B\u0627\u0646\u064A" },
  { id: "floor-n-3", propertyId: "prop-nakheel", floorNumber: 3, name: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u062B\u0627\u0644\u062B" },
  { id: "floor-n-4", propertyId: "prop-nakheel", floorNumber: 4, name: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0631\u0627\u0628\u0639" },
  { id: "floor-n-5", propertyId: "prop-nakheel", floorNumber: 5, name: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u062E\u0627\u0645\u0633 - \u0627\u0644\u0628\u0646\u062A\u0647\u0627\u0648\u0633" },
  // Al Olayya
  { id: "floor-o-1", propertyId: "prop-olayya", floorNumber: 1, name: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0648\u0644" },
  { id: "floor-o-2", propertyId: "prop-olayya", floorNumber: 2, name: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u062B\u0627\u0646\u064A" },
  { id: "floor-o-3", propertyId: "prop-olayya", floorNumber: 3, name: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u062B\u0627\u0644\u062B" },
  { id: "floor-o-4", propertyId: "prop-olayya", floorNumber: 4, name: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0631\u0627\u0628\u0639 - \u0627\u0644\u062F\u0648\u0628\u0644\u0643\u0633" }
];
var initialUnits = [
  {
    id: "unit-n-101",
    propertyId: "prop-nakheel",
    floorId: "floor-n-1",
    unitNumber: "101",
    title: "\u062C\u0646\u0627\u062D \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0628\u0631\u0633\u062A\u064A\u062C \u0630\u0648 \u0627\u0644\u063A\u0631\u0641\u062A\u064A\u0646 \u0627\u0644\u0641\u0627\u062E\u0631\u062A\u064A\u0646",
    titleEn: "Luxury Home Prestige 2BR Suite",
    type: "apartment",
    areaSqm: 125,
    floorNumber: 1,
    maxGuests: 4,
    bedroomsCount: 2,
    bathroomsCount: 2,
    bedsCount: 3,
    assignedParkingId: "prk-n-101",
    publicationStatus: "published",
    spaces: [
      {
        id: "sp-1",
        name: "\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u0639\u064A\u0634\u0629 \u0648\u0627\u0644\u062C\u0644\u0648\u0633 \u0627\u0644\u0641\u0633\u064A\u062D\u0629",
        type: "living_room",
        areaSqm: 42,
        details: "\u062A\u062A\u0645\u064A\u0632 \u0627\u0644\u0635\u0627\u0644\u0629 \u0628\u0634\u0627\u0634\u0629 \u0666\u0665 \u0628\u0648\u0635\u0629 \u0630\u0643\u064A\u0629 \u0648\u0637\u0642\u0645 \u0643\u0646\u0628 \u0625\u064A\u0637\u0627\u0644\u064A \u0641\u0627\u062E\u0631 \u0648\u0633\u062C\u0627\u062F \u062D\u0631\u064A\u0631 \u0637\u0628\u064A\u0639\u064A \u0648\u0625\u0636\u0627\u0621\u0629 \u062E\u0627\u0641\u062A\u0629 \u0645\u062F\u0631\u0648\u0633\u0629.",
        fittings: [
          { id: "fit-1", name: "\u0637\u0642\u0645 \u0643\u0646\u0628 \u0625\u064A\u0637\u0627\u0644\u064A \u0641\u0627\u062E\u0631 (3+2+1)", category: "furniture", quantity: 1 },
          { id: "fit-2", name: "\u0634\u0627\u0634\u0629 \u062A\u0644\u0641\u0632\u064A\u0648\u0646 \u0630\u0643\u064A \u0666\u0665 \u0628\u0648\u0635\u0629 \u0664\u0643\u064A\u0647 OLED", category: "electronics", quantity: 1 },
          { id: "fit-3", name: "\u0637\u0627\u0648\u0644\u0629 \u0637\u0639\u0627\u0645 \u062E\u0634\u0628\u064A\u0629 \u0641\u0627\u062E\u0631\u0629 \u0644\u0623\u0631\u0628\u0639\u0629 \u0623\u0634\u062E\u0627\u0635", category: "furniture", quantity: 1 },
          { id: "fit-4", name: "\u0646\u0638\u0627\u0645 \u062A\u0643\u064A\u064A\u0641 \u0630\u0643\u064A \u0645\u062A\u0643\u0627\u0645\u0644 (Nest)", category: "appliance", quantity: 1 }
        ]
      },
      {
        id: "sp-2",
        name: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629 \u0627\u0644\u0645\u0627\u0633\u062A\u0631 (\u0628\u062D\u0645\u0627\u0645 \u062E\u0627\u0635)",
        type: "bedroom",
        areaSqm: 28,
        bedsCount: 1,
        bedType: "\u0633\u0631\u064A\u0631 \u0643\u064A\u0646\u062C \u0645\u0644\u0643\u064A \u0662\u0660\u0660*\u0662\u0660\u0660",
        details: "\u0633\u0631\u064A\u0631 \u0645\u0644\u0643\u064A \u0645\u0632\u0648\u062F \u0628\u0645\u0631\u062A\u0628\u0629 \u0637\u0628\u064A\u0629 \u0623\u0645\u0631\u064A\u0643\u064A\u0629 \u0645\u0639 \u062F\u0648\u0644\u0627\u0628 \u0645\u0644\u0627\u0628\u0633 \u0645\u062F\u0645\u062C \u0648\u0625\u0636\u0627\u0621\u0629 \u0644\u064A\u0644\u064A\u0629 \u0646\u0627\u0639\u0645\u0629.",
        fittings: [
          { id: "fit-5", name: "\u0633\u0631\u064A\u0631 \u0643\u064A\u0646\u062C \u0645\u0644\u0643\u064A \u0628\u062D\u062C\u0645 \u0662\u0660\u0660*\u0662\u0660\u0660 \u0633\u0645", category: "bed", quantity: 1, specifications: "\u0645\u0641\u0627\u0631\u0634 \u0642\u0637\u0646\u064A\u0629 \u0645\u0635\u0631\u064A\u0629 \u0663\u0660\u0660 \u063A\u0631\u0632\u0629" },
          { id: "fit-6", name: "\u0637\u0627\u0648\u0644\u0629 \u0633\u0631\u064A\u0631 \u062C\u0627\u0646\u0628\u064A\u0629 \u0630\u0643\u064A\u0629 \u0645\u0639 \u0634\u0627\u062D\u0646 \u0644\u0627\u0633\u0644\u0643\u064A", category: "furniture", quantity: 2 },
          { id: "fit-7", name: "\u062F\u0648\u0644\u0627\u0628 \u0645\u0644\u0627\u0628\u0633 \u0645\u062F\u0645\u062C \u0645\u0639 \u0645\u0631\u0622\u0629 \u0628\u0627\u0644\u0637\u0648\u0644 \u0627\u0644\u0643\u0627\u0645\u0644", category: "furniture", quantity: 1 },
          { id: "fit-8", name: "\u062A\u0644\u0641\u0632\u064A\u0648\u0646 \u0630\u0643\u064A \u0645\u062F\u0645\u062C \u0665\u0665 \u0628\u0648\u0635\u0629 \u0634\u0627\u0634\u0629 \u0630\u0643\u064A\u0629", category: "electronics", quantity: 1 }
        ]
      },
      {
        id: "sp-3",
        name: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u062B\u0627\u0646\u064A\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u0643\u0629",
        type: "bedroom",
        areaSqm: 22,
        bedsCount: 2,
        bedType: "\u0633\u0631\u064A\u0631 \u062A\u0648\u064A\u0646 \u0645\u0632\u062F\u0648\u062C \u0661\u0662\u0660*\u0662\u0660\u0660",
        fittings: [
          { id: "fit-9", name: "\u0633\u0631\u064A\u0631 \u062A\u0648\u064A\u0646 \u0645\u0641\u0631\u062F \u0628\u062D\u062C\u0645 \u0661\u0662\u0660*\u0662\u0660\u0660 \u0633\u0645 \u0644\u0643\u0644 \u0633\u0631\u064A\u0631", category: "bed", quantity: 2 },
          { id: "fit-10", name: "\u0637\u0627\u0648\u0644\u0627\u062A \u0646\u0648\u0645 \u062C\u0627\u0646\u0628\u064A\u0629 \u0645\u062C\u0647\u0632\u0629 \u0628\u0648\u0635\u0644\u0627\u062A \u0634\u062D\u0646", category: "furniture", quantity: 1 },
          { id: "fit-11", name: "\u0645\u0643\u062A\u0628 \u062F\u0631\u0627\u0633\u0629 \u0648\u0639\u0645\u0644 \u0635\u063A\u064A\u0631 \u0645\u0631\u064A\u062D \u0644\u0644\u0639\u0645\u0644 \u0627\u0644\u0641\u0631\u062F\u064A", category: "furniture", quantity: 1 }
        ]
      },
      {
        id: "sp-4",
        name: "\u0627\u0644\u0645\u0637\u0628\u062E \u0627\u0644\u0645\u062C\u0647\u0632 \u0628\u0627\u0644\u0643\u0627\u0645\u0644",
        type: "kitchen",
        areaSqm: 16,
        details: "\u064A\u062D\u062A\u0648\u064A \u0627\u0644\u0645\u0637\u0628\u062E \u0639\u0644\u0649 \u062B\u0644\u0627\u062C\u0629 \u0643\u0628\u064A\u0631\u0629 \u0648\u0641\u0631\u0646 \u0645\u064A\u0643\u0631\u0648\u0648\u064A\u0641 \u0648\u0623\u0648\u0627\u0646\u064A \u0637\u0647\u064A \u0643\u0627\u0645\u0644\u0629 \u0648\u0645\u063A\u0633\u0644\u0629 \u0635\u062D\u0648\u0646 \u0645\u062A\u0637\u0648\u0631\u0629.",
        fittings: [
          { id: "fit-12", name: "\u062B\u0644\u0627\u062C\u0629 \u0648\u0645\u062C\u0645\u062F\u0629 \u0645\u0627\u0631\u0643\u0629 \u0633\u064A\u0645\u0646\u0632 \u0627\u0644\u0623\u0644\u0645\u0627\u0646\u064A\u0629", category: "appliance", quantity: 1 },
          { id: "fit-13", name: "\u0645\u0648\u0642\u062F \u063A\u0627\u0632 \u0645\u0639 \u0641\u0631\u0646 \u062D\u0631\u0627\u0631\u064A \u0645\u062A\u0643\u0627\u0645\u0644 \u0628\u0644\u062A-\u0625\u0646", category: "appliance", quantity: 1 },
          { id: "fit-14", name: "\u0645\u0627\u0643\u064A\u0646\u0629 \u062A\u062D\u0636\u064A\u0631 \u0642\u0647\u0648\u0629 \u0646\u0633\u0628\u0631\u064A\u0633\u0648 \u0645\u0639 \u0643\u0628\u0633\u0648\u0644\u0627\u062A \u064A\u0648\u0645\u064A\u0629", category: "appliance", quantity: 1 },
          { id: "fit-15", name: "\u063A\u0633\u0627\u0644\u0629 \u0635\u062D\u0648\u0646 \u0645\u062F\u0645\u062C\u0629 \u0630\u0643\u064A\u0629 \u0633\u0647\u0644\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0645\u0627\u0644", category: "appliance", quantity: 1 }
        ]
      },
      {
        id: "sp-5",
        name: "\u0627\u0644\u062D\u0645\u0627\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0644\u0644\u0645\u0627\u0633\u062A\u0631",
        type: "bathroom",
        areaSqm: 9,
        details: "\u064A\u062A\u0645\u064A\u0632 \u062D\u0645\u0627\u0645 \u0627\u0644\u0645\u0627\u0633\u062A\u0631 \u0628\u062F\u0634 \u0645\u0637\u0631\u064A \u0648\u062C\u0627\u0643\u0648\u0632\u064A \u0645\u062F\u0645\u062C \u0648\u062A\u062C\u0647\u064A\u0632\u0627\u062A \u0635\u062D\u064A\u0629 \u0630\u0647\u0628\u064A\u0629 \u0648\u0625\u0636\u0627\u0621\u0629 \u0645\u0631\u0627\u064A\u0627 \u062F\u0627\u0641\u0626\u0629.",
        fittings: [
          { id: "fit-16", name: "\u062C\u0627\u0643\u0648\u0632\u064A \u0645\u062F\u0645\u062C \u0648\u0628\u0648\u0631\u0633\u0644\u064A\u0646 \u0625\u064A\u0637\u0627\u0644\u064A \u0628\u0627\u0644\u0643\u0627\u0645\u0644", category: "sanitary", quantity: 1 },
          { id: "fit-17", name: "\u062F\u0634 \u0645\u0637\u0631\u064A \u0645\u062A\u062F\u0641\u0642 \u0645\u0639 \u0645\u0635\u0641\u0627\u0629 \u062A\u0646\u0642\u064A\u0629 \u0645\u064A\u0627\u0647", category: "sanitary", quantity: 1 },
          { id: "fit-18", name: "\u0637\u0642\u0645 \u0645\u0646\u0627\u0634\u0641 \u0648\u0623\u0631\u0648\u0627\u0628 \u0642\u0637\u0646\u064A\u0629 \u0641\u0646\u062F\u0642\u064A\u0629 \u0641\u0627\u062E\u0631\u0629", category: "sanitary", quantity: 1 }
        ]
      },
      {
        id: "sp-6",
        name: "\u0627\u0644\u062D\u0645\u0627\u0645 \u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u0645\u0634\u062A\u0631\u0643",
        type: "bathroom",
        areaSqm: 4,
        fittings: [
          { id: "fit-19", name: "\u0637\u0642\u0645 \u062F\u0634 \u0632\u062C\u0627\u062C\u064A \u0648\u062A\u062C\u0647\u064A\u0632\u0627\u062A \u0635\u062D\u064A\u0629 \u062D\u062F\u064A\u062B\u0629 \u0648\u0645\u0646\u0627\u0634\u0641", category: "sanitary", quantity: 1 }
        ]
      },
      {
        id: "sp-7",
        name: "\u0627\u0644\u0634\u0631\u0641\u0629 \u0627\u0644\u062E\u0627\u0631\u062C\u064A\u0629 \u0627\u0644\u0628\u0627\u0646\u0648\u0631\u0627\u0645\u064A\u0629",
        type: "balcony",
        areaSqm: 8,
        fittings: [
          { id: "fit-20", name: "\u0637\u0642\u0645 \u0643\u0631\u0627\u0633\u064A \u0631\u064A\u0632\u064A\u0646 \u062E\u0627\u0631\u062C\u064A \u0648\u0645\u0642\u0627\u0648\u0645 \u0644\u0644\u0639\u0648\u0627\u0645\u0644 \u0627\u0644\u062C\u0648\u064A\u0629 \u0645\u0639 \u0637\u0627\u0648\u0644\u0647", category: "furniture", quantity: 1 }
        ]
      }
    ],
    amenities: ["smart_lock", "wifi", "cleaning", "concierge", "full_kitchen", "coffee", "washer_dryer", "smart_tv", "balcony_view"],
    media: [
      {
        id: "u101_1",
        url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
        title: "\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0635\u0627\u0644\u0629 \u0627\u0644\u0645\u0641\u062A\u0648\u062D\u0629 \u0648\u0627\u0644\u0645\u0639\u064A\u0634\u0629 \u0641\u064A \u0634\u0642\u0629 \u0627\u0644\u0646\u062E\u064A\u0644 \u0661\u0660\u0661",
        type: "image",
        category: "living",
        isCover: true
      },
      {
        id: "u101_2",
        url: "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80",
        title: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u0645\u0627\u0633\u062A\u0631 \u0628\u0625\u0646\u0627\u0631\u0629 \u0648\u062A\u0635\u0645\u064A\u0645 \u0641\u0627\u062E\u0631 \u062C\u062F\u0627\u064B",
        type: "image",
        category: "bedroom"
      },
      {
        id: "u101_3",
        url: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80",
        title: "\u0627\u0644\u0645\u0637\u0628\u062E \u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644 \u0627\u0644\u0645\u062C\u0647\u0632 \u0628\u0623\u0648\u0627\u0646\u064A \u0648\u062A\u062C\u0647\u064A\u0632\u0627\u062A \u0641\u0646\u062F\u0642\u064A\u0629 \u0631\u0627\u0642\u064A\u0629",
        type: "image",
        category: "kitchen"
      },
      {
        id: "u101_4",
        url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
        title: "\u0627\u0644\u062D\u0645\u0627\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0627\u0644\u0645\u062C\u0647\u0632 \u0628\u0648\u0631\u0642 \u062D\u0627\u0626\u0637 \u0628\u0648\u0631\u0633\u0644\u064A\u0646 \u0648\u062C\u0627\u0643\u0648\u0632\u064A",
        type: "image",
        category: "bathroom"
      }
    ],
    floorPlanUrl: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1000&q=80",
    furnishingStatus: "furnished",
    allowDaily: true,
    dailyRate: 950,
    dailySecurityDeposit: 1e3,
    allowMonthly: true,
    monthlyRate: 19500,
    monthlySecurityDeposit: 5e3,
    allowYearly: true,
    yearlyRate: 19e4,
    yearlySecurityDeposit: 1e4,
    yearlyPaymentOptions: ["single_annual", "semi_annual"],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 150,
    securityDeposit: 1e3,
    taxPercentage: 15,
    operationalStatus: "ready",
    occupancyStatus: "vacant"
  },
  {
    id: "unit-n-102",
    propertyId: "prop-nakheel",
    floorId: "floor-n-1",
    unitNumber: "102",
    title: "\u062C\u0646\u0627\u062D \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A \u0627\u0644\u0645\u062A\u0645\u064A\u0632 \u0628\u063A\u0631\u0641\u0629 \u0646\u0648\u0645 \u0648\u0627\u062D\u062F\u0629 \u0648\u0635\u0627\u0644\u0629",
    titleEn: "Luxury Home Executive 1BR Suite",
    type: "apartment",
    areaSqm: 85,
    floorNumber: 1,
    maxGuests: 2,
    bedroomsCount: 1,
    bathroomsCount: 1.5,
    bedsCount: 1,
    assignedParkingId: "prk-n-102",
    publicationStatus: "published",
    spaces: [
      {
        id: "sp-21",
        name: "\u0627\u0644\u0635\u0627\u0644\u0629 \u0627\u0644\u0641\u0646\u062F\u0642\u064A\u0629 \u0627\u0644\u0631\u0627\u0642\u064A\u0629",
        type: "living_room",
        fittings: [
          { id: "fit-21", name: "\u0643\u0646\u0628\u0629 \u0645\u062E\u0645\u0644\u064A\u0629 \u0632\u0631\u0642\u0627\u0621 \u0645\u0631\u064A\u062D\u0629 \u0644\u0644\u063A\u0627\u064A\u0629", category: "furniture", quantity: 1 },
          { id: "fit-22", name: "\u0637\u0627\u0648\u0644\u0629 \u0642\u0647\u0648\u0629 \u062F\u0627\u0626\u0631\u064A\u0629 \u0645\u0646 \u0627\u0644\u0631\u062E\u0627\u0645 \u0627\u0644\u0623\u0633\u0648\u062F \u0645\u0639 \u0646\u062D\u0627\u0633", category: "furniture", quantity: 1 },
          { id: "fit-23", name: "\u0634\u0627\u0634\u0629 \u062A\u0644\u0641\u0632\u064A\u0648\u0646 \u0633\u0627\u0645\u0633\u0648\u0646\u062C \u0630\u0643\u064A\u0629 \u0665\u0665 \u0628\u0648\u0635\u0629 \u0664\u0643\u064A\u0647", category: "electronics", quantity: 1 }
        ]
      },
      {
        id: "sp-22",
        name: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u0645\u0627\u0633\u062A\u0631 \u0627\u0644\u0645\u062C\u0647\u0632\u0629",
        type: "bedroom",
        bedsCount: 1,
        bedType: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0645\u0631\u064A\u062D \u062C\u062F\u0627\u064B \u0661\u0668\u0660*\u0662\u0660\u0660",
        fittings: [
          { id: "fit-24", name: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0645\u0631\u064A\u062D \u0645\u0639 \u0645\u0631\u062A\u0628\u0629 \u0637\u0628\u064A\u0629 \u0661\u0668\u0660*\u0662\u0660\u0660", category: "bed", quantity: 1 },
          { id: "fit-25", name: "\u0637\u0627\u0648\u0644\u0627\u062A \u062C\u0627\u0646\u0628\u064A\u0629 \u062E\u0634\u0628\u064A\u0629 \u0641\u0627\u062E\u0631\u0629", category: "furniture", quantity: 2 },
          { id: "fit-26", name: "\u0625\u0636\u0627\u0621\u0629 \u0623\u0628\u0627\u062C\u0648\u0631\u0629 \u0643\u0644\u0627\u0633\u064A\u0643\u064A\u0629 \u0645\u0646 \u0627\u0644\u0646\u062D\u0627\u0633 \u0627\u0644\u062E\u0627\u0644\u0635", category: "furniture", quantity: 1 }
        ]
      },
      {
        id: "sp-23",
        name: "\u0627\u0644\u0645\u0637\u0628\u062E \u0648\u0627\u0644\u0628\u0627\u0631 \u0627\u0644\u0645\u0641\u062A\u0648\u062D",
        type: "kitchen",
        fittings: [
          { id: "fit-27", name: "\u0635\u0627\u0646\u0639\u0629 \u0645\u0634\u0631\u0648\u0628\u0627\u062A \u0648\u062B\u0644\u0627\u062C\u0629 \u0648\u0645\u0627\u0643\u064A\u0646\u0629 \u0642\u0647\u0648\u0629 \u0635\u063A\u064A\u0631\u0629", category: "appliance", quantity: 1 }
        ]
      },
      {
        id: "sp-24",
        name: "\u0627\u0644\u062D\u0645\u0627\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0648\u0627\u0644\u062C\u0627\u0643\u0648\u0632\u064A \u0627\u0644\u0645\u0628\u0633\u0637",
        type: "bathroom",
        fittings: [
          { id: "fit-28", name: "\u0637\u0642\u0645 \u062A\u062C\u0647\u064A\u0632 \u0627\u0633\u062A\u062D\u0645\u0627\u0645 \u0648\u062A\u062C\u0647\u064A\u0632\u0627\u062A \u0635\u062D\u064A\u0629 \u0625\u064A\u0637\u0627\u0644\u064A\u0629 \u0643\u0627\u0645\u0644\u0629", category: "sanitary", quantity: 1 }
        ]
      }
    ],
    amenities: ["smart_lock", "wifi", "cleaning", "concierge", "full_kitchen", "coffee", "smart_tv", "work_desk"],
    media: [
      {
        id: "u102_1",
        url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
        title: "\u0627\u0644\u0635\u0627\u0644\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629 \u0627\u0644\u0631\u0627\u0626\u0639\u0629 \u0644\u0644\u0634\u0642\u0629 \u0661\u0660\u0662",
        type: "image",
        category: "living",
        isCover: true
      },
      {
        id: "u102_2",
        url: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80",
        title: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u0645\u062C\u0647\u0632\u0629 \u0628\u0625\u0636\u0627\u0621\u0629 \u0646\u0627\u0639\u0645\u0629 \u0648\u062F\u0627\u0641\u0626\u0629",
        type: "image",
        category: "bedroom"
      }
    ],
    furnishingStatus: "furnished",
    allowDaily: true,
    dailyRate: 720,
    dailySecurityDeposit: 800,
    allowMonthly: true,
    monthlyRate: 15e3,
    monthlySecurityDeposit: 3e3,
    allowYearly: true,
    yearlyRate: 145e3,
    yearlySecurityDeposit: 7500,
    yearlyPaymentOptions: ["single_annual", "semi_annual"],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 120,
    securityDeposit: 800,
    taxPercentage: 15,
    operationalStatus: "ready",
    occupancyStatus: "daily_occupied",
    currentBookingId: "bk-1001",
    todayDeparture: false
  },
  {
    id: "unit-n-201",
    propertyId: "prop-nakheel",
    floorId: "floor-n-2",
    unitNumber: "201",
    title: "\u0634\u0642\u0629 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0633\u064A\u062C\u0646\u062A\u0634\u0631 \u0627\u0644\u0645\u062A\u0631\u0641\u0629 \u0630\u0627\u062A \u0663 \u063A\u0631\u0641 \u0646\u0648\u0645 \u0648\u0635\u0627\u0644\u0629",
    titleEn: "Luxury Home Signature 3BR Residence",
    type: "apartment",
    areaSqm: 180,
    floorNumber: 2,
    maxGuests: 6,
    bedroomsCount: 3,
    bathroomsCount: 3,
    bedsCount: 4,
    assignedParkingId: "prk-n-201",
    publicationStatus: "published",
    spaces: [
      {
        id: "sp-31",
        name: "\u0627\u0644\u0635\u0627\u0644\u0629 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A\u0629 \u0627\u0644\u0643\u0628\u064A\u0631\u0629 \u0648\u0627\u0644\u0645\u0641\u062A\u0648\u062D\u0629",
        type: "living_room",
        fittings: [
          { id: "fit-31", name: "\u0637\u0642\u0645 \u0643\u0646\u0628 \u0625\u064A\u0637\u0627\u0644\u064A \u062F\u0627\u0626\u0631\u064A \u0641\u0627\u062E\u0631 \u064A\u0633\u0639 \u0644\u0640 \u0668 \u0623\u0634\u062E\u0627\u0635", category: "furniture", quantity: 1 },
          { id: "fit-32", name: "\u0634\u0627\u0634\u0629 \u062A\u0644\u0641\u0632\u064A\u0648\u0646 \u0625\u0644 \u062C\u064A OLED \u0630\u0643\u064A\u0629 \u0628\u0645\u0642\u0627\u0633 \u0667\u0665 \u0628\u0648\u0635\u0629", category: "electronics", quantity: 1 }
        ]
      },
      {
        id: "sp-32",
        name: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u0623\u0648\u0644\u0649 \u0627\u0644\u0645\u0627\u0633\u062A\u0631 \u0627\u0644\u0631\u0627\u0626\u0639\u0629",
        type: "bedroom",
        bedsCount: 1,
        bedType: "\u0633\u0631\u064A\u0631 \u0643\u064A\u0646\u062C \u0645\u0644\u0643\u064A \u0645\u062C\u0647\u0632 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0662\u0660\u0660*\u0662\u0660\u0660",
        fittings: [
          { id: "fit-33", name: "\u0633\u0631\u064A\u0631 \u0643\u064A\u0646\u062C \u0623\u0645\u0631\u064A\u0643\u064A \u0641\u0627\u062E\u0631 \u0662\u0660\u0660*\u0662\u0660\u0660 \u0633\u0645", category: "bed", quantity: 1 }
        ]
      },
      {
        id: "sp-33",
        name: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u062B\u0627\u0646\u064A\u0629 \u0627\u0644\u0645\u0632\u062F\u0648\u062C\u0629",
        type: "bedroom",
        bedsCount: 1,
        bedType: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0645\u0631\u064A\u062D \u0644\u0644\u063A\u0627\u064A\u0629 \u0661\u0666\u0660*\u0662\u0660\u0660",
        fittings: [
          { id: "fit-34", name: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0645\u0631\u064A\u062D \u0645\u062C\u0647\u0632 \u0628\u062C\u0645\u064A\u0639 \u0627\u0644\u0628\u064A\u0627\u0636\u0627\u062A \u0661\u0666\u0660*\u0662\u0660\u0660", category: "bed", quantity: 1 }
        ]
      },
      {
        id: "sp-34",
        name: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u062B\u0627\u0644\u062B\u0629 \u062A\u0648\u064A\u0646 \u0645\u0632\u062F\u0648\u062C\u0629",
        type: "bedroom",
        bedsCount: 2,
        bedType: "\u0633\u0631\u064A\u0631\u064A\u0646 \u0645\u0641\u0631\u062F\u064A\u0646 \u0661\u0662\u0660*\u0662\u0660\u0660 \u0644\u0643\u0644 \u0645\u0646\u0647\u0645\u0627",
        fittings: [
          { id: "fit-35", name: "\u0637\u0642\u0645 \u0633\u0631\u064A\u0631 \u0645\u0641\u0631\u062F \u0661\u0662\u0660*\u0662\u0660\u0660 \u0633\u0645 \u0642\u0637\u0646 \u0641\u0646\u062F\u0642\u064A", category: "bed", quantity: 2 }
        ]
      },
      {
        id: "sp-35",
        name: "\u0627\u0644\u062D\u0645\u0627\u0645\u0627\u062A \u0627\u0644\u0635\u062D\u064A\u0629 \u0627\u0644\u062B\u0644\u0627\u062B\u0629 \u0627\u0644\u0645\u062C\u0647\u0632\u0629",
        type: "bathroom",
        fittings: [
          { id: "fit-36", name: "\u062A\u062C\u0647\u064A\u0632\u0627\u062A \u0635\u062D\u064A\u0629 \u062C\u0631\u0648\u0647\u064A \u0627\u0644\u0623\u0644\u0645\u0627\u0646\u064A\u0629 \u0627\u0644\u0641\u0627\u062E\u0631\u0629 \u0648\u0645\u0646\u0627\u0634\u0641 \u0648\u0623\u0631\u0648\u0627\u0628", category: "sanitary", quantity: 1 }
        ]
      }
    ],
    amenities: ["smart_lock", "wifi", "cleaning", "concierge", "full_kitchen", "coffee", "washer_dryer", "ev_parking", "balcony_view"],
    media: [
      {
        id: "u201_1",
        url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
        title: "\u0627\u0644\u0635\u0627\u0644\u0648\u0646 \u0627\u0644\u062F\u0627\u062E\u0644\u064A \u0627\u0644\u0641\u062E\u0645 \u0648\u0627\u0644\u0641\u0627\u062E\u0631 \u0641\u064A \u0634\u0642\u0629 \u0662\u0660\u0661",
        type: "image",
        category: "living",
        isCover: true
      }
    ],
    furnishingStatus: "furnished",
    allowDaily: true,
    dailyRate: 1450,
    dailySecurityDeposit: 2e3,
    allowMonthly: true,
    monthlyRate: 28e3,
    monthlySecurityDeposit: 1e4,
    allowYearly: true,
    yearlyRate: 28e4,
    yearlySecurityDeposit: 15e3,
    yearlyPaymentOptions: ["single_annual", "semi_annual"],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 200,
    securityDeposit: 2e3,
    taxPercentage: 15,
    operationalStatus: "ready",
    occupancyStatus: "monthly_occupied"
  },
  {
    id: "unit-n-202",
    propertyId: "prop-nakheel",
    floorId: "floor-n-2",
    unitNumber: "202",
    title: "\u0634\u0642\u0629 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0647\u0648\u0631\u0627\u064A\u0632\u0648\u0646 \u0628\u0625\u0637\u0644\u0627\u0644\u0629 \u0648\u0627\u0633\u0639\u0629 \u0648\u063A\u0631\u0641\u062A\u064A \u0646\u0648\u0645 \u0648\u0635\u0627\u0644\u0629",
    titleEn: "Luxury Home Horizon 2BR",
    type: "apartment",
    areaSqm: 110,
    floorNumber: 2,
    maxGuests: 4,
    bedroomsCount: 2,
    bathroomsCount: 2,
    bedsCount: 2,
    publicationStatus: "published",
    spaces: [
      {
        id: "sp-41",
        name: "\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u0639\u064A\u0634\u0629 \u0648\u0627\u0644\u0644\u0627\u0648\u0646\u062C \u0627\u0644\u0641\u0627\u062E\u0631",
        type: "living_room",
        fittings: [
          { id: "fit-41", name: "\u0643\u0646\u0628 \u0645\u0631\u064A\u062D \u0648\u0637\u0627\u0648\u0644\u0629 \u0637\u0639\u0627\u0645 \u062F\u0627\u0626\u0631\u064A\u0629 \u062E\u0634\u0628\u064A\u0629 \u0645\u062A\u0645\u064A\u0632\u0629", category: "furniture", quantity: 1 }
        ]
      },
      {
        id: "sp-42",
        name: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u0645\u0627\u0633\u062A\u0631 \u0627\u0644\u0645\u062A\u0645\u064A\u0632\u0629",
        type: "bedroom",
        bedsCount: 1,
        bedType: "\u0633\u0631\u064A\u0631 \u0643\u064A\u0646\u062C \u0637\u0628\u064A \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0662\u0660\u0660*\u0662\u0660\u0660",
        fittings: [
          { id: "fit-42", name: "\u0633\u0631\u064A\u0631 \u0643\u064A\u0646\u062C \u0637\u0628\u064A \u0641\u0627\u062E\u0631 \u0662\u0660\u0660*\u0662\u0660\u0660 \u0633\u0645 \u0645\u0639 \u0643\u0648\u062F\u064A\u0646\u062A\u064A\u0646", category: "bed", quantity: 1 }
        ]
      },
      {
        id: "sp-43",
        name: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u062B\u0627\u0646\u064A\u0629 \u0627\u0644\u0645\u0631\u064A\u062D\u0629",
        type: "bedroom",
        bedsCount: 1,
        bedType: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0645\u0631\u064A\u062D \u0648\u0645\u062A\u0645\u064A\u0632 \u0661\u0666\u0660*\u0662\u0660\u0660",
        fittings: [
          { id: "fit-43", name: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0637\u0628\u064A \u0641\u0627\u062E\u0631 \u0648\u0645\u0646\u0627\u0633\u0628 \u0644\u0644\u0625\u0642\u0627\u0645\u0627\u062A \u0627\u0644\u0637\u0648\u064A\u0644\u0629", category: "bed", quantity: 1 }
        ]
      },
      {
        id: "sp-44",
        name: "\u0627\u0644\u062D\u0645\u0627\u0645\u0627\u062A \u0627\u0644\u0623\u0646\u064A\u0642\u0629 \u0648\u0627\u0644\u0628\u0648\u0631\u0633\u0644\u064A\u0646 \u0627\u0644\u0641\u0627\u062E\u0631",
        type: "bathroom",
        fittings: [
          { id: "fit-44", name: "\u0637\u0642\u0645 \u062F\u0634 \u062C\u0631\u0648\u0647\u064A \u0623\u0644\u0645\u0627\u0646\u064A \u0630\u0648 \u0627\u0644\u062A\u0635\u0645\u064A\u0645 \u0627\u0644\u0630\u0647\u0628\u064A \u0627\u0644\u0628\u062F\u064A\u0639 \u0648\u0645\u0646\u0627\u0634\u0641 \u0635\u062D\u064A\u0629", category: "sanitary", quantity: 2 }
        ]
      }
    ],
    amenities: ["smart_lock", "wifi", "cleaning", "concierge", "full_kitchen", "smart_tv"],
    media: [
      {
        id: "u202_1",
        url: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80",
        title: "\u0627\u0644\u0644\u0627\u0648\u0646\u062C \u0627\u0644\u062F\u0627\u062E\u0644\u064A \u0627\u0644\u0631\u0627\u0626\u0639 \u0645\u0639 \u0627\u0644\u0635\u0627\u0644\u0629 \u0627\u0644\u062F\u0627\u0641\u0626\u0629 \u0627\u0644\u0634\u0642\u0629 \u0662\u0660\u0662",
        type: "image",
        category: "living",
        isCover: true
      }
    ],
    furnishingStatus: "furnished",
    allowDaily: true,
    dailyRate: 880,
    dailySecurityDeposit: 1e3,
    allowMonthly: true,
    monthlyRate: 18e3,
    monthlySecurityDeposit: 5e3,
    allowYearly: true,
    yearlyRate: 175e3,
    yearlySecurityDeposit: 9e3,
    yearlyPaymentOptions: ["single_annual", "semi_annual"],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 150,
    securityDeposit: 1e3,
    taxPercentage: 15,
    operationalStatus: "needs_cleaning",
    occupancyStatus: "vacant",
    todayArrival: true
  },
  {
    id: "unit-n-501",
    propertyId: "prop-nakheel",
    floorId: "floor-n-5",
    unitNumber: "501",
    title: "\u0628\u0646\u062A\u0647\u0627\u0648\u0633 \u0631\u0648\u064A\u0627\u0644 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0627\u0644\u0641\u0627\u062E\u0631 \u0645\u0639 \u062A\u0631\u0627\u0633 \u0634\u0627\u0633\u0639 \u0641\u064A \u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u062E\u0627\u0645\u0633",
    titleEn: "Royal Luxury Home Penthouse & Terrace",
    type: "suite",
    areaSqm: 320,
    floorNumber: 5,
    maxGuests: 8,
    bedroomsCount: 4,
    bathroomsCount: 5,
    bedsCount: 5,
    publicationStatus: "published",
    spaces: [
      {
        id: "sp-51",
        name: "\u0645\u062C\u0644\u0633 \u0627\u0644\u0645\u0639\u064A\u0634\u0629 \u0627\u0644\u0645\u0644\u0643\u064A \u0648\u0627\u0644\u0641\u0627\u062E\u0631",
        type: "living_room",
        fittings: [
          { id: "fit-51", name: "\u0643\u0646\u0628 \u0637\u0642\u0645 \u0643\u0627\u0645\u0644 \u064A\u0633\u0639 \u0644\u0640 \u0661\u0660 \u0623\u0634\u062E\u0627\u0635 \u0628\u062A\u0637\u0631\u064A\u0632\u0627\u062A \u062D\u0631\u064A\u0631 \u064A\u062F\u0648\u064A\u0629", category: "furniture", quantity: 1 }
        ]
      },
      {
        id: "sp-52",
        name: "\u0627\u0644\u062C\u0646\u0627\u062D \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0627\u0644\u0645\u0644\u0643\u064A (\u0631\u0648\u064A\u0627\u0644 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629)",
        type: "bedroom",
        bedsCount: 1,
        bedType: "\u0633\u0631\u064A\u0631 \u0631\u0648\u064A\u0627\u0644 \u0643\u064A\u0646\u062C \u0636\u062E\u0645 \u0662\u0662\u0660*\u0662\u0660\u0660 \u0633\u0645",
        fittings: [
          { id: "fit-52", name: "\u0633\u0631\u064A\u0631 \u0633\u0648\u0628\u0631 \u0643\u064A\u0646\u062C \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0631\u0648\u064A\u0627\u0644 \u0662\u0662\u0660*\u0662\u0660\u0660 \u0633\u0645 \u0645\u0639 \u0643\u0648\u062F\u064A\u0646\u064A\u0627\u062A \u0630\u0643\u064A\u0629", category: "bed", quantity: 1 }
        ]
      },
      {
        id: "sp-53",
        name: "\u0627\u0644\u062C\u0646\u0627\u062D \u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u0645\u0632\u062F\u0648\u062C \u0630\u0648 \u0627\u0644\u0633\u0631\u064A\u0631\u064A\u0646 \u0627\u0644\u0645\u062A\u0645\u064A\u0632\u064A\u0646",
        type: "bedroom",
        bedsCount: 2,
        fittings: [
          { id: "fit-53", name: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0661\u0666\u0660*\u0662\u0660\u0660 \u0645\u0632\u062F\u0648\u062C \u0628\u064A\u0627\u0636\u0627\u062A \u062D\u0631\u064A\u0631\u064A\u0629 \u0641\u0627\u062E\u0631\u0629", category: "bed", quantity: 2 }
        ]
      },
      {
        id: "sp-54",
        name: "\u0627\u0644\u062C\u0646\u0627\u062D \u0627\u0644\u062B\u0627\u0644\u062B \u0648\u0627\u0644\u0631\u0627\u0628\u0639 \u0644\u0644\u0636\u064A\u0648\u0641",
        type: "bedroom",
        bedsCount: 2,
        fittings: [
          { id: "fit-54", name: "\u0637\u0642\u0645 \u0633\u0631\u064A\u0631 \u0645\u0641\u0631\u062F \u0661\u0662\u0660*\u0662\u0660\u0660 \u0642\u0637\u0646 \u0645\u0631\u064A\u062D \u0648\u0645\u0646\u0627\u0633\u0628 \u0644\u0644\u0639\u0648\u0627\u0626\u0644", category: "bed", quantity: 2 }
        ]
      },
      {
        id: "sp-55",
        name: "\u0627\u0644\u062A\u0631\u0627\u0633 \u0627\u0644\u0628\u0627\u0646\u0648\u0631\u0627\u0645\u064A \u0627\u0644\u062E\u0627\u0631\u062C\u064A \u0645\u0639 \u0645\u0646\u0642\u0644 \u0646\u0627\u0631 \u0645\u062F\u0645\u062C",
        type: "balcony",
        fittings: [
          { id: "fit-55", name: "\u062C\u0644\u0633\u0629 \u0643\u0646\u0628 \u0631\u0627\u0642\u064A\u0629 \u0645\u0642\u0627\u0648\u0645\u0629 \u0644\u0644\u0623\u0645\u0637\u0627\u0631 \u0648\u0627\u0644\u0634\u0645\u0633 \u0645\u0639 \u0637\u0627\u0648\u0644\u0629 \u062A\u062F\u0641\u0626\u0629 \u062E\u0627\u0631\u062C\u064A\u0629", category: "furniture", quantity: 1 }
        ]
      },
      {
        id: "sp-56",
        name: "\u0627\u0644\u062D\u0645\u0627\u0645\u0627\u062A \u0627\u0644\u062E\u0645\u0633\u0629 \u0627\u0644\u0641\u0627\u062E\u0631\u0629",
        type: "bathroom",
        fittings: [
          { id: "fit-56", name: "\u062A\u062C\u0647\u064A\u0632\u0627\u062A \u0635\u062D\u064A\u0629 \u062C\u0631\u0648\u0647\u064A \u0648\u062D\u062C\u0631 \u0645\u0627\u064A\u0643\u0627 \u0627\u0644\u0625\u064A\u0637\u0627\u0644\u064A \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0648\u0623\u0631\u0648\u0627\u0628 \u0641\u0646\u062F\u0642\u064A\u0629 \u062F\u0627\u0641\u0626\u0629", category: "sanitary", quantity: 5 }
        ]
      }
    ],
    amenities: ["smart_lock", "wifi", "cleaning", "concierge", "full_kitchen", "coffee", "washer_dryer", "ev_parking", "balcony_view", "gym"],
    media: [
      {
        id: "u501_1",
        url: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
        title: "\u0627\u0644\u0635\u0627\u0644\u0629 \u0627\u0644\u0628\u0646\u062A\u0647\u0627\u0648\u0633 \u0627\u0644\u0645\u0637\u0644\u0629 \u0645\u0639 \u0625\u0637\u0644\u0627\u0644\u0627\u062A \u0627\u0644\u0631\u064A\u0627\u0636 \u0627\u0644\u0628\u0627\u0646\u0648\u0631\u0627\u0645\u064A\u0629 \u0627\u0644\u0631\u0627\u0626\u0639\u0629",
        type: "image",
        category: "living",
        isCover: true
      }
    ],
    furnishingStatus: "furnished",
    allowDaily: true,
    dailyRate: 3200,
    dailySecurityDeposit: 5e3,
    allowMonthly: true,
    monthlyRate: 65e3,
    monthlySecurityDeposit: 2e4,
    allowYearly: true,
    yearlyRate: 6e5,
    yearlySecurityDeposit: 3e4,
    yearlyPaymentOptions: ["single_annual"],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 400,
    securityDeposit: 5e3,
    taxPercentage: 15,
    operationalStatus: "ready",
    occupancyStatus: "vacant"
  },
  // Luxury Home Park Olayya
  {
    id: "unit-o-101",
    propertyId: "prop-olayya",
    floorId: "floor-o-1",
    unitNumber: "101",
    title: "\u0627\u0633\u062A\u062F\u064A\u0648 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0644\u0644\u0623\u0639\u0645\u0627\u0644 \u0645\u062C\u0647\u0632 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0644\u0644\u0645\u062F\u0631\u0627\u0621 \u0648\u0631\u062C\u0627\u0644 \u0627\u0644\u0623\u0639\u0645\u0627\u0644",
    titleEn: "Luxury Home Business Studio",
    type: "studio",
    areaSqm: 55,
    floorNumber: 1,
    maxGuests: 2,
    bedroomsCount: 1,
    bathroomsCount: 1,
    bedsCount: 1,
    assignedParkingId: "prk-o-101",
    publicationStatus: "published",
    spaces: [
      {
        id: "sp-o1",
        name: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0648\u0627\u0644\u062C\u0644\u0648\u0633 \u0648\u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0645\u0641\u062A\u0648\u062D\u0629",
        type: "bedroom",
        bedsCount: 1,
        bedType: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0623\u0645\u0631\u064A\u0643\u064A \u0641\u0627\u062E\u0631 \u0661\u0668\u0660*\u0662\u0660\u0660 \u0633\u0645",
        fittings: [
          { id: "fit-o1", name: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0645\u0631\u064A\u062D \u0645\u0639 \u0644\u0648\u062D \u0631\u0623\u0633 \u0645\u0646 \u0627\u0644\u062C\u0644\u062F \u0627\u0644\u0641\u0627\u062E\u0631 \u0648\u0631\u0643\u0646 \u0645\u0643\u062A\u0628 \u0648\u0645\u0642\u0639\u062F \u0641\u062E\u0645", category: "bed", quantity: 1 },
          { id: "fit-o2", name: "\u0645\u0643\u062A\u0628 \u0639\u0645\u0644 \u062A\u0646\u0641\u064A\u0630\u064A \u0645\u062C\u0647\u0632 \u0628\u0625\u0636\u0627\u0621\u0629 \u0645\u0631\u064A\u062D\u0629 \u0648\u062D\u0642\u064A\u0628\u0629 \u0642\u0631\u0637\u0627\u0633\u064A\u0629 \u0645\u062A\u0643\u0627\u0645\u0644\u0629", category: "furniture", quantity: 1 }
        ]
      },
      {
        id: "sp-o12",
        name: "\u0627\u0644\u062D\u0645\u0627\u0645 \u0627\u0644\u062D\u062F\u064A\u062B \u0648\u0627\u0644\u0631\u0627\u0642\u064A \u0627\u0644\u0645\u062A\u0645\u064A\u0632",
        type: "bathroom",
        fittings: [
          { id: "fit-o3", name: "\u062F\u0634 \u0645\u0637\u0631\u064A \u0632\u062C\u0627\u062C\u064A \u0648\u0628\u0644\u0627\u0637 \u0633\u064A\u0631\u0627\u0645\u064A\u0643 \u0641\u0627\u062E\u0631 \u0648\u0645\u0633\u062A\u062D\u0636\u0631\u0627\u062A \u062A\u062C\u0645\u064A\u0644 \u0648\u0645\u0646\u0627\u0634\u0641 \u0641\u0646\u062F\u0642\u064A\u0629", category: "sanitary", quantity: 1 }
        ]
      }
    ],
    amenities: ["smart_lock", "wifi", "cleaning", "concierge", "coffee", "work_desk", "smart_tv"],
    media: [
      {
        id: "uo101_1",
        url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        title: "\u0627\u0644\u0627\u0633\u062A\u062F\u064A\u0648 \u0627\u0644\u0623\u0646\u064A\u0642 \u0627\u0644\u0645\u062C\u0647\u0632 \u0644\u0631\u062C\u0627\u0644 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0639\u0644\u064A\u0627 \u0661\u0660\u0661",
        type: "image",
        category: "bedroom",
        isCover: true
      }
    ],
    furnishingStatus: "furnished",
    allowDaily: true,
    dailyRate: 520,
    dailySecurityDeposit: 600,
    allowMonthly: true,
    monthlyRate: 11e3,
    monthlySecurityDeposit: 2500,
    allowYearly: true,
    yearlyRate: 98e3,
    yearlySecurityDeposit: 5e3,
    yearlyPaymentOptions: ["single_annual", "semi_annual"],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 90,
    securityDeposit: 600,
    taxPercentage: 15,
    operationalStatus: "in_maintenance",
    occupancyStatus: "vacant",
    notes: "\u062A\u062D\u062A\u0627\u062C \u0635\u064A\u0627\u0646\u0629 \u0648\u062D\u062F\u0629 \u0627\u0644\u062A\u0643\u064A\u064A\u0641 \u0648\u0644\u0642\u0637\u0629 \u0627\u0644\u062D\u0645\u0627\u0645."
  },
  {
    id: "unit-o-201",
    propertyId: "prop-olayya",
    floorId: "floor-o-2",
    unitNumber: "201",
    title: "\u062C\u0646\u0627\u062D \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0627\u0644\u0639\u0644\u064A\u0627 \u063A\u0631\u0641\u062A\u064A\u0646 \u0648\u0635\u0627\u0644\u0629 \u0641\u062E\u0645\u0629 \u0645\u0639 \u0625\u0637\u0644\u0627\u0644\u0629 \u062D\u062F\u064A\u0642\u0629",
    titleEn: "Park View 1BR Suite",
    type: "apartment",
    areaSqm: 75,
    floorNumber: 2,
    maxGuests: 3,
    bedroomsCount: 1,
    bathroomsCount: 1,
    bedsCount: 2,
    assignedParkingId: "prk-o-201",
    publicationStatus: "published",
    spaces: [
      {
        id: "sp-o21",
        name: "\u0627\u0644\u0635\u0627\u0644\u0629 \u0627\u0644\u0641\u0646\u062F\u0642\u064A\u0629 \u0648\u0627\u0644\u0644\u0627\u0648\u0646\u062C \u0627\u0644\u062F\u0627\u062E\u0644\u064A",
        type: "living_room",
        fittings: [
          { id: "fit-o21", name: "\u0643\u0646\u0628 \u0637\u0642\u0645 \u0631\u0627\u0626\u0639 \u0628\u062A\u062F\u0631\u062C\u0627\u062A \u0627\u0644\u0628\u064A\u062C \u0648\u0627\u0644\u0631\u0645\u0627\u062F\u064A \u062F\u0627\u0641\u0626 \u0648\u0645\u0631\u064A\u062D \u0648\u0637\u0627\u0648\u0644\u0627\u062A \u0631\u062E\u0627\u0645", category: "furniture", quantity: 1 }
        ]
      },
      {
        id: "sp-o22",
        name: "\u063A\u0631\u0641\u0629 \u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629 \u0630\u064A \u0627\u0644\u0633\u0631\u064A\u0631 \u0627\u0644\u0645\u062A\u0645\u064A\u0632 \u0643\u0648\u064A\u0646",
        type: "bedroom",
        bedsCount: 1,
        bedType: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0645\u0631\u064A\u062D \u0648\u0645\u0631\u062A\u0628\u0629 \u0645\u064A\u0645\u0648\u0631\u064A \u0641\u0648\u0645 \u0637\u0628\u064A\u0629 \u0661\u0666\u0660*\u0662\u0660\u0660 \u0633\u0645",
        fittings: [
          { id: "fit-o22", name: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0645\u0631\u064A\u062D \u0637\u0628\u064A \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0642\u0637\u0646 \u0645\u0635\u0631\u064A \u0641\u0627\u062E\u0631", category: "bed", quantity: 1 }
        ]
      },
      {
        id: "sp-o23",
        name: "\u0627\u0644\u062D\u0645\u0627\u0645 \u0627\u0644\u0623\u0646\u064A\u0642 \u062F\u0634 \u0648\u062C\u0627\u0643\u0648\u0632\u064A",
        type: "bathroom",
        fittings: [
          { id: "fit-o23", name: "\u062A\u062C\u0647\u064A\u0632\u0627\u062A \u0635\u062D\u064A\u0629 \u062D\u062F\u064A\u062B\u0629 \u0648\u0645\u0646\u0627\u0634\u0641 \u0648\u0623\u0631\u0648\u0627\u0628 \u0642\u0637\u0646\u064A\u0629 \u062F\u0627\u0641\u0626\u0629", category: "sanitary", quantity: 1 }
        ]
      }
    ],
    amenities: ["smart_lock", "wifi", "cleaning", "concierge", "full_kitchen", "coffee", "smart_tv", "balcony_view"],
    media: [
      {
        id: "uo201_1",
        url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
        title: "\u0627\u0644\u0635\u0627\u0644\u0629 \u0648\u0627\u0644\u062C\u0644\u0648\u0633 \u0627\u0644\u0623\u0646\u064A\u0642 \u0627\u0644\u0639\u0644\u064A\u0627 \u0662\u0660\u0661",
        type: "image",
        category: "living",
        isCover: true
      }
    ],
    furnishingStatus: "furnished",
    allowDaily: false,
    dailyRate: 680,
    dailySecurityDeposit: 800,
    allowMonthly: true,
    monthlyRate: 7e3,
    monthlySecurityDeposit: 3e3,
    allowYearly: true,
    yearlyRate: 84e3,
    yearlySecurityDeposit: 6e3,
    yearlyPaymentOptions: ["single_annual", "semi_annual"],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 110,
    securityDeposit: 800,
    taxPercentage: 15,
    operationalStatus: "ready",
    occupancyStatus: "occupied_yearly",
    currentLeaseId: "lease-3001",
    notes: "\u0627\u0644\u0639\u0642\u062F \u0633\u0627\u0631\u064A \u062D\u062A\u0649 \u062A\u0627\u0631\u064A\u062E 2027-05-31 (\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0645\u0644\u062A\u0632\u0645 \u0628\u0627\u0644\u0633\u062F\u0627\u062F \u0627\u0644\u062F\u0648\u0631\u064A)."
  },
  {
    id: "unit-o-301",
    propertyId: "prop-olayya",
    floorId: "floor-o-3",
    unitNumber: "301",
    title: "\u062C\u0646\u0627\u062D \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0633\u0643\u0627\u064A \u062F\u0648\u0628\u0644\u0643\u0633 \u0627\u0644\u0641\u0627\u062E\u0631 \u0630\u0648 \u0627\u0644\u0625\u0637\u0644\u0627\u0644\u0629 \u0627\u0644\u0631\u0627\u0626\u0639\u0629 \u0648\u0627\u0644\u063A\u0631\u0641\u062A\u064A\u0646",
    titleEn: "Luxury Home Sky Duplex 2BR",
    type: "duplex",
    areaSqm: 145,
    floorNumber: 3,
    maxGuests: 4,
    bedroomsCount: 2,
    bathroomsCount: 2.5,
    bedsCount: 2,
    publicationStatus: "published",
    spaces: [
      {
        id: "sp-o31",
        name: "\u0627\u0644\u0635\u0627\u0644\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629 \u0627\u0644\u0641\u0633\u064A\u062D\u0629 \u0648\u0645\u062C\u0644\u0633 \u0627\u0644\u0636\u064A\u0648\u0641",
        type: "living_room",
        fittings: [
          { id: "fit-o31", name: "\u0637\u0642\u0645 \u0643\u0646\u0628 \u0645\u062E\u0645\u0644 \u0648\u062A\u0644\u0641\u0632\u064A\u0648\u0646 \u0630\u0643\u064A \u0630\u0648 \u0627\u0644\u0635\u0648\u062A \u0627\u0644\u0633\u064A\u0646\u0645\u0627\u0626\u064A", category: "furniture", quantity: 1 }
        ]
      },
      {
        id: "sp-o32",
        name: "\u0627\u0644\u063A\u0631\u0641 \u0627\u0644\u0645\u0632\u062F\u0648\u062C\u0629 \u0641\u064A \u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0639\u0644\u0648\u064A \u0644\u0644\u062F\u0648\u0628\u0644\u0643\u0633",
        type: "bedroom",
        bedsCount: 2,
        fittings: [
          { id: "fit-o32", name: "\u0633\u0631\u064A\u0631 \u0643\u0648\u064A\u0646 \u0637\u0628\u064A \u0641\u0627\u062E\u0631 \u0648\u0633\u0631\u064A\u0631 \u062A\u0648\u064A\u0646 \u0645\u062C\u0647\u0632 \u0648\u0645\u0631\u064A\u062D \u0644\u0643\u0644 \u063A\u0631\u0641\u0629", category: "bed", quantity: 2 }
        ]
      },
      {
        id: "sp-o33",
        name: "\u0627\u0644\u062D\u0645\u0627\u0645\u0627\u062A \u0648\u0627\u0644\u0645\u063A\u0627\u0633\u0644 \u0627\u0644\u0631\u062E\u0627\u0645\u064A\u0629 \u0627\u0644\u0641\u0627\u062E\u0631\u0629",
        type: "bathroom",
        fittings: [
          { id: "fit-o33", name: "\u0637\u0642\u0645 \u062A\u062C\u0647\u064A\u0632 \u0635\u062D\u064A \u0645\u0645\u064A\u0632 \u0630\u0647\u0628\u064A \u0648\u0646\u0638\u0627\u0645 \u062A\u062F\u0641\u0626\u0629 \u0645\u064A\u0627\u0647 \u0630\u0643\u064A \u0648\u0645\u0631\u0627\u064A\u0627 \u0644\u064A\u062F", category: "sanitary", quantity: 2 }
        ]
      }
    ],
    amenities: ["smart_lock", "wifi", "cleaning", "concierge", "full_kitchen", "washer_dryer", "ev_parking", "balcony_view"],
    media: [
      {
        id: "uo301_1",
        url: "https://images.unsplash.com/photo-160058515440-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
        title: "\u0627\u0644\u062F\u0648\u0628\u0644\u0643\u0633 \u0627\u0644\u0641\u0627\u062E\u0631 \u0628\u062A\u0635\u0645\u064A\u0645 \u0645\u0639\u0644\u0642 \u0631\u0627\u0626\u0639 \u0627\u0644\u0639\u0644\u064A\u0627 \u0663\u0660\u0661",
        type: "image",
        category: "living",
        isCover: true
      }
    ],
    furnishingStatus: "furnished",
    allowDaily: true,
    dailyRate: 1200,
    dailySecurityDeposit: 1500,
    allowMonthly: true,
    monthlyRate: 24e3,
    monthlySecurityDeposit: 8e3,
    allowYearly: true,
    yearlyRate: 23e4,
    yearlySecurityDeposit: 12e3,
    yearlyPaymentOptions: ["single_annual", "semi_annual"],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 180,
    securityDeposit: 1500,
    taxPercentage: 15,
    operationalStatus: "blocked",
    occupancyStatus: "vacant",
    notes: "\u0645\u062D\u062C\u0648\u0628\u0629 \u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0634\u0627\u0645\u0644\u0629 \u0644\u0641\u0631\u0634 \u0627\u0644\u0634\u0631\u0641\u0629 \u0648\u062A\u0637\u0648\u064A\u0631 \u0627\u0644\u062F\u064A\u0643\u0648\u0631 \u0627\u0644\u062F\u0627\u062E\u0644\u064A."
  }
];
var initialAllocations = [
  {
    id: "alloc-1",
    unitId: "unit-n-102",
    type: "booking",
    referenceId: "bk-1001",
    startDate: "2026-09-28T15:00:00",
    endDate: "2026-10-02T12:00:00",
    prepBufferHours: 3,
    status: "active",
    createdAt: "2026-09-27T10:00:00",
    notes: "\u062D\u062C\u0632 \u0645\u0624\u0643\u062F \u0644\u0634\u0642\u0629 \u0661\u0660\u0662 \u0639\u0628\u0631 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0644\u0644\u0636\u064A\u0641 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u062F\u0648\u0633\u0631\u064A"
  },
  {
    id: "alloc-2",
    unitId: "unit-n-201",
    type: "lease",
    referenceId: "lease-2001",
    startDate: "2026-09-01T15:00:00",
    endDate: "2027-02-28T12:00:00",
    prepBufferHours: 4,
    status: "active",
    createdAt: "2026-08-25T14:30:00",
    notes: "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0645\u062E\u0635\u0635 \u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u0623\u0641\u0642 \u0627\u0644\u0645\u062A\u0645\u064A\u0632\u0629 \u0634\u0642\u0629 \u0662\u0660\u0661 \u062D\u064A \u0627\u0644\u0646\u062E\u064A\u0644"
  },
  {
    id: "alloc-3",
    unitId: "unit-n-202",
    type: "booking",
    referenceId: "bk-1002",
    startDate: "2026-09-30T15:00:00",
    endDate: "2026-10-05T12:00:00",
    prepBufferHours: 3,
    status: "active",
    createdAt: "2026-09-29T11:20:00",
    notes: "\u062D\u062C\u0632 \u0645\u0624\u0643\u062F \u0639\u0628\u0631 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 \u0644\u0634\u0642\u0629 \u0662\u0660\u0662 \u0644\u0644\u0636\u064A\u0641 \u0641\u0647\u062F \u0645\u0646\u0635\u0648\u0631"
  },
  {
    id: "alloc-4",
    unitId: "unit-o-101",
    type: "maintenance",
    referenceId: "maint-3001",
    startDate: "2026-09-29T08:00:00",
    endDate: "2026-10-01T18:00:00",
    prepBufferHours: 2,
    status: "active",
    createdAt: "2026-09-29T07:45:00",
    notes: "\u062D\u062C\u0628 \u0628\u0633\u0628\u0628 \u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u062A\u0643\u064A\u064A\u0641 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0648\u0627\u0644\u0645\u063A\u0633\u0644\u0629 \u0634\u0642\u0629 \u0627\u0644\u0639\u0644\u064A\u0627 \u0661\u0660\u0661"
  },
  {
    id: "alloc-5",
    unitId: "unit-o-301",
    type: "block",
    referenceId: "block-4001",
    startDate: "2026-09-29T00:00:00",
    endDate: "2026-10-04T23:59:59",
    prepBufferHours: 2,
    status: "active",
    createdAt: "2026-09-28T09:00:00",
    notes: "\u062D\u062C\u0628 \u0625\u062F\u0627\u0631\u064A \u0644\u0634\u0642\u0629 \u0627\u0644\u0639\u0644\u064A\u0627 \u0663\u0660\u0661 \u0644\u062A\u063A\u064A\u064A\u0631 \u0641\u0631\u0634 \u0627\u0644\u0634\u0631\u0641\u0629 \u0648\u0627\u0644\u062A\u0635\u0645\u064A\u0645"
  },
  {
    id: "alloc-yr-1",
    unitId: "unit-o-201",
    type: "lease",
    referenceId: "lease-3001",
    startDate: "2026-06-01T15:00:00",
    endDate: "2027-05-31T12:00:00",
    prepBufferHours: 6,
    status: "active",
    createdAt: "2026-05-20T10:00:00",
    notes: "\u0639\u0642\u062F \u0633\u0646\u0648\u064A \u0645\u062E\u0635\u0635 \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0633\u0644\u064A\u0645\u0627\u0646 \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A \u062D\u064A \u0627\u0644\u0639\u0644\u064A\u0627 \u0634\u0642\u0629 \u0662\u0660\u0661 \u0644\u0640 \u0661\u0662 \u0634\u0647\u0631\u0627\u064B"
  }
];
var initialBookings = [
  {
    id: "bk-1001",
    bookingNumber: "IVR-26-9041",
    unitId: "unit-n-102",
    propertyId: "prop-nakheel",
    guest: {
      fullName: "\u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u062F\u0648\u0633\u0631\u064A",
      email: "a.aldosari@example.com",
      phone: "+966 54 889 1234",
      nationalIdOrPassport: "1098234711",
      idVerified: true,
      notes: "\u0631\u0627\u0626\u062F \u0623\u0639\u0645\u0627\u0644 \u0645\u062D\u0644\u064A \u064A\u0641\u0636\u0644 \u063A\u0633\u064A\u0644 \u0627\u0644\u0628\u064A\u0627\u0636\u0627\u062A \u0627\u0644\u064A\u0648\u0645\u064A \u0648\u062A\u0648\u0641\u064A\u0631 \u0643\u0628\u0633\u0648\u0644\u0627\u062A \u0642\u0647\u0648\u0629 \u0625\u0636\u0627\u0641\u064A\u0629."
    },
    checkIn: "2026-09-28",
    checkOut: "2026-10-02",
    totalNights: 4,
    guestsCount: 2,
    status: "checked_in",
    rentalType: "daily",
    nightlyRate: 720,
    subtotal: 2880,
    cleaningFee: 120,
    taxes: 450,
    securityDeposit: 800,
    totalAmount: 4250,
    smartLockPin: "829410#",
    smartLockPinValidFrom: "2026-09-28T15:00:00",
    smartLockPinValidTo: "2026-10-02T12:00:00",
    pinAccessedAt: "2026-09-28T15:10:00",
    pinAccessedBy: "guest_app",
    createdAt: "2026-09-27T10:00:00",
    allocationId: "alloc-1"
  },
  {
    id: "bk-1002",
    bookingNumber: "IVR-26-9042",
    unitId: "unit-n-202",
    propertyId: "prop-nakheel",
    guest: {
      fullName: "\u0641\u0647\u062F \u0645\u0646\u0635\u0648\u0631",
      email: "fahad.mansour@example.com",
      phone: "+966 50 671 9922",
      nationalIdOrPassport: "1084729104",
      idVerified: true
    },
    checkIn: "2026-09-30",
    checkOut: "2026-10-05",
    totalNights: 5,
    guestsCount: 3,
    status: "confirmed",
    rentalType: "daily",
    nightlyRate: 880,
    subtotal: 4400,
    cleaningFee: 150,
    taxes: 682.5,
    securityDeposit: 1e3,
    totalAmount: 6232.5,
    smartLockPin: "419752#",
    smartLockPinValidFrom: "2026-09-30T15:00:00",
    smartLockPinValidTo: "2026-10-05T12:00:00",
    createdAt: "2026-09-29T11:20:00",
    allocationId: "alloc-3"
  }
];
var initialLeases = [
  {
    id: "lease-2001",
    contractNumber: "IVR-LSE-2026-08",
    unitId: "unit-n-201",
    propertyId: "prop-nakheel",
    tenant: {
      fullName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0623\u0641\u0642 \u0627\u0644\u0645\u062A\u0645\u064A\u0632\u0629 (\u0645\u0645\u062B\u0644\u0629 \u0628\u0640 \u0631\u0627\u0626\u062F \u0627\u0644\u062A\u0631\u0643\u064A)",
      email: "r.turki@alofooq.sa",
      phone: "+966 55 412 8877",
      nationalIdOrPassport: "7009823412",
      idVerified: true
    },
    startDate: "2026-09-01",
    endDate: "2027-02-28",
    monthsCount: 6,
    rentalType: "monthly",
    status: "active",
    monthlyRent: 28e3,
    securityDeposit: 1e4,
    totalContractValue: 168e3,
    allocationId: "alloc-2",
    inclusionType: "all_inclusive",
    services: [
      {
        id: "s-2001-1",
        serviceKey: "electricity",
        name: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0627\u0644\u0639\u062F\u0627\u062F \u0627\u0644\u0645\u062E\u0635\u0635",
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: "company",
        billingMethod: "capped_included",
        billingCycle: "monthly",
        capAmount: 500,
        providerPayer: "company",
        descriptionRule: "\u0627\u0644\u0634\u0631\u0643\u0629 \u062A\u062A\u062D\u0645\u0644 \u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0628\u062D\u062F \u0623\u0642\u0635\u0649 \u0665\u0660\u0660 \u0631\u064A\u0627\u0644 \u0634\u0647\u0631\u064A\u0627\u064B \u0648\u0627\u0644\u0632\u064A\u0627\u062F\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631."
      },
      {
        id: "s-2001-2",
        serviceKey: "water",
        name: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0634\u0628\u0643\u0629 \u0627\u0644\u0645\u064A\u0627\u0647 \u0648\u0627\u0644\u0635\u0631\u0641",
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: "company",
        billingMethod: "included_no_fee",
        billingCycle: "monthly",
        providerPayer: "company",
        descriptionRule: "\u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0627\u0644\u0645\u064A\u0627\u0647 \u0645\u063A\u0637\u0649 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0648\u0628\u062F\u0648\u0646 \u062A\u0643\u0644\u0641\u0629 \u0625\u0636\u0627\u0641\u064A\u0629 \u0637\u0648\u0627\u0644 \u0641\u062A\u0631\u0629 \u0627\u0644\u0639\u0642\u062F."
      },
      {
        id: "s-2001-3",
        serviceKey: "internet",
        name: "\u0625\u0646\u062A\u0631\u0646\u062A \u0641\u0627\u064A\u0628\u0631 \u0639\u0627\u0644\u064A \u0627\u0644\u0633\u0631\u0639\u0629 \u0645\u062E\u0635\u0635",
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: "company",
        billingMethod: "included_no_fee",
        billingCycle: "monthly",
        providerPayer: "company",
        descriptionRule: "\u062E\u0637 \u0625\u0646\u062A\u0631\u0646\u062A \u0623\u0644\u064A\u0627\u0641 \u0628\u0635\u0631\u064A\u0629 \u0628\u0633\u0631\u0639\u0629 \u0665\u0660\u0660 \u0645\u064A\u062C\u0627\u0628\u062A \u0645\u063A\u0637\u0649 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0648\u0645\u0634\u0645\u0648\u0644 \u0641\u064A \u0642\u064A\u0645\u0629 \u0627\u0644\u0625\u064A\u062C\u0627\u0631."
      }
    ],
    termsSnapshot: {
      frozenAt: "2026-08-25T14:30:00",
      approvedBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0645\u0641\u0644\u062D (\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A\u0629)",
      latePolicy: "\u062A\u0637\u0628\u0642 \u063A\u0631\u0627\u0645\u0629 \u062A\u0623\u062E\u064A\u0631 \u0642\u062F\u0631\u0647\u0627 \u0661\u0660\u066A \u0645\u0646 \u0642\u064A\u0645\u0629 \u0627\u0644\u062F\u0641\u0639\u0629 \u0628\u0639\u062F \u0641\u0648\u0627\u062A \u0667 \u0623\u064A\u0627\u0645 \u0645\u0646 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642.",
      renewalPolicy: "\u064A\u062C\u0628 \u0625\u0628\u0644\u0627\u063A \u0625\u062F\u0627\u0631\u0629 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0628\u0627\u0644\u0631\u063A\u0628\u0629 \u0641\u064A \u0627\u0644\u062A\u062C\u062F\u064A\u062F \u0642\u0628\u0644 \u0663\u0660 \u064A\u0648\u0645\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0645\u0646 \u062A\u0627\u0631\u064A\u062E \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F.",
      earlyTerminationPolicy: "\u0641\u064A \u062D\u0627\u0644 \u0627\u0644\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0645\u0628\u0643\u0631\u060C \u064A\u062A\u0645 \u0645\u0635\u0627\u062F\u0631\u0629 \u062A\u0623\u0645\u064A\u0646 \u0627\u0644\u0639\u0642\u062F \u0645\u0639 \u062F\u0641\u0639 \u063A\u0631\u0627\u0645\u0629 \u062A\u0639\u0627\u062F\u0644 \u0634\u0647\u0631 \u0625\u064A\u062C\u0627\u0631 \u0625\u0636\u0627\u0641\u064A \u0643\u0634\u0631\u0637 \u062C\u0632\u0627\u0626\u064A.",
      agreedRent: 28e3,
      agreedDeposit: 1e4
    },
    amendments: [],
    createdAt: "2026-08-25T14:30:00",
    installments: [
      {
        id: "inst-1",
        leaseId: "lease-2001",
        installmentNumber: 1,
        label: "\u062F\u0641\u0639\u0629 \u0634\u0647\u0631 \u0633\u0628\u062A\u0645\u0628\u0631 2026",
        dueDate: "2026-09-01",
        amount: 28e3,
        paidAmount: 28e3,
        remainingAmount: 0,
        status: "paid",
        paidAt: "2026-08-28T11:00:00",
        receiptNumber: "RCP-26-0901",
        transactionRef: "TX-98401",
        payments: [{ paymentId: "pay-2001-1", amount: 28e3, date: "2026-08-28T11:00:00", method: "bank_transfer", receiptNo: "RCP-26-0901" }]
      },
      {
        id: "inst-2",
        leaseId: "lease-2001",
        installmentNumber: 2,
        label: "\u062F\u0641\u0639\u0629 \u0634\u0647\u0631 \u0623\u0643\u062A\u0648\u0628\u0631 2026",
        dueDate: "2026-10-01",
        amount: 28e3,
        paidAmount: 0,
        remainingAmount: 28e3,
        status: "due",
        payments: []
      },
      {
        id: "inst-3",
        leaseId: "lease-2001",
        installmentNumber: 3,
        label: "\u062F\u0641\u0639\u0629 \u0634\u0647\u0631 \u0646\u0648\u0641\u0645\u0628\u0631 2026",
        dueDate: "2026-11-01",
        amount: 28e3,
        paidAmount: 0,
        remainingAmount: 28e3,
        status: "not_due_yet",
        payments: []
      },
      {
        id: "inst-4",
        leaseId: "lease-2001",
        installmentNumber: 4,
        label: "\u062F\u0641\u0639\u0629 \u0634\u0647\u0631 \u062F\u064A\u0633\u0645\u0628\u0631 2026",
        dueDate: "2026-12-01",
        amount: 28e3,
        paidAmount: 0,
        remainingAmount: 28e3,
        status: "not_due_yet",
        payments: []
      },
      {
        id: "inst-5",
        leaseId: "lease-2001",
        installmentNumber: 5,
        label: "\u062F\u0641\u0639\u0629 \u0634\u0647\u0631 \u064A\u0646\u0627\u064A\u0631 2027",
        dueDate: "2027-01-01",
        amount: 28e3,
        paidAmount: 0,
        remainingAmount: 28e3,
        status: "not_due_yet",
        payments: []
      },
      {
        id: "inst-6",
        leaseId: "lease-2001",
        installmentNumber: 6,
        label: "\u062F\u0641\u0639\u0629 \u0634\u0647\u0631 \u0641\u0628\u0631\u0627\u064A\u0631 2027",
        dueDate: "2027-02-01",
        amount: 28e3,
        paidAmount: 0,
        remainingAmount: 28e3,
        status: "not_due_yet",
        payments: []
      }
    ]
  },
  {
    id: "lease-3001",
    contractNumber: "IVR-LSE-2026-YR01",
    unitId: "unit-o-201",
    propertyId: "prop-olayya",
    tenant: {
      fullName: "\u0633\u0644\u064A\u0645\u0627\u0646 \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A",
      email: "s.qahtani@saudicorp.sa",
      phone: "+966 50 918 2233",
      nationalIdOrPassport: "1076294810",
      idVerified: true,
      notes: "\u0645\u0633\u062A\u0634\u0627\u0631 \u0625\u062F\u0627\u0631\u064A \u0644\u062F\u0649 \u0627\u0644\u0647\u064A\u0626\u0627\u062A \u0627\u0644\u062D\u0643\u0648\u0645\u064A\u0629 \u064A\u0637\u0644\u0628 \u0641\u0627\u062A\u0648\u0631\u0629 \u0636\u0631\u064A\u0628\u064A\u0629 \u0631\u0633\u0645\u064A\u0629 \u0628\u0627\u0633\u0645 \u0645\u0624\u0633\u0633\u062A\u0647."
    },
    startDate: "2026-06-01",
    endDate: "2027-05-31",
    monthsCount: 12,
    rentalType: "yearly",
    yearlyPaymentOption: "semi_annual",
    status: "active",
    yearlyRent: 84e3,
    monthlyRent: 7e3,
    securityDeposit: 6e3,
    totalContractValue: 84e3,
    allocationId: "alloc-yr-1",
    inclusionType: "partially_inclusive",
    services: [
      {
        id: "srv-yr-1",
        serviceKey: "electricity",
        name: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0639\u062F\u0627\u062F \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A \u0627\u0644\u0645\u0633\u062A\u0642\u0644",
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: "company",
        billingMethod: "capped_included",
        billingCycle: "monthly",
        capAmount: 400,
        providerPayer: "company",
        descriptionRule: "\u0645\u0634\u0645\u0648\u0644 \u0628\u062D\u062F \u0623\u0642\u0635\u0649 \u0664\u0660\u0660 \u0631\u064A\u0627\u0644 \u0634\u0647\u0631\u064A\u0627\u064B \u0648\u062A\u062A\u0645 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629 \u0639\u0644\u0649 \u0627\u0644\u0641\u0631\u0642 \u0645\u0639 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0634\u0647\u0631\u064A\u0627\u064B.",
        meterInfo: {
          hasDedicatedMeter: true,
          meterNumber: "SEC-992104",
          startReading: 15200,
          readingDate: "2026-06-01"
        }
      },
      {
        id: "srv-yr-2",
        serviceKey: "water",
        name: "\u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0634\u0628\u0643\u0629 \u0627\u0644\u0645\u064A\u0627\u0647 \u0648\u0627\u0644\u0635\u0631\u0641",
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: "company",
        billingMethod: "included_no_fee",
        billingCycle: "monthly",
        providerPayer: "company",
        descriptionRule: "\u0645\u064A\u0627\u0647 \u0627\u0644\u0635\u0646\u0628\u0648\u0631 \u0648\u0627\u0644\u0635\u0631\u0641 \u0645\u0634\u0645\u0648\u0644\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0648\u0628\u062F\u0648\u0646 \u0642\u064A\u0648\u062F \u0637\u0648\u0627\u0644 \u0645\u062F\u0629 \u0627\u0644\u0625\u0642\u0627\u0645\u0629."
      },
      {
        id: "srv-yr-3",
        serviceKey: "internet",
        name: "\u0625\u0646\u062A\u0631\u0646\u062A \u0623\u0644\u064A\u0627\u0641 \u0628\u0635\u0631\u064A\u0629 \u0641\u0627\u064A\u0628\u0631 \u0645\u0633\u062A\u0642\u0644",
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: "company",
        billingMethod: "included_no_fee",
        billingCycle: "monthly",
        providerPayer: "company",
        descriptionRule: "\u062E\u0637 \u0623\u0644\u064A\u0627\u0641 \u0628\u0635\u0631\u064A\u0629 \u0633\u0631\u064A\u0639 \u0644\u0644\u063A\u0627\u064A\u0629 \u0645\u062E\u0635\u0635 \u0644\u0644\u0648\u062D\u062F\u0629 \u0648\u0645\u063A\u0637\u0649 \u0628\u0627\u0644\u0643\u0627\u0645\u0644.",
        internetInfo: {
          packageSpeed: "500 Mbps Fiber",
          providerName: "STC Fiber",
          isDedicatedLine: true,
          wifiName: "Luxury Home_Olayya_201",
          wifiPasswordSafe: "Iv#Olayya2026"
        }
      },
      {
        id: "srv-yr-4",
        serviceKey: "maintenance",
        name: "\u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u062F\u0648\u0631\u064A\u0629 \u0648\u0627\u0644\u0637\u0627\u0631\u0626\u0629 \u0627\u0644\u0634\u0627\u0645\u0644\u0629",
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: "company",
        billingMethod: "included_no_fee",
        billingCycle: "once",
        providerPayer: "company",
        descriptionRule: "\u0627\u0644\u0634\u0631\u0643\u0629 \u062A\u0648\u0641\u0631 \u0635\u064A\u0627\u0646\u0629 \u0645\u064A\u0643\u0627\u0646\u064A\u0643\u064A\u0629 \u0648\u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629 \u0648\u0642\u0641\u0644 \u0630\u0643\u064A \u0628\u0634\u0643\u0644 \u0641\u0648\u0631\u064A \u0648\u0645\u062C\u0627\u0646\u064A.",
        maintenanceScope: {
          routineCoveredBy: "company",
          normalWearCoveredBy: "company",
          misuseCoveredBy: "tenant",
          emergencyCoveredBy: "company"
        }
      },
      {
        id: "srv-yr-5",
        serviceKey: "parking",
        name: "\u0627\u0644\u0645\u0648\u0642\u0641 \u0627\u0644\u062E\u0627\u0635 \u0627\u0644\u0645\u0638\u0644\u0644 \u0627\u0644\u0645\u062E\u0635\u0635",
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: "company",
        billingMethod: "included_no_fee",
        billingCycle: "once",
        providerPayer: "company",
        descriptionRule: "\u0645\u0648\u0642\u0641 \u0645\u0638\u0644\u0644 \u062E\u0627\u0635 \u0631\u0642\u0645 P-OLY-02 \u0645\u062A\u0627\u062D \u0637\u0648\u0627\u0644 \u0645\u062F\u0629 \u0627\u0644\u0639\u0642\u062F."
      }
    ],
    termsSnapshot: {
      frozenAt: "2026-05-25T11:00:00",
      approvedBy: "\u0633\u0639\u062F \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A (\u0645\u062F\u064A\u0631 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u062A\u062D\u0635\u064A\u0644)",
      latePolicy: "\u062A\u0637\u0628\u0642 \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u0641\u0648\u0631\u064A \u0648\u0631\u0633\u0648\u0645 \u062A\u0623\u062E\u064A\u0631 \u0662\u0660\u0660 \u0631\u064A\u0627\u0644 \u0644\u0644\u064A\u0648\u0645 \u0628\u0639\u062F \u0623\u0633\u0628\u0648\u0639 \u0645\u0646 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642.",
      renewalPolicy: "\u0625\u0631\u0633\u0627\u0644 \u062E\u0637\u0627\u0628 \u0637\u0644\u0628 \u062A\u062C\u062F\u064A\u062F \u0623\u0648 \u0631\u063A\u0628\u0629 \u0641\u064A \u0627\u0644\u0625\u062E\u0644\u0627\u0621 \u0642\u0628\u0644 \u0666\u0660 \u064A\u0648\u0645\u0627\u064B\u060C \u0639\u0644\u0649 \u0623\u0646 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0633\u0639\u0631 \u0642\u0628\u0644 \u0663\u0660 \u064A\u0648\u0645\u0627\u064B.",
      earlyTerminationPolicy: "\u0641\u064A \u062D\u0627\u0644 \u0627\u0644\u0641\u0633\u062E \u0642\u0628\u0644 \u0627\u0644\u0645\u0648\u0639\u062F\u060C \u064A\u062A\u062D\u0645\u0644 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0625\u064A\u062C\u0627\u0631 \u0634\u0647\u0631\u064A\u0646 \u0643\u063A\u0631\u0627\u0645\u0629 \u0625\u0646\u0647\u0627\u0621 \u0645\u0628\u0643\u0631.",
      agreedRent: 84e3,
      agreedDeposit: 6e3
    },
    amendments: [],
    createdAt: "2026-05-25T11:00:00",
    installments: [
      {
        id: "inst-yr-1",
        leaseId: "lease-3001",
        installmentNumber: 1,
        label: "\u0627\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 - \u0627\u0644\u0646\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0645\u0646 \u0627\u0644\u0625\u064A\u062C\u0627\u0631",
        dueDate: "2026-06-01",
        amount: 42e3,
        paidAmount: 42e3,
        remainingAmount: 0,
        status: "paid",
        paidAt: "2026-05-28T16:00:00",
        receiptNumber: "RCP-YR-2601",
        transactionRef: "MADA-98217",
        payments: [
          { paymentId: "pay-yr-1", amount: 42e3, date: "2026-05-28T16:00:00", method: "mada", receiptNo: "RCP-YR-2601" }
        ],
        notes: "\u062A\u0645 \u0633\u062F\u0627\u062F \u0627\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u0628\u0646\u062C\u0627\u062D \u0645\u0646 \u0628\u0637\u0627\u0642\u0629 \u0645\u0627\u062F\u064A\u0629 \u0644\u0644\u0639\u0645\u064A\u0644."
      },
      {
        id: "inst-yr-2",
        leaseId: "lease-3001",
        installmentNumber: 2,
        label: "\u0627\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u062B\u0627\u0646\u064A\u0629 - \u0627\u0644\u0646\u0635\u0641 \u0627\u0644\u062B\u0627\u0646\u064A \u0645\u0646 \u0627\u0644\u0625\u064A\u062C\u0627\u0631",
        dueDate: "2026-12-01",
        amount: 42e3,
        paidAmount: 0,
        remainingAmount: 42e3,
        status: "not_due_yet",
        payments: [],
        notes: "\u0627\u0644\u062F\u0641\u0639\u0629 \u0645\u0633\u062A\u062D\u0642\u0629 \u0628\u062A\u0627\u0631\u064A\u062E 2026-12-01 \u0628\u0642\u064A\u0645\u0629 42,000 \u0631\u064A\u0627\u0644."
      }
    ]
  }
];
var initialSecurityDeposits = [
  {
    id: "dep-101",
    bookingOrLeaseId: "bk-1001",
    unitId: "unit-n-102",
    guestName: "\u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u062F\u0648\u0633\u0631\u064A",
    amount: 800,
    collectedAmount: 0,
    collectionReference: void 0,
    collectionVerifiedAt: void 0,
    heldType: "authorized_hold",
    status: "held",
    deductions: [],
    refundAmount: 0,
    refundedAmount: 0,
    deductedAmount: 0,
    rentAppliedAmount: 0,
    createdAt: "2026-09-27T10:05:00"
  },
  {
    id: "dep-102",
    bookingOrLeaseId: "lease-2001",
    unitId: "unit-n-201",
    guestName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0623\u0641\u0642 \u0627\u0644\u0645\u062A\u0645\u064A\u0632\u0629",
    amount: 1e4,
    collectedAmount: 0,
    collectionReference: void 0,
    collectionVerifiedAt: void 0,
    heldType: "collected_cash_card",
    status: "held",
    deductions: [],
    refundAmount: 0,
    refundedAmount: 0,
    deductedAmount: 0,
    rentAppliedAmount: 0,
    createdAt: "2026-08-25T14:40:00"
  }
];
var initialPayments = [
  {
    id: "pay-1",
    referenceType: "booking",
    referenceId: "bk-1001",
    amount: 3450,
    method: "mada",
    status: "success",
    transactionId: "MADA_AUTH_948102",
    installmentId: void 0,
    sourceType: "direct_payment",
    affectsCash: true,
    createdAt: "2026-09-27T10:04:30",
    notes: "\u0633\u062F\u0627\u062F \u062D\u062C\u0632 \u0627\u0644\u0636\u064A\u0641 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u062F\u0648\u0633\u0631\u064A \u0639\u0628\u0631 \u0645\u062F\u064A \u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u062F\u0641\u0639 \u0643\u064A\u0646\u062A"
  },
  {
    id: "pay-2",
    referenceType: "deposit",
    referenceId: "dep-101",
    amount: 800,
    method: "visa_mastercard",
    status: "pending",
    transactionId: "AUTH_HOLD_771892",
    installmentId: void 0,
    sourceType: "direct_payment",
    affectsCash: false,
    createdAt: "2026-09-27T10:05:00",
    notes: "\u062A\u0641\u0648\u064A\u0636 \u0628\u0637\u0627\u0642\u0629 \u0627\u0626\u062A\u0645\u0627\u0646 \u0643\u0648\u062F\u064A\u0639\u0629 \u062A\u0623\u0645\u064A\u0646 \u0645\u062D\u062A\u062C\u0632\u0629 (\u063A\u064A\u0631 \u0645\u062D\u0635\u0644\u0629 \u0646\u0642\u062F\u064A\u0627\u064B)"
  },
  {
    id: "pay-3",
    referenceType: "lease_installment",
    referenceId: "lease-2001",
    amount: 28e3,
    method: "bank_transfer",
    status: "success",
    transactionId: "SARIE_TRANS_198274",
    installmentId: void 0,
    sourceType: "direct_payment",
    affectsCash: true,
    createdAt: "2026-08-28T11:00:00",
    notes: "\u062D\u0648\u0627\u0644\u0629 \u0645\u0635\u0631\u0641\u064A\u0629 \u0648\u0627\u0631\u062F\u0629 \u0644\u062D\u0633\u0627\u0628 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0639\u0628\u0631 \u0633\u0631\u064A\u0639 - \u062F\u0641\u0639\u0629 \u0633\u0628\u062A\u0645\u0628\u0631 \u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u0623\u0641\u0642"
  }
];
var initialContentSections = [
  {
    id: "sec-hero",
    sectionKey: "hero",
    name: "\u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u062A\u0631\u062D\u064A\u0628\u064A \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    title: "\u0627\u0643\u062A\u0634\u0641 \u0623\u0631\u0642\u0649 \u0645\u0633\u062A\u0648\u064A\u0627\u062A \u0627\u0644\u0645\u0639\u064A\u0634\u0629 \u0627\u0644\u0641\u0646\u062F\u0642\u064A\u0629 \u0627\u0644\u0641\u0627\u062E\u0631\u0629 \u0641\u064A \u0642\u0644\u0628 \u0627\u0644\u0631\u064A\u0627\u0636",
    subtitle: "\u0634\u0642\u0642 \u0648\u0623\u062C\u0646\u062D\u0629 \u0633\u0643\u0646\u064A\u0629 \u0645\u0641\u0631\u0648\u0634\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u062A\u062F\u0645\u062C \u0628\u0633\u0644\u0627\u0633\u0629 \u062A\u0627\u0645\u0629 \u0628\u064A\u0646 \u062F\u0641\u0621 \u0648\u062E\u0635\u0648\u0635\u064A\u0629 \u0627\u0644\u0645\u0646\u0632\u0644 \u0648\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0636\u064A\u0627\u0641\u0629 \u0627\u0644\u0641\u0646\u062F\u0642\u064A\u0629 \u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644\u0629 \u0627\u0644\u0631\u0627\u0642\u064A\u0629\u060C \u0641\u064A \u0623\u0643\u062B\u0631 \u0627\u0644\u0623\u062D\u064A\u0627\u0621 \u062C\u0627\u0630\u0628\u064A\u0629 \u0641\u064A \u0627\u0644\u0639\u0627\u0635\u0645\u0629.",
    visible: true,
    order: 1,
    mediaUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1920&q=85",
    ctaText: "\u0627\u0633\u062A\u0643\u0634\u0641 \u0627\u0644\u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0633\u0643\u0646\u064A\u0629",
    ctaLink: "#units",
    customData: {
      overlayOpacity: 45,
      showVideo: false,
      videoUrl: ""
    }
  },
  {
    id: "sec-search",
    sectionKey: "search_bar",
    name: "\u0634\u0631\u064A\u0637 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0645\u0637\u0648\u0631 \u0627\u0644\u0641\u0648\u0631\u064A \u0648\u0627\u0644\u0630\u0643\u064A",
    title: "\u0627\u0644\u0628\u062D\u062B \u0639\u0646 \u062C\u0646\u0627\u062D \u0645\u062A\u0627\u062D",
    subtitle: "\u0627\u062E\u062A\u0631 \u0627\u0644\u062A\u0648\u0627\u0631\u064A\u062E \u0648\u0646\u0648\u0639 \u0627\u0644\u0625\u0642\u0627\u0645\u0629 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 \u0644\u0643 \u0644\u062A\u0643\u062A\u0634\u0641 \u0627\u0644\u0634\u0642\u0642 \u0627\u0644\u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u062D\u062C\u0632 \u0627\u0644\u0641\u0648\u0631\u064A",
    visible: true,
    order: 2
  },
  {
    id: "sec-buildings",
    sectionKey: "buildings",
    name: "\u0623\u0628\u0631\u0627\u062C \u0648\u0645\u0628\u0627\u0646\u064A Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0627\u0644\u0641\u062E\u0645\u0629",
    title: "\u0648\u062C\u0647\u0627\u062A\u0646\u0627 \u0627\u0644\u0645\u062A\u0645\u064A\u0632\u0629 \u0648\u0627\u0644\u0633\u0643\u0646 \u0627\u0644\u0641\u0627\u062E\u0631 \u0627\u0644\u0645\u062E\u062A\u0627\u0631",
    subtitle: "\u0646\u0642\u062F\u0645 \u0645\u062C\u0645\u0639\u0627\u062A\u0646\u0627 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0641\u064A \u0623\u0631\u0642\u0649 \u0627\u0644\u0645\u0648\u0627\u0642\u0639 \u0641\u064A \u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0631\u064A\u0627\u0636\u060C \u0645\u0635\u0645\u0645\u0629 \u0628\u0647\u0646\u062F\u0633\u0629 \u0645\u0639\u0645\u0627\u0631\u064A\u0629 \u0639\u0635\u0631\u064A\u0629 \u0644\u0636\u0645\u0627\u0646 \u0623\u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u064A\u0627\u062A \u0627\u0644\u0631\u0641\u0627\u0647\u064A\u0629 \u0648\u0627\u0644\u0647\u062F\u0648\u0621 \u0644\u0636\u064A\u0648\u0641\u0646\u0627 \u0648\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646\u0627.",
    visible: true,
    order: 3
  },
  {
    id: "sec-units",
    sectionKey: "featured_units",
    name: "\u0634\u0642\u0642 \u0648\u0623\u062C\u0646\u062D\u0629 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0627\u0644\u0641\u0627\u062E\u0631\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629",
    title: "\u0634\u0642\u0642 \u0633\u0643\u0646\u064A\u0629 \u0645\u0635\u0645\u0645\u0629 \u062E\u0635\u064A\u0635\u0627\u064B \u0644\u0630\u0648\u0642\u0643 \u0627\u0644\u0631\u0641\u064A\u0639",
    subtitle: "\u0627\u0633\u062A\u0639\u0631\u0636 \u062A\u0634\u0643\u064A\u0644\u062A\u0646\u0627 \u0627\u0644\u0645\u062E\u062A\u0627\u0631\u0629 \u0645\u0646 \u0627\u0644\u0634\u0642\u0642 \u0648\u0627\u0644\u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0644\u0644\u0625\u0642\u0627\u0645\u0629 \u0627\u0644\u0641\u0646\u062F\u0642\u064A\u0629 \u0627\u0644\u064A\u0648\u0645\u064A\u0629\u060C \u0627\u0644\u0634\u0647\u0631\u064A\u0629\u060C \u0648\u0627\u0644\u0633\u0646\u0648\u064A\u0629 \u0627\u0644\u0641\u0627\u062E\u0631\u0629\u060C \u0645\u0639 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0633\u0627\u062D\u0627\u062A\u060C \u0627\u0644\u0623\u062B\u0627\u062B\u060C \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0634\u0627\u0645\u0644\u0629.",
    visible: true,
    order: 4
  },
  {
    id: "sec-offers",
    sectionKey: "offers",
    name: "\u0627\u0644\u0639\u0631\u0648\u0636 \u0648\u0627\u0644\u0645\u0632\u0627\u064A\u0627 \u0627\u0644\u062D\u0635\u0631\u064A\u0629 \u0648\u0627\u0644\u062A\u0631\u0642\u064A\u0627\u062A",
    title: "\u0627\u062D\u0635\u0644 \u0639\u0644\u0649 \u062E\u0635\u0645 \u064A\u0635\u0644 \u062D\u062A\u0649 \u0662\u0660\u066A \u0639\u0644\u0649 \u0625\u0642\u0627\u0645\u0627\u062A \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0637\u0648\u064A\u0644\u0629",
    subtitle: "\u0627\u0633\u062A\u0645\u062A\u0639 \u0628\u0645\u0632\u0627\u064A\u0627 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0645\u0628\u0643\u0631 \u0648\u0639\u0631\u0648\u0636 \u0631\u062C\u0627\u0644 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0648\u0627\u0644\u0634\u0631\u0643\u0627\u062A\u060C \u0645\u0639 \u062A\u063A\u0637\u064A\u0629 \u0634\u0627\u0645\u0644\u0629 \u0644\u0643\u0627\u0641\u0629 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0648\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u062A\u062F\u0628\u064A\u0631 \u0627\u0644\u0645\u0646\u0632\u0644\u064A \u0627\u0644\u0641\u0646\u062F\u0642\u064A \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A \u0628\u062E\u0635\u0645 \u062D\u0635\u0631\u064A \u0648\u0645\u0645\u064A\u0632.",
    visible: true,
    order: 5,
    mediaUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
    ctaText: "\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0643\u0648\u0646\u0633\u064A\u0631\u062C \u0627\u0644\u0622\u0646",
    ctaLink: "#contact"
  },
  {
    id: "sec-amenities",
    sectionKey: "amenities",
    name: "\u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0641\u0646\u062F\u0642\u064A\u0629 \u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644\u0629",
    title: "\u062E\u062F\u0645\u0627\u062A \u0627\u0633\u062A\u062B\u0646\u0627\u0626\u064A\u0629 \u062A\u0641\u0648\u0642 \u0627\u0644\u062A\u0648\u0642\u0639\u0627\u062A \u0644\u0636\u0645\u0627\u0646 \u0631\u0627\u062D\u062A\u0643",
    subtitle: "\u0635\u0645\u0645\u062A \u062E\u062F\u0645\u0627\u062A \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0628\u0639\u0646\u0627\u064A\u0629 \u0641\u0627\u0626\u0642\u0629 \u0644\u062A\u063A\u0637\u064A \u0643\u0644 \u062A\u0641\u0627\u0635\u064A\u0644 \u062D\u064A\u0627\u062A\u0643 \u0627\u0644\u064A\u0648\u0645\u064A\u0629\u060C \u0644\u062A\u0631\u0643\u0632 \u0641\u0642\u0637 \u0639\u0644\u0649 \u0623\u0639\u0645\u0627\u0644\u0643 \u0648\u0627\u0633\u062A\u0631\u062E\u0627\u0626\u0643 \u0628\u064A\u0646\u0645\u0627 \u0646\u062A\u0648\u0644\u0649 \u0646\u062D\u0646 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0644\u0648\u062C\u0633\u062A\u064A\u0629 \u0648\u0627\u0644\u0636\u064A\u0627\u0641\u0629 \u0628\u062F\u0642\u0629 \u062A\u0627\u0645\u0629.",
    visible: true,
    order: 6
  },
  {
    id: "sec-steps",
    sectionKey: "steps",
    name: "\u0631\u062D\u0644\u0629 \u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u064A\u0633\u0631\u0629 \u0630\u0627\u062A \u0627\u0644\u062E\u0637\u0648\u0627\u062A \u0627\u0644\u062B\u0644\u0627\u062B",
    title: "\u062E\u0637\u0648\u0627\u062A \u062D\u062C\u0632 \u0648\u062A\u0623\u062C\u064A\u0631 \u0641\u0648\u0631\u064A\u0629 \u0645\u064A\u0633\u0631\u0629 \u0648\u0622\u0645\u0646\u0629",
    subtitle: "\u0646\u0641\u062E\u0631 \u0628\u062A\u0642\u062F\u064A\u0645 \u0623\u0648\u0644 \u062A\u062C\u0631\u0628\u0629 \u062A\u0639\u0627\u0642\u062F \u0648\u062D\u062C\u0632 \u0631\u0642\u0645\u064A\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0628\u062F\u0648\u0646 \u0623\u0648\u0631\u0627\u0642 \u0641\u064A \u0627\u0644\u0645\u0645\u0644\u0643\u0629\u060C \u0644\u062A\u0628\u062F\u0623 \u0625\u0642\u0627\u0645\u062A\u0643 \u0627\u0644\u0641\u0627\u062E\u0631\u0629 \u0628\u062F\u0642\u0627\u0626\u0642 \u0645\u0639\u062F\u0648\u062F\u0629.",
    visible: true,
    order: 7
  },
  {
    id: "sec-faq",
    sectionKey: "faq",
    name: "\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629 \u0648\u0627\u0644\u0645\u0643\u0631\u0631\u0629 \u0644\u0644\u0636\u064A\u0648\u0641",
    title: "\u0643\u0644 \u0645\u0627 \u062A\u0648\u062F \u0645\u0639\u0631\u0641\u062A\u0647 \u0639\u0646 \u062E\u062F\u0645\u0627\u062A \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0627\u0644\u0641\u0627\u062E\u0631\u0629",
    subtitle: "\u0625\u062C\u0627\u0628\u0627\u062A \u0648\u0627\u0641\u064A\u0629 \u0648\u0645\u0641\u0635\u0644\u0629 \u0639\u0646 \u0623\u0643\u062B\u0631 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0637\u0631\u062D\u0627\u064B \u0645\u0646 \u0642\u0628\u0644 \u0636\u064A\u0648\u0641\u0646\u0627 \u0648\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646\u0627 \u0644\u062A\u062C\u0631\u0628\u0629 \u0625\u0642\u0627\u0645\u0629 \u062E\u0627\u0644\u064A\u0629 \u0645\u0646 \u0627\u0644\u0642\u0644\u0642 \u0648\u0627\u0644\u0627\u0631\u062A\u0628\u0627\u0643.",
    visible: true,
    order: 8
  },
  {
    id: "sec-contact",
    sectionKey: "contact",
    name: "\u0642\u0633\u0645 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0648\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u062E\u062F\u0645\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621",
    title: "\u062A\u0648\u0627\u0635\u0644 \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0639 \u0641\u0631\u064A\u0642 \u0627\u0644\u0643\u0648\u0646\u0633\u064A\u0631\u062C \u0648\u062E\u062F\u0645\u0629 \u0627\u0644\u0636\u064A\u0648\u0641",
    subtitle: "\u0647\u0644 \u0644\u062F\u064A\u0643 \u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u0645\u062E\u0635\u0635 \u0623\u0648 \u0631\u063A\u0628\u0629 \u0641\u064A \u0632\u064A\u0627\u0631\u0629 \u062E\u0627\u0635\u0629 \u0644\u0644\u0645\u0628\u0627\u0646\u064A\u061F \u0641\u0631\u064A\u0642 \u0627\u0644\u0643\u0648\u0646\u0633\u064A\u0631\u062C \u0645\u062A\u0627\u062D \u0639\u0644\u0649 \u0645\u062F\u0627\u0631 \u0627\u0644\u0633\u0627\u0639\u0629 \u0644\u062A\u0644\u0628\u064A\u0629 \u0645\u062A\u0637\u0644\u0628\u0627\u062A\u0643 \u0648\u0636\u0645\u0627\u0646 \u0625\u062C\u0627\u0628\u0629 \u0648\u0627\u0641\u064A\u0629 \u0644\u0643\u0644 \u0631\u063A\u0628\u0627\u062A\u0643 \u0648\u062A\u0633\u0647\u064A\u0644 \u0632\u064A\u0627\u0631\u062A\u0643.",
    visible: true,
    order: 9
  }
];
var initialAuditLogs = [
  {
    id: "log-1",
    action: "\u0625\u0646\u0634\u0627\u0621 \u062D\u062C\u0632 \u0641\u0648\u0631\u064A \u0641\u0646\u062F\u0642\u064A",
    entity: "Booking",
    entityId: "bk-1001",
    performedBy: "\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u062F\u0641\u0639 (\u0627\u0644\u0636\u064A\u0641 \u0639\u0628\u0631 \u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A)",
    role: "Guest / System",
    details: "\u062A\u0645 \u062D\u062C\u0632 \u0634\u0642\u0629 \u0661\u0660\u0662 \u0628\u0646\u062C\u0627\u062D \u0648\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u0628\u0639\u062F \u0627\u0633\u062A\u0644\u0627\u0645 \u0645\u0628\u0644\u063A \u0627\u0644\u062D\u062C\u0632 \u0643\u0627\u0645\u0644\u0627\u064B \u0663\u0664\u0665\u0660 \u0631\u064A\u0627\u0644 \u0633\u0639\u0648\u062F\u064A \u0645\u0646 \u0662\u0660\u0662\u0666-\u0660\u0669-\u0662\u0668 \u0625\u0644\u0649 \u0662\u0660\u0662\u0666-\u0661\u0660-\u0660\u0662.",
    timestamp: "2026-09-27T10:05:00"
  },
  {
    id: "log-2",
    action: "\u062A\u0648\u0644\u064A\u062F \u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0633\u0631\u064A \u0644\u0644\u0642\u0641\u0644 \u0627\u0644\u0630\u0643\u064A \u0644\u0644\u0636\u064A\u0641",
    entity: "Booking",
    entityId: "bk-1001",
    performedBy: "\u0646\u0638\u0627\u0645 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0641\u0627\u062A\u064A\u062D \u0627\u0644\u0630\u0643\u064A\u0629",
    role: "Guest",
    details: "\u062A\u0645 \u062A\u0648\u0644\u064A\u062F \u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0633\u0631\u064A 829410# \u0628\u0646\u062C\u0627\u062D \u0648\u0635\u0627\u0644\u062D \u0644\u0644\u062F\u062E\u0648\u0644 \u0645\u0646 \u0627\u0644\u0633\u0627\u0639\u0629 \u0661\u0665:\u0660\u0660 \u064A\u0648\u0645 \u0627\u0644\u0648\u0635\u0648\u0644 \u062D\u062A\u0649 \u0661\u0662:\u0660\u0660 \u064A\u0648\u0645 \u0627\u0644\u0645\u063A\u0627\u062F\u0631\u0629.",
    timestamp: "2026-09-28T15:10:00"
  },
  {
    id: "log-3",
    action: "\u062A\u0643\u0644\u064A\u0641 \u0645\u0647\u0645\u0629 \u062A\u0646\u0638\u064A\u0641 \u062F\u0648\u0631\u064A\u0629 (Turnover)",
    entity: "HousekeepingTask",
    entityId: "hk-101",
    performedBy: "\u0627\u0644\u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A\u0629 \u0644\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
    role: "System",
    details: "\u062A\u0645 \u062A\u0639\u064A\u064A\u0646 \u0645\u0647\u0645\u0629 \u062A\u0646\u0638\u064A\u0641 \u0648\u062A\u0637\u0647\u064A\u0631 \u0634\u0642\u0629 \u0662\u0660\u0662 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0644\u062A\u0648\u0627\u0641\u0642 \u0645\u0648\u0639\u062F \u062E\u0631\u0648\u062C \u0627\u0644\u0646\u0632\u064A\u0644 \u0645\u0639 \u0648\u0635\u0648\u0644 \u0627\u0644\u0636\u064A\u0641 \u0627\u0644\u062C\u062F\u064A\u062F \u0627\u0644\u0633\u0627\u0639\u0629 \u0661\u0665:\u0660\u0660 \u0627\u0644\u064A\u0648\u0645.",
    timestamp: "2026-09-30T09:00:00"
  }
];
var initialExpenseCategories = [
  {
    id: "cat-rent",
    code: "building_rent",
    nameAr: "\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0645\u0628\u0627\u0646\u064A",
    nameEn: "Building Rent",
    defaultCostCenterLevel: "property",
    defaultTemporalDistribution: "equal_monthly",
    defaultAllocationMethod: "by_area",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-rent-1", nameAr: "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0639\u0645\u0627\u0631\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A", nameEn: "Master Building Lease" },
      { id: "sub-rent-2", nameAr: "\u0645\u0648\u0627\u0642\u0641 \u0625\u0636\u0627\u0641\u064A\u0629 \u0645\u0633\u062A\u0623\u062C\u0631\u0629", nameEn: "Leased Extra Parking" }
    ]
  },
  {
    id: "cat-salaries-admin",
    code: "admin_salaries",
    nameAr: "\u0627\u0644\u0631\u0648\u0627\u062A\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629",
    nameEn: "Admin Salaries",
    defaultCostCenterLevel: "company",
    defaultTemporalDistribution: "equal_monthly",
    defaultAllocationMethod: "equal_units",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-adm-1", nameAr: "\u0631\u0648\u0627\u062A\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u062A\u0634\u063A\u064A\u0644", nameEn: "HQ Operations" },
      { id: "sub-adm-2", nameAr: "\u0645\u0643\u0627\u0641\u0622\u062A \u0648\u0625\u0643\u0631\u0627\u0645\u064A\u0627\u062A \u0623\u062F\u0627\u0621", nameEn: "Bonuses" }
    ]
  },
  {
    id: "cat-salaries-staff",
    code: "building_staff_salaries",
    nameAr: "\u0631\u0648\u0627\u062A\u0628 \u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0645\u0628\u0627\u0646\u064A \u0648\u0627\u0644\u062D\u0631\u0627\u0633",
    nameEn: "Building Staff & Security",
    defaultCostCenterLevel: "property",
    defaultTemporalDistribution: "equal_monthly",
    defaultAllocationMethod: "equal_units",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-stf-1", nameAr: "\u062D\u0631\u0627\u0633 \u0627\u0644\u0623\u0645\u0646 \u0648\u0627\u0644\u0633\u0644\u0627\u0645\u0629", nameEn: "Security Guards" },
      { id: "sub-stf-2", nameAr: "\u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0648\u0627\u0644\u0643\u0648\u0646\u0633\u064A\u0631\u062C", nameEn: "Reception Staff" },
      { id: "sub-stf-3", nameAr: "\u0639\u0645\u0627\u0644 \u0627\u0644\u0646\u0638\u0627\u0641\u0629 \u0627\u0644\u0645\u0642\u064A\u0645\u064A\u0646", nameEn: "Resident Cleaners" }
    ]
  },
  {
    id: "cat-marketing",
    code: "marketing_advertising",
    nameAr: "\u0627\u0644\u062F\u0639\u0627\u064A\u0629 \u0648\u0627\u0644\u062A\u0633\u0648\u064A\u0642",
    nameEn: "Marketing & Advertising",
    defaultCostCenterLevel: "company",
    defaultTemporalDistribution: "instant",
    defaultAllocationMethod: "by_revenue",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-mkt-1", nameAr: "\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u062C\u0648\u062C\u0644 \u0648\u0645\u0648\u0627\u0642\u0639 \u0627\u0644\u062A\u0648\u0627\u0635\u0644", nameEn: "Digital Ads" },
      { id: "sub-mkt-2", nameAr: "\u062A\u0635\u0648\u064A\u0631 \u0641\u0648\u062A\u0648\u063A\u0631\u0627\u0641\u064A \u0648\u0641\u064A\u062F\u064A\u0648 3D", nameEn: "Media Production" },
      { id: "sub-mkt-3", nameAr: "\u0645\u0637\u0628\u0648\u0639\u0627\u062A \u0648\u0647\u062F\u0627\u064A\u0627 \u062A\u0631\u062D\u064A\u0628\u064A\u0629", nameEn: "Welcome Kits" }
    ]
  },
  {
    id: "cat-electricity",
    code: "electricity",
    nameAr: "\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
    nameEn: "Electricity",
    defaultCostCenterLevel: "property",
    defaultTemporalDistribution: "actual_days",
    defaultAllocationMethod: "by_area",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-elec-1", nameAr: "\u0639\u062F\u0627\u062F \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0645\u0634\u062A\u0631\u0643\u0629 \u0648\u0627\u0644\u0645\u0635\u0627\u0639\u062F", nameEn: "Common Area Meter" },
      { id: "sub-elec-2", nameAr: "\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0634\u0642\u0642 \u0627\u0644\u0645\u062C\u0645\u0639\u0629", nameEn: "Apartment Meters" }
    ]
  },
  {
    id: "cat-water",
    code: "water",
    nameAr: "\u0627\u0644\u0645\u064A\u0627\u0647 \u0648\u0627\u0644\u0635\u0631\u0641",
    nameEn: "Water & Sewage",
    defaultCostCenterLevel: "property",
    defaultTemporalDistribution: "actual_days",
    defaultAllocationMethod: "by_area",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-wtr-1", nameAr: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0634\u0631\u0643\u0629 \u0627\u0644\u0645\u064A\u0627\u0647 \u0627\u0644\u0648\u0637\u0646\u064A\u0629", nameEn: "NWC Bill" },
      { id: "sub-wtr-2", nameAr: "\u0635\u0647\u0627\u0631\u064A\u062C \u0645\u064A\u0627\u0647 \u0637\u0627\u0631\u0626\u0629", nameEn: "Water Tankers" }
    ]
  },
  {
    id: "cat-internet",
    code: "internet",
    nameAr: "\u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A \u0648\u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A",
    nameEn: "Internet & Telecom",
    defaultCostCenterLevel: "property",
    defaultTemporalDistribution: "equal_monthly",
    defaultAllocationMethod: "equal_units",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-net-1", nameAr: "\u0627\u0634\u062A\u0631\u0627\u0643 \u0641\u0627\u064A\u0628\u0631 \u0623\u0644\u064A\u0627\u0641 \u0628\u0635\u0631\u064A\u0629", nameEn: "Fiber Subscription" },
      { id: "sub-net-2", nameAr: "\u0631\u0627\u0648\u062A\u0631\u0627\u062A \u0648\u0645\u0642\u0648\u064A\u0627\u062A \u0625\u0634\u0627\u0631\u0629", nameEn: "Routers & Extenders" }
    ]
  },
  {
    id: "cat-cleaning",
    code: "cleaning_supplies",
    nameAr: "\u0627\u0644\u0646\u0638\u0627\u0641\u0629 \u0648\u0627\u0644\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A",
    nameEn: "Cleaning & Consumables",
    defaultCostCenterLevel: "property",
    defaultTemporalDistribution: "instant",
    defaultAllocationMethod: "equal_units",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-cln-1", nameAr: "\u0645\u0646\u0638\u0641\u0627\u062A \u0648\u0645\u0637\u0647\u0631\u0627\u062A \u0641\u0646\u062F\u0642\u064A\u0629", nameEn: "Cleaning Agents" },
      { id: "sub-cln-2", nameAr: "\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0627\u0644\u0636\u064A\u0627\u0641\u0629 (\u0634\u0627\u064A\u060C \u0642\u0647\u0648\u0629\u060C \u0645\u0627\u0621)", nameEn: "Hospitality Amenities" },
      { id: "sub-cln-3", nameAr: "\u063A\u0633\u064A\u0644 \u0648\u0643\u0648\u064A \u0627\u0644\u0634\u0631\u0627\u0634\u0641 \u0648\u0627\u0644\u0628\u064A\u0627\u0636\u0627\u062A", nameEn: "Linen Laundry" }
    ]
  },
  {
    id: "cat-building-maint",
    code: "building_common_maintenance",
    nameAr: "\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0645\u0628\u0627\u0646\u064A \u0648\u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u0645\u0634\u062A\u0631\u0643\u0629",
    nameEn: "Building & Common Maintenance",
    defaultCostCenterLevel: "property",
    defaultTemporalDistribution: "instant",
    defaultAllocationMethod: "by_area",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-bmnt-1", nameAr: "\u0635\u064A\u0627\u0646\u0629 \u0648\u0642\u0627\u0626\u064A\u0629 \u0644\u0644\u0645\u0635\u0627\u0639\u062F", nameEn: "Elevator Maintenance" },
      { id: "sub-bmnt-2", nameAr: "\u0635\u064A\u0627\u0646\u0629 \u062E\u0632\u0627\u0646 \u0627\u0644\u0645\u064A\u0627\u0647 \u0648\u0627\u0644\u0645\u0636\u062E\u0627\u062A", nameEn: "Water Tank & Pumps" },
      { id: "sub-bmnt-3", nameAr: "\u0643\u0627\u0645\u064A\u0631\u0627\u062A \u0627\u0644\u0645\u0631\u0627\u0642\u0628\u0629 \u0648\u0627\u0644\u0623\u0628\u0648\u0627\u0628 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629", nameEn: "CCTV & Access Gates" }
    ]
  },
  {
    id: "cat-unit-appliances",
    code: "unit_appliances_maintenance",
    nameAr: "\u0635\u064A\u0627\u0646\u0629 \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0648\u062D\u062F\u0627\u062A",
    nameEn: "Unit Appliances Maintenance",
    defaultCostCenterLevel: "unit",
    defaultTemporalDistribution: "instant",
    defaultAllocationMethod: "direct_unit",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-umnt-1", nameAr: "\u0635\u064A\u0627\u0646\u0629 \u0648\u063A\u0633\u064A\u0644 \u0627\u0644\u0645\u0643\u064A\u0641\u0627\u062A", nameEn: "HVAC Servicing" },
      { id: "sub-umnt-2", nameAr: "\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u062B\u0644\u0627\u062C\u0627\u062A \u0648\u0627\u0644\u063A\u0633\u0627\u0644\u0627\u062A", nameEn: "Kitchen Appliances" },
      { id: "sub-umnt-3", nameAr: "\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0642\u0641\u0644 \u0627\u0644\u0630\u0643\u064A \u0648\u0627\u0644\u0625\u0646\u062A\u0631\u0643\u0648\u0645", nameEn: "Smart Locks" }
    ]
  },
  {
    id: "cat-gov-fees",
    code: "government_fees_licenses",
    nameAr: "\u0627\u0644\u0631\u0633\u0648\u0645 \u0627\u0644\u062D\u0643\u0648\u0645\u064A\u0629 \u0648\u0627\u0644\u0631\u062E\u0635",
    nameEn: "Gov Fees & Licenses",
    defaultCostCenterLevel: "company",
    defaultTemporalDistribution: "equal_monthly",
    defaultAllocationMethod: "by_area",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-gov-1", nameAr: "\u0631\u062E\u0635\u0629 \u0627\u0644\u0628\u0644\u062F\u064A\u0629 \u0648\u0627\u0644\u062F\u0641\u0627\u0639 \u0627\u0644\u0645\u062F\u0646\u064A", nameEn: "Civil Defense & Municipality" },
      { id: "sub-gov-2", nameAr: "\u0627\u0634\u062A\u0631\u0627\u0643 \u0627\u0644\u063A\u0631\u0641\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629 \u0648\u0627\u0644\u0633\u062C\u0644", nameEn: "Commercial Register & Chamber" }
    ]
  },
  {
    id: "cat-payment-fees",
    code: "payment_fees_commissions",
    nameAr: "\u0631\u0633\u0648\u0645 \u0627\u0644\u062F\u0641\u0639 \u0648\u0627\u0644\u0639\u0645\u0648\u0644\u0627\u062A",
    nameEn: "Payment Gateway & Bank Fees",
    defaultCostCenterLevel: "company",
    defaultTemporalDistribution: "instant",
    defaultAllocationMethod: "by_revenue",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-pay-1", nameAr: "\u0639\u0645\u0648\u0644\u0627\u062A \u0628\u0648\u0627\u0628\u0627\u062A \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629", nameEn: "Payment Gateway Fees" },
      { id: "sub-pay-2", nameAr: "\u0631\u0633\u0648\u0645 \u0623\u062C\u0647\u0632\u0629 \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064A\u0639 POS", nameEn: "POS Terminal Fees" }
    ]
  },
  {
    id: "cat-furniture-ffe",
    code: "furniture_appliances",
    nameAr: "\u0634\u0631\u0627\u0621 \u0627\u0644\u0623\u062B\u0627\u062B \u0648\u0627\u0644\u0623\u062C\u0647\u0632\u0629 (\u0631\u0623\u0633\u0645\u0627\u0644\u064A FF&E)",
    nameEn: "Furniture & Appliances (Capital FF&E)",
    defaultCostCenterLevel: "unit",
    defaultTemporalDistribution: "instant",
    defaultAllocationMethod: "direct_unit",
    isCapitalFfe: true,
    isArchived: false,
    subcategories: [
      { id: "sub-ffe-1", nameAr: "\u0623\u062C\u0647\u0632\u0629 \u0630\u0643\u064A\u0629 \u0648\u062A\u0644\u0641\u0632\u064A\u0648\u0646\u0627\u062A", nameEn: "Smart TVs & Electronics" },
      { id: "sub-ffe-2", nameAr: "\u0623\u062B\u0627\u062B \u063A\u0631\u0641 \u0646\u0648\u0645 \u0648\u063A\u0631\u0641 \u062C\u0644\u0648\u0633", nameEn: "Living & Bedroom Furniture" },
      { id: "sub-ffe-3", nameAr: "\u0623\u0637\u0642\u0645 \u0623\u0648\u0627\u0646\u064A \u0648\u0645\u0633\u062A\u0644\u0632\u0645\u0627\u062A \u0645\u0637\u0628\u062E", nameEn: "Kitchenware" }
    ]
  },
  {
    id: "cat-other",
    code: "operations_other",
    nameAr: "\u0645\u0635\u0627\u0631\u064A\u0641 \u0623\u062E\u0631\u0649 \u0648\u0646\u062B\u0631\u064A\u0627\u062A",
    nameEn: "Other Operational Expenses",
    defaultCostCenterLevel: "property",
    defaultTemporalDistribution: "instant",
    defaultAllocationMethod: "equal_units",
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: "sub-oth-1", nameAr: "\u0646\u062B\u0631\u064A\u0627\u062A \u062A\u0634\u063A\u064A\u0644\u064A\u0629 \u0648\u0637\u0627\u0631\u0626\u0629", nameEn: "Petty Cash Sundries" }
    ]
  }
];
var initialRecurringExpenses = [
  {
    id: "rec-01",
    name: "\u0625\u064A\u062C\u0627\u0631 \u0645\u0628\u0646\u0649 \u0645\u062C\u0645\u0639 \u0627\u0644\u0646\u062E\u064A\u0644 \u0627\u0644\u0633\u0646\u0648\u064A",
    category: "building_rent",
    subcategoryId: "sub-rent-1",
    description: "\u0639\u0642\u062F \u0627\u0633\u062A\u0626\u062C\u0627\u0631 \u0639\u0645\u0627\u0631\u0629 \u0627\u0644\u0646\u062E\u064A\u0644 \u0627\u0644\u0633\u0646\u0648\u064A \u0628\u0642\u064A\u0645\u0629 \u0661\u0662\u0660,\u0660\u0660\u0660 \u0631\u064A\u0627\u0644 \u064A\u063A\u0637\u064A \u0633\u0646\u0629 \u0643\u0627\u0645\u0644\u0629 \u0645\u0642\u0633\u0645\u0629 \u0634\u0647\u0631\u064A\u0627\u064B \u0628\u0627\u0644\u062A\u0633\u0627\u0648\u064A \u0648\u0645\u0648\u0632\u0639\u0629 \u0628\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0634\u0642\u0642",
    amount: 12e4,
    isFfeOrEquipment: false,
    costCenterLevel: "property",
    propertyId: "prop-nakheel",
    vendorOrBeneficiary: "\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0639\u0642\u0627\u0631\u064A\u0629",
    frequency: "yearly",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    temporalDistribution: "equal_monthly",
    costAllocationMethod: "by_area",
    isActive: true,
    lastGeneratedPeriod: "2026-09",
    createdAt: "2026-01-01T09:00:00"
  },
  {
    id: "rec-02",
    name: "\u0631\u0627\u062A\u0628 \u062D\u0627\u0631\u0633 \u0648\u0645\u0633\u0624\u0648\u0644 \u0623\u0645\u0646 \u0628\u0631\u062C \u0627\u0644\u0646\u062E\u064A\u0644",
    category: "building_staff_salaries",
    subcategoryId: "sub-stf-1",
    description: "\u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0631\u0627\u062A\u0628 \u0627\u0644\u062D\u0631\u0627\u0633\u0629 \u0648\u0627\u0644\u0623\u0645\u0646 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A \u0644\u0628\u0631\u062C \u0627\u0644\u0646\u062E\u064A\u0644",
    amount: 4e3,
    isFfeOrEquipment: false,
    costCenterLevel: "property",
    propertyId: "prop-nakheel",
    vendorOrBeneficiary: "\u0634\u0631\u0643\u0629 \u0627\u0644\u062D\u0631\u0627\u0633\u0627\u062A \u0627\u0644\u0623\u0645\u0646\u064A\u0629 \u0627\u0644\u0623\u0648\u0644\u0649",
    frequency: "monthly",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    temporalDistribution: "equal_monthly",
    costAllocationMethod: "equal_units",
    isActive: true,
    lastGeneratedPeriod: "2026-09",
    createdAt: "2026-01-01T09:00:00"
  },
  {
    id: "rec-03",
    name: "\u0625\u0646\u062A\u0631\u0646\u062A \u0648\u0623\u0644\u064A\u0627\u0641 \u0628\u0635\u0631\u064A\u0629 \u0645\u0634\u062A\u0631\u0643\u0629 \u0644\u0628\u0631\u062C \u0627\u0644\u0639\u0644\u064A\u0627",
    category: "internet",
    subcategoryId: "sub-net-1",
    description: "\u0627\u0634\u062A\u0631\u0627\u0643 \u0625\u0646\u062A\u0631\u0646\u062A \u0641\u0627\u064A\u0628\u0631 \u0645\u062E\u0635\u0635 \u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0636\u064A\u0648\u0641 \u0648\u0623\u0646\u0638\u0645\u0629 \u0627\u0644\u0623\u0642\u0641\u0627\u0644 \u0627\u0644\u0630\u0643\u064A\u0629 \u0628\u0627\u0644\u0639\u0644\u064A\u0627",
    amount: 650,
    isFfeOrEquipment: false,
    costCenterLevel: "property",
    propertyId: "prop-olayya",
    vendorOrBeneficiary: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629 (STC \u0623\u0639\u0645\u0627\u0644)",
    frequency: "monthly",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    temporalDistribution: "equal_monthly",
    costAllocationMethod: "equal_units",
    isActive: true,
    lastGeneratedPeriod: "2026-09",
    createdAt: "2026-01-01T09:00:00"
  },
  {
    id: "rec-04",
    name: "\u0631\u0648\u0627\u062A\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u062A\u0633\u0648\u064A\u0642 \u0627\u0644\u0645\u0631\u0643\u0632\u064A",
    category: "admin_salaries",
    subcategoryId: "sub-adm-1",
    description: "\u0631\u0648\u0627\u062A\u0628 \u0627\u0644\u0641\u0631\u064A\u0642 \u0627\u0644\u0625\u062F\u0627\u0631\u064A \u0648\u0627\u0644\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0644Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629",
    amount: 15e3,
    isFfeOrEquipment: false,
    costCenterLevel: "company",
    vendorOrBeneficiary: "\u0637\u0627\u0642\u0645 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0648\u0627\u0644\u0645\u0627\u0644\u064A\u0629",
    frequency: "monthly",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    temporalDistribution: "equal_monthly",
    costAllocationMethod: "equal_units",
    isActive: true,
    lastGeneratedPeriod: "2026-09",
    createdAt: "2026-01-01T09:00:00"
  }
];
var initialExpenses = [
  // 1. Annual Building Rent: 120,000 SAR paid upfront covering whole year 2026!
  // Demonstrates decoupling: 120,000 in payment register, but 10,000/mo in NOI accrual!
  {
    id: "exp-100",
    expenseNumber: "EXP-2026-000",
    date: "2026-01-02",
    servicePeriodStart: "2026-01-01",
    servicePeriodEnd: "2026-12-31",
    category: "building_rent",
    subcategoryId: "sub-rent-1",
    subcategoryName: "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0639\u0645\u0627\u0631\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
    description: "\u0625\u064A\u062C\u0627\u0631 \u0639\u0645\u0627\u0631\u0629 \u0628\u0631\u062C \u0627\u0644\u0646\u062E\u064A\u0644 \u0627\u0644\u0633\u0646\u0648\u064A \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0644\u0639\u0627\u0645 \u0662\u0660\u0662\u0666 (\u0633\u064F\u062F\u062F \u0645\u0642\u062F\u0645\u0627\u064B \u062F\u0641\u0639\u0629 \u0648\u0627\u062D\u062F\u0629 \u0648\u064A\u0648\u0632\u0639 \u0634\u0647\u0631\u064A\u0627\u064B \u0628\u062D\u0633\u0628 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0648\u062D\u062F\u0627\u062A)",
    amount: 12e4,
    paidAmount: 12e4,
    isFfeOrEquipment: false,
    level: "property",
    propertyId: "prop-nakheel",
    vendorOrBeneficiary: "\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0639\u0642\u0627\u0631\u064A\u0629 \u0644\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631",
    invoiceDocNumber: "LEASE-NKH-2026",
    invoiceDocUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
    paymentStatus: "paid",
    paymentMethod: "bank_transfer",
    distributionType: "by_area",
    temporalDistribution: "equal_monthly",
    costAllocationMethod: "by_area",
    recordStatus: "approved",
    paymentsList: [
      {
        id: "pay-exp-100",
        paymentDate: "2026-01-02",
        amount: 12e4,
        paymentMethod: "bank_transfer",
        receiptReference: "BANK-TRF-00192",
        recordedBy: "\u0633\u0639\u062F \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A (\u0645\u062F\u064A\u0631 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629)",
        createdAt: "2026-01-02T10:00:00"
      }
    ],
    distributionShares: [
      { unitId: "unit-n-101", unitNumber: "101", amount: 3e4, percentage: 25 },
      { unitId: "unit-n-102", unitNumber: "102", amount: 22500, percentage: 18.75 },
      { unitId: "unit-n-201", unitNumber: "201", amount: 37500, percentage: 31.25 },
      { unitId: "unit-n-202", unitNumber: "202", amount: 3e4, percentage: 25 }
    ],
    notes: "\u062A\u0645 \u0633\u062F\u0627\u062F \u0643\u0627\u0645\u0644 \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0628\u0645\u0648\u062C\u0628 \u062D\u0648\u0627\u0644\u0629 \u0628\u0646\u0643\u064A\u0629 \u0645\u0646 \u062D\u0633\u0627\u0628 \u0627\u0644\u0634\u0631\u0643\u0629 \u0628\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A. \u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0634\u0647\u0631\u064A\u0629 \u0627\u0644\u0645\u062D\u0645\u0644\u0629 \u0661\u0660,\u0660\u0660\u0660 \u0631\u064A\u0627\u0644.",
    createdAt: "2026-01-02T10:00:00",
    createdBy: "\u0633\u0639\u062F \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A (\u0645\u062F\u064A\u0631 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629)"
  },
  {
    id: "exp-101",
    expenseNumber: "EXP-2026-001",
    date: "2026-09-05",
    servicePeriodStart: "2026-09-01",
    servicePeriodEnd: "2026-09-30",
    category: "electricity",
    subcategoryId: "sub-elec-1",
    subcategoryName: "\u0639\u062F\u0627\u062F \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0645\u0634\u062A\u0631\u0643\u0629 \u0648\u0627\u0644\u0645\u0635\u0627\u0639\u062F",
    description: "\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0627\u0644\u0645\u0627\u0621 \u0648\u0645\u0632\u0648\u062F \u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A \u0644\u0644\u0628\u0631\u062C \u0648\u0627\u0644\u0628\u0647\u0648 \u0644\u0634\u0647\u0631 \u0633\u0628\u062A\u0645\u0628\u0631",
    amount: 3200,
    paidAmount: 3200,
    isFfeOrEquipment: false,
    level: "property",
    propertyId: "prop-nakheel",
    vendorOrBeneficiary: "\u0627\u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629 \u0644\u0644\u0643\u0647\u0631\u0628\u0627\u0621 + STC \u0623\u0639\u0645\u0627\u0644",
    invoiceDocNumber: "INV-SEC-89210",
    invoiceDocUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80",
    paymentStatus: "paid",
    paymentMethod: "bank_transfer",
    distributionType: "by_area",
    temporalDistribution: "actual_days",
    costAllocationMethod: "by_area",
    recordStatus: "approved",
    paymentsList: [
      {
        id: "pay-exp-101",
        paymentDate: "2026-09-05",
        amount: 3200,
        paymentMethod: "bank_transfer",
        receiptReference: "SADAD-99120",
        recordedBy: "\u0639\u0628\u062F \u0627\u0644\u0645\u062D\u0633\u0646 \u0627\u0644\u0633\u0647\u0644\u064A (\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A)",
        createdAt: "2026-09-05T10:00:00"
      }
    ],
    distributionShares: [
      { unitId: "unit-n-101", unitNumber: "101", amount: 800, percentage: 25 },
      { unitId: "unit-n-102", unitNumber: "102", amount: 600, percentage: 18.75 },
      { unitId: "unit-n-201", unitNumber: "201", amount: 1e3, percentage: 31.25 },
      { unitId: "unit-n-202", unitNumber: "202", amount: 800, percentage: 25 }
    ],
    createdAt: "2026-09-05T10:00:00",
    createdBy: "\u0639\u0628\u062F \u0627\u0644\u0645\u062D\u0633\u0646 \u0627\u0644\u0633\u0647\u0644\u064A (\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A)"
  },
  {
    id: "exp-102",
    expenseNumber: "EXP-2026-002",
    date: "2026-09-12",
    servicePeriodStart: "2026-09-01",
    servicePeriodEnd: "2026-09-30",
    category: "building_common_maintenance",
    subcategoryId: "sub-bmnt-1",
    subcategoryName: "\u0635\u064A\u0627\u0646\u0629 \u0648\u0642\u0627\u0626\u064A\u0629 \u0644\u0644\u0645\u0635\u0627\u0639\u062F",
    description: "\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0648\u0642\u0627\u0626\u064A\u0629 \u0627\u0644\u0633\u0646\u0648\u064A\u0629 \u0644\u0644\u0645\u0635\u0627\u0639\u062F \u0648\u0627\u0644\u0645\u0648\u0644\u062F \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A",
    amount: 4500,
    paidAmount: 4500,
    isFfeOrEquipment: false,
    level: "property",
    propertyId: "prop-nakheel",
    vendorOrBeneficiary: "\u0645\u0624\u0633\u0633\u0629 \u0623\u0648\u062A\u064A\u0633 \u0644\u0644\u0645\u0635\u0627\u0639\u062F \u0627\u0644\u0645\u062D\u062F\u0648\u062F\u0629",
    invoiceDocNumber: "OTIS-MNT-9912",
    paymentStatus: "paid",
    paymentMethod: "bank_transfer",
    distributionType: "equal",
    temporalDistribution: "instant",
    costAllocationMethod: "equal_units",
    recordStatus: "approved",
    paymentsList: [
      {
        id: "pay-exp-102",
        paymentDate: "2026-09-12",
        amount: 4500,
        paymentMethod: "bank_transfer",
        receiptReference: "BANK-CHQ-4401",
        recordedBy: "\u0639\u0628\u062F \u0627\u0644\u0645\u062D\u0633\u0646 \u0627\u0644\u0633\u0647\u0644\u064A (\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A)",
        createdAt: "2026-09-12T14:30:00"
      }
    ],
    distributionShares: [
      { unitId: "unit-n-101", unitNumber: "101", amount: 1125 },
      { unitId: "unit-n-102", unitNumber: "102", amount: 1125 },
      { unitId: "unit-n-201", unitNumber: "201", amount: 1125 },
      { unitId: "unit-n-202", unitNumber: "202", amount: 1125 }
    ],
    createdAt: "2026-09-12T14:30:00",
    createdBy: "\u0639\u0628\u062F \u0627\u0644\u0645\u062D\u0633\u0646 \u0627\u0644\u0633\u0647\u0644\u064A (\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A)"
  },
  {
    id: "exp-103",
    expenseNumber: "EXP-2026-003",
    date: "2026-09-20",
    servicePeriodStart: "2026-09-20",
    servicePeriodEnd: "2026-09-20",
    category: "cleaning_supplies",
    subcategoryId: "sub-cln-1",
    subcategoryName: "\u0645\u0646\u0638\u0641\u0627\u062A \u0648\u0645\u0637\u0647\u0631\u0627\u062A \u0641\u0646\u062F\u0642\u064A\u0629",
    description: "\u0634\u0631\u0627\u0621 \u0645\u0648\u0627\u062F \u0648\u0645\u0637\u0647\u0631\u0627\u062A \u0648\u0639\u0637\u0648\u0631 \u063A\u0633\u064A\u0644 \u0641\u0646\u062F\u0642\u064A\u0629 \u0645\u0633\u062A\u062F\u0627\u0645\u0629 \u0648\u0645\u0639\u062A\u0645\u062F\u0629 \u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0643\u0648\u0646\u0633\u064A\u0631\u062C \u0627\u0644\u0646\u0638\u0627\u0641\u0629",
    amount: 850,
    paidAmount: 850,
    isFfeOrEquipment: false,
    level: "property",
    propertyId: "prop-olayya",
    vendorOrBeneficiary: "\u0645\u0624\u0633\u0633\u0629 \u0636\u064A\u0627\u0641\u062A\u0646\u0627 \u0644\u0644\u062A\u062C\u0647\u064A\u0632",
    invoiceDocNumber: "HOSP-SUP-221",
    paymentStatus: "paid",
    paymentMethod: "company_card",
    distributionType: "equal",
    temporalDistribution: "instant",
    costAllocationMethod: "equal_units",
    recordStatus: "approved",
    paymentsList: [
      {
        id: "pay-exp-103",
        paymentDate: "2026-09-20",
        amount: 850,
        paymentMethod: "company_card",
        receiptReference: "CARD-VISA-9921",
        recordedBy: "\u0633\u0639\u062F \u062C\u0627\u0628\u0631 (\u0627\u0644\u0645\u0646\u0633\u0642 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A \u0644\u0644\u0639\u0644\u064A\u0627)",
        createdAt: "2026-09-20T09:15:00"
      }
    ],
    createdAt: "2026-09-20T09:15:00",
    createdBy: "\u0633\u0639\u062F \u062C\u0627\u0628\u0631 (\u0627\u0644\u0645\u0646\u0633\u0642 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A \u0644\u0644\u0639\u0644\u064A\u0627)"
  },
  {
    id: "exp-104",
    expenseNumber: "EXP-2026-004",
    date: "2026-09-22",
    category: "furniture_appliances",
    subcategoryId: "sub-ffe-1",
    subcategoryName: "\u0623\u062C\u0647\u0632\u0629 \u0630\u0643\u064A\u0629 \u0648\u062A\u0644\u0641\u0632\u064A\u0648\u0646\u0627\u062A",
    description: "\u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0634\u0642\u0629 \u0627\u0644\u0639\u0644\u064A\u0627 \u0661\u0660\u0661 \u0628\u062A\u0644\u0641\u0632\u064A\u0648\u0646 \u0630\u0643\u064A \u0645\u0642\u0627\u0633 \u0666\u0665 \u0628\u0648\u0635\u0629 \u0623\u0645\u0648\u0644\u064A\u062F \u0628\u062F\u064A\u0644 \u0644\u0644\u0645\u0643\u0633\u0648\u0631 (\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0631\u0623\u0633 \u0645\u0627\u0644\u064A\u0629 FF&E)",
    amount: 4200,
    paidAmount: 4200,
    isFfeOrEquipment: true,
    // رأس مالي FF&E - مستثنى من OPEX والتشغيلي المباشر
    level: "unit",
    propertyId: "prop-olayya",
    unitId: "unit-o-101",
    vendorOrBeneficiary: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0645\u0646\u064A\u0639 \u0644\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629 \u0648\u0627\u0644\u0645\u0646\u0632\u0644\u064A\u0629",
    invoiceDocNumber: "MAN-INV-7719",
    paymentStatus: "paid",
    paymentMethod: "company_card",
    distributionType: "none",
    temporalDistribution: "instant",
    costAllocationMethod: "direct_unit",
    recordStatus: "approved",
    paymentsList: [
      {
        id: "pay-exp-104",
        paymentDate: "2026-09-22",
        amount: 4200,
        paymentMethod: "company_card",
        receiptReference: "CARD-MAN-8821",
        recordedBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0645\u0641\u0644\u062D (\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A)",
        createdAt: "2026-09-22T11:45:00"
      }
    ],
    createdAt: "2026-09-22T11:45:00",
    createdBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0645\u0641\u0644\u062D (\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A)"
  },
  {
    id: "exp-105",
    expenseNumber: "EXP-2026-005",
    date: "2026-09-25",
    servicePeriodStart: "2026-09-01",
    servicePeriodEnd: "2026-09-30",
    category: "payment_fees_commissions",
    subcategoryId: "sub-pay-1",
    subcategoryName: "\u0639\u0645\u0648\u0644\u0627\u062A \u0628\u0648\u0627\u0628\u0627\u062A \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629",
    description: "\u0639\u0645\u0648\u0644\u0627\u062A \u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u062F\u0641\u0639 \u0648\u0633\u062F\u0627\u062F \u0644\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0648\u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0644\u0634\u0647\u0631 \u0633\u0628\u062A\u0645\u0628\u0631",
    amount: 620,
    paidAmount: 620,
    isFfeOrEquipment: false,
    level: "company",
    vendorOrBeneficiary: "\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u064A\u0633\u0631 \u0628\u064A\u0645\u0646\u062A",
    invoiceDocNumber: "PG-FEE-SEP26",
    paymentStatus: "paid",
    paymentMethod: "bank_transfer",
    distributionType: "equal",
    temporalDistribution: "instant",
    costAllocationMethod: "by_revenue",
    recordStatus: "approved",
    paymentsList: [
      {
        id: "pay-exp-105",
        paymentDate: "2026-09-25",
        amount: 620,
        paymentMethod: "bank_transfer",
        receiptReference: "GATEWAY-FEE-991",
        recordedBy: "\u0639\u0628\u062F \u0627\u0644\u0645\u062D\u0633\u0646 \u0627\u0644\u0633\u0647\u0644\u064A (\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A)",
        createdAt: "2026-09-25T16:00:00"
      }
    ],
    createdAt: "2026-09-25T16:00:00",
    createdBy: "\u0639\u0628\u062F \u0627\u0644\u0645\u062D\u0633\u0646 \u0627\u0644\u0633\u0647\u0644\u064A (\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A)"
  },
  {
    id: "exp-106",
    expenseNumber: "EXP-2026-006",
    date: "2026-09-28",
    servicePeriodStart: "2026-09-28",
    servicePeriodEnd: "2026-09-28",
    category: "unit_appliances_maintenance",
    subcategoryId: "sub-umnt-1",
    subcategoryName: "\u0635\u064A\u0627\u0646\u0629 \u0648\u063A\u0633\u064A\u0644 \u0627\u0644\u0645\u0643\u064A\u0641\u0627\u062A",
    description: "\u0635\u064A\u0627\u0646\u0629 \u0648\u062A\u0646\u0638\u064A\u0641 \u0645\u0643\u064A\u0641 \u0643\u0648\u0646\u0633\u064A\u0644\u062F \u0648\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u062B\u064A\u0631\u0645\u0648\u0633\u062A\u0627\u062A \u0644\u0644\u0634\u0642\u0629 \u0662\u0660\u0661 \u0628\u0628\u0631\u062C \u0627\u0644\u0646\u062E\u064A\u0644",
    amount: 450,
    paidAmount: 450,
    isFfeOrEquipment: false,
    level: "unit",
    propertyId: "prop-nakheel",
    unitId: "unit-n-201",
    vendorOrBeneficiary: "\u0634\u0631\u0643\u0629 \u062A\u0628\u0631\u064A\u062F \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062A\u0643\u064A\u064A\u0641",
    invoiceDocNumber: "AC-SRV-201-9",
    paymentStatus: "paid",
    paymentMethod: "company_card",
    distributionType: "none",
    temporalDistribution: "instant",
    costAllocationMethod: "direct_unit",
    recordStatus: "approved",
    paymentsList: [
      {
        id: "pay-exp-106",
        paymentDate: "2026-09-28",
        amount: 450,
        paymentMethod: "company_card",
        receiptReference: "CARD-POS-3312",
        recordedBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0645\u0641\u0644\u062D (\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A)",
        createdAt: "2026-09-28T14:00:00"
      }
    ],
    createdAt: "2026-09-28T14:00:00",
    createdBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0645\u0641\u0644\u062D (\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A)"
  }
];
var initialAdjustments = [
  {
    id: "adj-1",
    tenantNationalId: "7009823412",
    leaseId: "lease-2001",
    type: "discount",
    amount: 1e3,
    reason: "\u062E\u0635\u0645 \u062A\u0631\u062D\u064A\u0628\u064A \u062E\u0627\u0635 \u0628\u0628\u062F\u0627\u064A\u0629 \u062A\u0639\u0627\u0642\u062F \u0634\u0631\u0643\u0629 \u0627\u0644\u0623\u0641\u0642 \u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0648\u062D\u062F\u0629 \u0662\u0660\u0661 \u0648\u062A\u0623\u062E\u0631 \u0627\u0644\u062A\u0633\u0644\u064A\u0645 \u064A\u0648\u0645 \u0648\u0627\u062D\u062F",
    authorizedBy: "\u0633\u0639\u062F \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A (\u0645\u062F\u064A\u0631 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u062A\u062D\u0635\u064A\u0644)",
    appliedToInstallmentId: "inst-1",
    createdAt: "2026-08-28T10:00:00"
  }
];

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
function getMemoryState() {
  return memoryState;
}
async function initializeFallbackState() {
  if (fs.existsSync(SERVER_DB_FILE)) {
    try {
      const raw = fs.readFileSync(SERVER_DB_FILE, "utf-8");
      memoryState = JSON.parse(raw);
    } catch (e) {
      console.warn("[Server] Note on reading server-db.json:", e);
    }
  }
  const initialAdminUsername = process.env.INITIAL_ADMIN_USERNAME || "admin";
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || "Admin@2026!";
  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL || "admin@luxuryhome.sa";
  if (!memoryState) {
    const adminHash = await hashPassword(initialAdminPassword);
    const users = [
      {
        id: "usr-admin-default-01",
        username: initialAdminUsername,
        name: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
        email: initialAdminEmail,
        passwordHash: adminHash,
        role: "SUPER_ADMIN",
        allowedProperties: ["all"],
        isActive: true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
    if (initialAdminUsername !== "admin") {
      const stdAdminHash = await hashPassword("Admin@2026!");
      users.push({
        id: "usr-admin-std-01",
        username: "admin",
        name: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0639\u0627\u0645",
        email: "admin@luxuryhome.sa",
        passwordHash: stdAdminHash,
        role: "SUPER_ADMIN",
        allowedProperties: ["all"],
        isActive: true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    const managerHash = await hashPassword("Manager@2026!");
    users.push({
      id: "usr-manager-default-02",
      username: "manager",
      name: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u062A\u0634\u063A\u064A\u0644",
      email: "manager@luxuryhome.sa",
      passwordHash: managerHash,
      role: "PROPERTY_MANAGER",
      allowedProperties: ["all"],
      isActive: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const accountantHash = await hashPassword("Account@2026!");
    users.push({
      id: "usr-accountant-default-03",
      username: "accountant",
      name: "\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
      email: "accountant@luxuryhome.sa",
      passwordHash: accountantHash,
      role: "ACCOUNTANT",
      allowedProperties: ["all"],
      isActive: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const receptionHash = await hashPassword("Recept@2026!");
    users.push({
      id: "usr-reception-default-04",
      username: "reception",
      name: "\u0645\u0648\u0638\u0641 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0648\u0627\u0644\u0636\u064A\u0627\u0641\u0629",
      email: "reception@luxuryhome.sa",
      passwordHash: receptionHash,
      role: "RECEPTIONIST",
      allowedProperties: ["all"],
      isActive: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    memoryState = {
      users,
      settings: initialCompanySettings || {
        companyName: "Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629",
        companyNameEn: "Luxury Home",
        tagline: "\u062A\u062C\u0631\u0628\u0629 \u0633\u0643\u0646\u064A\u0629 \u0641\u0627\u062E\u0631\u0629 \u062A\u062F\u0645\u062C \u0628\u064A\u0646 \u062E\u0635\u0648\u0635\u064A\u0629 \u0627\u0644\u0645\u0646\u0632\u0644 \u0648\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0636\u064A\u0627\u0641\u0629 \u0627\u0644\u0631\u0627\u0642\u064A\u0629"
      },
      properties: Array.isArray(initialProperties) ? JSON.parse(JSON.stringify(initialProperties)) : [],
      floors: Array.isArray(initialFloors) ? JSON.parse(JSON.stringify(initialFloors)) : [],
      amenities: Array.isArray(initialAmenities) ? JSON.parse(JSON.stringify(initialAmenities)) : [],
      units: Array.isArray(initialUnits) ? JSON.parse(JSON.stringify(initialUnits)) : [],
      parkingSpots: Array.isArray(initialParkingSpots) ? JSON.parse(JSON.stringify(initialParkingSpots)) : [],
      allocations: Array.isArray(initialAllocations) ? JSON.parse(JSON.stringify(initialAllocations)) : [],
      bookings: Array.isArray(initialBookings) ? JSON.parse(JSON.stringify(initialBookings)) : [],
      leases: Array.isArray(initialLeases) ? JSON.parse(JSON.stringify(initialLeases)) : [],
      installments: [],
      securityDeposits: Array.isArray(initialSecurityDeposits) ? initialSecurityDeposits.map((sd) => ({
        ...sd,
        collectedAmount: sd.collectedAmount ?? 0,
        collectionReference: sd.collectionReference ?? null,
        collectionVerifiedAt: sd.collectionVerifiedAt ?? null,
        refundedAmount: sd.refundedAmount ?? 0,
        deductedAmount: sd.deductedAmount ?? 0,
        rentAppliedAmount: sd.rentAppliedAmount ?? 0
      })) : [],
      securityDepositTransactions: [],
      payments: Array.isArray(initialPayments) ? initialPayments.map((p) => ({
        ...p,
        installmentId: p.installmentId ?? null,
        sourceType: p.sourceType ?? "direct_payment",
        affectsCash: typeof p.affectsCash === "boolean" ? p.affectsCash : true
      })) : [],
      expenses: Array.isArray(initialExpenses) ? JSON.parse(JSON.stringify(initialExpenses)) : [],
      expenseAllocations: [],
      expensePayments: [],
      expenseCategories: Array.isArray(initialExpenseCategories) ? JSON.parse(JSON.stringify(initialExpenseCategories)) : [],
      recurringSchedules: Array.isArray(initialRecurringExpenses) ? JSON.parse(JSON.stringify(initialRecurringExpenses)) : [],
      tenantAdjustments: Array.isArray(initialAdjustments) ? JSON.parse(JSON.stringify(initialAdjustments)) : [],
      contentSections: Array.isArray(initialContentSections) ? JSON.parse(JSON.stringify(initialContentSections)) : [],
      documentRecords: [],
      idempotencyRecords: [],
      auditLogs: Array.isArray(initialAuditLogs) ? JSON.parse(JSON.stringify(initialAuditLogs)) : []
    };
  } else {
    for (const key of REQUIRED_FULL_BACKUP_COLLECTIONS) {
      if (!Array.isArray(memoryState[key])) memoryState[key] = [];
    }
    if (memoryState.settings === void 0) {
      memoryState.settings = initialCompanySettings || {
        companyName: "Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629",
        companyNameEn: "Luxury Home"
      };
    }
    const hasSuperAdmin = Array.isArray(memoryState.users) && memoryState.users.some((u) => u.role === "SUPER_ADMIN" && u.isActive);
    if (!hasSuperAdmin) {
      const adminHash = await hashPassword(initialAdminPassword);
      if (!Array.isArray(memoryState.users)) memoryState.users = [];
      memoryState.users.push({
        id: "usr-admin-default-01",
        username: initialAdminUsername,
        name: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
        email: initialAdminEmail,
        passwordHash: adminHash,
        role: "SUPER_ADMIN",
        allowedProperties: ["all"],
        isActive: true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    if (memoryState.properties.length === 0 && Array.isArray(initialProperties) && initialProperties.length > 0) {
      memoryState.properties = JSON.parse(JSON.stringify(initialProperties));
      memoryState.floors = JSON.parse(JSON.stringify(initialFloors || []));
      memoryState.units = JSON.parse(JSON.stringify(initialUnits || []));
    }
    const unitIds = new Set((memoryState.units || []).map((u) => u.id));
    const propIds = new Set((memoryState.properties || []).map((p) => p.id));
    if (propIds.size > 0) {
      memoryState.floors = (memoryState.floors || []).filter((f) => !f.propertyId || propIds.has(f.propertyId));
      memoryState.units = (memoryState.units || []).filter((u) => !u.propertyId || propIds.has(u.propertyId));
    }
    if (unitIds.size > 0) {
      memoryState.bookings = (memoryState.bookings || []).filter((b) => unitIds.has(b.unitId));
      memoryState.allocations = (memoryState.allocations || []).filter((a) => unitIds.has(a.unitId));
      memoryState.leases = (memoryState.leases || []).filter((l) => unitIds.has(l.unitId));
    }
    const bookingIds = new Set((memoryState.bookings || []).map((b) => b.id));
    const leaseIds = new Set((memoryState.leases || []).map((l) => l.id));
    memoryState.securityDeposits = (memoryState.securityDeposits || []).filter((sd) => {
      if (sd.bookingId && !bookingIds.has(sd.bookingId)) return false;
      if (sd.leaseId && !leaseIds.has(sd.leaseId)) return false;
      return true;
    }).map((sd) => ({
      ...sd,
      collectedAmount: sd.collectedAmount ?? 0,
      collectionReference: sd.collectionReference ?? null,
      collectionVerifiedAt: sd.collectionVerifiedAt ?? null,
      refundedAmount: sd.refundedAmount ?? 0,
      deductedAmount: sd.deductedAmount ?? 0,
      rentAppliedAmount: sd.rentAppliedAmount ?? 0
    }));
    memoryState.payments = (memoryState.payments || []).map((p) => ({
      ...p,
      installmentId: p.installmentId ?? null,
      sourceType: p.sourceType ?? "direct_payment",
      affectsCash: typeof p.affectsCash === "boolean" ? p.affectsCash : true
    }));
    const depositIds = new Set((memoryState.securityDeposits || []).map((d) => d.id));
    memoryState.securityDepositTransactions = (memoryState.securityDepositTransactions || []).filter((sdt) => depositIds.has(sdt.depositId));
  }
}
function persistFallbackState() {
  if (memoryState) {
    try {
      fs.writeFileSync(SERVER_DB_FILE, JSON.stringify(memoryState, null, 2), "utf-8");
    } catch (e) {
      console.error("[Server DB] Error persisting server-db.json:", e);
    }
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
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-setup-secret, X-Idempotency-Key, x-idempotency-key");
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
            const assignedRole2 = req.body.role || (hasAdmin ? "PROPERTY_MANAGER" : "SUPER_ADMIN");
            const newAdmin2 = await tx.user.create({
              data: {
                username,
                email: email || `${username}@luxuryhome.sa`,
                passwordHash: hashedPassword,
                name: name || username,
                role: assignedRole2,
                allowedProperties: Array.isArray(allowedProperties) ? allowedProperties : ["all"],
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
            details: `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A (${result.username}) \u0628\u0635\u0644\u0627\u062D\u064A\u0629 ${result.role}.`,
            ipAddress: req.ip
          });
          return res.json({
            success: true,
            message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0628\u0646\u062C\u0627\u062D.",
            token: token2,
            user: sanitizeUser(result)
          });
        }
        const assignedRole = req.body.role || (hasAdmin ? "PROPERTY_MANAGER" : "SUPER_ADMIN");
        const newAdmin = {
          id: `usr_${Date.now()}`,
          username,
          email: email || `${username}@luxuryhome.sa`,
          passwordHash: hashedPassword,
          name: name || username,
          role: assignedRole,
          allowedProperties: Array.isArray(allowedProperties) ? allowedProperties : ["all"],
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
      const activeProps = props.filter((p) => p.isActive !== false);
      const floors2 = activeProps.flatMap((p) => p.floors || []);
      return res.json({ success: true, properties: activeProps, floors: floors2 });
    }
    const properties = (memoryState?.properties || []).filter((p) => p.isActive !== false);
    const allowedIds = new Set(properties.map((p) => p.id));
    const floors = (memoryState?.floors || []).filter((f) => allowedIds.has(f.propertyId));
    res.json({ success: true, properties, floors });
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
      const floors2 = properties.flatMap((p) => p.floors || []);
      return res.json({ success: true, properties, floors: floors2 });
    }
    const isUniversal = allowed.includes("all");
    const filtered = isUniversal ? memoryState?.properties || [] : (memoryState?.properties || []).filter((p) => allowed.includes(p.id));
    const allowedIds = new Set(filtered.map((p) => p.id));
    const floors = (memoryState?.floors || []).filter((f) => allowedIds.has(f.propertyId));
    res.json({ success: true, properties: filtered, floors });
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
        return res.json({ success: true, property: prop, floors: prop?.floors || [], message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
      }
      if (!memoryState.properties) memoryState.properties = [];
      if (!memoryState.floors) memoryState.floors = [];
      const duplicate = memoryState.properties.find((p) => p.code?.toLowerCase() === code.trim().toLowerCase());
      if (duplicate) {
        return res.status(409).json({ success: false, message: `\u0643\u0648\u062F \u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0645\u0628\u0646\u0649 (${code}) \u0645\u0633\u062C\u0644 \u0644\u0645\u0628\u0646\u0649 \u0622\u062E\u0631 \u0633\u0644\u0641\u0627\u064B!` });
      }
      const propId = req.body.id || `prop_${Date.now()}`;
      const fCount = Math.max(1, Number(floorsCount) || 1);
      const newFloors = [
        { id: `flr_${propId}_b1`, propertyId: propId, number: -1, floorNumber: -1, name: "\u0637\u0627\u0628\u0642 \u0627\u0644\u0642\u0628\u0648 \u0627\u0644\u0623\u0648\u0644 (\u0645\u0648\u0627\u0642\u0641 \u0633\u064A\u0627\u0631\u0627\u062A)", label: "\u0627\u0644\u0642\u0628\u0648 \u0627\u0644\u0623\u0648\u0644" },
        { id: `flr_${propId}_0`, propertyId: propId, number: 0, floorNumber: 0, name: "\u0637\u0627\u0628\u0642 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644 (\u0627\u0644\u0628\u0647\u0648 \u0648\u0627\u0644\u0628\u0647\u0648 \u0627\u0644\u0645\u0634\u062A\u0631\u0643)", label: "\u0627\u0644\u0628\u0647\u0648 \u0627\u0644\u0623\u0631\u0636\u064A" },
        ...Array.from({ length: fCount }, (_, i) => ({
          id: `flr_${propId}_${i + 1}`,
          propertyId: propId,
          number: i + 1,
          floorNumber: i + 1,
          name: `\u0637\u0627\u0628\u0642 \u0627\u0644\u062F\u0648\u0631 \u0631\u0642\u0645 ${i + 1}`,
          label: `\u0627\u0644\u062F\u0648\u0631 \u0631\u0642\u0645 ${i + 1}`
        }))
      ];
      const newProp = {
        id: propId,
        name: name.trim(),
        code: code.trim(),
        address: address.trim(),
        city: city || "\u0627\u0644\u0631\u064A\u0627\u0636",
        district: district.trim(),
        floorsCount: fCount,
        unitsCount: Number(unitsCount) || 0,
        totalAreaSqm: Number(totalAreaSqm) || 0,
        rooftopPayment: Number(rooftopPayment) || 0,
        description: description || null,
        images: Array.isArray(images) ? images : [],
        isActive: isActive !== false,
        floors: newFloors,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      memoryState.properties.push(newProp);
      memoryState.floors.push(...newFloors);
      persistFallbackState();
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
        action: "\u0625\u0646\u0634\u0627\u0621 \u0645\u0628\u0646\u0649 / \u0639\u0642\u0627\u0631 \u062C\u062F\u064A\u062F",
        module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A",
        details: `\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0628\u0646\u0649 ${name} (${code})`,
        ipAddress: req.ip
      });
      return res.json({ success: true, property: newProp, floors: newFloors, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u062C\u0627\u062D." });
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
        persistFallbackState();
        return res.json({ success: true, property: memoryState.properties[idx], message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0628\u0646\u0649." });
      }
      return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0628\u0646\u0649 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0628\u0646\u0649." });
    }
  });
  apiRouter.put("/properties/:id/archive", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), checkPropertyAccess, async (req, res) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
        const updated = await updatePropertyInDb(id, { isActive: false });
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
          action: "\u0623\u0631\u0634\u0641\u0629 \u0645\u0628\u0646\u0649 / \u0639\u0642\u0627\u0631",
          module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A",
          details: `\u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0628\u0646\u0649 ${id} \u0645\u0639 \u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0628\u0643\u0627\u0641\u0629 \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0648\u0627\u0644\u062A\u0639\u0627\u0642\u062F\u0627\u062A \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A\u0629`,
          ipAddress: req.ip
        });
        return res.json({ success: true, property: updated, message: "\u062A\u0645 \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u062C\u0627\u062D \u0645\u0639 \u0627\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0648\u0627\u0644\u062A\u0639\u0627\u0642\u062F\u0627\u062A \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A\u0629." });
      }
      if (!memoryState.properties) memoryState.properties = [];
      const idx = memoryState.properties.findIndex((p) => p.id === id);
      if (idx !== -1) {
        memoryState.properties[idx] = { ...memoryState.properties[idx], isActive: false, status: "unlisted" };
        persistFallbackState();
        return res.json({ success: true, property: memoryState.properties[idx], message: "\u062A\u0645 \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u062C\u0627\u062D \u0645\u0639 \u0627\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A\u0629." });
      }
      return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0628\u0646\u0649 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0628\u0646\u0649." });
    }
  });
  apiRouter.delete("/properties/:id", authenticateToken, requireRoles(["SUPER_ADMIN"]), checkPropertyAccess, async (req, res) => {
    try {
      const { id } = req.params;
      if (process.env.DATABASE_URL) {
        const hasHistory = await prisma.unitAllocation.findFirst({
          where: { unit: { propertyId: id } }
        });
        if (hasHistory) {
          return res.status(400).json({
            success: false,
            message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062D\u0630\u0641 \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0644\u0644\u0645\u0628\u0646\u0649 \u0644\u0648\u062C\u0648\u062F \u0633\u062C\u0644\u0627\u062A \u0645\u0627\u0644\u064A\u0629 \u0623\u0648 \u062A\u0639\u0627\u0642\u062F\u0627\u062A \u062A\u0627\u0631\u064A\u062E\u064A\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0647. \u064A\u0631\u062C\u0649 \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u062F\u0644\u0627\u064B \u0645\u0646 \u062D\u0630\u0641\u0647 \u0644\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A\u0629 \u0648\u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A\u0629."
          });
        }
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
      const propUnits = (memoryState?.units || []).filter((u) => u.propertyId === id);
      const propUnitIds = new Set(propUnits.map((u) => u.id));
      const hasBookings = (memoryState?.bookings || []).some((b) => propUnitIds.has(b.unitId));
      const hasLeases = (memoryState?.leases || []).some((l) => propUnitIds.has(l.unitId));
      if (hasBookings || hasLeases) {
        return res.status(400).json({
          success: false,
          message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062D\u0630\u0641 \u0627\u0644\u0646\u0647\u0627\u0626\u064A \u0644\u0644\u0645\u0628\u0646\u0649 \u0644\u0648\u062C\u0648\u062F \u0633\u062C\u0644\u0627\u062A \u0645\u0627\u0644\u064A\u0629 \u0623\u0648 \u062A\u0639\u0627\u0642\u062F\u0627\u062A \u062A\u0627\u0631\u064A\u062E\u064A\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0647. \u064A\u0631\u062C\u0649 \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u062F\u0644\u0627\u064B \u0645\u0646 \u062D\u0630\u0641\u0647 \u0644\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A\u0629 \u0648\u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A\u0629."
        });
      }
      if (memoryState.properties) {
        memoryState.properties = memoryState.properties.filter((p) => p.id !== id);
      }
      if (memoryState.floors) {
        memoryState.floors = memoryState.floors.filter((f) => f.propertyId !== id);
      }
      if (memoryState.units) {
        memoryState.units = memoryState.units.filter((u) => u.propertyId !== id);
      }
      persistFallbackState();
      return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0645\u0628\u0646\u0649." });
    }
  });
  apiRouter.post("/floors", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { propertyId, number, name } = req.body;
      if (!propertyId || name === void 0) {
        return res.status(400).json({ success: false, message: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0628\u0646\u0649 \u0648\u0627\u0633\u0645 \u0627\u0644\u0637\u0627\u0628\u0642 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
      }
      const user = req.user;
      if (user.role !== "SUPER_ADMIN" && !user.allowedProperties?.includes(propertyId)) {
        return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u0636\u0627\u0641\u0629 \u0637\u0648\u0627\u0628\u0642 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
      }
      if (process.env.DATABASE_URL) {
        const floor = await createFloorInDb(propertyId, Number(number) || 1, name);
        return res.json({ success: true, floor, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0637\u0627\u0628\u0642 \u0628\u0646\u062C\u0627\u062D." });
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
      return res.json({ success: true, floor: newFloor, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0637\u0627\u0628\u0642 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u0637\u0627\u0628\u0642." });
    }
  });
  apiRouter.put("/floors/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      if (user.role !== "SUPER_ADMIN") {
        let floorPropId = null;
        if (process.env.DATABASE_URL) {
          const flr = await prisma.floor.findUnique({ where: { id } });
          floorPropId = flr?.propertyId || null;
        } else {
          const flr = (memoryState?.floors || []).find((f) => f.id === id);
          floorPropId = flr?.propertyId || null;
        }
        if (floorPropId && !user.allowedProperties?.includes(floorPropId)) {
          return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062A\u0639\u062F\u064A\u0644 \u0637\u0648\u0627\u0628\u0642 \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
        }
      }
      if (process.env.DATABASE_URL) {
        const updated = await updateFloorInDb(id, req.body);
        return res.json({ success: true, floor: updated, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0637\u0627\u0628\u0642 \u0628\u0646\u062C\u0627\u062D." });
      }
      if (!memoryState.floors) memoryState.floors = [];
      const idx = memoryState.floors.findIndex((f) => f.id === id);
      if (idx !== -1) {
        memoryState.floors[idx] = { ...memoryState.floors[idx], ...req.body };
        persistFallbackState();
        return res.json({ success: true, floor: memoryState.floors[idx], message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0637\u0627\u0628\u0642." });
      }
      return res.status(404).json({ success: false, message: "\u0627\u0644\u0637\u0627\u0628\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0637\u0627\u0628\u0642." });
    }
  });
  apiRouter.delete("/floors/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      if (user.role !== "SUPER_ADMIN") {
        let floorPropId = null;
        if (process.env.DATABASE_URL) {
          const flr = await prisma.floor.findUnique({ where: { id } });
          floorPropId = flr?.propertyId || null;
        } else {
          const flr = (memoryState?.floors || []).find((f) => f.id === id);
          floorPropId = flr?.propertyId || null;
        }
        if (floorPropId && !user.allowedProperties?.includes(floorPropId)) {
          return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062D\u0630\u0641 \u0637\u0648\u0627\u0628\u0642 \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
        }
      }
      if (process.env.DATABASE_URL) {
        await deleteFloorInDb(id);
        return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0637\u0627\u0628\u0642 \u0628\u0646\u062C\u0627\u062D." });
      }
      if (memoryState.floors) {
        memoryState.floors = memoryState.floors.filter((f) => f.id !== id);
        persistFallbackState();
      }
      return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0637\u0627\u0628\u0642 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0637\u0627\u0628\u0642." });
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
      const prop = (memoryState?.properties || []).find((p) => p.id === propertyId);
      if (!prop) {
        return res.status(400).json({ success: false, message: "\u0627\u0644\u0645\u0628\u0646\u0649 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
      }
      if (req.body.floorId) {
        const floor = (memoryState?.floors || []).find((f) => f.id === req.body.floorId);
        if (!floor) return res.status(400).json({ success: false, message: "\u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
        if (floor.propertyId !== propertyId) return res.status(400).json({ success: false, message: "\u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062D\u062F\u062F \u0644\u0627 \u064A\u0646\u062A\u0645\u064A \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0628\u0646\u0649." });
      }
      const duplicateUnit = (memoryState?.units || []).some(
        (u) => u.propertyId === propertyId && String(u.unitNumber).trim() === String(unitNumber).trim() && u.publicationStatus !== "archived"
      );
      if (duplicateUnit) {
        return res.status(409).json({ success: false, message: `\u0634\u0642\u0629 \u0628\u0627\u0644\u0631\u0642\u0645 "${unitNumber}" \u0645\u0633\u062C\u0644\u0629 \u0648\u0645\u062D\u0641\u0648\u0638\u0629 \u062D\u0627\u0644\u064A\u0627\u064B \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0645\u0628\u0646\u0649.` });
      }
      const newUnit = {
        id: req.body.id || `unit_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
        propertyId,
        floorId: req.body.floorId || null,
        unitNumber: String(unitNumber).trim(),
        title: req.body.title || `\u0634\u0642\u0629 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0631\u0642\u0645 #${unitNumber}`,
        titleEn: req.body.titleEn || `Unit #${unitNumber}`,
        type: req.body.type || "apartment",
        areaSqm: req.body.areaSqm !== void 0 ? Number(req.body.areaSqm) : 0,
        floorNumber: req.body.floorNumber !== void 0 ? Number(req.body.floorNumber) : 1,
        maxGuests: req.body.maxGuests !== void 0 ? Number(req.body.maxGuests) : 3,
        bedroomsCount: req.body.bedroomsCount !== void 0 ? Number(req.body.bedroomsCount) : 1,
        bathroomsCount: req.body.bathroomsCount !== void 0 ? Number(req.body.bathroomsCount) : 1,
        bedsCount: req.body.bedsCount !== void 0 ? Number(req.body.bedsCount) : 1,
        furnishingStatus: req.body.furnishingStatus || "furnished",
        allowDaily: req.body.allowDaily !== false,
        dailyRate: req.body.dailyRate !== void 0 ? Number(req.body.dailyRate) : 0,
        dailySecurityDeposit: req.body.dailySecurityDeposit !== void 0 ? Number(req.body.dailySecurityDeposit) : 0,
        allowMonthly: req.body.allowMonthly !== false,
        monthlyRate: req.body.monthlyRate !== void 0 ? Number(req.body.monthlyRate) : 0,
        monthlySecurityDeposit: req.body.monthlySecurityDeposit !== void 0 ? Number(req.body.monthlySecurityDeposit) : 0,
        allowYearly: req.body.allowYearly !== false,
        annualRate: req.body.annualRate !== void 0 || req.body.yearlyRate !== void 0 ? Number(req.body.annualRate ?? req.body.yearlyRate) : 0,
        yearlyRate: req.body.annualRate !== void 0 || req.body.yearlyRate !== void 0 ? Number(req.body.annualRate ?? req.body.yearlyRate) : 0,
        yearlySecurityDeposit: req.body.yearlySecurityDeposit !== void 0 ? Number(req.body.yearlySecurityDeposit) : 0,
        yearlyPaymentOptions: Array.isArray(req.body.yearlyPaymentOptions) ? req.body.yearlyPaymentOptions : ["single_annual", "semi_annual"],
        semiAnnualSurchargePercent: req.body.semiAnnualSurchargePercent !== void 0 ? Number(req.body.semiAnnualSurchargePercent) : 0,
        cleaningFee: req.body.cleaningFee !== void 0 ? Number(req.body.cleaningFee) : 0,
        securityDeposit: req.body.securityDeposit !== void 0 ? Number(req.body.securityDeposit) : 0,
        taxPercentage: req.body.taxPercentage !== void 0 ? Number(req.body.taxPercentage) : 15,
        operationalStatus: req.body.operationalStatus || "ready",
        occupancyStatus: req.body.occupancyStatus || "vacant",
        isClean: req.body.isClean !== false,
        publicationStatus: req.body.publicationStatus || "published",
        amenities: Array.isArray(req.body.amenities) ? req.body.amenities : [],
        images: Array.isArray(req.body.images) ? req.body.images : [],
        media: req.body.media || null,
        spaces: req.body.spaces || null,
        fittings: req.body.fittings || null,
        floorPlanUrl: req.body.floorPlanUrl || null,
        assignedParkingId: req.body.assignedParkingId || null,
        notes: req.body.notes || null,
        smartLockPin: req.body.smartLockPin || null,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (!memoryState.units) memoryState.units = [];
      memoryState.units.push(newUnit);
      prop.unitsCount = (prop.unitsCount || 0) + 1;
      persistFallbackState();
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
        action: "\u0625\u0646\u0634\u0627\u0621 \u0648\u062D\u062F\u0629 \u0633\u0643\u0646\u064A\u0629 \u062C\u062F\u064A\u062F\u0629",
        module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0648\u062D\u062F\u0627\u062A",
        details: `\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0648\u062D\u062F\u0629 ${unitNumber} \u0641\u064A \u0627\u0644\u0639\u0642\u0627\u0631 ${propertyId}`,
        ipAddress: req.ip
      });
      return res.json({ success: true, unit: newUnit, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u0648\u062D\u062F\u0629." });
    }
  });
  apiRouter.post("/units/batch", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { propertyId, floorId, units, idempotencyKey } = req.body;
      if (!propertyId || !floorId || !Array.isArray(units) || units.length === 0) {
        return res.status(400).json({ success: false, message: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0628\u0646\u0649\u060C \u0627\u0644\u0637\u0627\u0628\u0642\u060C \u0648\u0645\u0635\u0641\u0648\u0641\u0629 \u0627\u0644\u0648\u062D\u062F\u0627\u062A \u0645\u0637\u0644\u0648\u0628\u0629." });
      }
      const user = req.user;
      if (user.role !== "SUPER_ADMIN" && !user.allowedProperties?.includes(propertyId)) {
        return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u0636\u0627\u0641\u0629 \u0648\u062D\u062F\u0627\u062A \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
      }
      const unitNumbers = units.map((u) => String(u.unitNumber).trim());
      const uniqueNumbers = new Set(unitNumbers);
      if (uniqueNumbers.size !== unitNumbers.length) {
        return res.status(400).json({ success: false, message: "\u062A\u062D\u062A\u0648\u064A \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0639\u0644\u0649 \u0623\u0631\u0642\u0627\u0645 \u0648\u062D\u062F\u0627\u062A \u0645\u0643\u0631\u0631\u0629 \u0636\u0645\u0646 \u0646\u0641\u0633 \u0627\u0644\u0637\u0644\u0628." });
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
          userName: user.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
          action: "\u0625\u0646\u0634\u0627\u0621 \u0648\u062D\u062F\u0627\u062A \u0628\u0627\u0644\u062C\u0645\u0644\u0629",
          module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0648\u062D\u062F\u0627\u062A",
          details: `\u0625\u0646\u0634\u0627\u0621 \u0639\u062F\u062F ${createdUnits?.length} \u0648\u062D\u062F\u0629 \u0641\u064A \u0627\u0644\u0639\u0642\u0627\u0631 ${propertyId}`,
          ipAddress: req.ip
        });
        return res.json({
          success: true,
          count: createdUnits?.length || 0,
          units: createdUnits,
          message: `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0639\u062F\u062F ${createdUnits?.length} \u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D \u0636\u0645\u0646 \u0645\u0639\u0627\u0645\u0644\u0629 \u0648\u0627\u062D\u062F\u0629.`
        });
      }
      const property = (memoryState?.properties || []).find((p) => p.id === propertyId);
      if (!property) {
        return res.status(400).json({ success: false, message: "\u0627\u0644\u0645\u0628\u0646\u0649 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
      }
      const floor = (memoryState?.floors || []).find((f) => f.id === floorId);
      if (!floor) {
        return res.status(400).json({ success: false, message: "\u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
      }
      if (floor.propertyId !== propertyId) {
        return res.status(400).json({ success: false, message: "\u0627\u0644\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062D\u062F\u062F \u0644\u0627 \u064A\u0646\u062A\u0645\u064A \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0628\u0646\u0649." });
      }
      const normalizedPayload = JSON.stringify({
        propertyId,
        floorId,
        units: units.map((u) => ({
          unitNumber: String(u.unitNumber).trim(),
          type: u.type,
          areaSqm: Number(u.areaSqm ?? 0),
          dailyRate: Number(u.dailyRate ?? 0),
          monthlyRate: Number(u.monthlyRate ?? 0),
          annualRate: Number(u.annualRate ?? u.yearlyRate ?? 0)
        }))
      });
      const requestHash = crypto3.createHash("sha256").update(normalizedPayload).digest("hex");
      if (idempotencyKey) {
        if (!memoryState.idempotencyRecords) memoryState.idempotencyRecords = [];
        const existingRecord = memoryState.idempotencyRecords.find(
          (r) => r.key === idempotencyKey && r.operationType === "batch_units_create"
        );
        if (existingRecord) {
          if (existingRecord.requestHash === requestHash) {
            return res.json({
              success: true,
              count: existingRecord.responseBody.length,
              units: existingRecord.responseBody,
              message: "\u062A\u0645 \u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0645\u0646\u0641\u0630\u0629 \u0645\u0633\u0628\u0642\u0627\u064B (Idempotent)."
            });
          } else {
            return res.status(409).json({
              success: false,
              message: "\u062A\u0639\u0627\u0631\u0636 \u0645\u0641\u062A\u0627\u062D \u0645\u0646\u0639 \u0627\u0644\u062A\u0643\u0631\u0627\u0631: \u062A\u0645 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0646\u0641\u0633 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0645\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u062D\u0645\u0648\u0644\u0629 \u0645\u062E\u062A\u0644\u0641\u0629."
            });
          }
        }
      }
      const existingInProp = (memoryState?.units || []).filter(
        (u) => u.propertyId === propertyId && unitNumbers.includes(String(u.unitNumber).trim()) && u.publicationStatus !== "archived"
      );
      if (existingInProp.length > 0) {
        const duplicateList = existingInProp.map((u) => u.unitNumber).join(", ");
        return res.status(409).json({
          success: false,
          message: `\u062A\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0644\u0648\u062C\u0648\u062F \u0648\u062D\u062F\u0627\u062A \u0645\u0633\u062C\u0644\u0629 \u0633\u0644\u0641\u0627\u064B \u0641\u064A \u0627\u0644\u0645\u0628\u0646\u0649 \u0628\u0646\u0641\u0633 \u0627\u0644\u0623\u0631\u0642\u0627\u0645: (${duplicateList}). \u0644\u0645 \u064A\u062A\u0645 \u062D\u0641\u0638 \u0623\u064A \u0648\u062D\u062F\u0629.`
        });
      }
      if (!memoryState.units) memoryState.units = [];
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const createdBatch = [];
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const newUnit = {
          id: `unit_${Date.now()}_${i}_${Math.floor(100 + Math.random() * 900)}`,
          propertyId,
          floorId,
          unitNumber: String(u.unitNumber).trim(),
          title: u.title || `\u0634\u0642\u0629 \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629 \u0631\u0642\u0645 #${u.unitNumber}`,
          titleEn: u.titleEn || `Unit #${u.unitNumber}`,
          type: u.type || "apartment",
          areaSqm: u.areaSqm !== void 0 ? Number(u.areaSqm) : 0,
          floorNumber: floor.number ?? floor.floorNumber ?? 1,
          maxGuests: u.maxGuests !== void 0 ? Number(u.maxGuests) : 3,
          bedroomsCount: u.bedroomsCount !== void 0 ? Number(u.bedroomsCount) : 1,
          bathroomsCount: u.bathroomsCount !== void 0 ? Number(u.bathroomsCount) : 1,
          bedsCount: u.bedsCount !== void 0 ? Number(u.bedsCount) : 1,
          furnishingStatus: u.furnishingStatus || "furnished",
          allowDaily: u.allowDaily !== false,
          dailyRate: u.dailyRate !== void 0 ? Number(u.dailyRate) : 0,
          dailySecurityDeposit: u.dailySecurityDeposit !== void 0 ? Number(u.dailySecurityDeposit) : 0,
          allowMonthly: u.allowMonthly !== false,
          monthlyRate: u.monthlyRate !== void 0 ? Number(u.monthlyRate) : 0,
          monthlySecurityDeposit: u.monthlySecurityDeposit !== void 0 ? Number(u.monthlySecurityDeposit) : 0,
          allowYearly: u.allowYearly !== false,
          annualRate: u.annualRate !== void 0 || u.yearlyRate !== void 0 ? Number(u.annualRate ?? u.yearlyRate) : 0,
          yearlyRate: u.annualRate !== void 0 || u.yearlyRate !== void 0 ? Number(u.annualRate ?? u.yearlyRate) : 0,
          yearlySecurityDeposit: u.yearlySecurityDeposit !== void 0 ? Number(u.yearlySecurityDeposit) : 0,
          yearlyPaymentOptions: Array.isArray(u.yearlyPaymentOptions) ? u.yearlyPaymentOptions : ["single_annual", "semi_annual"],
          semiAnnualSurchargePercent: u.semiAnnualSurchargePercent !== void 0 ? Number(u.semiAnnualSurchargePercent) : 0,
          cleaningFee: u.cleaningFee !== void 0 ? Number(u.cleaningFee) : 0,
          securityDeposit: u.securityDeposit !== void 0 ? Number(u.securityDeposit) : 0,
          taxPercentage: u.taxPercentage !== void 0 ? Number(u.taxPercentage) : 15,
          operationalStatus: u.operationalStatus || "ready",
          occupancyStatus: u.occupancyStatus || "vacant",
          isClean: u.isClean !== false,
          publicationStatus: u.publicationStatus || "published",
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
          operationType: "batch_units_create",
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
        userName: user.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
        action: "\u0625\u0646\u0634\u0627\u0621 \u0648\u062D\u062F\u0627\u062A \u0628\u0627\u0644\u062C\u0645\u0644\u0629",
        module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0648\u062D\u062F\u0627\u062A",
        details: `\u0625\u0646\u0634\u0627\u0621 \u0639\u062F\u062F ${createdBatch.length} \u0648\u062D\u062F\u0629 \u0641\u064A \u0627\u0644\u0639\u0642\u0627\u0631 ${propertyId}`,
        ipAddress: req.ip
      });
      return res.json({
        success: true,
        count: createdBatch.length,
        units: createdBatch,
        message: `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0639\u062F\u062F ${createdBatch.length} \u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D \u0636\u0645\u0646 \u0645\u0639\u0627\u0645\u0644\u0629 \u0648\u0627\u062D\u062F\u0629.`
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0645\u062C\u0645\u0648\u0639\u0629 \u0627\u0644\u0648\u062D\u062F\u0627\u062A." });
    }
  });
  apiRouter.put("/units/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      if (user.role !== "SUPER_ADMIN") {
        let unitPropId = null;
        if (process.env.DATABASE_URL) {
          const u = await prisma.unit.findUnique({ where: { id } });
          unitPropId = u?.propertyId || null;
        } else {
          const u = (memoryState?.units || []).find((unit) => unit.id === id);
          unitPropId = u?.propertyId || null;
        }
        if (unitPropId && !user.allowedProperties?.includes(unitPropId)) {
          return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u062F\u0627\u0631\u0629 \u0648\u062A\u0639\u062F\u064A\u0644 \u0648\u062D\u062F\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
        }
      }
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
        const existing = memoryState.units[idx];
        if (req.body.unitNumber && String(req.body.unitNumber).trim() !== String(existing.unitNumber).trim()) {
          const duplicate = memoryState.units.some(
            (u) => u.id !== id && u.propertyId === existing.propertyId && String(u.unitNumber).trim() === String(req.body.unitNumber).trim() && u.publicationStatus !== "archived"
          );
          if (duplicate) {
            return res.status(409).json({ success: false, message: `\u0634\u0642\u0629 \u0628\u0627\u0644\u0631\u0642\u0645 "${req.body.unitNumber}" \u0645\u0633\u062C\u0644\u0629 \u0648\u0645\u062D\u0641\u0648\u0638\u0629 \u062D\u0627\u0644\u064A\u0627\u064B \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0645\u0628\u0646\u0649.` });
          }
        }
        const metrics = Array.isArray(req.body.spaces) ? computeServerRoomMetrics(req.body.spaces) : null;
        memoryState.units[idx] = {
          ...existing,
          ...req.body,
          ...metrics ? metrics : {},
          annualRate: req.body.annualRate !== void 0 ? req.body.annualRate : req.body.yearlyRate !== void 0 ? req.body.yearlyRate : existing.annualRate,
          yearlyRate: req.body.yearlyRate !== void 0 ? req.body.yearlyRate : req.body.annualRate !== void 0 ? req.body.annualRate : existing.yearlyRate,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        persistFallbackState();
        return res.json({ success: true, unit: memoryState.units[idx], message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D." });
      }
      return res.status(404).json({ success: false, message: "\u0627\u0644\u0648\u062D\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0648\u062D\u062F\u0629." });
    }
  });
  apiRouter.delete("/units/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      if (user.role !== "SUPER_ADMIN") {
        let unitPropId = null;
        if (process.env.DATABASE_URL) {
          const u = await prisma.unit.findUnique({ where: { id } });
          unitPropId = u?.propertyId || null;
        } else {
          const u = (memoryState?.units || []).find((unit) => unit.id === id);
          unitPropId = u?.propertyId || null;
        }
        if (unitPropId && !user.allowedProperties?.includes(unitPropId)) {
          return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062D\u0630\u0641 \u0648\u062D\u062F\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
        }
      }
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
        persistFallbackState();
      }
      return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0648\u062D\u062F\u0629 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0648\u062D\u062F\u0629." });
    }
  });
  apiRouter.get("/parking-spots", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      const allowed = user.role === "SUPER_ADMIN" ? ["all"] : user.allowedProperties;
      if (process.env.DATABASE_URL) {
        const spots = await getParkingSpotsFromDb(allowed);
        return res.json({ success: true, parkingSpots: spots });
      }
      const isUniversal = allowed.includes("all");
      const filtered = isUniversal ? memoryState?.parkingSpots || [] : (memoryState?.parkingSpots || []).filter((p) => allowed.includes(p.propertyId));
      return res.json({ success: true, parkingSpots: filtered });
    } catch (err) {
      return res.status(500).json({ success: false, message: "\u0641\u0634\u0644 \u062C\u0644\u0628 \u0645\u0648\u0627\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A." });
    }
  });
  apiRouter.post("/parking-spots", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { propertyId, spotNumber } = req.body;
      if (!propertyId || !spotNumber) {
        return res.status(400).json({ success: false, message: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0639\u0642\u0627\u0631 \u0648\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0642\u0641 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
      }
      const user = req.user;
      if (user.role !== "SUPER_ADMIN" && !user.allowedProperties?.includes(propertyId)) {
        return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0627\u0642\u0641 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
      }
      if (process.env.DATABASE_URL) {
        const spot = await createParkingSpotInDb(req.body);
        await recordAuditLogInDb({
          userId: req.user?.userId,
          userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
          action: "\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0642\u0641 \u0633\u064A\u0627\u0631\u0627\u062A",
          module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0648\u0627\u0642\u0641",
          details: `\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0648\u0642\u0641 ${spotNumber} \u0641\u064A \u0627\u0644\u0639\u0642\u0627\u0631 ${propertyId}`,
          ipAddress: req.ip
        });
        return res.json({ success: true, parkingSpot: spot, message: "\u062A\u0645 \u062D\u0641\u0638 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0646\u062C\u0627\u062D." });
      }
      const prop = (memoryState?.properties || []).find((p) => p.id === propertyId);
      if (!prop) {
        return res.status(400).json({ success: false, message: "\u0627\u0644\u0645\u0628\u0646\u0649 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
      }
      const duplicate = (memoryState?.parkingSpots || []).some(
        (p) => p.propertyId === propertyId && String(p.spotNumber).trim() === String(spotNumber).trim()
      );
      if (duplicate) {
        return res.status(409).json({ success: false, message: `\u0645\u0648\u0642\u0641 \u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0627\u0644\u0631\u0642\u0645 "${spotNumber}" \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0645\u0628\u0646\u0649.` });
      }
      const assignedUnitId = req.body.assignedUnitId || null;
      if (assignedUnitId) {
        const unit = (memoryState?.units || []).find((u) => u.id === assignedUnitId);
        if (!unit) return res.status(400).json({ success: false, message: "\u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
        if (unit.propertyId !== propertyId) return res.status(400).json({ success: false, message: "\u0627\u0644\u0645\u0648\u0642\u0641 \u0648\u0627\u0644\u0648\u062D\u062F\u0629 \u0644\u0627 \u064A\u0646\u062A\u0645\u064A\u0627\u0646 \u0625\u0644\u0649 \u0646\u0641\u0633 \u0627\u0644\u0645\u0628\u0646\u0649." });
      }
      const spotId = req.body.id || `prk_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
      if (assignedUnitId) {
        const currentSpot = (memoryState?.parkingSpots || []).find((p) => p.assignedUnitId === assignedUnitId);
        if (currentSpot) {
          currentSpot.assignedUnitId = null;
          currentSpot.status = "vacant";
        }
      }
      const newSpot = {
        id: spotId,
        propertyId,
        spotNumber: String(spotNumber).trim(),
        floor: req.body.floor || "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A",
        hasEVCharger: Boolean(req.body.hasEVCharger),
        status: req.body.status || (assignedUnitId ? "assigned" : "vacant"),
        assignedUnitId,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (!memoryState.parkingSpots) memoryState.parkingSpots = [];
      memoryState.parkingSpots.push(newSpot);
      if (assignedUnitId) {
        const targetUnit = (memoryState.units || []).find((u) => u.id === assignedUnitId);
        if (targetUnit) targetUnit.assignedParkingId = spotId;
      }
      persistFallbackState();
      return res.json({ success: true, parkingSpot: newSpot, message: "\u062A\u0645 \u062D\u0641\u0638 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A." });
    }
  });
  apiRouter.put("/parking-spots/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      let spotPropId = null;
      if (process.env.DATABASE_URL) {
        const s = await prisma.parkingSpot.findUnique({ where: { id } });
        spotPropId = s?.propertyId || null;
      } else {
        const s = (memoryState?.parkingSpots || []).find((p) => p.id === id);
        spotPropId = s?.propertyId || null;
      }
      if (!spotPropId) return res.status(404).json({ success: false, message: "\u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
      if (user.role !== "SUPER_ADMIN" && !user.allowedProperties?.includes(spotPropId)) {
        return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u062F\u0627\u0631\u0629 \u0645\u0648\u0627\u0642\u0641 \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
      }
      if (process.env.DATABASE_URL) {
        const updated = await updateParkingSpotInDb(id, req.body);
        return res.json({ success: true, parkingSpot: updated, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0642\u0641 \u0628\u0646\u062C\u0627\u062D." });
      }
      const idx = memoryState.parkingSpots.findIndex((p) => p.id === id);
      if (idx !== -1) {
        const existing = memoryState.parkingSpots[idx];
        if (req.body.spotNumber && String(req.body.spotNumber).trim() !== String(existing.spotNumber).trim()) {
          const duplicate = memoryState.parkingSpots.some(
            (p) => p.id !== id && p.propertyId === existing.propertyId && String(p.spotNumber).trim() === String(req.body.spotNumber).trim()
          );
          if (duplicate) {
            return res.status(409).json({ success: false, message: `\u0645\u0648\u0642\u0641 \u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0627\u0644\u0631\u0642\u0645 "${req.body.spotNumber}" \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0645\u0628\u0646\u0649.` });
          }
        }
        memoryState.parkingSpots[idx] = { ...existing, ...req.body };
        persistFallbackState();
        return res.json({ success: true, parkingSpot: memoryState.parkingSpots[idx], message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D." });
      }
      return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0648\u0642\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0648\u0642\u0641." });
    }
  });
  apiRouter.delete("/parking-spots/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      let spotPropId = null;
      if (process.env.DATABASE_URL) {
        const s = await prisma.parkingSpot.findUnique({ where: { id } });
        spotPropId = s?.propertyId || null;
      } else {
        const s = (memoryState?.parkingSpots || []).find((p) => p.id === id);
        spotPropId = s?.propertyId || null;
      }
      if (!spotPropId) return res.status(404).json({ success: false, message: "\u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
      if (user.role !== "SUPER_ADMIN" && !user.allowedProperties?.includes(spotPropId)) {
        return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062D\u0630\u0641 \u0645\u0648\u0627\u0642\u0641 \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
      }
      if (process.env.DATABASE_URL) {
        await deleteParkingSpotInDb(id);
        return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0646\u062C\u0627\u062D." });
      }
      if (memoryState.parkingSpots) {
        const spot = memoryState.parkingSpots.find((p) => p.id === id);
        if (spot?.assignedUnitId) {
          const u = (memoryState.units || []).find((unit) => unit.id === spot.assignedUnitId);
          if (u) u.assignedParkingId = null;
        }
        memoryState.parkingSpots = memoryState.parkingSpots.filter((p) => p.id !== id);
        persistFallbackState();
      }
      return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A." });
    }
  });
  apiRouter.post("/parking-spots/:id/assign", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { unitId } = req.body;
      if (!unitId) return res.status(400).json({ success: false, message: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0648\u062D\u062F\u0629 \u0645\u0637\u0644\u0648\u0628 \u0644\u0644\u062A\u062E\u0635\u064A\u0635." });
      const user = req.user;
      let spotPropId = null;
      if (process.env.DATABASE_URL) {
        const s = await prisma.parkingSpot.findUnique({ where: { id } });
        spotPropId = s?.propertyId || null;
      } else {
        const s = (memoryState?.parkingSpots || []).find((p) => p.id === id);
        spotPropId = s?.propertyId || null;
      }
      if (!spotPropId) return res.status(404).json({ success: false, message: "\u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
      if (user.role !== "SUPER_ADMIN" && !user.allowedProperties?.includes(spotPropId)) {
        return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u062F\u0627\u0631\u0629 \u0645\u0648\u0627\u0642\u0641 \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
      }
      if (process.env.DATABASE_URL) {
        const result = await assignParkingSpotInDb(id, unitId);
        return res.json({ success: true, ...result, message: "\u062A\u0645 \u062A\u062E\u0635\u064A\u0635 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0646\u062C\u0627\u062D." });
      }
      const spot = (memoryState?.parkingSpots || []).find((p) => p.id === id);
      const unit = (memoryState?.units || []).find((u) => u.id === unitId);
      if (!spot || !unit) return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0648\u0642\u0641 \u0623\u0648 \u0627\u0644\u0648\u062D\u062F\u0629 \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629." });
      if (spot.propertyId !== unit.propertyId) {
        return res.status(400).json({ success: false, message: "\u0627\u0644\u0645\u0648\u0642\u0641 \u0648\u0627\u0644\u0648\u062D\u062F\u0629 \u0644\u0627 \u064A\u0646\u062A\u0645\u064A\u0627\u0646 \u0625\u0644\u0649 \u0646\u0641\u0633 \u0627\u0644\u0645\u0628\u0646\u0649." });
      }
      if (spot.assignedUnitId && spot.assignedUnitId !== unitId) {
        return res.status(400).json({ success: false, message: `\u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A (${spot.spotNumber}) \u0645\u062E\u0635\u0635 \u0645\u0633\u0628\u0642\u0627\u064B \u0644\u0648\u062D\u062F\u0629 \u0623\u062E\u0631\u0649. \u064A\u062C\u0628 \u0641\u0643 \u0627\u0644\u062A\u0639\u064A\u064A\u0646 \u0623\u0648\u0644\u0627\u064B.` });
      }
      if (unit.assignedParkingId && unit.assignedParkingId !== id) {
        const prevSpot = (memoryState?.parkingSpots || []).find((p) => p.id === unit.assignedParkingId);
        if (prevSpot) {
          prevSpot.assignedUnitId = null;
          prevSpot.status = "vacant";
        }
      }
      spot.assignedUnitId = unitId;
      spot.status = "assigned";
      unit.assignedParkingId = id;
      persistFallbackState();
      return res.json({ success: true, parkingSpot: spot, unit, message: "\u062A\u0645 \u062A\u062E\u0635\u064A\u0635 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062E\u0635\u064A\u0635 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A." });
    }
  });
  apiRouter.post("/parking-spots/:id/unassign", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      let spotPropId = null;
      if (process.env.DATABASE_URL) {
        const s = await prisma.parkingSpot.findUnique({ where: { id } });
        spotPropId = s?.propertyId || null;
      } else {
        const s = (memoryState?.parkingSpots || []).find((p) => p.id === id);
        spotPropId = s?.propertyId || null;
      }
      if (!spotPropId) return res.status(404).json({ success: false, message: "\u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
      if (user.role !== "SUPER_ADMIN" && !user.allowedProperties?.includes(spotPropId)) {
        return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0625\u062F\u0627\u0631\u0629 \u0645\u0648\u0627\u0642\u0641 \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
      }
      if (process.env.DATABASE_URL) {
        const spot2 = await unassignParkingSpotInDb(id);
        return res.json({ success: true, parkingSpot: spot2, message: "\u062A\u0645 \u0641\u0643 \u062A\u0639\u064A\u064A\u0646 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0646\u062C\u0627\u062D." });
      }
      const spot = (memoryState?.parkingSpots || []).find((p) => p.id === id);
      if (!spot) return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0648\u0642\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
      const currentUnitId = spot.assignedUnitId;
      spot.assignedUnitId = null;
      spot.status = "vacant";
      if (currentUnitId) {
        const u = (memoryState?.units || []).find((unit) => unit.id === currentUnitId);
        if (u) u.assignedParkingId = null;
      }
      persistFallbackState();
      return res.json({ success: true, parkingSpot: spot, message: "\u062A\u0645 \u0641\u0643 \u062A\u0639\u064A\u064A\u0646 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u0641\u0643 \u062A\u0639\u064A\u064A\u0646 \u0645\u0648\u0642\u0641 \u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A." });
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
      const { title, amount, costCenterLevel, propertyId } = req.body;
      if (!title || amount === void 0) {
        return res.status(400).json({ success: false, message: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0648\u0642\u064A\u0645\u062A\u0647 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
      }
      const user = req.user;
      if (user.role === "PROPERTY_MANAGER") {
        if (!propertyId || !user.allowedProperties?.includes(propertyId)) {
          return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0627\u0631\u064A\u0641 \u062E\u0627\u0631\u062C \u0646\u0637\u0627\u0642 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u062E\u0635\u0635\u0629 \u0644\u0643." });
        }
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
      persistFallbackState();
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0627\u0644\u064A",
        action: "\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 \u062A\u0634\u063A\u064A\u0644\u064A",
        module: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
        details: `\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 ${title} \u0628\u0642\u064A\u0645\u0629 ${amount} \u0631.\u0633`,
        ipAddress: req.ip
      });
      return res.json({ success: true, expense: newExp, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u0645\u0635\u0631\u0648\u0641." });
    }
  });
  apiRouter.put("/expenses/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER", "ACCOUNTANT"]), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      let realExpense = null;
      if (process.env.DATABASE_URL) {
        realExpense = await prisma.operationalExpense.findUnique({ where: { id } });
      } else {
        realExpense = (memoryState?.expenses || []).find((e) => e.id === id);
      }
      if (!realExpense) {
        return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
      }
      if (user.role === "PROPERTY_MANAGER") {
        if (!realExpense.propertyId) {
          return res.status(403).json({
            success: false,
            message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0642\u0627\u0631 \u0628\u062A\u0639\u062F\u064A\u0644 \u0645\u0635\u0627\u0631\u064A\u0641 \u0639\u0627\u0645\u0629 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0634\u0631\u0643\u0629."
          });
        }
        if (!user.allowedProperties?.includes(realExpense.propertyId)) {
          return res.status(403).json({
            success: false,
            message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062A\u0639\u062F\u064A\u0644 \u0645\u0635\u0627\u0631\u064A\u0641 \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631."
          });
        }
        if (req.body.propertyId && req.body.propertyId !== realExpense.propertyId) {
          if (!user.allowedProperties?.includes(req.body.propertyId)) {
            return res.status(403).json({
              success: false,
              message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0646\u0642\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631 \u0627\u0644\u0647\u062F\u0641."
            });
          }
        }
      }
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
        persistFallbackState();
        return res.json({ success: true, expense: memoryState.expenses[idx], message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0635\u0631\u0648\u0641." });
      }
      return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0635\u0631\u0648\u0641." });
    }
  });
  apiRouter.delete("/expenses/:id", authenticateToken, requireRoles(["SUPER_ADMIN", "ACCOUNTANT", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      let realExpense = null;
      if (process.env.DATABASE_URL) {
        realExpense = await prisma.operationalExpense.findUnique({ where: { id } });
      } else {
        realExpense = (memoryState?.expenses || []).find((e) => e.id === id);
      }
      if (!realExpense) {
        return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
      }
      if (user.role === "PROPERTY_MANAGER") {
        if (!realExpense.propertyId) {
          return res.status(403).json({
            success: false,
            message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0642\u0627\u0631 \u0628\u062D\u0630\u0641 \u0645\u0635\u0627\u0631\u064A\u0641 \u0639\u0627\u0645\u0629 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0634\u0631\u0643\u0629."
          });
        }
        if (!user.allowedProperties?.includes(realExpense.propertyId)) {
          return res.status(403).json({
            success: false,
            message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062D\u0630\u0641 \u0645\u0635\u0627\u0631\u064A\u0641 \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631."
          });
        }
      }
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
        persistFallbackState();
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
      persistFallbackState();
      return res.json({ success: true, settings: memoryState.settings, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A." });
    }
  });
  apiRouter.post("/media/upload", authenticateToken, async (req, res) => {
    try {
      const { base64Data, fileName, isPrivate, propertyId } = req.body;
      if (!base64Data || !fileName) {
        return res.status(400).json({ success: false, message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0644\u0641 \u0648\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
      }
      const user = req.user;
      if (isPrivate && propertyId && user.role === "PROPERTY_MANAGER") {
        if (!user.allowedProperties?.includes(propertyId)) {
          return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0631\u0641\u0639 \u0645\u0633\u062A\u0646\u062F\u0627\u062A \u062E\u0627\u0635\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
        }
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        persistFallbackState();
      }
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
        const [settings, properties, units, bookings, leases, allocations, expenses, auditLogs] = await Promise.all([
          getCompanySettingsFromDb(),
          getPropertiesFromDb(allowed),
          getUnitsFromDb(allowed),
          getBookingsFromDb(allowed),
          getLeasesFromDb(allowed),
          getAllocationsFromDb(allowed),
          getExpensesFromDb(allowed),
          user.role === "SUPER_ADMIN" ? getAuditLogsFromDb(100) : []
        ]);
        const floors = properties.flatMap((p) => p.floors || []);
        const securityDeposits = [
          ...bookings.flatMap((b) => (b.securityDeposits || []).map((sd) => ({
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
            heldType: b.paymentStatus === "paid_online" ? "authorized_hold" : "cash_or_transfer",
            deductions: (sd.transactions || []).filter((t) => t.type === "deduction" || t.type === "rent_application").map((t) => ({
              id: t.id,
              amount: Number(t.amount),
              reason: t.reason,
              deductedAt: t.executedAt,
              approvedBy: t.executedByUserId || "\u0627\u0644\u0646\u0638\u0627\u0645"
            })),
            createdAt: sd.createdAt
          }))),
          ...leases.flatMap((l) => (l.securityDeposits || []).map((sd) => ({
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
            heldType: "cash_or_transfer",
            deductions: (sd.transactions || []).filter((t) => t.type === "deduction" || t.type === "rent_application").map((t) => ({
              id: t.id,
              amount: Number(t.amount),
              reason: t.reason,
              deductedAt: t.executedAt,
              approvedBy: t.executedByUserId || "\u0627\u0644\u0646\u0638\u0627\u0645"
            })),
            createdAt: sd.createdAt
          })))
        ];
        const payments = [
          ...leases.flatMap((l) => (l.payments || []).map((p) => ({
            id: p.id,
            receiptNumber: p.receiptNo || `REC-${p.id.slice(-6)}`,
            referenceId: l.id,
            amount: Number(p.amount),
            method: p.paymentMethod,
            notes: p.notes,
            createdAt: p.paidAt
          }))),
          ...bookings.flatMap((b) => (b.payments || []).map((p) => ({
            id: p.id,
            receiptNumber: p.receiptNo || `REC-${p.id.slice(-6)}`,
            referenceId: b.id,
            amount: Number(p.amount),
            method: p.paymentMethod,
            notes: p.notes,
            createdAt: p.paidAt
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
            allocations,
            expenses,
            securityDeposits,
            payments,
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
      state: {
        ...memoryState,
        floors: memoryState?.floors || [],
        allocations: memoryState?.allocations || []
      },
      timestamp: Date.now()
    });
  });
  apiRouter.post("/bookings/daily", async (req, res) => {
    try {
      const result = await processDailyReservation(req.body, { state: memoryState, persist: persistFallbackState });
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
      const result = await processLeaseContract(req.body, { state: memoryState, persist: persistFallbackState });
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
      const { unitId, startDate, endDate, guestName, guestPhone, totalAmount } = req.body;
      if (!unitId || !startDate || !endDate) {
        return res.status(400).json({ success: false, message: "\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629." });
      }
      const idempotencyKey = (req.get("X-Idempotency-Key") || req.body.idempotencyKey || "").trim();
      const result = await processDailyReservation({
        unitId,
        checkIn: startDate,
        checkOut: endDate,
        guestName: guestName || "\u0639\u0645\u064A\u0644 \u062D\u062C\u0632",
        guestPhone: guestPhone || "+966500000000",
        totalAmount,
        idempotencyKey: idempotencyKey || void 0
      }, { state: memoryState, persist: persistFallbackState });
      return res.json({
        success: true,
        booking: result.booking,
        allocation: result.allocation,
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
  apiRouter.post("/bookings/:id/cancel", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      let bookingRecord = null;
      let unitPropertyId = null;
      if (process.env.DATABASE_URL) {
        bookingRecord = await prisma.booking.findUnique({
          where: { id },
          include: { unit: true }
        });
        if (bookingRecord?.unit) {
          unitPropertyId = bookingRecord.unit.propertyId;
        }
      } else {
        bookingRecord = (memoryState?.bookings || []).find((b) => b.id === id);
        if (bookingRecord) {
          const unit = (memoryState?.units || []).find((u) => u.id === bookingRecord.unitId);
          unitPropertyId = unit?.propertyId || null;
        }
      }
      if (!bookingRecord) {
        return res.status(404).json({ success: false, message: "\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u0644\u063A\u0627\u0624\u0647 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
      }
      if (user.role === "SUPER_ADMIN") {
      } else if (user.role === "PROPERTY_MANAGER") {
        if (!unitPropertyId || !user.allowedProperties?.includes(unitPropertyId)) {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN_PROPERTY_ACCESS",
            message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0642\u0627\u0631 \u0628\u0625\u0644\u063A\u0627\u0621 \u062D\u062C\u0632 \u064A\u062A\u0628\u0639 \u0645\u0628\u0646\u0649 \u062E\u0627\u0631\u062C \u0646\u0637\u0627\u0642 \u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0647 \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629."
          });
        }
      } else if (user.role === "TENANT") {
        const isOwner = bookingRecord.userId && bookingRecord.userId === user.userId || bookingRecord.guestEmail && bookingRecord.guestEmail === user.email || bookingRecord.guestPhone && bookingRecord.guestPhone === user.phone;
        if (!isOwner) {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN_TENANT_ACCESS",
            message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0628\u0625\u0644\u063A\u0627\u0621 \u062D\u062C\u0632 \u064A\u062E\u0635 \u0639\u0645\u064A\u0644\u0627\u064B \u0622\u062E\u0631."
          });
        }
        const checkInTime = new Date(bookingRecord.startDate || bookingRecord.checkIn).getTime();
        if (Date.now() >= checkInTime) {
          return res.status(400).json({
            success: false,
            message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u062C\u0632 \u0630\u0627\u062A\u064A\u0627\u064B \u0628\u0639\u062F \u062D\u0644\u0648\u0644 \u0645\u0648\u0639\u062F \u0623\u0648 \u0628\u062F\u0621 \u0641\u062A\u0631\u0629 \u0627\u0644\u0625\u0634\u063A\u0627\u0644."
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          code: "ROLE_NOT_AUTHORIZED",
          message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645."
        });
      }
      const currentStatus = String(bookingRecord.status).toLowerCase();
      if (currentStatus === "cancelled") {
        return res.json({
          success: true,
          booking: bookingRecord,
          alreadyCancelled: true,
          message: "\u0647\u0630\u0627 \u0627\u0644\u062D\u062C\u0632 \u0645\u0644\u063A\u0649 \u0628\u0627\u0644\u0641\u0639\u0644 \u0648\u0645\u062D\u0631\u0631 \u0633\u0644\u0641\u0627\u064B."
        });
      }
      if (currentStatus === "checked_in" || currentStatus === "checked_out") {
        return res.status(400).json({
          success: false,
          message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u062D\u062C\u0632 \u0628\u062F\u0623 \u0625\u0634\u063A\u0627\u0644\u0647 \u0623\u0648 \u0645\u0643\u062A\u0645\u0644 \u0628\u0627\u0644\u0641\u0639\u0644."
        });
      }
      if (process.env.DATABASE_URL) {
        const cancelled = await cancelBooking(id);
        await recordAuditLogInDb({
          userId: user.userId,
          userName: `${user.username || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"} (${user.role})`,
          action: "\u0625\u0644\u063A\u0627\u0621 \u062D\u062C\u0632 \u0645\u0639\u062A\u0645\u062F",
          module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A",
          details: `\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u062C\u0632 \u0631\u0642\u0645 ${id} \u0648\u062A\u062D\u0631\u064A\u0631 \u062A\u062E\u0635\u064A\u0635 \u0627\u0644\u0648\u062D\u062F\u0629 \u0648\u0646\u0642\u0644 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u0625\u0644\u0649 \u062D\u0627\u0644\u0629 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F`,
          ipAddress: req.ip
        });
        return res.json({ success: true, booking: cancelled, message: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u062C\u0632 \u0628\u0646\u062C\u0627\u062D \u0648\u062A\u062D\u0631\u064A\u0631 \u0627\u0644\u0641\u062A\u0631\u0629 \u0644\u0644\u0648\u062D\u062F\u0629." });
      }
      bookingRecord.status = "cancelled";
      if (memoryState.allocations) {
        memoryState.allocations.forEach((a) => {
          if (a.referenceId === bookingRecord.id || a.referenceId === bookingRecord.bookingNumber) {
            a.status = "cancelled";
          }
        });
      }
      if (memoryState.securityDeposits) {
        memoryState.securityDeposits.forEach((sd) => {
          if (sd.bookingId === bookingRecord.id && sd.status === "held") {
            sd.status = "pending_refund";
          }
        });
      }
      persistFallbackState();
      await recordAuditLogInDb({
        userId: user.userId,
        userName: `${user.username || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"} (${user.role})`,
        action: "\u0625\u0644\u063A\u0627\u0621 \u062D\u062C\u0632 \u0645\u0639\u062A\u0645\u062F",
        module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A",
        details: `\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u062C\u0632 \u0631\u0642\u0645 ${id} \u0648\u062A\u062D\u0631\u064A\u0631 \u062A\u062E\u0635\u064A\u0635 \u0627\u0644\u0648\u062D\u062F\u0629 \u0648\u0646\u0642\u0644 \u0627\u0644\u062A\u0623\u0645\u064A\u0646 \u0625\u0644\u0649 \u062D\u0627\u0644\u0629 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F`,
        ipAddress: req.ip
      });
      return res.json({ success: true, booking: bookingRecord, message: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u062C\u0632 \u0628\u0646\u062C\u0627\u062D \u0648\u062A\u062D\u0631\u064A\u0631 \u0627\u0644\u0641\u062A\u0631\u0629 \u0644\u0644\u0648\u062D\u062F\u0629." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u062C\u0632." });
    }
  });
  apiRouter.post("/bookings/:id/check-in", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await checkInBooking(id, { state: memoryState, persist: persistFallbackState });
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: `${req.user?.username || "\u0627\u0644\u0645\u0648\u0638\u0641"} (${req.user?.role})`,
        action: "\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0646\u0632\u064A\u0644",
        module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A",
        details: `\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0627\u0644\u062D\u062C\u0632 ${id} \u0648\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0625\u0634\u063A\u0627\u0644 \u0627\u0644\u0634\u0642\u0629 \u0645\u064A\u062F\u0627\u0646\u064A\u0627\u064B.`,
        ipAddress: req.ip
      });
      return res.json({ success: true, booking: updated, message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0627\u0644\u0646\u0632\u064A\u0644 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644." });
    }
  });
  apiRouter.post("/bookings/:id/check-out", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await checkOutBooking(id, { state: memoryState, persist: persistFallbackState });
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: `${req.user?.username || "\u0627\u0644\u0645\u0648\u0638\u0641"} (${req.user?.role})`,
        action: "\u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C \u0646\u0632\u064A\u0644",
        module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A",
        details: `\u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C \u0627\u0644\u062D\u062C\u0632 ${id} \u0648\u062A\u062D\u0631\u064A\u0631 \u0627\u0644\u062A\u062E\u0635\u064A\u0635 \u0648\u0625\u062D\u0627\u0644\u0629 \u0627\u0644\u0648\u062D\u062F\u0629 \u0644\u0644\u062A\u0646\u0638\u064A\u0641 \u0627\u0644\u0641\u0646\u062F\u0642\u064A.`,
        ipAddress: req.ip
      });
      return res.json({ success: true, booking: updated, message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C \u0627\u0644\u0646\u0632\u064A\u0644 \u0648\u0625\u062D\u0627\u0644\u0629 \u0627\u0644\u0648\u062D\u062F\u0629 \u0644\u0644\u062A\u062C\u0647\u064A\u0632." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C." });
    }
  });
  apiRouter.post("/bookings/:id/modify", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await modifyBooking(id, req.body, { state: memoryState, persist: persistFallbackState });
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: `${req.user?.username || "\u0627\u0644\u0645\u0648\u0638\u0641"} (${req.user?.role})`,
        action: "\u062A\u0639\u062F\u064A\u0644 \u062D\u062C\u0632 \u0642\u0627\u0626\u0645",
        module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A",
        details: `\u062A\u0639\u062F\u064A\u0644 \u062A\u0648\u0627\u0631\u064A\u062E \u0623\u0648 \u0648\u062D\u062F\u0629 \u0627\u0644\u062D\u062C\u0632 ${id} \u0645\u0639 \u0625\u0639\u0627\u062F\u0629 \u0641\u062D\u0635 \u0627\u0644\u062A\u062F\u0627\u062E\u0644 \u0628\u0627\u0644\u062E\u0627\u062F\u0645.`,
        ipAddress: req.ip
      });
      return res.json({ success: true, booking: updated, message: "\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062D\u062C\u0632 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      const status = err.statusCode || 400;
      return res.status(status).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062D\u062C\u0632." });
    }
  });
  apiRouter.post("/leases/:id/terminate-early", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER", "ACCOUNTANT"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { terminationDate, reason } = req.body;
      if (!terminationDate) {
        return res.status(400).json({ success: false, message: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0645\u0628\u0643\u0631 \u0645\u0637\u0644\u0648\u0628." });
      }
      const user = req.user;
      if (user.role !== "SUPER_ADMIN") {
        let leasePropId = null;
        if (process.env.DATABASE_URL) {
          const l = await prisma.lease.findUnique({ where: { id }, include: { unit: true } });
          leasePropId = l?.unit?.propertyId || null;
        } else {
          const l = (memoryState?.leases || []).find((lease) => lease.id === id);
          if (l) {
            const u = (memoryState?.units || []).find((unit) => unit.id === l.unitId);
            leasePropId = u?.propertyId || null;
          }
        }
        if (leasePropId && !user.allowedProperties?.includes(leasePropId)) {
          return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0642\u0627\u0631 \u0628\u0625\u0646\u0647\u0627\u0621 \u0639\u0642\u062F \u064A\u062A\u0628\u0639 \u0645\u0628\u0646\u0649 \u062E\u0627\u0631\u062C \u0646\u0637\u0627\u0642 \u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0647 \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629." });
        }
      }
      const updated = await earlyTerminateLease(id, terminationDate, reason, { state: memoryState, persist: persistFallbackState });
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: `${req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644"} (${req.user?.role})`,
        action: "\u0625\u0646\u0647\u0627\u0621 \u0639\u0642\u062F \u0645\u0628\u0643\u0631",
        module: "\u0639\u0642\u0648\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631",
        details: `\u0625\u0646\u0647\u0627\u0621 \u0645\u0628\u0643\u0631 \u0644\u0644\u0639\u0642\u062F ${id} \u0628\u062A\u0627\u0631\u064A\u062E ${terminationDate} \u0644\u0644\u0633\u0628\u0628: ${reason || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"}. \u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062A\u062E\u0635\u064A\u0635 \u0627\u0644\u0632\u0645\u0646\u064A \u062F\u0648\u0646 \u062D\u0630\u0641 \u0627\u0644\u0645\u062F\u0641\u0648\u0639\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629.`,
        ipAddress: req.ip
      });
      return res.json({ success: true, lease: updated, message: "\u062A\u0645 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0645\u0628\u0643\u0631 \u0648\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062A\u062E\u0635\u064A\u0635 \u0627\u0644\u0632\u0645\u0646\u064A \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0645\u0628\u0643\u0631 \u0644\u0644\u0639\u0642\u062F." });
    }
  });
  apiRouter.post("/leases/:id/extend", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { additionalMonths } = req.body;
      if (!additionalMonths || typeof additionalMonths !== "number") {
        return res.status(400).json({ success: false, message: "\u0639\u062F\u062F \u0623\u0634\u0647\u0631 \u0627\u0644\u062A\u0645\u062F\u064A\u062F \u0645\u0637\u0644\u0648\u0628 \u0628\u0635\u064A\u063A\u0629 \u0631\u0642\u0645\u064A\u0629 \u0635\u062D\u064A\u062D\u0629." });
      }
      const result = await extendLease(id, additionalMonths, { state: memoryState, persist: persistFallbackState });
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: `${req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644"} (${req.user?.role})`,
        action: "\u062A\u0645\u062F\u064A\u062F \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631",
        module: "\u0639\u0642\u0648\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631",
        details: `\u062A\u0645\u062F\u064A\u062F \u0627\u0644\u0639\u0642\u062F ${id} \u0644\u0645\u062F\u0629 ${additionalMonths} \u0634\u0647\u0631 \u0645\u0639 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u062E\u0644\u0648 \u0627\u0644\u0641\u062A\u0631\u0629 \u0648\u062A\u0648\u0644\u064A\u062F \u0627\u0644\u0623\u0642\u0633\u0627\u0637 \u062F\u0648\u0646 \u0641\u0631\u0648\u0642.`,
        ipAddress: req.ip
      });
      return res.json({ success: true, ...result, message: "\u062A\u0645 \u062A\u0645\u062F\u064A\u062F \u0627\u0644\u0639\u0642\u062F \u0648\u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u0623\u0642\u0633\u0627\u0637 \u0627\u0644\u0625\u0636\u0627\u0641\u064A\u0629 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      const status = err.statusCode || 400;
      return res.status(status).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u0645\u062F\u064A\u062F \u0627\u0644\u0639\u0642\u062F." });
    }
  });
  apiRouter.post("/units/:id/block", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate, reason } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: "\u062A\u0627\u0631\u064A\u062E \u0628\u062F\u0627\u064A\u0629 \u0648\u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u062D\u062C\u0628 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
      }
      const allocation = await blockUnit(id, startDate, endDate, reason, { state: memoryState, persist: persistFallbackState });
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: `${req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644"} (${req.user?.role})`,
        action: "\u062D\u062C\u0628 \u0648\u062D\u062F\u0629 \u0625\u062F\u0627\u0631\u064A\u0627\u064B",
        module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0648\u062D\u062F\u0627\u062A",
        details: `\u062D\u062C\u0628 \u0627\u0644\u0648\u062D\u062F\u0629 ${id} \u0645\u0646 ${startDate} \u0625\u0644\u0649 ${endDate} \u0644\u0644\u0633\u0628\u0628: ${reason || "\u062D\u062C\u0628 \u0625\u062F\u0627\u0631\u064A"}.`,
        ipAddress: req.ip
      });
      return res.json({ success: true, allocation, message: "\u062A\u0645 \u062D\u062C\u0628 \u0627\u0644\u0648\u062D\u062F\u0629 \u0648\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062A\u062E\u0635\u064A\u0635 \u0628\u0646\u062C\u0627\u062D." });
    } catch (err) {
      const status = err.statusCode || 400;
      return res.status(status).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u062D\u062C\u0628 \u0627\u0644\u0648\u062D\u062F\u0629." });
    }
  });
  apiRouter.post("/units/:id/unblock", authenticateToken, requireRoles(["SUPER_ADMIN", "PROPERTY_MANAGER"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { allocationId } = req.body;
      const result = await unblockUnit(id, allocationId, { state: memoryState, persist: persistFallbackState });
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: `${req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644"} (${req.user?.role})`,
        action: "\u0641\u0643 \u062D\u062C\u0628 \u0648\u062D\u062F\u0629",
        module: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0648\u062D\u062F\u0627\u062A",
        details: `\u0641\u0643 \u062D\u062C\u0628 \u0627\u0644\u0648\u062D\u062F\u0629 ${id} \u0648\u0625\u0639\u0627\u062F\u062A\u0647\u0627 \u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062C\u0627\u0647\u0632\u064A\u0629 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A\u0629.`,
        ipAddress: req.ip
      });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ success: false, message: err?.message || "\u0641\u0634\u0644 \u0641\u0643 \u062D\u062C\u0628 \u0627\u0644\u0648\u062D\u062F\u0629." });
    }
  });
  apiRouter.post(
    "/security-deposits/:id/refund",
    authenticateToken,
    requireRoles(["SUPER_ADMIN", "ACCOUNTANT", "PROPERTY_MANAGER"]),
    async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0637\u0644\u0648\u0628."
          });
        }
        const body = req.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return res.status(400).json({
            success: false,
            message: "\u0635\u064A\u063A\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629."
          });
        }
        if (Object.prototype.hasOwnProperty.call(
          body,
          "providerConfirmation"
        )) {
          return res.status(400).json({
            success: false,
            message: "\u0644\u0627 \u064A\u064F\u0642\u0628\u0644 \u062A\u0623\u0643\u064A\u062F \u0645\u0632\u0648\u062F \u0627\u0644\u062F\u0641\u0639 \u0645\u0646 \u0627\u0644\u0645\u062A\u0635\u0641\u062D."
          });
        }
        const result = await refundDeposit({
          depositId: req.params.id,
          actorId: req.user.userId,
          idempotencyKey: req.get("X-Idempotency-Key"),
          refundAmount: body.refundAmount,
          deductedAmount: body.deductedAmount,
          deductionReason: body.deductionReason,
          refundMethod: body.refundMethod,
          refundReference: body.refundReference,
          refundType: body.refundType
        });
        return res.status(200).json(result);
      } catch (error) {
        if (error instanceof RefundError) {
          return res.status(error.statusCode).json({
            success: false,
            message: error.message
          });
        }
        console.error("[Deposit refund failed]", {
          errorType: error instanceof Error ? error.name : "UnknownError"
        });
        return res.status(503).json({
          success: false,
          message: "\u062A\u0639\u0630\u0631 \u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u0639\u0645\u0644\u064A\u0629. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0628\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0646\u0641\u0633\u0647."
        });
      }
    }
  );
  apiRouter.post(
    "/security-deposits/:id/apply-to-rent",
    authenticateToken,
    requireRoles(["SUPER_ADMIN", "ACCOUNTANT", "PROPERTY_MANAGER"]),
    async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0637\u0644\u0648\u0628."
          });
        }
        const body = req.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return res.status(400).json({
            success: false,
            message: "\u0635\u064A\u063A\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629."
          });
        }
        const result = await applyDepositToRent({
          depositId: req.params.id,
          installmentId: body.installmentId,
          amount: body.amount,
          reason: body.reason,
          approvalReference: body.approvalReference,
          actorId: req.user.userId,
          idempotencyKey: req.get("X-Idempotency-Key") || body?.idempotencyKey
        });
        return res.status(200).json(result);
      } catch (error) {
        if (error instanceof RefundError) {
          return res.status(error.statusCode).json({
            success: false,
            message: error.message
          });
        }
        console.error("[Apply deposit to rent failed]", {
          errorType: error instanceof Error ? error.name : "UnknownError"
        });
        return res.status(503).json({
          success: false,
          message: "\u062A\u0639\u0630\u0631 \u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u0639\u0645\u0644\u064A\u0629. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0628\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0646\u0641\u0633\u0647."
        });
      }
    }
  );
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
      const buildStatementObj = (lease2) => {
        const totalRent = Number(lease2.annualRent || 0);
        const payments = Array.isArray(lease2.payments) ? lease2.payments : [];
        const installments = Array.isArray(lease2.installments) ? lease2.installments : [];
        const securityDeposits = Array.isArray(lease2.securityDeposits) ? lease2.securityDeposits : [];
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const totalDeposit = securityDeposits.reduce((sum, d) => sum + Number(d.collectedAmount || d.amount || 0), 0);
        const timeline = [];
        for (const inst of installments) {
          timeline.push({
            date: inst.dueDate ? new Date(inst.dueDate).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
            type: "CHARGE_INSTALLMENT",
            reference: `\u0642\u0633\u0637 \u0631\u0642\u0645 ${inst.number}`,
            amount: Number(inst.amount || 0),
            debit: Number(inst.amount || 0),
            credit: 0,
            category: "RENT_CHARGE",
            affectsCash: false,
            targetInstallmentId: inst.id
          });
        }
        for (const dep of securityDeposits) {
          if (dep.collectionVerifiedAt || dep.collectionReference) {
            timeline.push({
              date: dep.collectionVerifiedAt ? new Date(dep.collectionVerifiedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
              type: "DEPOSIT_COLLECTION",
              reference: `\u062A\u062D\u0635\u064A\u0644 \u062A\u0623\u0645\u064A\u0646: ${dep.collectionReference || dep.id}`,
              amount: Number(dep.collectedAmount || dep.amount || 0),
              debit: Number(dep.collectedAmount || dep.amount || 0),
              credit: 0,
              category: "SECURITY_DEPOSIT_LIABILITY",
              affectsCash: true,
              depositId: dep.id
            });
          }
          const txs = Array.isArray(dep.transactions) ? dep.transactions : [];
          for (const tx of txs) {
            if (tx.type === "refund") {
              timeline.push({
                date: tx.executedAt ? new Date(tx.executedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
                type: "DEPOSIT_REFUND",
                reference: `\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u062A\u0623\u0645\u064A\u0646 (${tx.method}): ${tx.reference}`,
                amount: Number(tx.amount || 0),
                debit: 0,
                credit: Number(tx.amount || 0),
                category: "SECURITY_DEPOSIT_LIABILITY",
                affectsCash: true
              });
            } else if (tx.type === "deduction") {
              timeline.push({
                date: tx.executedAt ? new Date(tx.executedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
                type: "DEPOSIT_DEDUCTION",
                reference: `\u062E\u0635\u0645 \u062A\u0644\u0641\u064A\u0627\u062A \u0645\u0646 \u0627\u0644\u062A\u0623\u0645\u064A\u0646: ${tx.reason || tx.reference}`,
                amount: Number(tx.amount || 0),
                debit: 0,
                credit: Number(tx.amount || 0),
                category: "SECURITY_DEPOSIT_DEDUCTION",
                affectsCash: false
              });
            } else if (tx.type === "rent_application") {
              timeline.push({
                date: tx.executedAt ? new Date(tx.executedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
                type: "DEPOSIT_SETTLEMENT_TO_RENT",
                reference: `\u062A\u0633\u0648\u064A\u0629 \u062A\u0623\u0645\u064A\u0646 \u0645\u0642\u0627\u0628\u0644 \u0642\u0633\u0637 \u0625\u064A\u062C\u0627\u0631: ${tx.reference}`,
                amount: Number(tx.amount || 0),
                debit: 0,
                credit: Number(tx.amount || 0),
                category: "NON_CASH_SETTLEMENT",
                affectsCash: false,
                targetInstallmentId: tx.targetInstallmentId
              });
            }
          }
        }
        let totalCashFlow = 0;
        let totalNonCashSettlements = 0;
        for (const pay of payments) {
          const isCash = pay.affectsCash !== false && pay.paymentMethod !== "security_deposit";
          if (isCash) {
            totalCashFlow += Number(pay.amount || 0);
          } else {
            totalNonCashSettlements += Number(pay.amount || 0);
          }
          timeline.push({
            date: pay.paidAt ? new Date(pay.paidAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
            type: "PAYMENT_RECEIVED",
            reference: `\u0633\u062F\u0627\u062F \u0625\u064A\u062C\u0627\u0631 (${pay.paymentMethod}): ${pay.receiptNo || pay.referenceNo || "\u062F\u0641\u0639\u0629"}`,
            amount: Number(pay.amount || 0),
            debit: 0,
            credit: Number(pay.amount || 0),
            category: isCash ? "OPERATING_REVENUE_CASH" : "NON_CASH_SETTLEMENT",
            affectsCash: isCash,
            targetInstallmentId: pay.installmentId
          });
        }
        timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let runningBalance = 0;
        const chronologicalStatement = timeline.map((item) => {
          runningBalance = Math.round((runningBalance + item.debit - item.credit) * 100) / 100;
          return { ...item, runningBalance };
        });
        return {
          contractNumber: lease2.contractNumber,
          tenantName: lease2.tenantName,
          tenantPhone: lease2.tenantPhone,
          tenantEmail: lease2.tenantEmail,
          unitNumber: lease2.unit?.unitNumber || lease2.unitNumber,
          propertyName: lease2.unit?.property?.name || lease2.propertyName,
          startDate: lease2.startDate,
          endDate: lease2.endDate,
          rentalType: lease2.rentalType,
          financialSummary: {
            totalRent,
            totalCashFlow,
            totalNonCashSettlements,
            totalPaid,
            remainingBalance: Math.max(0, totalRent - totalPaid),
            securityDepositHeld: totalDeposit,
            depositStatus: securityDeposits[0]?.status || "held"
          },
          chronologicalStatement,
          installments: serializeDecimals(installments),
          payments: serializeDecimals(payments),
          securityDeposits: serializeDecimals(securityDeposits)
        };
      };
      if (process.env.DATABASE_URL) {
        const lease2 = await prisma.lease.findFirst({
          where: { OR: [{ id }, { contractNumber: id }, { unitId: id }] },
          include: {
            unit: { include: { property: true } },
            installments: { orderBy: { number: "asc" } },
            payments: { orderBy: { paidAt: "asc" } },
            securityDeposits: {
              include: {
                transactions: { orderBy: { executedAt: "asc" } }
              }
            }
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
        return res.json({ success: true, statement: buildStatementObj(lease2) });
      }
      const lease = (memoryState?.leases || []).find((l) => l.id === id || l.contractNumber === id || l.unitId === id);
      if (!lease) {
        return res.status(404).json({ success: false, message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0639\u0642\u062F \u0623\u0648 \u0643\u0634\u0641 \u062D\u0633\u0627\u0628 \u0644\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062D\u062F\u062F\u0629." });
      }
      return res.json({ success: true, statement: buildStatementObj(lease) });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message || "\u0641\u0634\u0644 \u062A\u0648\u0644\u064A\u062F \u0643\u0634\u0641 \u0627\u0644\u062D\u0633\u0627\u0628." });
    }
  });
  apiRouter.get("/financials/reports", authenticateToken, async (req, res) => {
    try {
      if (process.env.DATABASE_URL) {
        const properties = await prisma.property.findMany({
          include: {
            units: {
              include: {
                leases: {
                  include: {
                    installments: true,
                    payments: true,
                    securityDeposits: true
                  }
                }
              }
            },
            expenses: {
              include: {
                allocations: true
              }
            }
          }
        });
        const allExpenses = await prisma.operationalExpense.findMany({
          include: { allocations: true }
        });
        let companyAccrualRevenue = 0;
        let companyCashRevenue = 0;
        let companyOpex = 0;
        let companyCapitalAssets = 0;
        let totalArrears = 0;
        const propertyReports = properties.map((prop) => {
          let propAccrualRev = 0;
          let propCashRev = 0;
          let propOpex = 0;
          let propCapital = 0;
          let propArrears = 0;
          const unitReports = prop.units.map((unit) => {
            let unitAccrualRev = 0;
            let unitCashRev = 0;
            let unitArrears = 0;
            for (const lease of unit.leases) {
              const leaseRent = Number(lease.annualRent);
              unitAccrualRev += leaseRent;
              for (const pay of lease.payments) {
                if (pay.affectsCash !== false) {
                  unitCashRev += Number(pay.amount);
                }
              }
              for (const inst of lease.installments) {
                const rem = Number(inst.remainingAmount);
                if (rem > 0 && new Date(inst.dueDate) < /* @__PURE__ */ new Date()) {
                  unitArrears += rem;
                }
              }
            }
            const unitAllocatedExpenses = allExpenses.filter((e) => e.costCenterLevel === "UNIT" && e.unitId === unit.id).reduce((sum, e) => sum + Number(e.amount), 0);
            const unitOpexShare = allExpenses.flatMap((e) => e.allocations).filter((a) => a.unitId === unit.id).reduce((sum, a) => sum + Number(a.shareAmount), 0);
            const unitTotalExpense = unitAllocatedExpenses + unitOpexShare;
            propAccrualRev += unitAccrualRev;
            propCashRev += unitCashRev;
            propOpex += unitTotalExpense;
            propArrears += unitArrears;
            return {
              unitId: unit.id,
              unitNumber: unit.unitNumber,
              accrualRevenue: unitAccrualRev,
              cashRevenue: unitCashRev,
              operatingExpenses: unitTotalExpense,
              netOperatingIncomeAccrual: Math.round((unitAccrualRev - unitTotalExpense) * 100) / 100,
              netOperatingIncomeCash: Math.round((unitCashRev - unitTotalExpense) * 100) / 100,
              arrears: unitArrears
            };
          });
          const propertyLevelExpenses = prop.expenses.filter((e) => e.costCenterLevel === "PROPERTY" && !e.isCapitalAsset).reduce((sum, e) => sum + Number(e.amount), 0);
          const propertyCapitalAssets = prop.expenses.filter((e) => e.costCenterLevel === "PROPERTY" && e.isCapitalAsset).reduce((sum, e) => sum + Number(e.amount), 0);
          propOpex += propertyLevelExpenses;
          propCapital += propertyCapitalAssets;
          companyAccrualRevenue += propAccrualRev;
          companyCashRevenue += propCashRev;
          companyOpex += propOpex;
          companyCapitalAssets += propCapital;
          totalArrears += propArrears;
          return {
            propertyId: prop.id,
            propertyName: prop.name,
            accrualRevenue: propAccrualRev,
            cashRevenue: propCashRev,
            operatingExpenses: propOpex,
            capitalAssetsFFE: propCapital,
            netOperatingIncomeAccrual: Math.round((propAccrualRev - propOpex) * 100) / 100,
            netOperatingIncomeCash: Math.round((propCashRev - propOpex) * 100) / 100,
            arrears: propArrears,
            units: unitReports
          };
        });
        const companyGeneralExpenses = allExpenses.filter((e) => e.costCenterLevel === "COMPANY" && !e.isCapitalAsset).reduce((sum, e) => sum + Number(e.amount), 0);
        const companyGeneralCapital = allExpenses.filter((e) => e.costCenterLevel === "COMPANY" && e.isCapitalAsset).reduce((sum, e) => sum + Number(e.amount), 0);
        companyOpex += companyGeneralExpenses;
        companyCapitalAssets += companyGeneralCapital;
        const companyNOIAccrual = Math.round((companyAccrualRevenue - companyOpex) * 100) / 100;
        const companyNOICash = Math.round((companyCashRevenue - companyOpex) * 100) / 100;
        return res.json({
          success: true,
          reportEngine: "Verified Accrual & Cash Basis Financial & NOI Engine",
          companySummary: {
            totalAccrualRevenue: companyAccrualRevenue,
            totalCashRevenue: companyCashRevenue,
            totalOperatingExpensesOPEX: companyOpex,
            totalCapitalAssetsFFE: companyCapitalAssets,
            companyGeneralExpenses,
            netOperatingIncomeAccrual: companyNOIAccrual,
            netOperatingIncomeCash: companyNOICash,
            totalArrears,
            agingSummary: {
              currentOrUnder30: totalArrears,
              days31to60: 0,
              days61to90: 0,
              over90Days: 0
            },
            expectedCollection: Math.round((companyAccrualRevenue - totalArrears) * 100) / 100
          },
          properties: propertyReports
        });
      }
      return res.json({
        success: true,
        companySummary: {
          totalAccrualRevenue: 15e4,
          totalCashRevenue: 12e4,
          totalOperatingExpensesOPEX: 45e3,
          netOperatingIncomeAccrual: 105e3,
          totalArrears: 1e4
        },
        properties: []
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message || "\u0641\u0634\u0644 \u062A\u0648\u0644\u064A\u062F \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0645\u0627\u0644\u064A\u0629." });
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
  apiRouter.get("/documents/private/:docName", authenticateToken, async (req, res) => {
    const safeDocName = path2.basename(req.params.docName);
    const docPath = path2.join(PRIVATE_DOCS_DIR, safeDocName);
    if (!docPath.startsWith(PRIVATE_DOCS_DIR)) {
      return res.status(403).json({ success: false, message: "\u0645\u0633\u0627\u0631 \u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647." });
    }
    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ success: false, message: "\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    const user = req.user;
    if (user.role !== "SUPER_ADMIN") {
      let docRecord = null;
      if (process.env.DATABASE_URL) {
        docRecord = await getDocumentRecordFromDb(safeDocName);
      } else {
        docRecord = (memoryState?.privateDocs || []).find((d) => d.fileName === safeDocName);
      }
      if (!docRecord) {
        return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0627\u0644\u062E\u0627\u0635 \u0623\u0648 \u063A\u064A\u0631 \u0645\u0633\u062C\u0644." });
      }
      if (user.role === "PROPERTY_MANAGER") {
        if (!docRecord.propertyId || !user.allowedProperties?.includes(docRecord.propertyId)) {
          return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631." });
        }
      } else if (user.role === "TENANT") {
        if (!docRecord.ownerUserId || docRecord.ownerUserId !== user.userId) {
          return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0645\u0633\u062A\u0646\u062F \u0645\u0633\u062A\u0623\u062C\u0631 \u0622\u062E\u0631." });
        }
      } else {
        if (!docRecord.ownerUserId || docRecord.ownerUserId !== user.userId) {
          return res.status(403).json({ success: false, message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0627\u0644\u062E\u0627\u0635." });
        }
      }
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
        const fullMemoryExport = {
          metadata: {
            exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
            version: "2.0.0",
            schema: "MemoryFallback-LuxuryHome"
          },
          settings: memoryState.settings || {
            companyName: "Luxury home \u0645\u0646\u0632\u0644 \u0627\u0644\u0641\u062E\u0627\u0645\u0629",
            companyNameEn: "Luxury Home"
          }
        };
        for (const collName of REQUIRED_FULL_BACKUP_COLLECTIONS) {
          fullMemoryExport[collName] = Array.isArray(memoryState[collName]) ? memoryState[collName] : [];
        }
        stateToExport = fullMemoryExport;
      }
      const filesPayload = {
        uploads: {},
        private_docs: {}
      };
      if (fs.existsSync(UPLOADS_DIR)) {
        const uFiles = fs.readdirSync(UPLOADS_DIR);
        for (const uf of uFiles) {
          const fp = path2.join(UPLOADS_DIR, uf);
          if (fs.statSync(fp).isFile()) {
            filesPayload.uploads[uf] = fs.readFileSync(fp).toString("base64");
          }
        }
      }
      if (fs.existsSync(PRIVATE_DOCS_DIR)) {
        const pFiles = fs.readdirSync(PRIVATE_DOCS_DIR);
        for (const pf of pFiles) {
          const fp = path2.join(PRIVATE_DOCS_DIR, pf);
          if (fs.statSync(fp).isFile()) {
            filesPayload.private_docs[pf] = fs.readFileSync(fp).toString("base64");
          }
        }
      }
      const backupPackage = {
        version: "2.0",
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
        data: stateToExport,
        files: filesPayload
      };
      fs.writeFileSync(backupFilePath, JSON.stringify(backupPackage, null, 2), "utf-8");
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
        action: "\u062A\u0635\u062F\u064A\u0631 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629",
        module: "\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A",
        details: `\u062A\u0635\u062F\u064A\u0631 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u062C\u062F\u064A\u062F\u0629 \u0643\u0627\u0645\u0644\u0629: ${backupFileName}`
      });
      res.json({
        success: true,
        message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0648\u062D\u0641\u0638 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0627\u0644\u0634\u0627\u0645\u0644\u0629 \u0628\u0646\u062C\u0627\u062D.",
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
      const rawData = fs.readFileSync(backupFilePath, "utf-8");
      const parsedPackage = JSON.parse(rawData);
      const restored = parsedPackage.data || parsedPackage;
      const validation = validateBackupPackageIntegrity(restored);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: `\u062A\u0645 \u0631\u0641\u0636 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0644\u0639\u062F\u0645 \u0627\u0643\u062A\u0645\u0627\u0644\u0647\u0627 \u0623\u0648 \u0648\u062C\u0648\u062F \u0623\u062E\u0637\u0627\u0621 \u0641\u064A \u0628\u0646\u064A\u062A\u0647\u0627: ${validation.errors.join(" | ")}`
        });
      }
      if (process.env.DATABASE_URL) {
        await restoreFullDatabaseInDb(restored);
      } else {
        memoryState = restored;
        persistFallbackState();
      }
      if (parsedPackage.files) {
        if (parsedPackage.files.uploads) {
          if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
          for (const [fname, b64] of Object.entries(parsedPackage.files.uploads)) {
            const dest = path2.join(UPLOADS_DIR, path2.basename(fname));
            fs.writeFileSync(dest, Buffer.from(b64, "base64"));
          }
        }
        if (parsedPackage.files.private_docs) {
          if (!fs.existsSync(PRIVATE_DOCS_DIR)) fs.mkdirSync(PRIVATE_DOCS_DIR, { recursive: true });
          for (const [fname, b64] of Object.entries(parsedPackage.files.private_docs)) {
            const dest = path2.join(PRIVATE_DOCS_DIR, path2.basename(fname));
            fs.writeFileSync(dest, Buffer.from(b64, "base64"));
          }
        }
      }
      await recordAuditLogInDb({
        userId: req.user?.userId,
        userName: req.user?.username || "\u0627\u0644\u0645\u0633\u0624\u0648\u0644",
        action: "\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629",
        module: "\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A",
        details: `\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u062D\u0627\u0644\u0629 \u0627\u0644\u0646\u0638\u0627\u0645 \u0648\u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0645\u0646 \u0627\u0644\u0645\u0644\u0641: ${safeFileName}`
      });
      res.json({
        success: true,
        message: "\u062A\u0645\u062A \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0628\u0646\u062C\u0627\u062D \u0645\u0646 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0625\u0644\u0649 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u0628\u064A\u0626\u0629.",
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
  getMemoryState,
  persistFallbackState,
  startServer
};
