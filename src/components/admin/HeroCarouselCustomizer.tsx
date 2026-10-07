import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import type { HeroCarouselConfig, HeroCarouselSlide } from '../../types';
import { DEFAULT_HERO_CAROUSEL } from '../../data/heroCarousel';
import { apiCall, useAppStore } from '../../store/useAppStore';

const makeSlide = (order: number): HeroCarouselSlide => ({
  ...DEFAULT_HERO_CAROUSEL.slides[0],
  id: `hero-${Date.now()}-${order}`,
  badge: 'إقامة راقية في المملكة',
  location: 'مدينة جديدة',
  title: 'أضف عنوان الوجهة',
  description: 'اكتب وصفاً موجزاً لتجربة الإقامة.',
  imageUrl: '',
  visible: true
});

export const HeroCarouselCustomizer: React.FC = () => {
  const { state, saveHeroCarousel } = useAppStore();
  const saved = (state.settings.themeConfig as any)?.heroCarousel as HeroCarouselConfig | undefined;
  const [config, setConfig] = useState<HeroCarouselConfig>(() => saved || DEFAULT_HERO_CAROUSEL);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (saved) setConfig(saved);
  }, [saved]);

  const visibleCount = useMemo(() => config.slides.filter(slide => slide.visible).length, [config.slides]);
  const updateSlide = (id: string, patch: Partial<HeroCarouselSlide>) =>
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
  const deleteSlide = (slide: HeroCarouselSlide) => {
    if (config.slides.length <= 1) {
      setMessage('يجب إبقاء شريحة واحدة على الأقل.');
      return;
    }
    if (slide.visible && visibleCount <= 1) {
      setMessage('أظهر شريحة أخرى قبل حذف آخر شريحة ظاهرة.');
      return;
    }
    if (!window.confirm(`حذف شريحة «${slide.location || slide.title}»؟`)) return;
    setConfig(current => ({ ...current, slides: current.slides.filter(item => item.id !== slide.id) }));
    setMessage('');
  };
  const uploadImage = async (slideId: string, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('اختر ملف صورة صالحاً.');
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
        base64Data, fileName: file.name, mimeType: file.type, isPrivate: false
      });
      if (!result?.url) throw new Error('لم يُرجع الخادم رابط الصورة.');
      updateSlide(slideId, { imageUrl: result.url });
      setMessage('تم رفع الصورة؛ احفظ التغييرات لنشرها على الهيرو.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر رفع الصورة.');
    } finally {
      setUploadingId(null);
    }
  };

  const save = async () => {
    if (!config.slides.length || !config.slides.some(slide => slide.visible)) {
      setMessage('أضف شريحة ظاهرة واحدة على الأقل قبل الحفظ.');
      return;
    }
    if (config.slides.some(slide => !slide.title.trim() || !slide.imageUrl.trim())) {
      setMessage('أدخل عنواناً ورابط صورة لكل شريحة قبل الحفظ.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await saveHeroCarousel({ ...config, autoplayMs: Math.min(15000, Math.max(4000, Number(config.autoplayMs) || 7000)) });
      setMessage('تم حفظ شرائح الهيرو بنجاح.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ شرائح الهيرو.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'w-full rounded-xl border border-[#E3DCCD] bg-white px-3 py-2.5 text-sm text-[#282824] outline-none focus:border-[#B69A68]';
  return (
    <section className="space-y-5 rounded-3xl border border-[#E3DCCD] bg-white p-5 text-right shadow-xs sm:p-6">
      <header className="flex flex-col justify-between gap-3 border-b border-[#E3DCCD] pb-4 sm:flex-row sm:items-center">
        <div><h3 className="font-bold text-base text-[#282824]">الهيرو المتحرك والشرائح</h3><p className="mt-1 text-xs leading-6 text-[#68675F]">أضف الشرائح، عدّل نصوصها وصورها، رتّبها، أو أخفها واحذفها. التغييرات لا تظهر للزوار قبل الحفظ.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfig(current => ({ ...current, slides: [...current.slides, makeSlide(current.slides.length + 1)] }))} className="inline-flex items-center gap-2 rounded-xl border border-[#B69A68]/50 px-4 py-2.5 font-bold text-[#282824] hover:bg-[#F7F3EB]"><Plus className="h-4 w-4" />إضافة شريحة</button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#282824] px-4 py-2.5 font-bold text-white disabled:opacity-60"><Save className="h-4 w-4 text-[#C8A96B]" />{saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</button>
        </div>
      </header>
      <label className="flex max-w-sm items-center gap-3 text-sm font-semibold text-[#282824]">مدة الانتقال التلقائي
        <select className={fieldClass} value={config.autoplayMs} onChange={event => setConfig(current => ({ ...current, autoplayMs: Number(event.target.value) }))}>
          {[5000, 7000, 9000, 12000].map(ms => <option key={ms} value={ms}>{ms / 1000} ثوانٍ</option>)}
        </select>
      </label>
      <div className="space-y-4">
        {config.slides.map((slide, index) => (
          <article key={slide.id} className="rounded-2xl border border-[#E3DCCD] bg-[#FFFCF6] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">الشريحة {index + 1}{slide.location ? ` · ${slide.location}` : ''}</strong>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveSlide(index, -1)} disabled={!index} aria-label="تحريك لأعلى" className="rounded-lg p-2 hover:bg-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => moveSlide(index, 1)} disabled={index === config.slides.length - 1} aria-label="تحريك لأسفل" className="rounded-lg p-2 hover:bg-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => updateSlide(slide.id, { visible: !slide.visible })} aria-label={slide.visible ? 'إخفاء الشريحة' : 'إظهار الشريحة'} className="rounded-lg p-2 hover:bg-white">{slide.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                <button type="button" onClick={() => deleteSlide(slide)} aria-label="حذف الشريحة" className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold">شارة الشريحة<input className={fieldClass} value={slide.badge} onChange={e => updateSlide(slide.id, { badge: e.target.value })} /></label>
              <label className="space-y-1 text-xs font-semibold">المدينة / الموقع<input className={fieldClass} value={slide.location} onChange={e => updateSlide(slide.id, { location: e.target.value })} /></label>
              <label className="space-y-1 text-xs font-semibold md:col-span-2">العنوان<textarea rows={2} className={fieldClass} value={slide.title} onChange={e => updateSlide(slide.id, { title: e.target.value })} /></label>
              <label className="space-y-1 text-xs font-semibold md:col-span-2">الوصف<textarea rows={3} className={fieldClass} value={slide.description} onChange={e => updateSlide(slide.id, { description: e.target.value })} /></label>
              <div className="space-y-1 text-xs font-semibold md:col-span-2"><label>رابط الصورة<input dir="ltr" type="url" className={fieldClass} placeholder="https://..." value={slide.imageUrl} onChange={e => updateSlide(slide.id, { imageUrl: e.target.value })} /></label><div className="mt-2 flex items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#E3DCCD] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#F7F3EB]"><ImagePlus className="h-4 w-4" />{uploadingId === slide.id ? 'جارٍ رفع الصورة...' : 'رفع صورة'}<input type="file" accept="image/*" className="sr-only" disabled={uploadingId === slide.id} onChange={e => { void uploadImage(slide.id, e.target.files?.[0]); e.currentTarget.value = ''; }} /></label><span className="text-[11px] font-normal text-[#68675F]">أو الصق رابط الصورة المباشر.</span></div></div>
              <label className="space-y-1 text-xs font-semibold">نص زر الوحدات<input className={fieldClass} value={slide.primaryLabel} onChange={e => updateSlide(slide.id, { primaryLabel: e.target.value })} /></label>
              <label className="space-y-1 text-xs font-semibold">نص زر المباني<input className={fieldClass} value={slide.secondaryLabel} onChange={e => updateSlide(slide.id, { secondaryLabel: e.target.value })} /></label>
              <label className="space-y-1 text-xs font-semibold">اللون البارز<input dir="ltr" type="color" className="h-11 w-full rounded-xl border border-[#E3DCCD] bg-white p-1" value={slide.accentColor || '#C8A96B'} onChange={e => updateSlide(slide.id, { accentColor: e.target.value })} /></label>
              <label className="space-y-1 text-xs font-semibold">قوة تعتيم الصورة ({Math.round((slide.overlayOpacity ?? .64) * 100)}%)<input type="range" min="0.25" max="0.85" step="0.01" className="w-full accent-[#B69A68]" value={slide.overlayOpacity ?? .64} onChange={e => updateSlide(slide.id, { overlayOpacity: Number(e.target.value) })} /></label>
            </div>
          </article>
        ))}
      </div>
      {message && <div role="status" className="rounded-xl border border-[#B69A68]/30 bg-[#F7F3EB] p-3 text-sm font-semibold text-[#282824]">{message}</div>}
    </section>
  );
};
