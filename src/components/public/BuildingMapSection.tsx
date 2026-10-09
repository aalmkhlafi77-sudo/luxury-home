import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Minus, Plus } from 'lucide-react';
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

interface MapRow {
  location: MapLocation;
  property?: Property;
}

export const BuildingMapSection: React.FC = () => {
  const { state } = useAppStore();
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [mapError, setMapError] = useState('');

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
        scrollWheelZoom: false,
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
