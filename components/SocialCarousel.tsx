import React, { useEffect, useRef, useState } from 'react';
import { GalleryItem } from '../types';
import { SocialEmbed } from './SocialEmbed';

interface SocialCarouselProps {
  items: GalleryItem[];
}

export const SocialCarousel: React.FC<SocialCarouselProps> = ({ items }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    
    let animationFrameId: number;
    let lastTime = performance.now();
    const speed = 30; // pixels per second

    const scroll = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (!isHovered && el) {
        el.scrollLeft += speed * dt;
        // Loop back
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
          // Wrap around seamlessly if possible, but simplest is jump back
          el.scrollLeft = 0;
        }
      }
      animationFrameId = requestAnimationFrame(scroll);
    };

    animationFrameId = requestAnimationFrame(scroll);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isHovered, items.length]);

  const getDirectImageUrl = (url: string) => {
    if (url.includes('dropbox.com')) return url.replace('dl=0', 'raw=1');
    return url;
  };

  return (
    <div className="relative group w-full">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-surface to-transparent z-10 pointer-events-none" />
      
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto gap-4 sm:gap-6 pb-8 hide-scrollbar w-full py-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setTimeout(() => setIsHovered(false), 2000)}
      >
        {items.map((img) => (
          <div 
            key={img.id}
            className="flex-none relative shadow-xl rounded-[2rem] bg-surface-alt border border-white/5 overflow-hidden transition-all hover:scale-[1.02] duration-500 max-w-[85vw]"
            style={{ 
                width: img.format === 'portrait' ? '300px' : '400px',
                height: img.format === 'portrait' ? '520px' : '300px'
            }}
          >
            {(!img.type || img.type === 'image') ? (
              <div className="relative h-full w-full overflow-hidden">
                  <img 
                      src={getDirectImageUrl(img.url)} 
                      alt={img.caption || "Gallery"} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                      {img.caption && (
                          <p className="text-white font-medium text-lg shadow-lg">
                              {img.caption}
                          </p>
                      )}
                  </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col p-3">
                  <div className="flex-1 overflow-hidden rounded-2xl bg-black/50">
                      <SocialEmbed url={img.url} type={img.type as any} />
                  </div>
                  {img.caption && (
                      <div className="mt-4 px-2 pb-2 text-sm text-on-surface-muted italic text-center font-medium opacity-80">
                          {img.caption}
                      </div>
                  )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
