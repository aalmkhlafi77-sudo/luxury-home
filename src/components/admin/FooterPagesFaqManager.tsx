import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FaqItem } from '../../types';
import {
  FileText,
  HelpCircle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Check,
  Eye,
  ShieldCheck,
  Info
} from 'lucide-react';

export const FooterPagesFaqManager: React.FC = () => {
  const { state, updateCompanySettings } = useAppStore();
  const [activeSubTab, setActiveTab] = useState<'pages' | 'faqs'>('pages');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Footer Pages State
  const [selectedPageKey, setSelectedPageKey] = useState<'terms' | 'privacy' | 'regulations' | 'about'>('terms');
  
  const initialFooterPages = state.settings.footerPages || {
    terms: {
      id: 'terms',
      title: 'الشروط والأحكام الرسمية لإقامة وحجوزات منزل الفخامة',
      subtitle: 'أنظمة التعاقد، الدفع، إلغاء الحجز، وحقوق وواجبات النزيل في الوحدات الفندقية',
      content: '1. شروط الحجز والدخول: يتوجب على النزيل تقديم إثبات شخصية سارٍ لتوثيق الحجز.\n2. مواعيد الدخول والمغادرة: الدخول اعتبراً من 15:00، والمغادرة 12:00 ظهراً.\n3. سياسة تأمين الأثاث المسترد: يُحتفظ بمبلغ التأمين للوحدة ضماناً لسلامة المقتنيات.\n4. الدفع والأقساط: يلتزم المستأجر بسداد الأقساط بمواعيدها المحددة.',
      lastUpdated: new Date().toISOString().slice(0, 10),
    },
    privacy: {
      id: 'privacy',
      title: 'سياسة الخصوصية والأمان وحماية بيانات الضيوف',
      subtitle: 'التزامنا الكامل بحماية بياناتك الشخصية وسجلات الدخول الذكي وتشفير المعاملات المالية',
      content: '1. حماية البيانات الشخصية: تلتزم منزل الفخامة بعدم مشاركة بيانات الضيوف مع أي أطراف خارجية.\n2. أمان القفل الذكي: أرقام السر وتفويض الدخول الرقمي مشفرة بالكامل.\n3. المعاملات المشفرة: المعاملات المالية مشفرة بنظام الزكاة والضريبة والجمارك ZATCA.',
      lastUpdated: new Date().toISOString().slice(0, 10),
    },
    regulations: {
      id: 'regulations',
      title: 'لوائح وأنظمة الإقامة السكنية والخدمات الفندقية',
      subtitle: 'قواعد الجوار، استخدام المواقف المظلمة والشواحن الكهربائية، والخدمات الخاصة',
      content: '1. الهدوء وساعات الراحة: يُحظر إزعاج الجوار من الساعة 23:00 مساءً حتى 07:00 صباحاً.\n2. الموقف المظلل: يلتزم الضيف بإيقاف سيارته بالموقف المخصص لشثته.\n3. ممنوع التدخين: جميع الوحدات مغطاة بكاشفات الدخان ومحظور التدخين داخل الغرف.',
      lastUpdated: new Date().toISOString().slice(0, 10),
    },
    about: {
      id: 'about',
      title: 'من نحن — قصة وشغف منزل الفخامة للضيافة السكنية',
      subtitle: 'رؤيتنا في إعادة تعريف الضيافة الفاخرة التي تجمع بين خصوصية المنزل وخدمات الفنادق العالمية',
      content: 'تأسست شركة منزل الفخامة للضيافة العقارية (Luxury Home) لتكون الوجهة الأولى للباحثين عن تجربة سكنية متميزة في المملكة العربية السعودية.\nنحن ندمج بين أحدث تقنيات الدخول الذكي والراحة الفندقية الشاملة وبين دفء وخصوصية المنزل.',
      lastUpdated: new Date().toISOString().slice(0, 10),
    }
  };

  const [pagesForm, setPagesForm] = useState(initialFooterPages);

  // FAQs State
  const initialFaqsList: FaqItem[] = state.faqs && state.faqs.length > 0 ? state.faqs : [
    {
      id: 'faq_1',
      question: 'ما هي مواعيد تسجيل الدخول والمغادرة في وحدات منزل الفخامة؟',
      answer: 'موعد الدخول الرسمي يتوفر بدءاً من الساعة 15:00 عصراً، وتاريخ المغادرة والتحرير الفندقي في تمام الساعة 12:00 ظهراً.',
      displayOrder: 1,
      active: true
    },
    {
      id: 'faq_2',
      question: 'كيف يتم كشف واستخدام رمز القفل الذكي للباب؟',
      answer: 'يمكن للنزيل الاستعلام برقم حكزه عبر بوابه النزيل وكشف كود القفل السري بنقرة واحدة، ثم إدخال الرمز متبوعاً بعلامة (#).',
      displayOrder: 2,
      active: true
    },
    {
      id: 'faq_3',
      question: 'هل الموقف المظلل والشواحن الكهربائية مجانية ومخصصة للشقة؟',
      answer: 'نعم، كل وحدة سكنية تشتمل على موقف خاص مظلل ومحجوز برقم الشقة، بالإضافة لوحدات شحن السيارات الكهربائية.',
      displayOrder: 3,
      active: true
    },
    {
      id: 'faq_4',
      question: 'ما هي آلية استرداد مبلغ تأمين الأثاث المسترد؟',
      answer: 'يتم فحص الشقة عند المغادرة وإلغاء التفويض أو إرجاع مبلغ التأمين لحساب النزيل خلال 24 ساعة كحد أقصى.',
      displayOrder: 4,
      active: true
    }
  ];

  const [faqsList, setFaqsList] = useState<FaqItem[]>(initialFaqsList);
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');

  // Save Page Changes
  const handleSavePage = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPages = {
      ...pagesForm,
      [selectedPageKey]: {
        ...pagesForm[selectedPageKey],
        lastUpdated: new Date().toISOString().slice(0, 10),
      }
    };
    setPagesForm(updatedPages);
    updateCompanySettings({ footerPages: updatedPages });
    setSuccessMsg('تم حفظ وتحديث محتوى الصفحة بنجاح في قاعدة البيانات.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Add FAQ
  const handleAddFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) return;
    const newItem: FaqItem = {
      id: `faq_${Date.now()}`,
      question: newFaqQuestion.trim(),
      answer: newFaqAnswer.trim(),
      displayOrder: faqsList.length + 1,
      active: true
    };
    const updated = [...faqsList, newItem];
    setFaqsList(updated);
    setNewFaqQuestion('');
    setNewFaqAnswer('');
    updateCompanySettings({ faqs: updated });
    setSuccessMsg('تم إضافة السؤال الشائعي وحفظه بنجاح.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Delete FAQ
  const handleDeleteFaq = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا السؤال الشائع؟')) {
      const updated = faqsList.filter(f => f.id !== id);
      setFaqsList(updated);
      updateCompanySettings({ faqs: updated });
      setSuccessMsg('تم حذف السؤال بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  // Toggle FAQ Active
  const handleToggleFaqActive = (id: string) => {
    const updated = faqsList.map(f => f.id === id ? { ...f, active: !f.active } : f);
    setFaqsList(updated);
    updateCompanySettings({ faqs: updated });
  };

  // Move FAQ Order
  const handleMoveFaq = (index: number, direction: 'up' | 'down') => {
    const updated = [...faqsList];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < updated.length) {
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      // Re-assign display orders
      const reordered = updated.map((f, i) => ({ ...f, displayOrder: i + 1 }));
      setFaqsList(reordered);
      updateCompanySettings({ faqs: reordered });
    }
  };

  // Save Edit FAQ
  const handleSaveEditFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq) return;
    const updated = faqsList.map(f => f.id === editingFaq.id ? editingFaq : f);
    setFaqsList(updated);
    setEditingFaq(null);
    updateCompanySettings({ faqs: updated });
    setSuccessMsg('تم تحديث السؤال الشائع وحفظه في قاعدة البيانات.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const currentPage = pagesForm[selectedPageKey];

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#E3DCCD] space-y-6 shadow-xs text-right select-text animate-in fade-in">
      
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3DCCD]">
        <div>
          <h3 className="font-bold text-base text-[#282824] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#B69A68]" />
            <span>إدارة صفحات الفوتر والأسئلة الشائعة (Footer Pages & FAQ Manager)</span>
          </h3>
          <p className="text-xs text-[#68675F] mt-1">
            تحرير الشروط والأحكام، سياسة الخصوصية، لوائح الإقامة، صفحة من نحن، وإدارة نظام الأسئلة الشائعة مع حفظها دائمًا في قاعدة البيانات عبر API.
          </p>
        </div>

        {/* Sub tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F7F3EB] rounded-2xl border border-[#E3DCCD] shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('pages')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'pages' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            صفحات الفوتر الأربعة
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('faqs')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'faqs' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            الأسئلة الشائعة (FAQs)
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 flex items-center gap-2 text-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* SUB TAB A: FOOTER PAGES MANAGER */}
      {activeSubTab === 'pages' && (
        <div className="space-y-6">
          
          {/* Page Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setSelectedPageKey('terms')}
              className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                selectedPageKey === 'terms'
                  ? 'bg-[#282824] text-white border-[#282824] shadow-sm'
                  : 'bg-[#F7F3EB]/60 border-[#E3DCCD] text-[#282824] hover:bg-[#F7F3EB]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <FileText className="w-4 h-4 text-[#B69A68]" />
                <span>الشروط والأحكام</span>
              </div>
              <span className="text-[10px] opacity-70 block mt-1">أنظمة التعاقد وإلغاء الحجز</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPageKey('privacy')}
              className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                selectedPageKey === 'privacy'
                  ? 'bg-[#282824] text-white border-[#282824] shadow-sm'
                  : 'bg-[#F7F3EB]/60 border-[#E3DCCD] text-[#282824] hover:bg-[#F7F3EB]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-[#B69A68]" />
                <span>سياسة الخصوصية</span>
              </div>
              <span className="text-[10px] opacity-70 block mt-1">حماية البيانات والتشفير</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPageKey('regulations')}
              className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                selectedPageKey === 'regulations'
                  ? 'bg-[#282824] text-white border-[#282824] shadow-sm'
                  : 'bg-[#F7F3EB]/60 border-[#E3DCCD] text-[#282824] hover:bg-[#F7F3EB]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <Info className="w-4 h-4 text-[#B69A68]" />
                <span>لوائح الإقامة</span>
              </div>
              <span className="text-[10px] opacity-70 block mt-1">قواعد الجوار والتدخين</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPageKey('about')}
              className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                selectedPageKey === 'about'
                  ? 'bg-[#282824] text-white border-[#282824] shadow-sm'
                  : 'bg-[#F7F3EB]/60 border-[#E3DCCD] text-[#282824] hover:bg-[#F7F3EB]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <HelpCircle className="w-4 h-4 text-[#B69A68]" />
                <span>من نحن</span>
              </div>
              <span className="text-[10px] opacity-70 block mt-1">رؤية وقصة منزل الفخامة</span>
            </button>
          </div>

          {/* Page Edit Form */}
          <form onSubmit={handleSavePage} className="p-5 bg-[#F7F3EB]/40 rounded-3xl border border-[#E3DCCD] space-y-4">
            
            <div className="space-y-1">
              <label className="font-bold text-xs text-[#282824] block">عنوان الصفحة الرئيسي</label>
              <input
                type="text"
                required
                value={currentPage.title}
                onChange={(e) => {
                  const val = e.target.value;
                  setPagesForm((prev: typeof initialFooterPages) => ({
                    ...prev,
                    [selectedPageKey]: { ...prev[selectedPageKey], title: val }
                  }));
                }}
                className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-xs font-bold text-[#282824] focus:outline-none focus:border-[#B69A68]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-xs text-[#282824] block">العنوان الفرعي الوصفي</label>
              <input
                type="text"
                value={currentPage.subtitle || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setPagesForm((prev: typeof initialFooterPages) => ({
                    ...prev,
                    [selectedPageKey]: { ...prev[selectedPageKey], subtitle: val }
                  }));
                }}
                className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-xs text-[#282824] focus:outline-none focus:border-[#B69A68]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-xs text-[#282824] block">نص ومحتوى الصفحة الرسمي (يدعم الفقرات والأسطر)</label>
              <textarea
                rows={8}
                required
                value={currentPage.content}
                onChange={(e) => {
                  const val = e.target.value;
                  setPagesForm((prev: typeof initialFooterPages) => ({
                    ...prev,
                    [selectedPageKey]: { ...prev[selectedPageKey], content: val }
                  }));
                }}
                className="w-full p-3 bg-white border border-[#E3DCCD] rounded-2xl text-xs leading-relaxed text-[#282824] focus:outline-none focus:border-[#B69A68]"
              />
            </div>

            <div className="pt-2 flex justify-between items-center">
              <span className="text-[11px] text-[#68675F]">
                تاريخ التحديث الحالي: <bdi dir="ltr" className="font-mono font-bold">{currentPage.lastUpdated}</bdi>
              </span>

              <button
                type="submit"
                className="px-6 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#B69A68]" />
                <span>حفظ محتوى الصفحة في قاعدة البيانات</span>
              </button>
            </div>

          </form>

        </div>
      )}

      {/* SUB TAB B: FAQ MANAGER */}
      {activeSubTab === 'faqs' && (
        <div className="space-y-6">
          
          {/* Add FAQ Form */}
          <form onSubmit={handleAddFaq} className="p-4 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD] space-y-3">
            <h4 className="font-bold text-xs text-[#282824] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#B69A68]" />
              <span>إضافة سؤال شائع جديد إلى الموقع</span>
            </h4>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="أدخل السؤال الشائع (مثال: ما هي أوقات تسجيل الدخول؟)..."
                value={newFaqQuestion}
                onChange={(e) => setNewFaqQuestion(e.target.value)}
                className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-xs font-bold text-[#282824] focus:outline-none focus:border-[#B69A68]"
              />
              <textarea
                rows={2}
                placeholder="أدخل الإجابة المعتمدة الشاملة على السؤال..."
                value={newFaqAnswer}
                onChange={(e) => setNewFaqAnswer(e.target.value)}
                className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-xs text-[#282824] focus:outline-none focus:border-[#B69A68]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newFaqQuestion.trim() || !newFaqAnswer.trim()}
                className="px-5 py-2 bg-[#282824] hover:bg-[#1a1a18] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-[#B69A68]" />
                <span>إضافة السؤال الشائع</span>
              </button>
            </div>
          </form>

          {/* Edit Modal / Form if editing */}
          {editingFaq && (
            <form onSubmit={handleSaveEditFaq} className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <strong className="text-xs text-amber-900 font-bold">تعديل السؤال الشائع:</strong>
                <button
                  type="button"
                  onClick={() => setEditingFaq(null)}
                  className="text-xs text-amber-800 hover:underline cursor-pointer"
                >
                  إلغاء التعديل
                </button>
              </div>

              <input
                type="text"
                value={editingFaq.question}
                onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold"
              />
              <textarea
                rows={3}
                value={editingFaq.answer}
                onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#282824] text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          )}

          {/* FAQ Items List */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-[#282824]">قائمة الأسئلة الشائعة المعروضة المنشورة ({faqsList.length}):</h4>

            <div className="divide-y divide-[#E3DCCD] bg-white rounded-2xl border border-[#E3DCCD] overflow-hidden">
              {faqsList.map((faq, idx) => (
                <div key={faq.id} className="p-4 flex items-start justify-between gap-4 hover:bg-[#FAF8F5] transition-colors">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#F7F3EB] text-[#282824] rounded-md font-mono text-[10px] font-bold">
                        #{idx + 1}
                      </span>
                      <strong className="text-xs font-bold text-[#282824]">{faq.question}</strong>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        faq.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {faq.active ? 'منشور نشط' : 'مخفي'}
                      </span>
                    </div>
                    <p className="text-xs text-[#68675F] leading-relaxed pr-6">{faq.answer}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 select-none">
                    <button
                      type="button"
                      onClick={() => handleToggleFaqActive(faq.id)}
                      className="px-2.5 py-1 text-[11px] font-bold border border-[#E3DCCD] rounded-lg hover:bg-stone-100 cursor-pointer"
                    >
                      {faq.active ? 'إخفاء' : 'تفعيل'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingFaq(faq)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-[#F7F3EB] border border-[#E3DCCD] rounded-lg hover:bg-[#EFE9DF] cursor-pointer"
                    >
                      تعديل
                    </button>

                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveFaq(idx, 'up')}
                      className="p-1 border border-[#E3DCCD] rounded-lg disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-[#68675F]" />
                    </button>

                    <button
                      type="button"
                      disabled={idx === faqsList.length - 1}
                      onClick={() => handleMoveFaq(idx, 'down')}
                      className="p-1 border border-[#E3DCCD] rounded-lg disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-[#68675F]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteFaq(faq.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
