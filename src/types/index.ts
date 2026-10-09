export type RentalType = 'daily' | 'monthly' | 'yearly';

export type OperationalStatus =
  | 'ready'              // جاهزة
  | 'needs_cleaning'    // بحاجة لتنظيف
  | 'in_cleaning'       // جاري التنظيف
  | 'in_maintenance'    // في الصيانة
  | 'blocked';          // محجوبة

export type OccupancyStatus =
  | 'vacant'            // شاغرة
  | 'daily_occupied'    // مسكونة يومي
  | 'monthly_occupied'  // مسكونة شهري
  | 'occupied_yearly';  // مسكونة سنوي

export type ReservationStatus =
  | 'hold'              // تعليق مؤقت
  | 'confirmed'         // مؤكدة
  | 'checked_in'        // تم الدخول
  | 'completed'         // مكتملة
  | 'cancelled'         // ملغاة
  | 'no_show'           // عدم حضور
  | 'expired';          // منتهية الصلاحية

export type AllocationType = 'booking' | 'lease' | 'hold' | 'maintenance' | 'block';

export interface UnitAllocation {
  id: string;
  unitId: string;
  type: AllocationType;
  referenceId: string; // ID الحجز أو العقد أو المنع
  startDate: string; // ISO string YYYY-MM-DDTHH:mm:ss
  endDate: string;   // ISO string YYYY-MM-DDTHH:mm:ss
  prepBufferHours: number; // ساعات التحضير
  status: 'active' | 'released' | 'expired' | 'cancelled' | 'terminated';
  createdAt: string;
  notes?: string;
}

export interface Amenity {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  category: 'general' | 'comfort' | 'kitchen' | 'technology' | 'wellness';
}

export interface MediaAsset {
  id: string;
  url: string;
  title: string;
  description?: string;
  altText?: string;
  type: 'image' | 'video';
  category: 'facade' | 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'balcony' | 'view' | 'amenity' | 'general';
  isCover?: boolean;
}

export interface SpaceFitting {
  id: string;
  name: string;
  category: 'bed' | 'furniture' | 'appliance' | 'electronics' | 'sanitary' | 'linen' | 'other';
  quantity: number;
  specifications?: string;
  brandModelSerial?: string;
  condition?: 'excellent' | 'good' | 'fair' | 'needs_repair';
}

export type UnitSpaceType =
  | 'bedroom'
  | 'living_room'
  | 'kitchen'
  | 'bathroom'
  | 'dining_room'
  | 'balcony'
  | 'laundry_room'
  | 'storage'
  | 'custom';

export interface UnitSpace {
  id: string;
  name: string;
  type: UnitSpaceType;
  areaSqm?: number;
  description?: string;
  media?: MediaAsset[];
  fittings: SpaceFitting[];
  bedsCount?: number;
  bedType?: string;
  details?: string;
}

export type ParkingLocation = 'basement' | 'ground' | 'outdoor' | 'custom';
export type ParkingType = 'covered' | 'open' | 'accessible' | 'ev_charging';
export type ParkingStatus = 'available' | 'assigned' | 'maintenance' | 'vacant';
export type ParkingUsage = 'shared_building' | 'dedicated_unit';

export interface ParkingSpot {
  id: string;
  propertyId: string;
  spotNumber: string;
  location: ParkingLocation;
  locationLabel?: string;
  type: ParkingType;
  status: ParkingStatus;
  usageType: ParkingUsage;
  assignedUnitId?: string; // ID الشقة المخصصة لها
  instructions?: string;
  photoUrl?: string;
  createdAt: string;
}

export interface SharedFacility {
  id: string;
  name: string;
  type: 'reception' | 'pool' | 'gym' | 'laundry' | 'lounge' | 'prayer_room' | 'business_center' | 'garden' | 'other';
  description?: string;
  openingHours?: string;
  floor?: string;
}

export type AnnualPaymentOption = 'single_annual' | 'semi_annual';
export type ServiceResponsibleParty = 'company' | 'tenant' | 'shared_split';
export type ServiceBillingMethod =
  | 'included_no_fee'
  | 'fixed_fee'
  | 'actual_consumption'
  | 'direct_tenant_to_provider'
  | 'capped_included';
