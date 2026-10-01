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
var LEGACY_DB_FILE = path.resolve(__dirname, "../../server-db.json");

// src/server/auth.ts
var IS_PROD = process.env.NODE_ENV === "production";
var JWT_SECRET = process.env.JWT_SECRET || "";
if (IS_PROD && !JWT_SECRET) {
  console.error("[CRITICAL SECURITY ERROR] JWT_SECRET environment variable must be set in production mode!");
  JWT_SECRET = crypto.randomBytes(64).toString("hex");
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
      console.warn("[Auth] Database check error during token auth:", dbErr);
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

// src/server/reservationService.ts
import { Decimal } from "@prisma/client/runtime/library";
import { RentalType, BookingStatus, LeaseStatus, InstallmentStatus } from "@prisma/client";
function calculateContractEndDate(startDateStr, months) {
  const d = new Date(startDateStr);
  const startDay = d.getDate();
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
  const { unitId, checkIn, checkOut, guestName, guestPhone, guestEmail, guestIdNumber, notes } = input;
  const start = /* @__PURE__ */ new Date(`${checkIn}T15:00:00.000Z`);
  const end = /* @__PURE__ */ new Date(`${checkOut}T12:00:00.000Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw new Error("\u062A\u0648\u0627\u0631\u064A\u062E \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629. \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u062A\u0627\u0631\u064A\u062E \u0645\u063A\u0627\u062F\u0631\u0629 \u0628\u0639\u062F \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0648\u0635\u0648\u0644.");
  }
  const diffMs = end.getTime() - start.getTime();
  const totalNights = Math.max(1, Math.round(diffMs / (1e3 * 60 * 60 * 24)));
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
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
          nightlyRate: new Decimal(nightlyRate2),
          subtotal: new Decimal(subtotal2),
          cleaningFee: new Decimal(cleaningFee2),
          taxes: new Decimal(taxes2),
          securityDeposit: new Decimal(securityDeposit2),
          totalAmount: new Decimal(totalAmount2),
          paidAmount: new Decimal(0),
          status: BookingStatus.CONFIRMED,
          paymentStatus: "pending",
          // NOT fake success; waits for verified payment
          identityStatus: "pending_verification",
          // NOT fake idVerified; waits for official check
          smartLockPin: null,
          // NOT fake random pin; activated only upon check-in verification
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
          amount: new Decimal(securityDeposit2),
          status: "held",
          notes: `\u062A\u0623\u0645\u064A\u0646 \u0645\u0633\u062A\u0631\u062F \u0644\u062D\u062C\u0632 ${bookingNumber2}`
        }
      });
      return { booking, allocation, totalAmount: totalAmount2, subtotal: subtotal2, taxes: taxes2, cleaningFee: cleaningFee2, securityDeposit: securityDeposit2 };
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
    termsConditions
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
          unitId,
          tenantName,
          tenantPhone,
          tenantEmail,
          tenantIdNumber,
          startDate: start,
          endDate: end,
          rentalType: rentalType === "annual" ? RentalType.ANNUAL : RentalType.MONTHLY,
          annualRent: new Decimal(totalRentForPeriod2),
          paymentOption: paymentFrequency,
          paymentFrequency,
          installmentsCount: installmentsData2.length,
          securityDeposit: new Decimal(securityDeposit),
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
            amount: new Decimal(inst.amount),
            paidAmount: new Decimal(0),
            remainingAmount: new Decimal(inst.amount),
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
          amount: new Decimal(securityDeposit),
          status: "held",
          notes: `\u062A\u0623\u0645\u064A\u0646 \u062A\u0623\u062C\u064A\u0631\u064A \u0644\u0639\u0642\u062F ${contractNumber2}`
        }
      });
      return { lease, allocation, installments: installmentsData2 };
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
var dbState = null;
var lastServerUpdateTimestamp = Date.now();
var storedUsers = [];
async function initializeSecurityAndState() {
  if (fs.existsSync(LEGACY_DB_FILE)) {
    try {
      const data = fs.readFileSync(LEGACY_DB_FILE, "utf-8");
      dbState = JSON.parse(data);
      console.log("[Server] Successfully loaded initial state from disk.");
    } catch (e) {
      console.error("[Server] Error loading state from disk:", e);
    }
  }
  if (!dbState) {
    dbState = {
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
  if (Array.isArray(dbState.users) && dbState.users.length > 0) {
    storedUsers = dbState.users;
  } else {
    const initialAdminUsername = process.env.INITIAL_ADMIN_USERNAME || process.env.SUPER_ADMIN_INITIAL_USERNAME;
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || process.env.SUPER_ADMIN_INITIAL_PASSWORD;
    if (initialAdminUsername && initialAdminPassword) {
      const hashedPassword = await hashPassword(initialAdminPassword);
      storedUsers.push({
        id: "usr_super_admin_env",
        username: initialAdminUsername,
        email: process.env.INITIAL_ADMIN_EMAIL || "admin@luxuryhome.sa",
        passwordHash: hashedPassword,
        name: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
        role: "SUPER_ADMIN",
        allowedProperties: ["all"],
        isActive: true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      console.log(`[Security] Seeded initial Super Admin (${initialAdminUsername}) securely from environment variables.`);
    }
  }
}
function persistState() {
  try {
    lastServerUpdateTimestamp = Date.now();
    dbState.users = storedUsers;
    fs.writeFileSync(LEGACY_DB_FILE, JSON.stringify(dbState, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("[Server] Failed to persist state to disk:", e);
    return false;
  }
}
function recordServerAuditLog(user, action, module, details, ipAddress) {
  const logEntry = {
    id: `audit_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
    userId: user?.userId || "system",
    userName: user?.username ? `${user.username} (${user.role})` : "\u0632\u0627\u0626\u0631 / \u0646\u0638\u0627\u0645",
    action,
    module,
    details,
    ipAddress: ipAddress || "127.0.0.1",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!dbState.auditLogs) dbState.auditLogs = [];
  dbState.auditLogs.unshift(logEntry);
  if (dbState.auditLogs.length > 2e3) {
    dbState.auditLogs = dbState.auditLogs.slice(0, 2e3);
  }
}
async function startServer(customPort) {
  await initializeSecurityAndState();
  const PORT = customPort || Number(process.env.PORT) || 3e3;
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use("/uploads", express.static(UPLOADS_DIR));
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
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
    res.json({
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      version: "2.0.0",
      database: dbHealth.connected ? "postgresql_active" : process.env.DATABASE_URL ? "postgresql_connection_error" : "unconfigured_local_preview",
      databaseDetails: dbHealth.details,
      hasAdminInitialized: storedUsers.some((u) => u.role === "SUPER_ADMIN" && u.isActive),
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
    let user = storedUsers.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.isActive);
    if (!user && storedUsers.length === 0) {
      const envUser = process.env.INITIAL_ADMIN_USERNAME || process.env.SUPER_ADMIN_INITIAL_USERNAME;
      const envPass = process.env.INITIAL_ADMIN_PASSWORD || process.env.SUPER_ADMIN_INITIAL_PASSWORD;
      if (envUser && envPass && username === envUser && password === envPass) {
        const hashedPassword = await hashPassword(password);
        user = {
          id: "usr_super_admin_env",
          username: envUser,
          email: "admin@luxuryhome.sa",
          passwordHash: hashedPassword,
          name: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
          role: "SUPER_ADMIN",
          allowedProperties: ["all"],
          isActive: true,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        storedUsers.push(user);
        persistState();
      }
    }
    if (!user) {
      return res.status(401).json({ success: false, message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." });
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
      allowedProperties: user.allowedProperties
    };
    const token = generateToken(tokenPayload);
    recordServerAuditLog(
      tokenPayload,
      "\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0646\u0627\u062C\u062D",
      "\u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0648\u0627\u0644\u0623\u0645\u0627\u0646",
      `\u0642\u0627\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${user.username} \u0628\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0646\u062C\u0627\u062D \u0625\u0644\u0649 \u0627\u0644\u0646\u0638\u0627\u0645 \u0628\u0635\u0644\u0627\u062D\u064A\u0629 ${user.role}.`,
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
  apiRouter.post("/auth/register-admin", async (req, res) => {
    const { username, password, name, email, allowedProperties } = req.body;
    const hasAdmin = storedUsers.some((u) => u.role === "SUPER_ADMIN" && u.isActive);
    if (hasAdmin) {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;
      if (!token) {
        return res.status(403).json({
          success: false,
          code: "SETUP_CLOSED",
          message: "\u0645\u0631\u0641\u0648\u0636: \u062A\u0645 \u0625\u0639\u062F\u0627\u062F \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0645\u0633\u0628\u0642\u0627\u064B\u060C \u0648\u0627\u0644\u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0645\u063A\u0644\u0642\u0629 \u062A\u0645\u0627\u0645\u0627\u064B. \u064A\u062A\u0637\u0644\u0628 \u062A\u0633\u062C\u064A\u0644 \u0645\u0633\u0624\u0648\u0644 \u062C\u062F\u064A\u062F \u0645\u0635\u0627\u062F\u0642\u0629 \u0645\u0633\u0624\u0648\u0644 \u062D\u0627\u0644\u064A \u0628\u0640 JWT \u0635\u0627\u0644\u062D."
        });
      }
      const authReq = req;
      authenticateToken(authReq, res, async () => {
        if (authReq.user?.role !== "SUPER_ADMIN") {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "\u0641\u0642\u0637 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0631\u0626\u064A\u0633\u064A (SUPER_ADMIN) \u064A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628\u0627\u062A \u0625\u062F\u0627\u0631\u064A\u0629 \u062C\u062F\u064A\u062F\u0629."
          });
        }
        await createAdminRecord();
      });
      return;
    }
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    const providedSecret = req.headers["x-admin-setup-secret"] || req.body.setupSecret;
    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(403).json({
        success: false,
        code: "INVALID_SETUP_SECRET",
        message: "\u0645\u0631\u0641\u0648\u0636: \u0631\u0645\u0632 \u0627\u0644\u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u0627\u0644\u0623\u0648\u0644\u064A\u0629 (ADMIN_SETUP_SECRET) \u063A\u064A\u0631 \u0635\u062D\u064A\u062D."
      });
    }
    await createAdminRecord();
    async function createAdminRecord() {
      if (!username || !password) {
        return res.status(400).json({ success: false, message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
      }
      if (username.length < 3) {
        return res.status(400).json({ success: false, message: "\u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0646 \u0663 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644." });
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: "\u064A\u062C\u0628 \u0623\u0646 \u062A\u062A\u0643\u0648\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0646 \u0666 \u062E\u0627\u0646\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0644\u0636\u0645\u0627\u0646 \u0627\u0644\u0623\u0645\u0627\u0646." });
      }
      if (storedUsers.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(409).json({ success: false, message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B." });
      }
      const hashedPassword = await hashPassword(password);
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
      storedUsers.push(newAdmin);
      persistState();
      const payload = {
        userId: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        allowedProperties: newAdmin.allowedProperties
      };
      const token = generateToken(payload);
      recordServerAuditLog(
        payload,
        "\u0625\u0646\u0634\u0627\u0621 \u0645\u0633\u0624\u0648\u0644 \u0646\u0638\u0627\u0645",
        "\u0627\u0644\u0623\u0645\u0627\u0646 \u0648\u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064A\u0646",
        `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A \u0627\u0644\u0631\u0626\u064A\u0633\u064A (${newAdmin.username}) \u0648\u0625\u063A\u0644\u0627\u0642 \u0645\u0633\u0627\u0631 \u0627\u0644\u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u0639\u0627\u0645\u0629.`,
        req.ip
      );
      return res.json({
        success: true,
        message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0628\u0646\u062C\u0627\u062D \u0648\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u0639\u0627\u0645\u0629.",
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
  apiRouter.get("/auth/me", authenticateToken, (req, res) => {
    const user = storedUsers.find((u) => u.id === req.user?.userId);
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
  apiRouter.post("/auth/logout", authenticateToken, (req, res) => {
    recordServerAuditLog(
      req.user,
      "\u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C",
      "\u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0648\u0627\u0644\u0623\u0645\u0627\u0646",
      `\u0642\u0627\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${req.user?.username} \u0628\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629.`,
      req.ip
    );
    res.json({ success: true, message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C \u0628\u0646\u062C\u0627\u062D." });
  });
  apiRouter.get("/public/settings", (req, res) => {
    const settings = dbState?.settings || {};
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
  apiRouter.get("/public/properties", (req, res) => {
    const properties = (dbState?.properties || []).filter((p) => p.isActive !== false);
    res.json({ success: true, properties });
  });
  apiRouter.get("/public/units", (req, res) => {
    const units = (dbState?.units || []).filter((u) => u.publicationStatus !== "archived");
    res.json({ success: true, units });
  });
  apiRouter.get("/public/content", (req, res) => {
    const sections = (dbState?.contentSections || []).filter((s) => s.enabled !== false);
    res.json({ success: true, contentSections: sections });
  });
  apiRouter.get("/state", authenticateToken, (req, res) => {
    if (!dbState) {
      return res.status(404).json({ success: false, message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062A\u0627\u062D\u0629." });
    }
    const user = req.user;
    if (user.role === "SUPER_ADMIN") {
      return res.json({ success: true, state: dbState, timestamp: lastServerUpdateTimestamp });
    }
    const allowed = user.allowedProperties || [];
    const isUniversal = allowed.includes("all");
    const filteredProperties = isUniversal ? dbState.properties : (dbState.properties || []).filter((p) => allowed.includes(p.id));
    const allowedPropIds = new Set(filteredProperties.map((p) => p.id));
    const filteredUnits = isUniversal ? dbState.units : (dbState.units || []).filter((u) => allowedPropIds.has(u.propertyId));
    const filteredBookings = isUniversal ? dbState.bookings : (dbState.bookings || []).filter((b) => allowedPropIds.has(b.propertyId));
    const filteredLeases = isUniversal ? dbState.leases : (dbState.leases || []).filter((l) => allowedPropIds.has(l.propertyId));
    const filteredExpenses = isUniversal ? dbState.expenses : (dbState.expenses || []).filter((e) => !e.propertyId || allowedPropIds.has(e.propertyId));
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
        users: void 0
      },
      timestamp: lastServerUpdateTimestamp
    });
  });
  apiRouter.post("/state/sync", authenticateToken, (req, res) => {
    const incomingState = req.body;
    const userRole = req.user?.role;
    if (!incomingState || typeof incomingState !== "object") {
      return res.status(400).json({ success: false, message: "\u0635\u064A\u063A\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." });
    }
    if (dbState && Array.isArray(dbState.auditLogs)) {
      const existingAuditIds = new Set(dbState.auditLogs.map((l) => l.id));
      const newLogs = (incomingState.auditLogs || []).filter((l) => !existingAuditIds.has(l.id));
      incomingState.auditLogs = [...dbState.auditLogs, ...newLogs];
    }
    if (userRole !== "SUPER_ADMIN" && dbState?.settings) {
      incomingState.settings = dbState.settings;
    }
    incomingState.users = storedUsers;
    dbState = incomingState;
    const saved = persistState();
    if (saved) {
      res.json({ success: true, timestamp: lastServerUpdateTimestamp });
    } else {
      res.status(500).json({ success: false, message: "\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
    }
  });
  apiRouter.post("/bookings/daily", async (req, res) => {
    try {
      const result = await processDailyReservation(req.body);
      if (dbState && Array.isArray(dbState.bookings)) {
        dbState.bookings.push(result.booking);
        if (Array.isArray(dbState.allocations)) {
          dbState.allocations.push(result.allocation);
        }
        persistState();
      }
      recordServerAuditLog(
        void 0,
        "\u062D\u062C\u0632 \u064A\u0648\u0645\u064A \u062C\u062F\u064A\u062F",
        "\u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0627\u0644\u0641\u0646\u062F\u0642\u064A\u0629",
        `\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u062D\u062C\u0632 \u064A\u0648\u0645\u064A \u0644\u0644\u0648\u062D\u062F\u0629 ${req.body.unitId} \u0644\u0644\u0646\u0632\u064A\u0644 ${req.body.guestName} \u0628\u0642\u064A\u0645\u0629 ${result.totalAmount} \u0631.\u0633. \u0627\u0644\u062F\u0641\u0639 \u0642\u064A\u062F \u0627\u0644\u062A\u062D\u0642\u0642.`
      );
      return res.json({
        success: true,
        message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u064A\u0648\u0645\u064A \u0648\u0625\u0642\u0641\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0632\u0645\u0646\u064A\u0629 \u0644\u0645\u0646\u0639 \u0623\u064A \u062A\u062F\u0627\u062E\u0644 \u0645\u062A\u0632\u0627\u0645\u0646.",
        ...result
      });
    } catch (err) {
      const status = err.statusCode || 400;
      return res.status(status).json({
        success: false,
        message: err.message || "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062D\u062C\u0632."
      });
    }
  });
  apiRouter.post("/leases/contract", async (req, res) => {
    try {
      const result = await processLeaseContract(req.body);
      if (dbState && Array.isArray(dbState.leases)) {
        dbState.leases.push(result.lease);
        if (Array.isArray(dbState.allocations)) {
          dbState.allocations.push(result.allocation);
        }
        persistState();
      }
      recordServerAuditLog(
        void 0,
        "\u0639\u0642\u062F \u062A\u0623\u062C\u064A\u0631 \u062C\u062F\u064A\u062F",
        "\u0639\u0642\u0648\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631",
        `\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 ${req.body.rentalType === "annual" ? "\u0633\u0646\u0648\u064A" : "\u0634\u0647\u0631\u064A"} \u0644\u0644\u0648\u062D\u062F\u0629 ${req.body.unitId} \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${req.body.tenantName}.`
      );
      return res.json({
        success: true,
        message: "\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0639\u0642\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0628\u0646\u062C\u0627\u062D \u0648\u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u0623\u0642\u0633\u0627\u0637 \u0648\u062D\u062C\u0632 \u0643\u0627\u0645\u0644 \u0641\u062A\u0631\u0629 \u0627\u0644\u0639\u0642\u062F.",
        ...result
      });
    } catch (err) {
      const status = err.statusCode || 400;
      return res.status(status).json({
        success: false,
        message: err.message || "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0639\u0642\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631."
      });
    }
  });
  apiRouter.post("/bookings/check-and-reserve", async (req, res) => {
    const { unitId, startDate, endDate, guestName, rentalType, totalAmount } = req.body;
    if (!unitId || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629." });
    }
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (isNaN(start) || isNaN(end) || start >= end) {
      return res.status(400).json({ success: false, message: "\u062A\u0648\u0627\u0631\u064A\u062E \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." });
    }
    const existingBookings = (dbState?.bookings || []).filter((b) => b.unitId === unitId && b.status !== "cancelled");
    const existingAllocations = (dbState?.allocations || []).filter((a) => a.unitId === unitId && a.status === "active");
    const hasBookingConflict = existingBookings.some((b) => {
      const bStart = new Date(b.startDate || b.checkIn).getTime();
      const bEnd = new Date(b.endDate || b.checkOut).getTime();
      return start < bEnd && end > bStart;
    });
    const hasAllocConflict = existingAllocations.some((a) => {
      const aStart = new Date(a.startDate).getTime();
      const aEnd = new Date(a.endDate).getTime();
      return start < aEnd && end > aStart;
    });
    if (hasBookingConflict || hasAllocConflict) {
      return res.status(409).json({
        success: false,
        conflict: true,
        message: "\u0639\u0630\u0631\u0627\u064B\u060C \u0647\u0630\u0647 \u0627\u0644\u0648\u062D\u062F\u0629 \u0645\u062D\u062C\u0648\u0632\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629. \u062A\u0645 \u0625\u0639\u0645\u0627\u0644 \u0642\u0641\u0644 \u0645\u0646\u0639 \u0627\u0644\u062A\u062F\u0627\u062E\u0644 \u0628\u0646\u062C\u0627\u062D."
      });
    }
    const bookingNumber = `LH-${Math.floor(1e5 + Math.random() * 9e5)}`;
    const newBooking = {
      id: `bk_srv_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
      bookingNumber,
      unitId,
      guestName: guestName || "\u0639\u0645\u064A\u0644 \u0645\u062D\u062C\u0648\u0632",
      startDate,
      endDate,
      checkIn: startDate,
      checkOut: endDate,
      rentalType: rentalType || "daily",
      totalAmount: totalAmount || 850,
      status: "confirmed",
      paymentStatus: "pending",
      identityStatus: "pending_verification",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const newAllocation = {
      id: `alloc_${Date.now()}`,
      unitId,
      startDate,
      endDate,
      rentalType: (rentalType || "daily").toUpperCase(),
      referenceId: newBooking.id,
      purpose: "booking",
      status: "active",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
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
      message: "\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062D\u062C\u0632 \u0648\u0625\u0642\u0641\u0627\u0644 \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0632\u0645\u0646\u064A\u0629 \u0644\u0645\u0646\u0639 \u0623\u064A \u062A\u062F\u0627\u062E\u0644 \u0645\u062A\u0632\u0627\u0645\u0646."
    });
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
  apiRouter.post("/admin/import-data", authenticateToken, requireRoles(["SUPER_ADMIN"]), async (req, res) => {
    const { mode, payload } = req.body;
    const dataToImport = payload || dbState;
    if (!dataToImport || typeof dataToImport !== "object") {
      return res.status(400).json({ success: false, message: "\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0631\u0627\u062F \u0627\u0633\u062A\u064A\u0631\u0627\u062F\u0647\u0627 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." });
    }
    const properties = dataToImport.properties || [];
    const units = dataToImport.units || [];
    const bookings = dataToImport.bookings || [];
    const leases = dataToImport.leases || [];
    const expenses = dataToImport.expenses || [];
    const existingPropertyCodes = new Set((dbState?.properties || []).map((p) => p.code));
    const newProperties = properties.filter((p) => !existingPropertyCodes.has(p.code));
    const duplicateProperties = properties.length - newProperties.length;
    const existingUnitKeys = new Set((dbState?.units || []).map((u) => `${u.propertyId}_${u.unitNumber}`));
    const newUnits = units.filter((u) => !existingUnitKeys.has(`${u.propertyId}_${u.unitNumber}`));
    const duplicateUnits = units.length - newUnits.length;
    const existingBookingNumbers = new Set((dbState?.bookings || []).map((b) => b.bookingNumber));
    const newBookings = bookings.filter((b) => !existingBookingNumbers.has(b.bookingNumber));
    const duplicateBookings = bookings.length - newBookings.length;
    const previewSummary = {
      properties: { total: properties.length, newRecords: newProperties.length, duplicatesSkipped: duplicateProperties },
      units: { total: units.length, newRecords: newUnits.length, duplicatesSkipped: duplicateUnits },
      bookings: { total: bookings.length, newRecords: newBookings.length, duplicatesSkipped: duplicateBookings },
      leases: { total: leases.length, newRecords: leases.length, duplicatesSkipped: 0 },
      expenses: { total: expenses.length, newRecords: expenses.length, duplicatesSkipped: 0 }
    };
    if (mode === "preview") {
      return res.json({
        success: true,
        mode: "preview",
        message: "\u062A\u0645\u062A \u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u062D\u0635\u0631 \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0628\u0646\u062C\u0627\u062D \u0645\u0639 \u0643\u0634\u0641 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0645\u0643\u0631\u0631\u0629.",
        preview: previewSummary
      });
    }
    if (mode === "commit") {
      dbState.properties = [...dbState.properties || [], ...newProperties];
      dbState.units = [...dbState.units || [], ...newUnits];
      dbState.bookings = [...dbState.bookings || [], ...newBookings];
      dbState.leases = [...dbState.leases || [], ...leases];
      dbState.expenses = [...dbState.expenses || [], ...expenses];
      persistState();
      recordServerAuditLog(
        req.user,
        "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0646\u0636\u0628\u0637",
        "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u062A\u0631\u062D\u064A\u0644",
        `\u062A\u0645 \u0627\u0633\u062A\u064A\u0631\u0627\u062F ${newProperties.length} \u0645\u0628\u0627\u0646\u064A \u0648 ${newUnits.length} \u0648\u062D\u062F\u0627\u062A \u0648 ${newBookings.length} \u062D\u062C\u0648\u0632\u0627\u062A \u0645\u0639 \u062A\u062E\u0637\u064A \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0643\u0631\u0631\u0629.`,
        req.ip
      );
      return res.json({
        success: true,
        mode: "commit",
        message: "\u062A\u0645 \u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0648\u062D\u0641\u0638\u0647\u0627 \u0628\u0646\u062C\u0627\u062D \u0645\u0639 \u0627\u0633\u062A\u0628\u0639\u0627\u062F \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0643\u0631\u0631\u0629.",
        imported: previewSummary
      });
    }
    return res.status(400).json({ success: false, message: "\u0648\u0636\u0639 \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 preview \u0623\u0648 commit." });
  });
  apiRouter.post("/backup/export", authenticateToken, requireRoles(["SUPER_ADMIN"]), (req, res) => {
    if (!dbState) return res.status(400).json({ success: false, message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0644\u0644\u062A\u0635\u062F\u064A\u0631." });
    const backupFileName = `backup_${Date.now()}.json`;
    const backupFilePath = path2.join(BACKUP_DIR, backupFileName);
    try {
      const sanitizedState = {
        ...dbState,
        users: storedUsers.map((u) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          name: u.name,
          role: u.role,
          allowedProperties: u.allowedProperties,
          createdAt: u.createdAt
        }))
      };
      fs.writeFileSync(backupFilePath, JSON.stringify(sanitizedState, null, 2), "utf-8");
      recordServerAuditLog(
        req.user,
        "\u062A\u0635\u062F\u064A\u0631 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629",
        "\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A",
        `\u062A\u0645 \u062A\u0635\u062F\u064A\u0631 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u062C\u062F\u064A\u062F\u0629 \u0644\u0644\u0646\u0638\u0627\u0645: ${backupFileName}`,
        req.ip
      );
      res.json({
        success: true,
        message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0648\u062D\u0641\u0638 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0628\u0646\u062C\u0627\u062D \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645.",
        backupFile: backupFileName,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (e) {
      res.status(500).json({ success: false, message: "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629." });
    }
  });
  apiRouter.post("/backup/restore", authenticateToken, requireRoles(["SUPER_ADMIN"]), (req, res) => {
    const { backupFileName } = req.body;
    if (!backupFileName) return res.status(400).json({ success: false, message: "\u0627\u0633\u0645 \u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0645\u0637\u0644\u0648\u0628." });
    const backupFilePath = path2.join(BACKUP_DIR, backupFileName);
    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, message: "\u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    try {
      const data = fs.readFileSync(backupFilePath, "utf-8");
      const restoredState = JSON.parse(data);
      if (!restoredState || typeof restoredState !== "object") {
        return res.status(400).json({ success: false, message: "\u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u062A\u0627\u0644\u0641 \u0623\u0648 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D." });
      }
      restoredState.users = storedUsers;
      dbState = restoredState;
      persistState();
      recordServerAuditLog(
        req.user,
        "\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629",
        "\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A",
        `\u062A\u0645\u062A \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u062D\u0627\u0644\u0629 \u0627\u0644\u0646\u0638\u0627\u0645 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0645\u0646 \u0627\u0644\u0645\u0644\u0641: ${backupFileName}`,
        req.ip
      );
      res.json({
        success: true,
        message: "\u062A\u0645\u062A \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D \u0648\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0646\u0638\u0627\u0645 \u0628\u0627\u0644\u0643\u0627\u0645\u0644.",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (e) {
      res.status(500).json({ success: false, message: "\u0641\u0634\u0644 \u0642\u0631\u0627\u0621\u0629 \u0648\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629." });
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
