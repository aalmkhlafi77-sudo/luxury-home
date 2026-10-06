import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatDate } from '../../utils/formatters';
import { X, ShieldCheck, FileText, Info, HelpCircle } from 'lucide-react';

interface FooterPageModalProps {
  pageKey: 'terms' | 'privacy' | 'regulations' | 'about';
  onClose: () => void;
}

const DEFAULT_PAGES: Record<string, { title: string; subtitle: string; icon: any; content: string[] }> = {
  terms: {
    title: 'الشروط والأحكام الرسمية لإقامة وحجوزات منزل الفخامة',
    subtitle: 'أنظمة التعاقد، الدفع، إلغاء الحجز، وحقوق وواجبات النزيل في الوحدات الفندقية',
    icon: FileText,
    content: [
      '1. شروط الحجز والدخول: يتوجب على النزيل تقديم إثبات شخصية سارٍ (هوية وطنية أو إقامة أو جواز سفر) لتوثيق الحجز، ويشمل سعر الحجز كافة الخدمات الموضحة.',
      '2. مواعيد الدخول والمغادرة: موعد تسجيل الدخول الرسمي اعتبراً من الساعة 15:00 عصراً، وموعد المغادرة والتحرير الفندقي في تمام الساعة 12:00 ظهراً.',
      '3. سياسة تأمين الأثاث المسترد: يُحتفظ بمبلغ التأمين للوحدة ضماناً لسلامة المقتنيات والأثاث، ويتم إلغاء التفويض أو إرجاع المبلغ خلال 24 ساعة من الفحص.',
      '4. الدفع والأقساط للعقود: في العقود الشهرية والسنوية، يتلتزم المستأجر بسداد الأقساط بمواعيدها المحددة في جدول الدفعات الإلكتروني المعتمد.',
      '5. إلغاء وتعديل الحجز: يمكن إلغاء الحجز الفندقي اليومي مجاناً قبل 48 ساعة من تاريخ الوصول، وفي حال الإلغاء بعد ذلك يخصم قيمة ليلة واحدة.'
    ]
  },
  privacy: {
    title: 'سياسة الخصوصية والأمان وحماية بيانات الضيوف',
    subtitle: 'التزامنا الكامل بحماية بياناتك الشخصية وسجلات الدخول الذكي وتشفير المعاملات المالية',
    icon: ShieldCheck,
    content: [
      '1. حماية البيانات الشخصية: تلتزم شركة منزل الفخامة بعدم مشاركة أو بيع أي بيانات خاصة بالضيوف أو أرقام التواصل لأي أطراف خارجية.',
      '2. أمان القفل الذكي: أرقام السر وتفويض الدخول الرقمي للوحدات مشفرة بالكامل وتتغير تلقائياً مع كل حجز لضمان أعلى مستويات الأمان.',
      '3. التشفير المالي والامتثال: جميع المعاملات المالية وسندات التحصيل الإلكترونية معتمدة ومشفرة طبقاً لمتطلبات هيئة الزكاة والضريبة والجمارك (ZATCA).',
      '4. سجلات الامتثال والأمان: تُحفظ سجلات التدقيق (Audit Logs) لأغراض الأمان والسلامة والتحقق التشغيلي الموثق.'
    ]
  },
  regulations: {
    title: 'لوائح وأنظمة الإقامة السكنية والخدمات الفندقية',
    subtitle: 'قواعد الجوار، استخدام المواقف المظلمة والشواحن الكهربائية، والخدمات الخاصة',
    icon: Info,
    content: [
      '1. الهدوء وساعات الراحة: يُحظر إزعاج الجوار أو رفع الأصوات داخل الشقق والممرات من الساعة 23:00 مساءً حتى الساعة 07:00 صباحاً.',
      '2. الموقُف الخاص المخصص: يلتزم الضيف بإيقاف سيارته حكراً في الموقف المظلل المخصص لرقم شقته، ولا يُسمح بالوقوف في أمان الضيوف الآخرين.',
      '3. الشواحن الكهربائية (EV Charging): تتوفر محطات شحن السيارات الكهربائية للضيوف المخولين طبقاً لتعليمات الاستخدام المرفقة.',
      '4. ممنوع التدخين داخل الوحدات: جميع وحدات منزل الفخامة مغطاة بكاشفات الدخان ومحظور التدخين داخل الغرف للحفاظ على الجودة الفندقية.'
    ]
  },
  about: {
    title: 'من نحن — قصة وشغف منزل الفخامة للضيافة السكنية',
    subtitle: 'رؤيتنا في إعادة تعريف الضيافة الفاخرة التي تجمع بين خصوصية المنزل وخدمات الفنادق العالمية',
    icon: HelpCircle,
    content: [
      'تأسست شركة منزل الفخامة للضيافة العقارية (Luxury Home) لتكون الوجهة الأولى للباحثين عن تجربة سكنية متميزة في المملكة العربية السعودية.',
      'نحن ندمج بين أحدث تقنيات الدخول الذكي والراحة الفندقية الشاملة وبين دفء وخصوصية المنزل المستقل في أرقى الأحياء السكنية.',
      'تمتلك وتدير منزل الفخامة محفظة عقارية فاخرة في الرياض وجدة والدمام والخبر، مع طاقم كونسيرج مكرس لخدمة الضيوف على مدار الساعة.'
    ]
  }
};