export type ServiceBillingCycle = 'once' | 'monthly' | 'with_installments' | 'per_invoice';

export interface ContractServiceItem {
  id: string;
  serviceKey: 'electricity' | 'water' | 'internet' | 'maintenance' | 'cleaning' | 'parking' | 'custom';
  name: string;
  isAvailable: boolean;
  isIncludedInRent: boolean;
  responsibleParty: ServiceResponsibleParty;
  billingMethod: ServiceBillingMethod;
  billingCycle: ServiceBillingCycle;
  fixedAmount?: number;
  capAmount?: number; // السقف الشامل
  overageUnitRate?: number;
  providerPayer: 'company' | 'tenant';
  descriptionRule: string;
  meterInfo?: {
    hasDedicatedMeter: boolean;
    meterNumber?: string;
    startReading?: number;
    endReading?: number;
    readingDate?: string;
    readingPhotoUrl?: string;
    splitRule?: string;
  };
  internetInfo?: {
    packageSpeed?: string;
    providerName?: string;
    isDedicatedLine?: boolean;
    wifiName?: string;
    wifiPasswordSafe?: string;
  };
  maintenanceScope?: {
    routineCoveredBy: 'company' | 'tenant';
    normalWearCoveredBy: 'company' | 'tenant';
    misuseCoveredBy: 'tenant';
    emergencyCoveredBy: 'company';
  };
}

export type ContractInclusionType = 'all_inclusive' | 'not_inclusive' | 'partially_inclusive';

export interface Unit {
  id: string;
  propertyId: string;
  floorId: string;
  unitNumber: string;
  title: string;
  titleEn: string;
  type: 'apartment' | 'studio' | 'suite' | 'duplex';
  areaSqm: number;
  floorNumber: number;
  maxGuests: number;
  bedroomsCount: number;
  bathroomsCount: number;
  bedsCount: number;
  spaces: UnitSpace[];
  amenities: string[]; // مصفوفة معرفات الخدمات
  media: MediaAsset[];
  floorPlanUrl?: string;
  furnishingStatus: 'furnished' | 'partially_furnished' | 'unfurnished';
  // الحجز اليومي
  allowDaily: boolean;
  dailyRate: number;
  dailySecurityDeposit: number;
  // الإيجار الشهري
  allowMonthly: boolean;
  monthlyRate: number;
  monthlySecurityDeposit: number;
  // الإيجار السنوي
  allowYearly: boolean;
  yearlyRate: number;
  yearlySecurityDeposit: number;
  yearlyPaymentOptions: AnnualPaymentOption[]; // خيارات الدفع السنوي
  semiAnnualSurchargePercent?: number; // رسوم إضافية لدفعتين
  // التنظيف والضرائب
  cleaningFee: number;
  securityDeposit: number; // افتراضي كبديل
  taxPercentage: number; // الضريبة المضافة (مثلا 15٪)
  // مرافق مخصصة
  assignedParkingId?: string;
  publicationStatus?: 'draft' | 'published' | 'archived';
  isClean?: boolean;
  smartLockPin?: string;
  isCloned?: boolean;
  clonedFromUnitId?: string;
  // الخدمات الافتراضية للشقة
  defaultServices?: ContractServiceItem[];
  // حالة التشغيل الحالية
  operationalStatus: OperationalStatus;
  occupancyStatus: OccupancyStatus;
  currentBookingId?: string;
  currentLeaseId?: string;
  todayArrival?: boolean; // وصول اليوم
  todayDeparture?: boolean; // مغادرة اليوم
  notes?: string;
}

export interface Floor {
  id: string;
  propertyId: string;
  floorNumber: number;
  name: string;
  label?: string; // مثلا "الدور الأرضي"، "القبو"
}

