import React, { useEffect, useMemo, useState } from 'react';
import { AdvertisingConfig, AdBannerItem, AdBannerSlide } from '../types';
import { ChevronLeft, ChevronRight, ExternalLink, Megaphone, MessageCircle, Sparkles } from 'lucide-react';
import { resolveDirectImageUrl } from '../utils/imageUrl';

interface AdvertisingSidebarProps {
  advertising?: AdvertisingConfig;
  whatsappContact?: string;
  className?: string;
}

interface AdBannerCardProps {
  banner: AdBannerItem;
}

const AdBannerCard: React.FC<AdBannerCardProps> = ({ banner }) => {
  const isVertical = banner.format === 'vertical';
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const slides: AdBannerSlide[] = useMemo(() => {
    if (banner.displayMode === 'slider' && Array.isArray(banner.slides)) {
      const validSlides = banner.slides.filter((s) => s.imageUrl && s.imageUrl.trim().length > 0);
      if (validSlides.length > 0) {
        return validSlides;
      }
    }
    return [
      {
        id: `${banner.id}-primary`,
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        caption: '',
      },
    ];
  }, [banner]);

  const isSlider = slides.length > 1;
  const intervalMs = Math.max(2, banner.sliderIntervalSeconds || 4) * 1000;

  useEffect(() => {
    if (currentSlideIndex >= slides.length) {
      setCurrentSlideIndex(0);
    }
  }, [slides.length, currentSlideIndex]);

  useEffect(() => {
    if (!isSlider || isHovered) return;
    const timer = window.setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isSlider, isHovered, slides.length, intervalMs]);

  const activeSlide = slides[currentSlideIndex] || slides[0];

  const handleBannerClick = () => {
    const targetUrl =
      (activeSlide?.linkUrl && activeSlide.linkUrl.trim()) ||
      (banner.linkUrl && banner.linkUrl.trim()) ||
      `https://wa.me/584241555789?text=${encodeURIComponent(
        `Hola, vi el banner "${activeSlide?.caption || banner.title}" en Buenísima Radio y deseo más información.`
      )}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
  };

  return (
    <div
      onClick={handleBannerClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group flex flex-col overflow-hidden rounded-2xl bg-transparent border border-white/15 hover:border-amber-400/60 transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5"
    >
      {/* Clean Image/GIF Container - Zero dark overlay or shadow */}
      <div
        className={`relative w-full overflow-hidden bg-black/20 ${
          isVertical
            ? 'aspect-[9/16] min-h-[360px] sm:min-h-[420px]'
            : 'aspect-square min-h-[220px]'
        }`}
      >
        {slides.map((slide, idx) => {
          const imgSrc = resolveDirectImageUrl(slide.imageUrl);
          const isCurrent = idx === currentSlideIndex;
          return (
            <img
              key={slide.id || `${banner.id}-slide-${idx}`}
              src={imgSrc}
              alt={slide.caption || banner.title || 'Banner publicitario'}
              loading={idx === 0 ? 'eager' : 'lazy'}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
              onError={(e) => {
                const target = e.currentTarget;
                target.src = isVertical
                  ? 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800&auto=format&fit=crop'
                  : 'https://images.unsplash.com/photo-1542744094-3a31f272c490?q=80&w=600&auto=format&fit=crop';
              }}
            />
          );
        })}

        {/* Slider Navigation Arrows (only when multiple images/GIFs) */}
        {isSlider && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Imagen anterior del banner"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/55 hover:bg-amber-400 hover:text-black text-white flex items-center justify-center opacity-75 sm:opacity-0 group-hover:opacity-100 transition-all shadow-md"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Siguiente imagen del banner"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/55 hover:bg-amber-400 hover:text-black text-white flex items-center justify-center opacity-75 sm:opacity-0 group-hover:opacity-100 transition-all shadow-md"
            >
              <ChevronRight size={16} />
            </button>

            {/* Compact Slider Dots Indicator */}
            <div
              className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {slides.map((slide, idx) => (
                <button
                  key={slide.id || idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSlideIndex(idx);
                  }}
                  aria-label={`Ver imagen ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentSlideIndex ? 'w-4 bg-amber-400' : 'w-1.5 bg-white/60 hover:bg-white'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Clean Footer Caption Below Image (Never covers the image) */}
      {(banner.title || activeSlide?.caption) && (
        <div className="px-3.5 py-2.5 bg-gray-900/90 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={10} />
              <span>
                {isSlider
                  ? `Slider (${currentSlideIndex + 1}/${slides.length})`
                  : isVertical
                  ? 'Banner Vertical'
                  : 'Banner Cuadrado'}
              </span>
            </span>
            <h4 className="text-xs sm:text-sm font-bold text-white leading-snug group-hover:text-amber-300 transition-colors truncate">
              {activeSlide?.caption || banner.title}
            </h4>
          </div>
          <ExternalLink size={14} className="text-amber-400 flex-shrink-0 opacity-80 group-hover:opacity-100" />
        </div>
      )}
    </div>
  );
};

