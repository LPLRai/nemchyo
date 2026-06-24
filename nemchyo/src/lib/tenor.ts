import { GIPHY_KEY, TENOR_KEY } from './config';

export type TenorGif = { id: string; preview: string; gif: string };

// GIF search. Uses GIPHY when a GIPHY key is set (easiest personal key),
// otherwise Tenor (the built-in demo key, or your own Tenor v2 key).
export async function tenorSearch(query: string): Promise<TenorGif[]> {
  if (GIPHY_KEY) return giphy(query);
  return tenor(query);
}

async function giphy(query: string): Promise<TenorGif[]> {
  const q = query.trim();
  const base = 'https://api.giphy.com/v1/gifs';
  const common = `api_key=${GIPHY_KEY}&limit=24&rating=g&bundle=messaging_non_clips`;
  const url = q ? `${base}/search?q=${encodeURIComponent(q)}&${common}` : `${base}/trending?${common}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GIPHY ${res.status}`);
  const data = await res.json();
  return ((data.data || []) as any[])
    .map((g) => {
      const im = g.images || {};
      const preview = (im.fixed_width_small || im.fixed_width || im.preview_gif || {}).url;
      const full = (im.downsized || im.fixed_width || im.original || {}).url;
      return { id: String(g.id), preview, gif: full } as TenorGif;
    })
    .filter((g) => g.preview && g.gif);
}

async function tenor(query: string): Promise<TenorGif[]> {
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

  // Personal Tenor key -> v2 (Google).
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
