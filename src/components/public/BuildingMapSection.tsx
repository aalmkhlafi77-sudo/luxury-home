import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Compass, MapPin, Minus, Navigation, Plus, Search, X } from 'lucide-react';
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
      link.crossOrigin = 'anonymous';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const scriptId = 'luxury-leaflet-js';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
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
    script.id = scriptId;
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

export type MapSearchResult = {
  name: string;
  label: string;
  latitude: number;
  longitude: number;
  badge?: string;
  propertyId?: string;
};

function parseCoordinatesFromQuery(query: string): MapSearchResult | null {
  const cleaned = query.trim();
  const urlMatch = cleaned.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) || cleaned.match(/[?&](?:q|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const directMatch = cleaned.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,،\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  const match = urlMatch || directMatch;
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  const coordsLabel = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return {
    name: coordsLabel,
    label: `إحداثيات مباشرة (${coordsLabel})`,
    latitude,
    longitude,
    badge: 'إحداثيات',
  };
}

async function searchPhotonPlaces(query: string, center?: { lat: number; lon: number }): Promise<MapSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: '6' });
  if (center && Number.isFinite(center.lat) && Number.isFinite(center.lon)) {
    params.set('lat', String(center.lat));
    params.set('lon', String(center.lon));
  }
  const response = await fetch('https://photon.komoot.io/api/?' + params.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Photon search error');
  const data = await response.json();
  return (Array.isArray(data.features) ? data.features : []).flatMap((feature: any) => {
    const coordinates = feature?.geometry?.coordinates;
    const properties = feature?.properties || {};
    if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
    const latitude = Number(coordinates[1]);
    const longitude = Number(coordinates[0]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const name = String(properties.name || properties.street || properties.district || properties.city || properties.state || 'موقع على الخريطة');
    const label = [properties.name, properties.street, properties.district, properties.city, properties.state, properties.country]
      .filter((part: unknown, index: number, values: unknown[]) => typeof part === 'string' && part.trim() && values.indexOf(part) === index)
      .join('، ') || name;
    return [{ name, label, latitude, longitude }];
  });
}

async function searchNominatimPlaces(query: string): Promise<MapSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    'accept-language': 'ar,en',
    limit: '6',
    addressdetails: '1',
  });
  const response = await fetch('https://nominatim.openstreetmap.org/search?' + params.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Nominatim search error');
  const data = await response.json();
  return (Array.isArray(data) ? data : []).flatMap((item: any) => {
    const latitude = Number(item?.lat);
    const longitude = Number(item?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const name = String(item?.name || item?.display_name?.split('،')?.[0] || item?.display_name?.split(',')?.[0] || 'موقع على الخريطة').trim();
    const label = String(item?.display_name || name).trim();
    return [{ name, label, latitude, longitude }];
  });
}

export async function searchMapPlaces(
  query: string,
  center?: { lat: number; lon: number },
  localCandidates: MapSearchResult[] = [],
): Promise<MapSearchResult[]> {
  const normalized = query.trim().toLowerCase();
  const results: MapSearchResult[] = [];

  const coordMatch = parseCoordinatesFromQuery(query);
  if (coordMatch) {
    results.push(coordMatch);
  }

  const matchedLocal = localCandidates.filter(candidate =>
    candidate.name.toLowerCase().includes(normalized) ||
    candidate.label.toLowerCase().includes(normalized)
  );
  results.push(...matchedLocal);

  let remoteResults: MapSearchResult[] = [];
  try {
    remoteResults = await searchPhotonPlaces(query, center);
  } catch {
    remoteResults = [];
  }

  if (remoteResults.length === 0) {
    try {
      remoteResults = await searchNominatimPlaces(query);
    } catch {
      remoteResults = [];
    }
  }

  for (const item of remoteResults) {
    const duplicate = results.some(
      existing => Math.abs(existing.latitude - item.latitude) < 0.0005 && Math.abs(existing.longitude - item.longitude) < 0.0005
    );
    if (!duplicate) {
      results.push(item);
    }
  }

  return results.slice(0, 8);
}

export async function resolveBrowserOrIpLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
  source: 'gps' | 'ip';
}> {
  const tryBrowserGps = () =>
    new Promise<{ latitude: number; longitude: number; accuracy: number; source: 'gps' }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 35,
            source: 'gps',
          }),
        (err) => {
          // Retry once with enableHighAccuracy: false if high accuracy failed or timed out
          navigator.geolocation.getCurrentPosition(
            (pos2) =>
              resolve({
                latitude: pos2.coords.latitude,
                longitude: pos2.coords.longitude,
                accuracy: pos2.coords.accuracy || 120,
                source: 'gps',
              }),
            () => reject(err),
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
          );
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    });

  try {
    return await tryBrowserGps();
  } catch {
    // Fallback to IP geolocation if iframe permissions or browser GPS are blocked
    const ipProviders = [
      async () => {
        const res = await fetch('https://ipwho.is/');
        if (!res.ok) throw new Error('ipwho failed');
        const data = await res.json();
        if (data && data.success !== false && Number.isFinite(Number(data.latitude)) && Number.isFinite(Number(data.longitude))) {
          return { latitude: Number(data.latitude), longitude: Number(data.longitude), accuracy: 1500, source: 'ip' as const };
        }
        throw new Error('invalid ipwho data');
      },
      async () => {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (!res.ok) throw new Error('geojs failed');
        const data = await res.json();
        if (data && Number.isFinite(Number(data.latitude)) && Number.isFinite(Number(data.longitude))) {
          return { latitude: Number(data.latitude), longitude: Number(data.longitude), accuracy: 2000, source: 'ip' as const };
        }
        throw new Error('invalid geojs data');
      },
      async () => {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) throw new Error('ipapi failed');
        const data = await res.json();
        if (data && Number.isFinite(Number(data.latitude)) && Number.isFinite(Number(data.longitude))) {
          return { latitude: Number(data.latitude), longitude: Number(data.longitude), accuracy: 2000, source: 'ip' as const };
        }
        throw new Error('invalid ipapi data');
      },
    ];

    for (const provider of ipProviders) {
      try {
        return await provider();
      } catch {
        // try next provider
      }
    }
    throw new Error('تعذر تحديد موقعك. تأكد من تفعيل إذن الموقع في المتصفح.');
  }
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

