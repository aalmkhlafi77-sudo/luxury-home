import {
  Lease,
  LeaseInstallment,
  PaymentRecord,
  SecurityDepositRecord,
  TenantAdjustment,
  TenantLedgerEntry,
  OperationalExpense,
  Property,
  Unit
} from '../types';
import type { AppState } from '../store/useAppStore';

export interface TenantStatementSummary {
  totalInvoiced: number;       // المبالغ المفوترة الإجمالية
  dueToDate: number;           // المبالغ المستحقة حتى تاريخه
  overdueAmount: number;       // المبالغ المتأخرة غير المدفوعة
  futureDues: number;          // دفعات مستقبلية غير مستحقة بعد
  totalCollected: number;      // إجمالي المحصل الفعلي للرصيد
  adjustmentsTotal: number;    // التعديلات والتخفيضات الكلية
  unallocatedCredit: number;   // الرصيد الدائن الحر غير المخصص
  currentNetBalance: number;   // الرصيد المستحق الصافي
  securityDepositHeld: number; // مبلغ تأمين العقد المحتجز
}

export interface TenantStatementResult {
  tenantName: string;
  nationalIdOrPassport: string;
  phone: string;
  email: string;
  entries: TenantLedgerEntry[];
  summary: TenantStatementSummary;
  associatedLeases: Lease[];
  associatedDeposits: SecurityDepositRecord[];
}

/**
 * Generate unified Tenant Statement of Account
 */
export function generateTenantStatement(
  state: AppState,
  filter: {
    tenantIdentifier?: string; // name, nationalId, or phone
    leaseId?: string;
    propertyId?: string;
    unitId?: string;
    startDate?: string;
    endDate?: string;
  }
): TenantStatementResult {
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Identify relevant leases
  let leases = state.leases || [];
  if (filter.leaseId && filter.leaseId !== 'all') {
    leases = leases.filter(l => l.id === filter.leaseId);
  }
  if (filter.propertyId && filter.propertyId !== 'all') {
    leases = leases.filter(l => l.propertyId === filter.propertyId);
  }
  if (filter.unitId) {
    leases = leases.filter(l => l.unitId === filter.unitId);
  }
  if (filter.tenantIdentifier) {
    const q = filter.tenantIdentifier.trim().toLowerCase();
    leases = leases.filter(l =>
      l.tenant.fullName.toLowerCase().includes(q) ||
      l.tenant.nationalIdOrPassport.toLowerCase().includes(q) ||
      l.tenant.phone.includes(q)
    );
  }

  // Pick primary tenant info
  const primaryLease = leases[0] || state.leases[0];
  const tenantName = primaryLease?.tenant.fullName || 'لا يوجد مستأجر محدد';
  const nationalId = primaryLease?.tenant.nationalIdOrPassport || '';
  const phone = primaryLease?.tenant.phone || '';
  const email = primaryLease?.tenant.email || '';

  // 2. Identify relevant deposits (isolated from rent revenues)
  const leaseIds = new Set(leases.map(l => l.id));
  const relevantDeposits = (state.securityDeposits || []).filter(d =>
    leaseIds.has(d.bookingOrLeaseId) ||
    (nationalId && d.bookingOrLeaseId === primaryLease?.id) ||
    (filter.tenantIdentifier && d.guestName.toLowerCase().includes(filter.tenantIdentifier.toLowerCase()))
  );

  // 3. Identify relevant adjustments
  const relevantAdjustments = (state.adjustments || []).filter(a =>
    leaseIds.has(a.leaseId) ||
    (nationalId && a.tenantNationalId === nationalId)
  );

  // 4. Build Ledger Items
  interface RawEntry {
    date: string;
    dueDate?: string;
    type: TenantLedgerEntry['type'];
    referenceNumber: string;
    contractNumber: string;
    unitNumber: string;
    description: string;
    debitAmount: number;
    creditAmount: number;
    status?: string;
  }

  const rawEntries: RawEntry[] = [];

  // Add debits for installments
  leases.forEach(lease => {
    const unit = state.units.find(u => u.id === lease.unitId);
    const unitNo = unit?.unitNumber || lease.unitId;

    (lease.installments || []).forEach(inst => {
      rawEntries.push({
        date: inst.dueDate || lease.startDate,
        dueDate: inst.dueDate,
        type: 'due_rent',
        referenceNumber: `INV-${lease.contractNumber}-I${inst.installmentNumber}`,
        contractNumber: lease.contractNumber,
        unitNumber: unitNo,
        description: `قسط الإيجار المفوتر - الدفعة رقم ${inst.installmentNumber} (${inst.label || ''})`,
        debitAmount: inst.amount,
        creditAmount: 0,
        status: inst.status,
      });

      // Add payment credits recorded against this installment
      if (inst.payments && inst.payments.length > 0) {
        inst.payments.forEach(p => {
          rawEntries.push({
            date: p.date.slice(0, 10),
            type: 'payment_received',
            referenceNumber: p.receiptNo || p.paymentId,
            contractNumber: lease.contractNumber,
            unitNumber: unitNo,
            description: `سداد الدفعة رقم ${inst.installmentNumber} - سند رقم #${p.receiptNo || ''} (${formatPaymentMethod(p.method)})`,
            debitAmount: 0,
            creditAmount: p.amount,
            status: 'success'
          });
        });
      }
    });
  });

  // Add payments from global state linked to this tenant that may have unallocated credits
  (state.payments || []).forEach(p => {
    if (p.referenceType === 'lease_installment') {
      // already counted in installment.payments or standalone
    } else if (p.unallocatedAmount && p.unallocatedAmount > 0 && nationalId && p.tenantNationalId === nationalId) {
      rawEntries.push({
        date: p.createdAt.slice(0, 10),
        type: 'payment_received',
        referenceNumber: p.receiptNumber || p.transactionId,
        contractNumber: '-',
        unitNumber: '-',
        description: `دفعة مسبقة غير مخصصة - رصيد دائن حر حائز على الحساب`,
        debitAmount: 0,
        creditAmount: p.unallocatedAmount,
        status: 'success'
      });
    }
  });

  // Add Adjustments / Waivers / Discounts
  relevantAdjustments.forEach(adj => {
    const targetLease = state.leases.find(l => l.id === adj.leaseId);
    const unit = state.units.find(u => u.id === targetLease?.unitId);
    const typeLabels: Record<string, string> = {
      discount: 'خصم معتمد',
      waiver: 'إعفاء مالي',
      compensation: 'تعويض مالي',
      reversal: 'عكس قيد تسوية'
    };

    rawEntries.push({
      date: adj.createdAt.slice(0, 10),
      type: 'adjustment',
      referenceNumber: `ADJ-${adj.id.slice(-6)}`,
      contractNumber: targetLease?.contractNumber || '',
      unitNumber: unit?.unitNumber || '-',
      description: `${typeLabels[adj.type] || 'تسوية'}: ${adj.reason} (باعتماد: ${adj.authorizedBy})`,
      debitAmount: 0,
      creditAmount: adj.amount,
      status: 'success'
    });
  });

  // Filter by date if provided
  let filteredRaw = rawEntries;
  if (filter.startDate) {
    filteredRaw = filteredRaw.filter(e => e.date >= filter.startDate!);
  }
  if (filter.endDate) {
    filteredRaw = filteredRaw.filter(e => e.date <= filter.endDate!);
  }

  // Sort chronologically
  filteredRaw.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    // debits first on same day
    return b.debitAmount - a.debitAmount;
  });

  // Calculate Running Balance
  let running = 0;
  const ledgerEntries: TenantLedgerEntry[] = filteredRaw.map((item, idx) => {
    running = running + item.debitAmount - item.creditAmount;
    return {
      id: `entry-${idx + 1}-${item.referenceNumber}`,
      date: item.date,
      dueDate: item.dueDate,
      type: item.type,
      referenceNumber: item.referenceNumber,
      contractNumber: item.contractNumber,
      unitNumber: item.unitNumber,
      description: item.description,
      debitAmount: item.debitAmount,
      creditAmount: item.creditAmount,
      runningBalance: Math.max(0, running),
      status: item.status,
    };
  });

  // Calculate Summary Metrics
  let totalInvoiced = 0;
  let dueToDate = 0;
  let overdueAmount = 0;
  let futureDues = 0;
  let totalCollected = 0;
  let adjustmentsTotal = 0;

  leases.forEach(lease => {
    (lease.installments || []).forEach(inst => {
      totalInvoiced += inst.amount;
      totalCollected += inst.paidAmount;
      const isDue = inst.dueDate <= todayStr;
      if (isDue) {
        dueToDate += inst.amount;
        if (inst.remainingAmount > 0) {
          overdueAmount += inst.remainingAmount;
        }
      } else {
        futureDues += inst.remainingAmount;
      }
    });
  });

  relevantAdjustments.forEach(adj => {
    adjustmentsTotal += adj.amount;
  });

  const unallocatedCredit = (state.payments || [])
    .filter(p => nationalId && p.tenantNationalId === nationalId && (p.unallocatedAmount || 0) > 0)
    .reduce((sum, p) => sum + (p.unallocatedAmount || 0), 0);

  const securityDepositHeld = relevantDeposits
    .reduce((sum, d) => {
      const collected = d.collectedAmount ?? d.amount ?? 0;
      const refunded = d.refundedAmount ?? d.refundAmount ?? 0;
      const damage = d.deductedAmount ?? (d.deductions || []).reduce((s, x) => s + x.amount, 0);
      const applied = d.rentAppliedAmount ?? 0;
      const avail = Math.max(0, collected - refunded - damage - applied);
      return sum + avail;
    }, 0);

  // currentNetBalance is total due to date minus paid, minus adjustments
  const currentNetBalance = Math.max(0, dueToDate - totalCollected - adjustmentsTotal);

  return {
    tenantName,
    nationalIdOrPassport: nationalId,
    phone,
    email,
    entries: ledgerEntries,
    summary: {
      totalInvoiced,
      dueToDate,
      overdueAmount,
      futureDues,
      totalCollected,
      adjustmentsTotal,
      unallocatedCredit,
      currentNetBalance,
      securityDepositHeld,
    },
    associatedLeases: leases,
    associatedDeposits: relevantDeposits,
  };
}