export const AdvertisingSidebar: React.FC<AdvertisingSidebarProps> = ({
  advertising,
  whatsappContact = '0424 1555789',
  className = '',
}) => {
  if (!advertising || advertising.enabled === false) {
    return null;
  }

  const activeBanners = (advertising.banners || []).filter((b) => b.active !== false);

  // If no banners are configured, provide default promotional banners
  const bannersToDisplay: AdBannerItem[] =
    activeBanners.length > 0
      ? activeBanners
      : [
          {
            id: 'default-ad-vert',
            title: 'Tu Publicidad Aquí',
            imageUrl:
              'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800&auto=format&fit=crop',
            linkUrl: `https://wa.me/584241555789?text=${encodeURIComponent(
              'Hola Buenísima Radio, quiero información para pautar publicidad en su emisora y página web.'
            )}`,
            format: 'vertical',
            active: true,
          },
          {
            id: 'default-ad-sq',
            title: 'Espacio Publicitario Disponible',
            imageUrl:
              'https://images.unsplash.com/photo-1542744094-3a31f272c490?q=80&w=600&auto=format&fit=crop',
            linkUrl: `https://wa.me/584241555789?text=${encodeURIComponent(
              'Hola Buenísima Radio, deseo contratar un banner publicitario cuadrado.'
            )}`,
            format: 'square',
            active: true,
          },
        ];

  return (
    <aside
      aria-label="Espacio Publicitario"
      className={`w-full flex flex-col gap-4 select-none animate-fade-in ${className}`}
    >
      {/* Top Banner Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-gray-900 to-black/80 rounded-xl border border-white/10 shadow-sm">
        <div className="flex items-center gap-2">
          <Megaphone size={14} className="text-amber-400 animate-pulse" />
          <span className="text-xs font-black text-gray-200 uppercase tracking-widest">
            {advertising.title || 'Publicidad'}
          </span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Patrocinado
        </span>
      </div>

      {/* Banner Cards List */}
      <div className="flex flex-col sm:grid sm:grid-cols-2 lg:flex lg:flex-col gap-4">
        {bannersToDisplay.map((banner) => (
          <AdBannerCard key={banner.id} banner={banner} />
        ))}
      </div>

      {/* CTA Box to advertise on WhatsApp */}
      <a
        href={`https://wa.me/584241555789?text=${encodeURIComponent(
          'Hola Buenísima Radio, estoy interesado en anunciar mi negocio/marca en sus banners publicitarios.'
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-950/80 via-black to-emerald-950/80 border border-emerald-500/30 hover:border-emerald-400 rounded-xl transition-all group shadow-md"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-105 transition-transform">
          <MessageCircle size={16} />
        </div>
        <div className="min-w-0">
          <span className="block text-[11px] font-black text-white group-hover:text-emerald-300 transition-colors">
            ¿Quieres pautar tu marca aquí?
          </span>
          <span className="block text-[10px] text-gray-400 truncate">
            WhatsApp: <strong className="text-emerald-400">{whatsappContact}</strong>
          </span>
        </div>
      </a>
    </aside>
  );
};
