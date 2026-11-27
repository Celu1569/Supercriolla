// 100% Free, Zero-Key Verified Song & Artist Insights Engine
// Strict anti-mismatch verification over Wikipedia ES/EN Action API + Apple iTunes Search Catalog.
// Uses single-request generator=search queries to stay fast and respect Wikimedia rate limits.
// If verified real information is not found, returns { found: false } so positive station messages are shown.

import { SongInsightsData, SongInsightsSource } from '../types';
import { cleanSongString, formatTitleCase, normalizeTokens, tokenOverlapScore } from './musicMetadata';

const freeCache = new Map<string, { data: SongInsightsData; expiresAt: number }>();

const NON_SONG_WORDS = [
  'SINTONIZANDO',
  'BUENISIMA',
  'BUENÍSIMA',
  'BUENA VIBRA',
  'EN VIVO',
  'LOCUCION',
  'LOCUCIÓN',
  'PROMO',
  'IDENTIFICACION',
  'IDENTIFICACIÓN',
  'ORBAN',
  'CUÑA',
  'COMERCIAL',
  'PUBLICIDAD',
  'STREAMING',
  'RADIO EN VIVO',
  'DESCONOCIDO',
  'UNKNOWN',
  'ARTISTA DESCONOCIDO',
];

const ARTIST_IDENTITY_PATTERN =
  /\b(cantante|cantautor|cantautora|músico|música|compositor|compositora|rapero|rapera|intérprete|banda|grupo musical|agrupación musical|agrupación|dúo musical|dúo|trío|orquesta|salsero|merenguero|reguetonero|productor musical|productor discográfico|disjockey|vocalista|singer|songwriter|musician|rapper|musical group|rock band|pop band)\b/i;

const SONG_IDENTITY_PATTERN =
  /\b(canción|sencillo|tema musical|bolero|balada|grabada por|interpretada por|interpretado por|compuesta por|compuesto por|escrita por|escrito por|del álbum|primer sencillo|segundo sencillo|tercer sencillo|song by|single by)\b/i;

const NON_ARTIST_EXCLUSIONS = [
  'es una canción',
  'es un sencillo',
  'es un álbum',
  'es un disco',
  'es una película',
  'es una telenovela',
  'es una serie',
  'es un municipio',
  'es una ciudad',
  'es un distrito',
  'es una localidad',
  'fue un futbolista',
  'es un futbolista',
  'es un político',
  'fue un político',
  'puede referirse a',
];

export const isStationNonSong = (title: string, artist: string): boolean => {
  const t = (title || '').trim();
  const a = (artist || '').trim();
  if (!t || t === '-' || t.length < 2) return true;
  const upperT = t.toUpperCase();
  const upperAll = `${t} ${a}`.toUpperCase();
  if (
    NON_SONG_WORDS.some((w) => upperT === w) ||
    upperT.includes('BUENISIMA') ||
    upperT.includes('BUENÍSIMA') ||
    upperT.includes('SINTONIZANDO')
  ) {
    return true;
  }
  if (['PROMO', 'LOCUCION', 'LOCUCIÓN', 'ORBAN', 'CUÑA', 'IDENTIFICACION', 'IDENTIFICACIÓN'].some((w) => upperAll.includes(w))) {
    return true;
  }
  return false;
};

const stripParenthetical = (str: string): string =>
  (str || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

const normalizeExact = (str: string): string =>
  normalizeTokens(stripParenthetical(str)).join(' ');

const isBadWikiPageTitle = (wikiTitle: string): boolean => {
  const lower = (wikiTitle || '').toLowerCase();
  return (
    lower.startsWith('anexo:') ||
    lower.startsWith('categoría:') ||
    lower.startsWith('category:') ||
    lower.startsWith('wikipedia:') ||
    lower.startsWith('discografía de') ||
    lower.startsWith('discography') ||
    lower.startsWith('premios') ||
    lower.startsWith('filmografía') ||
    lower.includes('(desambiguación)') ||
    lower.includes('(disambiguation)')
  );
};

const splitArtistCandidates = (artist: string): string[] => {
  const clean = cleanSongString(artist);
  if (!clean) return [];
  const candidates: string[] = [clean];

  const primary = clean
    .split(/\s+(?:feat\.?|ft\.?|featuring|with|con|vs\.?|x)\s+|,\s*/i)[0]
    ?.trim();
  if (primary && primary.length >= 2 && primary.toLowerCase() !== clean.toLowerCase()) {
    candidates.push(primary);
  }
  return candidates;
};

const splitSentences = (text: string): string[] => {
  if (!text) return [];
  return text
    .replace(/\s+/g, ' ')
    .replace(/\[[^\]]*\]/g, '')
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ«"¡(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 28);
};

