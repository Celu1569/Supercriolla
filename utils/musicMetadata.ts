// Universal Music Metadata & High-Res Album Artwork Resolver
// Works both in browser (client-side) and server-side

export const DEFAULT_RADIO_COVER = "https://i.ibb.co/kVQLN1F1/Logo-Buenisima-esfera-512x256.png";

export interface ResolvedSong {
  title: string;
  artist: string;
  cover: string;
  raw?: string;
  updatedAt?: number;
}

// In-memory artwork cache to prevent redundant API calls
const artworkCache = new Map<string, ResolvedSong>();

// Clean up radio string noise
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

export const formatTitleCase = (str: string): string => {
  if (!str) return '';
  if (str === str.toUpperCase() && str.length > 3) {
    return str.toLowerCase().replace(/(?:^|\s|\/|-)\S/g, (char) => char.toUpperCase());
  }
  return str;
};

// Check if a cover is a real music artwork (not station logo)
export const isRealMusicCover = (cover?: string | null): boolean => {
  if (!cover || !cover.startsWith('http')) return false;
  const lower = cover.toLowerCase();
  return !lower.includes('logo-buenisima') && !lower.includes('i.ibb.co') && !lower.includes('placeholder');
};

/**
 * Smart bidirectional album artwork search (iTunes + Deezer)
 * Handles "Artist - Title", "Title - Artist", reversed tags, and Latin music catalogs.
 */
export async function resolveMusicArtwork(tokenA: string, tokenB: string = ''): Promise<ResolvedSong | null> {
  const cleanA = cleanSongString(tokenA);
  const cleanB = cleanSongString(tokenB);
  const cacheKey = `${cleanA.toLowerCase()}:::${cleanB.toLowerCase()}`;

  if (artworkCache.has(cacheKey)) {
    return artworkCache.get(cacheKey)!;
  }

  // 1. Try iTunes with queries and bidirectional cross-matching
  const itunesQueries = [
    cleanB ? `${cleanA} ${cleanB}` : cleanA,
    cleanB ? `${cleanB} ${cleanA}` : null,
    cleanA.length > 4 ? cleanA : null,
    cleanB.length > 4 ? cleanB : null,
  ].filter(Boolean) as string[];

  for (const q of itunesQueries) {
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=8&entity=song`, {
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];

        for (const item of results) {
          if (!item.artworkUrl100) continue;

          const trackLower = (item.trackName || '').toLowerCase();
          const artistLower = (item.artistName || '').toLowerCase();
          const aLower = cleanA.toLowerCase();
          const bLower = cleanB.toLowerCase();

          // Case 1: tokenA is Title, tokenB is Artist (Very common on Icecast!)
          const titleMatchesA = aLower.length >= 3 && (trackLower.includes(aLower) || aLower.includes(trackLower));
          const artistMatchesB = bLower.length >= 3 && (artistLower.includes(bLower) || bLower.includes(artistLower));
          if (titleMatchesA && artistMatchesB) {
            const highRes = item.artworkUrl100.replace('100x100', '1000x1000');
            const resolved: ResolvedSong = {
              title: item.trackName || formatTitleCase(cleanA),
              artist: item.artistName || formatTitleCase(cleanB),
              cover: highRes,
              updatedAt: Date.now()
            };
            artworkCache.set(cacheKey, resolved);
            return resolved;
          }

          // Case 2: tokenA is Artist, tokenB is Title
          const artistMatchesA = aLower.length >= 3 && (artistLower.includes(aLower) || aLower.includes(artistLower));
          const titleMatchesB = bLower.length >= 3 && (trackLower.includes(bLower) || bLower.includes(trackLower));
          if (artistMatchesA && titleMatchesB) {
            const highRes = item.artworkUrl100.replace('100x100', '1000x1000');
            const resolved: ResolvedSong = {
              title: item.trackName || formatTitleCase(cleanB),
              artist: item.artistName || formatTitleCase(cleanA),
              cover: highRes,
              updatedAt: Date.now()
            };
            artworkCache.set(cacheKey, resolved);
            return resolved;
          }

          // Case 3: Combined inclusion
          const combined = `${artistLower} ${trackLower}`;
          if ((!cleanB && (combined.includes(aLower) || aLower.includes(trackLower))) ||
              (cleanB && combined.includes(aLower) && combined.includes(bLower))) {
            const highRes = item.artworkUrl100.replace('100x100', '1000x1000');
            const resolved: ResolvedSong = {
              title: item.trackName || formatTitleCase(cleanB || cleanA),
              artist: item.artistName || formatTitleCase(cleanA || cleanB),
              cover: highRes,
              updatedAt: Date.now()
            };
            artworkCache.set(cacheKey, resolved);
            return resolved;
          }
        }
      }
    } catch (_) {
      // Continue to next query or Deezer
    }
  }

  // 2. Try Deezer Search as secondary high-fidelity provider (Huge Latin music catalog)
  const deezerQueries = [
    cleanB ? `${cleanA} ${cleanB}` : cleanA,
    cleanB ? `${cleanB} ${cleanA}` : null
  ].filter(Boolean) as string[];

  for (const q of deezerQueries) {
    try {
      const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        const items = data.data || [];
        for (const item of items) {
          const cover = item.album?.cover_xl || item.album?.cover_big || item.album?.cover_medium;
          if (!cover) continue;

          const trackLower = (item.title || '').toLowerCase();
          const artistLower = (item.artist?.name || '').toLowerCase();
          const aLower = cleanA.toLowerCase();
          const bLower = cleanB.toLowerCase();

          const hasA = trackLower.includes(aLower) || artistLower.includes(aLower) || aLower.includes(trackLower);
          const hasB = !cleanB || trackLower.includes(bLower) || artistLower.includes(bLower) || bLower.includes(artistLower);

          if (hasA && hasB) {
            const resolved: ResolvedSong = {
              title: item.title || formatTitleCase(cleanB || cleanA),
              artist: item.artist?.name || formatTitleCase(cleanA || cleanB),
              cover: cover,
              updatedAt: Date.now()
            };
            artworkCache.set(cacheKey, resolved);
            return resolved;
          }
        }
      }
    } catch (_) {}
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

  // Known stream filler or DJ voiceovers
  const STUCK_WORDS = ['KENNY GARCIA', 'GLENDY GARCIA', 'WAKE KENNY GARCIA', 'LOCUCION DE HORA', 'PROMO', 'ORBAN'];
  const isStuckWord = STUCK_WORDS.some(w => trimmed.toUpperCase().includes(w));

  if (!trimmed || trimmed === '-' || trimmed === 'Sintonizando...' || isStuckWord) {
    return {
      title: fallbackStation,
      artist: isStuckWord ? formatTitleCase(trimmed) : fallbackSlogan,
      cover: DEFAULT_RADIO_COVER,
      updatedAt: Date.now()
    };
  }

  // Split patterns
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

  // Check if one part is just station name
  const isStationA = ["BUENISIMA", "SUPERCRRIOLLA", "EN VIVO", "RADIO"].some(s => partA.toUpperCase().includes(s));
  if (isStationA && partB.includes("-")) {
    const subParts = partB.split("-");
    partA = subParts[0].trim();
    partB = subParts.slice(1).join("-").trim();
  }

  // Query high-res artwork & true song/artist
  const resolved = await resolveMusicArtwork(partA, partB);
  if (resolved) {
    return resolved;
  }

  // Fallback: title case
  return {
    title: formatTitleCase(partB || partA),
    artist: partB ? formatTitleCase(partA) : fallbackStation,
    cover: DEFAULT_RADIO_COVER,
    updatedAt: Date.now()
  };
}