export const FooterPageModal: React.FC<FooterPageModalProps> = ({
  pageKey,
  onClose,
}) => {
  const { state } = useAppStore();

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const pageData = state.settings.footerPages?.[pageKey] || null;
  const fallback = DEFAULT_PAGES[pageKey] || DEFAULT_PAGES['terms'];

  const title = pageData?.title || fallback.title;
  const subtitle = pageData?.subtitle || fallback.subtitle;
  const contentText = pageData?.content || fallback.content.join('\n\n');
  const IconComponent = fallback.icon;

  const paragraphs = contentText.split('\n').filter(p => p.trim().length > 0);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-hidden select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FFFCF6] w-full max-w-3xl max-h-[85dvh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-[#E3DCCD] my-auto text-right select-text animate-in fade-in"
      >
        {/* Header - Fixed */}
        <div className="p-4 sm:p-6 border-b border-[#E3DCCD] flex items-center justify-between bg-[#F7F3EB]/80 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#282824] rounded-2xl text-[#B69A68] shrink-0">
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#282824]">{title}</h3>
              {subtitle && (
                <span className="text-xs text-[#68675F] block mt-0.5">{subtitle}</span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="إغلاق النافذة"
            title="إغلاق"
            className="p-2 text-[#68675F] hover:text-[#282824] hover:bg-[#EFE9DF] rounded-full transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-8 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm text-[#282824] leading-relaxed">
          
          <div className="p-3 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD] flex items-center justify-between text-xs text-[#68675F] mb-4">
            <span>التحديث الرسمي الأخير المعتمد من الإدارة</span>
            <bdi dir="ltr" className="font-mono font-bold text-[#282824]">
              {formatDate(pageData?.lastUpdated || '2026-10-06')}
            </bdi>
          </div>

          {paragraphs.map((p: string, idx: number) => (
            <p key={idx} className="bg-white p-4 rounded-2xl border border-[#E3DCCD]/70 shadow-2xs">
              {p}
            </p>
          ))}

        </div>

        {/* Footer actions */}
        <div className="p-4 bg-[#F7F3EB]/80 border-t border-[#E3DCCD] flex justify-between items-center text-xs text-[#68675F] shrink-0">
          <span>شركة منزل الفخامة المحدودة — جميع الحقوق محفوظة 2026</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#282824] text-white font-bold rounded-xl hover:bg-[#1a1a18] transition-colors cursor-pointer"
          >
            فهمت والموافقة
          </button>
        </div>

      </div>
    </div>
  );
};