export type ActivityCategory = 'food' | 'health' | 'shopping' | 'entertainment';
export type NearbyActivity = { id: string; title: string; category: ActivityCategory; latitude: number; longitude: number };

export const ACTIVITY_CATEGORIES: {
  id: ActivityCategory;
  label: string;
  color: string;
  filters: string[];
  osmTags: string[];
  nominatimQueries: string[];
}[] = [
  {
    id: 'food',
    label: 'مطاعم ومقاهٍ',
    color: '#C96B32',
    filters: ['["amenity"~"restaurant|cafe|fast_food|food_court|ice_cream"]'],
    osmTags: ['amenity:restaurant', 'amenity:cafe', 'amenity:fast_food'],
    nominatimQueries: ['[amenity=restaurant]', '[amenity=cafe]'],
  },
  {
    id: 'health',
    label: 'مستشفيات وصيدليات',
    color: '#C74455',
    filters: ['["amenity"~"hospital|clinic|doctors|pharmacy"]'],
    osmTags: ['amenity:pharmacy', 'amenity:hospital', 'amenity:clinic'],
    nominatimQueries: ['[amenity=pharmacy]', '[amenity=hospital]'],
  },
  {
    id: 'shopping',
    label: 'مراكز تجارية',
    color: '#7A58A6',
    filters: ['["shop"~"mall|supermarket|department_store"]', '["landuse"="retail"]'],
    osmTags: ['shop:mall', 'shop:supermarket', 'shop:department_store'],
    nominatimQueries: ['[shop=mall]', '[shop=supermarket]'],
  },
  {
    id: 'entertainment',
    label: 'ترفيه',
    color: '#347B78',
    filters: ['["amenity"~"cinema|theatre|nightclub|arts_centre"]', '["leisure"~"amusement_arcade|water_park|amusement_park|sports_centre|park"]', '["tourism"~"theme_park|attraction"]'],
    osmTags: ['leisure:park', 'amenity:cinema', 'tourism:attraction'],
    nominatimQueries: ['[leisure=park]', '[amenity=cinema]'],
  },
];

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

function buildOverpassQuery(categories: ActivityCategory[], latitude: number, longitude: number, radius: number): string {
  const statements = categories.flatMap(category => {
    const config = ACTIVITY_CATEGORIES.find(item => item.id === category);
    return (config?.filters || []).map(filter => 'nw(around:' + radius + ',' + latitude + ',' + longitude + ')' + filter + ';');
  });
  return '[out:json][timeout:12];(' + statements.join('') + ');out center tags 80;';
}

