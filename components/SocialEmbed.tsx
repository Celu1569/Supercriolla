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

  return <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">View content</a>;
};
