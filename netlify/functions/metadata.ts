import type { Handler } from '@netlify/functions';
import http from 'http';
import https from 'https';

const DEFAULT_COVER = 'https://i.ibb.co/kVQLN1F1/Logo-Buenisima-esfera-512x256.png';
const DEFAULT_STREAM = 'https://redradioypc.com:8010/live';

const STOP_WORDS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'al', 'y', 'e', 'the', 'a', 'an', 'of', 'in', 'on', 'con', 'ft', 'feat']);

const normalizeTokens = (str: string): string[] => {
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

const tokenOverlapScore = (queryStr: string, candidateStr: string): number => {
  const qTokens = normalizeTokens(queryStr);
  const cTokens = normalizeTokens(candidateStr);
  if (qTokens.length === 0 || cTokens.length === 0) return 0;

  const cSet = new Set(cTokens);
  let matches = 0;
  for (const t of qTokens) {
    if (cSet.has(t) || cTokens.some((ct) => (ct.length >= 4 && t.length >= 4 && (ct.includes(t) || t.includes(ct))))) {
      matches++;
    }
  }
  const qRatio = matches / qTokens.length;
  const cRatio = matches / cTokens.length;
  return (qRatio * 0.7) + (cRatio * 0.3);
};

const formatTitleCase = (str: string) => {
  if (!str) return '';
  if (str === str.toUpperCase() && str.length > 3) {
    return str.toLowerCase().replace(/(?:^|\s|\/|-)\S/g, (char) => char.toUpperCase());
  }
  return str;
};

const cleanIcecastJsonText = (text: string): string => {
  return text
    .trim()
    .replace(/,\s*([}\]])/g, '$1');
};

const fetchTextInsecure = (targetUrl: string, timeoutMs = 4500): Promise<string> => {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      targetUrl,
      {
        rejectUnauthorized: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*'
        },
        timeout: timeoutMs
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
          if (body.length > 200_000) {
            req.destroy();
            resolve(body);
          }
        });
        res.on('end', () => resolve(body));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
};

