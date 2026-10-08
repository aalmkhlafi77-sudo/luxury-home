import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ChevronDown, Sparkles } from 'lucide-react';

interface FaqItem {
  id?: string;
  question: string;
  answer: string;
  active?: boolean;
  displayOrder?: number;
}

const defaultFaqs: FaqItem[] = [
  {
    id: 'faq_1',
    question: 'ما هي مواعيد تسجيل الدخول والمغادرة في مباني منزل الفخامة؟',
    answer: 'موعد تسجيل الدخول المعياري في مجمعاتنا هو الساعة 15:00 عصراً، وتوقيت المغادرة وتسليم الشقة هو الساعة 12:00 ظهراً، وذلك لضمان منح طواقم التنظيف 3 ساعات كاملة لتطهير وتجهيز الشقة فندقيًا للنزيل التالي.',
    active: true,
    displayOrder: 1
  },
  {
    id: 'faq_2',
    question: 'كيف يمكنني الدخول إلى الشقة؟ وهل أحتاج لمقابلة المالك؟',
    answer: 'جميع شقق منزل الفخامة مجهزة بنظام قفل رقمي ذكي ومتصل بالشبكة الأمنية. لن تحتاج لمقابلة أي شخص؛ حيث سيصلك كود سري فريد وخاص بك فور إتمام التحقق من هويتك وسداد الحجز، ليمكنك فتح الباب الذكي بمجرد لمسه وإدخال الرمز متبوعاً بعلامة (#).',
    active: true,
    displayOrder: 2
  },
  {
    id: 'faq_3',
    question: 'كيف يتم التعامل مع مبلغ تأمين الإقامة وتأمين الأثاث؟',
    answer: 'مبلغ تأمين السكن هو وديعة يتم تعليقها كحجز تفويض مؤقت على بطاقة الفيزا الخاصة بك للرحلات الفندقية، أو تحصيلها نقدًا/تحويل في العقود الشهرية. يتم إرجاع وتصفية مبلغ التأمين بالكامل فور خروجك وفحص الشقة ومطابقتها بمحضر استلام الأثاث في غضون 24 ساعة.',
    active: true,
    displayOrder: 3
  },
  {
    id: 'faq_4',
    question: 'هل تتوفر خدمات التدبير المنزلي وتنظيف الشقق؟',
    answer: 'نعم بالكامل، خدمات منزل الفخامة تشمل تنظيف الشقق الدوري الأسبوعي الفندقي الشامل للإقامات الطويلة والتعاقدية، وتغيير بياضات الأسرّة والمناشف بأخرى معقمة، مع إمكانية طلب خدمات نظافة إضافية يومية برسوم رمزية عبر بهو الاستقبال.',
    active: true,
    displayOrder: 4
  },
  {
    id: 'faq_5',
    question: 'هل تتوفر مواقف خاصة وشواحن للسيارات الكهربائية؟',
    answer: 'نعم بالتأكيد، كل شقة في منزل الفخامة تمتلك موقف سيارات خاص بها ومظلل مسجل برقم الشقة في قبو أو فناء المبنى. كما نوفر مواقف مجهزة بالكامل بشواحن سيارات كهربائية EV بقوة 22 كيلو واط سريعة وآمنة.',
    active: true,
    displayOrder: 5
  },
  {
    id: 'faq_6',
    question: 'ما هي سياسة الإلغاء وتعديل مواعيد الحجز؟',
    answer: 'نحن نتبع سياسة إلغاء فندقية مرنة؛ حيث يمكنك إلغاء الحجز الفندقي القصير واسترداد المبلغ كاملًا بدون رسوم قبل موعد الدخول بـ 48 ساعة على الأقل. وفي عقود الإيجار الطويلة والشهرية يتم الرجوع لشروط الفسخ والإنهاء المبكر الموثقة بالعقد.',
    active: true,
    displayOrder: 6
  }
];

export const FaqSection: React.FC = () => {
  const { state } = useAppStore();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const sectionMeta = state.contentSections.find(s => s.sectionKey === 'faq');

  if (sectionMeta && !sectionMeta.visible) return null;

  // Use dynamic FAQs from database if available and active, ordered by displayOrder
  const dynamicFaqs = state.settings.faqs;
  const filteredFaqs = dynamicFaqs && Array.isArray(dynamicFaqs)
    ? dynamicFaqs
        .filter(f => f.active !== false && f.question && f.answer)
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    : [];

  const activeFaqs = filteredFaqs.length > 0 ? filteredFaqs : defaultFaqs;

  return (
    <section id="faq" className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#B69A68] tracking-wider mb-2 select-none">
          <Sparkles className="w-3.5 h-3.5" />
          <span>إجابات على أسئلتكم الشائعة والمقلقة</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#282824] tracking-tight">
          {sectionMeta?.title || 'الأسئلة الشائعة للنزلاء'}
        </h2>
        <p className="text-sm text-[#68675F] mt-2">
          {sectionMeta?.subtitle || 'مجموعة من الإجابات الوافية لتسهيل زيارتك وتأكيد وضوح كافة شروط الإقامة والتعاقد المالي.'}
        </p>
      </div>

      <div className="space-y-3">
        {activeFaqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={faq.id || `faq-${idx}`}
              className="glass-ivory-card rounded-xl border border-[#E3DCCD] overflow-hidden transition-all duration-200"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-4 sm:p-5 text-right flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-[#282824] hover:text-[#B69A68] transition-colors cursor-pointer"
              >
                <span className="font-heading text-base sm:text-lg">{faq.question}</span>
                <ChevronDown className={`w-5 h-5 text-[#B69A68] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-sm text-[#68675F] leading-relaxed border-t border-[#E3DCCD]/40 animate-in fade-in duration-200">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

