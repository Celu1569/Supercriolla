import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface SongInsightsSource {
  title: string;
  uri: string;
}

export interface SongInsightsPayload {
  found: boolean;
  title: string;
  artist: string;
  year?: string;
  genre?: string;
  artistInfo?: string;
  songStory?: string;
  anecdote?: string;
  sources?: SongInsightsSource[];
  reason?: string;
}

const NON_SONG_KEYWORDS = [
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
];

const insightsCache = new Map<string, { data: SongInsightsPayload; expiresAt: number }>();

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;

const getGeminiClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    const err: any = new Error('GEMINI_API_KEY no está configurada en el servidor.');
    err.status = 503;
    throw err;
  }
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedApiKey = apiKey;
  }
  return cachedClient;
};

export const isStationPlaceholderTrack = (title: string, artist: string): boolean => {
  const cleanTitle = (title || '').trim();
  const cleanArtist = (artist || '').trim();
  if (!cleanTitle || cleanTitle === '-') return true;
  if (cleanTitle.length < 2) return true;

  const upperCombined = `${cleanTitle} ${cleanArtist}`.toUpperCase();
  if (
    NON_SONG_KEYWORDS.some((kw) => cleanTitle.toUpperCase() === kw || cleanTitle.toUpperCase().includes('BUENISIMA') || cleanTitle.toUpperCase().includes('BUENÍSIMA') || cleanTitle.toUpperCase().includes('SINTONIZANDO'))
  ) {
    return true;
  }

  // If both title and artist look like pure station promo text
  if (
    ['PROMO', 'LOCUCION', 'ORBAN', 'CUÑA'].some((kw) => upperCombined.includes(kw))
  ) {
    return true;
  }

  return false;
};

const extractJsonBlock = (rawText: string): any | null => {
  if (!rawText) return null;
  const trimmed = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
};

export async function fetchSongInsightsFromGemini(
  rawTitle: string,
  rawArtist: string
): Promise<SongInsightsPayload> {
  const title = (rawTitle || '').trim();
  const artist = (rawArtist || '').trim();

  if (isStationPlaceholderTrack(title, artist)) {
    return {
      found: false,
      title,
      artist,
      reason: 'station_placeholder',
    };
  }

  const cacheKey = `${artist.toLowerCase()}:::${title.toLowerCase()}`;
  const cached = insightsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const ai = getGeminiClient();

  const songDescriptor = artist && !artist.toUpperCase().includes('BUENISIMA') && !artist.toUpperCase().includes('BUENÍSIMA') && !artist.toUpperCase().includes('BUENA VIBRA')
    ? `"${title}" de ${artist}`
    : `"${title}"`;

  const prompt = `Busca información real y verificada sobre la canción ${songDescriptor}.
Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional fuera del JSON) con esta estructura exacta:
{
  "found": boolean,
  "year": string,
  "genre": string,
  "artistInfo": string,
  "songStory": string,
  "anecdote": string
}

Reglas estrictas:
1. Usa la búsqueda web para verificar los hechos antes de responder. Nunca inventes fechas, álbumes, autores ni anécdotas.
2. Si no encuentras información musical real y confiable sobre esa canción o artista específico (por ejemplo si es un jingle de radio, locución o pista desconocida), devuelve {"found": false, "year": "", "genre": "", "artistInfo": "", "songStory": "", "anecdote": ""}.
3. Si encuentras información verificada, pon "found": true y redacta todo en español claro, cercano y ameno para oyentes de radio:
   - "year": año de lanzamiento aproximado o exacto si está verificado (ej. "2018"), o "".
   - "genre": género musical principal en 1-3 palabras (ej. "Salsa", "Pop Latino", "Merengue"), o "".
   - "artistInfo": 2 frases precisas sobre el artista o agrupación (origen, trayectoria o estilo). Máximo 240 caracteres.
   - "songStory": 2 frases precisas sobre la historia, inspiración, álbum o significado de la canción. Máximo 260 caracteres.
   - "anecdote": 1 o 2 frases con una anécdota real o dato curioso interesante sobre la canción o su grabación. Máximo 240 caracteres.`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Eres un investigador musical y locutor cultural experto para una emisora de radio latina. Solo entregas datos reales verificables mediante búsqueda web y respondes estrictamente en JSON válido.',
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
  } catch (err: any) {
    const rawMsg = String(err?.message || '');
    let statusCode = typeof err?.status === 'number' ? err.status : 502;
    let friendly = 'No se pudo consultar la información musical en este momento.';

    if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      statusCode = 429;
      friendly = 'Se alcanzó el límite de cuota de consultas de Gemini API. Verifica tu plan o clave en Settings > Secrets.';
    } else if (rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
      statusCode = 403;
      friendly = 'La clave GEMINI_API_KEY no tiene permisos o es inválida. Verifica la configuración en Settings > Secrets.';
    }

    const wrapped: any = new Error(friendly);
    wrapped.status = statusCode;
    throw wrapped;
  }

  const parsed = extractJsonBlock(response.text || '');

  const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources: SongInsightsSource[] = [];
  const seenUris = new Set<string>();
  for (const chunk of rawChunks) {
    const uri = chunk?.web?.uri;
    const srcTitle = chunk?.web?.title;
    if (uri && !seenUris.has(uri)) {
      seenUris.add(uri);
      sources.push({
        uri,
        title: srcTitle || 'Fuente verificada',
      });
    }
    if (sources.length >= 2) break;
  }

  if (!parsed || parsed.found !== true || (!parsed.artistInfo && !parsed.songStory && !parsed.anecdote)) {
    const emptyPayload: SongInsightsPayload = {
      found: false,
      title,
      artist,
      reason: 'not_found',
    };
    insightsCache.set(cacheKey, { data: emptyPayload, expiresAt: Date.now() + 15 * 60 * 1000 });
    return emptyPayload;
  }

  const payload: SongInsightsPayload = {
    found: true,
    title,
    artist,
    year: typeof parsed.year === 'string' ? parsed.year.trim().slice(0, 20) : '',
    genre: typeof parsed.genre === 'string' ? parsed.genre.trim().slice(0, 40) : '',
    artistInfo: typeof parsed.artistInfo === 'string' ? parsed.artistInfo.trim() : '',
    songStory: typeof parsed.songStory === 'string' ? parsed.songStory.trim() : '',
    anecdote: typeof parsed.anecdote === 'string' ? parsed.anecdote.trim() : '',
    sources,
  };

  insightsCache.set(cacheKey, { data: payload, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
  return payload;
}
