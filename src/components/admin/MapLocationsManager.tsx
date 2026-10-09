import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, MapPin, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { MapLocation, MapSectionSettings } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import '../public/building-map.css';

declare global {
  interface Window {
    L?: any;
    __luxuryLeafletPromise?: Promise<any>;
  }
}

const EMPTY_MAP_SETTINGS: MapSectionSettings = {
  enabled: true,
  title: 'مواقعنا على الخريطة',
  subtitle: 'اكتشف مواقع مباني منزل الفخامة واختر الموقع الأقرب إليك.',
  zoom: 5,
  locations: [],
};

function loadLeafletForPicker(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);
  if (window.__luxuryLeafletPromise) return window.__luxuryLeafletPromise;

  window.__luxuryLeafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('luxury-leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'luxury-leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const existing = document.getElementById('luxury-leaflet-js') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => window.L ? resolve(window.L) : reject(new Error('تعذر تحميل مكتبة الخريطة.')), { once: true });
      existing.addEventListener('error', () => reject(new Error('تعذر الاتصال بمكتبة الخريطة.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'luxury-leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => window.L ? resolve(window.L) : reject(new Error('تعذر تحميل مكتبة الخريطة.'));
    script.onerror = () => reject(new Error('تعذر الاتصال بمكتبة الخريطة.'));
    document.head.appendChild(script);
  });
  return window.__luxuryLeafletPromise;
}

type LocationDraft = {
  title: string;
  description: string;
  latitude: string;
  longitude: string;
  propertyId: string;
  visible: boolean;
};

const EMPTY_DRAFT: LocationDraft = {
  title: '',
  description: '',
  latitude: '',
  longitude: '',
  propertyId: '',
  visible: true,
};

