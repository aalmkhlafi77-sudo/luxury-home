import {
  AnnualPaymentOption,
  ContractServiceItem,
  LeaseInstallment,
  LeaseInstallmentStatus,
  ContractInclusionType
} from '../types';

/**
 * Add calendar months to a date, correctly preserving end-of-month and leap years.
 */
export function addCalendarMonths(startDate: Date, monthsToAdd: number): Date {
  const result = new Date(startDate.getTime());
  const expectedMonth = result.getMonth() + monthsToAdd;
  result.setMonth(expectedMonth);
  // If month overflowed (e.g. Jan 31 + 1 month became March 2 or 3), clamp to last day of previous month
  if (result.getMonth() !== ((expectedMonth % 12) + 12) % 12) {
    result.setDate(0);
  }
  return result;
}

/**
 * Calculate lease end date for N calendar months.
 * Standard lease: starting 2026-10-01 for 12 months ends on 2027-09-30.
 */
export function calculateLeaseEndDate(startDateStr: string, monthsCount: number): string {
  const start = new Date(startDateStr);
  const target = addCalendarMonths(start, monthsCount);
  // Subtract 1 day so an annual lease starting Oct 1st ends Sept 30th
  target.setDate(target.getDate() - 1);
  return target.toISOString().slice(0, 10);
}

/**
 * Generate installment schedule for a lease.
 * Guarantees that the sum of all installments equals totalContractValue with zero rounding error.
 */
export function generateInstallmentSchedule(params: {
  leaseId: string;
  rentalType: 'monthly' | 'yearly';
  yearlyPaymentOption?: AnnualPaymentOption;
  startDate: string;
  totalContractValue: number;
  monthsCount: number;
}): LeaseInstallment[] {
  const { leaseId, rentalType, yearlyPaymentOption, startDate, totalContractValue, monthsCount } = params;
  const start = new Date(startDate);
  const installments: LeaseInstallment[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);

  if (rentalType === 'yearly') {
    if (yearlyPaymentOption === 'semi_annual') {
      // 2 Installments: First at start date, Second after 6 calendar months
      const firstAmount = Math.floor(totalContractValue / 2);
      const secondAmount = totalContractValue - firstAmount; // Guaranteed exact sum
      const firstDueDate = startDate;
      const secondDateObj = addCalendarMonths(start, 6);
      const secondDueDate = secondDateObj.toISOString().slice(0, 10);

      installments.push({
        id: `inst-${leaseId}-1`,
        leaseId,
        installmentNumber: 1,
        label: 'الدفعة الأولى - النصف الأول',
        dueDate: firstDueDate,
        amount: firstAmount,
        paidAmount: 0,
        remainingAmount: firstAmount,
        status: 'not_due_yet',
        payments: [],
        notes: 'الدفعة الأولى المستحقة عند تفعيل عقد التأجير السنوي.'
      });
      installments.push({
        id: `inst-${leaseId}-2`,
        leaseId,
        installmentNumber: 2,
        label: 'الدفعة الثانية - النصف الثاني',
        dueDate: secondDueDate,
        amount: secondAmount,
        paidAmount: 0,
        remainingAmount: secondAmount,
        status: 'not_due_yet',
        payments: [],
        notes: 'الدفعة الثانية المستحقة بعد مرور ٦ أشهر من العقد.'
      });
    } else {
      // Single annual payment
      installments.push({
        id: `inst-${leaseId}-1`,
        leaseId,
        installmentNumber: 1,
        label: 'الدفعة السنوية الكاملة (١٠٠٪)',
        dueDate: startDate,
        amount: totalContractValue,
        paidAmount: 0,
        remainingAmount: totalContractValue,
        status: 'not_due_yet',
        payments: [],
        notes: 'قيمة العقد السنوية كاملة تسدد في دفعة واحدة.'
      });
    }
  } else {
    // Monthly lease: installment per month
    const monthlyAmt = Math.floor(totalContractValue / monthsCount);
    for (let i = 0; i < monthsCount; i++) {
      const d = addCalendarMonths(start, i);
      const dueDate = d.toISOString().slice(0, 10);
      const isLast = i === monthsCount - 1;
      const amount = isLast ? (totalContractValue - monthlyAmt * (monthsCount - 1)) : monthlyAmt;

      installments.push({
        id: `inst-${leaseId}-${i + 1}`,
        leaseId,
        installmentNumber: i + 1,
        label: `الدفعة رقم ${i + 1} (${d.toLocaleDateString('ar-SA', { month: 'long' })})`,
        dueDate,
        amount,
        paidAmount: 0,
        remainingAmount: amount,
        status: 'not_due_yet',
        payments: [],
        notes: `قسط الإيجار للشهر رقم ${i + 1} من العقد المكون من ${monthsCount} أشهر.`
      });
    }
  }

  // Update status based on current date
  return installments.map(inst => refreshInstallmentStatus(inst, todayStr));
}

/**
 * Dynamically evaluate status of an installment according to amounts and today's date
 */
