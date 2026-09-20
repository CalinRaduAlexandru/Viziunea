const SEARCH_URL = 'https://photon.komoot.io/api/';

export async function searchLocations(query, signal) {
  const value = String(query || '').trim();
  if (value.length < 3) return [];
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', value);
  url.searchParams.set('limit', '6');
  url.searchParams.set('lang', 'ro');
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Locațiile nu au putut fi încărcate.');
  const payload = await response.json();
  return (payload.features || []).map(feature => {
    const properties = feature.properties || {};
    const [longitude, latitude] = feature.geometry?.coordinates || [];
    const city = properties.city || properties.town || properties.village || properties.municipality || '';
    const parts = [properties.name, properties.street && properties.name !== properties.street ? properties.street : '', properties.housenumber, city, properties.county].filter(Boolean);
    return { id: properties.osm_id ? `${properties.osm_type || 'osm'}-${properties.osm_id}` : `${latitude},${longitude}`, label: [...new Set(parts)].join(', '), city, latitude, longitude, placeId: properties.osm_id ? `${properties.osm_type || 'osm'}-${properties.osm_id}` : null };
  }).filter(result => result.label && Number.isFinite(result.latitude) && Number.isFinite(result.longitude));
}
