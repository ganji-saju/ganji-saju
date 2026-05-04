import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_GEOCODER_URL = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_USER_AGENT = 'saju-app/1.0 (+https://github.com/kionya/saju-app)';
const REQUEST_TIMEOUT_MS = 4_000;

interface NominatimPlace {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  class?: string;
  type?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  licence?: string;
  address?: Record<string, string | undefined>;
}

interface BirthLocationResult {
  id: string;
  label: string;
  displayName: string;
  latitude: number;
  longitude: number;
  source: 'openstreetmap-nominatim';
  sourceRef: string;
  license: string;
}

function getGeocoderEndpoint() {
  return process.env.BIRTH_LOCATION_GEOCODER_URL?.trim() || DEFAULT_GEOCODER_URL;
}

function getGeocoderUserAgent() {
  return process.env.BIRTH_LOCATION_GEOCODER_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
}

function formatCoordinate(value: number) {
  return Math.round(value * 1000000) / 1000000;
}

function pickLocationLabel(place: NominatimPlace) {
  const address = place.address ?? {};
  return (
    address.city ||
    address.town ||
    address.municipality ||
    address.county ||
    address.village ||
    address.borough ||
    address.suburb ||
    address.state ||
    place.display_name?.split(',')[0]?.trim() ||
    '검색 지역'
  );
}

function normalizeSearchQuery(query: string) {
  const normalized = query.replace(/\s+/g, ' ').trim();
  if (/^[가-힣\s]+$/.test(normalized) && !/[시군구도읍면동리]$/.test(normalized)) {
    return `${normalized}시`;
  }

  return normalized;
}

function normalizePlace(place: NominatimPlace): BirthLocationResult | null {
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const sourceRef = place.osm_type && place.osm_id
    ? `${place.osm_type}/${place.osm_id}`
    : place.place_id
      ? `place/${place.place_id}`
      : 'nominatim';

  return {
    id: String(place.place_id ?? sourceRef),
    label: pickLocationLabel(place),
    displayName: place.display_name ?? pickLocationLabel(place),
    latitude: formatCoordinate(latitude),
    longitude: formatCoordinate(longitude),
    source: 'openstreetmap-nominatim',
    sourceRef,
    license: place.licence ?? 'Data © OpenStreetMap contributors, ODbL 1.0',
  };
}

function createTimeoutSignal() {
  if ('timeout' in AbortSignal) {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return controller.signal;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return NextResponse.json(
      { ok: false, error: '지역명을 두 글자 이상 입력해 주세요.' },
      { status: 400 }
    );
  }

  const geocoderUrl = new URL(getGeocoderEndpoint());
  geocoderUrl.searchParams.set('q', normalizeSearchQuery(query));
  geocoderUrl.searchParams.set('format', 'jsonv2');
  geocoderUrl.searchParams.set('addressdetails', '1');
  geocoderUrl.searchParams.set('limit', '5');
  geocoderUrl.searchParams.set('accept-language', 'ko,en');
  geocoderUrl.searchParams.set('dedupe', '1');
  geocoderUrl.searchParams.set('featureType', 'settlement');

  try {
    const response = await fetch(geocoderUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': getGeocoderUserAgent(),
        Referer: process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://ganji-saju.vercel.app',
      },
      signal: createTimeoutSignal(),
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: '지역 좌표 검색 서비스가 잠시 응답하지 않습니다.' },
        { status: 502 }
      );
    }

    const payload = (await response.json().catch(() => [])) as NominatimPlace[];
    const items = Array.isArray(payload)
      ? payload.map(normalizePlace).filter((item): item is BirthLocationResult => Boolean(item))
      : [];

    return NextResponse.json(
      {
        ok: true,
        provider: 'OpenStreetMap Nominatim',
        attribution: 'Data © OpenStreetMap contributors, ODbL 1.0',
        items,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: '지역 좌표를 찾는 중 네트워크 오류가 발생했습니다.' },
      { status: 502 }
    );
  }
}
