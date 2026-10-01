import { useState, useEffect, useCallback } from 'react';
import {
  CompanySettings,
  Property,
  Floor,
  Unit,
  Amenity,
  UnitAllocation,
  Booking,
  Lease,
  HousekeepingTask,
  MaintenanceTask,
  SecurityDepositRecord,
  PaymentRecord,
  ContentSection,
  AuditLog,
  OperationalStatus,
  OccupancyStatus,
  ParkingSpot,
  UnitSpace,
  SpaceFitting,
  AnnualPaymentOption,
  ContractServiceItem,
  ContractInclusionType,
  LeaseInstallment,
  LeaseInstallmentStatus,
  InstallmentPaymentRecord,
  HandoverProtocol,
  InventoryHandoverItem,
  LeaseAmendment,
  GuestInfo,
  OperationalExpense,
  TenantAdjustment,
  ExpenseCategoryConfig,
  RecurringExpenseSchedule,
  ExpensePaymentEntry,
  ExpenseRecordStatus
} from '../types';
import {
  initialCompanySettings,
  initialProperties,
  initialFloors,
  initialUnits,
  initialAmenities,
  initialAllocations,
  initialBookings,
  initialLeases,
  initialHousekeepingTasks,
  initialMaintenanceTasks,
  initialSecurityDeposits,
  initialPayments,
  initialContentSections,
  initialAuditLogs,
  initialParkingSpots,
  initialExpenses,
  initialAdjustments,
  initialExpenseCategories,
  initialRecurringExpenses,
  initialNavigationSettings
} from '../data/initialData';
import {
  generateInstallmentSchedule,
  calculateLeaseEndDate,
  getDefaultContractServices,
  determineInclusionType,
  refreshInstallmentStatus
} from '../utils/leaseCalculations';

const STORAGE_KEY = 'luxury_home_platform_data_v1';
const OLD_STORAGE_KEY = 'ivoire_platform_data_v5';

export interface AppState {
  settings: CompanySettings;
  properties: Property[];
  floors: Floor[];
  units: Unit[];
  amenities: Amenity[];
  parkingSpots: ParkingSpot[];
  allocations: UnitAllocation[];
  bookings: Booking[];
  leases: Lease[];
  housekeepingTasks: HousekeepingTask[];
  maintenanceTasks: MaintenanceTask[];
  securityDeposits: SecurityDepositRecord[];
  payments: PaymentRecord[];
  contentSections: ContentSection[];
  auditLogs: AuditLog[];
  handoverProtocols: HandoverProtocol[];
  expenses: OperationalExpense[];
  adjustments: TenantAdjustment[];
  expenseCategories: ExpenseCategoryConfig[];
  recurringExpenses: RecurringExpenseSchedule[];
}

// Helper to compute room metrics dynamically from spaces & fittings
export function calculateUnitRoomMetrics(spaces: UnitSpace[] = []) {
  let bedroomsCount = 0;
  let bathroomsCount = 0;
  let bedsCount = 0;

  for (const space of spaces) {
    if (space.type === 'bedroom') {
      bedroomsCount += 1;
    } else if (space.type === 'bathroom') {
      bathroomsCount += 1;
    }

    if (space.bedsCount) {
      bedsCount += space.bedsCount;
    } else if (space.fittings && space.fittings.length > 0) {
      for (const fit of space.fittings) {
        if (fit.category === 'bed') {
          bedsCount += fit.quantity || 1;
        }
      }
    }
  }

  return {
    bedroomsCount: Math.max(bedroomsCount, 1),
    bathroomsCount: Math.max(bathroomsCount, 1),
    bedsCount: Math.max(bedsCount, 1),
  };
}

function getStoredState(): AppState {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(OLD_STORAGE_KEY);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.settings) {
        if (!parsed.settings.companyName || parsed.settings.companyName.includes('منزل الفخامة')) {
          parsed.settings.companyName = 'Luxury home منزل الفخامة';
          parsed.settings.companyNameEn = 'Luxury Home';
          parsed.settings.tagline = 'تجربة سكنية فاخرة تدمج بين خصوصية المنزل وخدمات الضيافة الراقية في Luxury home منزل الفخامة';
        }
        if (!parsed.settings.navigation) {
          parsed.settings.navigation = initialNavigationSettings;
        }
      }
      if (parsed.parkingSpots === undefined) {
        parsed.parkingSpots = initialParkingSpots;
      }
      if (parsed.handoverProtocols === undefined) {
        parsed.handoverProtocols = [];
      }
      if (parsed.expenses === undefined) {
        parsed.expenses = initialExpenses;
      }
      if (parsed.adjustments === undefined) {
        parsed.adjustments = initialAdjustments;
      }
      if (parsed.expenseCategories === undefined) {
        parsed.expenseCategories = initialExpenseCategories;
      }
      if (parsed.recurringExpenses === undefined) {
        parsed.recurringExpenses = initialRecurringExpenses;
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse stored state, using initial', e);
  }

  return {
    settings: initialCompanySettings,
    properties: initialProperties,
    floors: initialFloors,
    units: initialUnits,
    amenities: initialAmenities,
    parkingSpots: initialParkingSpots,
    allocations: initialAllocations,
    bookings: initialBookings,
    leases: initialLeases,
    housekeepingTasks: initialHousekeepingTasks,
    maintenanceTasks: initialMaintenanceTasks,
    securityDeposits: initialSecurityDeposits,
    payments: initialPayments,
    contentSections: initialContentSections,
    auditLogs: initialAuditLogs,
    handoverProtocols: [],
    expenses: initialExpenses,
    adjustments: initialAdjustments,
    expenseCategories: initialExpenseCategories,
    recurringExpenses: initialRecurringExpenses,
  };
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
}

// Helper to make authenticated server calls
export async function apiCall(endpoint: string, method: string = 'GET', body?: any) {
  const token = localStorage.getItem('luxury_home_jwt_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok && res.status !== 401) {
    const errorData = await res.json().catch(() => ({ message: 'فشلت العملية على الخادم' }));
    throw new Error(errorData.message || `خطأ من الخادم (${res.status})`);
  }

  return res.json().catch(() => ({ success: true }));
}

// Fetch authoritative server state on boot
let hasLoadedServerState = false;
export async function loadAuthoritativeServerState() {
  if (hasLoadedServerState) return;
  hasLoadedServerState = true;

  try {
    const token = localStorage.getItem('luxury_home_jwt_token');
    if (token) {
      const stateRes = await apiCall('/api/state', 'GET');
      if (stateRes.success && stateRes.state) {
        const s = stateRes.state;
        globalState = {
          ...globalState,
          settings: s.settings ? { ...globalState.settings, ...s.settings } : globalState.settings,
          properties: Array.isArray(s.properties) && s.properties.length > 0 ? s.properties : globalState.properties,
          units: Array.isArray(s.units) && s.units.length > 0 ? s.units : globalState.units,
          bookings: Array.isArray(s.bookings) ? s.bookings : globalState.bookings,
          leases: Array.isArray(s.leases) ? s.leases : globalState.leases,
          expenses: Array.isArray(s.expenses) ? s.expenses : globalState.expenses,
          auditLogs: Array.isArray(s.auditLogs) ? s.auditLogs : globalState.auditLogs
        };
        saveState(globalState);
        notify();
        return;
      }
    }

    // Public state fallback
    const [settingsRes, propsRes, unitsRes] = await Promise.all([
      fetch('/api/public/settings').then(r => r.json()).catch(() => null),
      fetch('/api/public/properties').then(r => r.json()).catch(() => null),
      fetch('/api/public/units').then(r => r.json()).catch(() => null),
    ]);

    let changed = false;
    if (settingsRes?.success && settingsRes.settings) {
      globalState = { ...globalState, settings: { ...globalState.settings, ...settingsRes.settings } };
      changed = true;
    }
    if (propsRes?.success && Array.isArray(propsRes.properties) && propsRes.properties.length > 0) {
      globalState = { ...globalState, properties: propsRes.properties };
      changed = true;
    }
    if (unitsRes?.success && Array.isArray(unitsRes.units) && unitsRes.units.length > 0) {
      globalState = { ...globalState, units: unitsRes.units };
      changed = true;
    }

    if (changed) {
      saveState(globalState);
      notify();
    }
  } catch (err) {
    console.warn('[Store] Note: Could not fetch initial state from API server:', err);
  }
}

type Listener = () => void;
let globalState = getStoredState();
const listeners = new Set<Listener>();

function notify() {
  saveState(globalState);
  listeners.forEach((l) => l());
}