const pickConciseText = (sentences: string[], maxChars = 340, maxSentences = 3): string => {
  let out = '';
  let count = 0;
  for (const s of sentences) {
    if (count >= maxSentences) break;
    const candidate = out ? `${out} ${s}` : s;
    if (candidate.length <= maxChars || count === 0) {
      out = candidate.length > maxChars + 55 ? `${candidate.slice(0, maxChars).trim()}...` : candidate;
      count++;
    } else {
      break;
    }
  }
  return out.trim();
};

const fetchJsonSafe = async (url: string, timeoutMs = 4500): Promise<any | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Api-User-Agent': 'Buenisima877FMPlayer/1.0 (https://buenisima877fm.com)',
    };
    if (typeof window === 'undefined') {
      headers['User-Agent'] = 'Buenisima877FMPlayer/1.0 (https://buenisima877fm.com)';
    }
    const res = await fetch(url, {
      signal: controller.signal,
      headers,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

interface WikiHit {
  title: string;
  extract: string;
  description: string;
  url: string;
  lang: 'es' | 'en';
}

// Single-request Wikipedia generator=search returning ordered pages with extracts, descriptions & URLs
const queryWikiCandidates = async (lang: 'es' | 'en', query: string, limit = 4): Promise<WikiHit[]> => {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    query
  )}&gsrlimit=${limit}&prop=extracts|description|info&inprop=url&exintro=1&explaintext=1&exsentences=7&format=json&origin=*`;
  const data = await fetchJsonSafe(url, 4500);
  const pagesObj = data?.query?.pages;
  if (!pagesObj) return [];

  const pages = Object.values(pagesObj) as any[];
  pages.sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

  return pages
    .filter((p) => p?.title && p?.extract)
    .map((p) => ({
      title: String(p.title),
      extract: String(p.extract),
      description: String(p.description || ''),
      url: String(p.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`),
      lang,
    }));
};

