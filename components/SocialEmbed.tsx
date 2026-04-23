import React from 'react';

interface SocialEmbedProps {
  url: string;
  type: 'instagram' | 'tiktok' | 'facebook' | 'twitter' | 'youtube';
  width?: string | number;
}

export const SocialEmbed: React.FC<SocialEmbedProps> = ({ url, type, width = '100%' }) => {
  if (!url) return null;

  // Instagram: Simple iframe embed
  if (type === 'instagram') {
    const cleanUrl = url.split('?')[0];
    const embedUrl = `${cleanUrl}${cleanUrl.endsWith('/') ? '' : '/'}embed`;
    return (
      <div className="w-full h-full min-h-[450px]">
        <iframe
          src={embedUrl}
          className="w-full h-full border-0 rounded-lg"
          allowTransparency
          frameBorder="0"
          scrolling="no"
          title="Instagram Embed"
        ></iframe>
      </div>
    );
  }

  // TikTok: Simple iframe embed
  if (type === 'tiktok') {
    const videoId = url.split('/video/')[1]?.split('?')[0];
    if (!videoId) return <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">View on TikTok</a>;
    return (
      <div className="w-full h-full min-h-[550px]">
        <iframe
          src={`https://www.tiktok.com/embed/v2/${videoId}`}
          className="w-full h-full border-0 rounded-lg"
          allow="fullscreen"
          title="TikTok Embed"
        ></iframe>
      </div>
    );
  }

  // Facebook: Official Plugins Post embed
  if (type === 'facebook') {
    const encodedUrl = encodeURIComponent(url);
    return (
      <div className="w-full h-full min-h-[500px]">
        <iframe
          src={`https://www.facebook.com/plugins/post.php?href=${encodedUrl}&show_text=true&width=500`}
          className="w-full h-full border-0 overflow-hidden"
          scrolling="no"
          frameBorder="0"
          allowTransparency
          allow="encrypted-media"
          title="Facebook Embed"
        ></iframe>
      </div>
    );
  }

  // Twitter/X: Simple link with oembed or preview if possible, 
  // but many prefer just high-quality link or a simple iframe if allowed
  if (type === 'twitter') {
    return (
      <div className="w-full p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center">
        <div className="mb-4 text-sky-400">
           <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </div>
        <p className="mb-4 font-medium">Ver publicación en X (Twitter)</p>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-full transition-colors font-bold"
        >
          Ir a la publicación
        </a>
      </div>
    );
  }

  return <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">View content</a>;
};