export function refreshInstallmentStatus(inst: LeaseInstallment, todayStr: string): LeaseInstallment {
  const remaining = Math.max(0, inst.amount - inst.paidAmount);
  let status: LeaseInstallmentStatus = 'not_due_yet';

  if (remaining <= 0) {
    status = 'paid';
  } else if (inst.paidAmount > 0) {
    status = 'partially_paid';
  } else if (todayStr > inst.dueDate) {
    status = 'overdue';
  } else if (todayStr === inst.dueDate) {
    status = 'due';
  } else {
    status = 'not_due_yet';
  }

  return {
    ...inst,
    remainingAmount: remaining,
    status
  };
}

/**
 * Standard default services and responsibilities template for luxury serviced residences
 */
export function getDefaultContractServices(): ContractServiceItem[] {
  return [
    {
      id: 'srv-elec',
      serviceKey: 'electricity',
      name: 'فاتورة العداد الكهربائي المخصص',
      isAvailable: true,
      isIncludedInRent: true,
      responsibleParty: 'company',
      billingMethod: 'capped_included',
      billingCycle: 'monthly',
      capAmount: 400, // سقف شامل ٤٠٠ ريال
      overageUnitRate: 0.32,
      providerPayer: 'company',
      descriptionRule: 'الشركة تتحمل تكلفة الكهرباء حتى ٤٠٠ ريال شهرياً وتتم محاسبة المقيم على المتبقي.',
      meterInfo: {
        hasDedicatedMeter: true,
        meterNumber: 'SEC-8829104',
        startReading: 12450,
      }
    },
    {
      id: 'srv-water',
      serviceKey: 'water',
      name: 'مياه الصنبور والصرف الفندقي',
      isAvailable: true,
      isIncludedInRent: true,
      responsibleParty: 'company',
      billingMethod: 'included_no_fee',
      billingCycle: 'monthly',
      providerPayer: 'company',
      descriptionRule: 'تكاليف المياه والصرف الصحي مشمولة بالكامل في العقد الفندقي دون مبالغ إضافية.',
      meterInfo: {
        hasDedicatedMeter: false,
        splitRule: 'مشترك للمبنى'
      }
    },
    {
      id: 'srv-net',
      serviceKey: 'internet',
      name: 'إنترنت فايبر عالي السرعة مخصص للوحدة',
      isAvailable: true,
      isIncludedInRent: true,
      responsibleParty: 'company',
      billingMethod: 'included_no_fee',
      billingCycle: 'monthly',
      providerPayer: 'company',
      descriptionRule: 'خط ألياف بصرية سريع للغاية بسرعة تصل ٥٠٠ ميجابت مغطى بالكامل ومشمول في قيمة الإيجار.',
      internetInfo: {
        packageSpeed: '500 Mbps Fiber',
        providerName: 'STC Fiber Dedicated',
        isDedicatedLine: true,
        wifiName: 'Luxury Home_VIP_Guest',
        wifiPasswordSafe: 'Iv#Luxury2026'
      }
    },
    {
      id: 'srv-maint',
      serviceKey: 'maintenance',
      name: 'الصيانة الدورية والفورية والوقائية للشقة',
      isAvailable: true,
      isIncludedInRent: true,
      responsibleParty: 'company',
      billingMethod: 'included_no_fee',
      billingCycle: 'once',
      providerPayer: 'company',
      descriptionRule: 'صيانة شاملة للأجهزة والأقفال والتكييف والسباكة والكهرباء طوال الإقامة.',
      maintenanceScope: {
        routineCoveredBy: 'company',
        normalWearCoveredBy: 'company',
        misuseCoveredBy: 'tenant',
        emergencyCoveredBy: 'company'
      }
    },
    {
      id: 'srv-clean',
      serviceKey: 'cleaning',
      name: 'تنظيف وتدبير منزلي دوري فندقي للوحدة',
      isAvailable: true,
      isIncludedInRent: true,
      responsibleParty: 'company',
      billingMethod: 'included_no_fee',
      billingCycle: 'monthly',
      providerPayer: 'company',
      descriptionRule: 'تدبير منزلي فندقي شامل أسبوعي أو عند الطلب لتطهير الشقة وتغيير البياضات.'
    },
    {
      id: 'srv-parking',
      serviceKey: 'parking',
      name: 'موقف سيارات خاص ومظلل مخصص',
      isAvailable: true,
      isIncludedInRent: true,
      responsibleParty: 'company',
      billingMethod: 'included_no_fee',
      billingCycle: 'once',
      providerPayer: 'company',
      descriptionRule: 'موقف سيارات مخصص ومسجل برقم الشقة مزود بنظام حماية خاص.'
    }
  ];
}

/**
 * Determine overall inclusion category from service items
 */
export function determineInclusionType(services: ContractServiceItem[]): ContractInclusionType {
  const available = services.filter(s => s.isAvailable);
  if (available.length === 0) return 'not_inclusive';
  const allIncluded = available.every(s => s.isIncludedInRent && s.billingMethod === 'included_no_fee');
  if (allIncluded) return 'all_inclusive';
  const noneIncluded = available.every(s => !s.isIncludedInRent);
  if (noneIncluded) return 'not_inclusive';
  return 'partially_inclusive';
}