const fetchSpanishLanglinkTitle = async (enPageTitle: string): Promise<string | null> => {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=es&titles=${encodeURIComponent(
    enPageTitle
  )}&format=json&origin=*`;
  const data = await fetchJsonSafe(url, 3500);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const firstPage = Object.values(pages)[0] as any;
  const esTitle = firstPage?.langlinks?.[0]?.['*'];
  return esTitle ? String(esTitle) : null;
};

const fetchWikiPageByExactTitle = async (lang: 'es' | 'en', exactTitle: string): Promise<WikiHit | null> => {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    exactTitle
  )}&prop=extracts|description|info&inprop=url&exintro=1&explaintext=1&exsentences=7&format=json&origin=*`;
  const data = await fetchJsonSafe(url, 4000);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const p = Object.values(pages)[0] as any;
  if (!p?.title || !p?.extract) return null;
  return {
    title: String(p.title),
    extract: String(p.extract),
    description: String(p.description || ''),
    url: String(p.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`),
    lang,
  };
};

// Strictly verified Artist lookup on Wikipedia ES (with EN -> ES langlink bridge)
const searchVerifiedArtistWiki = async (artistCandidates: string[]): Promise<WikiHit | null> => {
  for (const candidate of artistCandidates) {
    const normQuery = normalizeExact(candidate);
    if (!normQuery || normQuery.length < 2) continue;

    // 1. Single search request in Spanish Wikipedia with music context
    const hits = await queryWikiCandidates('es', `${candidate} cantante OR banda OR músico`, 5);
    for (const hit of hits) {
      if (isBadWikiPageTitle(hit.title)) continue;
      const normWikiTitle = normalizeExact(hit.title);
      const titleScore = tokenOverlapScore(candidate, stripParenthetical(hit.title));
      const isExactOrStrongTitle =
        normWikiTitle === normQuery ||
        (titleScore >= 0.85 && normalizeTokens(candidate).length > 0);
      if (!isExactOrStrongTitle) continue;

      const leadCheck = `${hit.description} ${hit.extract.slice(0, 420)}`.toLowerCase();
      if (NON_ARTIST_EXCLUSIONS.some((ex) => leadCheck.includes(ex))) continue;
      if (!ARTIST_IDENTITY_PATTERN.test(leadCheck)) continue;

      return hit;
    }

    // 2. Fallback: find strictly on EN Wikipedia (single query), then jump to its official ES langlink
    const enHits = await queryWikiCandidates('en', `${candidate} singer OR band OR musician`, 4);
    for (const hit of enHits) {
      if (isBadWikiPageTitle(hit.title)) continue;
      const titleScore = tokenOverlapScore(candidate, stripParenthetical(hit.title));
      if (normalizeExact(hit.title) !== normQuery && titleScore < 0.85) continue;

      const enLead = `${hit.description} ${hit.extract.slice(0, 380)}`.toLowerCase();
      if (!ARTIST_IDENTITY_PATTERN.test(enLead)) continue;

      const esLinkedTitle = await fetchSpanishLanglinkTitle(hit.title);
      if (!esLinkedTitle || isBadWikiPageTitle(esLinkedTitle)) continue;

      const esHit = await fetchWikiPageByExactTitle('es', esLinkedTitle);
      if (!esHit) continue;
      const esLead = `${esHit.description} ${esHit.extract.slice(0, 420)}`.toLowerCase();
      if (NON_ARTIST_EXCLUSIONS.some((ex) => esLead.includes(ex))) continue;

      return esHit;
    }
  }

  return null;
};

// Strictly verified Song lookup on Wikipedia ES: MUST match both song title AND mention the artist
const searchVerifiedSongWiki = async (
  title: string,
  artistCandidates: string[]
): Promise<WikiHit | null> => {
  const cleanT = cleanSongString(title);
  if (!cleanT || cleanT.length < 2) return null;

  const primaryArtist = artistCandidates[0] || '';
  if (!primaryArtist) return null;

  const hits = await queryWikiCandidates('es', `"${cleanT}" ${primaryArtist} canción`, 5);
  for (const hit of hits) {
    if (isBadWikiPageTitle(hit.title)) continue;

    const cleanWikiTitle = stripParenthetical(hit.title);
    const titleScore = tokenOverlapScore(cleanT, cleanWikiTitle);
    if (titleScore < 0.8) continue;

    const lead = `${hit.description} ${hit.extract}`.toLowerCase();
    if (!SONG_IDENTITY_PATTERN.test(lead)) continue;

    const artistMentioned = artistCandidates.some((cand) => {
      const aTokens = normalizeTokens(cand);
      if (aTokens.length === 0) return false;
      const bodyNorm = ` ${normalizeTokens(`${hit.title} ${hit.extract}`).join(' ')} `;
      const matchedCount = aTokens.filter((tk) => bodyNorm.includes(` ${tk} `)).length;
      return matchedCount / aTokens.length >= 0.75;
    });
    if (!artistMentioned) continue;

    return hit;
  }

  return null;
};

interface ItunesTrackMeta {
  trackName: string;
  artistName: string;
  collectionName?: string;
  releaseYear?: string;
  genre?: string;
}

const isCompilationAlbum = (name: string): boolean =>
  /\b(greatest hits|best of|lo mejor|éxitos|exitos|colección|collection|anthology|antología|gold|platinum|essentials|super hits|grandes éxitos)\b/i.test(
    name || ''
  );

const lookupVerifiedItunesMeta = async (title: string, artist: string): Promise<ItunesTrackMeta | null> => {
  const cTitle = cleanSongString(title);
  const cArtist = cleanSongString(artist);
  if (!cTitle || !cArtist || cTitle.length < 2 || cArtist.length < 2) return null;

  const data = await fetchJsonSafe(
    `https://itunes.apple.com/search?term=${encodeURIComponent(`${cArtist} ${cTitle}`)}&media=music&limit=12&entity=song`,
    3500
  );
  const results = data?.results || [];
  const strictMatches: { score: number; year: number; isComp: boolean; item: any }[] = [];

  for (const r of results) {
    const rTrack = String(r.trackName || '');
    const rArtist = String(r.artistName || '');
    const combinedLower = `${rTrack} ${rArtist} ${r.collectionName || ''}`.toLowerCase();
    if (/\b(karaoke|tribute|tributo|made famous by|cover band|originally performed)\b/.test(combinedLower)) {
      continue;
    }

    const artistScore = tokenOverlapScore(cArtist, rArtist);
    const trackScore = tokenOverlapScore(cTitle, rTrack);
    const minScore = Math.min(artistScore, trackScore);
    const avgScore = (artistScore + trackScore) / 2;

    if (minScore >= 0.75 && avgScore >= 0.82) {
      const yearNum = Number(String(r.releaseDate || '').slice(0, 4)) || 9999;
      strictMatches.push({
        score: avgScore,
        year: yearNum,
        isComp: isCompilationAlbum(String(r.collectionName || '')),
        item: r,
      });
    }
  }

  if (strictMatches.length === 0) return null;

  strictMatches.sort((a, b) => {
    if (a.isComp !== b.isComp) return a.isComp ? 1 : -1;
    if (Math.abs(a.score - b.score) > 0.08) return b.score - a.score;
    return a.year - b.year;
  });

  const best = strictMatches[0].item;
  const yearMatch = String(best.releaseDate || '').match(/^(\d{4})/);
  return {
    trackName: best.trackName || cTitle,
    artistName: best.artistName || cArtist,
    collectionName: best.collectionName && !isCompilationAlbum(best.collectionName) ? best.collectionName : undefined,
    releaseYear: yearMatch?.[1],
    genre: best.primaryGenreName || undefined,
  };
};

export async function fetchFreeMusicInsights(
  rawTitle: string,
  rawArtist: string
): Promise<SongInsightsData> {
  const title = cleanSongString(rawTitle || '');
  const artist = cleanSongString(rawArtist || '');

  if (isStationNonSong(title, artist)) {
    return {
      found: false,
      title: rawTitle,
      artist: rawArtist,
      reason: 'station_placeholder',
    };
  }

  const artistIsInvalid =
    !artist ||
    artist.toUpperCase().includes('BUENISIMA') ||
    artist.toUpperCase().includes('BUENÍSIMA') ||
    artist.toUpperCase().includes('BUENA VIBRA') ||
    artist.toUpperCase().includes('DESCONOCIDO');

  if (artistIsInvalid) {
    return {
      found: false,
      title: rawTitle,
      artist: rawArtist,
      reason: 'not_found',
    };
  }

  const cacheKey = `${artist.toLowerCase()}:::${title.toLowerCase()}`;
  const cached = freeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const artistCandidates = splitArtistCandidates(artist);

  // Run verified lookups in parallel (1 iTunes + 1 song Wiki + 1 artist Wiki)
  const [itunesMeta, songWikiEs, artistWikiEs] = await Promise.all([
    lookupVerifiedItunesMeta(title, artistCandidates[0] || artist),
    searchVerifiedSongWiki(title, artistCandidates),
    searchVerifiedArtistWiki(artistCandidates),
  ]);

  const sources: SongInsightsSource[] = [];
  const seenUris = new Set<string>();
  const addSource = (titleLabel: string, uri: string) => {
    if (uri && !seenUris.has(uri)) {
      seenUris.add(uri);
      sources.push({ title: titleLabel, uri });
    }
  };

  let artistInfo = '';
  let songStory = '';
  let anecdote = '';
  let wikiSongYear = '';

  if (artistWikiEs) {
    const sentences = splitSentences(artistWikiEs.extract);
    if (sentences.length > 0) {
      artistInfo = pickConciseText(sentences, 340, 3);
      if (sentences.length > 3) {
        anecdote = pickConciseText(sentences.slice(3), 320, 2);
      }
      addSource(`Wikipedia: ${artistWikiEs.title}`, artistWikiEs.url);
    }
  }

  if (songWikiEs) {
    const songSentences = splitSentences(songWikiEs.extract);
    if (songSentences.length > 0) {
      songStory = pickConciseText(songSentences, 340, 3);
      if (songSentences.length > 3) {
        anecdote = pickConciseText(songSentences.slice(3), 320, 2);
      }
      const yr = songWikiEs.extract.match(/(?:año|en|lanzad[ao] en|publicad[ao] en|estrenad[ao] en|grabada en)\s+(19[5-9]\d|20[0-2]\d)/i);
      if (yr?.[1]) wikiSongYear = yr[1];
      addSource(`Wikipedia: ${songWikiEs.title}`, songWikiEs.url);
    }
  }

  if (!songStory && artistInfo && itunesMeta && itunesMeta.collectionName && itunesMeta.releaseYear) {
    const trackDisplay = formatTitleCase(itunesMeta.trackName || title);
    const artistDisplay = formatTitleCase(itunesMeta.artistName || artist);
    const cleanCollection = itunesMeta.collectionName.replace(/\s*\(Single\)$/i, '').trim();
    const isSingle = /\bsingle\b/i.test(itunesMeta.collectionName);
    songStory = isSingle
      ? `«${trackDisplay}» fue lanzada como sencillo oficial por ${artistDisplay} en ${itunesMeta.releaseYear}${itunesMeta.genre ? ` (${itunesMeta.genre})` : ''}.`
      : `«${trackDisplay}» pertenece al álbum «${cleanCollection}» de ${artistDisplay}, publicado en ${itunesMeta.releaseYear}${itunesMeta.genre ? ` dentro del género ${itunesMeta.genre}` : ''}.`;
  }

  const hasRealVerifiedInfo = Boolean((artistWikiEs && artistInfo) || (songWikiEs && songStory));

  const result: SongInsightsData = hasRealVerifiedInfo
    ? {
        found: true,
        title: itunesMeta?.trackName || title,
        artist: itunesMeta?.artistName || artist,
        year: wikiSongYear || itunesMeta?.releaseYear || '',
        genre: itunesMeta?.genre || '',
        artistInfo: artistInfo || undefined,
        songStory: songStory || undefined,
        anecdote: anecdote || undefined,
        sources: sources.slice(0, 2),
      }
    : {
        found: false,
        title,
        artist,
        reason: 'not_found',
      };

  freeCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + (hasRealVerifiedInfo ? 6 * 60 * 60 * 1000 : 10 * 60 * 1000),
  });

  return result;
}
