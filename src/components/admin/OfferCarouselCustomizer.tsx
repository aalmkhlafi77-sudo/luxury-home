import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import type { OfferCarouselConfig, OfferCarouselSlide } from '../../types';
import { createDefaultOfferCarousel } from '../../data/offerCarousel';
import { apiCall, useAppStore } from '../../store/useAppStore';

const makeSlide = (index: number): OfferCarouselSlide => ({
  id: `offer-${Date.now()}-${index}`,
  label: 'عنوان المبنى أو المدينة',
  imageUrl: '',
  visible: true,
});

export const OfferCarouselCustomizer: React.FC = () => {
  const { state, saveOfferCarousel } = useAppStore();
  const section = state.contentSections.find(item => item.sectionKey === 'offers');
  const saved = (state.settings.themeConfig as any)?.offersCarousel as OfferCarouselConfig | undefined;
  const defaults = useMemo(
    () => createDefaultOfferCarousel(state.properties, {
      imageUrl: section?.mediaUrl,
      title: section?.title,
      description: section?.subtitle,
    }),
    [state.properties, section?.mediaUrl, section?.title, section?.subtitle],
  );
  const [config, setConfig] = useState<OfferCarouselConfig>(() => saved || defaults);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (saved) setConfig(saved);
    else setConfig(defaults);
  }, [saved, defaults]);

  const visibleCount = useMemo(() => config.slides.filter(slide => slide.visible && slide.imageUrl.trim()).length, [config.slides]);
  const updateSlide = (id: string, patch: Partial<OfferCarouselSlide>) =>
    setConfig(current => ({ ...current, slides: current.slides.map(slide => slide.id === id ? { ...slide, ...patch } : slide) }));

  const moveSlide = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= config.slides.length) return;
    setConfig(current => {
      const slides = [...current.slides];
      [slides[index], slides[target]] = [slides[target], slides[index]];
      return { ...current, slides };
    });
  };

  const deleteSlide = (slide: OfferCarouselSlide) => {
    if (slide.visible && visibleCount <= 1) {
      setMessage('أظهر شريحة أخرى قبل حذف آخر شريحة ظاهرة.');
      return;
    }
    if (!window.confirm(`حذف الشريحة «${slide.label}»؟`)) return;
    setConfig(current => ({ ...current, slides: current.slides.filter(item => item.id !== slide.id) }));
    setMessage('');
  };

  const uploadImage = async (slideId: string, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('اختر ملف صورة صالحاً.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setMessage('حجم الصورة يتجاوز الحد المسموح (15 ميغابايت).');
      return;
    }
    setUploadingId(slideId);
    setMessage('');
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('تعذر قراءة الصورة.'));
        reader.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
        reader.readAsDataURL(file);
      });
      const result = await apiCall('/api/media/upload', 'POST', {
        base64Data, fileName: file.name, mimeType: file.type, isPrivate: false,
      });
      if (!result?.url) throw new Error('لم يُرجع الخادم رابط الصورة.');
      updateSlide(slideId, { imageUrl: result.url });
      setMessage('رُفعت الصورة. احفظ التغييرات لإظهارها للزوار.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر رفع الصورة.');
    } finally {
      setUploadingId(null);
    }
  };

  const save = async () => {
    if (!config.title.trim() || !config.description.trim() || !config.buttonLabel.trim()) {
      setMessage('أكمل نصوص العرض والزر قبل الحفظ.');
      return;
    }
    if (!config.slides.length || !config.slides.some(slide => slide.visible && slide.imageUrl.trim())) {
      setMessage('أضف صورة واحدة ظاهرة على الأقل قبل الحفظ.');
      return;
    }
    if (config.slides.some(slide => slide.visible && !slide.label.trim())) {
      setMessage('أدخل عنواناً لكل شريحة ظاهرة.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await saveOfferCarousel({
        ...config,
        autoplayMs: Math.min(12000, Math.max(4000, Number(config.autoplayMs) || 6500)),
        slides: config.slides.map(slide => ({ ...slide, label: slide.label.trim(), imageUrl: slide.imageUrl.trim() })),
      });
      setMessage('تم حفظ سلايدر العروض بنجاح.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ السلايدر.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'w-full rounded-xl border border-[#E3DCCD] bg-white px-3 py-2.5 text-sm text-[#282824] outline-none focus:border-[#B69A68]';
  return (
    <section className="space-y-5 rounded-3xl border border-[#E3DCCD] bg-white p-5 text-right shadow-xs sm:p-6">
      <header className="flex flex-col justify-between gap-3 border-b border-[#E3DCCD] pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-bold text-base text-[#282824]">سلايدر عروض المباني</h3>
          <p className="mt-1 text-xs leading-6 text-[#68675F]">إدارة الصور وترتيبها ونص العرض. تظهر التغييرات للزوار بعد الحفظ.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfig(current => ({ ...current, slides: [...current.slides, makeSlide(current.slides.length + 1)] }))} className="inline-flex items-center gap-2 rounded-xl border border-[#B69A68]/50 px-4 py-2.5 font-bold text-[#282824] hover:bg-[#F7F3EB]"><Plus className="h-4 w-4" />إضافة صورة</button>
          <button type="button" onClick={() => { void save(); }} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#282824] px-4 py-2.5 font-bold text-white disabled:opacity-60"><Save className="h-4 w-4 text-[#C8A96B]" />{saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold">الشارة<input className={fieldClass} value={config.badge} onChange={e => setConfig(current => ({ ...current, badge: e.target.value }))} /></label>
        <label className="space-y-1 text-xs font-semibold">نص زر التواصل<input className={fieldClass} value={config.buttonLabel} onChange={e => setConfig(current => ({ ...current, buttonLabel: e.target.value }))} /></label>
        <label className="space-y-1 text-xs font-semibold md:col-span-2">عنوان العرض<textarea rows={2} className={fieldClass} value={config.title} onChange={e => setConfig(current => ({ ...current, title: e.target.value }))} /></label>
        <label className="space-y-1 text-xs font-semibold md:col-span-2">وصف العرض<textarea rows={3} className={fieldClass} value={config.description} onChange={e => setConfig(current => ({ ...current, description: e.target.value }))} /></label>
      </div>

      <label className="flex max-w-sm items-center gap-3 text-sm font-semibold text-[#282824]">مدة الانتقال التلقائي
        <select className={fieldClass} value={config.autoplayMs} onChange={event => setConfig(current => ({ ...current, autoplayMs: Number(event.target.value) }))}>
          {[4500, 6500, 8500, 11000].map(ms => <option key={ms} value={ms}>{ms / 1000} ثوانٍ</option>)}
        </select>
      </label>

      <div className="space-y-4">
        {config.slides.map((slide, index) => (
          <article key={slide.id} className="rounded-2xl border border-[#E3DCCD] bg-[#FFFCF6] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">الصورة {index + 1}</strong>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveSlide(index, -1)} disabled={!index} aria-label="تحريك لأعلى" className="rounded-lg p-2 hover:bg-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => moveSlide(index, 1)} disabled={index === config.slides.length - 1} aria-label="تحريك لأسفل" className="rounded-lg p-2 hover:bg-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => updateSlide(slide.id, { visible: !slide.visible })} aria-label={slide.visible ? 'إخفاء الشريحة' : 'إظهار الشريحة'} className="rounded-lg p-2 hover:bg-white">{slide.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                <button type="button" onClick={() => deleteSlide(slide)} aria-label="حذف الشريحة" className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold md:col-span-2">اسم المبنى أو المدينة<input className={fieldClass} value={slide.label} onChange={e => updateSlide(slide.id, { label: e.target.value })} /></label>
              <div className="space-y-2 md:col-span-2">
                <label className="block text-xs font-semibold">رابط الصورة<input dir="ltr" type="url" className={fieldClass} placeholder="https://..." value={slide.imageUrl} onChange={e => updateSlide(slide.id, { imageUrl: e.target.value })} /></label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#E3DCCD] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#F7F3EB]"><ImagePlus className="h-4 w-4" />{uploadingId === slide.id ? 'جارٍ رفع الصورة...' : 'رفع أو استبدال الصورة'}<input type="file" accept="image/*" className="sr-only" disabled={uploadingId === slide.id} onChange={e => { void uploadImage(slide.id, e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} /></label>
                  <span className="text-[11px] text-[#68675F]">حتى 15 ميغابايت</span>
                </div>
              </div>
              {slide.imageUrl && <img src={slide.imageUrl} alt={slide.label} className="h-40 w-full rounded-xl border border-[#E3DCCD] object-cover md:col-span-2" />}
            </div>
          </article>
        ))}
      </div>

      {message && <p role="status" className="rounded-xl bg-[#F7F3EB] px-4 py-3 text-sm text-[#282824]">{message}</p>}
    </section>
  );
};
