import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ProgramItem } from '../types';
import { Radio, Mic2, Play, ArrowRight, ChevronLeft, ChevronRight, Instagram, Facebook, MessageCircle, Youtube, User } from 'lucide-react';

interface ProgramCarouselProps {
  programs: ProgramItem[];
  onSelectEpisodes: (prog: ProgramItem) => void;
  layoutStyle?: 'grid' | 'list' | 'cards' | 'modern';
  autoPlay?: boolean;
  interval?: number;
  direction?: 'horizontal' | 'vertical';
  infiniteLoop?: boolean;
  scrollStep?: number;
  pauseOnHover?: boolean;
  scrollMode?: 'continuous' | 'step';
  speed?: number;
}

export const ProgramCarousel: React.FC<ProgramCarouselProps> = ({ 
  programs, 
  onSelectEpisodes, 
  layoutStyle = 'cards',
  autoPlay = true,
  interval = 4000,
  direction = 'horizontal',
  infiniteLoop = true,
  scrollStep,
  pauseOnHover = true,
  scrollMode = 'continuous',
  speed = 38
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);
  
  // Refs for animation frame loop to avoid stale closures
  const isPausedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const isResettingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Build a rich, seamlessly repeating set of programs
  // We ensure each cycle has at least 6 items so it is wide enough on 4K/wide displays,
  // and we duplicate it across 3 identical cycles: [Cycle 0, Cycle 1, Cycle 2]
  const { cyclePrograms, totalPrograms, cycleCount } = useMemo(() => {
    if (!programs || programs.length === 0) {
      return { cyclePrograms: [], totalPrograms: [], cycleCount: 3 };
    }

    // Multiply within 1 cycle if there are very few items
    const repeatPerCycle = Math.max(1, Math.ceil(6 / programs.length));
    const singleCycle: ProgramItem[] = [];
    for (let r = 0; r < repeatPerCycle; r++) {
      singleCycle.push(...programs);
    }

    if (!infiniteLoop) {
      return { cyclePrograms: singleCycle, totalPrograms: singleCycle, cycleCount: 1 };
    }

    // 3 identical cycles: Cycle 0 (buffer left), Cycle 1 (active center), Cycle 2 (buffer right)
    const combined: ProgramItem[] = [
      ...singleCycle,
      ...singleCycle,
      ...singleCycle
    ];

    return { cyclePrograms: singleCycle, totalPrograms: combined, cycleCount: 3 };
  }, [programs, infiniteLoop]);

  // Calculate cycle dimension (width for horizontal, height for vertical)
  const getCycleDimension = useCallback(() => {
    const el = scrollRef.current;
    if (!el || cycleCount <= 1) return 0;
    return direction === 'horizontal' 
      ? el.scrollWidth / cycleCount 
      : el.scrollHeight / cycleCount;
  }, [cycleCount, direction]);

  // Initialize scroll position to center cycle (Cycle 1) so it can scroll both ways
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !infiniteLoop || totalPrograms.length === 0) return;

    // Small timeout to allow DOM layout to compute accurate scrollWidth/scrollHeight
    const timer = setTimeout(() => {
      const cycleDim = getCycleDimension();
      if (cycleDim > 0) {
        if (direction === 'horizontal') {
          el.scrollLeft = cycleDim;
        } else {
          el.scrollTop = cycleDim;
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [getCycleDimension, infiniteLoop, totalPrograms.length, direction]);

  // Seamless normalization: if scroll position moves past Cycle 1 into Cycle 2 or 0,
  // silently and instantaneously jump back by 1 cycle dimension with NO visual rewind
  const normalizeScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !infiniteLoop || isResettingRef.current) return;

    const cycleDim = getCycleDimension();
    if (cycleDim <= 0) return;

    if (direction === 'horizontal') {
      const current = el.scrollLeft;
      // If we scrolled past Cycle 1 into Cycle 2
      if (current >= cycleDim * 2) {
        isResettingRef.current = true;
        el.style.scrollBehavior = 'auto';
        el.scrollLeft = current - cycleDim;
        isResettingRef.current = false;
      } else if (current <= cycleDim * 0.1) {
        // If we scrolled backwards into Cycle 0
        isResettingRef.current = true;
        el.style.scrollBehavior = 'auto';
        el.scrollLeft = current + cycleDim;
        isResettingRef.current = false;
      }
    } else {
      const current = el.scrollTop;
      if (current >= cycleDim * 2) {
        isResettingRef.current = true;
        el.style.scrollBehavior = 'auto';
        el.scrollTop = current - cycleDim;
        isResettingRef.current = false;
      } else if (current <= cycleDim * 0.1) {
        isResettingRef.current = true;
        el.style.scrollBehavior = 'auto';
        el.scrollTop = current + cycleDim;
        isResettingRef.current = false;
      }
    }
  }, [direction, getCycleDimension, infiniteLoop]);

  // Continuous Glide Loop (requestAnimationFrame)
  useEffect(() => {
    if (!autoPlay || scrollMode !== 'continuous' || !infiniteLoop || totalPrograms.length === 0) {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      return;
    }

    const effectiveSpeed = Math.max(10, Math.min(160, speed || 38));

    const loop = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const delta = Math.min(0.1, (timestamp - lastTimeRef.current) / 1000); // Clamp delta to avoid huge jumps on tab switch
      lastTimeRef.current = timestamp;

      const el = scrollRef.current;
      if (el && !isPausedRef.current && !isDraggingRef.current) {
        const movePx = effectiveSpeed * delta;

        if (direction === 'horizontal') {
          el.scrollLeft += movePx;
        } else {
          el.scrollTop += movePx;
        }

        normalizeScrollPosition();
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = null;
    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [autoPlay, scrollMode, infiniteLoop, totalPrograms.length, speed, direction, normalizeScrollPosition]);

  // Stepped Auto-play Loop (setInterval)
  useEffect(() => {
    if (!autoPlay || scrollMode === 'continuous' || totalPrograms.length <= 1) return;

    const effectiveInterval = Math.max(1500, interval && interval < 100 ? interval * 1000 : (interval || 4000));
    const effectiveStep = scrollStep || (layoutStyle === 'list' ? 420 : 320);

    const timer = setInterval(() => {
      const el = scrollRef.current;
      if (!el || (pauseOnHover && isPausedRef.current) || isDraggingRef.current) return;

      if (direction === 'horizontal') {
        const cycleDim = getCycleDimension();
        if (infiniteLoop && cycleDim > 0 && el.scrollLeft >= cycleDim * 2) {
          el.style.scrollBehavior = 'auto';
          el.scrollLeft = el.scrollLeft - cycleDim;
        }
        el.scrollTo({
          left: el.scrollLeft + effectiveStep,
          behavior: 'smooth'
        });
      } else {
        const cycleDim = getCycleDimension();
        if (infiniteLoop && cycleDim > 0 && el.scrollTop >= cycleDim * 2) {
          el.style.scrollBehavior = 'auto';
          el.scrollTop = el.scrollTop - cycleDim;
        }
        el.scrollTo({
          top: el.scrollTop + effectiveStep,
          behavior: 'smooth'
        });
      }

      // Check normalization shortly after smooth scroll animation completes
      setTimeout(normalizeScrollPosition, 450);
    }, effectiveInterval);

    return () => clearInterval(timer);
  }, [autoPlay, scrollMode, totalPrograms.length, interval, scrollStep, layoutStyle, pauseOnHover, direction, infiniteLoop, getCycleDimension, normalizeScrollPosition]);

  // Manual arrow navigation
  const handleScroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const step = scrollStep || (layoutStyle === 'list' ? 420 : 320);
    const cycleDim = getCycleDimension();

    if (direction === 'horizontal') {
      if (infiniteLoop && cycleDim > 0) {
        // Pre-normalize if too close to edge
        if (dir === 'right' && el.scrollLeft >= cycleDim * 2) {
          el.style.scrollBehavior = 'auto';
          el.scrollLeft = el.scrollLeft - cycleDim;
        } else if (dir === 'left' && el.scrollLeft <= cycleDim * 0.1) {
          el.style.scrollBehavior = 'auto';
          el.scrollLeft = el.scrollLeft + cycleDim;
        }
      }

      const delta = dir === 'left' ? -step : step;
      el.scrollTo({ left: el.scrollLeft + delta, behavior: 'smooth' });
    } else {
      if (infiniteLoop && cycleDim > 0) {
        if (dir === 'right' && el.scrollTop >= cycleDim * 2) {
          el.style.scrollBehavior = 'auto';
          el.scrollTop = el.scrollTop - cycleDim;
        } else if (dir === 'left' && el.scrollTop <= cycleDim * 0.1) {
          el.style.scrollBehavior = 'auto';
          el.scrollTop = el.scrollTop + cycleDim;
        }
      }
      const delta = dir === 'left' ? -step : step;
      el.scrollTo({ top: el.scrollTop + delta, behavior: 'smooth' });
    }

    setTimeout(normalizeScrollPosition, 450);
  };

  // Mouse drag support for smooth dragging on desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setDragStartX(e.pageX - scrollRef.current.offsetLeft);
    setDragScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    scrollRef.current.scrollLeft = dragScrollLeft - walk;
    normalizeScrollPosition();
  };

  const handleMouseUpOrLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      normalizeScrollPosition();
    }
  };

  if (!programs || programs.length === 0) {
    return (
      <div className="py-12 text-center text-on-surface-muted italic">
        No hay programas disponibles en este momento.
      </div>
    );
  }

  // Helper to normalize and build social media URLs
  const getSocialUrl = (network: string, value: string) => {
    if (!value) return '';
    const trimmed = value.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (network === 'instagram') return `https://instagram.com/${trimmed.replace(/^@/, '')}`;
    if (network === 'tiktok') return `https://tiktok.com/@${trimmed.replace(/^@/, '')}`;
    if (network === 'facebook') return `https://facebook.com/${trimmed}`;
    if (network === 'twitter') return `https://x.com/${trimmed.replace(/^@/, '')}`;
    if (network === 'whatsapp') {
      const cleanNum = trimmed.replace(/[^0-9]/g, '');
      return `https://wa.me/${cleanNum}`;
    }
    if (network === 'youtube') return trimmed.startsWith('@') ? `https://youtube.com/${trimmed}` : `https://youtube.com/@${trimmed}`;
    return trimmed;
  };

  // Render announcer social links row
  const renderAnnouncerSocials = (prog: ProgramItem, compact = false) => {
    const links = prog.socialLinks;
    const hasName = Boolean(prog.announcerName);
    const hasLinks = Boolean(links && Object.values(links).some(Boolean));

    if (!hasName && !hasLinks) return null;

    const entries: { network: string; icon: React.ReactNode; color: string; label: string; url: string }[] = [];

    if (links?.instagram) {
      entries.push({
        network: 'instagram',
        icon: <Instagram size={12} />,
        color: 'hover:bg-gradient-to-tr hover:from-amber-500 hover:to-pink-600 hover:text-white',
        label: 'Instagram',
        url: getSocialUrl('instagram', links.instagram)
      });
    }
    if (links?.tiktok) {
      entries.push({
        network: 'tiktok',
        icon: (
          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.46 6.3 6.3 0 0 0 1.86-4.46V8.78a8.21 8.21 0 0 0 4.91 1.63v-3.5a4.77 4.77 0 0 1-1-.22z"/>
          </svg>
        ),
        color: 'hover:bg-black hover:text-cyan-400 hover:border-cyan-400',
        label: 'TikTok',
        url: getSocialUrl('tiktok', links.tiktok)
      });
    }
    if (links?.facebook) {
      entries.push({
        network: 'facebook',
        icon: <Facebook size={12} />,
        color: 'hover:bg-blue-600 hover:text-white',
        label: 'Facebook',
        url: getSocialUrl('facebook', links.facebook)
      });
    }
    if (links?.whatsapp) {
      entries.push({
        network: 'whatsapp',
        icon: <MessageCircle size={12} />,
        color: 'hover:bg-emerald-600 hover:text-white',
        label: 'WhatsApp',
        url: getSocialUrl('whatsapp', links.whatsapp)
      });
    }
    if (links?.twitter) {
      entries.push({
        network: 'twitter',
        icon: (
          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        ),
        color: 'hover:bg-black hover:text-white',
        label: 'X (Twitter)',
        url: getSocialUrl('twitter', links.twitter)
      });
    }
    if (links?.youtube) {
      entries.push({
        network: 'youtube',
        icon: <Youtube size={12} />,
        color: 'hover:bg-red-600 hover:text-white',
        label: 'YouTube',
        url: getSocialUrl('youtube', links.youtube)
      });
    }

    return (
      <div 
        className={`flex items-center flex-wrap gap-1.5 ${compact ? 'mt-1' : 'mt-2 pt-2 border-t border-white/10'}`}
        onClick={e => e.stopPropagation()}
      >
        {prog.announcerName && (
          <span className="text-[10px] text-gray-300 font-bold flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
            <User size={10} className="text-secondary" />
            {prog.announcerName}
          </span>
        )}

        {entries.length > 0 && (
          <div className="flex items-center gap-1">
            {entries.map(s => (
              <a
                key={s.network}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${s.label} de ${prog.announcerName || 'Locutor'}`}
                className={`w-5 h-5 rounded-full bg-white/10 text-white/80 flex items-center justify-center transition-all duration-200 border border-white/10 shadow-sm ${s.color} hover:scale-110 active:scale-95`}
              >
                {s.icon}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render individual program cards without "vivo" badge
  const renderProgramCard = (prog: ProgramItem, uniqueIndex: number) => {
    switch (layoutStyle) {
      case 'list':
        return (
          <div 
            key={`${prog.id}-${uniqueIndex}`} 
            className="bg-surface p-5 sm:p-6 rounded-2xl shadow-md hover:shadow-2xl transition-all border-l-8 border-secondary text-left flex flex-col sm:flex-row gap-5 items-center sm:items-start group/card animate-fade-in w-[320px] sm:w-[480px] flex-shrink-0 select-none cursor-pointer"
            onClick={() => prog.episodes?.length ? onSelectEpisodes(prog) : null}
          >
            <div className="relative w-24 h-24 flex-shrink-0">
              {prog.announcerImage ? (
                <img 
                  src={prog.announcerImage} 
                  alt={prog.title} 
                  className="w-full h-full object-cover rounded-2xl shadow-lg border-2 border-secondary/20 group-hover/card:border-secondary transition-colors"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <Radio size={32} />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 bg-secondary text-primary p-1.5 rounded-full shadow-lg">
                <Mic2 size={14} />
              </div>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex flex-col justify-between gap-1">
                <h3 className="text-xl font-bold text-on-surface truncate group-hover/card:text-secondary transition-colors">{prog.title}</h3>
                <span className="bg-secondary/15 text-secondary text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider w-fit">{prog.schedule}</span>
              </div>
              <p className="text-on-surface-muted text-xs line-clamp-2 leading-relaxed">{prog.description}</p>
              
              {/* Announcer info and social media icons */}
              {renderAnnouncerSocials(prog)}

              {prog.episodes && prog.episodes.length > 0 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEpisodes(prog);
                  }}
                  className="mt-2 inline-flex items-center text-primary font-bold hover:text-secondary transition-colors text-xs group/btn"
                >
                  <Play size={14} className="mr-1.5 fill-current" />
                  Ver Episodios
                  <ArrowRight size={14} className="ml-1.5 transform group-hover/btn:translate-x-1 transition-transform" />
                </button>
              )}
            </div>
          </div>
        );

      case 'modern':
        return (
          <div 
            key={`${prog.id}-${uniqueIndex}`} 
            className="relative w-[280px] sm:w-[340px] h-[420px] rounded-3xl overflow-hidden shadow-2xl group/card animate-fade-in cursor-pointer flex-shrink-0 select-none border border-white/10" 
            onClick={() => prog.episodes?.length ? onSelectEpisodes(prog) : null}
          >
            <img 
              src={prog.announcerImage || 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1000&auto=format&fit=crop'} 
              alt={prog.title} 
              className="absolute inset-0 w-full h-full object-cover transform group-hover/card:scale-105 transition-transform duration-700"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent group-hover/card:from-black/95 transition-all duration-300"></div>
            <div className="absolute inset-0 p-6 flex flex-col justify-end text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-1 bg-secondary rounded-full"></span>
                <span className="text-secondary text-[11px] font-black uppercase tracking-wider">{prog.schedule}</span>
              </div>
              <h3 className="text-2xl font-heading font-bold text-white mb-2 group-hover/card:translate-x-1 transition-transform duration-300">{prog.title}</h3>
              <p className="text-gray-300 text-xs line-clamp-2 mb-3 group-hover/card:opacity-100 transition-opacity duration-300">{prog.description}</p>
              
              {/* Announcer info and social media icons */}
              {renderAnnouncerSocials(prog, true)}

              {prog.episodes && prog.episodes.length > 0 && (
                <div className="flex items-center gap-3 mt-3">
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-primary shadow-xl">
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  </div>
                  <span className="text-white font-bold text-xs tracking-tight">
                    Ver Episodios
                  </span>
                </div>
              )}
            </div>
          </div>
        );

      case 'cards':
      default:
        return (
          <div 
            key={`${prog.id}-${uniqueIndex}`} 
            className="bg-surface rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group/card animate-fade-in border border-white/10 flex flex-col w-[260px] sm:w-[300px] flex-shrink-0 select-none"
          >
            <div className="relative h-48 overflow-hidden bg-black/40">
              {prog.announcerImage ? (
                <img 
                  src={prog.announcerImage} 
                  alt={prog.title} 
                  className="w-full h-full object-cover transform group-hover/card:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-primary">
                  <Radio size={48} className="opacity-60" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"></div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <span className="bg-secondary text-primary text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg">
                  {prog.schedule}
                </span>
              </div>
            </div>
            <div className="p-5 text-left flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold mb-1.5 text-on-surface group-hover/card:text-secondary transition-colors truncate">
                  {prog.title}
                </h3>
                <p className="text-on-surface-muted text-xs line-clamp-2 leading-relaxed italic">
                  "{prog.description}"
                </p>

                {/* Announcer info and social media icons */}
                {renderAnnouncerSocials(prog)}
              </div>
              
              {prog.episodes && prog.episodes.length > 0 && (
                <button 
                  onClick={() => onSelectEpisodes(prog)}
                  className="w-full mt-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition-all bg-primary/90 text-white hover:bg-primary shadow-md hover:shadow-lg active:scale-95"
                >
                  <Mic2 size={15} className="mr-2 text-secondary" />
                  Ver Programas
                </button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className="relative group/carousel px-2 sm:px-6 w-full"
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => {
        if (pauseOnHover) setIsPaused(false);
        handleMouseUpOrLeave();
      }}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => {
        // Resume continuous glide 1.5s after touch interaction ends
        setTimeout(() => setIsPaused(false), 1500);
      }}
    >
      {/* Edge gradient overlays on desktop to create a smooth fade effect */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-surface-alt to-transparent z-10 hidden sm:block"></div>
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-surface-alt to-transparent z-10 hidden sm:block"></div>

      {/* Navigation Arrows */}
      <button 
        onClick={() => handleScroll('left')}
        aria-label="Programa anterior"
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 bg-black/75 hover:bg-secondary text-white hover:text-primary p-3 rounded-full shadow-2xl backdrop-blur-md transition-all duration-200 hidden md:flex items-center justify-center border border-white/10 active:scale-95"
      >
        <ChevronLeft size={22} />
      </button>

      <button 
        onClick={() => handleScroll('right')}
        aria-label="Siguiente programa"
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 bg-black/75 hover:bg-secondary text-white hover:text-primary p-3 rounded-full shadow-2xl backdrop-blur-md transition-all duration-200 hidden md:flex items-center justify-center border border-white/10 active:scale-95"
      >
        <ChevronRight size={22} />
      </button>

      {/* Continuous Scrolling Container */}
      {/* NOTE: We do NOT use 'scroll-smooth' CSS class here because it breaks instant cycle normalization and causes smooth backwards rewind */}
      <div 
        ref={scrollRef}
        onScroll={normalizeScrollPosition}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        className={`flex ${
          direction === 'horizontal' 
            ? 'overflow-x-auto gap-6 sm:gap-8 py-4 px-2' 
            : 'flex-col overflow-y-auto gap-5 max-h-[600px] py-4 px-2'
        } hide-scrollbar ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {totalPrograms.map((prog, index) => renderProgramCard(prog, index))}
      </div>
      
      {/* Mobile Indicator */}
      <div className="flex md:hidden justify-center items-center gap-1.5 mt-3 opacity-60">
        <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
        <div className="w-12 h-1 rounded-full bg-secondary/40"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
      </div>
    </div>
  );
};
