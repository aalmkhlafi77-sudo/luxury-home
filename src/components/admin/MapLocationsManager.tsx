import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, MapPin, Pencil, Plus, Save, Search, Share2, Trash2, X } from 'lucide-react';
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


type MapSearchResult = { name: string; label: string; latitude: number; longitude: number };

async function searchMapPlaces(query: string, center?: { lat: number; lon: number }): Promise<MapSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: '6', lang: 'ar' });
  if (center) { params.set('lat', String(center.lat)); params.set('lon', String(center.lon)); }
  const response = await fetch('https://photon.komoot.io/api/?' + params.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('تعذر البحث الآن. حاول مرة أخرى بعد قليل.');
  const data = await response.json();
  return (Array.isArray(data.features) ? data.features : []).flatMap((feature: any) => {
    const coordinates = feature?.geometry?.coordinates;
    const properties = feature?.properties || {};
    if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
    const latitude = Number(coordinates[1]), longitude = Number(coordinates[0]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const name = String(properties.name || properties.street || properties.city || properties.state || 'موقع على الخريطة');
    const label = [properties.name, properties.street, properties.city, properties.state, properties.country]
      .filter((part: unknown, index: number, values: unknown[]) => typeof part === 'string' && part.trim() && values.indexOf(part) === index)
      .join('، ') || name;
    return [{ name, label, latitude, longitude }];
  });
}
function googleMapsLocationUrl(latitude: number, longitude: number): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(latitude + ',' + longitude);
}
async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return; }
  const input = document.createElement('textarea');
  input.value = value; input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.appendChild(input); input.select();
  const copied = document.execCommand('copy'); input.remove();
  if (!copied) throw new Error('تعذر نسخ الرابط من هذا المتصفح.');
}
async function shareOrCopyMapLocation(title: string, latitude: number, longitude: number): Promise<'shared' | 'copied'> {
  const url = googleMapsLocationUrl(latitude, longitude);
  if (navigator.share) {
    try { await navigator.share({ title, text: 'موقع ' + title, url }); return 'shared'; }
    catch (error) { if ((error as DOMException)?.name === 'AbortError') return 'shared'; }
  }
  await copyTextToClipboard(url); return 'copied';
}


