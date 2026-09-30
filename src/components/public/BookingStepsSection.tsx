import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Sparkles, CalendarSearch, ShieldCheck, KeyRound } from 'lucide-react';

export const BookingStepsSection: React.FC = () => {
  const { state } = useAppStore();
  const sectionMeta = state.contentSections.find(s => s.sectionKey === 'steps');

  if (sectionMeta && !sectionMeta.visible) return null;

  const steps = [
    {
      num: '01',
      icon: <CalendarSearch className="w-6 h-6 text-[#B69A68]" />,
      title: 'البحث الفوري وتحديد التواريخ',
      desc: 'اختر المجمع السكني، نوع الإيجار، وتواريخ الدخول والمغادرة، وستقوم خوارزمية البحث المطور بعرض الشقق المتاحة للتعاقد الفوري في نفس اللحظة.'
    },
    {
      num: '02',
      icon: <ShieldCheck className="w-6 h-6 text-[#B69A68]" />,
      title: 'التعاقد والدفع الرقمي الآمن',
      desc: 'ادخل بيانات النزيل لتوثيق الهوية وإصدار العقد، ومن ثم السداد المباشر لقيمة حجزك والتأمين عبر البوابات البنكية الرقمية المعتمدة (مدى، فيزا، أبل باي).'
    },
    {
      num: '03',
      icon: <KeyRound className="w-6 h-6 text-[#B69A68]" />,
      title: 'استلام رمز القفل الذكي والدخول',
      desc: 'عند حلول موعد الوصول، ستصلك رسالة سرية بها كود الدخول للقفل الذكي، ورقم موقفك الخاص المظلل ومحاضر فحص سلامة الأثاث الموقعة.'
    }
  ];

  return (
    <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-[#FFFCF6]/60 rounded-3xl my-8 border border-[#E3DCCD]">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#B69A68] tracking-wider mb-2 select-none">
          <Sparkles className="w-3.5 h-3.5" />
          <span>رحلة رقمية بالكامل بدون تعقيدات ورقية</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#282824] tracking-tight">
          {sectionMeta?.title || 'خطوات رحلة الإقامة الفاخرة'}
        </h2>
        <p className="text-sm text-[#68675F] mt-2">
          {sectionMeta?.subtitle || 'احصل على عقد السكن الفوري وكود الشقة الخاص بك رقمياً في دقائق معدودة.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
        {steps.map((step, idx) => (
          <div key={idx} className="relative glass-ivory p-6 rounded-2xl border border-[#E3DCCD] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-[#EFE9DF] rounded-xl">
                  {step.icon}
                </div>
                <span className="text-2xl font-bold text-[#B69A68]/40 tabular-nums">
                  {step.num}
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#282824] mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-[#68675F] leading-relaxed">
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
