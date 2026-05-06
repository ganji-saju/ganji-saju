import assert from 'node:assert/strict';
import { GET } from './route';

declare const test: (name: string, fn: () => Promise<void>) => void;

test('birth location geocoder rejects short queries', async () => {
  const response = await GET(new Request('http://localhost/api/geo/birth-location?q=') as never);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
});

test('birth location geocoder normalizes OpenStreetMap coordinates', async () => {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.BIRTH_LOCATION_GEOCODER_URL;
  process.env.BIRTH_LOCATION_GEOCODER_URL = 'https://example.test/search';

  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(String(input));
    assert.equal(url.origin + url.pathname, 'https://example.test/search');
    assert.equal(url.searchParams.get('q'), '목포시');
    assert.equal(url.searchParams.get('format'), 'jsonv2');
    assert.equal(url.searchParams.get('limit'), '5');
    assert.equal(url.searchParams.get('featureType'), 'settlement');
    assert.equal((init?.headers as Record<string, string>)['User-Agent'].startsWith('ganji-saju/'), true);

    return new Response(
      JSON.stringify([
        {
          place_id: 123,
          osm_type: 'relation',
          osm_id: 456,
          display_name: '목포시, 전라남도, 대한민국',
          lat: '34.8118351',
          lon: '126.3921664',
          licence: 'Data © OpenStreetMap contributors, ODbL 1.0',
          address: {
            city: '목포시',
            state: '전라남도',
            country: '대한민국',
          },
        },
      ])
    );
  }) as typeof fetch;

  try {
    const response = await GET(new Request('http://localhost/api/geo/birth-location?q=목포') as never);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.items[0].label, '목포시');
    assert.equal(body.items[0].latitude, 34.811835);
    assert.equal(body.items[0].longitude, 126.392166);
    assert.equal(body.items[0].sourceRef, 'relation/456');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) {
      delete process.env.BIRTH_LOCATION_GEOCODER_URL;
    } else {
      process.env.BIRTH_LOCATION_GEOCODER_URL = previousUrl;
    }
  }
});