type ActivityCategory = 'food' | 'health' | 'shopping' | 'entertainment';
type NearbyActivity = { id: string; title: string; category: ActivityCategory; latitude: number; longitude: number };
const ACTIVITY_CATEGORIES: { id: ActivityCategory; label: string; color: string; filters: string[] }[] = [
  { id: 'food', label: 'مطاعم ومقاهٍ', color: '#C96B32', filters: ['["amenity"~"restaurant|cafe|fast_food|food_court|ice_cream"]'] },
  { id: 'health', label: 'مستشفيات وصيدليات', color: '#C74455', filters: ['["amenity"~"hospital|clinic|doctors|pharmacy"]'] },
  { id: 'shopping', label: 'مراكز تجارية', color: '#7A58A6', filters: ['["shop"~"mall|supermarket|department_store"]', '["landuse"="retail"]'] },
  { id: 'entertainment', label: 'ترفيه', color: '#347B78', filters: ['["amenity"~"cinema|theatre|nightclub|arts_centre"]', '["leisure"~"amusement_arcade|water_park|amusement_park|sports_centre"]', '["tourism"="theme_park"]'] },
];
type MapBaseLayerId = 'street' | 'terrain' | 'satellite';
const MAP_BASE_LAYERS: Record<MapBaseLayerId, { title: string; url: string; maxZoom: number; attribution: string; subdomains?: string }> = {
  street: { title: 'عادية', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>' },
  terrain: { title: 'تضاريس', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', maxZoom: 17, subdomains: 'abc', attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)' },
  satellite: { title: 'قمر صناعي', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, attribution: 'Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community' },
};
function createMapBaseLayer(L: any, id: MapBaseLayerId): any {
  const source = MAP_BASE_LAYERS[id];
  return L.tileLayer(source.url, { maxZoom: source.maxZoom, subdomains: source.subdomains, attribution: source.attribution });
}
function buildOverpassQuery(categories: ActivityCategory[], latitude: number, longitude: number, radius: number): string {
  const statements = categories.flatMap(category => {
    const config = ACTIVITY_CATEGORIES.find(item => item.id === category);
    return (config?.filters || []).map(filter => 'nwr(around:' + radius + ',' + latitude + ',' + longitude + ')' + filter + ';');
  });
  return '[out:json][timeout:20];(' + statements.join('') + ');out center tags 100;';
}
async function findNearbyActivities(categories: ActivityCategory[], latitude: number, longitude: number, radius: number): Promise<NearbyActivity[]> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' },
      body: new URLSearchParams({ data: buildOverpassQuery(categories, latitude, longitude, radius) }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('خدمة الأنشطة القريبة مشغولة حالياً. حاول مرة أخرى لاحقاً.');
    const data = await response.json();
    const items = Array.isArray(data.elements) ? data.elements : [];
    return items.flatMap((item: any) => {
      const lat = Number(item.lat ?? item.center?.lat), lon = Number(item.lon ?? item.center?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      const tags = item.tags || {};
      let category: ActivityCategory | undefined;
      if (/restaurant|cafe|fast_food|food_court|ice_cream/.test(String(tags.amenity || ''))) category = 'food';
      else if (/hospital|clinic|doctors|pharmacy/.test(String(tags.amenity || ''))) category = 'health';
      else if (/mall|supermarket|department_store/.test(String(tags.shop || '')) || tags.landuse === 'retail') category = 'shopping';
      else if (/cinema|theatre|nightclub|arts_centre/.test(String(tags.amenity || '')) || /amusement_arcade|water_park|amusement_park|sports_centre/.test(String(tags.leisure || '')) || tags.tourism === 'theme_park') category = 'entertainment';
      if (!category || !categories.includes(category)) return [];
      const title = String(tags.name || tags.brand || ACTIVITY_CATEGORIES.find(item => item.id === category)?.label || 'مكان قريب');
      return [{ id: String(item.type) + '-' + String(item.id), title, category, latitude: lat, longitude: lon }];
    }).slice(0, 100);
  } finally { window.clearTimeout(timeout); }
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MapSearchResult[]>([]);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [locationActionMessage, setLocationActionMessage] = useState('');
  const [baseLayerId, setBaseLayerId] = useState<MapBaseLayerId>('street');
  const baseLayerIdRef = useRef<MapBaseLayerId>('street');
  const baseLayerRef = useRef<any>(null);
  const currentLocationLayersRef = useRef<any[]>([]);
  const activityMarkersRef = useRef<any[]>([]);
  const [selectedActivityCategories, setSelectedActivityCategories] = useState<ActivityCategory[]>(['food', 'health', 'shopping', 'entertainment']);
  const [activityMessage, setActivityMessage] = useState('');
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  useEffect(() => {
    let active = true;
    loadLeafletForPicker().then((L) => {
      if (!active || !pickerElement.current) return;
      const map = L.map(pickerElement.current, {
        zoomControl: true, scrollWheelZoom: true, doubleClickZoom: true,
        touchZoom: true, boxZoom: true, keyboard: true, wheelPxPerZoomLevel: 80,
      }).setView([24.7136, 46.6753], 5);
      baseLayerRef.current = createMapBaseLayer(L, baseLayerIdRef.current).addTo(map);
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

  const changeBaseLayer = (next: MapBaseLayerId) => {
    const map = pickerMapRef.current, L = window.L;
    baseLayerIdRef.current = next;
    setBaseLayerId(next);
    if (!map || !L) return;
    baseLayerRef.current?.removeFrom(map);
    baseLayerRef.current = createMapBaseLayer(L, next).addTo(map);
  };
  const locateCurrentPosition = () => {
    const map = pickerMapRef.current, L = window.L;
    if (!map) return;
    if (!navigator.geolocation) { setLocationActionMessage('خدمة تحديد الموقع غير متاحة في هذا المتصفح.'); return; }
    setLocationActionMessage('جارٍ تحديد موقعك…');
    map.once('locationfound', (event: any) => {
      currentLocationLayersRef.current.forEach((layer: any) => layer.remove());
      currentLocationLayersRef.current = [
        L.circle(event.latlng, { radius: event.accuracy, color: '#2878D0', weight: 1, fillColor: '#2878D0', fillOpacity: 0.12 }).addTo(map),
        L.circleMarker(event.latlng, { radius: 7, color: '#fff', weight: 3, fillColor: '#2878D0', fillOpacity: 1 }).addTo(map).bindPopup('موقعك الحالي'),
      ];
      map.flyTo(event.latlng, Math.max(map.getZoom(), 15), { duration: 0.6 });
      setLocationActionMessage('تم تحديد موقعك على هذه الشاشة فقط.');
    });
    map.once('locationerror', () => setLocationActionMessage('تعذر تحديد موقعك. تحقق من إذن الموقع واتصال HTTPS.'));
    map.locate({ setView: false, enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  };
  const showNearbyActivities = async () => {
    const map = pickerMapRef.current, L = window.L;
    if (!map || !L) return;
    if (!selectedActivityCategories.length) { setActivityMessage('حدد فئة واحدة على الأقل.'); return; }
    setIsLoadingActivities(true); setActivityMessage('');
    activityMarkersRef.current.forEach((marker: any) => marker.remove());
    activityMarkersRef.current = [];
    try {
      const center = map.getCenter();
      const radius = map.getZoom() >= 15 ? 2500 : map.getZoom() >= 13 ? 5000 : 8000;
      const places = await findNearbyActivities(selectedActivityCategories, center.lat, center.lng, radius);
      places.forEach(place => {
        const style = ACTIVITY_CATEGORIES.find(item => item.id === place.category);
        const marker = L.circleMarker([place.latitude, place.longitude], {
          radius: 7, color: '#fff', weight: 2, fillColor: style?.color || '#347B78', fillOpacity: 0.95,
        }).addTo(map);
        const popup = document.createElement('div');
        popup.className = 'luxury-map-popup';
        const title = document.createElement('p');
        title.className = 'luxury-map-popup-title';
        title.textContent = place.title;
        const type = document.createElement('p');
        type.className = 'luxury-map-popup-description';
        type.textContent = style?.label || 'نشاط قريب';
        popup.append(title, type);
        marker.bindPopup(popup);
        activityMarkersRef.current.push(marker);
      });
      setActivityMessage(places.length ? 'تم عرض ' + places.length + ' موقعاً قريباً.' : 'لم نعثر على أنشطة ضمن النطاق الحالي.');
    } catch (error: any) { setActivityMessage(error?.name === 'AbortError' ? 'انتهت مهلة البحث عن الأنشطة. حرّك الخريطة وجرّب مجدداً.' : (error?.message || 'تعذر تحميل الأنشطة القريبة.')); }
    finally { setIsLoadingActivities(false); }
  };
  const clearNearbyActivities = () => {
    activityMarkersRef.current.forEach((marker: any) => marker.remove());
    activityMarkersRef.current = [];
    setActivityMessage('تم إخفاء الأنشطة.');
  };

  const searchPlaces = async (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) { setSearchError('اكتب اسم مدينة أو حي للبحث.'); return; }
    setIsSearching(true); setSearchError('');
    try {
      const center = pickerMapRef.current?.getCenter?.();
      const results = await searchMapPlaces(query, center ? { lat: center.lat, lon: center.lng } : undefined);
      setSearchResults(results);
      if (!results.length) setSearchError('لم نعثر على موقع مطابق. جرّب اسماً أوضح.');
    } catch (error: any) { setSearchError(error?.message || 'تعذر البحث عن الموقع.'); }
    finally { setIsSearching(false); }
  };
  const focusSearchResult = (result: MapSearchResult) => {
    const map = pickerMapRef.current;
    if (!map) return;
    map.flyTo([result.latitude, result.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
    setDraft(current => ({ ...current, latitude: result.latitude.toFixed(6), longitude: result.longitude.toFixed(6) }));
    setSearchResults([]); setSearchError('');
  };
  const shareLocation = async (location: MapLocation) => {
    try {
      const result = await shareOrCopyMapLocation(location.title, location.latitude, location.longitude);
      setLocationActionMessage(result === 'shared' ? 'تم فتح خيارات المشاركة.' : 'تم نسخ رابط الموقع.');
    } catch (error: any) { setLocationActionMessage(error?.message || 'تعذرت مشاركة الموقع.'); }
    window.setTimeout(() => setLocationActionMessage(''), 3000);
  };
  const copyLocation = async (location: MapLocation) => {
    try {
      await copyTextToClipboard(googleMapsLocationUrl(location.latitude, location.longitude));
      setLocationActionMessage('تم نسخ رابط الموقع إلى الحافظة.');
    } catch (error: any) { setLocationActionMessage(error?.message || 'تعذر نسخ الرابط.'); }
    window.setTimeout(() => setLocationActionMessage(''), 3000);
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
              أضف مواقع المباني أو مواقع مستقلة. ابحث عن المدينة أو الحي، ثم انقر على الخريطة لتحديد النقطة؛ والموقع المرتبط بمبنى ينقل الزائر إلى بطاقته عند النقر على العلامة.
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
            <div className="luxury-map-picker-tools">
              <div className="luxury-map-layer-switch" role="group" aria-label="اختيار نوع الخريطة">
                {(Object.entries(MAP_BASE_LAYERS) as [MapBaseLayerId, typeof MAP_BASE_LAYERS[MapBaseLayerId]][]).map(([id, layer]) => (
                  <button key={id} type="button" aria-pressed={baseLayerId === id} onClick={() => changeBaseLayer(id)}>{layer.title}</button>
                ))}
              </div>
              <button type="button" className="luxury-map-tool-button" onClick={locateCurrentPosition}>موقعي</button>
            </div>
            <div className="luxury-map-activity-panel">
              <strong>الأنشطة القريبة من مركز الخريطة</strong>
              <div className="luxury-map-activity-options">
                {ACTIVITY_CATEGORIES.map(category => (
                  <label key={category.id}><input type="checkbox" checked={selectedActivityCategories.includes(category.id)} onChange={event => setSelectedActivityCategories(current => event.target.checked ? [...current, category.id] : current.filter(item => item !== category.id))} /><span>{category.label}</span></label>
                ))}
              </div>
              <div className="luxury-map-activity-actions">
                <button type="button" disabled={isLoadingActivities} onClick={() => void showNearbyActivities()}>{isLoadingActivities ? 'جارٍ البحث…' : 'إظهار الأنشطة المحددة'}</button>
                <button type="button" onClick={clearNearbyActivities}>إخفاء</button>
              </div>
              <small>البحث ضمن نطاق محلي حول مركز الخريطة فقط.</small>
              {activityMessage && <p role="status" className="luxury-map-search-message">{activityMessage}</p>}
            </div>
            <form onSubmit={searchPlaces} className="space-y-2">
              <div className="flex gap-2 rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-2">
                <Search className="mt-2 h-4 w-4 shrink-0 text-[#9C7D46]" />
                <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="ابحث عن مدينة أو حي..." aria-label="البحث عن مدينة أو حي على الخريطة" className="min-w-0 flex-1 bg-transparent p-1 text-sm text-[#282824] outline-none" />
                <button type="submit" disabled={isSearching} className="rounded-lg bg-[#282824] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{isSearching ? 'جارٍ البحث…' : 'بحث'}</button>
              </div>
              <p className="text-[11px] text-[#68675F]">البحث بواسطة Photon · بيانات OpenStreetMap</p>
              {searchError && <p role="status" className="text-xs text-rose-700">{searchError}</p>}
              {searchResults.length > 0 && <div className="max-h-48 overflow-y-auto rounded-xl border border-[#E3DCCD] bg-white">
                {searchResults.map((result, index) => (
                  <button key={index} type="button" onClick={() => focusSearchResult(result)} className="flex w-full items-start gap-2 border-b border-[#EEE8DD] p-3 text-right text-xs text-[#282824] last:border-0 hover:bg-[#F7F3EB]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#B69A68]" /><span>{result.label}</span>
                  </button>
                ))}
              </div>}
            </form>
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
          {locationActionMessage && <p role="status" className="rounded-lg bg-[#F7F3EB] p-2 text-xs text-[#282824]">{locationActionMessage}</p>}
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
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <button type="button" onClick={() => void copyLocation(location)} aria-label="نسخ رابط الموقع" title="نسخ رابط الموقع" className="rounded-lg p-2 text-[#68675F] hover:bg-[#EFE9DF] hover:text-[#282824]"><Copy className="h-4 w-4" /></button>
                  <button type="button" onClick={() => void shareLocation(location)} aria-label="مشاركة الموقع" title="مشاركة الموقع" className="rounded-lg p-2 text-[#68675F] hover:bg-[#EFE9DF] hover:text-[#282824]"><Share2 className="h-4 w-4" /></button>
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
