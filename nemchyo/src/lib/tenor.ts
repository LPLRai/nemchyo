import { TENOR_KEY } from './config';

export type TenorGif = { id: string; preview: string; gif: string; ratio: number };

// Search Tenor (or trending when the query is empty). contentfilter=high keeps
// results family-friendly. Returns a small preview (tinygif) for the grid plus
// a medium-size gif url for actually sending.
export async function tenorSearch(query: string): Promise<TenorGif[]> {
  const base = 'https://g.tenor.com/v1';
  const common = `key=${TENOR_KEY}&limit=24&contentfilter=high&ar_range=all`;
  const url = query.trim()
    ? `${base}/search?q=${encodeURIComponent(query.trim())}&${common}`
    : `${base}/trending?${common}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tenor ${res.status}`);
  const data = await res.json();
  return ((data.results || []) as any[])
    .map((r) => {
      const m = (r.media && r.media[0]) || {};
      const small = m.tinygif || m.nanogif || m.gif || {};
      const full = m.mediumgif || m.gif || small;
      const dims = small.dims || m.gif?.dims || [1, 1];
      return { id: String(r.id), preview: small.url, gif: full.url, ratio: dims[0] / dims[1] || 1 } as TenorGif;
    })
    .filter((g) => g.preview && g.gif);
}
