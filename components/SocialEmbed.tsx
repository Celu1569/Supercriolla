import React from 'react';

interface SocialEmbedProps {
  url: string;
  type: 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'twitter' | '';
  width?: string | number;
}

export const SocialEmbed: React.FC<SocialEmbedProps> = ({ url, type, width = '100%' }) => {
  if (!url) return null;

  // Facebook: Official Plugins Post embed
  if (type === 'facebook') {
    // If it's a video/live URL, we could use the video plugin. Otherwise post.
    const encodedUrl = encodeURIComponent(url);
    const isVideo = url.includes('/videos/') || url.includes('/live');
    const embedUrl = isVideo 
      ? `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=false&width=500`
      : `https://www.facebook.com/plugins/post.php?href=${encodedUrl}&show_text=true&width=500`;

    return (
      <div className="w-full h-full flex justify-center">
        <iframe
          src={embedUrl}
          className="w-full h-full border-0 overflow-hidden"
          scrolling="no"
          frameBorder={0}
          allowtransparency="true"
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
          title="Facebook Embed"
        ></iframe>
      </div>
    );
  }

  // YouTube: Works for short or regular videos
  if (type === 'youtube') {
    let videoId = '';
    let isShort = false;
    if (url.includes('youtube.com/shorts/')) {
      videoId = url.split('youtube.com/shorts/')[1].split('?')[0];
      isShort = true;
    } else if (url.includes('youtube.com/watch?v=')) {
      videoId = new URL(url).searchParams.get('v') || '';
    } else if (url.includes('youtube.com/watch?')) {
      videoId = new URL(url).searchParams.get('v') || '';
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('youtube.com/live/')) {
      videoId = url.split('youtube.com/live/')[1].split('?')[0];
    }
    
    if (videoId) {
      if (isShort) {
          return (
            <div className="w-full h-full max-w-sm mx-auto aspect-[9/16] flex justify-center">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0`}
                className="w-full h-full border-0 rounded-xl shadow-xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube Embed"
              ></iframe>
            </div>
          );
      }
      return (
        <div className="w-full h-full aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0`}
            className="w-full h-full border-0 rounded-xl shadow-xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube Embed"
          ></iframe>
        </div>
      );
    } else if (url.includes('@') && url.includes('/live')) {
        // Channel live URL: e.g., https://www.youtube.com/@channel/live
        // YouTube doesn't easily allow @channel/live in standard embeds without channel ID.
        // Try embedding as a generic iframe just in case but usually fails. We fallback.
    }
  }

  // Instagram: Simple iframe embed
  if (type === 'instagram') {
    const cleanUrl = url.split('?')[0];
    const embedUrl = `${cleanUrl}${cleanUrl.endsWith('/') ? '' : '/'}embed`;
    return (
      <div className="w-full h-full max-w-md mx-auto aspect-[4/5] flex justify-center">
        <iframe
          src={embedUrl}
          className="w-full h-full border-0 rounded-xl bg-white shadow-xl"
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
    let videoId = '';
    if (url.includes('/video/')) {
       videoId = url.split('/video/')[1]?.split('?')[0];
    }
    
    if (videoId) {
      return (
        <div className="w-full h-full max-w-sm mx-auto aspect-[9/16] flex justify-center">
          <iframe
            src={`https://www.tiktok.com/embed/v2/${videoId}`}
            className="w-full h-full border-0 rounded-xl shadow-xl"
            allow="fullscreen"
            title="TikTok Embed"
          ></iframe>
        </div>
      );
    }
  }

  // Twitter/X: Fallback to simple link block
  if (type === 'twitter') {
    return (
      <div className="w-full h-full max-w-md mx-auto bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-center items-center text-center shadow-xl">
         <div className="mb-4 text-sky-400">
           <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
         </div>
         <p className="mb-4 font-bold text-gray-900">Ver publicación en X</p>
         <a href={url} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-sky-500 text-white rounded-full font-bold hover:bg-sky-600 transition-colors">
            Abrir Enlace
         </a>
      </div>
    );
  }

  // Fallback for everything else or unparseable URLs (like channel live streams that can't be safely embedded)
  return (
      <div className="w-full h-full aspect-video rounded-xl flex items-center justify-center bg-black/40 border border-white/10 backdrop-blur-md">
        <iframe
            src={url}
            className="w-full h-full border-0 rounded-xl shadow-xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            title="External Content"
            onError={(e) => {
               // Silently failing iframe will just remain blank or browser handles it
               console.log("Iframe load error, fallback to visual link");
            }}
        ></iframe>
        {/* Underlay a link just in case the iframe fails to load due to X-Frame-Options */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none opacity-20 hover:opacity-100 transition-opacity z-[-1] bg-black/80">
            <h3 className="text-xl font-bold text-white mb-2">Transmisión Externa</h3>
            <p className="text-white/60 mb-4 text-sm">Si el reproductor no carga automáticamente, haz clic en el botón.</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="pointer-events-auto px-6 py-3 bg-primary text-white rounded-full font-bold hover:bg-purple-600 transition-colors">
                Ver en la plataforma original
            </a>
        </div>
      </div>
  );
};
