import { Handler } from '@netlify/functions';
import Parser from 'rss-parser';

const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['content:encoded', 'contentEncoded']
        ]
    }
});

function extractImage(item: any): string | null {
    // Check media:content
    if (item.mediaContent && item.mediaContent['$'] && item.mediaContent['$']['url']) {
        return item.mediaContent['$']['url'];
    }
    // Check enclosure
    if (item.enclosure && item.enclosure.url) {
        return item.enclosure.url;
    }
    // Check embedded image in content
    const htmlToSearch = item.contentEncoded || item.content || item.summary || '';
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    const match = imgRegex.exec(htmlToSearch);
    if (match && match[1]) {
        return match[1];
    }
    return null;
}

export const handler: Handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const urlsParam = event.queryStringParameters?.urls;
    if (!urlsParam) {
      return { 
          statusCode: 200, 
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify([]) 
      };
    }

    const feedUrls = urlsParam.split(',').map(u => u.trim()).filter(u => u.length > 0);
    const feedPromises = feedUrls.map(async (url) => {
        try {
            const feed = await parser.parseURL(url);
            return feed.items.map(item => {
                const img = extractImage(item);
                return {
                    id: Math.random().toString(36).substring(2, 10),
                    title: item.title || 'Sin Título',
                    summary: item.contentSnippet || item.summary || item.content || '',
                    content: item.contentEncoded || item.content || item.contentSnippet || '',
                    date: item.pubDate ? new Date(item.pubDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Fecha desconocida',
                    parsedDate: item.pubDate ? new Date(item.pubDate).getTime() : 0,
                    image: img || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000&auto=format&fit=crop', // Placeholder fallback
                    author: (item as any).creator || (item as any).author || feed.title || 'Redacción',
                    category: (item.categories && item.categories.length > 0 ? item.categories[0] : feed.title) || 'General',
                    url: item.link,
                    isPublished: true,
                    isRss: true
                };
            });
        } catch (e) {
            console.error(`Error parsing RSS ${url}:`, e);
            return [];
        }
    });

    const allFeedsArrays = await Promise.all(feedPromises);
    const allItems = allFeedsArrays.flat();

    // Sort by date (descending)
    allItems.sort((a, b) => b.parsedDate - a.parsedDate);

    // Limit to latest 30 to avoid huge payloads
    const limitedItems = allItems.slice(0, 30);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(limitedItems)
    };
  } catch (error) {
    console.error('RSS Fetch error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch RSS metadata' })
    };
  }
};
