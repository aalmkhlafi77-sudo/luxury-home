import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { OperationalExpense } from '../../../types';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Building2,
  DollarSign,
  CreditCard,
  Layers,
  Calendar,
  AlertCircle,
  Eye,
  Edit,
  RotateCcw,
  Sparkles,
  Download
} from 'lucide-react';
import {
  getExpenseCategoryLabel,
  getCostCenterLevelLabel,
  getTemporalDistributionLabel,
  getCostAllocationMethodLabel
} from '../../../utils/financialCalculations';
import { ExpenseRegistrationModal } from './ExpenseRegistrationModal';
import { ExpenseDetailsModal } from './ExpenseDetailsModal';

export const ExpenseLedgerView: React.FC = () => {
  const { state } = useAppStore();

  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<OperationalExpense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<OperationalExpense | null>(null);

  const expenses = state.expenses || [];

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Cost Center
      if (selectedCostCenter !== 'all' && exp.level !== selectedCostCenter) return false;

      // Property
      if (selectedPropertyId !== 'all') {
        if (exp.level === 'company') return false;
        if (exp.propertyId !== selectedPropertyId) return false;
      }

      // Category
      if (selectedCategory !== 'all' && exp.category !== selectedCategory) return false;

      // Record Status
      if (selectedStatus !== 'all' && (exp.recordStatus || 'approved') !== selectedStatus) return false;

      // Payment Status
      if (selectedPaymentStatus !== 'all' && exp.paymentStatus !== selectedPaymentStatus) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = exp.expenseNumber.toLowerCase().includes(q);
        const matchesDesc = exp.description.toLowerCase().includes(q);
        const matchesVendor = exp.vendorOrBeneficiary.toLowerCase().includes(q);
        const matchesInvoice = (exp.invoiceDocNumber || '').toLowerCase().includes(q);
        if (!matchesNum && !matchesDesc && !matchesVendor && !matchesInvoice) return false;
      }

      return true;
    });
  }, [expenses, selectedCostCenter, selectedPropertyId, selectedCategory, selectedStatus, selectedPaymentStatus, searchQuery]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalCount = 0;
    let totalAmount = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let ffeCapital = 0;
    let operatingExpenses = 0;

    expenses.forEach(exp => {
      if (exp.recordStatus === 'reversed') return;
      totalCount += 1;
      totalAmount += exp.amount;
      totalPaid += exp.paidAmount || 0;
      totalUnpaid += Math.max(0, exp.amount - (exp.paidAmount || 0));

      if (exp.isFfeOrEquipment) {
        ffeCapital += exp.amount;
      } else {
        operatingExpenses += exp.amount;
      }
    });

    return {
      totalCount,
      totalAmount,
      totalPaid,
      totalUnpaid,
      ffeCapital,
      operatingExpenses,
    };
  }, [expenses]);

  return (
    <div className="space-y-6 text-right">
      
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#282824] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#B69A68]" />
            <span>دفتر يومية المصاريف التشغيلية وتوزيع التكاليف</span>
          </h3>
          <p className="text-xs text-[#68675F] mt-0.5">
            إدارة متطورة لمراكز التكلفة الثلاثية (شركة · مبنى · وحدة) مع توزيع زمني وتكليفي عادل
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingExpense(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2.5 bg-[#282824] hover:bg-[#1A1A17] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 text-[#B69A68]" />
            <span>تسجيل قيد مصروف جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Scoreboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 select-none">
        <div className="p-4 bg-white rounded-3xl border border-[#E3DCCD] shadow-xs">
          <span className="block text-[11px] font-bold text-[#68675F] mb-1">إجمالي القيود المسجلة</span>
          <span className="text-xl font-black text-[#282824] tabular-nums">
            {stats.totalCount} قيد
          </span>
          <span className="text-[10px] text-[#68675F] block mt-0.5">
            بقيمة {stats.totalAmount.toLocaleString('ar-SA')} ر.س
          </span>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-[#E3DCCD] shadow-xs">
          <span className="block text-[11px] font-bold text-[#68675F] mb-1">المصاريف التشغيلية (OPEX)</span>
          <span className="text-xl font-black text-rose-800 tabular-nums">
            {stats.operatingExpenses.toLocaleString('ar-SA')} ر.س
          </span>
          <span className="text-[10px] text-[#68675F] block mt-0.5">إيجار، صيانة، فواتير</span>
        </div>

        <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-200 shadow-xs">
          <span className="block text-[11px] font-bold text-emerald-800 mb-1">المدفوعات المسددة فعلياً</span>
          <span className="text-xl font-black text-emerald-900 tabular-nums">
            {stats.totalPaid.toLocaleString('ar-SA')} ر.س
          </span>
          <span className="text-[10px] text-emerald-700 block mt-0.5">خرجت من الحسابات البنكية</span>
        </div>

        <div className={`p-4 rounded-3xl border shadow-xs ${
          stats.totalUnpaid > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#E3DCCD]'
        }`}>
          <span className="block text-[11px] font-bold text-[#68675F] mb-1">المستحقات غير المسددة</span>
          <span className={`text-xl font-black tabular-nums ${
            stats.totalUnpaid > 0 ? 'text-amber-900' : 'text-[#282824]'
          }`}>
            {stats.totalUnpaid.toLocaleString('ar-SA')} ر.س
          </span>
          <span className="text-[10px] text-[#68675F] block mt-0.5">التزامات آجلة على المنشأة</span>
        </div>

        <div className="p-4 bg-purple-50 rounded-3xl border border-purple-200 shadow-xs">
          <span className="block text-[11px] font-bold text-purple-900 mb-1">أصول وأثاث رأسمالي (FF&E)</span>
          <span className="text-xl font-black text-purple-950 tabular-nums">
            {stats.ffeCapital.toLocaleString('ar-SA')} ر.س
          </span>
          <span className="text-[10px] text-purple-800 block mt-0.5">مستثناة من تكاليف التشغيل</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-[#E3DCCD] shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[#68675F] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم المصروف، الوصف، المورد أو رقم الفاتورة..."
              className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-[#B69A68]"
            />
          </div>

          {/* Cost Center Filter */}
          <select
            value={selectedCostCenter}
            onChange={(e) => setSelectedCostCenter(e.target.value)}
            className="bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-semibold text-[#282824] cursor-pointer"
          >
            <option value="all">كل مراكز التكلفة</option>
            <option value="company">الشركة العامة</option>
            <option value="property">المباني والمجمعات</option>
            <option value="unit">الوحدات والشقق</option>
          </select>

          {/* Property Filter */}
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-semibold text-[#282824] cursor-pointer"
          >
            <option value="all">كافة المجمعات</option>
            {state.properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-semibold text-[#282824] cursor-pointer"
          >
            <option value="all">كافة التصنيفات</option>
            {(state.expenseCategories || []).map(cat => (
              <option key={cat.id} value={cat.code}>{cat.nameAr}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-semibold text-[#282824] cursor-pointer"
          >
            <option value="all">كل الحالات (معتمد/مسودة/معكوس)</option>
            <option value="approved">معتمد فقط</option>
            <option value="draft">مسودة</option>
            <option value="reversed">معكوس وملغي</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-semibold text-[#282824] cursor-pointer"
          >
            <option value="all">كل حالات السداد</option>
            <option value="paid">مسدد بالكامل</option>
            <option value="partial">سداد جزئي</option>
            <option value="unpaid">مستحق غير مسدد</option>
          </select>

        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-3xl border border-[#E3DCCD] overflow-hidden shadow-xs">
        <div className="p-4 bg-[#FAF8F5] border-b border-[#E3DCCD] flex items-center justify-between select-none">
          <div>
            <h4 className="font-bold text-[#282824] text-xs sm:text-sm">
              سجل قيود المصاريف ({filteredExpenses.length} قيد مالي)
            </h4>
            <p className="text-[10px] text-[#68675F] mt-0.5">
              انقر على أي قيد لعرض التفاصيل وتاريخ السداد والمسار التدقيقي
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-[#FAF8F5] text-[#282824] font-bold border-b border-[#E3DCCD]">
              <tr>
                <th className="p-3">رقم القيد</th>
                <th className="p-3">تاريخ القيد</th>
                <th className="p-3">التصنيف</th>
                <th className="p-3">مركز التكلفة</th>
                <th className="p-3">وصف الصرف المستندي</th>
                <th className="p-3">التوزيع الزمني</th>
                <th className="p-3">قاعدة التوزيع</th>
                <th className="p-3">قيمة المصروف</th>
                <th className="p-3">المسدد</th>
                <th className="p-3">الحالة</th>
                <th className="p-3 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DCCD]">
              {filteredExpenses.map(exp => {
                const prop = state.properties.find(p => p.id === exp.propertyId);
                const unit = state.units.find(u => u.id === exp.unitId);
                const isReversed = exp.recordStatus === 'reversed';

                return (
                  <tr
                    key={exp.id}
                    className={`transition-colors cursor-pointer ${
                      isReversed
                        ? 'bg-rose-50/40 hover:bg-rose-50/70 text-rose-950'
                        : 'hover:bg-[#FFFCF6]'
                    }`}
                    onClick={() => setViewingExpense(exp)}
                  >
                    <td className="p-3 font-mono font-bold text-[#282824] select-all">
                      {exp.expenseNumber}
                    </td>

                    <td className="p-3 text-[#68675F] tabular-nums font-mono whitespace-nowrap">
                      {exp.date}
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        exp.isFfeOrEquipment
                          ? 'bg-purple-100 text-purple-900 border-purple-200'
                          : 'bg-[#FAF8F5] text-[#282824] border-[#E3DCCD]'
                      }`}>
                        {getExpenseCategoryLabel(exp.category)}
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#282824]">
                          {getCostCenterLevelLabel(exp.level)}
                        </span>
                        {exp.level === 'property' && prop && (
                          <span className="text-[10px] text-[#68675F]">{prop.name}</span>
                        )}
                        {exp.level === 'unit' && unit && (
                          <span className="text-[10px] text-[#68675F]">شقة #{unit.unitNumber}</span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 max-w-xs text-[#282824] leading-relaxed truncate">
                      <span title={exp.description}>{exp.description}</span>
                    </td>

                    <td className="p-3 whitespace-nowrap text-[#68675F] text-[11px]">
                      {exp.temporalDistribution === 'equal_monthly'
                        ? 'شهري متساوي'
                        : exp.temporalDistribution === 'actual_days'
                        ? 'أيام فعلية'
                        : 'فوري'}
                    </td>

                    <td className="p-3 whitespace-nowrap text-[#68675F] text-[11px]">
                      {exp.level === 'unit'
                        ? 'مباشر للوحدة'
                        : exp.costAllocationMethod === 'by_area'
                        ? 'بالمساحة م²'
                        : exp.costAllocationMethod === 'by_revenue'
                        ? 'بالدخل'
                        : 'بالتساوي'}
                    </td>

                    <td className="p-3 font-bold text-[#282824] tabular-nums whitespace-nowrap">
                      {exp.amount.toLocaleString('ar-SA')} ر.س
                    </td>

                    <td className="p-3 tabular-nums whitespace-nowrap">
                      <span className={`font-semibold ${
                        exp.paidAmount >= exp.amount
                          ? 'text-emerald-800'
                          : exp.paidAmount > 0
                          ? 'text-amber-800'
                          : 'text-rose-800'
                      }`}>
                        {(exp.paidAmount || 0).toLocaleString('ar-SA')} ر.س
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isReversed
                          ? 'bg-rose-100 text-rose-800'
                          : exp.recordStatus === 'draft'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isReversed ? 'معكوس' : exp.recordStatus === 'draft' ? 'مسودة' : 'معتمد'}
                      </span>
                    </td>

                    <td className="p-3 text-left whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setViewingExpense(exp)}
                          className="p-1 hover:bg-[#E3DCCD]/50 rounded text-[#282824] transition-colors cursor-pointer"
                          title="عرض التفاصيل وسجل السداد"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!isReversed && (
                          <button
                            onClick={() => {
                              setEditingExpense(exp);
                              setShowAddModal(true);
                            }}
                            className="p-1 hover:bg-[#E3DCCD]/50 rounded text-[#282824] transition-colors cursor-pointer"
                            title="تعديل القيد والتوزيع"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredExpenses.length === 0 && (
          <div className="p-8 text-center text-[#68675F] text-xs">
            لا توجد قيود مصاريف تطابق معايير البحث والتصفية المحددة.
          </div>
        )}
      </div>

      {/* Registration / Edit Modal */}
      {showAddModal && (
        <ExpenseRegistrationModal
          initialExpense={editingExpense || undefined}
          onClose={() => {
            setShowAddModal(false);
            setEditingExpense(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setEditingExpense(null);
          }}
        />
      )}

      {/* Details Modal */}
      {viewingExpense && (
        <ExpenseDetailsModal
          expense={viewingExpense}
          onClose={() => setViewingExpense(null)}
          onEditExpense={(exp) => {
            setViewingExpense(null);
            setEditingExpense(exp);
            setShowAddModal(true);
          }}
        />
      )}

    </div>
  );
};
