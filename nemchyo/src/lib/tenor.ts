import { TENOR_KEY } from './config';

export type TenorGif = { id: string; preview: string; gif: string };

// Search Tenor (or featured/trending when the query is empty). contentfilter
// keeps results family-friendly. Returns a small preview (tinygif) for the grid
// and a medium gif url for sending.
//
// The public demo key works on the legacy v1 API; a personal key (from Google's
// Tenor API) uses v2. We pick the endpoint automatically from the key.
export async function tenorSearch(query: string): Promise<TenorGif[]> {
  const q = query.trim();
  const demo = TENOR_KEY === 'LIVDSRZULELA';

  if (demo) {
    const base = 'https://g.tenor.com/v1';
    const common = `key=${TENOR_KEY}&limit=24&contentfilter=high`;
    const url = q ? `${base}/search?q=${encodeURIComponent(q)}&${common}` : `${base}/trending?${common}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tenor ${res.status}`);
    const data = await res.json();
    return ((data.results || []) as any[])
      .map((r) => {
        const m = (r.media && r.media[0]) || {};
        const small = m.tinygif || m.nanogif || m.gif || {};
        const full = m.mediumgif || m.gif || small;
        return { id: String(r.id), preview: small.url, gif: full.url } as TenorGif;
      })
      .filter((g) => g.preview && g.gif);
  }

  // Your own key -> Tenor v2 (Google).
  const base = 'https://tenor.googleapis.com/v2';
  const common = `key=${TENOR_KEY}&client_key=nemchyo&limit=24&contentfilter=high&media_filter=tinygif,mediumgif,gif`;
  const url = q ? `${base}/search?q=${encodeURIComponent(q)}&${common}` : `${base}/featured?${common}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tenor ${res.status}`);
  const data = await res.json();
  return ((data.results || []) as any[])
    .map((r) => {
      const mf = r.media_formats || {};
      const small = mf.tinygif || mf.nanogif || mf.gif || {};
      const full = mf.mediumgif || mf.gif || small;
      return { id: String(r.id), preview: small.url, gif: full.url } as TenorGif;
    })
    .filter((g) => g.preview && g.gif);
}
