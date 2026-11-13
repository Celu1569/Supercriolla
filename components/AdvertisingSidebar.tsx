import React from 'react';
import { AdvertisingConfig, AdBannerItem } from '../types';
import { ExternalLink, Megaphone, Sparkles, MessageCircle } from 'lucide-react';
import { resolveDirectImageUrl } from '../utils/imageUrl';

interface AdvertisingSidebarProps {
  advertising?: AdvertisingConfig;
  whatsappContact?: string;
  className?: string;
}

export const AdvertisingSidebar: React.FC<AdvertisingSidebarProps> = ({
  advertising,
  whatsappContact = '0424 1555789',
  className = ''
}) => {
  if (!advertising || advertising.enabled === false) {
    return null;
  }

  const activeBanners = (advertising.banners || []).filter(b => b.active !== false);

  // If no banners are configured, provide default promotional banners
  const bannersToDisplay: AdBannerItem[] = activeBanners.length > 0 ? activeBanners : [
    {
      id: 'default-ad-vert',
      title: 'Tu Publicidad Aquí',
      imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800&auto=format&fit=crop',
      linkUrl: `https://wa.me/584241555789?text=${encodeURIComponent('Hola Buenísima Radio, quiero información para pautar publicidad en su emisora y página web.')}`,
      format: 'vertical',
      active: true
    },
    {
      id: 'default-ad-sq',
      title: 'Espacio Publicitario Disponible',
      imageUrl: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?q=80&w=600&auto=format&fit=crop',
      linkUrl: `https://wa.me/584241555789?text=${encodeURIComponent('Hola Buenísima Radio, deseo contratar un banner publicitario cuadrado.')}`,
      format: 'square',
      active: true
    }
  ];

  const handleBannerClick = (banner: AdBannerItem) => {
    const url = banner.linkUrl || `https://wa.me/584241555789?text=${encodeURIComponent(`Hola, vi el banner "${banner.title}" en Buenísima Radio y deseo más información.`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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
        {bannersToDisplay.map((banner) => {
          const isVertical = banner.format === 'vertical';
          const imgSrc = resolveDirectImageUrl(banner.imageUrl);

          return (
            <div
              key={banner.id}
              onClick={() => handleBannerClick(banner)}
              className={`group relative overflow-hidden rounded-2xl bg-black/60 border border-white/10 hover:border-amber-400/50 shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1 hover:shadow-amber-500/10 ${
                isVertical 
                  ? 'aspect-[9/16] min-h-[360px] sm:min-h-[420px]' 
                  : 'aspect-square min-h-[220px]'
              }`}
            >
              {/* Image */}
              <img
                src={imgSrc}
                alt={banner.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.src = isVertical
                    ? 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800&auto=format&fit=crop'
                    : 'https://images.unsplash.com/photo-1542744094-3a31f272c490?q=80&w=600&auto=format&fit=crop';
                }}
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent group-hover:from-black/90 transition-colors" />

              {/* Top Badge */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/70 backdrop-blur-md text-[10px] font-bold text-gray-300 px-2 py-0.5 rounded-full border border-white/10 opacity-90 group-hover:opacity-100">
                <span>{isVertical ? 'Vertical' : 'Cuadrado'}</span>
                <ExternalLink size={10} className="text-amber-400 ml-0.5" />
              </div>

              {/* Bottom Details */}
              <div className="absolute bottom-0 left-0 right-0 p-3.5 flex flex-col justify-end">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                  <Sparkles size={10} />
                  <span>Espacio Publicitario</span>
                </span>
                <h4 className="text-sm font-black text-white leading-tight drop-shadow-md group-hover:text-amber-300 transition-colors line-clamp-2">
                  {banner.title}
                </h4>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA Box to advertise on WhatsApp */}
      <a
        href={`https://wa.me/584241555789?text=${encodeURIComponent('Hola Buenísima Radio, estoy interesado en anunciar mi negocio/marca en sus banners publicitarios.')}`}
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