const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

async function findActivitiesViaPhotonAndNominatim(
  categories: ActivityCategory[],
  latitude: number,
  longitude: number,
  radius: number,
): Promise<NearbyActivity[]> {
  const delta = Math.max(0.035, Math.min(0.14, (radius / 111000) * 1.6));
  const minLon = (longitude - delta).toFixed(5);
  const minLat = (latitude - delta).toFixed(5);
  const maxLon = (longitude + delta).toFixed(5);
  const maxLat = (latitude + delta).toFixed(5);
  const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
  const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`;

  const collected: NearbyActivity[] = [];
  const seenCoords = new Set<string>();

  const pushActivity = (item: NearbyActivity) => {
    const key = `${item.category}-${item.latitude.toFixed(4)}-${item.longitude.toFixed(4)}`;
    if (seenCoords.has(key)) return;
    seenCoords.add(key);
    collected.push(item);
  };

  await Promise.all(
    categories.map(async (category) => {
      const config = ACTIVITY_CATEGORIES.find(c => c.id === category);
      if (!config) return;

      // 1. Query Nominatim bounded viewbox for each category tag
      await Promise.all(
        config.nominatimQueries.map(async (q) => {
          try {
            const params = new URLSearchParams({
              q,
              format: 'jsonv2',
              viewbox,
              bounded: '1',
              limit: '12',
              'accept-language': 'ar,en',
            });
            const res = await fetch('https://nominatim.openstreetmap.org/search?' + params.toString(), {
              headers: { Accept: 'application/json' },
            });
            if (!res.ok) return;
            const items = await res.json();
            if (!Array.isArray(items)) return;
            items.forEach((item: any) => {
              const lat = Number(item?.lat);
              const lon = Number(item?.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
              const rawName = String(item?.name || item?.display_name?.split('،')?.[0] || item?.display_name?.split(',')?.[0] || config.label).trim();
              pushActivity({
                id: `nom-${item.place_id || Math.random()}`,
                title: rawName || config.label,
                category,
                latitude: lat,
                longitude: lon,
              });
            });
          } catch {
            // ignore individual tag error
          }
        })
      );

      // 2. Query Photon with bbox + osm_tag as supplementary source
      await Promise.all(
        config.osmTags.slice(0, 2).map(async (osmTag) => {
          try {
            const url = `https://photon.komoot.io/api/?q=a&bbox=${encodeURIComponent(bbox)}&osm_tag=${encodeURIComponent(osmTag)}&limit=10`;
            const res = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            const data = await res.json();
            const features = Array.isArray(data?.features) ? data.features : [];
            features.forEach((f: any) => {
              const coords = f?.geometry?.coordinates;
              const props = f?.properties || {};
              if (!Array.isArray(coords) || coords.length < 2) return;
              const lon = Number(coords[0]);
              const lat = Number(coords[1]);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
              const title = String(props.name || props.street || props.district || config.label).trim();
              pushActivity({
                id: `pho-${props.osm_id || Math.random()}`,
                title: title || config.label,
                category,
                latitude: lat,
                longitude: lon,
              });
            });
          } catch {
            // ignore individual tag error
          }
        })
      );
    })
  );

  return collected.slice(0, 80);
}

