import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Compass, Copy, Eye, MapPin, Minus, Navigation, Pencil, Plus, Save, Search, Share2, Trash2, X } from 'lucide-react';
import { MapLocation, MapSectionSettings } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import {
  ACTIVITY_CATEGORIES,
  ActivityCategory,
  MapSearchResult,
  findNearbyActivities,
  resolveBrowserOrIpLocation,
  searchMapPlaces,
} from '../public/BuildingMapSection';
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
      link.crossOrigin = 'anonymous';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const existing = document.getElementById('luxury-leaflet-js') as HTMLScriptElement | null;
    if (existing) {
      if (window.L) {
        resolve(window.L);
        return;
      }
      existing.addEventListener('load', () => window.L ? resolve(window.L) : reject(new Error('تعذر تحميل مكتبة الخريطة.')), { once: true });
      existing.addEventListener('error', () => {
        window.__luxuryLeafletPromise = undefined;
        reject(new Error('تعذر الاتصال بمكتبة الخريطة.'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'luxury-leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => window.L ? resolve(window.L) : reject(new Error('تعذر تحميل مكتبة الخريطة.'));
    script.onerror = () => {
      window.__luxuryLeafletPromise = undefined;
      reject(new Error('تعذر الاتصال بمكتبة الخريطة.'));
    };
    document.head.appendChild(script);
  });
  return window.__luxuryLeafletPromise;
}

function googleMapsLocationUrl(latitude: number, longitude: number): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(latitude + ',' + longitude);
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('تعذر نسخ الرابط من هذا المتصفح.');
}

async function shareOrCopyMapLocation(title: string, latitude: number, longitude: number): Promise<'shared' | 'copied'> {
  const url = googleMapsLocationUrl(latitude, longitude);
  if (navigator.share) {
    try {
      await navigator.share({ title, text: 'موقع ' + title, url });
      return 'shared';
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return 'shared';
    }
  }
  await copyTextToClipboard(url);
  return 'copied';
}

type MapBaseLayerId = 'street' | 'terrain' | 'satellite';
const MAP_BASE_LAYERS: Record<MapBaseLayerId, { title: string; url: string; maxZoom: number; attribution: string; subdomains?: string }> = {
  street: { title: 'عادية', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>' },
  terrain: { title: 'تضاريس', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', maxZoom: 17, subdomains: 'abc', attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)' },
  satellite: { title: 'قمر صناعي', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, attribution: 'Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community' },
};

function createMapBaseLayer(L: any, id: MapBaseLayerId): any {
  const source = MAP_BASE_LAYERS[id] || MAP_BASE_LAYERS.street;
  const options: Record<string, any> = {
    maxZoom: source.maxZoom,
    attribution: source.attribution,
  };
  if (source.subdomains) {
    options.subdomains = source.subdomains;
  }
  return L.tileLayer(source.url, options);
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
  const savedMarkersRef = useRef<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MapSearchResult[]>([]);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationActionMessage, setLocationActionMessage] = useState('');
  const [baseLayerId, setBaseLayerId] = useState<MapBaseLayerId>('street');
  const baseLayerIdRef = useRef<MapBaseLayerId>('street');
  const baseLayerRef = useRef<any>(null);
  const currentLocationLayersRef = useRef<any[]>([]);
  const activityMarkersRef = useRef<any[]>([]);
  const [selectedActivityCategories, setSelectedActivityCategories] = useState<ActivityCategory[]>(['food', 'health', 'shopping', 'entertainment']);
  const [activityMessage, setActivityMessage] = useState('');
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isMobileActivitiesOpen, setIsMobileActivitiesOpen] = useState(false);

  const properties = useMemo(
    () => state.properties.filter(property => property.status !== 'unlisted'),
    [state.properties],
  );

  const localSearchCandidates = useMemo<MapSearchResult[]>(() => {
    const candidates: MapSearchResult[] = [];
    settings.locations.forEach(loc => {
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      candidates.push({
        name: loc.title,
        label: [loc.title, loc.description].filter(Boolean).join('، '),
        latitude: lat,
        longitude: lng,
        badge: 'موقع مسجل',
        propertyId: loc.propertyId,
      });
    });

    properties.forEach(property => {
      const lat = Number(property.latitude);
      const lng = Number(property.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (candidates.some(c => c.propertyId === property.id)) return;
      candidates.push({
        name: property.name,
        label: [property.name, property.city, property.district, property.address].filter(Boolean).join('، '),
        latitude: lat,
        longitude: lng,
        badge: 'مبنى',
        propertyId: property.id,
      });
    });

    return candidates;
  }, [settings.locations, properties]);

  useEffect(() => {
    let active = true;
    let invalidateTimer: number | undefined;
    loadLeafletForPicker().then((L) => {
      if (!active || !pickerElement.current) return;
      if (pickerMapRef.current) {
        try {
          pickerMapRef.current.stop?.();
          pickerMapRef.current.remove();
        } catch {
          // ignore cleanup error
        }
        pickerMapRef.current = null;
      }
      const map = L.map(pickerElement.current, {
        zoomControl: false,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        boxZoom: true,
        keyboard: true,
        wheelPxPerZoomLevel: 80,
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
      invalidateTimer = window.setTimeout(() => {
        if (active && pickerMapRef.current === map) {
          try {
            map.invalidateSize();
          } catch {
            // ignore if map is unmounted
          }
        }
      }, 80);
    }).catch((loadError) => {
      if (active) setError(loadError?.message || 'تعذر تحميل خريطة تحديد الموقع.');
    });

    return () => {
      active = false;
      if (invalidateTimer !== undefined) {
        window.clearTimeout(invalidateTimer);
      }
      if (pickerMapRef.current) {
        try {
          pickerMapRef.current.stop?.();
          pickerMapRef.current.remove();
        } catch {
          // ignore cleanup error
        }
        pickerMapRef.current = null;
      }
      pickerMarkerRef.current = null;
      savedMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = pickerMapRef.current;
    const L = window.L;
    if (!map || !pickerReady || !L) return;

    savedMarkersRef.current.forEach(marker => marker.remove());
    savedMarkersRef.current = [];

    settings.locations.forEach(location => {
      const lat = Number(location.latitude);
      const lng = Number(location.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const property = properties.find(p => p.id === location.propertyId);
      const title = property?.name || location.title;
      const icon = L.divIcon({
        className: 'luxury-map-pin-host',
        html: '<span class="luxury-map-pin luxury-map-pin--saved" aria-hidden="true"><span>⌖</span></span>',
        iconSize: [34, 38],
        iconAnchor: [17, 36],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      const popup = document.createElement('div');
      popup.className = 'luxury-map-popup';
      const heading = document.createElement('p');
      heading.className = 'luxury-map-popup-title';
      heading.textContent = title;
      popup.appendChild(heading);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'luxury-map-popup-action';
      editBtn.textContent = 'تعديل هذا الموقع';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editLocation(location);
        marker.closePopup();
      });
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'luxury-map-popup-actions';
      actionsWrap.appendChild(editBtn);
      popup.appendChild(actionsWrap);

      marker.bindPopup(popup);
      savedMarkersRef.current.push(marker);
    });
  }, [settings.locations, properties, pickerReady]);

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
    pickerMarkerRef.current = L.marker([latitude, longitude], { icon })
      .addTo(map)
      .bindPopup(draft.title ? `الموقع المحدد: ${draft.title}` : `الإحداثيات: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 13), { duration: 0.35 });
  }, [draft.latitude, draft.longitude, pickerReady]);

  useEffect(() => {
    setSettings({
      ...EMPTY_MAP_SETTINGS,
      ...storedSettings,
      locations: Array.isArray(storedSettings.locations) ? storedSettings.locations : [],
    });
  }, [storedSettings]);

  const resetDraft = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setError('');
  };

  const persistSettingsQuietly = async (nextSettings: MapSectionSettings, successText: string) => {
    setIsSaving(true);
    try {
      await saveMapSection(nextSettings);
      setMessage(successText);
    } catch {
      setMessage(successText + ' (اضغط زر الحفظ بالأعلى لتأكيد المزامنة).');
    } finally {
      setIsSaving(false);
    }
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

    const nextSettings: MapSectionSettings = {
      ...settings,
      locations: editingId
        ? settings.locations.map(item => item.id === editingId ? location : item)
        : [...settings.locations, location],
    };

    setSettings(nextSettings);
    const actionMsg = editingId ? 'تم تحديث الموقع وحفظه على الخريطة.' : 'تمت إضافة الموقع وحفظه على الخريطة.';
    resetDraft();
    void persistSettingsQuietly(nextSettings, actionMsg);
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

  const previewLocationOnMap = (location: MapLocation) => {
    const map = pickerMapRef.current;
    if (!map) return;
    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.flyTo([lat, lng], 15, { duration: 0.6 });
    setLocationActionMessage(`تم الانتقال إلى موقع "${location.title}" على الخريطة.`);
    window.setTimeout(() => setLocationActionMessage(''), 3000);
  };

  const removeLocation = (locationId: string) => {
    const nextSettings: MapSectionSettings = {
      ...settings,
      locations: settings.locations.filter(item => item.id !== locationId),
    };
    setSettings(nextSettings);
    if (editingId === locationId) resetDraft();
    void persistSettingsQuietly(nextSettings, 'تم حذف الموقع وتحديث الخريطة.');
  };

  const importBuildingsLocations = () => {
    const propertiesWithCoords = properties.filter(
      p => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
    );
    if (propertiesWithCoords.length === 0) {
      setError('لا توجد مبانٍ مسجلة بإحداثيات حالياً.');
      return;
    }
    const existingPropIds = new Set(settings.locations.map(l => l.propertyId).filter(Boolean));
    const imported: MapLocation[] = propertiesWithCoords
      .filter(p => !existingPropIds.has(p.id))
      .map(p => ({
        id: `map-prop-${p.id}`,
        title: p.name,
        description: [p.city, p.district, p.address].filter(Boolean).join(' · '),
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        propertyId: p.id,
        visible: true,
      }));

    if (imported.length === 0) {
      setMessage('جميع المباني المسجلة مضافة بالفعل في قائمة المواقع.');
      return;
    }

    const nextSettings: MapSectionSettings = {
      ...settings,
      locations: [...settings.locations, ...imported],
    };
    setSettings(nextSettings);
    void persistSettingsQuietly(nextSettings, `تم استيراد ${imported.length} موقع مبنى وحفظها.`);
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
    const map = pickerMapRef.current;
    const L = window.L;
    baseLayerIdRef.current = next;
    setBaseLayerId(next);
    if (!map || !L) return;
    baseLayerRef.current?.removeFrom(map);
    baseLayerRef.current = createMapBaseLayer(L, next).addTo(map);
  };

  const locateCurrentPosition = async () => {
    const map = pickerMapRef.current;
    const L = window.L;
    if (!map || !L || isLocating) return;
    setIsLocating(true);
    setLocationActionMessage('جارٍ تحديد موقعك…');
    try {
      const pos = await resolveBrowserOrIpLocation();
      const lat = pos.latitude;
      const lng = pos.longitude;
      const latlng = L.latLng(lat, lng);
      currentLocationLayersRef.current.forEach((layer: any) => layer.remove());
      const marker = L.circleMarker(latlng, {
        radius: 8,
        color: '#fff',
        weight: 3,
        fillColor: '#2878D0',
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup(pos.source === 'gps' ? 'موقعك الحالي الدقيق' : 'موقعك التقريبي الحالي');

      currentLocationLayersRef.current = [
        L.circle(latlng, {
          radius: Math.min(Math.max(pos.accuracy || 35, 25), 1200),
          color: '#2878D0',
          weight: 1,
          fillColor: '#2878D0',
          fillOpacity: 0.12,
        }).addTo(map),
        marker,
      ];
      setDraft(current => ({
        ...current,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }));
      map.flyTo(latlng, pos.source === 'gps' ? Math.max(map.getZoom(), 15) : Math.max(map.getZoom(), 13), { duration: 0.6 });
      marker.openPopup();
      setLocationActionMessage(pos.source === 'gps' ? 'تم تحديد موقعك وتعيين إحداثياته في النموذج.' : 'تم تحديد موقعك التقريبي وتعيين إحداثياته في النموذج.');
    } catch (err: any) {
      setLocationActionMessage(err?.message || 'تعذر تحديد موقعك. تحقق من إذن الموقع.');
    } finally {
      setIsLocating(false);
      window.setTimeout(() => setLocationActionMessage(''), 4000);
    }
  };

  const runNearbyActivitiesSearch = async (categoriesToFetch: ActivityCategory[]) => {
    const map = pickerMapRef.current;
    const L = window.L;
    if (!map || !L) return;
    if (!categoriesToFetch.length) {
      activityMarkersRef.current.forEach((marker: any) => marker.remove());
      activityMarkersRef.current = [];
      setActivityMessage('حدد فئة واحدة على الأقل لإظهار الأنشطة.');
      window.setTimeout(() => setActivityMessage(''), 3500);
      return;
    }
    setIsLoadingActivities(true);
    setActivityMessage('جارٍ البحث عن الأنشطة القريبة…');
    activityMarkersRef.current.forEach((marker: any) => marker.remove());
    activityMarkersRef.current = [];
    try {
      let center = map.getCenter();
      if (map.getZoom() < 10) {
        const draftLat = Number(draft.latitude);
        const draftLng = Number(draft.longitude);
        if (draft.latitude && draft.longitude && Number.isFinite(draftLat) && Number.isFinite(draftLng)) {
          center = L.latLng(draftLat, draftLng);
        } else if (settings.locations.length > 0) {
          center = L.latLng(Number(settings.locations[0].latitude), Number(settings.locations[0].longitude));
        } else {
          center = L.latLng(24.7136, 46.6753);
        }
        map.flyTo(center, 13, { duration: 0.5 });
      }
      const radius = map.getZoom() >= 15 ? 3500 : map.getZoom() >= 13 ? 5500 : 8000;
      const places = await findNearbyActivities(categoriesToFetch, center.lat, center.lng, radius);
      places.forEach(place => {
        const style = ACTIVITY_CATEGORIES.find(item => item.id === place.category);
        const marker = L.circleMarker([place.latitude, place.longitude], {
          radius: 8,
          color: '#fff',
          weight: 2,
          fillColor: style?.color || '#347B78',
          fillOpacity: 0.95,
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
      if (places.length > 0 && map.getZoom() < 12) {
        const group = L.featureGroup(activityMarkersRef.current);
        if (group.getBounds().isValid()) {
          map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 14 });
        }
      }
      setIsMobileActivitiesOpen(false);
      setActivityMessage(places.length ? 'تم عرض ' + places.length + ' نشاطاً قريباً على الخريطة.' : 'لم نعثر على أنشطة ضمن النطاق الحالي.');
      window.setTimeout(() => setActivityMessage(''), 4000);
    } catch (error: any) {
      setActivityMessage(error?.message || 'تعذر تحميل الأنشطة القريبة.');
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const showNearbyActivities = async () => {
    await runNearbyActivitiesSearch(selectedActivityCategories);
  };

  const clearNearbyActivities = () => {
    activityMarkersRef.current.forEach((marker: any) => marker.remove());
    activityMarkersRef.current = [];
    setIsMobileActivitiesOpen(false);
    setActivityMessage('تم إخفاء الأنشطة.');
    window.setTimeout(() => setActivityMessage(''), 3000);
  };

  const applySearchResultToMap = (result: MapSearchResult, closeDropdown = true) => {
    const map = pickerMapRef.current;
    if (!map) {
      setSearchError('الخريطة لا تزال قيد التحميل. حاول بعد ظهورها.');
      return;
    }
    map.flyTo([result.latitude, result.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
    setDraft(current => ({
      ...current,
      title: current.title.trim() ? current.title : result.name,
      latitude: result.latitude.toFixed(6),
      longitude: result.longitude.toFixed(6),
    }));
    if (closeDropdown) {
      setSearchResults([]);
    }
    setSearchError('');
  };

  const searchPlaces = async () => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchError('اكتب اسم مدينة أو حي للبحث.');
      return;
    }
    setIsSearching(true);
    setSearchError('');
    try {
      const center = pickerMapRef.current?.getCenter?.();
      const results = await searchMapPlaces(
        query,
        center ? { lat: center.lat, lon: center.lng } : undefined,
        localSearchCandidates,
      );
      setSearchResults(results);
      if (!results.length) {
        setSearchError('لم نعثر على موقع مطابق. جرّب اسماً أوضح.');
      } else {
        applySearchResultToMap(results[0], results.length === 1);
      }
    } catch (error: any) {
      setSearchError(error?.message || 'تعذر البحث عن الموقع.');
    } finally {
      setIsSearching(false);
    }
  };

  const focusSearchResult = (result: MapSearchResult) => {
    applySearchResultToMap(result, true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
  };

  const shareLocation = async (location: MapLocation) => {
    try {
      const result = await shareOrCopyMapLocation(location.title, location.latitude, location.longitude);
      setLocationActionMessage(result === 'shared' ? 'تم فتح خيارات المشاركة.' : 'تم نسخ رابط الموقع.');
    } catch (error: any) {
      setLocationActionMessage(error?.message || 'تعذرت مشاركة الموقع.');
    }
    window.setTimeout(() => setLocationActionMessage(''), 3000);
  };

  const copyLocation = async (location: MapLocation) => {
    try {
      await copyTextToClipboard(googleMapsLocationUrl(location.latitude, location.longitude));
      setLocationActionMessage('تم نسخ رابط الموقع إلى الحافظة.');
    } catch (error: any) {
      setLocationActionMessage(error?.message || 'تعذر نسخ الرابط.');
    }
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
              أضف مواقع المباني أو مواقع مستقلة. ابحث عن المدينة أو الحي من رأس الخريطة، أو انقر مباشرة لتحديد النقطة؛ والموقع المرتبط بمبنى ينقل الزائر إلى بطاقته عند النقر على العلامة.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={importBuildingsLocations}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E3DCCD] bg-[#F7F3EB] px-3.5 py-2.5 text-xs font-bold text-[#282824] hover:border-[#B69A68]"
            >
              <Building2 className="h-4 w-4 text-[#B69A68]" />
              استيراد مواقع المباني
            </button>
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <form onSubmit={submitLocation} className="space-y-4 rounded-3xl border border-[#E3DCCD] bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-[#E3DCCD] pb-4">
            <h3 className="font-bold text-[#282824]">{editingId ? 'تعديل موقع' : 'إضافة موقع جديد'}</h3>
            {editingId && <button type="button" onClick={resetDraft} className="inline-flex items-center gap-1 text-xs text-[#68675F]"><X className="h-4 w-4" /> إلغاء التعديل</button>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-semibold text-[#68675F]">
              اسم الموقع *
              <input required value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="مثال: منزل الفخامة – حي الياسمين" className="w-full rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-3 text-[#282824]" />
            </label>

            <label className="block space-y-1.5 text-sm font-semibold text-[#68675F]">
              ربط ببطاقة مبنى (اختياري)
              <select value={draft.propertyId} onChange={event => {
                const propertyId = event.target.value;
                const property = properties.find(item => item.id === propertyId);
                setDraft(current => ({
                  ...current,
                  propertyId,
                  title: property && !current.title ? property.name : current.title,
                  latitude: property && !current.latitude && Number.isFinite(Number(property.latitude)) ? String(property.latitude) : current.latitude,
                  longitude: property && !current.longitude && Number.isFinite(Number(property.longitude)) ? String(property.longitude) : current.longitude,
                }));
              }} className="w-full rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-3 text-[#282824]">
                <option value="">موقع مستقل</option>
                {properties.map(property => <option key={property.id} value={property.id}>{property.name} — {property.city}</option>)}
              </select>
            </label>
          </div>

          <label className="block space-y-1.5 text-sm font-semibold text-[#68675F]">
            وصف مختصر
            <textarea rows={2} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-3 text-[#282824]" />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#68675F]">حدد الموقع من البحث في أعلى الخريطة أو بالنقر عليها *</p>
              <button type="button" onClick={() => setDraft(current => ({ ...current, latitude: '', longitude: '' }))} className="text-xs text-[#68675F] underline">مسح التحديد</button>
            </div>

            {/* Map Shell with Floating Top Header */}
            <div className="luxury-map-shell">
              <div
                className="luxury-map-floating-header"
                onMouseDown={e => e.stopPropagation()}
                onDoubleClick={e => e.stopPropagation()}
                onWheel={e => e.stopPropagation()}
              >
                <div className="luxury-map-floating-top-row">
                  <div className="luxury-map-search-toolbar">
                    <div className="luxury-map-search-input-wrap">
                      <Search className="h-4 w-4 shrink-0 text-[#9C7D46]" />
                      <input
                        value={searchQuery}
                        onChange={event => {
                          setSearchQuery(event.target.value);
                          if (searchError) setSearchError('');
                        }}
                        placeholder="ابحث عن مدينة أو حي أو إحداثيات..."
                        aria-label="البحث عن مدينة أو حي على الخريطة"
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void searchPlaces();
                          }
                        }}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={clearSearch}
                          className="luxury-map-search-clear"
                          aria-label="مسح البحث"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isSearching}
                        onClick={() => void searchPlaces()}
                        className="luxury-map-search-submit"
                      >
                        {isSearching ? 'جارٍ البحث…' : 'بحث'}
                      </button>
                    </div>
                    {searchResults.length > 0 && (
                      <div className="luxury-map-search-results" role="listbox" aria-label="نتائج البحث على الخريطة">
                        {searchResults.map((result, index) => (
                          <button key={index} type="button" onClick={() => focusSearchResult(result)}>
                            <span className="flex items-start gap-2">
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#B69A68]" />
                              <span>{result.label}</span>
                            </span>
                            {result.badge && <span className="luxury-map-search-badge">{result.badge}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="luxury-map-picker-tools">
                    <div className="luxury-map-layer-switch" role="group" aria-label="اختيار نوع الخريطة">
                      {(Object.entries(MAP_BASE_LAYERS) as [MapBaseLayerId, typeof MAP_BASE_LAYERS[MapBaseLayerId]][]).map(([id, layer]) => (
                        <button key={id} type="button" aria-pressed={baseLayerId === id} onClick={() => changeBaseLayer(id)}>
                          {layer.title}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={isLocating}
                      className="luxury-map-tool-button inline-flex items-center gap-1.5 disabled:opacity-60"
                      onClick={() => void locateCurrentPosition()}
                    >
                      <Navigation className="h-3.5 w-3.5 text-[#B69A68]" />
                      <span>{isLocating ? 'جارٍ التحديد…' : 'موقعي'}</span>
                    </button>
                    <button
                      type="button"
                      className="luxury-map-activity-dropdown-trigger"
                      aria-expanded={isMobileActivitiesOpen}
                      onClick={() => setIsMobileActivitiesOpen(open => !open)}
                    >
                      <Compass className="h-3.5 w-3.5 text-[#B69A68]" />
                      <span>الأنشطة القريبة ({selectedActivityCategories.length})</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isMobileActivitiesOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="luxury-map-activity-floating-wrap">
                  <div className={`luxury-map-activity-panel ${isMobileActivitiesOpen ? 'is-mobile-open' : ''}`}>
                    <strong>
                      <Compass className="h-4 w-4 text-[#B69A68]" />
                      <span>الأنشطة القريبة من مركز الخريطة</span>
                    </strong>
                    <div className="luxury-map-activity-options">
                      {ACTIVITY_CATEGORIES.map(category => (
                        <label key={category.id}>
                          <input
                            type="checkbox"
                            checked={selectedActivityCategories.includes(category.id)}
                            onChange={event => {
                              const nextCategories = event.target.checked
                                ? [...selectedActivityCategories, category.id]
                                : selectedActivityCategories.filter(item => item !== category.id);
                              setSelectedActivityCategories(nextCategories);
                              if (activityMarkersRef.current.length > 0) {
                                void runNearbyActivitiesSearch(nextCategories);
                              }
                            }}
                          />
                          <span>{category.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="luxury-map-activity-actions">
                      <button type="button" disabled={isLoadingActivities} onClick={() => void showNearbyActivities()}>
                        {isLoadingActivities ? 'جارٍ البحث…' : 'إظهار الأنشطة المحددة'}
                      </button>
                      <button type="button" onClick={clearNearbyActivities}>إخفاء</button>
                    </div>
                  </div>
                </div>

                {searchError && <p role="status" className="luxury-map-search-message">{searchError}</p>}
                {locationActionMessage && <p role="status" className="luxury-map-search-message">{locationActionMessage}</p>}
                {activityMessage && <p role="status" className="luxury-map-search-message">{activityMessage}</p>}
              </div>

              <div ref={pickerElement} className="luxury-map-canvas w-full" aria-label="انقر لتحديد موقع المبنى على الخريطة" role="application" />
              <div className="luxury-map-zoom" aria-label="أدوات تكبير الخريطة">
                <button type="button" aria-label="تكبير الخريطة" onClick={() => pickerMapRef.current?.zoomIn()}><Plus /></button>
                <button type="button" aria-label="تصغير الخريطة" onClick={() => pickerMapRef.current?.zoomOut()}><Minus /></button>
              </div>
            </div>

            <p className="text-xs leading-5 text-[#68675F]">
              كبّر الخريطة أو ابحث من الشريط العلوي داخل الخريطة، ثم انقر على موقع المبنى لتعيين النقطة بدقة.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="block space-y-1 text-xs font-semibold text-[#68675F]">
                خط العرض (Latitude)
                <input
                  dir="ltr"
                  value={draft.latitude}
                  onChange={event => setDraft(current => ({ ...current, latitude: event.target.value }))}
                  placeholder="24.713600"
                  className="w-full rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-2.5 text-left text-xs text-[#282824]"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-[#68675F]">
                خط الطول (Longitude)
                <input
                  dir="ltr"
                  value={draft.longitude}
                  onChange={event => setDraft(current => ({ ...current, longitude: event.target.value }))}
                  placeholder="46.675300"
                  className="w-full rounded-xl border border-[#E3DCCD] bg-[#FFFCF6] p-2.5 text-left text-xs text-[#282824]"
                />
              </label>
            </div>

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
            <p className="rounded-xl bg-[#FFFCF6] p-4 text-sm leading-6 text-[#68675F]">لا توجد مواقع بعد. أضف موقع مبنى أو نقطة مستقلة بإحداثياتها، أو اضغط "استيراد مواقع المباني" بالأعلى.</p>
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
                  <button type="button" onClick={() => previewLocationOnMap(location)} aria-label="عرض على الخريطة" title="عرض على الخريطة" className="rounded-lg p-2 text-[#68675F] hover:bg-[#EFE9DF] hover:text-[#282824]"><Eye className="h-4 w-4" /></button>
                  <button type="button" onClick={() => void copyLocation(location)} aria-label="نسخ رابط الموقع" title="نسخ رابط الموقع" className="rounded-lg p-2 text-[#68675F] hover:bg-[#EFE9DF] hover:text-[#282824]"><Copy className="h-4 w-4" /></button>
                  <button type="button" onClick={() => void shareLocation(location)} aria-label="مشاركة الموقع" title="مشاركة الموقع" className="rounded-lg p-2 text-[#68675F] hover:bg-[#EFE9DF] hover:text-[#282824]"><Share2 className="h-4 w-4" /></button>
                  <button type="button" onClick={() => editLocation(location)} aria-label="تعديل الموقع" title="تعديل الموقع" className="rounded-lg p-2 text-[#68675F] hover:bg-[#EFE9DF] hover:text-[#282824]"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => removeLocation(location.id)} aria-label="حذف الموقع" title="حذف الموقع" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </article>
            );
          })}
          <p className="pt-2 text-xs leading-5 text-[#68675F]">تُحفظ تغييرات المواقع تلقائياً، كما يمكنك الضغط على زر الحفظ أعلى الصفحة لاعتماد إعدادات العنوان والوصف.</p>
        </div>
      </div>
    </section>
  );
};