export interface AgingBucket {
  periodLabel: string;
  daysRange: string;
  totalAmount: number;
  count: number;
  installments: {
    leaseId: string;
    contractNumber: string;
    tenantName: string;
    tenantPhone: string;
    unitNumber: string;
    propertyName: string;
    installmentNumber: number;
    label: string;
    dueDate: string;
    daysOverdue: number;
    amount: number;
    paidAmount: number;
    remainingAmount: number;
  }[];
}

/**
 * Aging of Receivables Report
 */
export function calculateAgingReport(state: AppState): {
  buckets: {
    under30: AgingBucket;
    days30to60: AgingBucket;
    days60to90: AgingBucket;
    over90: AgingBucket;
  };
  totalOverdue: number;
  totalDelinquentTenantsCount: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = {
    under30: { periodLabel: 'متأخرات حديثة (أقل من ٣٠ يوم)', daysRange: '١ - ٣٠ يوم', totalAmount: 0, count: 0, installments: [] as any[] },
    days30to60: { periodLabel: 'متأخرات متوسطة (٣٠ إلى ٦٠ يوم)', daysRange: '٣١ - ٦٠ يوم', totalAmount: 0, count: 0, installments: [] as any[] },
    days60to90: { periodLabel: 'متأخرات عالية الخطورة (٦٠ إلى ٩٠ يوم)', daysRange: '٦١ - ٩٠ يوم', totalAmount: 0, count: 0, installments: [] as any[] },
    over90: { periodLabel: 'ديون متعثرة (أكثر من ٩٠ يوم)', daysRange: 'أكثر من ٩٠ يوم', totalAmount: 0, count: 0, installments: [] as any[] },
  };

  const delinquentTenants = new Set<string>();

  (state.leases || []).forEach(lease => {
    const prop = state.properties.find(p => p.id === lease.propertyId);
    const unit = state.units.find(u => u.id === lease.unitId);

    (lease.installments || []).forEach(inst => {
      if (inst.remainingAmount <= 0) return;

      const dueDate = new Date(inst.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - dueDate.getTime();
      const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (daysOverdue > 0) {
        delinquentTenants.add(lease.tenant.nationalIdOrPassport || lease.tenant.fullName);
        const item = {
          leaseId: lease.id,
          contractNumber: lease.contractNumber,
          tenantName: lease.tenant.fullName,
          tenantPhone: lease.tenant.phone,
          unitNumber: unit?.unitNumber || lease.unitId,
          propertyName: prop?.name || 'مبنى منزل الفخامة',
          installmentNumber: inst.installmentNumber,
          label: inst.label || `الدفعة رقم ${inst.installmentNumber}`,
          dueDate: inst.dueDate,
          daysOverdue,
          amount: inst.amount,
          paidAmount: inst.paidAmount,
          remainingAmount: inst.remainingAmount,
        };

        if (daysOverdue <= 30) {
          buckets.under30.totalAmount += inst.remainingAmount;
          buckets.under30.count += 1;
          buckets.under30.installments.push(item);
        } else if (daysOverdue <= 60) {
          buckets.days30to60.totalAmount += inst.remainingAmount;
          buckets.days30to60.count += 1;
          buckets.days30to60.installments.push(item);
        } else if (daysOverdue <= 90) {
          buckets.days60to90.totalAmount += inst.remainingAmount;
          buckets.days60to90.count += 1;
          buckets.days60to90.installments.push(item);
        } else {
          buckets.over90.totalAmount += inst.remainingAmount;
          buckets.over90.count += 1;
          buckets.over90.installments.push(item);
        }
      }
    });
  });

  const totalOverdue =
    buckets.under30.totalAmount +
    buckets.days30to60.totalAmount +
    buckets.days60to90.totalAmount +
    buckets.over90.totalAmount;

  return {
    buckets,
    totalOverdue,
    totalDelinquentTenantsCount: delinquentTenants.size,
  };
}

export interface CashFlowPeriod {
  label: string;
  rangeDays: string;
  expectedInflow: number;
  count: number;
  installments: {
    leaseId: string;
    contractNumber: string;
    tenantName: string;
    unitNumber: string;
    propertyName: string;
    dueDate: string;
    amount: number;
    remainingAmount: number;
  }[];
}

/**
 * Expected Cash Flow Forecast
 */
export function calculateCashFlowForecast(state: AppState): {
  next30Days: CashFlowPeriod;
  nextQuarter: CashFlowPeriod;
  nextYear: CashFlowPeriod;
  totalProjectedInflow: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next30Days: CashFlowPeriod = { label: 'الأيام الـ ٣٠ القادمة', rangeDays: '٠ - ٣٠ يوم', expectedInflow: 0, count: 0, installments: [] };
  const nextQuarter: CashFlowPeriod = { label: 'الربع القادم (من ٣١ إلى ٩٠ يوم)', rangeDays: '٣١ - ٩٠ يوم', expectedInflow: 0, count: 0, installments: [] };
  const nextYear: CashFlowPeriod = { label: 'باقي العام (من ٩١ إلى ٣٦٥ يوم)', rangeDays: '٩١ - ٣٦٥ يوم', expectedInflow: 0, count: 0, installments: [] };

  (state.leases || []).forEach(lease => {
    const prop = state.properties.find(p => p.id === lease.propertyId);
    const unit = state.units.find(u => u.id === lease.unitId);

    (lease.installments || []).forEach(inst => {
      if (inst.remainingAmount <= 0) return;

      const dueDate = new Date(inst.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - today.getTime();
      const daysAhead = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (daysAhead >= 0 && daysAhead <= 365) {
        const item = {
          leaseId: lease.id,
          contractNumber: lease.contractNumber,
          tenantName: lease.tenant.fullName,
          unitNumber: unit?.unitNumber || lease.unitId,
          propertyName: prop?.name || 'مبنى منزل الفخامة',
          dueDate: inst.dueDate,
          amount: inst.amount,
          remainingAmount: inst.remainingAmount,
        };

        if (daysAhead <= 30) {
          next30Days.expectedInflow += inst.remainingAmount;
          next30Days.count += 1;
          next30Days.installments.push(item);
        } else if (daysAhead <= 90) {
          nextQuarter.expectedInflow += inst.remainingAmount;
          nextQuarter.count += 1;
          nextQuarter.installments.push(item);
        } else {
          nextYear.expectedInflow += inst.remainingAmount;
          nextYear.count += 1;
          nextYear.installments.push(item);
        }
      }
    });
  });

  return {
    next30Days,
    nextQuarter,
    nextYear,
    totalProjectedInflow: next30Days.expectedInflow + nextQuarter.expectedInflow + nextYear.expectedInflow,
  };
}

/**
 * Occupancy and Revenue Variance Report
 */
export function calculateOccupancyFinancials(state: AppState) {
  const units = state.units || [];
  const totalUnitsCount = units.length;
  const occupiedCount = units.filter(u => u.occupancyStatus !== 'vacant').length;
  const vacantCount = totalUnitsCount - occupiedCount;
  const occupancyRate = totalUnitsCount > 0 ? (occupiedCount / totalUnitsCount) * 100 : 0;

  // Monthly potential target revenue (sum of monthlyRates or (dailyRate * 30))
  let monthlyPotentialRevenue = 0;
  let actualContractedMonthlyRevenue = 0;
  let vacancyLossMonthly = 0;

  units.forEach(u => {
    const nominalMonthly = u.monthlyRate || (u.dailyRate * 26);
    monthlyPotentialRevenue += nominalMonthly;
    if (u.occupancyStatus === 'vacant') {
      vacancyLossMonthly += nominalMonthly;
    } else {
      actualContractedMonthlyRevenue += nominalMonthly;
    }
  });

  // Actual cash collected this month
  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  let cashCollectedThisMonth = 0;

  (state.payments || []).forEach(p => {
    if (p.status === 'success' && p.createdAt.startsWith(currentMonthStr)) {
      cashCollectedThisMonth += p.amount;
    }
  });

  const collectionEfficiency = actualContractedMonthlyRevenue > 0
    ? Math.min(100, (cashCollectedThisMonth / actualContractedMonthlyRevenue) * 100)
    : 0;

  return {
    totalUnitsCount,
    occupiedCount,
    vacantCount,
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    monthlyPotentialRevenue,
    actualContractedMonthlyRevenue,
    vacancyLossMonthly,
    cashCollectedThisMonth,
    collectionEfficiency: Math.round(collectionEfficiency * 10) / 10,
  };
}

export interface UnitProfitabilityRow {
  unitId: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  areaSqm: number;
  collectedRevenue: number;     // الإيرادات المحصلة
  directExpenses: number;       // المصاريف التشغيلية المباشرة
  sharedExpensesAllocated: number; // المصاريف المشتركة الموزعة
  totalOperatingExpense: number; // إجمالي تكلفة التشغيل OPEX
  ffeCapitalAmount: number;     // مصاريف الأثاث الرأسمالية (مستثناة من المرجو في NOI)
  noi: number;                  // صافي دخل التشغيل NOI
  operatingMarginPercent: number; // هامش ربح التشغيل ٪
}

export interface PropertyProfitabilityRow {
  propertyId: string;
  propertyName: string;
  unitsCount: number;
  totalAreaSqm: number;
  collectedRevenue: number;
  directExpenses: number;
  sharedBuildingExpenses: number;
  totalOperatingExpense: number;
  ffeCapitalTotal: number;
  noi: number;
  operatingMarginPercent: number;
  unitsBreakdown: UnitProfitabilityRow[];
}

/**
 * Unit & Property Net Operating Income (NOI) and Profitability Report
 */
export function calculateProfitabilityReport(state: AppState): {
  properties: PropertyProfitabilityRow[];
  companyTotalRevenue: number;
  companyTotalOpex: number;
  companyTotalNOI: number;
  companyMarginPercent: number;
  companyFfeCapital: number;
} {
  const units = state.units || [];
  const properties = state.properties || [];
  const expenses = state.expenses || [];
  const leases = state.leases || [];
  const bookings = state.bookings || [];

  // Map revenues to units
  const unitRevenueMap: Record<string, number> = {};
  units.forEach(u => { unitRevenueMap[u.id] = 0; });

  // Add booking payments
  bookings.forEach(bk => {
    if (bk.status !== 'cancelled' && unitRevenueMap[bk.unitId] !== undefined) {
      unitRevenueMap[bk.unitId] += (bk.totalAmount || 0);
    }
  });

  // Add lease installment collected payments
  leases.forEach(lease => {
    if (unitRevenueMap[lease.unitId] !== undefined) {
      (lease.installments || []).forEach(inst => {
        unitRevenueMap[lease.unitId] += inst.paidAmount;
      });
    }
  });

  // Map expenses
  const unitDirectExpMap: Record<string, number> = {};
  const unitSharedExpMap: Record<string, number> = {};
  const unitFfeMap: Record<string, number> = {};

  units.forEach(u => {
    unitDirectExpMap[u.id] = 0;
    unitSharedExpMap[u.id] = 0;
    unitFfeMap[u.id] = 0;
  });

  const propertySharedExpMap: Record<string, number> = {};
  const propertyFfeMap: Record<string, number> = {};

  properties.forEach(p => {
    propertySharedExpMap[p.id] = 0;
    propertyFfeMap[p.id] = 0;
  });

  expenses.forEach(exp => {
    // If FF&E capital purchase, isolate it
    if (exp.isFfeOrEquipment) {
      if (exp.unitId && unitFfeMap[exp.unitId] !== undefined) {
        unitFfeMap[exp.unitId] += exp.amount;
      }
      if (exp.propertyId && propertyFfeMap[exp.propertyId] !== undefined) {
        propertyFfeMap[exp.propertyId] += exp.amount;
      }
      return; // Do not include in operational OPEX!
    }

    if (exp.level === 'unit' && exp.unitId) {
      if (unitDirectExpMap[exp.unitId] !== undefined) {
        unitDirectExpMap[exp.unitId] += exp.amount;
      }
    } else if (exp.level === 'property' && exp.propertyId) {
      propertySharedExpMap[exp.propertyId] = (propertySharedExpMap[exp.propertyId] || 0) + exp.amount;

      // Distribute to property units based on distribution shares or rules
      const propUnits = units.filter(u => u.propertyId === exp.propertyId);
      if (propUnits.length === 0) return;

      if (exp.distributionShares && exp.distributionShares.length > 0) {
        exp.distributionShares.forEach(share => {
          if (unitSharedExpMap[share.unitId] !== undefined) {
            unitSharedExpMap[share.unitId] += share.amount;
          }
        });
      } else if (exp.distributionType === 'by_area') {
        const totalArea = propUnits.reduce((sum, u) => sum + (u.areaSqm || 50), 0);
        propUnits.forEach(u => {
          const ratio = (u.areaSqm || 50) / (totalArea || 1);
          unitSharedExpMap[u.id] += Math.round(exp.amount * ratio);
        });
      } else if (exp.distributionType === 'equal') {
        const share = Math.round(exp.amount / propUnits.length);
        propUnits.forEach(u => {
          unitSharedExpMap[u.id] += share;
        });
      }
    } else if (exp.level === 'company') {
      // Split evenly across all units
      const share = Math.round(exp.amount / (units.length || 1));
      units.forEach(u => {
        unitSharedExpMap[u.id] += share;
      });
    }
  });

  // Build property results
  let companyTotalRevenue = 0;
  let companyTotalOpex = 0;
  let companyFfeCapital = 0;

  const propertyReports: PropertyProfitabilityRow[] = properties.map(prop => {
    const propUnits = units.filter(u => u.propertyId === prop.id);
    let propRevenue = 0;
    let propDirectExp = 0;
    let propSharedExpAlloc = 0;
    let propFfe = propertyFfeMap[prop.id] || 0;

    const unitsBreakdown: UnitProfitabilityRow[] = propUnits.map(unit => {
      const rev = unitRevenueMap[unit.id] || 0;
      const direct = unitDirectExpMap[unit.id] || 0;
      const shared = unitSharedExpMap[unit.id] || 0;
      const ffe = unitFfeMap[unit.id] || 0;

      const totalOpex = direct + shared;
      const noi = rev - totalOpex;
      const margin = rev > 0 ? (noi / rev) * 100 : 0;

      propRevenue += rev;
      propDirectExp += direct;
      propSharedExpAlloc += shared;
      propFfe += ffe;

      return {
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        propertyId: prop.id,
        propertyName: prop.name,
        areaSqm: unit.areaSqm,
        collectedRevenue: rev,
        directExpenses: direct,
        sharedExpensesAllocated: shared,
        totalOperatingExpense: totalOpex,
        ffeCapitalAmount: ffe,
        noi,
        operatingMarginPercent: Math.round(margin * 10) / 10,
      };
    });

    const propTotalOpex = propDirectExp + (propertySharedExpMap[prop.id] || propSharedExpAlloc);
    const propNoi = propRevenue - propTotalOpex;
    const propMargin = propRevenue > 0 ? (propNoi / propRevenue) * 100 : 0;

    companyTotalRevenue += propRevenue;
    companyTotalOpex += propTotalOpex;
    companyFfeCapital += propFfe;

    return {
      propertyId: prop.id,
      propertyName: prop.name,
      unitsCount: propUnits.length,
      totalAreaSqm: propUnits.reduce((sum, u) => sum + (u.areaSqm || 0), 0),
      collectedRevenue: propRevenue,
      directExpenses: propDirectExp,
      sharedBuildingExpenses: propertySharedExpMap[prop.id] || propSharedExpAlloc,
      totalOperatingExpense: propTotalOpex,
      ffeCapitalTotal: propFfe,
      noi: propNoi,
      operatingMarginPercent: Math.round(propMargin * 10) / 10,
      unitsBreakdown,
    };
  });

  const companyTotalNOI = companyTotalRevenue - companyTotalOpex;
  const companyMarginPercent = companyTotalRevenue > 0
    ? Math.round((companyTotalNOI / companyTotalRevenue) * 1000) / 10
    : 0;

  return {
    properties: propertyReports,
    companyTotalRevenue,
    companyTotalOpex,
    companyTotalNOI,
    companyMarginPercent,
    companyFfeCapital,
  };
}

function formatPaymentMethod(method?: string): string {
  switch (method) {
    case 'mada': return 'مدى';
    case 'visa_mastercard': return 'فيزا/ماستركارد';
    case 'apple_pay': return 'أبل باي';
    case 'bank_transfer': return 'حوالة مصرفية';
    case 'cash': return 'نقدًا';
    case 'company_card': return 'بطاقة الشركة';
    case 'check': return 'شيك مصرفي';
    default: return 'أخرى';
  }
}

// --- Temporal & Cost Allocation Engine (Accrual Accounting & Decoupled Cash Flow) ---

export interface AccrualReportingOptions {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  propertyId?: string; // 'all' or specific property id
  costAllocationMode?: 'direct_only' | 'fully_allocated'; // التكلفة المباشرة فقط أو التكلفة الشاملة الموزعة
  includeDrafts?: boolean;
}

export interface UnitAccrualRow {
  unitId: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  areaSqm: number;
  periodRevenue: number;
  directOperatingExpense: number;
  allocatedBuildingExpense: number;
  allocatedCompanyExpense: number;
  effectiveOperatingExpense: number;
  ffeCapitalExpense: number;
  noi: number;
  operatingMarginPercent: number;
  categoryBreakdown: Record<string, number>;
}

export interface PropertyAccrualRow {
  propertyId: string;
  propertyName: string;
  unitsCount: number;
  totalAreaSqm: number;
  periodRevenue: number;
  directOperatingExpense: number;
  sharedBuildingExpense: number;
  allocatedCompanyExpense: number;
  totalOperatingExpense: number;
  ffeCapitalExpense: number;
  noi: number;
  operatingMarginPercent: number;
  unitsBreakdown: UnitAccrualRow[];
  categoryBreakdown: Record<string, number>;
}

export interface AccrualProfitabilityReport {
  periodStart: string;
  periodEnd: string;
  costAllocationMode: 'direct_only' | 'fully_allocated';
  companyTotalRevenue: number;
  companyDirectOpex: number;
  companyAllocatedOpex: number;
  companyTotalOpex: number;
  companyTotalNOI: number;
  companyMarginPercent: number;
  companyFfeCapital: number;
  properties: PropertyAccrualRow[];
  categorySummary: {
    category: string;
    categoryLabel: string;
    totalAccruedAmount: number;
    isCapitalFfe: boolean;
    count: number;
  }[];
}

export interface CashOutflowEntry {
  paymentId: string;
  expenseId: string;
  expenseNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  receiptReference?: string;
  vendorOrBeneficiary: string;
  category: string;
  categoryLabel: string;
  level: string;
  propertyName?: string;
  unitNumber?: string;
  description: string;
  isFfeOrEquipment: boolean;
  recordedBy: string;
}

export interface CashOutflowReport {
  periodStart: string;
  periodEnd: string;
  totalOutflow: number;
  operatingOutflow: number;
  capitalFfeOutflow: number;
  entries: CashOutflowEntry[];
  byCategory: Record<string, { label: string; amount: number; count: number }>;
  byPaymentMethod: Record<string, number>;
}

export function getExpenseCategoryLabel(category: string): string {
  switch (category) {
    case 'building_rent': return 'إيجار المباني';
    case 'admin_salaries': return 'الرواتب الإدارية';
    case 'building_staff_salaries': return 'رواتب موظفي المباني والحراس';
    case 'marketing_advertising': return 'الدعاية والتسويق';
    case 'electricity': return 'الكهرباء';
    case 'water': return 'المياه';
    case 'internet': return 'الإنترنت';
    case 'cleaning_supplies': return 'النظافة والمستلزمات';
    case 'building_common_maintenance': return 'صيانة المباني والمرافق المشتركة';
    case 'unit_appliances_maintenance': return 'صيانة أجهزة الوحدات';
    case 'government_fees_licenses': return 'الرسوم الحكومية والرخص';
    case 'payment_fees_commissions': return 'رسوم الدفع والعمولات';
    case 'furniture_appliances': return 'شراء الأثاث والأجهزة (FF&E)';
    case 'maintenance': return 'صيانة عامة';
    case 'cleaning': return 'نظافة وضيافة';
    case 'utilities': return 'خدمات وفواتير';
    case 'commissions_fees': return 'عمولات وبوابات';
    default: return 'مصاريف تشغيل أخرى';
  }
}

export function getCostCenterLevelLabel(level: string): string {
  switch (level) {
    case 'company': return 'الشركة العامة';
    case 'property': return 'المبنى / المجمع';
    case 'unit': return 'الوحدة السكنية';
    default: return level;
  }
}

export function getTemporalDistributionLabel(type?: string): string {
  switch (type) {
    case 'equal_monthly': return 'توزيع بالتساوي على الأشهر';
    case 'actual_days': return 'حساب بالأيام الفعلية للتغطية';
    case 'custom_schedule': return 'جدول زمني مخصص';
    case 'instant':
    default: return 'تحميل كامل فوري على تاريخ القيد';
  }
}

export function getCostAllocationMethodLabel(method?: string): string {
  switch (method) {
    case 'by_area': return 'بنسبة مساحة الوحدات (م²)';
    case 'equal_units': return 'بالتساوي على الوحدات المستفيدة';
    case 'by_revenue': return 'بنسبة الدخل الفعلي للوحدات';
    case 'by_occupancy_days': return 'بنسبة أيام الإشغال الفعلية';
    case 'custom_units': return 'توزيع مخصص بنسب ومبالغ';
    case 'direct_unit':
    default: return 'تحميل مباشر على الوحدة';
  }
}

/**
 * Calculates the accrued cost of an expense for a target reporting period [periodStart, periodEnd].
 * Separates the cash outflow date from the accrual coverage period.
 */
export function calculateExpenseTemporalAccrual(
  exp: OperationalExpense,
  periodStart: string,
  periodEnd: string
): number {
  if (exp.recordStatus === 'reversed') return 0;

  const method = exp.temporalDistribution || 'instant';

  if (method === 'instant') {
    // Falls entirely on exp.date
    if (exp.date >= periodStart && exp.date <= periodEnd) {
      return exp.amount;
    }
    return 0;
  }

  const covStart = exp.servicePeriodStart || exp.date;
  const covEnd = exp.servicePeriodEnd || covStart;

  const tCovStart = new Date(`${covStart}T00:00:00`).getTime();
  const tCovEnd = new Date(`${covEnd}T23:59:59`).getTime();
  const tRepStart = new Date(`${periodStart}T00:00:00`).getTime();
  const tRepEnd = new Date(`${periodEnd}T23:59:59`).getTime();

  // No overlap
  if (tCovEnd < tRepStart || tCovStart > tRepEnd) {
    return 0;
  }

  const overlapStartMs = Math.max(tCovStart, tRepStart);
  const overlapEndMs = Math.min(tCovEnd, tRepEnd);

  if (method === 'custom_schedule' && exp.customScheduleEntries && exp.customScheduleEntries.length > 0) {
    let sum = 0;
    exp.customScheduleEntries.forEach(entry => {
      const entryDate = entry.startDate || entry.periodLabel;
      if (entryDate >= periodStart && entryDate <= periodEnd) {
        sum += entry.amount;
      }
    });
    return sum;
  }

  if (method === 'equal_monthly') {
    // Calculate total months covered
    const dCov1 = new Date(covStart);
    const dCov2 = new Date(covEnd);
    const totalMonths = Math.max(1, (dCov2.getFullYear() - dCov1.getFullYear()) * 12 + (dCov2.getMonth() - dCov1.getMonth()) + 1);
    const monthlyRate = exp.amount / totalMonths;

    // Check overlap in months
    const dOverlap1 = new Date(overlapStartMs);
    const dOverlap2 = new Date(overlapEndMs);
    const overlapMonthsCount = Math.max(1, (dOverlap2.getFullYear() - dOverlap1.getFullYear()) * 12 + (dOverlap2.getMonth() - dOverlap1.getMonth()) + 1);

    // If report is an exact month or subset, clamp to avoid overcounting
    const actualAccruedMonths = Math.min(totalMonths, overlapMonthsCount);
    return Math.round(monthlyRate * actualAccruedMonths);
  }

  // actual_days
  const oneDayMs = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((tCovEnd - tCovStart) / oneDayMs));
  const overlapDays = Math.max(1, Math.round((overlapEndMs - overlapStartMs) / oneDayMs));

  const dailyRate = exp.amount / totalDays;
  return Math.round(dailyRate * Math.min(totalDays, overlapDays));
}

/**
 * Accrual-Based Net Operating Income (NOI) and Profitability Report
 * Strictly decouples cash payments from accrual periods, supports Direct vs Fully Allocated cost modes,
 * and breaks down costs per building, per unit, and per category.
 */
export function calculateAccrualProfitabilityReport(
  state: AppState,
  options: AccrualReportingOptions
): AccrualProfitabilityReport {
  const {
    periodStart,
    periodEnd,
    propertyId = 'all',
    costAllocationMode = 'fully_allocated',
    includeDrafts = false,
  } = options;

  const units = state.units || [];
  const properties = state.properties || [];
  const expenses = state.expenses || [];
  const bookings = state.bookings || [];
  const leases = state.leases || [];

  // Filter properties
  const targetProperties = propertyId === 'all'
    ? properties
    : properties.filter(p => p.id === propertyId);

  // 1. Calculate Revenue per unit for the target period
  const unitRevenueMap: Record<string, number> = {};
  units.forEach(u => { unitRevenueMap[u.id] = 0; });

  // Bookings revenue overlapping the period
  bookings.forEach(bk => {
    if (bk.status === 'cancelled') return;
    const bkStart = bk.checkIn;
    const bkEnd = bk.checkOut;
    if (bkEnd >= periodStart && bkStart <= periodEnd) {
      if (unitRevenueMap[bk.unitId] !== undefined) {
        // Daily rate apportioned by overlapping days
        const tStart = Math.max(new Date(bkStart).getTime(), new Date(periodStart).getTime());
        const tEnd = Math.min(new Date(bkEnd).getTime(), new Date(periodEnd).getTime());
        const days = Math.max(1, Math.round((tEnd - tStart) / (1000 * 60 * 60 * 24)));
        const totalBkDays = Math.max(1, bk.totalNights || 1);
        const ratio = Math.min(1, days / totalBkDays);
        unitRevenueMap[bk.unitId] += Math.round((bk.totalAmount || 0) * ratio);
      }
    }
  });

  // Lease revenue overlapping the period
  leases.forEach(lease => {
    if (lease.status === 'draft') return;
    (lease.installments || []).forEach(inst => {
      // If installment due or covered in this period
      if (inst.dueDate >= periodStart && inst.dueDate <= periodEnd) {
        if (unitRevenueMap[lease.unitId] !== undefined) {
          unitRevenueMap[lease.unitId] += inst.paidAmount > 0 ? inst.paidAmount : inst.amount;
        }
      }
    });
  });

  // 2. Compute Temporal Accrual for each approved expense
  const validExpenses = expenses.filter(exp => {
    if (exp.recordStatus === 'reversed') return false;
    if (exp.recordStatus === 'draft' && !includeDrafts) return false;
    return true;
  });

  // Unit Cost Aggregators
  const unitDirectExpMap: Record<string, number> = {};
  const unitAllocatedBldMap: Record<string, number> = {};
  const unitAllocatedCmpMap: Record<string, number> = {};
  const unitFfeMap: Record<string, number> = {};
  const unitCategoryBreakdown: Record<string, Record<string, number>> = {};

  units.forEach(u => {
    unitDirectExpMap[u.id] = 0;
    unitAllocatedBldMap[u.id] = 0;
    unitAllocatedCmpMap[u.id] = 0;
    unitFfeMap[u.id] = 0;
    unitCategoryBreakdown[u.id] = {};
  });

  const propertySharedExpMap: Record<string, number> = {};
  const propertyCategoryBreakdown: Record<string, Record<string, number>> = {};
  const categoryAccrualSummary: Record<string, { category: string; categoryLabel: string; total: number; isCapitalFfe: boolean; count: number }> = {};

  properties.forEach(p => {
    propertySharedExpMap[p.id] = 0;
    propertyCategoryBreakdown[p.id] = {};
  });

  validExpenses.forEach(exp => {
    const accruedAmount = calculateExpenseTemporalAccrual(exp, periodStart, periodEnd);
    if (accruedAmount <= 0) return;

    const catKey = exp.category;
    if (!categoryAccrualSummary[catKey]) {
      categoryAccrualSummary[catKey] = {
        category: catKey,
        categoryLabel: getExpenseCategoryLabel(catKey),
        total: 0,
        isCapitalFfe: !!exp.isFfeOrEquipment,
        count: 0,
      };
    }
    categoryAccrualSummary[catKey].total += accruedAmount;
    categoryAccrualSummary[catKey].count += 1;

    // FF&E Capital Purchases (strictly segregated from OPEX)
    if (exp.isFfeOrEquipment) {
      if (exp.unitId && unitFfeMap[exp.unitId] !== undefined) {
        unitFfeMap[exp.unitId] += accruedAmount;
      }
      return;
    }

    const expLevel = exp.level || 'property';

    // A. DIRECT UNIT EXPENSE
    if (expLevel === 'unit' && exp.unitId) {
      if (unitDirectExpMap[exp.unitId] !== undefined) {
        unitDirectExpMap[exp.unitId] += accruedAmount;
        unitCategoryBreakdown[exp.unitId][catKey] = (unitCategoryBreakdown[exp.unitId][catKey] || 0) + accruedAmount;
      }
    }
    // B. PROPERTY LEVEL EXPENSE (Common across property units)
    else if (expLevel === 'property' && exp.propertyId) {
      propertySharedExpMap[exp.propertyId] = (propertySharedExpMap[exp.propertyId] || 0) + accruedAmount;
      propertyCategoryBreakdown[exp.propertyId][catKey] = (propertyCategoryBreakdown[exp.propertyId][catKey] || 0) + accruedAmount;

      // Candidate units in this property
      let candidateUnits = units.filter(u => u.propertyId === exp.propertyId && u.publicationStatus !== 'archived');
      if (exp.includedUnitIds && exp.includedUnitIds.length > 0) {
        candidateUnits = candidateUnits.filter(u => exp.includedUnitIds!.includes(u.id));
      }
      if (exp.excludedUnitIds && exp.excludedUnitIds.length > 0) {
        candidateUnits = candidateUnits.filter(u => !exp.excludedUnitIds!.includes(u.id));
      }

      if (candidateUnits.length > 0) {
        const allocMethod = exp.costAllocationMethod || (exp.distributionType === 'equal' ? 'equal_units' : 'by_area');

        if (allocMethod === 'by_area') {
          const totalArea = candidateUnits.reduce((sum, u) => sum + (u.areaSqm || 50), 0);
          candidateUnits.forEach(u => {
            const ratio = (u.areaSqm || 50) / (totalArea || 1);
            const share = Math.round(accruedAmount * ratio);
            unitAllocatedBldMap[u.id] += share;
            unitCategoryBreakdown[u.id][catKey] = (unitCategoryBreakdown[u.id][catKey] || 0) + share;
          });
        } else if (allocMethod === 'by_revenue') {
          const totalRev = candidateUnits.reduce((sum, u) => sum + (unitRevenueMap[u.id] || 0), 0);
          candidateUnits.forEach(u => {
            const ratio = totalRev > 0 ? (unitRevenueMap[u.id] || 0) / totalRev : 1 / candidateUnits.length;
            const share = Math.round(accruedAmount * ratio);
            unitAllocatedBldMap[u.id] += share;
            unitCategoryBreakdown[u.id][catKey] = (unitCategoryBreakdown[u.id][catKey] || 0) + share;
          });
        } else {
          // equal_units or custom
          const share = Math.round(accruedAmount / candidateUnits.length);
          candidateUnits.forEach(u => {
            unitAllocatedBldMap[u.id] += share;
            unitCategoryBreakdown[u.id][catKey] = (unitCategoryBreakdown[u.id][catKey] || 0) + share;
          });
        }
      }
    }
    // C. COMPANY LEVEL EXPENSE (General overhead)
    else if (expLevel === 'company') {
      const activeUnits = units.filter(u => u.publicationStatus !== 'archived');
      if (activeUnits.length > 0) {
        const allocMethod = exp.costAllocationMethod || 'equal_units';

        if (allocMethod === 'by_revenue') {
          const totalCompanyRev = activeUnits.reduce((sum, u) => sum + (unitRevenueMap[u.id] || 0), 0);
          activeUnits.forEach(u => {
            const ratio = totalCompanyRev > 0 ? (unitRevenueMap[u.id] || 0) / totalCompanyRev : 1 / activeUnits.length;
            const share = Math.round(accruedAmount * ratio);
            unitAllocatedCmpMap[u.id] += share;
            unitCategoryBreakdown[u.id][catKey] = (unitCategoryBreakdown[u.id][catKey] || 0) + share;
          });
        } else if (allocMethod === 'by_area') {
          const totalArea = activeUnits.reduce((sum, u) => sum + (u.areaSqm || 50), 0);
          activeUnits.forEach(u => {
            const ratio = (u.areaSqm || 50) / (totalArea || 1);
            const share = Math.round(accruedAmount * ratio);
            unitAllocatedCmpMap[u.id] += share;
            unitCategoryBreakdown[u.id][catKey] = (unitCategoryBreakdown[u.id][catKey] || 0) + share;
          });
        } else {
          const share = Math.round(accruedAmount / activeUnits.length);
          activeUnits.forEach(u => {
            unitAllocatedCmpMap[u.id] += share;
            unitCategoryBreakdown[u.id][catKey] = (unitCategoryBreakdown[u.id][catKey] || 0) + share;
          });
        }
      }
    }
  });

  // 3. Assemble Output Structures
  let companyTotalRevenue = 0;
  let companyDirectOpex = 0;
  let companyAllocatedOpex = 0;
  let companyTotalOpex = 0;
  let companyFfeCapital = 0;

  const propertyReports: PropertyAccrualRow[] = targetProperties.map(prop => {
    const propUnits = units.filter(u => u.propertyId === prop.id && u.publicationStatus !== 'archived');

    let propRevenue = 0;
    let propDirectExp = 0;
    let propSharedBldExp = propertySharedExpMap[prop.id] || 0;
    let propCompanyExp = 0;
    let propFfe = 0;

    const unitsBreakdown: UnitAccrualRow[] = propUnits.map(unit => {
      const rev = unitRevenueMap[unit.id] || 0;
      const direct = unitDirectExpMap[unit.id] || 0;
      const bldAlloc = unitAllocatedBldMap[unit.id] || 0;
      const cmpAlloc = unitAllocatedCmpMap[unit.id] || 0;
      const ffe = unitFfeMap[unit.id] || 0;

      // In Direct Cost Mode: only direct costs apply
      // In Fully Allocated Mode: direct + building + company
      const effectiveOpex = costAllocationMode === 'direct_only'
        ? direct
        : direct + bldAlloc + cmpAlloc;

      const unitNoi = rev - effectiveOpex;
      const unitMargin = rev > 0 ? (unitNoi / rev) * 100 : 0;

      propRevenue += rev;
      propDirectExp += direct;
      propCompanyExp += cmpAlloc;
      propFfe += ffe;

      return {
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        propertyId: prop.id,
        propertyName: prop.name,
        areaSqm: unit.areaSqm,
        periodRevenue: rev,
        directOperatingExpense: direct,
        allocatedBuildingExpense: bldAlloc,
        allocatedCompanyExpense: cmpAlloc,
        effectiveOperatingExpense: effectiveOpex,
        ffeCapitalExpense: ffe,
        noi: unitNoi,
        operatingMarginPercent: Math.round(unitMargin * 10) / 10,
        categoryBreakdown: unitCategoryBreakdown[unit.id] || {},
      };
    });

    const propTotalOpex = costAllocationMode === 'direct_only'
      ? propDirectExp
      : propDirectExp + propSharedBldExp + propCompanyExp;

    const propNoi = propRevenue - propTotalOpex;
    const propMargin = propRevenue > 0 ? (propNoi / propRevenue) * 100 : 0;

    companyTotalRevenue += propRevenue;
    companyDirectOpex += propDirectExp;
    companyAllocatedOpex += (propSharedBldExp + propCompanyExp);
    companyTotalOpex += propTotalOpex;
    companyFfeCapital += propFfe;

    return {
      propertyId: prop.id,
      propertyName: prop.name,
      unitsCount: propUnits.length,
      totalAreaSqm: propUnits.reduce((sum, u) => sum + (u.areaSqm || 0), 0),
      periodRevenue: propRevenue,
      directOperatingExpense: propDirectExp,
      sharedBuildingExpense: propSharedBldExp,
      allocatedCompanyExpense: propCompanyExp,
      totalOperatingExpense: propTotalOpex,
      ffeCapitalExpense: propFfe,
      noi: propNoi,
      operatingMarginPercent: Math.round(propMargin * 10) / 10,
      unitsBreakdown,
      categoryBreakdown: propertyCategoryBreakdown[prop.id] || {},
    };
  });

  const companyTotalNOI = companyTotalRevenue - companyTotalOpex;
  const companyMarginPercent = companyTotalRevenue > 0
    ? Math.round((companyTotalNOI / companyTotalRevenue) * 1000) / 10
    : 0;

  const categorySummaryList = Object.values(categoryAccrualSummary).map(c => ({
    category: c.category,
    categoryLabel: c.categoryLabel,
    totalAccruedAmount: c.total,
    isCapitalFfe: c.isCapitalFfe,
    count: c.count,
  }));

  return {
    periodStart,
    periodEnd,
    costAllocationMode,
    companyTotalRevenue,
    companyDirectOpex,
    companyAllocatedOpex,
    companyTotalOpex,
    companyTotalNOI,
    companyMarginPercent,
    companyFfeCapital,
    properties: propertyReports,
    categorySummary: categorySummaryList,
  };
}

/**
 * Decoupled Cash Outflow Report (سجل المدفوعات والتدفقات النقدية الفعلية)
 * Shows actual cash payments disbursed within [periodStart, periodEnd] according to payment dates.
 */
export function calculateCashOutflowReport(
  state: AppState,
  periodStart: string,
  periodEnd: string,
  propertyId: string = 'all'
): CashOutflowReport {
  const expenses = state.expenses || [];
  const properties = state.properties || [];
  const units = state.units || [];

  const entries: CashOutflowEntry[] = [];
  const byCategory: Record<string, { label: string; amount: number; count: number }> = {};
  const byPaymentMethod: Record<string, number> = {};

  let totalOutflow = 0;
  let operatingOutflow = 0;
  let capitalFfeOutflow = 0;

  expenses.forEach(exp => {
    if (exp.recordStatus === 'reversed') return;
    if (propertyId !== 'all' && exp.propertyId && exp.propertyId !== propertyId) return;

    const prop = properties.find(p => p.id === exp.propertyId);
    const unit = units.find(u => u.id === exp.unitId);
    const catLabel = getExpenseCategoryLabel(exp.category);

    const payments = (exp.paymentsList && exp.paymentsList.length > 0)
      ? exp.paymentsList
      : (exp.paidAmount > 0 ? [
          {
            id: `legacy-${exp.id}`,
            paymentDate: exp.date,
            amount: exp.paidAmount,
            paymentMethod: (exp.paymentMethod as any) || 'bank_transfer',
            receiptReference: exp.invoiceDocNumber,
            recordedBy: exp.createdBy,
            createdAt: exp.createdAt,
          }
        ] : []);

    payments.forEach(p => {
      if (p.paymentDate >= periodStart && p.paymentDate <= periodEnd) {
        totalOutflow += p.amount;
        if (exp.isFfeOrEquipment) {
          capitalFfeOutflow += p.amount;
        } else {
          operatingOutflow += p.amount;
        }

        // Category breakdown
        if (!byCategory[exp.category]) {
          byCategory[exp.category] = { label: catLabel, amount: 0, count: 0 };
        }
        byCategory[exp.category].amount += p.amount;
        byCategory[exp.category].count += 1;

        // Payment method breakdown
        const methodKey = p.paymentMethod || 'other';
        byPaymentMethod[methodKey] = (byPaymentMethod[methodKey] || 0) + p.amount;

        entries.push({
          paymentId: p.id,
          expenseId: exp.id,
          expenseNumber: exp.expenseNumber,
          paymentDate: p.paymentDate,
          amount: p.amount,
          paymentMethod: formatPaymentMethod(p.paymentMethod),
          receiptReference: p.receiptReference,
          vendorOrBeneficiary: exp.vendorOrBeneficiary,
          category: exp.category,
          categoryLabel: catLabel,
          level: getCostCenterLevelLabel(exp.level),
          propertyName: prop?.name,
          unitNumber: unit?.unitNumber,
          description: exp.description,
          isFfeOrEquipment: !!exp.isFfeOrEquipment,
          recordedBy: p.recordedBy || exp.createdBy,
        });
      }
    });
  });

  // Sort entries descending by payment date
  entries.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  return {
    periodStart,
    periodEnd,
    totalOutflow,
    operatingOutflow,
    capitalFfeOutflow,
    entries,
    byCategory,
    byPaymentMethod,
  };
}