export async function findNearbyActivities(
  categories: ActivityCategory[],
  latitude: number,
  longitude: number,
  radius: number,
): Promise<NearbyActivity[]> {
  // First try fast Photon + Nominatim bounded queries concurrently with Overpass
  try {
    const fastResults = await findActivitiesViaPhotonAndNominatim(categories, latitude, longitude, radius);
    if (fastResults.length > 0) {
      return fastResults;
    }
  } catch {
    // fallback to Overpass below
  }

  const queryBody = new URLSearchParams({ data: buildOverpassQuery(categories, latitude, longitude, radius) });

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: queryBody,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('خدمة الأنشطة القريبة مشغولة حالياً.');
      const data = await response.json();
      const items = Array.isArray(data.elements) ? data.elements : [];
      const parsed = items.flatMap((item: any) => {
        const lat = Number(item.lat ?? item.center?.lat);
        const lon = Number(item.lon ?? item.center?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
        const tags = item.tags || {};
        let category: ActivityCategory | undefined;
        if (/restaurant|cafe|fast_food|food_court|ice_cream/.test(String(tags.amenity || ''))) category = 'food';
        else if (/hospital|clinic|doctors|pharmacy/.test(String(tags.amenity || ''))) category = 'health';
        else if (/mall|supermarket|department_store/.test(String(tags.shop || '')) || tags.landuse === 'retail') category = 'shopping';
        else if (/cinema|theatre|nightclub|arts_centre/.test(String(tags.amenity || '')) || /amusement_arcade|water_park|amusement_park|sports_centre|park/.test(String(tags.leisure || '')) || /theme_park|attraction/.test(String(tags.tourism || ''))) category = 'entertainment';
        if (!category || !categories.includes(category)) return [];
        const title = String(tags.name || tags['name:ar'] || tags.brand || ACTIVITY_CATEGORIES.find(item => item.id === category)?.label || 'مكان قريب');
        return [{ id: String(item.type) + '-' + String(item.id), title, category, latitude: lat, longitude: lon }];
      }).slice(0, 80);

      if (parsed.length > 0) return parsed;
    } catch {
      // try next endpoint
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return [];
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
  const [isLocating, setIsLocating] = useState(false);
  const searchMarkerRef = useRef<any>(null);
  const [baseLayerId, setBaseLayerId] = useState<MapBaseLayerId>('street');
  const baseLayerIdRef = useRef<MapBaseLayerId>('street');
  const baseLayerRef = useRef<any>(null);
  const currentLocationLayersRef = useRef<any[]>([]);
  const activityMarkersRef = useRef<any[]>([]);
  const [selectedActivityCategories, setSelectedActivityCategories] = useState<ActivityCategory[]>(['food', 'health', 'shopping', 'entertainment']);
  const [activityMessage, setActivityMessage] = useState('');
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isMobileActivitiesOpen, setIsMobileActivitiesOpen] = useState(false);

  const rawMapSection = state.settings.themeConfig?.mapSection as MapSectionSettings | undefined;
  const mapSettings = rawMapSection || DEFAULT_MAP_SECTION;

  const rows = useMemo<MapRow[]>(() => {
    const configuredLocations = Array.isArray(mapSettings.locations) ? mapSettings.locations : [];
    if (configuredLocations.length > 0) {
      return configuredLocations
        .filter(location => location.visible !== false)
        .map(location => ({
          location,
          property: location.propertyId
            ? state.properties.find(property => property.id === location.propertyId && property.status === 'published')
            : undefined,
        }))
        .filter(row => !row.location.propertyId || Boolean(row.property));
    }

    if (!rawMapSection) {
      return state.properties
        .filter(property => property.status === 'published' && Number.isFinite(Number(property.latitude)) && Number.isFinite(Number(property.longitude)))
        .map(property => ({
          location: {
            id: `prop-loc-${property.id}`,
            title: property.name,
            description: [property.city, property.district, property.address].filter(Boolean).join(' · '),
            latitude: Number(property.latitude),
            longitude: Number(property.longitude),
            propertyId: property.id,
            visible: true,
          },
          property,
        }));
    }

    return [];
  }, [mapSettings.locations, rawMapSection, state.properties]);

  const localSearchCandidates = useMemo<MapSearchResult[]>(() => {
    const candidates: MapSearchResult[] = [];
    rows.forEach(({ location, property }) => {
      const lat = Number(location.latitude);
      const lng = Number(location.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const name = property?.name || location.title;
      const details = property
        ? [property.name, property.city, property.district, property.address].filter(Boolean).join('، ')
        : [location.title, location.description].filter(Boolean).join('، ');
      candidates.push({
        name,
        label: details || name,
        latitude: lat,
        longitude: lng,
        badge: 'مبنى مسجل',
        propertyId: property?.id,
      });
    });

    state.properties
      .filter(p => p.status === 'published' && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
      .forEach(property => {
        const lat = Number(property.latitude);
        const lng = Number(property.longitude);
        if (candidates.some(c => c.propertyId === property.id)) return;
        candidates.push({
          name: property.name,
          label: [property.name, property.city, property.district, property.address].filter(Boolean).join('، '),
          latitude: lat,
          longitude: lng,
          badge: 'مبنى مسجل',
          propertyId: property.id,
        });
      });

    return candidates;
  }, [rows, state.properties]);

  const moveMapToSearchResult = (result: MapSearchResult, closeResults = true) => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;
    searchMarkerRef.current?.remove();
    searchMarkerRef.current = L.circleMarker([result.latitude, result.longitude], {
      radius: 9,
      color: '#fff',
      weight: 3,
      fillColor: '#B69A68',
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup(result.label);
    map.flyTo([result.latitude, result.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
    searchMarkerRef.current.openPopup();
    if (result.propertyId) {
      window.dispatchEvent(new CustomEvent('luxury:focus-building', { detail: { propertyId: result.propertyId } }));
    }
    if (closeResults) {
      setSearchResults([]);
    }
    setSearchError('');
  };

  const searchPlaces = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchError('اكتب اسم مدينة أو حي أو مبنى للبحث.');
      return;
    }
    setIsSearching(true);
    setSearchError('');
    try {
      const center = mapRef.current?.getCenter?.();
      const results = await searchMapPlaces(
        query,
        center ? { lat: center.lat, lon: center.lng } : undefined,
        localSearchCandidates,
      );
      setSearchResults(results);
      if (!results.length) {
        setSearchError('لم نعثر على موقع مطابق. جرّب اسماً أوضح.');
      } else {
        moveMapToSearchResult(results[0], results.length === 1);
      }
    } catch (error: any) {
      setSearchError(error?.message || 'تعذر البحث عن الموقع.');
    } finally {
      setIsSearching(false);
    }
  };

  const focusSearchResult = (result: MapSearchResult) => {
    moveMapToSearchResult(result, true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    searchMarkerRef.current?.remove();
    searchMarkerRef.current = null;
  };

  const shareSavedLocation = async (title: string, latitude: number, longitude: number) => {
    try {
      const result = await shareOrCopyMapLocation(title, latitude, longitude);
      setShareMessage(result === 'shared' ? 'تم فتح خيارات المشاركة.' : 'تم نسخ رابط الموقع.');
    } catch (error: any) {
      setShareMessage(error?.message || 'تعذر مشاركة الموقع.');
    }
    window.setTimeout(() => setShareMessage(''), 3000);
  };

  const changeBaseLayer = (next: MapBaseLayerId) => {
    const map = mapRef.current;
    const L = window.L;
    baseLayerIdRef.current = next;
    setBaseLayerId(next);
    if (!map || !L) return;
    baseLayerRef.current?.removeFrom(map);
    baseLayerRef.current = createMapBaseLayer(L, next).addTo(map);
  };

  const locateCurrentPosition = async () => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || isLocating) return;
    setIsLocating(true);
    setShareMessage('جارٍ تحديد موقعك…');
    try {
      const pos = await resolveBrowserOrIpLocation();
      const latlng = L.latLng(pos.latitude, pos.longitude);
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
      map.flyTo(latlng, pos.source === 'gps' ? Math.max(map.getZoom(), 15) : Math.max(map.getZoom(), 13), { duration: 0.6 });
      marker.openPopup();
      setShareMessage(pos.source === 'gps' ? 'تم تحديد موقعك الحالي على الخريطة.' : 'تم تحديد موقعك التقريبي على الخريطة.');
    } catch (err: any) {
      setShareMessage(err?.message || 'تعذر تحديد موقعك. تحقق من تفعيل إذن الموقع في المتصفح.');
    } finally {
      setIsLocating(false);
      window.setTimeout(() => setShareMessage(''), 4000);
    }
  };

  const runNearbyActivitiesSearch = async (categoriesToFetch: ActivityCategory[]) => {
    const map = mapRef.current;
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
      // If zoomed out to country level, center around the first building or Riyadh so activities are relevant
      if (map.getZoom() < 10) {
        const firstValid = rows.find(r => Number.isFinite(Number(r.location.latitude)) && Number.isFinite(Number(r.location.longitude)));
        if (firstValid) {
          center = L.latLng(Number(firstValid.location.latitude), Number(firstValid.location.longitude));
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
      setActivityMessage(places.length ? 'تم عرض ' + places.length + ' نشاطاً قريباً على الخريطة.' : 'لم نعثر على أنشطة ضمن النطاق الحالي. حرّك الخريطة نحو الحي المطلوب.');
      window.setTimeout(() => setActivityMessage(''), 4500);
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

  const mapDataKey = JSON.stringify({
    rows: rows.map(row => ({ ...row.location, propertyName: row.property?.name })),
    zoom: mapSettings.zoom,
  });

  useEffect(() => {
    if (!mapElement.current || !mapSettings.enabled) return;
    let active = true;
    let invalidateTimer: number | undefined;

    loadLeaflet().then((L) => {
      if (!active || !mapElement.current) return;

      if (mapRef.current) {
        try {
          mapRef.current.stop?.();
          mapRef.current.remove();
        } catch {
          // ignore cleanup error
        }
        mapRef.current = null;
      }

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

      baseLayerRef.current = createMapBaseLayer(L, baseLayerIdRef.current).addTo(map);

      const markers: any[] = [];
      rows.forEach(({ location, property }) => {
        const lat = Number(location.latitude);
        const lng = Number(location.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

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
        const marker = L.marker([lat, lng], { icon }).addTo(map);
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
        const actionRow = document.createElement('div');
        actionRow.className = 'luxury-map-popup-actions';
        const shareButton = document.createElement('button');
        shareButton.type = 'button';
        shareButton.className = 'luxury-map-popup-action';
        shareButton.textContent = 'مشاركة الموقع';
        shareButton.addEventListener('click', (event) => {
          event.stopPropagation();
          void shareSavedLocation(title, lat, lng);
        });
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'luxury-map-popup-action';
        copyButton.textContent = 'نسخ الرابط';
        copyButton.addEventListener('click', async (event) => {
          event.stopPropagation();
          try {
            await copyTextToClipboard(googleMapsLocationUrl(lat, lng));
            setShareMessage('تم نسخ رابط الموقع.');
          } catch (error: any) {
            setShareMessage(error?.message || 'تعذر نسخ الرابط.');
          }
          window.setTimeout(() => setShareMessage(''), 3000);
        });
        actionRow.append(shareButton, copyButton);
        popup.appendChild(actionRow);
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
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [70, 50], maxZoom: 13 });
        } else {
          map.setView([24.7136, 46.6753], Math.max(4, Math.min(8, Number(mapSettings.zoom) || 5)));
        }
      } else {
        map.setView([24.7136, 46.6753], Math.max(4, Math.min(8, Number(mapSettings.zoom) || 5)));
      }

      const focusLocationId = new URLSearchParams(window.location.search).get('mapLocation');
      const focusRowIndex = rows.findIndex(row => row.location.id === focusLocationId);
      if (focusRowIndex >= 0 && Number.isFinite(Number(rows[focusRowIndex].location.latitude)) && Number.isFinite(Number(rows[focusRowIndex].location.longitude))) {
        map.setView([Number(rows[focusRowIndex].location.latitude), Number(rows[focusRowIndex].location.longitude)], 15);
        markers[focusRowIndex]?.openPopup();
      }
      invalidateTimer = window.setTimeout(() => {
        if (active && mapRef.current === map) {
          try {
            map.invalidateSize();
          } catch {
            // ignore if map is unmounted
          }
        }
      }, 80);
    }).catch((error) => {
      if (active) setMapError(error?.message || 'تعذر تحميل الخريطة حالياً.');
    });

    return () => {
      active = false;
      if (invalidateTimer !== undefined) {
        window.clearTimeout(invalidateTimer);
      }
      if (mapRef.current) {
        try {
          mapRef.current.stop?.();
          mapRef.current.remove();
        } catch {
          // ignore cleanup error
        }
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
        {/* Floating Header Inside the Top of the Map */}
        <div
          className="luxury-map-floating-header"
          onMouseDown={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          onWheel={e => e.stopPropagation()}
        >
          <div className="luxury-map-floating-top-row">
            <form onSubmit={searchPlaces} className="luxury-map-search-toolbar">
              <div className="luxury-map-search-input-wrap">
                <Search className="h-4 w-4 shrink-0 text-[#9C7D46]" />
                <input
                  value={searchQuery}
                  onChange={event => {
                    setSearchQuery(event.target.value);
                    if (searchError) setSearchError('');
                  }}
                  placeholder="ابحث عن مدينة أو حي أو مبنى..."
                  aria-label="ابحث عن موقع على الخريطة"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="luxury-map-search-clear"
                    aria-label="مسح البحث"
                    title="مسح البحث"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="submit" className="luxury-map-search-submit" disabled={isSearching}>
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
            </form>

            <div className="luxury-map-tools-panel">
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
                <span>الأنشطة القريبة</span>
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
          {shareMessage && <p role="status" className="luxury-map-share-message">{shareMessage}</p>}
          {activityMessage && <p role="status" className="luxury-map-share-message">{activityMessage}</p>}
        </div>

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