export function useAppStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    loadAuthoritativeServerState();
    const handleUpdate = () => setTick((t) => t + 1);
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  // --- Strict Allocation & Conflict Engine ---
  /**
   * Check if a time interval [start, end) conflicts with any existing active allocations on a unit.
   * Includes prep buffer bufferHours after the stay ends.
   */
  const checkUnitAvailability = useCallback((
    unitId: string,
    requestedStart: string, // ISO or YYYY-MM-DD
    requestedEnd: string,   // ISO or YYYY-MM-DD
    excludeAllocationId?: string
  ): { available: boolean; conflictReason?: string; conflictingAllocation?: UnitAllocation } => {
    const reqStartMs = new Date(requestedStart.includes('T') ? requestedStart : `${requestedStart}T15:00:00`).getTime();
    const reqEndMs = new Date(requestedEnd.includes('T') ? requestedEnd : `${requestedEnd}T12:00:00`).getTime();

    if (isNaN(reqStartMs) || isNaN(reqEndMs) || reqStartMs >= reqEndMs) {
      return { available: false, conflictReason: 'التواريخ غير صالحة' };
    }

    const unit = globalState.units.find(u => u.id === unitId);
    if (!unit) {
      return { available: false, conflictReason: 'الشقة غير موجودة' };
    }

    if (unit.operationalStatus === 'blocked') {
      return { available: false, conflictReason: 'الشقة محجوبة حالياً إدارياً' };
    }

    // Check each active allocation for this unit
    const activeAllocations = globalState.allocations.filter(
      a => a.unitId === unitId && a.status === 'active' && a.id !== excludeAllocationId
    );

    for (const alloc of activeAllocations) {
      const allocStartMs = new Date(alloc.startDate).getTime();
      // add turnover prep buffer
      const bufferMs = (alloc.prepBufferHours || globalState.settings.defaultPrepBufferHours || 2) * 60 * 60 * 1000;
      const allocEndMsWithBuffer = new Date(alloc.endDate).getTime() + bufferMs;

      // Interval overlap check: max(reqStart, allocStart) < min(reqEnd, allocEndWithBuffer)
      const overlapStart = Math.max(reqStartMs, allocStartMs);
      const overlapEnd = Math.min(reqEndMs, allocEndMsWithBuffer);

      if (overlapStart < overlapEnd) {
        let reason = 'شغل حجز آخر';
        if (alloc.type === 'lease') reason = 'شغل عقد إيجار ساري';
        if (alloc.type === 'maintenance') reason = 'أعمال صيانة معينة للوحدة';
        if (alloc.type === 'block') reason = 'حجب إداري مجدول';
        if (alloc.type === 'hold') reason = 'حجز مؤقت معلق';

        return {
          available: false,
          conflictReason: `${reason} (${new Date(alloc.startDate).toLocaleDateString('ar-SA')} إلى ${new Date(alloc.endDate).toLocaleDateString('ar-SA')})`,
          conflictingAllocation: alloc
        };
      }
    }
    return { available: true };
  }, []);

  /**
   * Search for units matching criteria with strict availability filter
   */
  const searchAvailableUnits = useCallback((params: {
    propertyId?: string;
    rentalType: 'daily' | 'monthly' | 'yearly';
    startDate: string;
    endDate: string;
    guestsCount?: number;
  }) => {
    return globalState.units.filter(unit => {
      // Filter by property if specified
      if (params.propertyId && params.propertyId !== 'all' && unit.propertyId !== params.propertyId) {
        return false;
      }
      // Filter by rental type permission
      if (params.rentalType === 'daily' && !unit.allowDaily) return false;
      if (params.rentalType === 'monthly' && !unit.allowMonthly) return false;
      if (params.rentalType === 'yearly' && !unit.allowYearly) return false;

      // Filter by guests capacity
      if (params.guestsCount && unit.maxGuests < params.guestsCount) return false;

      // Strict allocation engine check
      const availability = checkUnitAvailability(unit.id, params.startDate, params.endDate);
      return availability.available;
    });
  }, [checkUnitAvailability]);

  /**
   * Create a new daily booking with immediate atomic allocation
   */
  const createBooking = useCallback((payload: {
    unitId: string;
    guest: {
      fullName: string;
      email: string;
      phone: string;
      nationalIdOrPassport: string;
    };
    checkIn: string;
    checkOut: string;
    guestsCount: number;
    paymentMethod: 'mada' | 'visa_mastercard' | 'apple_pay';
  }) => {
    // 1. Verify availability inside transaction
    const availCheck = checkUnitAvailability(payload.unitId, payload.checkIn, payload.checkOut);
    if (!availCheck.available) {
      throw new Error(availCheck.conflictReason || 'الوحدة السكنية لم تعد متاحة لهذه التواريخ.');
    }

    const unit = globalState.units.find(u => u.id === payload.unitId);
    if (!unit) throw new Error('الشقة غير متوفرة');

    const checkInDate = new Date(`${payload.checkIn}T15:00:00`);
    const checkOutDate = new Date(`${payload.checkOut}T12:00:00`);
    const totalNights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

    const nightlyRate = unit.dailyRate;
    const subtotal = nightlyRate * totalNights;
    const cleaningFee = unit.cleaningFee;
    const taxes = Math.round((subtotal + cleaningFee) * (unit.taxPercentage / 100));
    const securityDeposit = unit.securityDeposit;
    const totalAmount = subtotal + cleaningFee + taxes + securityDeposit;

    const bookingId = `bk-${Date.now()}`;
    const allocId = `alloc-${Date.now()}`;
    const bookingNumber = `IVR-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Generate smart lock pin
    const pin = `${Math.floor(100000 + Math.random() * 900000)}#`;

    const newAllocation: UnitAllocation = {
      id: allocId,
      unitId: unit.id,
      type: 'booking',
      referenceId: bookingId,
      startDate: `${payload.checkIn}T15:00:00`,
      endDate: `${payload.checkOut}T12:00:00`,
      prepBufferHours: globalState.settings.defaultPrepBufferHours,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes: `حجز يومي ${bookingNumber} للضيف ${payload.guest.fullName}`
    };

    const newBooking: Booking = {
      id: bookingId,
      bookingNumber,
      unitId: unit.id,
      propertyId: unit.propertyId,
      guest: {
        ...payload.guest,
        idVerified: false, // Verification pending official check
      },
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      totalNights,
      guestsCount: payload.guestsCount,
      status: 'confirmed',
      rentalType: 'daily',
      nightlyRate,
      subtotal,
      cleaningFee,
      taxes,
      securityDeposit,
      totalAmount,
      smartLockPin: undefined, // PIN is securely provided upon check-in verification only
      smartLockPinValidFrom: `${payload.checkIn}T15:00:00`,
      smartLockPinValidTo: `${payload.checkOut}T12:00:00`,
      createdAt: new Date().toISOString(),
      allocationId: allocId,
    };

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      referenceType: 'booking',
      referenceId: bookingId,
      amount: totalAmount - securityDeposit,
      method: payload.paymentMethod,
      status: 'pending', // Pending official payment confirmation
      transactionId: `TX_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      notes: `حجز فندقي #${bookingNumber} - بانتظار التحصيل والتأكيد`
    };

    const newDeposit: SecurityDepositRecord = {
      id: `dep-${Date.now()}`,
      bookingOrLeaseId: bookingId,
      unitId: unit.id,
      guestName: payload.guest.fullName,
      amount: securityDeposit,
      heldType: 'authorized_hold',
      status: 'held',
      deductions: [],
      refundAmount: 0,
      createdAt: new Date().toISOString(),
    };

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'إنشاء حجز فندقي فوري',
      entity: 'Booking',
      entityId: bookingId,
      performedBy: payload.guest.fullName,
      role: 'Guest Online',
      details: `تم حجز شقة #${unit.unitNumber} من تاريخ ${payload.checkIn} إلى ${payload.checkOut} بقيمة إجمالية ${totalAmount} ر.س تشمل التأمين والضريبة.`,
      timestamp: new Date().toISOString(),
    };

    // If checkIn is today, set unit todayArrival flag
    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = payload.checkIn === todayStr;

    globalState = {
      ...globalState,
      allocations: [newAllocation, ...globalState.allocations],
      bookings: [newBooking, ...globalState.bookings],
      payments: [newPayment, ...globalState.payments],
      securityDeposits: [newDeposit, ...globalState.securityDeposits],
      auditLogs: [newLog, ...globalState.auditLogs],
      units: globalState.units.map(u => {
        if (u.id === unit.id) {
          return {
            ...u,
            todayArrival: isToday ? true : u.todayArrival,
          };
        }
        return u;
      })
    };

    notify();
    return newBooking;
  }, [checkUnitAvailability]);

  /**
   * Add Authoritative Server-Created Booking directly to Store
   */
  const addServerBooking = useCallback((serverBooking: any) => {
    if (!serverBooking) return null;
    const unit = globalState.units.find(u => u.id === serverBooking.unitId);
    const startStr = serverBooking.startDate ? new Date(serverBooking.startDate).toISOString().slice(0, 10) : (serverBooking.checkIn || '');
    const endStr = serverBooking.endDate ? new Date(serverBooking.endDate).toISOString().slice(0, 10) : (serverBooking.checkOut || '');

    const normalizedBooking: Booking = {
      id: serverBooking.id || `bk_${Date.now()}`,
      bookingNumber: serverBooking.bookingNumber || `LH-${Date.now().toString().slice(-6)}`,
      unitId: serverBooking.unitId,
      propertyId: unit?.propertyId || serverBooking.propertyId || '',
      guest: {
        fullName: serverBooking.guestName || serverBooking.guest?.fullName || 'عميل محجوز',
        email: serverBooking.guestEmail || serverBooking.guest?.email || '',
        phone: serverBooking.guestPhone || serverBooking.guest?.phone || '',
        nationalIdOrPassport: serverBooking.guestIdNumber || serverBooking.guest?.nationalIdOrPassport || '',
        idVerified: serverBooking.identityStatus === 'verified'
      },
      checkIn: startStr,
      checkOut: endStr,
      totalNights: serverBooking.totalNights || 1,
      guestsCount: serverBooking.guestsCount || 1,
      status: (serverBooking.status?.toLowerCase() || 'confirmed') as any,
      rentalType: (serverBooking.rentalType?.toLowerCase() || 'daily') as any,
      nightlyRate: Number(serverBooking.nightlyRate) || 0,
      subtotal: Number(serverBooking.subtotal) || 0,
      cleaningFee: Number(serverBooking.cleaningFee) || 0,
      taxes: Number(serverBooking.taxes) || 0,
      securityDeposit: Number(serverBooking.securityDeposit) || 0,
      totalAmount: Number(serverBooking.totalAmount) || 0,
      smartLockPin: serverBooking.smartLockPin || undefined,
      smartLockPinValidFrom: serverBooking.startDate,
      smartLockPinValidTo: serverBooking.endDate,
      createdAt: serverBooking.createdAt || new Date().toISOString(),
      allocationId: `alloc_${serverBooking.id}`,
    };

    const newAllocation: UnitAllocation = {
      id: `alloc_${serverBooking.id}`,
      unitId: serverBooking.unitId,
      startDate: normalizedBooking.checkIn,
      endDate: normalizedBooking.checkOut,
      type: 'booking',
      referenceId: normalizedBooking.bookingNumber,
      prepBufferHours: 2,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes: `حجز مؤكد #${normalizedBooking.bookingNumber} - ${normalizedBooking.guest.fullName}`
    };

    globalState = {
      ...globalState,
      bookings: [normalizedBooking, ...globalState.bookings.filter(b => b.id !== normalizedBooking.id && b.bookingNumber !== normalizedBooking.bookingNumber)],
      allocations: [newAllocation, ...globalState.allocations.filter(a => a.referenceId !== normalizedBooking.bookingNumber && a.referenceId !== normalizedBooking.id)]
    };

    saveState(globalState);
    notify();
    return normalizedBooking;
  }, []);

  /**
   * Add Authoritative Server-Created Lease Contract directly to Store
   */
  const addServerLease = useCallback((serverLease: any, serverInstallments?: any[]) => {
    if (!serverLease) return null;
    const unit = globalState.units.find(u => u.id === serverLease.unitId);
    const startStr = serverLease.startDate ? new Date(serverLease.startDate).toISOString().slice(0, 10) : '';
    const endStr = serverLease.endDate ? new Date(serverLease.endDate).toISOString().slice(0, 10) : '';
    const totalVal = Number(serverLease.annualRent) || Number(serverLease.totalContractValue) || 0;

    const normalizedLease: Lease = {
      id: serverLease.id || `lease_${Date.now()}`,
      contractNumber: serverLease.contractNumber || `CNT-${Date.now().toString().slice(-6)}`,
      unitId: serverLease.unitId,
      propertyId: unit?.propertyId || serverLease.propertyId || '',
      tenant: {
        fullName: serverLease.tenantName || serverLease.tenant?.fullName || 'مستأجر معتمد',
        phone: serverLease.tenantPhone || serverLease.tenant?.phone || '',
        email: serverLease.tenantEmail || serverLease.tenant?.email || '',
        nationalIdOrPassport: serverLease.tenantIdNumber || serverLease.tenant?.nationalIdOrPassport || '',
        idVerified: true
      },
      startDate: startStr,
      endDate: endStr,
      monthsCount: serverLease.monthsCount || 12,
      rentalType: (serverLease.rentalType?.toLowerCase() === 'monthly' ? 'monthly' : 'yearly'),
      monthlyRent: Number(serverLease.monthlyRent) || Math.round(totalVal / 12),
      yearlyRent: totalVal,
      totalContractValue: totalVal,
      securityDeposit: Number(serverLease.securityDeposit) || 0,
      status: (serverLease.status?.toLowerCase() || 'active') as any,
      allocationId: `alloc_${serverLease.id || Date.now()}`,
      inclusionType: 'all_inclusive',
      services: serverLease.services || [],
      termsSnapshot: serverLease.termsSnapshot || 'شروط وأحكام عقد الإيجار القياسي المعتمد',
      amendments: serverLease.amendments || [],
      createdAt: serverLease.createdAt || new Date().toISOString(),
      installments: serverInstallments || serverLease.installments || []
    };

    const newAllocation: UnitAllocation = {
      id: `alloc_${serverLease.id}`,
      unitId: serverLease.unitId,
      startDate: normalizedLease.startDate,
      endDate: normalizedLease.endDate,
      type: 'lease',
      referenceId: normalizedLease.contractNumber,
      prepBufferHours: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes: `عقد إيجار #${normalizedLease.contractNumber} - ${normalizedLease.tenant.fullName}`
    };

    globalState = {
      ...globalState,
      leases: [normalizedLease, ...globalState.leases.filter(l => l.id !== normalizedLease.id && l.contractNumber !== normalizedLease.contractNumber)],
      allocations: [newAllocation, ...globalState.allocations.filter(a => a.referenceId !== normalizedLease.contractNumber && a.referenceId !== normalizedLease.id)]
    };

    saveState(globalState);
    notify();
    return normalizedLease;
  }, []);

  /**
   * Comprehensive Contract & Lease Creator (Supports Monthly and Yearly)
   * Enforces 12-month calendar allocation, exact installments, service responsibilities, and immutable terms snapshot
   */
  const createContractLease = useCallback((payload: {
    unitId: string;
    tenant: GuestInfo;
    startDate: string;
    endDate?: string;
    monthsCount: number; // 12 for yearly
    rentalType: 'monthly' | 'yearly';
    yearlyPaymentOption?: AnnualPaymentOption;
    totalContractValue: number;
    securityDeposit: number;
    services?: ContractServiceItem[];
    inclusionType?: ContractInclusionType;
    latePolicy?: string;
    renewalPolicy?: string;
    earlyTerminationPolicy?: string;
    handoverItems?: InventoryHandoverItem[];
    meterReadings?: { meterType: string; meterNumber: string; reading: number; photoUrl?: string }[];
    notes?: string;
  }) => {
    const unit = globalState.units.find(u => u.id === payload.unitId);
    if (!unit) throw new Error('الشقة غير متوفرة');

    // Compute end date if not provided (calendar months logic)
    const endDateStr = payload.endDate || calculateLeaseEndDate(payload.startDate, payload.monthsCount);

    // Strict availability check for the ENTIRE duration of the contract!
    const availCheck = checkUnitAvailability(unit.id, payload.startDate, endDateStr);
    if (!availCheck.available) {
      throw new Error(availCheck.conflictReason || 'التواريخ المطلوبة لعقد الإيجار متداخلة مع التزامات أخرى للشقة.');
    }

    const leaseId = `lease-${Date.now()}`;
    const allocId = `alloc-${Date.now()}`;
    const yr = new Date().getFullYear();
    const contractNumber = `IVR-LSE-${yr}-${payload.rentalType === 'yearly' ? 'YR' : 'MN'}${Math.floor(10 + Math.random() * 90)}`;

    // Allocation covers the full contract duration
    const newAllocation: UnitAllocation = {
      id: allocId,
      unitId: unit.id,
      type: 'lease',
      referenceId: leaseId,
      startDate: `${payload.startDate}T15:00:00`,
      endDate: `${endDateStr}T12:00:00`,
      prepBufferHours: 6,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes: `عقد إيجار ${payload.rentalType === 'yearly' ? 'سنوي' : 'شهري'} رقم ${contractNumber}`
    };

    // Generate exact installments with zero rounding discrepancy
    const installments = generateInstallmentSchedule({
      leaseId,
      rentalType: payload.rentalType,
      yearlyPaymentOption: payload.yearlyPaymentOption,
      startDate: payload.startDate,
      totalContractValue: payload.totalContractValue,
      monthsCount: payload.monthsCount
    });

    const services = payload.services || getDefaultContractServices();
    const inclusionType = payload.inclusionType || determineInclusionType(services);

    // Handover protocol if items or meter readings provided
    let handoverId: string | undefined = undefined;
    let newProtocols = globalState.handoverProtocols || [];

    if ((payload.handoverItems && payload.handoverItems.length > 0) || (payload.meterReadings && payload.meterReadings.length > 0)) {
      handoverId = `proto-del-${Date.now()}`;
      const newProto: HandoverProtocol = {
        id: handoverId,
        leaseId,
        unitId: unit.id,
        protocolType: 'delivery',
        date: payload.startDate,
        deliveredBy: 'مسؤول التشغيل والمستودع',
        receivedBy: payload.tenant.fullName,
        keysHandedCount: 2,
        accessCardsCount: 2,
        remotesCount: 1,
        meterReadings: payload.meterReadings || [],
        items: payload.handoverItems || [],
        tenantSignatureConfirmed: true,
        supervisorSignatureConfirmed: true,
        createdAt: new Date().toISOString(),
      };
      newProtocols = [newProto, ...newProtocols];
    }

    const newLease: Lease = {
      id: leaseId,
      contractNumber,
      unitId: unit.id,
      propertyId: unit.propertyId,
      tenant: {
        ...payload.tenant,
        idVerified: true,
      },
      startDate: payload.startDate,
      endDate: endDateStr,
      monthsCount: payload.monthsCount,
      rentalType: payload.rentalType,
      yearlyPaymentOption: payload.yearlyPaymentOption,
      status: 'active',
      monthlyRent: payload.rentalType === 'yearly' ? Math.round(payload.totalContractValue / 12) : Math.round(payload.totalContractValue / payload.monthsCount),
      yearlyRent: payload.rentalType === 'yearly' ? payload.totalContractValue : undefined,
      securityDeposit: payload.securityDeposit,
      totalContractValue: payload.totalContractValue,
      installments,
      allocationId: allocId,
      inclusionType,
      services,
      handoverProtocolId: handoverId,
      termsSnapshot: {
        frozenAt: new Date().toISOString(),
        approvedBy: 'مدير عمليات الحسابات والتعاقدات',
        latePolicy: payload.latePolicy || 'تطبق رسوم غرامة تأخير بقيمة ١٠٪ في حال فوات ٧ أيام.',
        renewalPolicy: payload.renewalPolicy || 'الإشعار بالرغبة بالتجديد قبل ٦٠ يوماً على الأقل للسنوي و ٣٠ يوماً للشهري.',
        earlyTerminationPolicy: payload.earlyTerminationPolicy || 'فسخ العقد المبكر يتطلب شرطاً جزائياً يعادل شهرين من القيمة الحالية.',
        agreedRent: payload.totalContractValue,
        agreedDeposit: payload.securityDeposit,
      },
      amendments: [],
      createdAt: new Date().toISOString(),
    };

    const newDeposit: SecurityDepositRecord = {
      id: `dep-${Date.now()}`,
      bookingOrLeaseId: leaseId,
      unitId: unit.id,
      guestName: payload.tenant.fullName,
      amount: payload.securityDeposit,
      heldType: 'collected_cash_card',
      status: 'held',
      deductions: [],
      refundAmount: 0,
      createdAt: new Date().toISOString(),
    };

    const targetOccupancy: OccupancyStatus = payload.rentalType === 'yearly' ? 'occupied_yearly' : 'monthly_occupied';

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: payload.rentalType === 'yearly' ? 'اعتماد عقد تأجير سنوي جديد' : 'اعتماد عقد تأجير شهري مخصص',
      entity: 'Lease',
      entityId: leaseId,
      performedBy: 'سعد القحطاني',
      role: 'Operations Admin',
      details: `تم تفعيل عقد الإيجار للوحدة #${unit.unitNumber} بقيمة تعاقد إجمالية ${payload.totalContractValue} ر.س ممتداً من تاريخ ${payload.startDate} إلى ${endDateStr}`,
      timestamp: new Date().toISOString(),
    };

    globalState = {
      ...globalState,
      allocations: [newAllocation, ...globalState.allocations],
      leases: [newLease, ...globalState.leases],
      securityDeposits: [newDeposit, ...globalState.securityDeposits],
      handoverProtocols: newProtocols,
      auditLogs: [newLog, ...globalState.auditLogs],
      units: globalState.units.map(u => {
        if (u.id === unit.id) {
          return {
            ...u,
            occupancyStatus: targetOccupancy,
            currentLeaseId: leaseId,
          };
        }
        return u;
      })
    };

    notify();
    return newLease;
  }, [checkUnitAvailability]);

  /**
   * Create a monthly lease agreement (legacy helper mapping to createContractLease)
   */
  const createMonthlyLease = useCallback((payload: {
    unitId: string;
    tenant: {
      fullName: string;
      email: string;
      phone: string;
      nationalIdOrPassport: string;
    };
    startDate: string;
    monthsCount: number;
    securityDeposit: number;
  }) => {
    const unit = globalState.units.find(u => u.id === payload.unitId);
    if (!unit) throw new Error('الشقة غير متوفرة');

    const totalContractValue = unit.monthlyRate * payload.monthsCount;

    return createContractLease({
      unitId: payload.unitId,
      tenant: {
        ...payload.tenant,
        idVerified: true,
      },
      startDate: payload.startDate,
      monthsCount: payload.monthsCount,
      rentalType: 'monthly',
      totalContractValue,
      securityDeposit: payload.securityDeposit,
    });
  }, [createContractLease]);

  /**
   * Record installment payment with partial payment, receipt generation, and duplicate prevention
   */
  const recordInstallmentPayment = useCallback((params: {
    leaseId: string;
    installmentId: string;
    amount: number;
    method: 'mada' | 'visa_mastercard' | 'apple_pay' | 'bank_transfer' | 'cash';
    notes?: string;
    performedBy?: string;
  }) => {
    const lease = globalState.leases.find(l => l.id === params.leaseId);
    if (!lease) throw new Error('العقد غير متوفر');

    const instIndex = lease.installments.findIndex(i => i.id === params.installmentId);
    if (instIndex === -1) throw new Error('الدفعة المحددة غير موجودة');

    const inst = lease.installments[instIndex];
    if (params.amount <= 0) throw new Error('المبلغ غير صالح');

    if (params.amount > inst.remainingAmount) {
      throw new Error(`مبلغ السداد المطلوب (${params.amount} ر.س) يتجاوز المتبقي للدفعة وهو (${inst.remainingAmount} ر.س)!`);
    }

    const receiptNo = `RCP-${Date.now().toString().slice(-6)}`;
    const paymentId = `pay-inst-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const paymentRecord: InstallmentPaymentRecord = {
      paymentId,
      amount: params.amount,
      date: nowIso,
      method: params.method,
      receiptNo,
      notes: params.notes,
    };

    const newPaidAmount = inst.paidAmount + params.amount;
    const newRemaining = Math.max(0, inst.amount - newPaidAmount);
    const newStatus: LeaseInstallmentStatus = newRemaining === 0 ? 'paid' : 'partially_paid';

    const updatedInstallment: LeaseInstallment = {
      ...inst,
      paidAmount: newPaidAmount,
      remainingAmount: newRemaining,
      status: newStatus,
      paidAt: newRemaining === 0 ? nowIso : inst.paidAt,
      receiptNumber: receiptNo,
      transactionRef: `TXN-${Date.now().toString().slice(-8)}`,
      payments: [...(inst.payments || []), paymentRecord],
      notes: params.notes || inst.notes,
    };

    const updatedInstallments = [...lease.installments];
    updatedInstallments[instIndex] = updatedInstallment;

    const newGlobalPayment: PaymentRecord = {
      id: paymentId,
      referenceType: 'lease_installment',
      referenceId: params.installmentId,
      amount: params.amount,
      method: params.method,
      status: 'success',
      transactionId: updatedInstallment.transactionRef || `TXN-${Date.now()}`,
      receiptNumber: receiptNo,
      createdAt: nowIso,
      notes: `سداد قسط العقد #${lease.contractNumber} (${updatedInstallment.label || 'قسط مالي'})`,
    };

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'تسجيل سداد قسط إيجاري',
      entity: 'LeaseInstallment',
      entityId: params.installmentId,
      performedBy: params.performedBy || 'المحاسب المالي',
      role: 'Accountant',
      details: `تم استلام مبلغ ${params.amount} ر.س للقسط #${inst.installmentNumber} لعقد الإيجار ${lease.contractNumber} وتم إصدار السند #${receiptNo}`,
      timestamp: nowIso,
    };

    globalState = {
      ...globalState,
      leases: globalState.leases.map(l => l.id === params.leaseId ? { ...l, installments: updatedInstallments } : l),
      payments: [newGlobalPayment, ...globalState.payments],
      auditLogs: [newLog, ...globalState.auditLogs],
    };

    notify();
    return { updatedInstallment, receiptNo };
  }, []);

  /**
   * Renew a lease for a new period linked to the previous contract
   */
  const renewLease = useCallback((params: {
    leaseId: string;
    newStartDate: string;
    monthsCount: number;
    rentalType: 'monthly' | 'yearly';
    yearlyPaymentOption?: AnnualPaymentOption;
    totalContractValue: number;
    securityDeposit: number;
  }) => {
    const oldLease = globalState.leases.find(l => l.id === params.leaseId);
    if (!oldLease) throw new Error('العقد القديم غير متوفر');

    const endDateStr = calculateLeaseEndDate(params.newStartDate, params.monthsCount);

    // Verify availability
    const avail = checkUnitAvailability(oldLease.unitId, params.newStartDate, endDateStr);
    if (!avail.available) {
      throw new Error(avail.conflictReason || 'التواريخ المطلوبة لتجديد العقد غير متاحة.');
    }

    // Create renewed lease via createContractLease
    const newLease = createContractLease({
      unitId: oldLease.unitId,
      tenant: oldLease.tenant,
      startDate: params.newStartDate,
      endDate: endDateStr,
      monthsCount: params.monthsCount,
      rentalType: params.rentalType,
      yearlyPaymentOption: params.yearlyPaymentOption,
      totalContractValue: params.totalContractValue,
      securityDeposit: params.securityDeposit,
      services: oldLease.services,
      inclusionType: oldLease.inclusionType,
      notes: `تجديد ممتد من العقد القديم رقم ${oldLease.contractNumber}`
    });

    // Link old lease to new lease
    globalState = {
      ...globalState,
      leases: globalState.leases.map(l => {
        if (l.id === oldLease.id) {
          return { ...l, renewedToLeaseId: newLease.id };
        }
        if (l.id === newLease.id) {
          return { ...l, renewedFromLeaseId: oldLease.id };
        }
        return l;
      }),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تجديد عقد إيجار ساري',
          entity: 'Lease',
          entityId: newLease.id,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: `تم تجديد عقد الإيجار ${oldLease.contractNumber} لإنتاج العقد الجديد ${newLease.contractNumber} بمدة ${params.monthsCount} شهر.`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
    return newLease;
  }, [checkUnitAvailability, createContractLease]);

  /**
   * Early contract termination with financial settlement and freeing unit allocation
   */
  const earlyTerminateLease = useCallback((params: {
    leaseId: string;
    effectiveDate: string;
    reason: string;
    financialSettlementAmount: number;
    depositRefunded: number;
    notes?: string;
    processedBy?: string;
  }) => {
    const lease = globalState.leases.find(l => l.id === params.leaseId);
    if (!lease) throw new Error('العقد غير متوفر');

    // Update allocation end date to early termination date + prep buffer!
    const updatedAllocations = globalState.allocations.map(a => {
      if (a.referenceId === lease.id || a.id === lease.allocationId) {
        return {
          ...a,
          endDate: `${params.effectiveDate}T12:00:00`,
          notes: `تم إنهاء العقد مبكراً وتعديل ليتنتهي في ${params.effectiveDate}`
        };
      }
      return a;
    });

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);
    const isPastOrToday = todayStr >= params.effectiveDate;

    // Mark remaining unpaid installments as cancelled/settled
    const updatedInstallments = lease.installments.map(inst => {
      if (inst.status !== 'paid') {
        return {
          ...inst,
          notes: `${inst.notes || ''} (تسوية إنهاء العقد مبكراً ومسح المتبقي)`.trim(),
        };
      }
      return inst;
    });

    const updatedLease: Lease = {
      ...lease,
      status: 'terminated',
      installments: updatedInstallments,
      earlyTermination: {
        terminatedAt: nowIso,
        effectiveDate: params.effectiveDate,
        reason: params.reason,
        financialSettlementAmount: params.financialSettlementAmount,
        depositRefunded: params.depositRefunded,
        processedBy: params.processedBy || 'المدير المالي',
        notes: params.notes,
      }
    };

    // If deposit refunded
    let updatedDeposits = globalState.securityDeposits;
    if (params.depositRefunded > 0) {
      updatedDeposits = updatedDeposits.map(d => {
        if (d.bookingOrLeaseId === lease.id) {
          return {
            ...d,
            refundAmount: params.depositRefunded,
            status: params.depositRefunded >= d.amount ? 'fully_refunded' : 'partially_refunded',
            refundedAt: nowIso,
          };
        }
        return d;
      });
    }

    // Unit occupancy status
    const updatedUnits = globalState.units.map(u => {
      if (u.id === lease.unitId && isPastOrToday) {
        return {
          ...u,
          occupancyStatus: 'vacant' as OccupancyStatus,
          operationalStatus: 'needs_cleaning' as OperationalStatus,
          currentLeaseId: undefined,
        };
      }
      return u;
    });

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'إنهاء عقد إيجار مبكر وتسوية',
      entity: 'Lease',
      entityId: lease.id,
      performedBy: params.processedBy || 'أحمد المفلح',
      role: 'Admin',
      details: `فسخ عقد الإيجار ${lease.contractNumber} اعتباراً من ${params.effectiveDate}. السبب: ${params.reason}. التسوية المالية المطلوبة: ${params.financialSettlementAmount} ر.س.`,
      timestamp: nowIso,
    };

    globalState = {
      ...globalState,
      allocations: updatedAllocations,
      leases: globalState.leases.map(l => l.id === lease.id ? updatedLease : l),
      securityDeposits: updatedDeposits,
      units: updatedUnits,
      auditLogs: [newLog, ...globalState.auditLogs],
    };

    notify();
    return updatedLease;
  }, []);

  /**
   * Reschedule unpaid installments with strict audit trail and preserving previous payments
   */
  const rescheduleInstallments = useCallback((params: {
    leaseId: string;
    updatedInstallments: LeaseInstallment[];
    reason: string;
    approvedBy?: string;
  }) => {
    const lease = globalState.leases.find(l => l.id === params.leaseId);
    if (!lease) throw new Error('العقد غير متوفر');

    // Verify previous payments are preserved!
    const originalPaidSum = lease.installments.reduce((sum, i) => sum + i.paidAmount, 0);
    const newPaidSum = params.updatedInstallments.reduce((sum, i) => sum + i.paidAmount, 0);
    if (originalPaidSum !== newPaidSum) {
      throw new Error('لا يمكن حذف المبالغ المدفوعة مسبقاً أو إعادة جدولتها دون تسوية يدوية.');
    }

    // Verify total contract value remains equal
    const newTotalSum = params.updatedInstallments.reduce((sum, i) => sum + i.amount, 0);
    if (newTotalSum !== lease.totalContractValue) {
      throw new Error(`مجموع المبالغ المجدولة الجديدة (${newTotalSum} ر.س) لا يتطابق مع القيمة الإجمالية للعقد وهي (${lease.totalContractValue} ر.س)!`);
    }

    const amendmentId = `amd-${Date.now()}`;
    const newAmendment: LeaseAmendment = {
      id: amendmentId,
      leaseId: lease.id,
      title: 'إعادة جدولة الأقساط والدفعات المالية',
      effectiveDate: new Date().toISOString().slice(0, 10),
      reason: params.reason,
      details: `تم تحديث المواعيد وجدولة الأقساط المتبقية وتأكيد حفظ التحصيلات السابقة بقيمة ${originalPaidSum} ر.س.`,
      approvedBy: params.approvedBy || 'الإدارة المالية العليا',
      createdAt: new Date().toISOString(),
    };

    const updatedLease: Lease = {
      ...lease,
      installments: params.updatedInstallments,
      amendments: [...(lease.amendments || []), newAmendment]
    };

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'ملحق إعادة جدولة العقد المالي',
      entity: 'Lease',
      entityId: lease.id,
      performedBy: params.approvedBy || 'المدير المالي',
      role: 'Finance Admin',
      details: `ملحق إعادة جدولة العقد ${lease.contractNumber} برقم تتبع ملحق #${amendmentId}. السبب: ${params.reason}`,
      timestamp: new Date().toISOString(),
    };

    globalState = {
      ...globalState,
      leases: globalState.leases.map(l => l.id === lease.id ? updatedLease : l),
      auditLogs: [newLog, ...globalState.auditLogs],
    };

    notify();
    return updatedLease;
  }, []);

  /**
   * Save Handover/Return Inspection Protocol
   */
  const saveHandoverProtocol = useCallback((protocol: HandoverProtocol) => {
    const existingIndex = (globalState.handoverProtocols || []).findIndex(p => p.id === protocol.id);
    let updatedProtocols = [...(globalState.handoverProtocols || [])];

    if (existingIndex >= 0) {
      updatedProtocols[existingIndex] = protocol;
    } else {
      updatedProtocols = [protocol, ...updatedProtocols];
    }

    // Link to lease
    const updatedLeases = globalState.leases.map(l => {
      if (l.id === protocol.leaseId) {
        if (protocol.protocolType === 'delivery') {
          return { ...l, handoverProtocolId: protocol.id };
        } else {
          return { ...l, returnProtocolId: protocol.id };
        }
      }
      return l;
    });

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: protocol.protocolType === 'delivery' ? 'اعتماد محضر تسليم الوحدة السكنية' : 'اعتماد محضر استلام وإخلاء الوحدة السكنية',
      entity: 'HandoverProtocol',
      entityId: protocol.id,
      performedBy: protocol.deliveredBy,
      role: 'Operations',
      details: `تم حفظ محضر الفحص الفني لسلامة الأثاث بإجمالي ${protocol.items.length} قطعة وتسجيل قراءات عدادات الخدمات ومصادقة المستأجر والمشرف الميداني.`,
      timestamp: new Date().toISOString(),
    };

    globalState = {
      ...globalState,
      handoverProtocols: updatedProtocols,
      leases: updatedLeases,
      auditLogs: [newLog, ...globalState.auditLogs],
    };

    notify();
    return protocol;
  }, []);

  /**
   * Check in guest for a booking
   */
  const checkInBooking = useCallback((bookingId: string) => {
    const booking = globalState.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    globalState = {
      ...globalState,
      bookings: globalState.bookings.map(b => b.id === bookingId ? { ...b, status: 'checked_in' } : b),
      units: globalState.units.map(u => {
        if (u.id === booking.unitId) {
          return {
            ...u,
            occupancyStatus: 'daily_occupied',
            todayArrival: false,
          };
        }
        return u;
      }),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تأكيد دخول الضيف (Check-in)',
          entity: 'Booking',
          entityId: bookingId,
          performedBy: 'بهو الاستقبال والكونسيرج',
          role: 'Reception',
          details: `تم تأكيد تسجيل الدخول الفعلي للضيف ${booking.guest.fullName} وتسليمه بطاقات الشقة والترحيب به.`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  /**
   * Check out guest: frees occupancy, marks unit as needs_cleaning, auto-creates turnover task
   */
  const checkOutBooking = useCallback((bookingId: string) => {
    const booking = globalState.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const unit = globalState.units.find(u => u.id === booking.unitId);
    const taskId = `hk-${Date.now()}`;
    const taskNumber = `HK-TRN-${Math.floor(100 + Math.random() * 900)}`;

    const newHousekeepingTask: HousekeepingTask = {
      id: taskId,
      taskNumber,
      unitId: booking.unitId,
      propertyId: booking.propertyId,
      type: 'turnover',
      priority: 'high',
      status: 'pending',
      checklist: [
        { id: 'c1', text: 'إزالة وتطهير كافة بياضات الأسرة والمناشف المستعملة واستبدالها', done: false },
        { id: 'c2', text: 'تنظيف وتلميع بورسلين ورخام دورات المياه والمطابخ والأسطح الزجاجية', done: false },
        { id: 'c3', text: 'جرد المطبخ جرد سريع للتأكد من الميكرويف والغلاية والأواني الأساسية', done: false },
        { id: 'c4', text: 'تلميع الباركيه والأرضيات الخشبية بمواد منزل الفخامة الخاصة الخالية من الكحول', done: false },
        { id: 'c5', text: 'فحص القفل الذكي للباب وشواحن الهواتف ووصلات التلفزيون والأجهزة', done: false },
      ],
      notes: `تنظيف مغادرة وتجهيز للنزيل القادم للضيف ${booking.guest.fullName}`,
      completionPhotos: [],
      createdAt: new Date().toISOString(),
    };

    globalState = {
      ...globalState,
      bookings: globalState.bookings.map(b => b.id === bookingId ? { ...b, status: 'completed' } : b),
      allocations: globalState.allocations.map(a => a.referenceId === bookingId ? { ...a, status: 'released' } : a),
      units: globalState.units.map(u => {
        if (u.id === booking.unitId) {
          return {
            ...u,
            occupancyStatus: 'vacant',
            operationalStatus: 'needs_cleaning', // cannot be ready until housekeeping verified
            currentBookingId: undefined,
            todayDeparture: false,
          };
        }
        return u;
      }),
      housekeepingTasks: [newHousekeepingTask, ...globalState.housekeepingTasks],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تأكيد خروج الضيف (Check-out)',
          entity: 'Booking',
          entityId: bookingId,
          performedBy: 'بهو الاستقبال والكونسيرج',
          role: 'Reception',
          details: `تم إتمام عملية المغادرة للضيف ${booking.guest.fullName} من الشقة رقم #${unit?.unitNumber} وتوليد مهمة تنظيف دورية جديدة.`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  /**
   * Update unit operational status directly
   */
  const updateUnitOperationalStatus = useCallback((unitId: string, status: OperationalStatus, notes?: string) => {
    globalState = {
      ...globalState,
      units: globalState.units.map(u => u.id === unitId ? { ...u, operationalStatus: status, notes: notes ?? u.notes } : u),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تعديل الحالة التشغيلية للشقة',
          entity: 'Unit',
          entityId: unitId,
          performedBy: 'مشرف العمليات الميداني',
          role: 'Supervisor',
          details: `تم تحديث حالة الشقة يدوياً لتصبح: ${status} ${notes ? `ملاحظات: (${notes})` : ''}`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  /**
   * Housekeeping task workflow: update status, toggle checklist, supervisor verify
   */
  const updateHousekeepingTask = useCallback((taskId: string, updates: Partial<HousekeepingTask>) => {
    const task = globalState.housekeepingTasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask = { ...task, ...updates };

    // If supervisor verifies completion, unit can transition to "ready"!
    let updatedUnits = globalState.units;
    if (updates.status === 'verified') {
      updatedUnits = globalState.units.map(u => {
        if (u.id === task.unitId) {
          return {
            ...u,
            operationalStatus: 'ready' as OperationalStatus
          };
        }
        return u;
      });
    } else if (updates.status === 'in_progress') {
      updatedUnits = globalState.units.map(u => {
        if (u.id === task.unitId && u.operationalStatus === 'needs_cleaning') {
          return {
            ...u,
            operationalStatus: 'in_cleaning' as OperationalStatus
          };
        }
        return u;
      });
    }

    globalState = {
      ...globalState,
      units: updatedUnits,
      housekeepingTasks: globalState.housekeepingTasks.map(t => t.id === taskId ? updatedTask : t),
      auditLogs: updates.status ? [
        {
          id: `log-${Date.now()}`,
          action: `تحديث مهمة التنظيف ${task.taskNumber}`,
          entity: 'HousekeepingTask',
          entityId: taskId,
          performedBy: updates.assignedToStaffName || 'فريق التدبير المنزلي',
          role: 'Staff',
          details: `تم تغيير حالة المهمة لتصبح: ${updates.status}`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ] : globalState.auditLogs
    };

    notify();
  }, []);

  /**
   * Report maintenance task
   */
  const reportMaintenanceTask = useCallback((payload: {
    unitId: string;
    category: MaintenanceTask['category'];
    severity: MaintenanceTask['severity'];
    title: string;
    description: string;
    assignedToStaffName?: string;
  }) => {
    const unit = globalState.units.find(u => u.id === payload.unitId);
    if (!unit) return;

    const taskId = `mnt-${Date.now()}`;
    const taskNumber = `MNT-26-${Math.floor(100 + Math.random() * 900)}`;

    const newTask: MaintenanceTask = {
      id: taskId,
      taskNumber,
      unitId: payload.unitId,
      propertyId: unit.propertyId,
      category: payload.category,
      severity: payload.severity,
      title: payload.title,
      description: payload.description,
      status: 'in_progress',
      assignedToStaffName: payload.assignedToStaffName,
      photos: [],
      createdAt: new Date().toISOString(),
    };

    // If critical or moderate, set unit to in_maintenance
    const shouldBlockUnit = payload.severity === 'critical' || payload.severity === 'moderate';

    globalState = {
      ...globalState,
      units: globalState.units.map(u => {
        if (u.id === payload.unitId && shouldBlockUnit) {
          return {
            ...u,
            operationalStatus: 'in_maintenance' as OperationalStatus
          };
        }
        return u;
      }),
      maintenanceTasks: [newTask, ...globalState.maintenanceTasks],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تسجيل بلاغ صيانة فني',
          entity: 'MaintenanceTask',
          entityId: taskId,
          performedBy: 'مشرف الجودة والصيانة',
          role: 'Maintenance',
          details: `تم تسجيل تذكرة صيانة برقم #${taskNumber}: ${payload.title} للشقة رقم #${unit.unitNumber} مع إعداد شدة الضرر: ${payload.severity}`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  /**
   * Resolve maintenance task
   */
  const resolveMaintenanceTask = useCallback((taskId: string) => {
    const task = globalState.maintenanceTasks.find(t => t.id === taskId);
    if (!task) return;

    globalState = {
      ...globalState,
      maintenanceTasks: globalState.maintenanceTasks.map(t => t.id === taskId ? {
        ...t,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
      } : t),
      units: globalState.units.map(u => {
        if (u.id === task.unitId && u.operationalStatus === 'in_maintenance') {
          return {
            ...u,
            operationalStatus: 'ready' as OperationalStatus // or needs cleaning if dirty
          };
        }
        return u;
      }),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'إغلاق وحل تذكرة الصيانة',
          entity: 'MaintenanceTask',
          entityId: taskId,
          performedBy: 'فني الصيانة المناوب',
          role: 'Maintenance',
          details: `تم إتمام الصيانة الفنية ومعاينة المشرف وإغلاق بلاغ الصيانة بنجاح وتحويل الشقة إلى جاهزة.`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  /**
   * Block / unblock unit for custom period or maintenance
   */
  const blockUnitPeriod = useCallback((unitId: string, startDate: string, endDate: string, reason: string) => {
    const allocId = `alloc-blk-${Date.now()}`;
    const newAlloc: UnitAllocation = {
      id: allocId,
      unitId,
      type: 'block',
      referenceId: allocId,
      startDate: `${startDate}T00:00:00`,
      endDate: `${endDate}T23:59:59`,
      prepBufferHours: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes: reason,
    };

    globalState = {
      ...globalState,
      allocations: [newAlloc, ...globalState.allocations],
      units: globalState.units.map(u => u.id === unitId ? { ...u, operationalStatus: 'blocked' } : u),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'حجب الشقة يدوياً وتطبيق إغلاق',
          entity: 'UnitAllocation',
          entityId: allocId,
          performedBy: 'مدير العمليات الفندقية',
          role: 'Admin',
          details: `تم تطبيق حظر حجز للوحدة من تاريخ ${startDate} إلى ${endDate} بسبب: ${reason}`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  /**
   * Security deposit actions: deduct or refund
   */
  const processDepositDeduction = useCallback((depositId: string, amount: number, reason: string, approvedBy: string) => {
    const dep = globalState.securityDeposits.find(d => d.id === depositId);
    if (!dep) return;

    const remainingAmount = dep.amount - dep.deductions.reduce((sum, d) => sum + d.amount, 0);
    if (amount > remainingAmount) {
      throw new Error(`مبلغ الخصم المطلوب (${amount} ر.س) يتجاوز رصيد التأمين المتاح وهو (${remainingAmount} ر.س)`);
    }

    const deductionId = `ded-${Date.now()}`;
    const deduction = {
      id: deductionId,
      amount,
      reason,
      deductedAt: new Date().toISOString(),
      approvedBy,
    };

    const newDeductions = [...dep.deductions, deduction];
    const totalDeducted = newDeductions.reduce((sum, d) => sum + d.amount, 0);
    const newStatus = totalDeducted >= dep.amount ? 'claimed_for_damage' : 'partially_refunded';

    globalState = {
      ...globalState,
      securityDeposits: globalState.securityDeposits.map(d => d.id === depositId ? {
        ...d,
        deductions: newDeductions,
        status: newStatus as any,
      } : d),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تسوية اقتطاع من تأمين الشقة',
          entity: 'SecurityDeposit',
          entityId: depositId,
          performedBy: approvedBy,
          role: 'Supervisor',
          details: `اقتطاع قيمة ${amount} ر.س لتعويض تلفيات: ${reason}`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  const refundSecurityDeposit = useCallback((depositId: string, refundAmount: number) => {
    const dep = globalState.securityDeposits.find(d => d.id === depositId);
    if (!dep) return;

    globalState = {
      ...globalState,
      securityDeposits: globalState.securityDeposits.map(d => d.id === depositId ? {
        ...d,
        refundAmount,
        status: 'fully_refunded',
        refundedAt: new Date().toISOString(),
      } : d),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'إرجاع وتصفية تأمين سكن بالكامل',
          entity: 'SecurityDeposit',
          entityId: depositId,
          performedBy: 'أمين الصندوق',
          role: 'Accountant',
          details: `تمت تسوية إرجاع مبلغ تأمين الإيجار وقدره ${refundAmount} ر.س للنزيل المستفيد ${dep.guestName}`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  /**
   * Log guest view of smart lock PIN (Audit compliance requirement)
   */
  const logSmartLockPinView = useCallback((bookingId: string) => {
    const booking = globalState.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    // Only allow view if confirmed or checked in
    if (booking.status !== 'confirmed' && booking.status !== 'checked_in') {
      throw new Error('لا يمكن الكشف عن الرمز السري إلا للحجوزات المؤكدة والنشطة للخصوصية والأمن الفندقي.');
    }

    globalState = {
      ...globalState,
      bookings: globalState.bookings.map(b => b.id === bookingId ? {
        ...b,
        pinAccessedAt: new Date().toISOString(),
        pinAccessedBy: 'guest_portal'
      } : b),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'عرض كود القفل الرقمي للضيف',
          entity: 'SmartLock',
          entityId: bookingId,
          performedBy: booking.guest.fullName,
          role: 'Guest',
          details: `تم الكشف وعرض الرمز السري للضيف من بوابة الإقامة الرقمية للنزيل (${booking.smartLockPin})`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  /**
   * Content & Settings customization
   */
  const updateCompanySettings = useCallback((newSettings: Partial<CompanySettings>) => {
    globalState = {
      ...globalState,
      settings: {
        ...globalState.settings,
        ...newSettings,
        theme: {
          ...globalState.settings.theme,
          ...(newSettings.theme || {})
        }
      },
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تحديث تفاصيل إعدادات الشركة الرقمية',
          entity: 'CompanySettings',
          entityId: 'global',
          performedBy: 'المدير المالي التنفيذي',
          role: 'Admin',
          details: 'تم إجراء تعديل يدوياً على السجل الضريبي، رقم الهاتف، أو اسم وشعار شركة منزل الفخامة الفندقية.',
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();

    // Async push to server
    apiCall('/api/settings', 'PUT', newSettings).catch(err => {
      console.warn('[Sync Error] Could not update settings on server:', err.message);
    });
  }, []);

  const updateContentSections = useCallback((sections: ContentSection[]) => {
    globalState = {
      ...globalState,
      contentSections: sections,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'إعادة ترتيب وتخصيص محتوى الموقع الهبوطي',
          entity: 'ContentSections',
          entityId: 'landing',
          performedBy: 'منسق تسويق المحتوى وبوابات الضيافة',
          role: 'Admin',
          details: 'تم إجراء تغيير في مصفوفة ترتيب الأقسام أو إظهار/إخفاء بنود من الصفحة الهبوطية العامة.',
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  /**
   * --- 1. Property Management ---
   */
  const createProperty = useCallback((payload: Omit<Property, 'id'>) => {
    // Check duplicate identifier code
    if (globalState.properties.some(p => p.identifierCode.toLowerCase() === payload.identifierCode.toLowerCase())) {
      throw new Error(`كود تصنيف المبنى (${payload.identifierCode}) مكرر ومسجل لمبنى آخر سلفاً!`);
    }

    const propId = `prop-${Date.now()}`;
    const newProperty: Property = {
      ...payload,
      id: propId,
      slug: payload.slug || `prop-${payload.identifierCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      status: payload.status || 'draft',
      sharedFacilities: payload.sharedFacilities || [],
    };

    // Auto-create standard floors according to totalFloors
    const newFloors: Floor[] = [];
    newFloors.push({ id: `flr-${propId}-b1`, propertyId: propId, floorNumber: -1, name: 'طابق القبو الأول (مواقف سيارات)', label: 'القبو الأول' });
    newFloors.push({ id: `flr-${propId}-0`, propertyId: propId, floorNumber: 0, name: 'طابق الاستقبال (البهو والبهو المشترك)', label: 'البهو الأرضي' });

    for (let f = 1; f <= payload.totalFloors; f++) {
      newFloors.push({ id: `flr-${propId}-${f}`, propertyId: propId, floorNumber: f, name: `طابق الدور رقم ${f}`, label: `الدور رقم ${f}` });
    }

    globalState = {
      ...globalState,
      properties: [...globalState.properties, newProperty],
      floors: [...globalState.floors, ...newFloors],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'إضافة مجمع سكني وموقع جديد',
          entity: 'Property',
          entityId: propId,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: `تم بنجاح تشييد وتسجيل مبنى ${payload.name} كود (${payload.identifierCode}) مع تشييد نظامي تلقائي لعدد ${newFloors.length} طابق شامل القبو والبهو.`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();

    // Push to backend API
    apiCall('/api/properties', 'POST', {
      id: propId,
      name: payload.name,
      code: payload.identifierCode,
      address: payload.address,
      city: payload.city,
      district: payload.district,
      floorsCount: payload.totalFloors,
      unitsCount: (payload as any).totalUnits || 0,
      description: payload.description,
      images: payload.media?.map(m => m.url) || [],
      isActive: payload.status !== 'unlisted'
    }).catch(err => console.warn('[Sync Error] Property creation sync:', err.message));

    return newProperty;
  }, []);

  const updateProperty = useCallback((propertyId: string, updates: Partial<Property>) => {
    globalState = {
      ...globalState,
      properties: globalState.properties.map(p => p.id === propertyId ? { ...p, ...updates } : p),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تعديل تفاصيل المبنى السكني',
          entity: 'Property',
          entityId: propertyId,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: `تم تحديث البيانات الهندسية أو مواعيد المغادرة والدخول للمبنى.`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();

    apiCall(`/api/properties/${propertyId}`, 'PUT', {
      name: updates.name,
      code: updates.identifierCode,
      address: updates.address,
      city: updates.city,
      district: updates.district,
      floorsCount: updates.totalFloors,
      unitsCount: (updates as any).totalUnits,
      description: updates.description,
      isActive: updates.status ? updates.status !== 'unlisted' : undefined
    }).catch(err => console.warn('[Sync Error] Property update sync:', err.message));
  }, []);

  const archiveProperty = useCallback((propertyId: string) => {
    // Check for any active units with bookings or leases
    const propertyUnits = globalState.units.filter(u => u.propertyId === propertyId);
    const unitIds = new Set(propertyUnits.map(u => u.id));
    const activeAlloc = globalState.allocations.some(a => unitIds.has(a.unitId) && a.status === 'active');

    if (activeAlloc) {
      throw new Error('لا يمكن سحب أو إخفاء المبنى السكني نظراً لوجود تعاقدات أو حجوزات نشطة جارية أو مستقبلية.');
    }

    globalState = {
      ...globalState,
      properties: globalState.properties.map(p => p.id === propertyId ? { ...p, status: 'unlisted' } : p),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تغيير حالة مبنى إلى غير معروض',
          entity: 'Property',
          entityId: propertyId,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: 'تم تعليق بيع أو عرض الشقق للمبنى وتصنيفه كغير مدرج يدوياً.',
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();

    apiCall(`/api/properties/${propertyId}`, 'DELETE').catch(err => {
      console.warn('[Sync Error] Property archive sync:', err.message);
    });
  }, []);

  /**
   * --- 2. Floor Management ---
   */
  const createFloor = useCallback((payload: Omit<Floor, 'id'>) => {
    const floorId = `flr-${Date.now()}`;
    const newFloor: Floor = {
      ...payload,
      id: floorId,
    };

    globalState = {
      ...globalState,
      floors: [...globalState.floors, newFloor],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'إضافة طابق للمبنى يدوياً',
          entity: 'Floor',
          entityId: floorId,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: `تم تشييد الطابق ${payload.name} للمبنى المختار بنجاح.`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
    return newFloor;
  }, []);

  const updateFloor = useCallback((floorId: string, updates: Partial<Floor>) => {
    globalState = {
      ...globalState,
      floors: globalState.floors.map(f => f.id === floorId ? { ...f, ...updates } : f),
    };
    notify();
  }, []);

  const deleteFloor = useCallback((floorId: string) => {
    const floorUnits = globalState.units.filter(u => u.floorId === floorId);
    if (floorUnits.length > 0) {
      const activeUnit = floorUnits.some(u =>
        globalState.allocations.some(a => a.unitId === u.id && a.status === 'active')
      );
      if (activeUnit) {
        throw new Error('لا يمكن حذف الطابق نظراً لوجود وحدات سكنية تابعة له وبها حركات تعاقد نشطة حالياً!');
      }
    }

    globalState = {
      ...globalState,
      floors: globalState.floors.filter(f => f.id !== floorId),
      units: globalState.units.filter(u => u.floorId !== floorId),
    };
    notify();
  }, []);

  /**
   * --- 3. Unit Management & Cloner ---
   */
  const createUnit = useCallback((payload: Omit<Unit, 'id' | 'bedroomsCount' | 'bathroomsCount' | 'bedsCount'> & { spaces?: UnitSpace[] }) => {
    // Strict uniqueness check: prevent duplicate unitNumber within the same property
    const duplicate = globalState.units.some(
      u => u.propertyId === payload.propertyId && u.unitNumber.trim() === payload.unitNumber.trim() && u.publicationStatus !== 'archived'
    );
    if (duplicate) {
      throw new Error(`شقة بالرقم "${payload.unitNumber}" مسجلة ومحفوظة حالياً في نفس المبنى.`);
    }

    const unitId = `unit-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const spaces = payload.spaces || [];
    const metrics = calculateUnitRoomMetrics(spaces);

    const newUnit: Unit = {
      ...payload,
      id: unitId,
      spaces,
      bedroomsCount: metrics.bedroomsCount,
      bathroomsCount: metrics.bathroomsCount,
      bedsCount: metrics.bedsCount,
      operationalStatus: payload.operationalStatus || 'ready',
      occupancyStatus: 'vacant',
      publicationStatus: payload.publicationStatus || 'published',
    };

    globalState = {
      ...globalState,
      units: [...globalState.units, newUnit],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'إضافة وحدة شقة سكنية جديدة',
          entity: 'Unit',
          entityId: unitId,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: `تم تسجيل الشقة رقم #${newUnit.unitNumber} (${newUnit.title}) مع احتساب الغرف والمقاعد تلقائياً لتكون (${newUnit.bedroomsCount} غرف نوم، ${newUnit.bathroomsCount} حمام).`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();

    apiCall('/api/units', 'POST', {
      id: unitId,
      propertyId: payload.propertyId,
      floorId: payload.floorId,
      unitNumber: payload.unitNumber,
      type: payload.type,
      areaSqm: payload.areaSqm,
      dailyRate: payload.dailyRate,
      monthlyRate: payload.monthlyRate,
      annualRate: payload.yearlyRate,
      occupancyStatus: payload.occupancyStatus,
      publicationStatus: payload.publicationStatus,
      images: payload.media?.map(m => m.url) || [],
      spaces: payload.spaces,
      smartLockPin: (payload as any).smartLockPin
    }).catch(err => console.warn('[Sync Error] Unit creation sync:', err.message));

    return newUnit;
  }, []);

  /**
   * Batch create multiple units with numbering range
   */
  const batchCreateUnits = useCallback((params: {
    propertyId: string;
    floorId: string;
    startNumber: number;
    endNumber: number;
    prefix?: string;
    templateUnitId?: string;
  }) => {
    const template = params.templateUnitId
      ? globalState.units.find(u => u.id === params.templateUnitId)
      : null;

    const floor = globalState.floors.find(f => f.id === params.floorId);
    const property = globalState.properties.find(p => p.id === params.propertyId);

    if (!floor || !property) throw new Error('البرج السكني أو الطابق المحدد غير متوفر.');

    const createdUnits: Unit[] = [];
    const existingNumbers = new Set(
      globalState.units.filter(u => u.propertyId === params.propertyId && u.publicationStatus !== 'archived').map(u => u.unitNumber.trim())
    );

    // Verify all numbers in advance
    for (let i = params.startNumber; i <= params.endNumber; i++) {
      const numStr = params.prefix ? `${params.prefix}${i}` : `${i}`;
      if (existingNumbers.has(numStr)) {
        throw new Error(`تعذر التشييد المتعدد، الشقة بالرقم "${numStr}" مسجلة حالياً في المبنى.`);
      }
    }

    for (let i = params.startNumber; i <= params.endNumber; i++) {
      const numStr = params.prefix ? `${params.prefix}${i}` : `${i}`;
      const unitId = `unit-${Date.now()}-${i}`;

      const spaces = template ? JSON.parse(JSON.stringify(template.spaces)) : [
        {
          id: `sp-${Date.now()}-1`,
          name: 'منطقة المعيشة والجلوس المريحة',
          type: 'living_room' as const,
          fittings: [{ id: `fit-${Date.now()}-1`, name: 'طقم كنب فخم مناسب للضيوف', category: 'furniture' as const, quantity: 1 }]
        },
        {
          id: `sp-${Date.now()}-2`,
          name: 'غرفة النوم الرئيسية الدافئة',
          type: 'bedroom' as const,
          bedsCount: 1,
          fittings: [{ id: `fit-${Date.now()}-2`, name: 'سرير كينج ملكي بحجم مريح', category: 'bed' as const, quantity: 1 }]
        },
        {
          id: `sp-${Date.now()}-3`,
          name: 'دورة المياه والجاكوزي المتطور',
          type: 'bathroom' as const,
          fittings: [{ id: `fit-${Date.now()}-3`, name: 'تجهيز استحمام مدمج متكامل', category: 'sanitary' as const, quantity: 1 }]
        }
      ];

      const metrics = calculateUnitRoomMetrics(spaces);

      const unit: Unit = {
        id: unitId,
        propertyId: params.propertyId,
        floorId: params.floorId,
        unitNumber: numStr,
        title: template ? `${template.title.split('-')[0].trim()} - شقة رقم ${numStr}` : `شقة منزل الفخامة رقم #${numStr}`,
        titleEn: `Serviced Unit #${numStr}`,
        type: template ? template.type : 'apartment',
        areaSqm: template ? template.areaSqm : 85,
        floorNumber: floor.floorNumber,
        maxGuests: template ? template.maxGuests : 3,
        bedroomsCount: metrics.bedroomsCount,
        bathroomsCount: metrics.bathroomsCount,
        bedsCount: metrics.bedsCount,
        spaces,
        amenities: template ? [...template.amenities] : ['smart_lock', 'wifi', 'cleaning', 'concierge', 'full_kitchen'],
        media: template ? [...template.media] : (property.media[0] ? [property.media[0]] : []),
        floorPlanUrl: template?.floorPlanUrl,
        furnishingStatus: template?.furnishingStatus || 'furnished',
        allowDaily: template ? template.allowDaily : true,
        dailyRate: template ? template.dailyRate : 650,
        dailySecurityDeposit: template?.dailySecurityDeposit || (template ? template.securityDeposit : 800),
        allowMonthly: template ? template.allowMonthly : true,
        monthlyRate: template ? template.monthlyRate : 13500,
        monthlySecurityDeposit: template?.monthlySecurityDeposit || 3000,
        allowYearly: template ? template.allowYearly : true,
        yearlyRate: template ? template.yearlyRate : 140000,
        yearlySecurityDeposit: template?.yearlySecurityDeposit || 6000,
        yearlyPaymentOptions: template ? [...template.yearlyPaymentOptions] : ['single_annual', 'semi_annual'],
        cleaningFee: template ? template.cleaningFee : 100,
        securityDeposit: template ? template.securityDeposit : 800,
        taxPercentage: 15,
        operationalStatus: 'ready',
        occupancyStatus: 'vacant',
        publicationStatus: 'published',
      };

      createdUnits.push(unit);
    }

    globalState = {
      ...globalState,
      units: [...globalState.units, ...createdUnits],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تشييد وحدات سكنية متعدد بالتوليد المطور',
          entity: 'Unit',
          entityId: params.floorId,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: `تم توليد عدد ${createdUnits.length} شقة فندقية جديدة تابعة للطابق ${floor.name} وبأرقام تتسلسل من ${params.startNumber} إلى ${params.endNumber}`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
    return createdUnits;
  }, []);

  /**
   * Clone unit as a model/template for similar units
   */
  const cloneUnit = useCallback((sourceUnitId: string, newUnitNumber: string, targetFloorId?: string) => {
    const source = globalState.units.find(u => u.id === sourceUnitId);
    if (!source) throw new Error('الشقة المصدر للنسخ غير متوفرة.');

    // Strict uniqueness check
    const duplicate = globalState.units.some(
      u => u.propertyId === source.propertyId && u.unitNumber.trim() === newUnitNumber.trim() && u.publicationStatus !== 'archived'
    );
    if (duplicate) {
      throw new Error(`شقة بالرقم "${newUnitNumber}" مسجلة ومحفوظة حالياً في نفس المبنى!`);
    }

    const floor = targetFloorId
      ? globalState.floors.find(f => f.id === targetFloorId)
      : globalState.floors.find(f => f.id === source.floorId);

    const clonedId = `unit-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    // Deep clone spaces and fittings with fresh IDs
    const clonedSpaces: UnitSpace[] = source.spaces.map(sp => ({
      ...sp,
      id: `sp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      fittings: sp.fittings.map(fit => ({
        ...fit,
        id: `fit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      }))
    }));

    const metrics = calculateUnitRoomMetrics(clonedSpaces);

    const clonedUnit: Unit = {
      ...source,
      id: clonedId,
      unitNumber: newUnitNumber.trim(),
      title: `${source.title.split('#')[0].trim()} #${newUnitNumber}`,
      floorId: floor ? floor.id : source.floorId,
      floorNumber: floor ? floor.floorNumber : source.floorNumber,
      spaces: clonedSpaces,
      bedroomsCount: metrics.bedroomsCount,
      bathroomsCount: metrics.bathroomsCount,
      bedsCount: metrics.bedsCount,
      operationalStatus: 'ready',
      occupancyStatus: 'vacant',
      currentBookingId: undefined,
      assignedParkingId: undefined, // Must be assigned independently!
      isCloned: true,
      clonedFromUnitId: sourceUnitId,
      todayArrival: false,
      todayDeparture: false,
      notes: `نسخة مطابقة من شقة رقم #${source.unitNumber}`,
    };

    globalState = {
      ...globalState,
      units: [...globalState.units, clonedUnit],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'نسخ شقة سكنية متطابقة يدوياً',
          entity: 'Unit',
          entityId: clonedId,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: `تم نسخ نموذج الشقة #${source.unitNumber} بالكامل وتوليد الشقة الجديدة رقم #${newUnitNumber}`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
    return clonedUnit;
  }, []);

  const updateUnit = useCallback((unitId: string, updates: Partial<Unit>) => {
    const existing = globalState.units.find(u => u.id === unitId);
    if (!existing) return;

    // If unitNumber is changed, verify uniqueness
    if (updates.unitNumber && updates.unitNumber.trim() !== existing.unitNumber.trim()) {
      const duplicate = globalState.units.some(
        u => u.id !== unitId && u.propertyId === existing.propertyId && u.unitNumber.trim() === updates.unitNumber?.trim() && u.publicationStatus !== 'archived'
      );
      if (duplicate) {
        throw new Error(`شقة بالرقم "${updates.unitNumber}" مسجلة سلفاً في نفس المجمع!`);
      }
    }

    // Recalculate metrics if spaces updated
    let calculated = {};
    if (updates.spaces) {
      calculated = calculateUnitRoomMetrics(updates.spaces);
    }

    globalState = {
      ...globalState,
      units: globalState.units.map(u => u.id === unitId ? { ...u, ...updates, ...calculated } : u),
    };

    notify();

    apiCall(`/api/units/${unitId}`, 'PUT', {
      unitNumber: updates.unitNumber,
      type: updates.type,
      areaSqm: updates.areaSqm,
      dailyRate: updates.dailyRate,
      monthlyRate: updates.monthlyRate,
      annualRate: updates.yearlyRate,
      occupancyStatus: updates.occupancyStatus,
      publicationStatus: updates.publicationStatus,
      spaces: updates.spaces,
      smartLockPin: (updates as any).smartLockPin
    }).catch(err => console.warn('[Sync Error] Unit update sync:', err.message));
  }, []);

  const archiveUnit = useCallback((unitId: string) => {
    // Check if unit has active allocations
    const hasActiveAlloc = globalState.allocations.some(a => a.unitId === unitId && a.status === 'active');
    if (hasActiveAlloc) {
      throw new Error('لا يمكن حذف أو أرشفة الشقة نظراً لوجود تعاقدات، إيجار، أو حظر نشط للتواريخ الحالية والآتية.');
    }

    // Unassign parking if any
    const assignedSpot = globalState.parkingSpots.find(p => p.assignedUnitId === unitId);
    let updatedParking = globalState.parkingSpots;
    if (assignedSpot) {
      updatedParking = globalState.parkingSpots.map(p =>
        p.id === assignedSpot.id ? { ...p, status: 'available' as const, assignedUnitId: undefined } : p
      );
    }

    globalState = {
      ...globalState,
      parkingSpots: updatedParking,
      units: globalState.units.map(u => u.id === unitId ? { ...u, publicationStatus: 'archived', operationalStatus: 'blocked' } : u),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'نقل شقة للأرشيف والتعطيل',
          entity: 'Unit',
          entityId: unitId,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: 'تمت أرشفة الشقة وتعطيلها تماماً وفك ربطها عن أي مواقف خاصة بها.',
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();

    apiCall(`/api/units/${unitId}`, 'DELETE').catch(err => {
      console.warn('[Sync Error] Unit archive sync:', err.message);
    });
  }, []);

  /**
   * --- 4. Spaces & Fittings Management ---
   */
  const addUnitSpace = useCallback((unitId: string, space: Omit<UnitSpace, 'id' | 'fittings'> & { fittings?: SpaceFitting[] }) => {
    const unit = globalState.units.find(u => u.id === unitId);
    if (!unit) return;

    const spaceId = `sp-${Date.now()}`;
    const newSpace: UnitSpace = {
      ...space,
      id: spaceId,
      fittings: space.fittings || [],
    };

    const newSpaces = [...unit.spaces, newSpace];
    const metrics = calculateUnitRoomMetrics(newSpaces);

    globalState = {
      ...globalState,
      units: globalState.units.map(u => u.id === unitId ? {
        ...u,
        spaces: newSpaces,
        ...metrics
      } : u),
    };

    notify();
  }, []);

  const updateUnitSpace = useCallback((unitId: string, spaceId: string, updates: Partial<UnitSpace>) => {
    const unit = globalState.units.find(u => u.id === unitId);
    if (!unit) return;

    const newSpaces = unit.spaces.map(sp => sp.id === spaceId ? { ...sp, ...updates } : sp);
    const metrics = calculateUnitRoomMetrics(newSpaces);

    globalState = {
      ...globalState,
      units: globalState.units.map(u => u.id === unitId ? {
        ...u,
        spaces: newSpaces,
        ...metrics
      } : u),
    };

    notify();
  }, []);

  const deleteUnitSpace = useCallback((unitId: string, spaceId: string) => {
    const unit = globalState.units.find(u => u.id === unitId);
    if (!unit) return;

    const newSpaces = unit.spaces.filter(sp => sp.id !== spaceId);
    const metrics = calculateUnitRoomMetrics(newSpaces);

    globalState = {
      ...globalState,
      units: globalState.units.map(u => u.id === unitId ? {
        ...u,
        spaces: newSpaces,
        ...metrics
      } : u),
    };

    notify();
  }, []);

  const addSpaceFitting = useCallback((unitId: string, spaceId: string, fitting: Omit<SpaceFitting, 'id'>) => {
    const unit = globalState.units.find(u => u.id === unitId);
    if (!unit) return;

    const fittingId = `fit-${Date.now()}`;
    const newFitting: SpaceFitting = {
      ...fitting,
      id: fittingId,
    };

    const newSpaces = unit.spaces.map(sp => {
      if (sp.id === spaceId) {
        return {
          ...sp,
          fittings: [...sp.fittings, newFitting],
        };
      }
      return sp;
    });

    const metrics = calculateUnitRoomMetrics(newSpaces);

    globalState = {
      ...globalState,
      units: globalState.units.map(u => u.id === unitId ? {
        ...u,
        spaces: newSpaces,
        ...metrics
      } : u),
    };

    notify();
  }, []);

  const updateSpaceFitting = useCallback((unitId: string, spaceId: string, fittingId: string, updates: Partial<SpaceFitting>) => {
    const unit = globalState.units.find(u => u.id === unitId);
    if (!unit) return;

    const newSpaces = unit.spaces.map(sp => {
      if (sp.id === spaceId) {
        return {
          ...sp,
          fittings: sp.fittings.map(fit => fit.id === fittingId ? { ...fit, ...updates } : fit),
        };
      }
      return sp;
    });

    const metrics = calculateUnitRoomMetrics(newSpaces);

    globalState = {
      ...globalState,
      units: globalState.units.map(u => u.id === unitId ? {
        ...u,
        spaces: newSpaces,
        ...metrics
      } : u),
    };

    notify();
  }, []);

  const deleteSpaceFitting = useCallback((unitId: string, spaceId: string, fittingId: string) => {
    const unit = globalState.units.find(u => u.id === unitId);
    if (!unit) return;

    const newSpaces = unit.spaces.map(sp => {
      if (sp.id === spaceId) {
        return {
          ...sp,
          fittings: sp.fittings.filter(fit => fit.id !== fittingId),
        };
      }
      return sp;
    });

    const metrics = calculateUnitRoomMetrics(newSpaces);

    globalState = {
      ...globalState,
      units: globalState.units.map(u => u.id === unitId ? {
        ...u,
        spaces: newSpaces,
        ...metrics
      } : u),
    };

    notify();
  }, []);

  /**
   * --- 5. Parking Spots Management ---
   */
  const createParkingSpot = useCallback((payload: Omit<ParkingSpot, 'id' | 'createdAt'>) => {
    // Unique spot number check within the property
    const duplicate = globalState.parkingSpots.some(
      p => p.propertyId === payload.propertyId && p.spotNumber.trim() === payload.spotNumber.trim()
    );
    if (duplicate) {
      throw new Error(`موقف سيارات بالرقم "${payload.spotNumber}" مسجل ومعتمد مسبقاً في هذا البرج!`);
    }

    const spotId = `prk-${Date.now()}`;
    const newSpot: ParkingSpot = {
      ...payload,
      id: spotId,
      createdAt: new Date().toISOString(),
    };

    // If dedicated to a unit on creation
    let updatedUnits = globalState.units;
    if (payload.assignedUnitId) {
      // Check if unit already has parking
      const unit = globalState.units.find(u => u.id === payload.assignedUnitId);
      if (unit?.assignedParkingId) {
        // Free the previous spot
        globalState.parkingSpots = globalState.parkingSpots.map(p =>
          p.id === unit.assignedParkingId ? { ...p, status: 'available' as const, assignedUnitId: undefined } : p
        );
      }
      updatedUnits = globalState.units.map(u =>
        u.id === payload.assignedUnitId ? { ...u, assignedParkingId: spotId } : u
      );
    }

    globalState = {
      ...globalState,
      parkingSpots: [...globalState.parkingSpots, newSpot],
      units: updatedUnits,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تخصيص موقف سيارات إضافي',
          entity: 'ParkingSpot',
          entityId: spotId,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: `موقف جديد برقم ${newSpot.spotNumber} في (${newSpot.location}) متاح للحجز أو تعيينه لشقة فندقية.`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
    return newSpot;
  }, []);

  const updateParkingSpot = useCallback((spotId: string, updates: Partial<ParkingSpot>) => {
    const existing = globalState.parkingSpots.find(p => p.id === spotId);
    if (!existing) return;

    if (updates.spotNumber && updates.spotNumber.trim() !== existing.spotNumber.trim()) {
      const duplicate = globalState.parkingSpots.some(
        p => p.id !== spotId && p.propertyId === existing.propertyId && p.spotNumber.trim() === updates.spotNumber?.trim()
      );
      if (duplicate) {
        throw new Error(`موقف سيارات بالرقم "${updates.spotNumber}" مسجل بالفعل!`);
      }
    }

    globalState = {
      ...globalState,
      parkingSpots: globalState.parkingSpots.map(p => p.id === spotId ? { ...p, ...updates } : p),
    };

    notify();
  }, []);

  const assignParkingToUnit = useCallback((spotId: string, unitId: string) => {
    const spot = globalState.parkingSpots.find(p => p.id === spotId);
    const unit = globalState.units.find(u => u.id === unitId);

    if (!spot || !unit) throw new Error('الموقف أو الشقة غير متوفرة');

    // Strict constraint: Prevent assigning parking spot exclusively to two units simultaneously!
    if (spot.assignedUnitId && spot.assignedUnitId !== unitId) {
      const currentUnit = globalState.units.find(u => u.id === spot.assignedUnitId);
      throw new Error(`موقف السيارات ${spot.spotNumber} مخصص حصرياً حالياً للشقة رقم (${currentUnit?.unitNumber || spot.assignedUnitId})! يجب فك التعيين أولاً.`);
    }

    // If unit already has a different parking, free the previous parking spot
    let updatedSpots = globalState.parkingSpots;
    if (unit.assignedParkingId && unit.assignedParkingId !== spotId) {
      updatedSpots = updatedSpots.map(p =>
        p.id === unit.assignedParkingId ? { ...p, status: 'available' as const, assignedUnitId: undefined } : p
      );
    }

    // Now assign
    updatedSpots = updatedSpots.map(p =>
      p.id === spotId ? { ...p, status: 'assigned' as const, usageType: 'dedicated_unit' as const, assignedUnitId: unitId } : p
    );

    globalState = {
      ...globalState,
      parkingSpots: updatedSpots,
      units: globalState.units.map(u => u.id === unitId ? { ...u, assignedParkingId: spotId } : u),
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'تخصيص موقف سيارة لشقة',
          entity: 'ParkingSpot',
          entityId: spotId,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: `تمت تسوية تخصيص الموقف الخاص برقم ${spot.spotNumber} حصرياً لصالح الشقة رقم #${unit.unitNumber}`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  const unassignParking = useCallback((spotId: string) => {
    const spot = globalState.parkingSpots.find(p => p.id === spotId);
    if (!spot) return;

    const unitId = spot.assignedUnitId;

    globalState = {
      ...globalState,
      parkingSpots: globalState.parkingSpots.map(p =>
        p.id === spotId ? { ...p, status: 'available' as const, assignedUnitId: undefined } : p
      ),
      units: unitId ? globalState.units.map(u =>
        u.id === unitId ? { ...u, assignedParkingId: undefined } : u
      ) : globalState.units,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'إلغاء تعيين موقف سيارة',
          entity: 'ParkingSpot',
          entityId: spotId,
          performedBy: 'أحمد المفلح',
          role: 'Admin',
          details: `تم فك ربط الموقف المخصص رقم ${spot.spotNumber} وإرجاعه شاغراً متاحاً للكل.`,
          timestamp: new Date().toISOString(),
        },
        ...globalState.auditLogs
      ]
    };

    notify();
  }, []);

  const deleteParkingSpot = useCallback((spotId: string) => {
    const spot = globalState.parkingSpots.find(p => p.id === spotId);
    if (!spot) return;

    const unitId = spot.assignedUnitId;

    globalState = {
      ...globalState,
      parkingSpots: globalState.parkingSpots.filter(p => p.id !== spotId),
      units: unitId ? globalState.units.map(u =>
        u.id === unitId ? { ...u, assignedParkingId: undefined } : u
      ) : globalState.units,
    };

    notify();
  }, []);

  // --- Financial Operations: Payments & Allocation Engine ---
  /**
   * Record payment and allocate across multiple installments / dues, saving surplus as tenant credit
   */
  const recordPaymentAndAllocate = useCallback((params: {
    amount: number;
    method: 'mada' | 'visa_mastercard' | 'apple_pay' | 'bank_transfer' | 'cash';
    tenantNationalId: string;
    tenantName: string;
    receiptNumber?: string;
    notes?: string;
    performedBy?: string;
    allocations: {
      leaseId: string;
      installmentId?: string;
      targetType: 'installment' | 'service_fee' | 'damage_claim';
      amount: number;
    }[];
  }) => {
    if (params.amount <= 0) {
      throw new Error('المبلغ المدفوع يجب أن يكون أكبر من الصفر.');
    }

    const totalAllocated = (params.allocations || []).reduce((sum, a) => sum + a.amount, 0);
    if (totalAllocated > params.amount) {
      throw new Error(`تعذر التخصيص، المبالغ الموزعة (${totalAllocated} ر.س) تتجاوز قيمة الدفعة المفوترة وهي (${params.amount} ر.س)!`);
    }

    const unallocatedCredit = params.amount - totalAllocated;
    const nowIso = new Date().toISOString();
    const receiptNo = params.receiptNumber || `RCP-${Date.now().toString().slice(-6)}`;
    const paymentId = `pay-${Date.now()}`;

    // Apply allocations to leases and installments
    let updatedLeases = [...globalState.leases];

    (params.allocations || []).forEach(alloc => {
      const leaseIdx = updatedLeases.findIndex(l => l.id === alloc.leaseId);
      if (leaseIdx === -1) return;

      const lease = updatedLeases[leaseIdx];

      if (alloc.targetType === 'installment' && alloc.installmentId) {
        const instIdx = (lease.installments || []).findIndex(i => i.id === alloc.installmentId);
        if (instIdx === -1) return;

        const inst = lease.installments[instIdx];
        if (alloc.amount > inst.remainingAmount) {
          throw new Error(`مبلغ التخصيص المستهدف للدفعة (${alloc.amount} ر.س) يفوق المتبقي وقدره (${inst.remainingAmount} ر.س) لعقد الإيجار ${lease.contractNumber}`);
        }

        const newPaid = inst.paidAmount + alloc.amount;
        const newRem = Math.max(0, inst.amount - newPaid);
        const newStatus: LeaseInstallmentStatus = newRem === 0 ? 'paid' : 'partially_paid';

        const updatedInst: LeaseInstallment = {
          ...inst,
          paidAmount: newPaid,
          remainingAmount: newRem,
          status: newStatus,
          paidAt: newRem === 0 ? nowIso : inst.paidAt,
          receiptNumber: receiptNo,
          payments: [
            ...(inst.payments || []),
            {
              paymentId,
              amount: alloc.amount,
              date: nowIso,
              method: params.method,
              receiptNo,
              notes: params.notes,
            }
          ]
        };

        const updatedInstallments = [...lease.installments];
        updatedInstallments[instIdx] = updatedInst;
        updatedLeases[leaseIdx] = { ...lease, installments: updatedInstallments };
      }
    });

    const newPaymentRecord: PaymentRecord = {
      id: paymentId,
      referenceType: 'lease_installment',
      referenceId: params.allocations[0]?.leaseId || 'multi-alloc',
      amount: params.amount,
      method: params.method,
      status: 'success',
      transactionId: `TXN-${Date.now().toString().slice(-8)}`,
      receiptNumber: receiptNo,
      tenantNationalId: params.tenantNationalId,
      unallocatedAmount: unallocatedCredit,
      allocations: params.allocations.map((a, idx) => ({
        id: `alloc-${Date.now()}-${idx}`,
        paymentId,
        leaseId: a.leaseId,
        targetType: a.targetType,
        targetId: a.installmentId || a.leaseId,
        amount: a.amount,
        createdAt: nowIso,
      })),
      createdAt: nowIso,
      notes: params.notes ? `${params.notes} ${unallocatedCredit > 0 ? `(رصيد دائن حر متبقي بالحساب بقيمة ${unallocatedCredit} ر.س)` : ''}` : undefined,
    };

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'إيصال استلام وتحصيل مالي مخصص',
      entity: 'PaymentRecord',
      entityId: paymentId,
      performedBy: params.performedBy || 'المسؤول المالي والتحصيل',
      role: 'Finance',
      details: `استلام مبلغ ${params.amount} ر.س وسيلة السداد (${params.method}) من المستأجر ${params.tenantName}. تم تخصيص مبالغ قدرها ${totalAllocated} ر.س مع رصيد دائن غير مخصص بقيمة ${unallocatedCredit} ر.س تحت السند #${receiptNo}`,
      timestamp: nowIso,
    };

    globalState = {
      ...globalState,
      leases: updatedLeases,
      payments: [newPaymentRecord, ...globalState.payments],
      auditLogs: [newLog, ...globalState.auditLogs],
    };

    notify();
    return { paymentId, receiptNo, unallocatedCredit };
  }, []);

  /**
   * Create Tenant Adjustment (خصم، إعفاء، تعويض)
   */
  const createTenantAdjustment = useCallback((params: {
    leaseId: string;
    tenantNationalId: string;
    type: 'discount' | 'waiver' | 'compensation' | 'reversal';
    amount: number;
    reason: string;
    authorizedBy: string;
    appliedToInstallmentId?: string;
  }) => {
    if (params.amount <= 0) throw new Error('مبلغ التسوية يجب أن يكون أكبر من الصفر.');
    if (!params.reason.trim()) throw new Error('السبب أو مبرر التسوية الإدارية ضروري للحفظ.');

    const lease = globalState.leases.find(l => l.id === params.leaseId);
    if (!lease) throw new Error('العقد المختار للتعديل والتسوية غير متوفر.');

    const adjId = `adj-${Date.now()}`;
    const nowIso = new Date().toISOString();

    let updatedLeases = globalState.leases;

    // If applied to an installment, reduce remaining amount
    if (params.appliedToInstallmentId) {
      updatedLeases = globalState.leases.map(l => {
        if (l.id === params.leaseId) {
          const updatedInsts = l.installments.map(inst => {
            if (inst.id === params.appliedToInstallmentId) {
              const newRem = Math.max(0, inst.remainingAmount - params.amount);
              return {
                ...inst,
                remainingAmount: newRem,
                status: (newRem === 0 ? 'paid' : inst.status) as LeaseInstallmentStatus,
                notes: `${inst.notes || ''} [تعديل مالي: خصم -${params.amount} ر.س بسبب (${params.reason})]`.trim(),
              };
            }
            return inst;
          });
          return { ...l, installments: updatedInsts };
        }
        return l;
      });
    }

    const newAdjustment: TenantAdjustment = {
      id: adjId,
      leaseId: params.leaseId,
      tenantNationalId: params.tenantNationalId,
      type: params.type,
      amount: params.amount,
      reason: params.reason,
      authorizedBy: params.authorizedBy,
      appliedToInstallmentId: params.appliedToInstallmentId,
      createdAt: nowIso,
    };

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'اعتماد تسوية مالية معفية أو مخفضة',
      entity: 'TenantAdjustment',
      entityId: adjId,
      performedBy: params.authorizedBy,
      role: 'Management',
      details: `تم تطبيق ${params.type} بقيمة ${params.amount} ر.س لصالح العقد الساري رقم ${lease.contractNumber}. المبرر والسبب: ${params.reason}`,
      timestamp: nowIso,
    };

    globalState = {
      ...globalState,
      adjustments: [newAdjustment, ...(globalState.adjustments || [])],
      leases: updatedLeases,
      auditLogs: [newLog, ...globalState.auditLogs],
    };

    notify();
    return newAdjustment;
  }, []);

  /**
   * Settle Security Deposit against Rent Dues or Damages (استقطاع التأمين لتغطية المستحقات)
   * Strictly isolated from routine rent unless formally approved & recorded.
   */
  const settleSecurityDepositAgainstRent = useCallback((params: {
    depositId: string;
    leaseId: string;
    installmentId: string;
    amount: number;
    reason: string;
    authorizedBy: string;
  }) => {
    const deposit = (globalState.securityDeposits || []).find(d => d.id === params.depositId);
    if (!deposit) throw new Error('مبلغ تأمين العقد المستهدف غير متوفر');

    const totalDeducted = (deposit.deductions || []).reduce((sum, d) => sum + d.amount, 0);
    const availableDeposit = deposit.amount - totalDeducted;

    if (params.amount <= 0) throw new Error('مبلغ التسوية يجب أن يكون أكبر من الصفر.');
    if (params.amount > availableDeposit) {
      throw new Error(`مبلغ التسوية المطلوب (${params.amount} ر.س) يتجاوز رصيد التأمين المحتجز المتاح وهو (${availableDeposit} ر.س)!`);
    }

    const lease = globalState.leases.find(l => l.id === params.leaseId);
    if (!lease) throw new Error('عقد الإيجار المحدد غير متوفر');

    const instIndex = lease.installments.findIndex(i => i.id === params.installmentId);
    if (instIndex === -1) throw new Error('الدفعة المالية غير متوفرة');

    const inst = lease.installments[instIndex];
    if (params.amount > inst.remainingAmount) {
      throw new Error(`مبلغ السداد المطلوب من التأمين (${params.amount} ر.س) يتجاوز المستحق على القسط المالي وهو (${inst.remainingAmount} ر.س)!`);
    }

    const nowIso = new Date().toISOString();
    const receiptNo = `DEP-SETTLE-${Date.now().toString().slice(-6)}`;
    const deductionId = `ded-settle-${Date.now()}`;

    // 1. Deduct from Deposit
    const newDeductions = [
      ...(deposit.deductions || []),
      {
        id: deductionId,
        amount: params.amount,
        reason: `تسوية جزء من مبلغ التأمين لسداد قسط العقد #${lease.contractNumber} بسبب (${params.reason})`,
        deductedAt: nowIso,
        approvedBy: params.authorizedBy,
      }
    ];

    const updatedDeposit: SecurityDepositRecord = {
      ...deposit,
      deductions: newDeductions,
      status: (availableDeposit - params.amount === 0) ? 'claimed_for_damage' : deposit.status,
    };

    // 2. Credit the installment
    const newPaid = inst.paidAmount + params.amount;
    const newRemaining = Math.max(0, inst.amount - newPaid);
    const newStatus: LeaseInstallmentStatus = newRemaining === 0 ? 'paid' : 'partially_paid';

    const updatedInstallment: LeaseInstallment = {
      ...inst,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      status: newStatus,
      paidAt: newRemaining === 0 ? nowIso : inst.paidAt,
      receiptNumber: receiptNo,
      payments: [
        ...(inst.payments || []),
        {
          paymentId: deductionId,
          amount: params.amount,
          date: nowIso,
          method: 'bank_transfer',
          receiptNo,
          notes: `سداد من مبلغ تأمين سكن النزيل المحتجز (${params.reason})`,
        }
      ]
    };

    const updatedInstallments = [...lease.installments];
    updatedInstallments[instIndex] = updatedInstallment;

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'تسوية واقتطاع تأمين لمستحقات إيجارية',
      entity: 'SecurityDeposit',
      entityId: deposit.id,
      performedBy: params.authorizedBy,
      role: 'Management',
      details: `تم بنجاح سحب مبلغ قدره ${params.amount} ر.س من تأمين السكن المخصص للنزيل وتوجيهه لسداد قسط الإيجار المالي #${inst.installmentNumber} للعقد رقم ${lease.contractNumber}. مبرر القرار: ${params.reason}`,
      timestamp: nowIso,
    };

    globalState = {
      ...globalState,
      securityDeposits: globalState.securityDeposits.map(d => d.id === deposit.id ? updatedDeposit : d),
      leases: globalState.leases.map(l => l.id === lease.id ? { ...l, installments: updatedInstallments } : l),
      auditLogs: [newLog, ...globalState.auditLogs],
    };

    notify();
    return { updatedDeposit, updatedInstallment };
  }, []);

  // --- Operational Expense Management ---
  const addOperationalExpense = useCallback((payload: Omit<OperationalExpense, 'id' | 'createdAt'>) => {
    if (payload.amount <= 0) throw new Error('قيمة المصروف التشغيلي يجب أن تكون أكبر من الصفر.');
    if (!payload.description.trim()) throw new Error('الرجاء كتابة وصف دقيق وواضح لسبب وبند الصرف.');

    const expId = `exp-${Date.now()}`;
    const nowIso = new Date().toISOString();

    // Auto-calculate distribution shares if applicable
    let distributionShares = payload.distributionShares;

    if (payload.level === 'property' && payload.propertyId && (!distributionShares || distributionShares.length === 0)) {
      const propUnits = globalState.units.filter(u => u.propertyId === payload.propertyId && u.publicationStatus !== 'archived');
      if (propUnits.length > 0) {
        if (payload.distributionType === 'by_area') {
          const totalArea = propUnits.reduce((sum, u) => sum + (u.areaSqm || 50), 0);
          distributionShares = propUnits.map(u => {
            const ratio = (u.areaSqm || 50) / (totalArea || 1);
            return {
              unitId: u.id,
              unitNumber: u.unitNumber,
              amount: Math.round(payload.amount * ratio),
              percentage: Math.round(ratio * 1000) / 10,
            };
          });
        } else if (payload.distributionType === 'equal') {
          const share = Math.round(payload.amount / propUnits.length);
          distributionShares = propUnits.map(u => ({
            unitId: u.id,
            unitNumber: u.unitNumber,
            amount: share,
          }));
        }
      }
    }

    const newExpense: OperationalExpense = {
      ...payload,
      id: expId,
      recordStatus: payload.recordStatus || 'approved',
      distributionShares,
      paymentsList: payload.paymentsList || (payload.paidAmount > 0 ? [
        {
          id: `pay-${expId}-1`,
          paymentDate: payload.date,
          amount: payload.paidAmount,
          paymentMethod: (payload.paymentMethod as any) || 'bank_transfer',
          receiptReference: payload.invoiceDocNumber,
          recordedBy: payload.createdBy || 'المسؤول المالي',
          createdAt: nowIso,
        }
      ] : []),
      createdAt: nowIso,
    };

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'تسجيل قيد مصروف تشغيلي مالي',
      entity: 'OperationalExpense',
      entityId: expId,
      performedBy: payload.createdBy || 'المسؤول المالي',
      role: 'Operations Finance',
      details: `تم حفظ قيد الصرف التشغيلي لفئة ${payload.category} بقيمة ${payload.amount} ر.س. مبرر الصرف: ${payload.description}`,
      timestamp: nowIso,
    };

    globalState = {
      ...globalState,
      expenses: [newExpense, ...(globalState.expenses || [])],
      auditLogs: [newLog, ...globalState.auditLogs],
    };

    notify();

    apiCall('/api/expenses', 'POST', {
      id: expId,
      title: payload.description,
      amount: payload.amount,
      costCenterLevel: payload.level?.toUpperCase() || 'PROPERTY',
      propertyId: payload.propertyId,
      unitId: payload.unitId,
      categoryCode: payload.category || 'OPERATIONS_OTHER',
      startDate: payload.servicePeriodStart || payload.date,
      endDate: payload.servicePeriodEnd || payload.date,
      status: payload.recordStatus || 'approved'
    }).catch(err => console.warn('[Sync Error] Expense creation sync:', err.message));

    return newExpense;
  }, []);

  const updateOperationalExpense = useCallback((expId: string, updates: Partial<OperationalExpense>, modifiedBy = 'المسؤول المالي', reason = 'تعديل بيانات المصروف') => {
    const existing = (globalState.expenses || []).find(e => e.id === expId);
    if (!existing) return;

    const nowIso = new Date().toISOString();
    const newAuditEntry = {
      modifiedAt: nowIso,
      modifiedBy,
      reason,
      previousAmount: existing.amount !== updates.amount ? existing.amount : undefined,
    };

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'تعديل قيد مصروف معتمد',
      entity: 'OperationalExpense',
      entityId: expId,
      performedBy: modifiedBy,
      role: 'Finance Supervisor',
      details: `تعديل المصروف #${existing.expenseNumber}. سبب التعديل: ${reason}`,
      timestamp: nowIso,
    };

    globalState = {
      ...globalState,
      expenses: (globalState.expenses || []).map(e => {
        if (e.id === expId) {
          return {
            ...e,
            ...updates,
            modificationAudit: [...(e.modificationAudit || []), newAuditEntry],
          };
        }
        return e;
      }),
      auditLogs: [newLog, ...globalState.auditLogs],
    };

    notify();

    apiCall(`/api/expenses/${expId}`, 'PUT', {
      title: updates.description,
      amount: updates.amount,
      status: updates.recordStatus
    }).catch(err => console.warn('[Sync Error] Expense update sync:', err.message));
  }, []);

  const addExpensePayment = useCallback((expenseId: string, paymentData: Omit<ExpensePaymentEntry, 'id' | 'createdAt'>) => {
    const exp = (globalState.expenses || []).find(e => e.id === expenseId);
    if (!exp) throw new Error('المصروف المستهدف غير موجود');
    if (paymentData.amount <= 0) throw new Error('مبلغ السداد يجب أن يكون أكبر من الصفر');

    const paymentId = `exp-pay-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newPayment: ExpensePaymentEntry = {
      ...paymentData,
      id: paymentId,
      createdAt: nowIso,
    };

    const updatedPaymentsList = [...(exp.paymentsList || []), newPayment];
    const totalPaid = updatedPaymentsList.reduce((sum, p) => sum + p.amount, 0);
    const newPaymentStatus: 'paid' | 'partial' | 'unpaid' =
      totalPaid >= exp.amount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'سداد دفعة مصروف',
      entity: 'OperationalExpense',
      entityId: expenseId,
      performedBy: paymentData.recordedBy,
      role: 'Cashier / Finance',
      details: `تسجيل سداد دفعة بقيمة ${paymentData.amount} ر.س للمصروف #${exp.expenseNumber} بطريقة (${paymentData.paymentMethod}). إجمالي المسدد: ${totalPaid}/${exp.amount} ر.س`,
      timestamp: nowIso,
    };

    globalState = {
      ...globalState,
      expenses: (globalState.expenses || []).map(e => e.id === expenseId ? {
        ...e,
        paidAmount: totalPaid,
        paymentStatus: newPaymentStatus,
        paymentsList: updatedPaymentsList,
      } : e),
      auditLogs: [newLog, ...globalState.auditLogs],
    };
    notify();
    return newPayment;
  }, []);

  const approveExpense = useCallback((expenseId: string, approvedBy: string) => {
    const exp = (globalState.expenses || []).find(e => e.id === expenseId);
    if (!exp) return;

    const nowIso = new Date().toISOString();
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'اعتماد قيد مصروف',
      entity: 'OperationalExpense',
      entityId: expenseId,
      performedBy: approvedBy,
      role: 'Finance Manager',
      details: `تم اعتماد قيد المصروف #${exp.expenseNumber} بقيمة ${exp.amount} ر.س`,
      timestamp: nowIso,
    };

    globalState = {
      ...globalState,
      expenses: (globalState.expenses || []).map(e => e.id === expenseId ? {
        ...e,
        recordStatus: 'approved' as ExpenseRecordStatus,
      } : e),
      auditLogs: [newLog, ...globalState.auditLogs],
    };
    notify();
  }, []);

  const reverseExpense = useCallback((expenseId: string, reversedBy: string, reason: string) => {
    const exp = (globalState.expenses || []).find(e => e.id === expenseId);
    if (!exp) return;
    if (!reason.trim()) throw new Error('سبب عكس المصروف إلزامي للتدقيق والرقابة المالية');

    const nowIso = new Date().toISOString();
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'عكس وإلغاء قيد مصروف',
      entity: 'OperationalExpense',
      entityId: expenseId,
      performedBy: reversedBy,
      role: 'Finance Supervisor',
      details: `تم عكس قيد المصروف #${exp.expenseNumber} بقيمة ${exp.amount} ر.س. السبب: ${reason}`,
      timestamp: nowIso,
    };

    globalState = {
      ...globalState,
      expenses: (globalState.expenses || []).map(e => e.id === expenseId ? {
        ...e,
        recordStatus: 'reversed' as ExpenseRecordStatus,
        reversalInfo: {
          reversedAt: nowIso,
          reversedBy,
          reason,
        }
      } : e),
      auditLogs: [newLog, ...globalState.auditLogs],
    };
    notify();
  }, []);

  const deleteOperationalExpense = useCallback((expId: string) => {
    globalState = {
      ...globalState,
      expenses: (globalState.expenses || []).filter(e => e.id !== expId),
    };
    notify();

    apiCall(`/api/expenses/${expId}`, 'DELETE').catch(err => {
      console.warn('[Sync Error] Expense deletion sync:', err.message);
    });
  }, []);

  // Expense Categories & Default Rules Management
  const addExpenseCategory = useCallback((categoryData: Omit<ExpenseCategoryConfig, 'id'>) => {
    const newId = `cat-custom-${Date.now()}`;
    const newCategory: ExpenseCategoryConfig = {
      ...categoryData,
      id: newId,
    };

    globalState = {
      ...globalState,
      expenseCategories: [...(globalState.expenseCategories || []), newCategory],
    };
    notify();
    return newCategory;
  }, []);

  const updateExpenseCategory = useCallback((categoryId: string, updates: Partial<ExpenseCategoryConfig>) => {
    globalState = {
      ...globalState,
      expenseCategories: (globalState.expenseCategories || []).map(c => c.id === categoryId ? { ...c, ...updates } : c),
    };
    notify();
  }, []);

  const archiveExpenseCategory = useCallback((categoryId: string) => {
    globalState = {
      ...globalState,
      expenseCategories: (globalState.expenseCategories || []).map(c => c.id === categoryId ? { ...c, isArchived: !c.isArchived } : c),
    };
    notify();
  }, []);

  // Recurring Expenses Management & Accrual Generator
  const addRecurringExpenseSchedule = useCallback((scheduleData: Omit<RecurringExpenseSchedule, 'id' | 'createdAt'>) => {
    const newId = `rec-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newSchedule: RecurringExpenseSchedule = {
      ...scheduleData,
      id: newId,
      createdAt: nowIso,
    };

    globalState = {
      ...globalState,
      recurringExpenses: [...(globalState.recurringExpenses || []), newSchedule],
    };
    notify();
    return newSchedule;
  }, []);

  const updateRecurringExpenseSchedule = useCallback((scheduleId: string, updates: Partial<RecurringExpenseSchedule>) => {
    globalState = {
      ...globalState,
      recurringExpenses: (globalState.recurringExpenses || []).map(s => s.id === scheduleId ? { ...s, ...updates } : s),
    };
    notify();
  }, []);

  const deleteRecurringExpenseSchedule = useCallback((scheduleId: string) => {
    globalState = {
      ...globalState,
      recurringExpenses: (globalState.recurringExpenses || []).filter(s => s.id !== scheduleId),
    };
    notify();
  }, []);

  const generateRecurringExpenseAccruals = useCallback((targetMonth: string, operatorName = 'مشرف التكاليف والمالية') => {
    // targetMonth is in format YYYY-MM
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12
    const daysInMonth = new Date(year, month, 0).getDate();
    const periodStart = `${targetMonth}-01`;
    const periodEnd = `${targetMonth}-${daysInMonth.toString().padStart(2, '0')}`;
    const nowIso = new Date().toISOString();

    const createdExpenses: OperationalExpense[] = [];
    const updatedSchedules = [...(globalState.recurringExpenses || [])];

    updatedSchedules.forEach((sch, idx) => {
      if (!sch.isActive) return;

      // Check date bounds
      if (sch.startDate && sch.startDate > periodEnd) return;
      if (sch.endDate && sch.endDate < periodStart) return;

      // Prevent duplicate generation for same schedule & month
      const duplicateKey = `${sch.id}-${targetMonth}`;
      const alreadyGenerated = (globalState.expenses || []).some(
        e => e.description.includes(`[استحقاق متكرر: ${sch.name} - ${targetMonth}]`) && e.recordStatus !== 'reversed'
      );
      if (alreadyGenerated) return;

      const monthlyAmount = sch.frequency === 'yearly'
        ? Math.round(sch.amount / 12)
        : sch.frequency === 'quarterly'
        ? Math.round(sch.amount / 3)
        : sch.frequency === 'semi_annual'
        ? Math.round(sch.amount / 6)
        : sch.amount;

      const expNumber = `EXP-REC-${Date.now().toString().slice(-4)}-${idx + 1}`;
      const newExp: OperationalExpense = {
        id: `exp-gen-${Date.now()}-${idx}`,
        expenseNumber: expNumber,
        date: periodStart,
        servicePeriodStart: periodStart,
        servicePeriodEnd: periodEnd,
        category: sch.category,
        subcategoryId: sch.subcategoryId,
        description: `${sch.description} [استحقاق متكرر: ${sch.name} - ${targetMonth}]`,
        amount: monthlyAmount,
        paidAmount: 0,
        isFfeOrEquipment: sch.isFfeOrEquipment,
        level: sch.costCenterLevel,
        propertyId: sch.propertyId,
        unitId: sch.unitId,
        vendorOrBeneficiary: sch.vendorOrBeneficiary,
        paymentStatus: 'unpaid',
        paymentMethod: 'bank_transfer',
        distributionType: sch.costAllocationMethod === 'by_area' ? 'by_area' : sch.costAllocationMethod === 'equal_units' ? 'equal' : 'none',
        temporalDistribution: sch.temporalDistribution,
        costAllocationMethod: sch.costAllocationMethod,
        recordStatus: 'approved',
        createdAt: nowIso,
        createdBy: `${operatorName} (مولد الاستحقاقات التلقائي)`,
      };

      createdExpenses.push(newExp);
      updatedSchedules[idx] = { ...sch, lastGeneratedPeriod: targetMonth };
    });

    if (createdExpenses.length > 0) {
      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        action: 'توليد استحقاقات المصاريف المتكررة',
        entity: 'RecurringExpenseSchedule',
        entityId: targetMonth,
        performedBy: operatorName,
        role: 'Automated Finance Engine',
        details: `تم توليد عدد (${createdExpenses.length}) قيد استحقاق دوري لشهر ${targetMonth} بإجمالي تكاليف ${createdExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString('ar-SA')} ر.س دون تكرار.`,
        timestamp: nowIso,
      };

      globalState = {
        ...globalState,
        expenses: [...createdExpenses, ...(globalState.expenses || [])],
        recurringExpenses: updatedSchedules,
        auditLogs: [newLog, ...globalState.auditLogs],
      };
      notify();
    }

    return createdExpenses;
  }, []);

  const resetToFactoryDefaults = useCallback(() => {
    globalState = {
      settings: initialCompanySettings,
      properties: initialProperties,
      floors: initialFloors,
      units: initialUnits,
      amenities: initialAmenities,
      parkingSpots: initialParkingSpots,
      allocations: initialAllocations,
      bookings: initialBookings,
      leases: initialLeases,
      housekeepingTasks: initialHousekeepingTasks,
      maintenanceTasks: initialMaintenanceTasks,
      securityDeposits: initialSecurityDeposits,
      payments: initialPayments,
      contentSections: initialContentSections,
      auditLogs: initialAuditLogs,
      handoverProtocols: [],
      expenses: initialExpenses,
      adjustments: initialAdjustments,
      expenseCategories: initialExpenseCategories,
      recurringExpenses: initialRecurringExpenses,
    };
    notify();
  }, []);

  return {
    state: globalState,
    checkUnitAvailability,
    searchAvailableUnits,
    createBooking,
    addServerBooking,
    addServerLease,
    createMonthlyLease,
    createContractLease,
    recordInstallmentPayment,
    renewLease,
    earlyTerminateLease,
    rescheduleInstallments,
    saveHandoverProtocol,
    checkInBooking,
    checkOutBooking,
    updateUnitOperationalStatus,
    updateHousekeepingTask,
    reportMaintenanceTask,
    resolveMaintenanceTask,
    blockUnitPeriod,
    processDepositDeduction,
    refundSecurityDeposit,
    logSmartLockPinView,
    updateCompanySettings,
    updateContentSections,
    resetToFactoryDefaults,
    // Building & Floor Management
    createProperty,
    updateProperty,
    archiveProperty,
    createFloor,
    updateFloor,
    deleteFloor,
    // Unit Management & Cloner
    createUnit,
    batchCreateUnits,
    cloneUnit,
    updateUnit,
    archiveUnit,
    // Spaces & Fittings
    addUnitSpace,
    updateUnitSpace,
    deleteUnitSpace,
    addSpaceFitting,
    updateSpaceFitting,
    deleteSpaceFitting,
    // Parking
    createParkingSpot,
    updateParkingSpot,
    assignParkingToUnit,
    unassignParking,
    deleteParkingSpot,
    // Financial Operations & Expenses
    recordPaymentAndAllocate,
    createTenantAdjustment,
    settleSecurityDepositAgainstRent,
    addOperationalExpense,
    updateOperationalExpense,
    deleteOperationalExpense,
    addExpensePayment,
    approveExpense,
    reverseExpense,
    addExpenseCategory,
    updateExpenseCategory,
    archiveExpenseCategory,
    addRecurringExpenseSchedule,
    updateRecurringExpenseSchedule,
    deleteRecurringExpenseSchedule,
    generateRecurringExpenseAccruals,
  };
}
