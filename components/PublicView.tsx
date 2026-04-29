import React, { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { RadioPlayer } from './RadioPlayer';
import Chat from './Chat';
import { ClientGallery } from './ClientGallery';
import { SocialEmbed } from './SocialEmbed';
import { SocialCarousel } from './SocialCarousel';
import { Menu, X, Facebook, Instagram, Youtube, Phone, Mail, MapPin, Radio, ChevronLeft, ChevronRight, Sun, Moon, PlayCircle, Video, Heart, CreditCard, Tv, Play, MessageSquare, Users, Mic2, Newspaper, Calendar, User, ArrowRight, ChevronDown } from 'lucide-react';
import { TikTok } from './TikTokIcon';
import { NewsItem } from '../types';

interface NavLinkProps {
  children: React.ReactNode;
  isActive: boolean;
  activeColor: string;
  fontSize?: number;
  onClick: () => void;
  style?: React.CSSProperties;
}

const NavLink: React.FC<NavLinkProps> = ({ children, isActive, activeColor, fontSize, onClick, style }) => (
  <button 
    onClick={onClick}
    style={{ 
        ...style, 
        color: isActive ? activeColor : style?.color,
        fontSize: fontSize ? `${fontSize}px` : undefined
    }}
    className={`transition-all duration-300 font-medium tracking-wider uppercase ${
      isActive 
        ? 'opacity-100 font-bold' 
        : 'opacity-70 hover:opacity-100'
    }`}
  >
    {children}
  </button>
);

// Helper to convert Google Drive share links to direct image links
const getDirectImageUrl = (url: string) => {
    if (!url) return '';
    
    // Check if it is a Google Drive Link
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
        // Regex to extract the ID from /d/ID/ or id=ID
        const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        
        if (idMatch && idMatch[1]) {
            return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
        }
    }
    
    return url;
};

// Robust helper to get embed URL from various Youtube formats
const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return '';
    const cleanUrl = url.trim();

    // Regex to capture the Video ID (11 chars)
    // Handles:
    // - youtube.com/watch?v=ID
    // - youtube.com/embed/ID
    // - youtube.com/live/ID
    // - youtube.com/shorts/ID
    // - youtu.be/ID
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|live\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = cleanUrl.match(regExp);

    if (match && match[1] && match[1].length === 11) {
        return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
    }
    
    return cleanUrl;
};

