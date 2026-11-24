// Universal Music Metadata & High-Res Album Artwork Resolver
// Works both in browser (client-side, including static hosting) and server-side

export const DEFAULT_RADIO_COVER = "https://i.ibb.co/kVQLN1F1/Logo-Buenisima-esfera-512x256.png";

export interface ResolvedSong {
  title: string;
  artist: string;
  cover: string;
  raw?: string;
  listeners?: number;
  updatedAt?: number;
}

// Cache successful music matches; failures expire after 60s so retries can recover
const artworkCache = new Map<string, { data: ResolvedSong; expiresAt: number }>();

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'al', 'y', 'e',
  'the', 'a', 'an', 'of', 'in', 'on', 'con', 'ft', 'feat'
]);

export const cleanSongString = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/\s*\([^)]*(?:oficial|audio|video|remaster|letra|lyrics|hd|4k|version)[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*(?:oficial|audio|video|remaster|letra|lyrics|hd|4k|version)[^\]]*\]/gi, '')
    .replace(/\s*\.mp3$/i, '')
    .replace(/\s*\.aac$/i, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const normalizeTokens = (str: string): string[] => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`´]/g, ' ')
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/\s*\[[^\]]*\]/g, ' ')
    .replace(/(?:feat|ft)\.?\s+.*$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));
};

export const tokenOverlapScore = (queryStr: string, candidateStr: string): number => {
  const qTokens = normalizeTokens(queryStr);
  const cTokens = normalizeTokens(candidateStr);
  if (qTokens.length === 0 || cTokens.length === 0) return 0;

  const cSet = new Set(cTokens);
  let matches = 0;
  for (const t of qTokens) {
    if (
      cSet.has(t) ||
      cTokens.some((ct) => ct.length >= 4 && t.length >= 4 && (ct.includes(t) || t.includes(ct)))
    ) {
      matches++;
    }
  }
  const qRatio = matches / qTokens.length;
  const cRatio = matches / cTokens.length;
  return qRatio * 0.7 + cRatio * 0.3;
};

export const formatTitleCase = (str: string): string => {
  if (!str) return '';
  if (str === str.toUpperCase() && str.length > 3) {
    return str.toLowerCase().replace(/(?:^|\s|\/|-)\S/g, (char) => char.toUpperCase());
  }
  return str;
};

export const isRealMusicCover = (cover?: string | null): boolean => {
  if (!cover || !cover.startsWith('http')) return false;
  const lower = cover.toLowerCase();
  return !lower.includes('logo-buenisima') && !lower.includes('i.ibb.co') && !lower.includes('placeholder');
};

// JSONP helper for Deezer API in browser (bypasses CORS cleanly without proxy)
const jsonpDeezerSearch = (query: string, timeoutMs = 4000): Promise<any[]> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve([]);
  }
  return new Promise((resolve) => {
    const callbackName = `__deezerCb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      try {
        delete (window as any)[callbackName];
      } catch {
        (window as any)[callbackName] = undefined;
      }
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve([]);
      }
    }, timeoutMs);

    (window as any)[callbackName] = (payload: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(Array.isArray(payload?.data) ? payload.data : []);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve([]);
    };

    script.src = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=8&output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
};

const pickBestMatch = (
  items: { title: string; artist: string; cover: string }[],
  cleanA: string,
  cleanB: string
): ResolvedSong | null => {
  let best: { score: number; item: { title: string; artist: string; cover: string } } | null = null;

  for (const item of items) {
    if (!item.cover) continue;
    if (cleanB) {
      const aToArtist = tokenOverlapScore(cleanA, item.artist);
      const bToTrack = tokenOverlapScore(cleanB, item.title);
      const directScore = (aToArtist + bToTrack) / 2;
      const minDirect = Math.min(aToArtist, bToTrack);

      const aToTrack = tokenOverlapScore(cleanA, item.title);
      const bToArtist = tokenOverlapScore(cleanB, item.artist);
      const invertedScore = (aToTrack + bToArtist) / 2;
      const minInverted = Math.min(aToTrack, bToArtist);

      const isDirect = minDirect >= 0.45 && directScore >= 0.55;
      const isInverted = minInverted >= 0.45 && invertedScore >= 0.55;
      const score = Math.max(isDirect ? directScore : 0, isInverted ? invertedScore : 0);

      if (score > 0 && (!best || score > best.score)) {
        best = { score, item };
      }
    } else {
      const combinedScore = tokenOverlapScore(cleanA, `${item.artist} ${item.title}`);
      if (combinedScore >= 0.6 && (!best || combinedScore > best.score)) {
        best = { score: combinedScore, item };
      }
    }
  }

  if (!best) return null;
  return {
    title: best.item.title,
    artist: best.item.artist,
    cover: best.item.cover,
    updatedAt: Date.now()
  };
};

/**
 * Smart bidirectional album artwork search (iTunes CORS + Deezer JSONP/Fetch)
 * Handles "Artist - Title", "Title - Artist", Spanish accents/apostrophes, and Latin catalogs.
 */
