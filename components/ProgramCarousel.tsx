import React, { useRef, useState, useEffect } from 'react';
import { ProgramItem } from '../types';
import { Radio, Mic2, Play, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProgramCarouselProps {
  programs: ProgramItem[];
  onSelectEpisodes: (prog: ProgramItem) => void;
  layoutStyle?: 'grid' | 'list' | 'cards' | 'modern';
  autoPlay?: boolean;
  interval?: number;
  direction?: 'horizontal' | 'vertical';
}

export const ProgramCarousel: React.FC<ProgramCarouselProps> = ({ 
  programs, 
  onSelectEpisodes, 
  layoutStyle = 'grid',
  autoPlay = false,
  interval = 5000,
  direction = 'horizontal'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      if (direction === 'horizontal') {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setShowLeftArrow(scrollLeft > 10);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
      } else {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        setShowLeftArrow(scrollTop > 10);
        setShowRightArrow(scrollTop < scrollHeight - clientHeight - 10);
      }
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      checkScroll();
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [programs.length, direction]);

  // Auto-play effect
  useEffect(() => {
    if (!autoPlay || programs.length <= 1) return;

    const timer = setInterval(() => {
      if (scrollRef.current) {
        const el = scrollRef.current;
        if (direction === 'horizontal') {
          // Explicitly scroll from right to left (RTL) effect by moving container left
          const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 20;
          if (isAtEnd) {
            el.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            // Scroll by one approximate item width + gap
            const scrollAmount = window.innerWidth < 640 ? 300 : 400;
            el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          }
        } else {
          // Bottom to top rotation
          const isAtEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
          if (isAtEnd) {
            el.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            // Scroll by one approximate item height + gap
            const scrollAmount = 420; 
            el.scrollBy({ top: scrollAmount, behavior: 'smooth' });
          }
        }
      }
    }, Math.max(2000, interval));

    return () => clearInterval(timer);
  }, [autoPlay, interval, direction, programs.length]);

  const scroll = (dir: 'left' | 'right' | 'up' | 'down') => {
    if (scrollRef.current) {
      if (direction === 'horizontal') {
        const scrollAmount = (dir === 'left' || dir === 'up') ? -400 : 400;
        scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      } else {
        const scrollAmount = (dir === 'left' || dir === 'up') ? -400 : 400;
        scrollRef.current.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  const renderProgramCard = (prog: ProgramItem) => {
    switch (layoutStyle) {
      case 'list':
        return (
          <div key={prog.id} className="bg-surface p-6 rounded-2xl shadow-md hover:shadow-xl transition-all border-l-8 border-secondary text-left flex flex-col sm:flex-row gap-6 items-center sm:items-start group animate-fade-in w-[350px] sm:w-[500px] flex-shrink-0">
            <div className="relative w-24 h-24 flex-shrink-0">
              {prog.announcerImage ? (
                <img 
                  src={prog.announcerImage} 
                  alt={prog.title} 
                  className="w-full h-full object-cover rounded-2xl shadow-lg border-2 border-secondary/20 group-hover:border-secondary transition-colors"
                  referrerPolicy="no-referrer"
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
                <h3 className="text-xl font-bold text-on-surface truncate">{prog.title}</h3>
                <span className="bg-secondary/10 text-secondary text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest w-fit">{prog.schedule}</span>
              </div>
              <p className="text-on-surface-muted text-xs line-clamp-2 leading-relaxed">{prog.description}</p>
              
              {prog.episodes && prog.episodes.length > 0 && (
                <button 
                  onClick={() => onSelectEpisodes(prog)}
                  className="mt-2 inline-flex items-center text-primary font-bold hover:text-secondary transition-colors text-xs group/btn"
                >
                  <Play size={14} className="mr-1.5 fill-current" />
                  Episodios
                  <ArrowRight size={14} className="ml-1.5 transform group-hover/btn:translate-x-1 transition-transform" />
                </button>
              )}
            </div>
          </div>
        );
      case 'modern':
        return (
          <div key={prog.id} className="relative w-[280px] sm:w-[350px] h-[400px] rounded-3xl overflow-hidden shadow-2xl group animate-fade-in cursor-pointer flex-shrink-0" onClick={() => prog.episodes?.length ? onSelectEpisodes(prog) : null}>
            <img 
              src={prog.announcerImage || 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1000&auto=format&fit=crop'} 
              alt={prog.title} 
              className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-[1.5s]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent group-hover:from-black/90 transition-all duration-500"></div>
            <div className="absolute inset-0 p-6 flex flex-col justify-end text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-1 bg-secondary rounded-full"></span>
                <span className="text-secondary text-[10px] font-black uppercase tracking-widest">{prog.schedule}</span>
              </div>
              <h3 className="text-2xl font-heading font-bold text-white mb-2 group-hover:translate-x-1 transition-transform duration-500">{prog.title}</h3>
              <p className="text-gray-300 text-xs line-clamp-2 mb-4 group-hover:translate-y-0 translate-y-2 opacity-0 group-hover:opacity-100 transition-all duration-700">{prog.description}</p>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary shadow-xl">
                  <Play size={20} fill="currentColor" className="ml-0.5" />
                </div>
                <span className="text-white font-bold text-xs tracking-tight">
                  {prog.episodes?.length ? 'Escuchar' : 'En vivo'}
                </span>
              </div>
            </div>
          </div>
        );
      case 'cards':
      default:
        return (
          <div key={prog.id} className="bg-surface rounded-[2rem] overflow-hidden shadow-xl hover:shadow-2xl transition-all group animate-fade-in border border-white/5 flex flex-col w-[260px] sm:w-[300px] flex-shrink-0">
            <div className="relative h-48 overflow-hidden">
              {prog.announcerImage ? (
                <img 
                  src={prog.announcerImage} 
                  alt={prog.title} 
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary">
                  <Radio size={48} className="opacity-50" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
              <div className="absolute bottom-3 left-4 right-4">
                <span className="bg-secondary text-primary text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter shadow-lg">{prog.schedule}</span>
              </div>
            </div>
            <div className="p-5 text-left flex-1 flex flex-col">
              <h3 className="text-lg font-bold mb-1 text-on-surface group-hover:text-secondary transition-colors truncate">{prog.title}</h3>
              <p className="text-on-surface-muted text-[10px] line-clamp-2 mb-4 flex-1 italic leading-relaxed">"{prog.description}"</p>
              
              <button 
                onClick={() => prog.episodes?.length ? onSelectEpisodes(prog) : null}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                  prog.episodes?.length 
                  ? 'bg-primary text-white hover:bg-purple-900 shadow-md' 
                  : 'bg-gray-100 text-gray-400 cursor-default'
                }`}
              >
                <Mic2 size={16} className="mr-2" />
                {prog.episodes?.length ? 'Ver Programas' : 'En vivo'}
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="relative group px-4 sm:px-10">
      {/* Navigation Arrows */}
      {showLeftArrow && (
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-secondary text-primary p-2 rounded-full shadow-xl transition-all hidden md:flex items-center justify-center"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {showRightArrow && (
        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-secondary text-primary p-2 rounded-full shadow-xl transition-all hidden md:flex items-center justify-center"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Scrolling Container */}
      <div 
        ref={scrollRef}
        className={`flex ${direction === 'horizontal' ? 'overflow-x-auto gap-6 sm:gap-8 px-2' : 'flex-col overflow-y-auto gap-4 max-h-[600px] px-4'} hide-scrollbar scroll-smooth`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {programs.map(renderProgramCard)}
      </div>
      
      {/* Mobile Indicator */}
      <div className="flex md:hidden justify-center items-center gap-1.5 mt-2 opacity-50">
        <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
        <div className="w-10 h-1 rounded-full bg-secondary/30"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-secondary/30"></div>
      </div>
    </div>
  );
};