const VideoPlayer: React.FC<{ url: string; title: string }> = ({ url, title }) => {
    const embedUrl = getYoutubeEmbedUrl(url);
    const isYoutube = embedUrl.includes('youtube.com/embed');

    // KEY prop is crucial here. It forces React to re-mount the iframe when the URL changes.
    // This fixes the issue where the player wouldn't update content.
    return (
        <div className="relative w-full pb-[56.25%] bg-black overflow-hidden shadow-2xl rounded-xl group">
            {url ? (
                isYoutube ? (
                    <iframe
                        key={embedUrl} 
                        className="absolute top-0 left-0 w-full h-full"
                        src={embedUrl}
                        title={title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                ) : (
                    <video 
                        key={url}
                        className="absolute top-0 left-0 w-full h-full"
                        controls 
                        autoPlay
                        playsInline
                    >
                         <source src={url} type="video/mp4" />
                        Tu navegador no soporta el tag de video.
                    </video>
                )
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-900">
                    <Video size={48} className="mb-2 opacity-50"/>
                    <p>Selecciona un video para reproducir</p>
                </div>
            )}
        </div>
    );
};

const PublicView: React.FC = () => {
  const { config, updateConfig } = useConfig();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [secretClicks, setSecretClicks] = useState(0);

  // Player State
  const [playerMode, setPlayerMode] = useState<'live' | 'episode'>('live');
  const [selectedEpisode, setSelectedEpisode] = useState(config.content.podcast.episodes[0] || null);
  const [programView, setProgramView] = useState<'week' | 'weekend'>('week');
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const [rssArticles, setRssArticles] = useState<NewsItem[]>([]);
  const [isLoadingRss, setIsLoadingRss] = useState(false);

  const [playingVideo, setPlayingVideo] = useState<{url: string; title: string} | null>(null);

  useEffect(() => {
      const feeds = config.content.news?.rssFeeds || [];
      if (feeds.length === 0) {
          setRssArticles([]);
          return;
      }
      
      const fetchRss = async () => {
          setIsLoadingRss(true);
          try {
              const urls = feeds.map(f => encodeURIComponent(f.url)).join(',');
              const response = await fetch(`/api/rss?urls=${urls}`);
              if (response.ok) {
                  const data = await response.json();
                  setRssArticles(data || []);
              }
          } catch (error) {
              console.error("Failed to fetch RSS feeds:", error);
          } finally {
              setIsLoadingRss(false);
          }
      };

      fetchRss();
  }, [config.content.news?.rssFeeds]);


  // State to control visibility of sections
  const [activeSections, setActiveSections] = useState({
    hero: true,
    topvideos: true,
    podcast: false,
    program: false,
    gallery: false,
    clients: false,
    news: false,
    donations: false,
    contact: true
  });

  // Calculate Header Height dynamically
  const isLogoVisible = config.navigation.showLogo && config.navigation.logoUrl;
  const navPaddingY = 32; 
  const minNavHeight = 80; 
  const dynamicNavHeight = isLogoVisible 
    ? Math.max(minNavHeight, config.navigation.logoHeight + navPaddingY) 
    : minNavHeight;


  // Helper to check if a section should be rendered based on navigation settings
  const isSectionEnabled = (id: string) => {
    const findInItems = (items: any[]): any => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
          const found = findInItems(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    const item = findInItems(config.navigation.items || []);
    // For legacy support or sections not in menu, we assume visible=true if not explicitly found
    return item ? item.visible : true;
  };

  // Auto-play slider
  useEffect(() => {
    const intervalTime = config.content.heroInterval || 5000;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % config.content.hero.length);
    }, intervalTime); 
    return () => clearInterval(timer);
  }, [config.content.hero.length, config.content.heroInterval]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % config.content.hero.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? config.content.hero.length - 1 : prev - 1));
  };

  const toggleTheme = () => {
    const newMode = config.appearance.themeMode === 'light' ? 'dark' : 'light';
    updateConfig({
        ...config,
        appearance: {
            ...config.appearance,
            themeMode: newMode
        }
    });
  };

  const handleSecretAccess = () => {
    const newCount = secretClicks + 1;
    setSecretClicks(newCount);
    setTimeout(() => setSecretClicks(0), 2000);
    if (newCount >= 5) {
      window.location.hash = '#/login';
      setSecretClicks(0);
    }
  };

  const toggleSection = (section: keyof typeof activeSections) => {
    setActiveSections(prev => {
        const isAlreadyOpen = prev[section];
        
        setTimeout(() => {
            const element = document.getElementById(section as string);
            if (element) {
                const offset = dynamicNavHeight; 
                const bodyRect = document.body.getBoundingClientRect().top;
                const elementRect = element.getBoundingClientRect().top;
                const elementPosition = elementRect - bodyRect;
                const offsetPosition = elementPosition - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        }, isAlreadyOpen ? 10 : 150); // wait slightly longer if it needs to render

        return { ...prev, [section]: true };
    });
    setMobileMenuOpen(false);
  };

  const handleEpisodeClick = (ep: any) => {
      setSelectedEpisode(ep);
      setPlayerMode('episode'); // Auto switch to episode mode
      
      // Scroll to player on mobile
      if (window.innerWidth < 1024) {
          document.getElementById('video-main-display')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  };

  // Determine what to play
  const activeVideoUrl = playerMode === 'live' 
      ? config.content.podcast.liveUrl 
      : (selectedEpisode?.videoUrl || '');

  const activeVideoTitle = playerMode === 'live'
      ? "Transmisión En Vivo"
      : (selectedEpisode?.title || "Video Seleccionado");


  const navStyle = {
      backgroundColor: config.navigation.navBackgroundColor,
      color: config.navigation.navTextColor
  };

  // Helper to render nav items
  const renderNavItems = (isMobile = false) => {
      const { items, navActiveColor } = config.navigation;
      
      if (!items) return null;

      return items.filter(item => item.visible).map(item => {
        const hasChildren = item.children && item.children.length > 0;
        const isAnchor = item.link?.startsWith('#');
        const sectionId = isAnchor ? item.link?.substring(1) : '';
        const isActive = isAnchor && activeSections[sectionId as keyof typeof activeSections];

        // Custom NavLink logic for dropdown parent
        const commonStyle = {
            color: isActive ? navActiveColor : navStyle.color,
            fontSize: config.navigation.navFontSize ? `${config.navigation.navFontSize}px` : undefined
        };

        if (hasChildren) {
            if (isMobile) {
                return (
                    <div key={item.id} className="w-full">
                        <div className="flex items-center justify-between py-4 border-b border-white/5 opacity-50 uppercase text-xs font-bold tracking-widest" style={{ color: navStyle.color }}>
                            {item.label}
                        </div>
                        <div className="pl-4 space-y-4 pt-4">
                            {item.children!.filter(child => child.visible).map(child => {
                                const isChildAnchor = child.link?.startsWith('#');
                                const childSectionId = isChildAnchor ? child.link?.substring(1) : '';
                                const isChildActive = isChildAnchor && activeSections[childSectionId as keyof typeof activeSections];
                                
                                return (
                                    <button
                                        key={child.id}
                                        onClick={() => {
                                            if (isMobile) setMobileMenuOpen(false);
                                            isChildAnchor ? toggleSection(childSectionId as any) : window.open(child.link, '_blank');
                                        }}
                                        className="w-full text-left uppercase text-sm font-bold tracking-wider"
                                        style={{ color: isChildActive ? navActiveColor : navStyle.color }}
                                    >
                                        {child.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            }

            return (
                <div key={item.id} className="relative group">
                    <button 
                        className={`transition-all duration-300 font-medium tracking-wider uppercase flex items-center gap-1 ${
                            isActive ? 'opacity-100 font-bold' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={commonStyle}
                    >
                        {item.label}
                        <ChevronDown size={14} className="group-hover:rotate-180 transition-transform" />
                    </button>
                    <div className="absolute left-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 min-w-[200px] z-[60]">
                        <div className="bg-surface-alt border border-white/10 rounded-xl shadow-2xl p-2 overflow-hidden">
                            {item.children!.filter(child => child.visible).map(child => {
                                const isChildAnchor = child.link?.startsWith('#');
                                const childSectionId = isChildAnchor ? child.link?.substring(1) : '';
                                const isChildActive = isChildAnchor && activeSections[childSectionId as keyof typeof activeSections];
                                
                                return (
                                    <button
                                        key={child.id}
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            isChildAnchor ? toggleSection(childSectionId as any) : window.open(child.link, '_blank');
                                        }}
                                        className={`w-full text-left px-4 py-3 text-sm rounded-lg transition-colors ${
                                            isChildActive ? 'bg-primary text-white' : 'text-on-surface-muted hover:bg-white/5 hover:text-on-surface'
                                        }`}
                                    >
                                        {child.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <NavLink 
                key={item.id}
                fontSize={config.navigation.navFontSize} 
                style={{ color: navStyle.color }} 
                activeColor={navActiveColor} 
                isActive={isActive} 
                onClick={() => {
                   if (isMobile) setMobileMenuOpen(false);
                   isAnchor ? toggleSection(sectionId as any) : window.open(item.link, '_blank');
                }}
            >
                {item.label}
            </NavLink>
        );
      });
  };

  return (
    <div className="min-h-screen font-sans bg-surface text-on-surface pb-20 transition-colors duration-300">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 shadow-lg border-b border-white/10 transition-all duration-300" style={navStyle}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between min-h-[80px]">
          {/* Logo & Branding - NOW ALWAYS SHOWS TEXT, LOGO OPTIONAL BESIDE IT */}
          <div className="flex items-center gap-3 cursor-pointer flex-shrink-0" onClick={() => toggleSection('hero')}>
             {config.navigation.showLogo && config.navigation.logoUrl && (
                 <img 
                    src={getDirectImageUrl(config.navigation.logoUrl)} 
                    alt={config.general.stationName} 
                    className="w-auto object-contain transition-all"
                    style={{ height: `${config.navigation.logoHeight}px` }} 
                 />
             )}
             <div className="text-2xl font-heading font-bold tracking-tighter">
                {config.general.stationName}
             </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            {renderNavItems()}
            
            <button 
                onClick={toggleTheme}
                className="opacity-80 hover:opacity-100 transition-colors p-2 rounded-full hover:bg-white/10"
                style={{ color: navStyle.color }}
                title={config.appearance.themeMode === 'light' ? "Cambiar a modo obscuro" : "Cambiar a modo claro"}
            >
                {config.appearance.themeMode === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>

          <div className="flex items-center space-x-4 md:hidden">
            <button 
                onClick={toggleTheme}
                className="opacity-80 hover:opacity-100"
                style={{ color: navStyle.color }}
            >
                {config.appearance.themeMode === 'light' ? <Moon size={24} /> : <Sun size={24} />}
            </button>
            <button style={{ color: navStyle.color }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full px-4 py-6 flex flex-col space-y-4 shadow-xl border-t border-white/10" style={{ backgroundColor: config.navigation.navBackgroundColor !== 'transparent' ? config.navigation.navBackgroundColor : '#000000', color: config.navigation.navTextColor }}>
             {renderNavItems(true)}
          </div>
        )}
      </nav>

      {/* Main Radio Player */}
      <div style={{ paddingTop: `${dynamicNavHeight}px` }}>
        <RadioPlayer />
      </div>

      {/* Hero Section */}
      {activeSections.hero && isSectionEnabled('hero') && (
        <section 
            id="hero" 
            className="relative w-full overflow-hidden bg-gray-900 group animate-fade-in"
            style={{ height: '400px' }}
        >
            {config.content.hero.map((slide, index) => {
              // Determine alignment classes
              const hAlignClass = slide.alignment === 'left' 
                ? 'items-start text-left pl-10 md:pl-20' 
                : slide.alignment === 'right' 
                  ? 'items-end text-right pr-10 md:pr-20' 
                  : 'items-center text-center px-4';

              const vAlignClass = slide.verticalAlignment === 'top'
                ? 'justify-start pt-20'
                : slide.verticalAlignment === 'bottom'
                  ? 'justify-end pb-20'
                  : 'justify-center';

              const alignClass = `${hAlignClass} ${vAlignClass}`;

              // Text Style Helpers
              const getShadowClass = (shadow?: string) => {
                 if (shadow === 'strong') return 'drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]';
                 if (shadow === 'soft') return 'drop-shadow-md';
                 return '';
              };
              
              const getOutlineStyle = (outline?: string, customColor?: string, customWidth?: number) => {
                  if (outline === 'dark') return { textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' };
                  if (outline === 'light') return { textShadow: '-1px -1px 0 rgba(255,255,255,0.5), 1px -1px 0 rgba(255,255,255,0.5), -1px 1px 0 rgba(255,255,255,0.5), 1px 1px 0 rgba(255,255,255,0.5)' };
                  if (outline === 'custom' && customColor) {
                      const w = customWidth || 1;
                      return { 
                          WebkitTextStroke: `${w}px ${customColor}`,
                          paintOrder: 'stroke fill'
                      };
                  }
                  return {};
              };

              return (
                <div 
                    key={slide.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out flex flex-col ${alignClass} ${
                    index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                >
                    <div 
                        className={`absolute inset-0 bg-cover bg-center transition-transform duration-[8000ms] -z-10 ${
                        index === currentSlide ? 'scale-105' : 'scale-100'
                        }`}
                        style={{ backgroundImage: `url(${getDirectImageUrl(slide.image)})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-black/30 -z-10" />
                    
                    {index === currentSlide && (
                        <div 
                            className="animate-fade-in-up w-full"
                            style={{ 
                                maxWidth: slide.contentMaxWidth ? `${slide.contentMaxWidth}px` : '100%',
                                transform: `translate(${slide.offsetX || 0}px, ${slide.offsetY || 0}px)`
                            }}
                        >
                            <h1 
                                className={`mb-4 tracking-wide ${getShadowClass(slide.titleShadow || slide.textShadow)}`}
                                style={{ 
                                    fontFamily: slide.titleFont ? `"${slide.titleFont}", sans-serif` : undefined,
                                    fontWeight: slide.titleBold ? 'bold' : 'normal',
                                    backgroundColor: slide.titleHighlight ? slide.titleHighlightColor || 'rgba(251, 191, 36, 0.4)' : 'transparent',
                                    padding: slide.titleHighlight ? '0.1em 0.3em' : '0',
                                    borderRadius: slide.titleHighlight ? '0.2em' : '0',
                                    display: slide.titleHighlight ? 'inline-block' : 'block',
                                    color: slide.titleColor || slide.textColor || '#ffffff',
                                    fontSize: slide.titleSize ? `clamp(${Math.max(20, Math.round(slide.titleSize * 0.45))}px, 5vw + 0.5rem, ${slide.titleSize}px)` : undefined,
                                    lineHeight: '1.2',
                                    ...getOutlineStyle(slide.titleOutline || slide.textOutline, slide.titleOutlineColor, slide.titleOutlineWidth)
                                }}
                            >
                                {slide.title}
                            </h1>
                            <p 
                                className={`opacity-90 mb-8 ${getShadowClass(slide.subtitleShadow || slide.textShadow)}`}
                                style={{ 
                                    fontFamily: slide.subtitleFont ? `"${slide.subtitleFont}", sans-serif` : undefined,
                                    fontWeight: slide.subtitleBold ? 'bold' : 'normal',
                                    backgroundColor: slide.subtitleHighlight ? slide.subtitleHighlightColor || 'rgba(251, 191, 36, 0.2)' : 'transparent',
                                    padding: slide.subtitleHighlight ? '0.1em 0.3em' : '0',
                                    borderRadius: slide.subtitleHighlight ? '0.2em' : '0',
                                    display: slide.subtitleHighlight ? 'inline-block' : 'block',
                                    color: slide.subtitleColor || slide.textColor || '#ffffff',
                                    fontSize: slide.subtitleSize ? `clamp(${Math.max(14, Math.round(slide.subtitleSize * 0.6))}px, 3vw + 0.5rem, ${slide.subtitleSize}px)` : undefined,
                                    lineHeight: '1.4',
                                    ...getOutlineStyle(slide.subtitleOutline || slide.textOutline, slide.subtitleOutlineColor, slide.subtitleOutlineWidth)
                                }}
                            >
                                {slide.subtitle}
                            </p>
                            
                            {/* Call to Action Button */}
                            {slide.showButton && (
                                <a 
                                    href={slide.buttonLink || '#'}
                                    className="inline-block px-8 py-3 rounded-full font-bold text-lg shadow-lg transform hover:scale-105 transition-all hover:shadow-xl"
                                    style={{ 
                                        backgroundColor: slide.buttonColor || config.appearance.secondaryColor,
                                        color: slide.buttonTextColor || config.appearance.primaryColor
                                    }}
                                >
                                    {slide.buttonText || "Más Información"}
                                </a>
                            )}
                        </div>
                    )}
                </div>
              );
            })}

            <button 
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-secondary hover:text-primary text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
            >
                <ChevronLeft size={32} />
            </button>
            <button 
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-secondary hover:text-primary text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
            >
                <ChevronRight size={32} />
            </button>

            <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center space-x-2">
                {config.content.hero.map((_, idx) => (
                    <button 
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={`w-3 h-3 rounded-full transition-all ${
                            idx === currentSlide ? 'bg-secondary w-8' : 'bg-white/50 hover:bg-white'
                        }`}
                    />
                ))}
            </div>
        </section>
      )}

      {/* Text Ribbons (Cintillos) */}
      {(() => {
        const visibleRibbons = (config.content.ribbons || []).filter(r => r.visible);
        if (visibleRibbons.length === 0) return null;

        // Use the speed and font settings from the first ribbon as base, or defaults
        const baseRibbon = visibleRibbons[0];
        const hasSpeed = visibleRibbons.some(r => r.speed > 0);
        const maxSpeed = Math.max(...visibleRibbons.map(r => r.speed));
        const duration = hasSpeed ? `${101 - maxSpeed}s` : '0s';

        const RibbonContent = () => (
            <div className="flex items-center">
                {visibleRibbons.map((ribbon) => (
                    <div 
                        key={ribbon.id}
                        className="whitespace-nowrap py-3 px-8 flex-shrink-0"
                        style={{ 
                            backgroundColor: ribbon.backgroundColor,
                            color: ribbon.textColor,
                            fontFamily: ribbon.fontFamily,
                            fontSize: `${ribbon.fontSize}px`,
                        }}
                    >
                        {ribbon.text}
                    </div>
                ))}
            </div>
        );

        return (
            <div 
                className="w-full overflow-hidden shadow-md z-30 relative border-y border-white/10 bg-surface-alt"
                style={{ '--marquee-duration': duration } as React.CSSProperties}
            >
                <div className="flex w-max">
                    <div className={hasSpeed ? 'animate-marquee flex' : 'flex w-full justify-center'}>
                        <RibbonContent />
                        {hasSpeed && <RibbonContent />}
                        {hasSpeed && <RibbonContent />}
                        {hasSpeed && <RibbonContent />}
                    </div>
                </div>
            </div>
        );
      })()}

      {/* Top Videos (Latigazos) */}
      {(activeSections as any)['topvideos'] !== false && isSectionEnabled('topvideos') && config.content.topVideos?.enabled && (
        <section id="topvideos" className="py-20 bg-surface-alt animate-fade-in transition-colors duration-300">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                     <h2 className="text-4xl md:text-5xl font-heading font-bold text-heading relative inline-block mb-4">
                        {config.content.topVideos.title}
                        <span className="absolute bottom-0 left-0 w-full h-1 bg-secondary opacity-50 transform -skew-x-12"></span>
                     </h2>
                    <p className="text-lg text-on-surface-muted max-w-2xl mx-auto">
                        {config.content.topVideos.description}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mx-auto mb-16">
                    {config.content.topVideos.videos.slice(0, 5).map((v, i) => {
                        const match = v.url.match(/^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|live\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/);
                        const videoId = (match && match[1] && match[1].length === 11) ? match[1] : null;
                        const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';

                        return (
                        <div key={v.id} onClick={() => setPlayingVideo({url: v.url, title: v.title})} className="bg-surface rounded-xl overflow-hidden shadow-lg border border-white/5 group hover:-translate-y-2 transition-transform duration-300 cursor-pointer flex flex-col">
                            <div className="relative pb-[56.25%] overflow-hidden bg-black/10">
                                {videoId ? (
                                    <>
                                      <img src={thumb} alt={v.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90" />
                                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300"></div>
                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                         <PlayCircle size={64} className="text-white drop-shadow-md transform scale-90 group-hover:scale-100 transition-transform" />
                                      </div>
                                    </>
                                ) : (
                                    <VideoPlayer url={v.url} title={v.title} />
                                )}
                                <div className="absolute top-2 left-2 bg-secondary text-primary font-black uppercase text-xs px-2 py-1 rounded shadow-md z-10 flex items-center">
                                    <span className="mr-1">#{i + 1}</span> 
                                </div>
                            </div>
                            <div className="p-4 bg-surface text-center flex-1 flex items-center justify-center">
                                <h3 className="font-bold text-sm text-on-surface line-clamp-2 leading-tight group-hover:text-secondary transition-colors">
                                    {v.title}
                                </h3>
                            </div>
                        </div>
                    )})}
                </div>

                {/* History & Monthly Summaries */}
                {(config.content.topVideos.history?.length > 0 || config.content.topVideos.monthlySummaries?.length > 0) && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        {config.content.topVideos.monthlySummaries?.length > 0 && (
                            <details className="group bg-surface rounded-xl overflow-hidden shadow-sm border border-black/5 hover:shadow-md transition-shadow">
                                <summary className="flex items-center justify-between p-5 cursor-pointer font-bold text-lg text-heading marker:content-none select-none">
                                    <span className="flex items-center"><Calendar size={20} className="mr-3 text-secondary"/> Resumen Mensual de Posiciones</span>
                                    <ChevronDown size={20} className="text-gray-400 group-open:-rotate-180 transition-transform duration-300"/>
                                </summary>
                                <div className="p-6 border-t border-black/5 space-y-8 bg-surface-alt/50">
                                    {config.content.topVideos.monthlySummaries.map(summary => (
                                        <div key={summary.id} className="bg-surface rounded-xl p-6 shadow-sm border border-black/5">
                                            <h4 className="text-xl font-heading font-bold text-primary mb-3 border-b border-black/10 pb-2">{summary.month}</h4>
                                            {summary.summaryText && <p className="text-on-surface-muted italic mb-4">{summary.summaryText}</p>}
                                            <div className="space-y-3">
                                                {summary.videos.map((vid, i) => (
                                                    <div key={vid.id} className="flex items-center gap-4 bg-surface-alt p-3 rounded-lg">
                                                        <span className="font-black text-secondary text-lg w-8 text-center">{i + 1}</span>
                                                        <span className="flex-1 font-bold text-sm text-on-surface">{vid.title}</span>
                                                        {vid.url && (
                                                            <button onClick={() => setPlayingVideo({url: vid.url, title: vid.title})} className="p-2 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors">
                                                                <Play size={14} className="fill-current"/>
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                        
                        {config.content.topVideos.history?.length > 0 && (
                            <details className="group bg-surface rounded-xl overflow-hidden shadow-sm border border-black/5 hover:shadow-md transition-shadow">
                                <summary className="flex items-center justify-between p-5 cursor-pointer font-bold text-lg text-heading marker:content-none select-none">
                                    <span className="flex items-center"><Calendar size={20} className="mr-3 text-secondary"/> Historial Semanal Anteriores</span>
                                    <ChevronDown size={20} className="text-gray-400 group-open:-rotate-180 transition-transform duration-300"/>
                                </summary>
                                <div className="p-6 border-t border-black/5 grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface-alt/50">
                                    {config.content.topVideos.history.map(week => (
                                        <div key={week.id} className="bg-surface rounded-xl p-5 shadow-sm border border-black/5">
                                            <h4 className="text-lg font-heading font-bold text-primary mb-4 border-b border-black/10 pb-2">{week.date}</h4>
                                            <div className="space-y-2">
                                                {week.videos.map((vid, i) => (
                                                    <div key={vid.id} className="flex items-center gap-3 text-sm">
                                                        <span className="font-bold text-secondary text-xs">{i + 1}.</span>
                                                        <span className="flex-1 text-on-surface-muted truncate">{vid.title}</span>
                                                        {vid.url && (
                                                            <button onClick={() => setPlayingVideo({url: vid.url, title: vid.title})} className="text-primary hover:text-secondary transition-colors">
                                                                <Play size={12} className="fill-current"/>
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                )}
            </div>
        </section>
      )}

      {/* Podcast / Live Streaming Section */}
      {activeSections.podcast && isSectionEnabled('podcast') && (
        <section id="podcast" className="py-20 bg-surface animate-fade-in transition-colors duration-300">
            <div className="container mx-auto px-4">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start justify-between mb-10 gap-4">
                <div>
                    {/* Updated to use text-heading for global consistency */}
                    <h2 className="text-4xl font-heading font-bold text-heading relative inline-block">
                        {config.content.podcast.title}
                        <span className="absolute bottom-0 left-0 w-1/2 h-1 bg-secondary"></span>
                    </h2>
                    <p className="mt-3 text-on-surface-muted max-w-2xl text-lg">{config.content.podcast.description}</p>
                </div>
                
                {config.content.podcast.isLive && (
                    <div className="flex items-center animate-pulse bg-red-50 px-4 py-2 rounded-full border border-red-100 shadow-sm">
                        <span className="h-3 w-3 bg-red-500 rounded-full mr-2"></span>
                        <span className="font-bold text-red-500 tracking-widest uppercase text-sm">En Vivo</span>
                    </div>
                )}
            </div>

            <div className="flex flex-col-reverse lg:flex-row gap-8">
                
                {/* Left Side: Playlist / Thumbnails */}
                <div className="w-full lg:w-1/3 flex flex-col">
                    <div className="bg-surface-alt rounded-2xl p-4 shadow-lg border border-white/5 flex-grow h-[600px] flex flex-col">
                        <h3 className="text-lg font-heading font-bold text-on-surface mb-4 pb-2 border-b border-gray-200/50 flex items-center">
                            <PlayCircle size={20} className="mr-2 text-secondary"/>
                            Episodios Recientes
                        </h3>
                        
                        <div className="overflow-y-auto pr-2 flex-1 space-y-3 custom-scrollbar">
                             {config.content.podcast.episodes.map((ep) => {
                                const isSelected = selectedEpisode?.id === ep.id && playerMode === 'episode';
                                return (
                                <div 
                                    key={ep.id} 
                                    onClick={() => handleEpisodeClick(ep)}
                                    className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 group border
                                        ${isSelected 
                                            ? 'bg-white shadow-md border-secondary/30 scale-[1.02]' 
                                            : 'hover:bg-white hover:shadow-sm border-transparent hover:border-gray-100'
                                        }
                                        ${config.appearance.themeMode === 'dark' ? (isSelected ? '!bg-gray-800 !border-secondary/50' : 'hover:!bg-gray-800') : ''}
                                    `}
                                >
                                    <div className="relative w-32 flex-shrink-0 h-20 rounded-lg overflow-hidden bg-black shadow-sm">
                                        <img src={getDirectImageUrl(ep.image)} alt={ep.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                        <div className={`absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors ${isSelected ? 'bg-black/10' : ''}`}>
                                            <PlayCircle size={24} className={`drop-shadow-lg ${isSelected ? 'text-secondary' : 'text-white'}`} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-center min-w-0">
                                        <span className="text-[10px] uppercase font-bold text-secondary tracking-wider mb-1">{ep.date}</span>
                                        <h4 className={`text-sm font-bold leading-snug truncate pr-2 ${isSelected ? 'text-primary' : 'text-on-surface group-hover:text-primary transition-colors'}`}>
                                            {ep.title}
                                        </h4>
                                    </div>
                                </div>
                                );
                             })}
                        </div>
                    </div>
                </div>

                {/* Right Side: Main Video Player */}
                <div className="w-full lg:w-2/3" id="video-main-display">
                     <div className="sticky top-24" style={{ top: `${dynamicNavHeight + 20}px` }}>
                        
                        {/* Player Toggles */}
                        <div className="flex space-x-1 mb-2 bg-surface-alt p-1 rounded-lg inline-flex shadow-sm border border-white/5">
                            <button
                                onClick={() => setPlayerMode('live')}
                                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center transition-all ${
                                    playerMode === 'live' 
                                        ? 'bg-red-600 text-white shadow-md' 
                                        : 'text-on-surface-muted hover:bg-white/10 hover:text-on-surface'
                                }`}
                            >
                                <Tv size={16} className="mr-2" />
                                TRANSMISIÓN EN VIVO
                            </button>
                            <button
                                onClick={() => setPlayerMode('episode')}
                                className={`px-4 py-2 rounded-md text-sm font-bold flex items-center transition-all ${
                                    playerMode === 'episode' 
                                        ? 'bg-secondary text-primary shadow-md' 
                                        : 'text-on-surface-muted hover:bg-white/10 hover:text-on-surface'
                                }`}
                            >
                                <Play size={16} className="mr-2" />
                                EPISODIO SELECCIONADO
                            </button>
                        </div>

                        {/* Video Container */}
                        <VideoPlayer url={activeVideoUrl} title={activeVideoTitle} />

                        {/* Video Info */}
                        <div className="mt-4 p-4 bg-surface-alt rounded-xl border border-white/5">
                             <h3 className="text-xl font-heading font-bold text-primary mb-1">
                                {playerMode === 'live' ? "Transmitiendo Ahora: " + config.content.podcast.title : selectedEpisode?.title || "Selecciona un episodio"}
                             </h3>
                             <p className="text-sm text-on-surface-muted">
                                {playerMode === 'live' ? "Señal en directo." : selectedEpisode?.date || ""}
                             </p>
                        </div>
                    </div>
                </div>

            </div>
            </div>
        </section>
      )}

      {/* Program & Features */}
      {activeSections.program && isSectionEnabled('program') && (
        <section id="program" className="py-20 bg-surface-alt animate-fade-in">
            <div className="container mx-auto px-4 text-center">
            {/* Updated to use text-heading */}
            <h2 className="text-4xl font-heading font-bold text-heading mb-6">
                {config.content.program.title}
            </h2>
            
            {/* Programming Toggle Buttons */}
            <div className="flex justify-center gap-4 mb-12">
                <button 
                    onClick={() => setProgramView('week')}
                    className={`px-6 py-2 rounded-full font-bold transition-all ${
                        programView === 'week' 
                        ? 'bg-secondary text-primary shadow-lg scale-105' 
                        : 'bg-surface text-on-surface-muted hover:bg-gray-200'
                    }`}
                >
                    Lunes a Viernes
                </button>
                <button 
                    onClick={() => setProgramView('weekend')}
                    className={`px-6 py-2 rounded-full font-bold transition-all ${
                        programView === 'weekend' 
                        ? 'bg-secondary text-primary shadow-lg scale-105' 
                        : 'bg-surface text-on-surface-muted hover:bg-gray-200'
                    }`}
                >
                    Fin de Semana
                </button>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {(programView === 'week' ? config.content.program.programs : (config.content.program.weekendPrograms || []))?.map((prog) => (
                <div key={prog.id} className="bg-surface p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow border-t-4 border-secondary text-left group animate-fade-in">
                    <div className="relative w-24 h-24 mb-6 mx-auto md:mx-0">
                        {prog.announcerImage ? (
                            <img 
                                src={prog.announcerImage} 
                                alt={prog.title} 
                                className="w-full h-full object-cover rounded-full border-4 border-secondary/20 group-hover:border-secondary transition-colors"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="w-full h-full bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                <Radio size={40} />
                            </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-secondary text-primary p-2 rounded-full shadow-lg">
                            <Mic2 size={16} />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold mb-1 text-on-surface">{prog.title}</h3>
                    <p className="text-secondary text-xs font-bold uppercase tracking-widest mb-3">{prog.schedule}</p>
                    <p className="text-on-surface-muted text-sm line-clamp-3">{prog.description}</p>
                </div>
                ))}
            </div>
            <div className="mt-12 p-8 bg-primary rounded-2xl text-white">
                <p className="text-xl italic">"{config.content.program.description}"</p>
            </div>
            </div>
        </section>
      )}

      {/* Gallery */}
      {activeSections.gallery && isSectionEnabled('gallery') && (
        <section id="gallery" className="py-20 bg-surface animate-fade-in">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                     {/* Updated to use text-heading */}
                    <h2 className="text-4xl font-heading font-bold text-heading mb-4">
                        {config.content.gallery.title}
                    </h2>
                    <p className="text-lg text-on-surface-muted max-w-2xl mx-auto">
                        {config.content.gallery.description}
                    </p>
                </div>
                
                {/* Horizontal Carousel Layout */}
                <SocialCarousel items={config.content.gallery.images} />
            </div>
        </section>
      )}

      {/* News Section */}
      {activeSections.news && isSectionEnabled('news') && config.content.news && (
        <section id="news" className="py-20 bg-surface animate-fade-in transition-colors duration-300">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-4">
                    <div className="text-center md:text-left">
                        <h2 className="text-4xl font-heading font-bold text-heading relative inline-block">
                            {config.content.news.title || 'Noticias'}
                            {isLoadingRss && <span className="ml-4 text-sm text-secondary animate-pulse absolute -right-24 top-2">Actualizando...</span>}
                            <span className="absolute bottom-0 left-0 w-1/2 h-1 bg-secondary"></span>
                        </h2>
                        <p className="mt-3 text-on-surface-muted max-w-2xl text-lg">
                            {config.content.news.description}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[...(config.content.news.articles.filter(a => a.isPublished)), ...rssArticles]
                        .sort((a, b) => {
                            // Basic string sorting if dates are unparseable, but ideally they parse
                            const dA = new Date(a.date).getTime();
                            const dB = new Date(b.date).getTime();
                            if (!isNaN(dA) && !isNaN(dB)) return dB - dA;
                            return 0; // Fallback
                        })
                        .map((article) => (
                        <article 
                            key={article.id} 
                            className="bg-surface-alt rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group flex flex-col border border-white/5"
                        >
                            <div className="relative h-48 overflow-hidden bg-white/5">
                                <img 
                                    src={getDirectImageUrl(article.image)} 
                                    alt={article.title} 
                                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                                    onError={(e) => {
                                        // Fallback for broken RSS images
                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000&auto=format&fit=crop';
                                    }}
                                />
                                {article.category && (
                                    <span className="absolute top-4 left-4 bg-secondary text-primary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                        {article.category}
                                    </span>
                                )}
                                {article.isRss && (
                                    <span className="absolute top-4 right-4 bg-primary text-secondary text-[10px] font-bold px-2 py-1 rounded uppercase shadow-lg">
                                        Automático
                                    </span>
                                )}
                            </div>
                            <div className="p-6 flex-1 flex flex-col">
                                <div className="flex items-center text-[10px] text-on-surface-muted mb-3 space-x-3 uppercase font-bold tracking-widest">
                                    <span className="flex items-center"><Calendar size={12} className="mr-1 text-secondary" /> {article.date}</span>
                                    {article.author && <span className="flex items-center"><User size={12} className="mr-1 text-secondary" /> {article.author}</span>}
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-on-surface group-hover:text-primary transition-colors leading-tight line-clamp-3">
                                    {article.title}
                                </h3>
                                <p className="text-on-surface-muted text-sm mb-6 line-clamp-3">
                                    {article.summary}
                                </p>
                                <button 
                                    onClick={() => {
                                        if (article.isRss && article.url) {
                                            window.open(article.url, '_blank', 'noopener,noreferrer');
                                        } else {
                                            setSelectedArticle(article);
                                        }
                                    }}
                                    className="mt-auto flex items-center text-secondary font-bold text-sm hover:underline group/btn"
                                >
                                    {article.isRss ? 'Leer en sitio original' : 'Leer más'} <ArrowRight size={16} className="ml-2 transform group-hover/btn:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
      )}

      {/* News Detail Modal */}
      {selectedArticle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-surface w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-fade-in-up relative">
                  <button 
                      onClick={() => setSelectedArticle(null)}
                      className="absolute top-6 right-6 z-10 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full transition-colors"
                  >
                      <X size={24} />
                  </button>

                  <div className="overflow-y-auto custom-scrollbar">
                      <div className="relative h-72 md:h-96">
                          <img 
                              src={getDirectImageUrl(selectedArticle.image)} 
                              alt={selectedArticle.title} 
                              className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent"></div>
                          <div className="absolute bottom-6 left-6 right-6">
                                {selectedArticle.category && (
                                    <span className="bg-secondary text-primary text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider mb-4 inline-block">
                                        {selectedArticle.category}
                                    </span>
                                )}
                                <h2 className="text-3xl md:text-5xl font-heading font-bold text-white drop-shadow-lg">
                                    {selectedArticle.title}
                                </h2>
                          </div>
                      </div>

                      <div className="p-8 md:p-12">
                          <div className="flex flex-wrap gap-6 text-sm text-on-surface-muted mb-8 pb-6 border-b border-gray-200/20">
                              <div className="flex items-center"><Calendar size={18} className="mr-2 text-secondary" /> {selectedArticle.date}</div>
                              {selectedArticle.author && <div className="flex items-center"><User size={18} className="mr-2 text-secondary" /> {selectedArticle.author}</div>}
                          </div>
                          
                          <div className="prose prose-lg dark:prose-invert max-w-none text-on-surface leading-relaxed">
                                <p className="text-xl font-medium text-on-surface-muted mb-8 italic">
                                    {selectedArticle.summary}
                                </p>
                                <div className="whitespace-pre-wrap">
                                    {selectedArticle.content}
                                </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Clients Gallery Section */}
      {activeSections.clients && isSectionEnabled('clients') && config.content.clients && config.content.clients.length > 0 && (
        <section id="clients" className="py-20 bg-surface-alt animate-fade-in">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-heading font-bold text-heading mb-4">
                        Nuestros Aliados
                    </h2>
                    <p className="text-lg text-on-surface-muted max-w-2xl mx-auto">
                        Conoce a las empresas y marcas que confían en nosotros y apoyan nuestra programación.
                    </p>
                </div>
                
                <ClientGallery 
                    clients={config.content.clients} 
                    primaryColor={config.appearance.primaryColor} 
                    secondaryColor={config.appearance.secondaryColor} 
                />
            </div>
        </section>
      )}

      {/* Chat Section (Replaces Donations) */}
      {activeSections.donations && isSectionEnabled('donations') && config.content.chat.enabled && (
        <section id="donations" className="py-20 bg-surface-alt animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
            
            <div className="container mx-auto px-4 relative z-10">
                <Chat config={config.content.chat} />
            </div>
        </section>
      )}

      {/* Contact & Footer */}
      {activeSections.contact && isSectionEnabled('contact') && (
        <footer id="contact" className="bg-gray-900 text-white pt-20 pb-10 animate-fade-in">
            <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-12 mb-12">
                <div>
                <h3 className="text-2xl font-heading font-bold mb-6 text-secondary">{config.general.stationName}</h3>
                <div className="flex space-x-4">
                    {config.social.instagram && <a href={config.social.instagram} target="_blank" rel="noreferrer" className="hover:text-secondary"><Instagram /></a>}
                    {config.social.tiktok && <a href={config.social.tiktok} target="_blank" rel="noreferrer" className="hover:text-secondary"><TikTok /></a>}
                    {config.social.youtube && <a href={config.social.youtube} target="_blank" rel="noreferrer" className="hover:text-secondary"><Youtube /></a>}
                    {config.social.whatsapp && <a href={config.social.whatsapp} target="_blank" rel="noreferrer" className="hover:text-secondary"><Phone /></a>}
                </div>
                </div>
                
                <div>
                <h4 className="text-xl font-bold mb-6">Contacto</h4>
                <ul className="space-y-4 opacity-80">
                    <li className="flex items-center"><Phone size={18} className="mr-3 text-secondary"/> {config.general.contactPhone}</li>
                    <li className="flex items-center"><Mail size={18} className="mr-3 text-secondary"/> {config.general.contactEmail}</li>
                    <li className="flex items-center"><MapPin size={18} className="mr-3 text-secondary"/> {config.general.city || 'Ciudad'}, {config.general.country || 'País'}</li>
                </ul>
                </div>

                <div>
                <h4 className="text-xl font-bold mb-6">Boletín</h4>
                <p className="opacity-70 mb-4">Suscríbete para recibir noticias.</p>
                <div className="flex">
                    <input type="email" placeholder="Tu email" className="bg-gray-800 border-none px-4 py-2 rounded-l w-full focus:ring-1 focus:ring-secondary" />
                    <button className="bg-secondary text-primary px-4 py-2 rounded-r font-bold hover:bg-yellow-400">OK</button>
                </div>
                </div>
            </div>
            
            <div 
                className="border-t border-gray-800 pt-8 text-center opacity-50 text-sm select-none cursor-text transition-opacity hover:opacity-80"
                onClick={handleSecretAccess}
                title="© Rights Reserved"
            >
                &copy; {new Date().getFullYear()} {config.general.stationName}. Todos los derechos reservados.
            </div>
            </div>
        </footer>
      )}

      {/* Video Modal */}
      {playingVideo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in" onClick={() => setPlayingVideo(null)}>
              <div 
                  className="bg-surface w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl relative border border-white/10"
                  onClick={e => e.stopPropagation()}
              >
                  <div className="flex justify-between items-center p-4 bg-surface-alt border-b border-white/5">
                      <h3 className="font-bold text-lg text-on-surface line-clamp-1 pr-4">{playingVideo.title}</h3>
                      <button 
                          onClick={() => setPlayingVideo(null)}
                          className="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full p-2"
                      >
                          <X size={20} />
                      </button>
                  </div>
                  <div className="w-full">
                      <VideoPlayer url={playingVideo.url} title={playingVideo.title} />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PublicView;