export async function resolveMusicArtwork(tokenA: string, tokenB: string = ''): Promise<ResolvedSong | null> {
  const cleanA = cleanSongString(tokenA);
  const cleanB = cleanSongString(tokenB);
  if (!cleanA && !cleanB) return null;

  const cacheKey = `${cleanA.toLowerCase()}:::${cleanB.toLowerCase()}`;
  const cached = artworkCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const queries = [
    cleanB ? `${cleanA} ${cleanB}` : cleanA,
    cleanB ? `${cleanB} ${cleanA}` : null,
    cleanA.length > 4 ? cleanA : null,
    cleanB.length > 4 ? cleanB : null,
  ].filter(Boolean) as string[];

  // 1. iTunes Search API (supports CORS Access-Control-Allow-Origin: *)
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=10&entity=song`,
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        const items = (data.results || [])
          .filter((r: any) => r.artworkUrl100)
          .map((r: any) => ({
            title: r.trackName || '',
            artist: r.artistName || '',
            cover: String(r.artworkUrl100).replace('100x100', '1000x1000')
          }));
        const matched = pickBestMatch(items, cleanA, cleanB);
        if (matched) {
          artworkCache.set(cacheKey, { data: matched, expiresAt: Date.now() + 30 * 60 * 1000 });
          return matched;
        }
      }
    } catch {
      // Try next query
    }
  }

  // 2. Deezer Search (JSONP in browser so CORS never blocks it; standard fetch on server)
  const deezerQueries = [
    cleanB ? `${cleanA} ${cleanB}` : cleanA,
    cleanB ? `${cleanB} ${cleanA}` : null
  ].filter(Boolean) as string[];

  for (const q of deezerQueries) {
    try {
      let rawItems: any[] = [];
      if (typeof window !== 'undefined') {
        rawItems = await jsonpDeezerSearch(q);
      } else {
        const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          rawItems = data?.data || [];
        }
      }

      const items = rawItems
        .map((r: any) => ({
          title: r.title || '',
          artist: r.artist?.name || '',
          cover: r.album?.cover_xl || r.album?.cover_big || r.album?.cover_medium || ''
        }))
        .filter((x) => x.cover);

      const matched = pickBestMatch(items, cleanA, cleanB);
      if (matched) {
        artworkCache.set(cacheKey, { data: matched, expiresAt: Date.now() + 30 * 60 * 1000 });
        return matched;
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Splits raw stream text and extracts true title, artist, and cover art.
 */
export async function parseAndResolveStreamMetadata(
  rawTitle: string,
  fallbackStation = "BUENÍSIMA 87.7 FM",
  fallbackSlogan = "La Radio de la Buena Vibra"
): Promise<ResolvedSong> {
  const trimmed = (rawTitle || '').trim();

  const STUCK_WORDS = ['KENNY GARCIA', 'GLENDY GARCIA', 'WAKE KENNY GARCIA', 'LOCUCION DE HORA', 'PROMO', 'ORBAN'];
  const isStuckWord = STUCK_WORDS.some((w) => trimmed.toUpperCase().includes(w));

  if (!trimmed || trimmed === '-' || trimmed === 'Sintonizando...' || isStuckWord) {
    return {
      title: fallbackStation,
      artist: isStuckWord ? formatTitleCase(trimmed) : fallbackSlogan,
      cover: DEFAULT_RADIO_COVER,
      updatedAt: Date.now()
    };
  }

  let partA = trimmed;
  let partB = '';
  const separators = [" - ", " : ", " – ", " — ", " | "];
  for (const sep of separators) {
    if (trimmed.includes(sep)) {
      const parts = trimmed.split(sep);
      partA = parts[0].trim();
      partB = parts.slice(1).join(sep).trim();
      break;
    }
  }

  const isStationA = ["BUENISIMA", "SUPERCRRIOLLA", "EN VIVO", "RADIO"].some((s) => partA.toUpperCase().includes(s));
  if (isStationA && partB.includes("-")) {
    const subParts = partB.split("-");
    partA = subParts[0].trim();
    partB = subParts.slice(1).join("-").trim();
  }

  const resolved = await resolveMusicArtwork(partA, partB);
  if (resolved) {
    return resolved;
  }

  return {
    title: formatTitleCase(partB || partA),
    artist: partB ? formatTitleCase(partA) : fallbackStation,
    cover: DEFAULT_RADIO_COVER,
    updatedAt: Date.now()
  };
}

/**
 * Client-side Icecast JSON parser & multi-fallback fetcher for static hosting environments.
 */
export async function fetchIcecastStatusFromBrowser(
  streamUrl: string
): Promise<{ rawTitle: string; listeners?: number } | null> {
  try {
    const parsed = new URL(streamUrl);
    const host = parsed.host;
    const mountPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/live';

    const httpsStatus = `https://${host}/status-json.xsl`;
    const httpStatus = `http://${host}/status-json.xsl`;

    const urlsToTry = [
      httpsStatus, // Direct (works in desktop Chrome/Firefox when Access-Control-Allow-Origin: * is sent)
      `https://api.allorigins.win/raw?url=${encodeURIComponent(httpStatus)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(httpStatus)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(httpsStatus)}`
    ];

    for (const target of urlsToTry) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const res = await fetch(target, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) continue;

        const text = await res.text();
        if (!text || text.trim().startsWith('<')) continue;

        const cleaned = text.trim().replace(/,\s*([}\]])/g, '$1');
        try {
          const data = JSON.parse(cleaned);
          const source = data?.icestats?.source;
          if (source) {
            const arr = Array.isArray(source) ? source : [source];
            const best =
              arr.find((s: any) => s?.listenurl?.includes(mountPath) && s?.title && s.title !== '-') ||
              arr.find((s: any) => s?.title && s.title !== '-') ||
              arr[0];
            const extracted = best?.title || best?.yp_currently_playing;
            if (extracted && extracted !== '-') {
              return {
                rawTitle: String(extracted).trim(),
                listeners: typeof best?.listeners === 'number' ? best.listeners : undefined
              };
            }
          }
        } catch {
          const match = text.match(/"(?:title|yp_currently_playing|StreamTitle)"\s*:\s*"([^"]+)"/i);
          if (match?.[1] && match[1] !== '-') {
            return { rawTitle: match[1].trim() };
          }
        }
      } catch {
        // Continue to next URL
      }
    }
  } catch {
    // Invalid URL
  }
  return null;
}
