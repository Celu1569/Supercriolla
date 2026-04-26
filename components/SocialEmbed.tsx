import React from 'react';

interface SocialEmbedProps {
  url: string;
  type: 'instagram' | 'tiktok' | 'facebook' | 'youtube';
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
          allowtransparency="true"
          frameBorder={0}
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
          frameBorder={0}
          allowtransparency="true"
          allow="encrypted-media"
          title="Facebook Embed"
        ></iframe>
      </div>
    );
  }

  // YouTube: Works for short or regular videos
  if (type === 'youtube') {
    let videoId = '';
    if (url.includes('youtube.com/shorts/')) {
      videoId = url.split('youtube.com/shorts/')[1].split('?')[0];
    } else if (url.includes('youtube.com/watch?v=')) {
      videoId = new URL(url).searchParams.get('v') || '';
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    }
    if (videoId) {
      return (
        <div className="w-full h-[550px]">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
            className="w-full h-full border-0 rounded-xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube Embed"
          ></iframe>
        </div>
      );
    }
  }

  // Twitter/X: Fallback to simple link block since native embeds without SDK are tricky,
  // but let's just make it look decent
  if (type === 'twitter') {
    return (
      <div className="w-full h-full min-h-[300px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col justify-center items-center text-center">
         <div className="mb-4 text-sky-400">
           <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
         </div>
         <p className="mb-4 font-bold text-gray-900 dark:text-white">Ver publicación en X (Twitter)</p>
         <a href={url} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-sky-500 text-white rounded-full font-bold hover:bg-sky-600 transition-colors">
            Ir a publicación
         </a>
      </div>
    );
  }

  return <a href={url} target="_blank" rel="noopener noreferrer" className="text-secondary font-bold hover:underline py-4 block">Ver enlace externo</a>;
};
