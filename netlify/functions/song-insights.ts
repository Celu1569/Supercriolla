import type { Handler } from '@netlify/functions';
import { fetchSongInsightsFromGemini } from '../../utils/songInsightsService';
import { fetchFreeMusicInsights } from '../../utils/freeMusicInsights';

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=300',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    let title = event.queryStringParameters?.title || '';
    let artist = event.queryStringParameters?.artist || '';
    let mode = event.queryStringParameters?.mode === 'gemini' ? 'gemini' : 'free';

    if (event.httpMethod === 'POST' && event.body) {
      const body = JSON.parse(event.body);
      if (typeof body.title === 'string') title = body.title;
      if (typeof body.artist === 'string') artist = body.artist;
      if (body.mode === 'gemini') mode = 'gemini';
    }

    const result =
      mode === 'gemini'
        ? await fetchSongInsightsFromGemini(title, artist)
        : await fetchFreeMusicInsights(title, artist);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 502;
    return {
      statusCode: status,
      headers,
      body: JSON.stringify({
        error: err?.message || 'No se pudo consultar la información de la canción.',
      }),
    };
  }
};
