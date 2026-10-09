import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Minus, Plus, Search } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { MapLocation, MapSectionSettings, Property } from '../../types';
import './building-map.css';

declare global {
  interface Window {
    L?: any;
    __luxuryLeafletPromise?: Promise<any>;
  }
}

const DEFAULT_MAP_SECTION: MapSectionSettings = {
  enabled: true,
  title: 'مواقعنا على الخريطة',
  subtitle: 'اكتشف مواقع مباني منزل الفخامة واختر الموقع الأقرب إليك.',
  zoom: 5,
  locations: [],
};

function loadLeaflet(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);
  if (window.__luxuryLeafletPromise) return window.__luxuryLeafletPromise;

  window.__luxuryLeafletPromise = new Promise((resolve, reject) => {
    const styleId = 'luxury-leaflet-css';
    if (!document.getElementById(styleId)) {
      const link = document.createElement('link');
      link.id = styleId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const scriptId = 'luxury-leaflet-js';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => window.L ? resolve(window.L) : reject(new Error('تعذر تحميل مكتبة الخريطة.')), { once: true });
      existing.addEventListener('error', () => reject(new Error('تعذر الاتصال بمكتبة الخريطة.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
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

interface MapRow {
  location: MapLocation;
  property?: Property;
}

export const BuildingMapSection: React.FC = () => {
  const { state } = useAppStore();
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [mapError, setMapError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MapSearchResult[]>([]);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const searchMarkerRef = useRef<any>(null);

  const mapSettings = (state.settings.themeConfig?.mapSection as MapSectionSettings | undefined) || DEFAULT_MAP_SECTION;

  const rows = useMemo<MapRow[]>(() => {
    return (mapSettings.locations || [])
      .filter(location => location.visible !== false)
      .map(location => ({
        location,
        property: location.propertyId
          ? state.properties.find(property => property.id === location.propertyId && property.status === 'published')
          : undefined,
      }))
      .filter(row => !row.location.propertyId || Boolean(row.property));
  }, [mapSettings.locations, state.properties]);


  const searchPlaces = async (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) { setSearchError('اكتب اسم مدينة أو حي للبحث.'); return; }
    setIsSearching(true); setSearchError('');
    try {
      const center = mapRef.current?.getCenter?.();
      const results = await searchMapPlaces(query, center ? { lat: center.lat, lon: center.lng } : undefined);
      setSearchResults(results);
      if (!results.length) setSearchError('لم نعثر على موقع مطابق. جرّب اسماً أوضح.');
    } catch (error: any) { setSearchError(error?.message || 'تعذر البحث عن الموقع.'); }
    finally { setIsSearching(false); }
  };
  const focusSearchResult = (result: MapSearchResult) => {
    const map = mapRef.current, L = window.L;
    if (!map || !L) return;
    searchMarkerRef.current?.remove();
    searchMarkerRef.current = L.circleMarker([result.latitude, result.longitude], {
      radius: 8, color: '#fff', weight: 3, fillColor: '#282824', fillOpacity: 1,
    }).addTo(map).bindPopup(result.label);
    map.flyTo([result.latitude, result.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
    searchMarkerRef.current.openPopup(); setSearchResults([]); setSearchError('');
  };
  const shareSavedLocation = async (title: string, latitude: number, longitude: number) => {
    try {
      const result = await shareOrCopyMapLocation(title, latitude, longitude);
      setShareMessage(result === 'shared' ? 'تم فتح خيارات المشاركة.' : 'تم نسخ رابط الموقع.');
    } catch (error: any) { setShareMessage(error?.message || 'تعذر مشاركة الموقع.'); }
    window.setTimeout(() => setShareMessage(''), 3000);
  };

  const mapDataKey = JSON.stringify({
    rows: rows.map(row => ({ ...row.location, propertyName: row.property?.name })),
    zoom: mapSettings.zoom,
  });

  useEffect(() => {
    if (!mapElement.current || !mapSettings.enabled) return;
    let active = true;

    loadLeaflet().then((L) => {
      if (!active || !mapElement.current) return;

      const map = L.map(mapElement.current, {
        zoomControl: false,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        boxZoom: true,
        keyboard: true,
        wheelPxPerZoomLevel: 80,
        tap: true,
      });
      mapRef.current = map;

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      }).addTo(map);

      const markers: any[] = [];
      rows.forEach(({ location, property }) => {
        const title = property?.name || location.title;
        const description = property
          ? [property.city, property.district, property.address].filter(Boolean).join(' · ')
          : location.description || '';

        const icon = L.divIcon({
          className: 'luxury-map-pin-host',
          html: '<span class="luxury-map-pin" aria-hidden="true"><span>⌖</span></span>',
          iconSize: [38, 42],
          iconAnchor: [19, 40],
        });
        const marker = L.marker([location.latitude, location.longitude], { icon }).addTo(map);
        const popup = document.createElement('div');
        popup.className = 'luxury-map-popup';
        const heading = document.createElement('p');
        heading.className = 'luxury-map-popup-title';
        heading.textContent = title;
        popup.appendChild(heading);
        if (description) {
          const details = document.createElement('p');
          details.className = 'luxury-map-popup-description';
          details.textContent = description;
          popup.appendChild(details);
        }
        marker.bindPopup(popup);
        const actionRow = document.createElement('div');
        actionRow.className = 'luxury-map-popup-actions';
        const shareButton = document.createElement('button');
        shareButton.type = 'button'; shareButton.className = 'luxury-map-popup-action'; shareButton.textContent = 'مشاركة الموقع';
        shareButton.addEventListener('click', (event) => {
          event.stopPropagation();
          void shareSavedLocation(title, location.latitude, location.longitude);
        });
        const copyButton = document.createElement('button');
        copyButton.type = 'button'; copyButton.className = 'luxury-map-popup-action'; copyButton.textContent = 'نسخ الرابط';
        copyButton.addEventListener('click', async (event) => {
          event.stopPropagation();
          try {
            await copyTextToClipboard(googleMapsLocationUrl(location.latitude, location.longitude));
            setShareMessage('تم نسخ رابط الموقع.');
          } catch (error: any) { setShareMessage(error?.message || 'تعذر نسخ الرابط.'); }
          window.setTimeout(() => setShareMessage(''), 3000);
        });
        actionRow.append(shareButton, copyButton); popup.appendChild(actionRow);
        marker.on('click', () => {
          if (!property) return;
          window.dispatchEvent(new CustomEvent('luxury:focus-building', { detail: { propertyId: property.id } }));
        });
        markers.push(marker);
      });

      if (markers.length === 1) {
        map.setView(markers[0].getLatLng(), Math.max(10, Math.min(16, Number(mapSettings.zoom) || 13)));
      } else if (markers.length > 1) {
        const bounds = L.featureGroup(markers).getBounds();
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
      } else {
        map.setView([24.7136, 46.6753], Math.max(4, Math.min(8, Number(mapSettings.zoom) || 5)));
      }

      const focusLocationId = new URLSearchParams(window.location.search).get('mapLocation');
      const focusRowIndex = rows.findIndex(row => row.location.id === focusLocationId);
      if (focusRowIndex >= 0) {
        map.setView([rows[focusRowIndex].location.latitude, rows[focusRowIndex].location.longitude], 15);
        markers[focusRowIndex]?.openPopup();
      }
      window.setTimeout(() => map.invalidateSize(), 80);
    }).catch((error) => {
      if (active) setMapError(error?.message || 'تعذر تحميل الخريطة حالياً.');
    });

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapDataKey, mapSettings.enabled]);

  if (!mapSettings.enabled) return null;

  return (
    <section id="building-map" dir="rtl" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-3xl">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#B69A68]">
            <MapPin className="h-4 w-4" />
            <span>مواقع مبانينا</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#282824] sm:text-4xl">{mapSettings.title}</h2>
          <p className="mt-3 text-sm leading-7 text-[#68675F] sm:text-base">{mapSettings.subtitle}</p>
        </div>
        <p className="text-xs text-[#68675F]">انقر على علامة المبنى للانتقال إلى بطاقة تفاصيله.</p>
      </div>

      <form onSubmit={searchPlaces} className="luxury-map-search-toolbar">
        <div className="luxury-map-search-input-wrap">
          <Search className="h-4 w-4 shrink-0 text-[#9C7D46]" />
          <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="ابحث عن مدينة أو حي..." aria-label="ابحث عن موقع على الخريطة" />
          <button type="submit" disabled={isSearching}>{isSearching ? 'جارٍ البحث…' : 'بحث'}</button>
        </div>
        <p className="luxury-map-search-credit">بحث الأماكن بواسطة Photon · بيانات OpenStreetMap</p>
        {searchError && <p role="status" className="luxury-map-search-message">{searchError}</p>}
        {searchResults.length > 0 && <div className="luxury-map-search-results">
          {searchResults.map((result, index) => (
            <button key={index} type="button" onClick={() => focusSearchResult(result)}>
              <MapPin className="h-4 w-4 shrink-0 text-[#B69A68]" /><span>{result.label}</span>
            </button>
          ))}
        </div>}
      </form>
      {shareMessage && <p role="status" className="luxury-map-share-message">{shareMessage}</p>}
      <div className="luxury-map-shell">
        <div ref={mapElement} className="luxury-map-canvas" aria-label="خريطة مواقع المباني" role="application" />
        {!mapError && (
          <div className="luxury-map-zoom" aria-label="أدوات تكبير الخريطة">
            <button type="button" aria-label="تكبير الخريطة" onClick={() => mapRef.current?.zoomIn()}><Plus /></button>
            <button type="button" aria-label="تصغير الخريطة" onClick={() => mapRef.current?.zoomOut()}><Minus /></button>
          </div>
        )}
        {mapError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#F7F3EB] p-6 text-center text-sm text-[#68675F]">
            <MapPin className="h-7 w-7 text-[#B69A68]" />
            <p>{mapError}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {rows.map(({ location, property }) => (
                <button
                  key={location.id}
                  type="button"
                  className="rounded-full border border-[#E3DCCD] bg-white px-3 py-2 text-xs font-semibold text-[#282824]"
                  onClick={() => property && window.dispatchEvent(new CustomEvent('luxury:focus-building', { detail: { propertyId: property.id } }))}
                >
                  {property?.name || location.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