export interface City {
  id: string;
  name: string;
  nameEn?: string;
  region?: string;
  country: string;
  status: 'active' | 'inactive';
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Property {
  id: string;
  identifierCode: string; // كود مميز مثلا "BLD-NKH-01"
  name: string;
  nameEn: string;
  slug: string;
  tagline: string;
  description: string;
  address: string;
  city: string;
  cityId?: string;
  district: string;
  latitude: number;
  longitude: number;
  media: MediaAsset[];
  videoTourUrl?: string;
  amenities: string[];
  totalFloors: number;
  checkInTime: string;  // مثلا "15:00"
  checkOutTime: string; // مثلا "12:00"
  featured: boolean;
  status: 'draft' | 'published' | 'unlisted';
  entrancesCount?: number;
  elevatorsCount?: number;
  stairsCount?: number;
  sharedFacilities: SharedFacility[];
  defaultBuildingServices?: ContractServiceItem[];
}

export interface GuestInfo {
  fullName: string;
  email: string;
  phone: string;
  nationalIdOrPassport: string;
  idVerified: boolean;
  notes?: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  unitId: string;
  propertyId: string;
  guest: GuestInfo;
  checkIn: string;   // YYYY-MM-DD
  checkOut: string;  // YYYY-MM-DD
  totalNights: number;
  guestsCount: number;
  status: ReservationStatus;
  rentalType: 'daily';
  // تفاصيل مالية
  nightlyRate: number;
  subtotal: number;
  cleaningFee: number;
  taxes: number;
  securityDeposit: number;
  totalAmount: number;
  // القفل الذكي
  smartLockPin?: string;
  smartLockPinValidFrom?: string;
  smartLockPinValidTo?: string;
  pinAccessedAt?: string;
  pinAccessedBy?: string;
  createdAt: string;
  allocationId: string;
}

export type LeaseInstallmentStatus = 'not_due_yet' | 'due' | 'partially_paid' | 'paid' | 'overdue';

export interface InstallmentPaymentRecord {
  paymentId: string;
  amount: number;
  date: string;
  method: 'mada' | 'visa_mastercard' | 'apple_pay' | 'bank_transfer' | 'cash';
  receiptNo: string;
  notes?: string;
}

export interface LeaseInstallment {
  id: string;
  leaseId: string;
  installmentNumber: number;
  label?: string; // مثلا "الدفعة الأولى"
  dueDate: string; // YYYY-MM-DD
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: LeaseInstallmentStatus;
  paidAt?: string;
  receiptNumber?: string;
  transactionRef?: string;
  payments: InstallmentPaymentRecord[];
  notes?: string;
}

export interface InventoryHandoverItem {
  id: string;
  spaceName: string;
  itemName: string;
  category: string;
  quantity: number;
  brandModelSerial?: string;
  conditionAtDelivery: 'excellent' | 'good' | 'fair' | 'damaged';
  conditionAtReturn?: 'excellent' | 'good' | 'fair' | 'damaged' | 'missing';
  photos: string[];
  notes?: string;
  isIncludedInBaseContract: boolean;
  extraCharge?: number;
}

export interface HandoverProtocol {
  id: string;
  leaseId: string;
  unitId: string;
  protocolType: 'delivery' | 'return';
  date: string;
  deliveredBy: string;
  receivedBy: string;
  keysHandedCount: number;
  accessCardsCount: number;
  remotesCount: number;
  meterReadings: {
    meterType: string;
    meterNumber: string;
    reading: number;
    photoUrl?: string;
  }[];
  items: InventoryHandoverItem[];
  notedDamages?: string;
  tenantSignatureConfirmed: boolean;
  supervisorSignatureConfirmed: boolean;
  createdAt: string;
}

export interface LeaseAmendment {
  id: string;
  leaseId: string;
  title: string;
  effectiveDate: string;
  reason: string;
  details: string;
  approvedBy: string;
  createdAt: string;
}

export interface Lease {
  id: string;
  contractNumber: string;
  unitId: string;
  propertyId: string;
  tenant: GuestInfo;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  monthsCount: number; // عدد الأشهر (مثلا 12 للسنوي)
  rentalType: 'monthly' | 'yearly';
  type?: 'monthly' | 'yearly';
  yearlyPaymentOption?: AnnualPaymentOption; // دفعة واحدة أو دفعتين
  status: 'draft' | 'active' | 'expired' | 'terminated';
  // أسعار وتفاصيل مالية
  monthlyRent: number;
  yearlyRent?: number;
  securityDeposit: number;
  totalContractValue: number;
  // جدول الدفعات
  installments: LeaseInstallment[];
  allocationId: string;
  // خدمات العقد ونطاق التغطية
  inclusionType: ContractInclusionType;
  services: ContractServiceItem[];
  // محاضر التسليم والاستلام
  handoverProtocolId?: string;
  returnProtocolId?: string;
  // لقطة غير قابلة للتغيير للشروط عند الموافقة والاعتماد
  termsSnapshot: {
    frozenAt: string;
    approvedBy: string;
    latePolicy: string;
    renewalPolicy: string;
    earlyTerminationPolicy: string;
    agreedRent: number;
    agreedDeposit: number;
  };
  // التعديلات والملحقات الطارئة على العقد
  amendments: LeaseAmendment[];
  // تفاصيل إنهاء العقد المبكر
  earlyTermination?: {
    terminatedAt: string;
    effectiveDate: string;
    reason: string;
    financialSettlementAmount: number;
    processedBy: string;
    depositRefunded: number;
    notes?: string;
  };
  // الإسناد لعقد سابق عند التجديد
  renewedFromLeaseId?: string;
  renewedToLeaseId?: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'building_rent'               // إيجار المباني
  | 'admin_salaries'              // الرواتب الإدارية
  | 'building_staff_salaries'     // رواتب موظفي المباني والحراس
  | 'marketing_advertising'       // الدعاية والتسويق
  | 'electricity'                 // الكهرباء
  | 'water'                       // المياه
  | 'internet'                    // الإنترنت
  | 'cleaning_supplies'           // النظافة والمستلزمات
  | 'building_common_maintenance' // صيانة المباني والمرافق المشتركة
  | 'unit_appliances_maintenance' // صيانة أجهزة الوحدات
  | 'government_fees_licenses'    // الرسوم الحكومية والرخص
  | 'payment_fees_commissions'    // رسوم الدفع والعمولات
  | 'furniture_appliances'        // شراء الأثاث والأجهزة (رأسمالي FF&E)
  | 'maintenance'                 // صيانة عامة (توافقية)
  | 'cleaning'                    // نظافة (توافقية)
  | 'utilities'                   // خدمات وفواتير (توافقية)
  | 'commissions_fees'            // عمولات ورسوم (توافقية)
  | 'operations_other';           // مصاريف تشغيل أخرى

export type CostCenterLevel = 'company' | 'property' | 'unit';

export type TemporalDistributionType =
  | 'instant'                     // تحميل كامل المصروف على تاريخ محدد
  | 'equal_monthly'               // التوزيع بالتساوي على الأشهر المشمولة
  | 'actual_days'                 // التوزيع بحسب الأيام الفعلية لفترة التغطية
  | 'custom_schedule';            // جدول زمني مخصص مع تحقق مجموع المبالغ

export type CostAllocationMethod =
  | 'direct_unit'                 // تحميل مباشر على وحدة
  | 'equal_units'                 // بالتساوي على الوحدات المستفيدة
  | 'by_area'                     // بنسبة مساحة الوحدات (م²)
  | 'by_revenue'                  // بنسبة الدخل الفعلي للوحدات في الفترة
  | 'by_occupancy_days'           // بنسبة عدد أيام الإشغال للوحدات
  | 'custom_units';               // توزيع مخصص بنسب أو مبالغ محددة

export type ExpenseDistributionType =
  | 'none'                  // بدون توزيع (مباشر)
  | 'equal'                 // توزيع بالتساوي بين الوحدات
  | 'by_area'               // توزيع بناءً على مساحة الوحدات
  | 'by_occupied_nights'    // توزيع بنسبة الليالي المسكونة
  | 'custom';               // توزيع مخصص يدوياً

export type ExpenseRecordStatus = 'draft' | 'approved' | 'reversed';

export interface ExpenseSubcategory {
  id: string;
  nameAr: string;
  nameEn: string;
  isArchived?: boolean;
}

export interface ExpenseCategoryConfig {
  id: string;
  code: ExpenseCategory;
  nameAr: string;
  nameEn: string;
  defaultCostCenterLevel: CostCenterLevel;
  defaultTemporalDistribution: TemporalDistributionType;
  defaultAllocationMethod: CostAllocationMethod;
  isCapitalFfe: boolean;
  isArchived: boolean;
  subcategories: ExpenseSubcategory[];
}

export interface ExpensePaymentEntry {
  id: string;
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: 'bank_transfer' | 'company_card' | 'cash' | 'check';
  receiptReference?: string;
  receiptDocUrl?: string;
  recordedBy: string;
  notes?: string;
  createdAt: string;
}

export interface CustomTemporalScheduleEntry {
  id: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  amount: number;
}

export interface CustomUnitShare {
  unitId: string;
  unitNumber: string;
  amount?: number;
  percentage?: number;
}

export interface SharedExpenseShare {
  unitId: string;
  unitNumber: string;
  amount: number;
  percentage?: number;
}

export interface RecurringExpenseSchedule {
  id: string;
  name: string;
  category: ExpenseCategory;
  subcategoryId?: string;
  description: string;
  amount: number;
  isFfeOrEquipment: boolean;
  costCenterLevel: CostCenterLevel;
  propertyId?: string;
  unitId?: string;
  vendorOrBeneficiary: string;
  frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'yearly';
  startDate: string;
  endDate?: string;
  temporalDistribution: TemporalDistributionType;
  costAllocationMethod: CostAllocationMethod;
  isActive: boolean;
  lastGeneratedPeriod?: string; // YYYY-MM
  createdAt: string;
}

export interface OperationalExpense {
  id: string;
  expenseNumber: string;
  date: string; // YYYY-MM-DD (تاريخ تسجيل القيد / الاستحقاق)
  servicePeriodStart?: string; // بداية فترة التغطية
  servicePeriodEnd?: string;   // نهاية فترة التغطية
  category: ExpenseCategory;
  subcategoryId?: string;
  subcategoryName?: string;
  description: string;
  amount: number;
  paidAmount: number;
  isFfeOrEquipment: boolean; // هل يعتبر شراء أثاث/أجهزة رأسمالي (FF&E)
  level: CostCenterLevel;
  propertyId?: string;
  unitId?: string;
  vendorOrBeneficiary: string;
  invoiceDocNumber?: string;
  invoiceDocUrl?: string;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  paymentMethod?: 'bank_transfer' | 'cash' | 'company_card' | 'check';
  distributionType: ExpenseDistributionType; // للتوافق
  distributionShares?: SharedExpenseShare[];
  // حقول ملحق تطوير إدارة التكاليف والتوزيع
  temporalDistribution?: TemporalDistributionType;
  customScheduleEntries?: CustomTemporalScheduleEntry[];
  costAllocationMethod?: CostAllocationMethod;
  includedUnitIds?: string[]; // وحدات مشمولة بالتوزيع
  excludedUnitIds?: string[]; // وحدات مستثناة من التوزيع
  customUnitShares?: CustomUnitShare[];
  recordStatus?: ExpenseRecordStatus;
  reversalInfo?: {
    reversedAt: string;
    reversedBy: string;
    reason: string;
  };
  modificationAudit?: {
    modifiedAt: string;
    modifiedBy: string;
    reason: string;
    previousAmount?: number;
  }[];
  paymentsList?: ExpensePaymentEntry[];
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface TenantAdjustment {
  id: string;
  tenantNationalId: string;
  leaseId: string;
  type: 'discount' | 'waiver' | 'compensation' | 'reversal';
  amount: number;
  reason: string;
  authorizedBy: string;
  appliedToInstallmentId?: string;
  createdAt: string;
}

export interface PaymentAllocationItem {
  id: string;
  paymentId: string;
  leaseId: string;
  targetType: 'installment' | 'service_fee' | 'damage_claim' | 'unallocated_credit';
  targetId: string;
  amount: number;
  createdAt: string;
}

export interface TenantLedgerEntry {
  id: string;
  date: string;
  dueDate?: string;
  type: 'due_rent' | 'due_service' | 'payment_received' | 'adjustment' | 'refund' | 'deposit_hold';
  referenceNumber: string;
  contractNumber: string;
  unitNumber: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  status?: string;
}

export interface PaymentRecord {
  id: string;
  referenceType: 'booking' | 'lease_installment' | 'deposit';
  referenceId: string;
  installmentId?: string;
  amount: number;
  method: 'mada' | 'visa_mastercard' | 'apple_pay' | 'bank_transfer' | 'cash' | 'security_deposit';
  sourceType?: 'direct_payment' | 'deposit_application' | 'reversal';
  affectsCash?: boolean;
  status: 'success' | 'pending' | 'failed';
  transactionId: string;
  receiptNumber?: string;
  tenantNationalId?: string;
  unallocatedAmount?: number; // رصيد الدائن المتبقي
  allocations?: PaymentAllocationItem[];
  createdAt: string;
  notes?: string;
}

export interface SecurityDepositRecord {
  id: string;
  bookingOrLeaseId: string;
  unitId: string;
  guestName: string;
  amount: number;
  collectedAmount?: number;
  collectionReference?: string | null;
  collectionVerifiedAt?: string | null;
  heldType?: 'authorized_hold' | 'collected_cash_card';
  status: 'held' | 'pending_refund' | 'partially_refunded' | 'fully_refunded' | 'claimed_for_damage' | 'deducted';
  refundedAmount?: number;
  deductedAmount?: number;
  rentAppliedAmount?: number;
  deductions: {
    id: string;
    amount: number;
    reason: string;
    proofMediaUrl?: string;
    deductedAt: string;
    approvedBy: string;
  }[];
  refundAmount: number;
  refundedAt?: string;
  createdAt: string;
}

export interface SecurityDepositTransaction {
  id: string;
  depositId: string;
  type: 'refund' | 'deduction' | 'preauth_release' | 'rent_application';
  amount: number;
  method: string;
  reference: string;
  reason?: string;
  targetLeaseId?: string;
  targetInstallmentId?: string;
  executedByUserId?: string;
  status: 'completed' | 'pending_provider';
  idempotencyKey?: string;
  createdAt: string;
}

export interface HousekeepingTask {
  id: string;
  taskNumber: string;
  unitId: string;
  propertyId: string;
  type: 'turnover' | 'deep_clean' | 'routine_daily' | 'inspection';
  priority: 'urgent' | 'high' | 'normal';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'verified';
  assignedToStaffId?: string;
  assignedToStaffName?: string;
  checklist: {
    id: string;
    text: string;
    done: boolean;
  }[];
  notes?: string;
  completionPhotos: string[];
  reportedIssue?: string;
  startedAt?: string;
  completedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
}

export interface MaintenanceTask {
  id: string;
  taskNumber: string;
  unitId: string;
  propertyId: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'smart_lock' | 'other';
  severity: 'critical' | 'moderate' | 'low';
  title: string;
  description: string;
  status: 'reported' | 'assigned' | 'in_progress' | 'resolved' | 'verified';
  assignedToStaffName?: string;
  photos: string[];
  createdAt: string;
  resolvedAt?: string;
}

export interface NavItemConfig {
  id: string;
  label: string;
  labelEn?: string;
  targetSectionId: string;
  visible: boolean;
  order: number;
  icon?: string;
}

export interface BottomNavItemConfig {
  id: string;
  label: string;
  type: 'section' | 'units_page' | 'my_bookings' | 'account' | 'more';
  targetSectionId?: string;
  icon: string;
  visible: boolean;
  order: number;
}

export interface NavigationSettings {
  navLinks: NavItemConfig[];
  bottomNavItems: BottomNavItemConfig[];
  enableBottomNav: boolean;
  headerHeightPx: number;
  logoMaxHeightPx: number;
  stickyHeader: boolean;
  navActiveColor: string;
  headerNavTextColor?: string;
  headerNavHoverColor?: string;
  headerNavActiveTextColor?: string;
  footerNavTextColor?: string;
  footerNavHoverColor?: string;
}

export type UserRole =
  | 'SUPER_ADMIN'
  | 'PROPERTY_MANAGER'
  | 'RECEPTIONIST'
  | 'HOUSEKEEPING'
  | 'MAINTENANCE'
  | 'ACCOUNTANT'
  | 'TENANT';

export interface AppUser {
  id: string;
  username: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  allowedProperties: string[];
  isActive: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type TextAlignment = 'right' | 'center' | 'left';
export type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';

export interface TextStyleConfig {
  color?: string;
  fontSizeRem?: number; // min: 0.75, max: 4.5
  fontWeight?: FontWeight;
  alignment?: TextAlignment;
}

export interface SectionTextElementConfig {
  id: string;
  label: string;
  text: string;
  style: TextStyleConfig;
  defaultText: string;
  defaultStyle: TextStyleConfig;
}

export interface CustomizableTypographyConfig {
  [sectionKey: string]: {
    [elementKey: string]: SectionTextElementConfig;
  };
}

export interface FooterPageItem {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  lastUpdated: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  active: boolean;
}

export interface HeroCarouselSlide {
  id: string;
  badge: string;
  location: string;
  title: string;
  description: string;
  imageUrl: string;
  primaryLabel: string;
  secondaryLabel: string;
  accentColor: string;
  overlayOpacity: number;
  visible: boolean;
}

export interface HeroCarouselConfig {
  autoplayMs: number;
  slides: HeroCarouselSlide[];
}

export interface OfferCarouselSlide {
  id: string;
  label: string;
  imageUrl: string;
  visible: boolean;
}

export interface OfferCarouselConfig {
  badge: string;
  title: string;
  description: string;
  buttonLabel: string;
  autoplayMs: number;
  slides: OfferCarouselSlide[];
}

export interface MapLocation {
  id: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  propertyId?: string;
  visible: boolean;
}

export interface MapSectionSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  zoom: number;
  locations: MapLocation[];
}

export interface CompanySettings {
  companyName: string;
  companyNameEn: string;
  tagline: string;
  logoUrl: string;
  iconUrl?: string;
  phone: string;
  whatsapp: string;
  email: string;
  taxNumber: string;
  commercialReg: string;
  address: string;
  currency: string;
  currencySymbol: string;
  currencyDisplayMode?: 'code' | 'symbol'; // 'symbol' for official SVG symbol, 'code' for SAR text
  timezone: string;
  footerPages?: Record<string, FooterPageItem>;
  faqs?: FaqItem[];
  themeConfig?: Record<string, unknown> & { heroCarousel?: HeroCarouselConfig; offersCarousel?: OfferCarouselConfig; mapSection?: MapSectionSettings };
  // إعدادات النصوص والتنسيق البصري المتقدم
  typography?: CustomizableTypographyConfig;
  // اعدادات التنقل الهيدر والشريط السفلي
  navigation?: NavigationSettings;
  // المظهر والتخصيص
  theme: {
    primaryColor: string;
    headerBg?: string;
    footerBg?: string;
    primaryBtnBg?: string;
    pageBg?: string;
    ivoryBg: string;
    ivorySurface: string;
    textColor: string;
    textMuted: string;
    borderColor: string;
    glassBlurIntensity: number;
    borderRadius: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    enableAnimations: boolean;
  };
  // قواعد وقوانين العمل
  defaultPrepBufferHours: number; // الساعات بين الحجوزات لتجهيز الشقة
  holdTimeoutMinutes: number;     // صلاحية الحجز المؤقت
  minDailyNights: number;
  maxDailyNights: number;
  installmentDueReminderDaysBefore: number; // الأيام المتبقية للتنبيه بالدفعة قبل الاستحقاق
}

export interface ContentSection {
  id: string;
  sectionKey: 'hero' | 'search_bar' | 'buildings' | 'featured_units' | 'offers' | 'amenities' | 'steps' | 'gallery' | 'faq' | 'contact';
  name: string;
  title: string;
  subtitle: string;
  visible: boolean;
  order: number;
  mediaUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  customData?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  performedBy: string;
  role: string;
  details: string;
  timestamp: string;
}