const fetchJson = async (url: string, timeoutMs = 3500): Promise<any> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json'
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const searchMusicArtwork = async (tokenA: string, tokenB: string) => {
  const cleanStr = (s: string) =>
    (s || '')
      .replace(/\s*\([^)]*(?:oficial|audio|video|remaster|letra|lyrics|hd|4k|version)[^)]*\)/gi, '')
      .replace(/\s*\[[^\]]*(?:oficial|audio|video|remaster|letra|lyrics|hd|4k|version)[^\]]*\]/gi, '')
      .replace(/\s*\(.*?\)/g, '')
      .replace(/\s*\[.*?\]/g, '')
      .replace(/(?:feat|ft)\.?\s+.*$/i, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

  const cA = cleanStr(tokenA);
  const cB = cleanStr(tokenB);
  const queries = [
    cB ? `${cA} ${cB}` : cA,
    cB ? `${cB} ${cA}` : null,
    cA.length > 3 ? cA : null,
    cB.length > 3 ? cB : null
  ].filter(Boolean) as string[];

  // 1. iTunes
  for (const q of queries) {
    const data = await fetchJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=10&entity=song`,
      3200
    );
    const results = data?.results || [];
    let bestMatch: { score: number; cover: string; title: string; artist: string } | null = null;

    for (const item of results) {
      if (!item.artworkUrl100) continue;
      const track = item.trackName || '';
      const artist = item.artistName || '';

      if (cB) {
        const directScore = (tokenOverlapScore(cA, artist) + tokenOverlapScore(cB, track)) / 2;
        const invertedScore = (tokenOverlapScore(cA, track) + tokenOverlapScore(cB, artist)) / 2;
        const minDirect = Math.min(tokenOverlapScore(cA, artist), tokenOverlapScore(cB, track));
        const minInverted = Math.min(tokenOverlapScore(cA, track), tokenOverlapScore(cB, artist));

        const isDirect = minDirect >= 0.45 && directScore >= 0.55;
        const isInverted = minInverted >= 0.45 && invertedScore >= 0.55;
        const bestPairScore = Math.max(isDirect ? directScore : 0, isInverted ? invertedScore : 0);

        if (bestPairScore > 0 && (!bestMatch || bestPairScore > bestMatch.score)) {
          bestMatch = {
            score: bestPairScore,
            cover: item.artworkUrl100.replace('100x100', '1000x1000'),
            title: track,
            artist
          };
        }
      } else {
        const combinedScore = tokenOverlapScore(cA, `${artist} ${track}`);
        if (combinedScore >= 0.6 && (!bestMatch || combinedScore > bestMatch.score)) {
          bestMatch = {
            score: combinedScore,
            cover: item.artworkUrl100.replace('100x100', '1000x1000'),
            title: track,
            artist
          };
        }
      }
    }

    if (bestMatch) {
      return {
        cover: bestMatch.cover,
        title: bestMatch.title,
        artist: bestMatch.artist
      };
    }
  }

  // 2. Deezer
  for (const q of queries.slice(0, 2)) {
    const data = await fetchJson(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=8`, 3000);
    const items = data?.data || [];
    let bestMatch: { score: number; cover: string; title: string; artist: string } | null = null;

    for (const item of items) {
      const cover = item.album?.cover_xl || item.album?.cover_big || item.album?.cover_medium;
      if (!cover) continue;
      const track = item.title || '';
      const artist = item.artist?.name || '';

      if (cB) {
        const directScore = (tokenOverlapScore(cA, artist) + tokenOverlapScore(cB, track)) / 2;
        const invertedScore = (tokenOverlapScore(cA, track) + tokenOverlapScore(cB, artist)) / 2;
        const minDirect = Math.min(tokenOverlapScore(cA, artist), tokenOverlapScore(cB, track));
        const minInverted = Math.min(tokenOverlapScore(cA, track), tokenOverlapScore(cB, artist));

        const isDirect = minDirect >= 0.45 && directScore >= 0.55;
        const isInverted = minInverted >= 0.45 && invertedScore >= 0.55;
        const bestPairScore = Math.max(isDirect ? directScore : 0, isInverted ? invertedScore : 0);

        if (bestPairScore > 0 && (!bestMatch || bestPairScore > bestMatch.score)) {
          bestMatch = { score: bestPairScore, cover, title: track, artist };
        }
      } else {
        const combinedScore = tokenOverlapScore(cA, `${artist} ${track}`);
        if (combinedScore >= 0.6 && (!bestMatch || combinedScore > bestMatch.score)) {
          bestMatch = { score: combinedScore, cover, title: track, artist };
        }
      }
    }

    if (bestMatch) {
      return {
        cover: bestMatch.cover,
        title: bestMatch.title,
        artist: bestMatch.artist
      };
    }
  }

  return {
    cover: DEFAULT_COVER,
    title: formatTitleCase(cB || cA) || 'BUENÍSIMA 87.7 FM',
    artist: cB ? formatTitleCase(cA) : 'La Radio de la Buena Vibra'
  };
};

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const streamUrl = event.queryStringParameters?.url || DEFAULT_STREAM;
  let rawTitle = '';
  let listeners = 0;

  try {
    const parsedUrl = new URL(streamUrl);
    const host = parsedUrl.host;
    const mountPath = parsedUrl.pathname && parsedUrl.pathname !== '/' ? parsedUrl.pathname : '/live';

    const candidates = [`http://${host}/status-json.xsl`, `https://${host}/status-json.xsl`];
    for (const statusUrl of candidates) {
      try {
        const text = await fetchTextInsecure(statusUrl, 4000);
        const cleaned = cleanIcecastJsonText(text);
        const json = JSON.parse(cleaned);
        const sources = json?.icestats?.source;
        if (sources) {
          const arr = Array.isArray(sources) ? sources : [sources];
          const preferred =
            arr.find((s: any) => s?.listenurl?.includes(mountPath) && s?.title && s.title !== '-') ||
            arr.find(
              (s: any) =>
                s?.title &&
                s.title !== '-' &&
                !['STREAMING', 'WEB', 'ORBAN', 'BUENISIMA'].includes(String(s.title).toUpperCase().trim())
            ) ||
            arr[0];

          if (preferred) {
            rawTitle = String(preferred.title || preferred.yp_currently_playing || '').trim();
            if (typeof preferred.listeners === 'number') {
              listeners = preferred.listeners;
            }
          }
        }
        if (rawTitle) break;
      } catch {
        // Try next candidate
      }
    }

    // Fallback to Shoutcast 7.html
    if (!rawTitle) {
      for (const base of [`http://${host}`, `https://${host}`]) {
        try {
          const text = await fetchTextInsecure(`${base}/7.html`, 2500);
          const parts = text.split(',');
          if (parts.length >= 7) {
            const candidate = parts.slice(6).join(',').replace(/<[^>]*>/g, '').trim();
            if (candidate) {
              rawTitle = candidate;
              listeners = Number(parts[0].replace(/\D/g, '')) || 0;
              break;
            }
          }
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // URL error
  }

  if (!rawTitle || rawTitle === '-' || rawTitle === 'Sintonizando...') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        title: 'BUENÍSIMA 87.7 FM',
        artist: 'La Radio de la Buena Vibra',
        cover: DEFAULT_COVER,
        listeners,
        updatedAt: Date.now()
      })
    };
  }

  let partA = rawTitle;
  let partB = '';
  const separators = [' - ', ' : ', ' – ', ' — ', ' | '];
  for (const sep of separators) {
    if (rawTitle.includes(sep)) {
      const parts = rawTitle.split(sep);
      partA = parts[0].trim();
      partB = parts.slice(1).join(sep).trim();
      break;
    }
  }

  const isStationPrefix = ['BUENISIMA', 'SUPERCRRIOLLA', 'EN VIVO', 'RADIO'].some((s) =>
    partA.toUpperCase().includes(s)
  );
  if (isStationPrefix && partB.includes('-')) {
    const subParts = partB.split('-');
    partA = subParts[0].trim();
    partB = subParts.slice(1).join('-').trim();
  }

  const resolved = await searchMusicArtwork(partA, partB);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      title: resolved.title,
      artist: resolved.artist,
      cover: resolved.cover,
      rawTitle,
      listeners,
      updatedAt: Date.now()
    })
  };
};