export const MapLocationsManager: React.FC = () => {
  const { state, saveMapSection } = useAppStore();
  const storedSettings = (state.settings.themeConfig?.mapSection as MapSectionSettings | undefined) || EMPTY_MAP_SETTINGS;
  const [settings, setSettings] = useState<MapSectionSettings>(storedSettings);
  const [draft, setDraft] = useState<LocationDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pickerReady, setPickerReady] = useState(false);
  const pickerElement = useRef<HTMLDivElement | null>(null);
  const pickerMapRef = useRef<any>(null);
  const pickerMarkerRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    loadLeafletForPicker().then((L) => {
      if (!active || !pickerElement.current) return;
      const map = L.map(pickerElement.current, { zoomControl: true, scrollWheelZoom: true }).setView([24.7136, 46.6753], 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      }).addTo(map);
      map.on('click', (event: any) => {
        setDraft(current => ({
          ...current,
          latitude: event.latlng.lat.toFixed(6),
          longitude: event.latlng.lng.toFixed(6),
        }));
      });
      pickerMapRef.current = map;
      setPickerReady(true);
      window.setTimeout(() => map.invalidateSize(), 80);
    }).catch((loadError) => {
      if (active) setError(loadError?.message || 'تعذر تحميل خريطة تحديد الموقع.');
    });

    return () => {
      active = false;
      pickerMapRef.current?.remove();
      pickerMapRef.current = null;
      pickerMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = pickerMapRef.current;
    if (!map || !pickerReady) return;
    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    if (!draft.latitude || !draft.longitude || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      pickerMarkerRef.current?.remove();
      pickerMarkerRef.current = null;
      return;
    }

    const L = window.L;
    pickerMarkerRef.current?.remove();
    const icon = L.divIcon({
      className: 'luxury-map-pin-host',
      html: '<span class="luxury-map-pin" aria-hidden="true"><span>⌖</span></span>',
      iconSize: [38, 42],
      iconAnchor: [19, 40],
    });
    pickerMarkerRef.current = L.marker([latitude, longitude], { icon }).addTo(map);
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 13), { duration: 0.35 });
  }, [draft.latitude, draft.longitude, pickerReady]);


  useEffect(() => {
    setSettings({
      ...EMPTY_MAP_SETTINGS,
      ...storedSettings,
      locations: Array.isArray(storedSettings.locations) ? storedSettings.locations : [],
    });
  }, [storedSettings]);

  const properties = useMemo(
    () => state.properties.filter(property => property.status !== 'unlisted'),
    [state.properties],
  );

  const resetDraft = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setError('');
  };

  const submitLocation = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!draft.title.trim()) {
      setError('أدخل عنوان الموقع.');
      return;
    }
    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    if (!draft.latitude || !draft.longitude || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setError('خط العرض يجب أن يكون رقماً بين -90 و90.');
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError('خط الطول يجب أن يكون رقماً بين -180 و180.');
      return;
    }
    if (draft.propertyId && !properties.some(property => property.id === draft.propertyId)) {
      setError('المبنى المحدد غير متاح. اختر مبنى صالحاً أو اجعل الموقع مستقلاً.');
      return;
    }

    const location: MapLocation = {
      id: editingId || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `map-${Date.now()}`),
      title: draft.title.trim(),
      description: draft.description.trim(),
      latitude,
      longitude,
      propertyId: draft.propertyId || undefined,
      visible: draft.visible,
    };

    setSettings(current => ({
      ...current,
      locations: editingId
        ? current.locations.map(item => item.id === editingId ? location : item)
        : [...current.locations, location],
    }));
    setMessage(editingId ? 'تم تحديث الموقع في قائمة التغييرات.' : 'أضيف الموقع إلى قائمة التغييرات.');
    resetDraft();
  };

  const editLocation = (location: MapLocation) => {
    setEditingId(location.id);
    setDraft({
      title: location.title,
      description: location.description || '',
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      propertyId: location.propertyId || '',
      visible: location.visible !== false,
    });
    setError('');
    setMessage('');
  };

  const removeLocation = (locationId: string) => {
    setSettings(current => ({
      ...current,
      locations: current.locations.filter(item => item.id !== locationId),
    }));
    if (editingId === locationId) resetDraft();
    setMessage('حذف الموقع من قائمة التغييرات. اضغط حفظ لاعتماد الحذف.');
  };

  const handleSaveSettings = async () => {
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      await saveMapSection(settings);
      setMessage('تم حفظ إعدادات الخريطة ومواقعها على الخادم.');
    } catch (err: any) {
      setError(err?.message || 'تعذر حفظ إعدادات الخريطة. بقيت التغييرات في النموذج.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section dir="rtl" className="space-y-6 text-right">
      <div className="rounded-3xl border border-[#E3DCCD] bg-white p-5 shadow-xs sm:p-7">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[#E3DCCD] pb-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#282824]">
              <MapPin className="h-5 w-5 text-[#B69A68]" />
              إدارة خريطة المواقع
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#68675F]">
              أضف مواقع المباني أو مواقع مستقلة، وحدد إحداثياتها. الموقع المرتبط بمبنى ينقل الزائر إلى بطاقة المبنى عند النقر على العلامة.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#282824] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'جارٍ الحفظ…' : 'حفظ إعدادات ومواقع الخريطة'}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold text-[#68675F]">
            عنوان قسم الخريطة
            <input value={settings.title} onChange={event => setSettings(current => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-3 text-[#282824]" />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-[#68675F]">
            مستوى العرض الافتراضي (1–18)
            <input type="number" min="1" max="18" value={settings.zoom} onChange={event => setSettings(current => ({ ...current, zoom: Math.max(1, Math.min(18, Number(event.target.value) || 5)) }))} className="w-full rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-3 text-left text-[#282824]" />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-[#68675F] sm:col-span-2">
            وصف الخريطة
            <textarea rows={2} value={settings.subtitle} onChange={event => setSettings(current => ({ ...current, subtitle: event.target.value }))} className="w-full rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-3 text-[#282824]" />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#282824] sm:col-span-2">
            <input type="checkbox" checked={settings.enabled} onChange={event => setSettings(current => ({ ...current, enabled: event.target.checked }))} className="h-4 w-4 accent-[#B69A68]" />
            إظهار الخريطة في الموقع العام
          </label>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <form onSubmit={submitLocation} className="space-y-4 rounded-3xl border border-[#E3DCCD] bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-[#E3DCCD] pb-4">
            <h3 className="font-bold text-[#282824]">{editingId ? 'تعديل موقع' : 'إضافة موقع جديد'}</h3>
            {editingId && <button type="button" onClick={resetDraft} className="inline-flex items-center gap-1 text-xs text-[#68675F]"><X className="h-4 w-4" /> إلغاء التعديل</button>}
          </div>

          <label className="block space-y-1.5 text-sm font-semibold text-[#68675F]">
            اسم الموقع *
            <input required value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="مثال: منزل الفخامة – حي الياسمين" className="w-full rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-3 text-[#282824]" />
          </label>

          <label className="block space-y-1.5 text-sm font-semibold text-[#68675F]">
            ربط ببطاقة مبنى (اختياري)
            <select value={draft.propertyId} onChange={event => {
              const propertyId = event.target.value;
              const property = properties.find(item => item.id === propertyId);
              setDraft(current => ({ ...current, propertyId, title: property && !current.title ? property.name : current.title }));
            }} className="w-full rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-3 text-[#282824]">
              <option value="">موقع مستقل</option>
              {properties.map(property => <option key={property.id} value={property.id}>{property.name} — {property.city}</option>)}
            </select>
          </label>

          <label className="block space-y-1.5 text-sm font-semibold text-[#68675F]">
            وصف مختصر
            <textarea rows={2} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-3 text-[#282824]" />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#68675F]">حدد الموقع بالنقر على الخريطة *</p>
              <button type="button" onClick={() => setDraft(current => ({ ...current, latitude: '', longitude: '' }))} className="text-xs text-[#68675F] underline">مسح التحديد</button>
            </div>
            <div ref={pickerElement} className="luxury-map-canvas w-full overflow-hidden rounded-2xl border border-[#E3DCCD]" aria-label="انقر لتحديد موقع المبنى على الخريطة" role="application" />
            <p className="text-xs leading-5 text-[#68675F]">كبّر الخريطة أو حرّكها إلى المدينة المطلوبة، ثم انقر على موقع المبنى. ستظهر العلامة على النقطة المختارة.</p>
            {draft.latitude && draft.longitude ? (
              <p dir="ltr" className="rounded-lg bg-[#F7F3EB] p-2 text-left text-xs text-[#282824]">الموقع المحدد: {draft.latitude}, {draft.longitude}</p>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">لم يتم تحديد موقع بعد.</p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#282824]">
            <input type="checkbox" checked={draft.visible} onChange={event => setDraft(current => ({ ...current, visible: event.target.checked }))} className="h-4 w-4 accent-[#B69A68]" />
            إظهار هذا الموقع للزوار
          </label>

          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E3DCCD] bg-[#F7F3EB] px-4 py-3 text-sm font-bold text-[#282824] hover:border-[#B69A68]">
            {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'تحديث الموقع في القائمة' : 'إضافة الموقع إلى القائمة'}
          </button>
        </form>

        <div className="space-y-3 rounded-3xl border border-[#E3DCCD] bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-center justify-between border-b border-[#E3DCCD] pb-4">
            <h3 className="font-bold text-[#282824]">المواقع المسجلة</h3>
            <span className="rounded-full bg-[#F7F3EB] px-3 py-1 text-xs font-bold text-[#68675F]">{settings.locations.length} موقع</span>
          </div>
          {settings.locations.length === 0 ? (
            <p className="rounded-xl bg-[#FFFCF6] p-4 text-sm leading-6 text-[#68675F]">لا توجد مواقع بعد. أضف موقع مبنى أو نقطة مستقلة بإحداثياتها، ثم احفظ الإعدادات.</p>
          ) : settings.locations.map(location => {
            const property = properties.find(item => item.id === location.propertyId);
            return (
              <article key={location.id} className="flex items-start justify-between gap-3 rounded-2xl border border-[#E3DCCD] bg-[#FFFCF6] p-4">
                <div className="min-w-0">
                  <h4 className="truncate font-bold text-[#282824]">{property?.name || location.title}</h4>
                  <p className="mt-1 text-xs text-[#68675F]">{location.propertyId ? 'مرتبط ببطاقة مبنى' : 'موقع مستقل'} · {location.visible ? 'ظاهر للزوار' : 'مخفي'}</p>
                  <p dir="ltr" className="mt-1 text-left text-xs text-[#68675F]">{location.latitude}, {location.longitude}</p>
                  {location.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#68675F]">{location.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => editLocation(location)} aria-label="تعديل الموقع" className="rounded-lg p-2 text-[#68675F] hover:bg-[#EFE9DF] hover:text-[#282824]"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => removeLocation(location.id)} aria-label="حذف الموقع" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </article>
            );
          })}
          <p className="pt-2 text-xs leading-5 text-[#68675F]">تُحفظ تغييرات الإضافة والتعديل والحذف عند الضغط على زر الحفظ أعلى الصفحة.</p>
        </div>
      </div>
    </section>
  );
};
