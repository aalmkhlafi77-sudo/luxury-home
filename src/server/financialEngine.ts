export interface FinancialUnit {
  id: string;
  unitNumber: string;
  propertyId: string;
  areaSqm: number;
  isOccupied: boolean;
  occupancyDaysInPeriod?: number; // Days occupied within period
  periodRevenue?: number;         // Revenue generated in period
}

export interface ExpenseAllocationInput {
  expenseId?: string;
  expenseNumber?: string;
  title: string;
  amount: number;
  costCenterLevel: 'COMPANY' | 'PROPERTY' | 'UNIT';
  propertyId?: string;
  targetUnitId?: string; // For direct unit
  allocationMethod: 'DIRECT_UNIT' | 'EQUAL_UNITS' | 'SQM_AREA' | 'REVENUE_RATIO' | 'OCCUPANCY_DAYS' | 'CUSTOM_RATIO';
  startDate: string;
  endDate: string;
  isCapitalAsset?: boolean; // FF&E vs OPEX
  units: FinancialUnit[];
  customRatios?: Record<string, number>;
}

export interface UnitShareResult {
  unitId: string;
  unitNumber: string;
  shareAmount: number;
  percentage: number;
  basisValue: number;
}

export interface AllocationEngineResult {
  expenseTitle: string;
  totalExpenseAmount: number;
  allocationMethod: string;
  unitsCount: number;
  distributedAmount: number;
  unallocatedAmount: number;
  roundingAdjustmentHalalas: number;
  shares: UnitShareResult[];
  validationNotes: string[];
}

export function computeCostAllocation(input: ExpenseAllocationInput): AllocationEngineResult {
  const {
    title,
    amount,
    allocationMethod,
    targetUnitId,
    units,
    customRatios,
    isCapitalAsset
  } = input;

  // Zero amount is completely valid; null/undefined is invalid
  if (amount === undefined || amount === null || isNaN(amount)) {
    throw new Error('قيمة المصروف غير محددة أو غير صالحة.');
  }

  const totalAmount = Math.max(0, Math.round(Number(amount) * 100) / 100);

  // Capital Assets (FF&E) are balance sheet assets, separated from pure OPEX
  if (isCapitalAsset) {
    return {
      expenseTitle: title,
      totalExpenseAmount: totalAmount,
      allocationMethod: 'CAPITAL_ASSET_FFE',
      unitsCount: units.length,
      distributedAmount: 0,
      unallocatedAmount: totalAmount,
      roundingAdjustmentHalalas: 0,
      shares: [],
      validationNotes: ['تم تصنيف المصروف كأصل رأسمالي (FF&E) مستثنى من التوزيع التشغيلي المباشر (OPEX).']
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
      shares: units.map(u => ({
        unitId: u.id,
        unitNumber: u.unitNumber,
        shareAmount: 0,
        percentage: 0,
        basisValue: 0
      })),
      validationNotes: ['قيمة المصروف صفرية معتمدة؛ تم تسجيل الحصص بقيمة صفر دون افتراض أرقام تجريبية.']
    };
  }

  // 1. Direct Unit Allocation
  if (allocationMethod === 'DIRECT_UNIT') {
    const targetUnit = units.find(u => u.id === targetUnitId);
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
        validationNotes: ['لم يتم العثور على الوحدة المحددة؛ بقي المصروف غير موزع على مستوى العقار.']
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
      validationNotes: ['تم تحميل المصروف مباشرة وبنسبة 100% على الوحدة المستهدفة.']
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
      validationNotes: ['لا توجد وحدات مرتبطة؛ تم الإبقاء على المصروف غير موزع على مستوى المركز المالي.']
    };
  }

  // 2. Compute shares based on chosen allocation method
  let basisValues: { unit: FinancialUnit; basis: number }[] = [];
  const validationNotes: string[] = [];

  if (allocationMethod === 'EQUAL_UNITS') {
    basisValues = units.map(u => ({ unit: u, basis: 1 }));
  } else if (allocationMethod === 'SQM_AREA') {
    // STRICT: Do NOT invent 50m² if missing! Check area values
    const missingAreaUnits = units.filter(u => !u.areaSqm || u.areaSqm <= 0);
    if (missingAreaUnits.length > 0) {
      throw new Error(`تعذر التوزيع حسب المساحة: توجد ${missingAreaUnits.length} وحدة بدون مساحة مسجلة (مثال: شقة ${missingAreaUnits[0].unitNumber}). يرجى تحديث مساحات الوحدات أولاً.`);
    }
    basisValues = units.map(u => ({ unit: u, basis: u.areaSqm }));
  } else if (allocationMethod === 'OCCUPANCY_DAYS') {
    basisValues = units.map(u => ({ unit: u, basis: u.occupancyDaysInPeriod || 0 }));
    const totalDays = basisValues.reduce((sum, item) => sum + item.basis, 0);
    if (totalDays === 0) {
      // Entire property was vacant during this period
      return {
        expenseTitle: title,
        totalExpenseAmount: totalAmount,
        allocationMethod,
        unitsCount: units.length,
        distributedAmount: 0,
        unallocatedAmount: totalAmount,
        roundingAdjustmentHalalas: 0,
        shares: [],
        validationNotes: ['انعدام الإشغال خلال الفترة المحددة: تم الإبقاء على المصروف كعبء تشغيلي غير موزع على مستوى المبنى.']
      };
    }
  } else if (allocationMethod === 'REVENUE_RATIO') {
    basisValues = units.map(u => ({ unit: u, basis: Math.max(0, u.periodRevenue || 0) }));
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
        validationNotes: ['انعدام الإيرادات خلال الفترة: بقي المصروف غير موزع على مستوى المبنى.']
      };
    }
  } else if (allocationMethod === 'CUSTOM_RATIO') {
    basisValues = units.map(u => ({ unit: u, basis: (customRatios && customRatios[u.id]) || 0 }));
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
      validationNotes: ['إجمالي أساس التوزيع يساوي صفراً؛ لم يتم توزيع المصروف لتفادي القسمة على صفر.']
    };
  }

  // Calculate raw shares
  let calculatedShares: UnitShareResult[] = [];
  let runningSum = 0;

  for (let i = 0; i < basisValues.length; i++) {
    const { unit, basis } = basisValues[i];
    const percentage = (basis / totalBasis) * 100;
    // Standard rounding to 2 decimal places (halalas)
    const shareAmount = Math.floor(((totalAmount * basis) / totalBasis) * 100) / 100;
    runningSum = Math.round((runningSum + shareAmount) * 100) / 100;

    calculatedShares.push({
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      shareAmount,
      percentage: Math.round(percentage * 100) / 100,
      basisValue: basis
    });
  }

  // Deterministic Rounding Adjustment:
  // Add remainder halalas to the largest unit share or the last unit so total is EXACTLY 100%
  const difference = Math.round((totalAmount - runningSum) * 100) / 100;
  if (difference !== 0 && calculatedShares.length > 0) {
    // Find index of unit with largest basis
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
