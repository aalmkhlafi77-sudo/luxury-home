import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ChevronDown, Sparkles } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'ما هي مواعيد تسجيل الدخول والمغادرة في مباني منزل الفخامة؟',
    answer: 'موعد تسجيل الدخول المعياري في مجمعاتنا هو الساعة ٣:٠٠ مساءً، وتوقيت المغادرة وتسليم الشقة هو الساعة ١٢:٠٠ ظهراً، وذلك لضمان منح طواقم التنظيف ٣ ساعات كاملة لتطهير وتجهيز الشقة فندقيًا للنزيل التالي.'
  },
  {
    question: 'كيف يمكنني الدخول إلى الشقة؟ وهل أحتاج لمقابلة المالك؟',
    answer: 'جميع شقق منزل الفخامة مجهزة بنظام قفل رقمي ذكي ومتصل بالشبكة الأمنية. لن تحتاج لمقابلة أي شخص؛ حيث سيصلك كود سري فريد وخاص بك فور إتمام التحقق من هويتك وسداد الحجز، ليمكنك فتح الباب الذكي بمجرد لمسه وإدخال الكود.'
  },
  {
    question: 'كيف يتم التعامل مع مبلغ تأمين الإقامة وتأمين الأثاث؟',
    answer: 'مبلغ تأمين السكن هو وديعة يتم تعليقها كحجز تفويض مؤقت على بطاقة الفيزا الخاصة بك للرحلات الفندقية، أو تحصيلها نقدًا/تحويل في العقود الشهرية. يتم إرجاع وتصفية مبلغ التأمين بالكامل فور خروجك وفحص الشقة ومطابقتها بمحضر استلام الأثاث في غضون ٢٤ ساعة.'
  },
  {
    question: 'هل تتوفر خدمات التدبير المنزلي وتنظيف الشقق؟',
    answer: 'نعم بالكامل، خدمات منزل الفخامة تشمل تنظيف الشقق الدوري الأسبوعي الفندقي الشامل للإقامات الطويلة والتعاقدية، وتغيير بياضات الأسرّة والمناشف بأخرى معقمة، مع إمكانية طلب خدمات نظافة إضافية يومية برسوم رمزية عبر بهو الاستقبال.'
  },
  {
    question: 'هل تتوفر مواقف خاصة وشواحن للسيارات الكهربائية؟',
    answer: 'نعم بالتأكيد، كل شقة في منزل الفخامة تمتلك موقف سيارات خاص بها ومظلل مسجل برقم الشقة في قبو أو فناء المبنى. كما نوفر مواقف مجهزة بالكامل بشواحن سيارات كهربائية EV بقوة ٢٢ كيلو واط سريعة وآمنة.'
  },
  {
    question: 'ما هي سياسة الإلغاء وتعديل مواعيد الحجز؟',
    answer: 'نحن نتبع سياسة إلغاء فندقية مرنة؛ حيث يمكنك إلغاء الحجز الفندقي القصير واسترداد المبلغ كاملًا بدون رسوم قبل موعد الدخول بـ ٤٨ ساعة على الأقل. وفي عقود الإيجار الطويلة والشهرية يتم الرجوع لشروط الفسخ والإنهاء المبكر الموثقة بالعقد.'
  }
];

export const FaqSection: React.FC = () => {
  const { state } = useAppStore();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const sectionMeta = state.contentSections.find(s => s.sectionKey === 'faq');

  if (sectionMeta && !sectionMeta.visible) return null;

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
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="glass-ivory-card rounded-xl border border-[#E3DCCD] overflow-hidden transition-all duration-200"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-4 sm:p-5 text-right flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-[#282824] hover:text-[#B69A68] transition-colors cursor-pointer"
              >
                <span>{faq.question}</span>
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
