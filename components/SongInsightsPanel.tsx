import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  Disc3,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Store,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SongInsightsConfig, SongInsightsData } from '../types';
import { DEFAULT_POSITIVE_MESSAGES, DEFAULT_SONG_INSIGHTS_CONFIG } from '../constants';
import { fetchFreeMusicInsights } from '../utils/freeMusicInsights';

interface SongInsightsPanelProps {
  title: string;
  artist: string;
  stationName: string;
  defaultSlogan: string;
  isPlaying: boolean;
  insightsConfig?: SongInsightsConfig;
  variant?: 'default' | 'tv';
}

type InsightSlideType = 'artist' | 'story' | 'anecdote' | 'sponsor';

const clientInsightsCache = new Map<string, SongInsightsData>();

const isPlaceholderMetadata = (
  title: string,
  artist: string,
  stationName: string,
  defaultSlogan: string
): boolean => {
  const t = (title || '').trim().toUpperCase();
  const s = (stationName || '').trim().toUpperCase();
  const sl = (defaultSlogan || '').trim().toUpperCase();
  if (!t || t === '-' || t === 'SINTONIZANDO...' || t === 'EN VIVO') return true;
  if (t === s || t === sl || t.includes('BUENISIMA') || t.includes('BUENÍSIMA')) return true;
  const a = (artist || '').trim().toUpperCase();
  if (['ORBAN', 'PROMO', 'LOCUCION', 'LOCUCIÓN', 'IDENTIFICACION', 'IDENTIFICACIÓN'].some((k) => t.includes(k) || a.includes(k))) {
    return true;
  }
  return false;
};

export const SongInsightsPanel: React.FC<SongInsightsPanelProps> = ({
  title,
  artist,
  stationName,
  defaultSlogan,
  insightsConfig,
  variant = 'default',
}) => {
  const isTv = variant === 'tv';

  const cfg: SongInsightsConfig = {
    ...DEFAULT_SONG_INSIGHTS_CONFIG,
    ...(insightsConfig || {}),
  };

  const dataSourceMode = cfg.dataSourceMode || 'free';
  const showArtistInfo = cfg.showArtistInfo !== false;
  const showSongStory = cfg.showSongStory !== false;
  const showAnecdotes = cfg.showAnecdotes !== false;
  const showSources = cfg.showSources !== false;
  const allowListenerToggle = !isTv && cfg.allowListenerToggle !== false;
  const autoRotateTabs = cfg.autoRotateTabs !== false;
  const rotationMs = Math.max(4, Math.min(45, cfg.rotationSeconds || 10)) * 1000;

  const positivePool = useMemo(() => {
    const customList = (cfg.positiveMessages || []).map((m) => m.trim()).filter(Boolean);
    const list = customList.length > 0 ? customList : DEFAULT_POSITIVE_MESSAGES;
    const station = stationName || 'BUENÍSIMA';
    return list.map((msg) => msg.replace(/BUENÍSIMA|BUENISIMA|\{station\}/gi, station));
  }, [cfg.positiveMessages, stationName]);

  const activeSponsors = useMemo(
    () => (cfg.enableSponsorMentions ? (cfg.sponsorMentions || []).filter((s) => s.active && s.businessName.trim()) : []),
    [cfg.enableSponsorMentions, cfg.sponsorMentions]
  );

  const sponsorFrequency = cfg.sponsorFrequency || 'interleave';
  const sponsorsOnly = sponsorFrequency === 'sponsors_only' && activeSponsors.length > 0;

  const [insights, setInsights] = useState<SongInsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSlideId, setActiveSlideId] = useState<InsightSlideType>('story');
  const [vibeIndex, setVibeIndex] = useState(0);
  const [sponsorIndex, setSponsorIndex] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (!isTv && typeof window !== 'undefined') {
      return localStorage.getItem('radio_song_insights_collapsed') === 'true';
    }
    return false;
  });

  const abortRef = useRef<AbortController | null>(null);

  const toggleCollapsed = () => {
    if (isTv) return;
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('radio_song_insights_collapsed', String(next));
      } catch (_) {}
      return next;
    });
  };

  const isPlaceholder = useMemo(
    () => isPlaceholderMetadata(title, artist, stationName, defaultSlogan),
    [title, artist, stationName, defaultSlogan]
  );

  const fetchInsights = async (forceRefresh = false) => {
    if (sponsorsOnly || isPlaceholder) {
      setInsights({ found: false, title, artist, reason: 'station_placeholder' });
      setErrorMsg(null);
      setLoading(false);
      return;
    }

    const cleanTitle = title.trim();
    const cleanArtist = artist.trim();
    const cacheKey = `${dataSourceMode}:::${cleanArtist.toLowerCase()}:::${cleanTitle.toLowerCase()}`;

    if (!forceRefresh) {
      const cached = clientInsightsCache.get(cacheKey);
      if (cached) {
        setInsights(cached);
        setErrorMsg(null);
        setLoading(false);
        return;
      }
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams({
        title: cleanTitle,
        artist: cleanArtist,
        mode: dataSourceMode,
      });

      let data: SongInsightsData | null = null;
      const res = await fetch(`/api/song-insights?${params.toString()}`, {
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || 'No se pudo consultar la historia de la canción.');
        }
        data = json;
      } else if (dataSourceMode === 'free') {
        data = await fetchFreeMusicInsights(cleanTitle, cleanArtist);
      } else {
        throw new Error('Servicio de consultas IA no disponible en este entorno.');
      }

      if (data) {
        clientInsightsCache.set(cacheKey, data);
        setInsights(data);

        if (data.songStory && showSongStory) setActiveSlideId('story');
        else if (data.artistInfo && showArtistInfo) setActiveSlideId('artist');
        else if (data.anecdote && showAnecdotes) setActiveSlideId('anecdote');
        else if (activeSponsors.length > 0 && sponsorFrequency === 'interleave') setActiveSlideId('sponsor');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (dataSourceMode === 'free') {
        try {
          const fallbackFree = await fetchFreeMusicInsights(cleanTitle, cleanArtist);
          clientInsightsCache.set(cacheKey, fallbackFree);
          setInsights(fallbackFree);
          setErrorMsg(null);
          return;
        } catch (_) {
          // On network failure in free mode, gracefully show positive messages
          setInsights({ found: false, title: cleanTitle, artist: cleanArtist, reason: 'not_found' });
          setErrorMsg(null);
          return;
        }
      }
      setErrorMsg(err?.message || 'Error consultando datos del tema.');
      setInsights(null);
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInsights(false);
    }, 450);

    return () => {
      clearTimeout(timer);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [title, artist, isPlaceholder, dataSourceMode, sponsorsOnly]);

  // Slides to rotate smoothly (WITHOUT rendering tab boxes in the header so more space is freed for text)
  const availableSlides = useMemo(() => {
    const list: { id: InsightSlideType; heading: string; text: string }[] = [];
    if (insights?.found && !sponsorsOnly) {
      if (showSongStory && insights.songStory) {
        list.push({ id: 'story', heading: 'Historia de la Canción', text: insights.songStory });
      }
      if (showArtistInfo && insights.artistInfo) {
        list.push({ id: 'artist', heading: 'Sobre el Artista', text: insights.artistInfo });
      }
      if (showAnecdotes && insights.anecdote) {
        list.push({ id: 'anecdote', heading: 'Anécdota Musical', text: insights.anecdote });
      }
    }
    if (
      activeSponsors.length > 0 &&
      (sponsorFrequency === 'interleave' || sponsorsOnly) &&
      list.length > 0
    ) {
      const sp = activeSponsors[sponsorIndex % activeSponsors.length];
      list.push({
        id: 'sponsor',
        heading: `${sp.badgeText || 'Comercio Aliado'} · ${sp.businessName}`,
        text: sp.message,
      });
    }
    return list;
  }, [
    insights,
    sponsorsOnly,
    showArtistInfo,
    showSongStory,
    showAnecdotes,
    activeSponsors,
    sponsorFrequency,
    sponsorIndex,
  ]);

  // Keep activeSlideId synced when sections are toggled
  useEffect(() => {
    if (availableSlides.length > 0 && !availableSlides.some((t) => t.id === activeSlideId)) {
      setActiveSlideId(availableSlides[0].id);
    }
  }, [availableSlides, activeSlideId]);

  const advanceSlide = () => {
    if (availableSlides.length > 1) {
      setActiveSlideId((curr) => {
        const idx = availableSlides.findIndex((t) => t.id === curr);
        const nextIdx = (idx + 1) % availableSlides.length;
        if (availableSlides[nextIdx]?.id === 'sponsor' && activeSponsors.length > 1) {
          setSponsorIndex((s) => (s + 1) % activeSponsors.length);
        }
        return availableSlides[nextIdx].id;
      });
    } else {
      setVibeIndex((prev) => prev + 1);
      if (activeSponsors.length > 0) {
        setSponsorIndex((prev) => (prev + 1) % activeSponsors.length);
      }
    }
  };

  // Auto-rotate slides when multiple verified slides exist
  useEffect(() => {
    if ((isCollapsed && allowListenerToggle) || !autoRotateTabs || availableSlides.length <= 1) return;
    const interval = setInterval(advanceSlide, rotationMs);
    return () => clearInterval(interval);
  }, [availableSlides, isCollapsed, allowListenerToggle, autoRotateTabs, rotationMs, activeSponsors.length]);

  // Rotate positive messages & fallback sponsor mentions when no verified song info is active
  useEffect(() => {
    if ((isCollapsed && allowListenerToggle) || loading) return;
    if (availableSlides.length > 0 && !sponsorsOnly) return;
    const interval = setInterval(() => {
      setVibeIndex((prev) => prev + 1);
      if (activeSponsors.length > 0) {
        setSponsorIndex((prev) => (prev + 1) % activeSponsors.length);
      }
    }, rotationMs);
    return () => clearInterval(interval);
  }, [availableSlides.length, sponsorsOnly, loading, isCollapsed, allowListenerToggle, rotationMs, activeSponsors.length]);

  if (allowListenerToggle && isCollapsed) {
    return (
      <div className="w-full lg:w-auto flex items-center justify-center">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-gray-200 transition-all active:scale-95"
          title="Activar panel de historia del artista y canción"
        >
          <Sparkles size={14} className="text-secondary" />
          <span>{cfg.panelTitle || 'Info Canción y Artista'}</span>
          <Eye size={13} className="text-gray-400" />
        </button>
      </div>
    );
  }

  const activeSlide =
    availableSlides.find((t) => t.id === activeSlideId) || availableSlides[0] || null;

  const shouldShowSponsorFallback =
    activeSponsors.length > 0 &&
    (sponsorsOnly || (sponsorFrequency !== 'interleave' ? vibeIndex % 2 === 1 : vibeIndex % 2 === 1));

  const currentSponsor = activeSponsors.length > 0 ? activeSponsors[sponsorIndex % activeSponsors.length] : null;
  const currentPositiveText = positivePool[vibeIndex % positivePool.length];
  const isShowingSponsorCard =
    (activeSlide?.id === 'sponsor' && currentSponsor) ||
    (!activeSlide && shouldShowSponsorFallback && currentSponsor) ||
    (sponsorsOnly && currentSponsor);

  const headerTitle = isShowingSponsorCard && currentSponsor
    ? `${currentSponsor.badgeText || 'Comercio Aliado'} · ${currentSponsor.businessName}`
    : activeSlide && insights?.found
    ? activeSlide.heading
    : errorMsg
    ? 'Info Musical'
    : 'Buena Vibra En Vivo';

  const canAdvanceManually =
    !loading && !errorMsg && (availableSlides.length > 1 || !activeSlide || sponsorsOnly || positivePool.length > 1);

  return (
    <div
      className={`w-full flex-1 min-w-0 backdrop-blur-md flex flex-col justify-between shadow-inner ${
        isTv
          ? 'bg-black/45 border border-white/15 rounded-2xl px-5 py-4 gap-2.5 shadow-2xl'
          : 'bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 gap-2'
      }`}
    >
      {/* Clean Single-Line Header (No Tab Boxes — Maximizes Space for Text) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`rounded-lg border flex items-center justify-center flex-shrink-0 ${
              isTv ? 'w-7 h-7' : 'w-6 h-6'
            } ${
              isShowingSponsorCard
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                : 'bg-secondary/15 border-secondary/30 text-secondary'
            }`}
          >
            {isShowingSponsorCard ? (
              <Store size={isTv ? 15 : 13} />
            ) : insights?.found ? (
              <BookOpen size={isTv ? 15 : 13} />
            ) : (
              <Sparkles size={isTv ? 15 : 13} />
            )}
          </div>
          <span
            className={`font-black uppercase tracking-wider truncate ${
              isTv ? 'text-xs sm:text-sm' : 'text-[11px]'
            } ${isShowingSponsorCard ? 'text-emerald-300' : 'text-secondary'}`}
          >
            {headerTitle}
          </span>
          {!isShowingSponsorCard && insights?.found && (insights.year || insights.genre) && (
            <span
              className={`hidden sm:inline-block font-semibold text-gray-400 truncate ${
                isTv ? 'text-xs' : 'text-[10px]'
              }`}
            >
              · {[insights.year, insights.genre].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canAdvanceManually && (
            <button
              type="button"
              onClick={advanceSlide}
              className={`rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-colors ${
                isTv ? 'p-1.5' : 'p-1'
              }`}
              title="Siguiente"
            >
              <ChevronRight size={isTv ? 16 : 13} />
            </button>
          )}

          {allowListenerToggle && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-colors"
              title="Ocultar panel"
            >
              <EyeOff size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Full-Width Expanded Body Content */}
      <div className={`${isTv ? 'min-h-[60px]' : 'min-h-[48px]'} flex flex-col justify-center`}>
        {loading ? (
          <div className="space-y-1.5 py-0.5 animate-pulse">
            <div className={`flex items-center gap-2 text-gray-400 ${isTv ? 'text-xs sm:text-sm' : 'text-[11px]'}`}>
              <Disc3 size={isTv ? 14 : 12} className="animate-spin text-secondary" />
              <span>Verificando datos reales de {artist || title}...</span>
            </div>
            <div className="h-2.5 bg-white/10 rounded w-11/12" />
            <div className="h-2.5 bg-white/10 rounded w-3/4" />
          </div>
        ) : errorMsg ? (
          <div className="flex items-center justify-between gap-3 text-xs text-amber-200/90">
            <p className="line-clamp-2">{errorMsg}</p>
            <button
              type="button"
              onClick={() => fetchInsights(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex-shrink-0"
            >
              <RefreshCw size={11} />
              <span>Reintentar</span>
            </button>
          </div>
        ) : isShowingSponsorCard && currentSponsor ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={`sponsor-${currentSponsor.id}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <p
                className={`text-emerald-50 leading-relaxed ${
                  isTv ? 'text-sm sm:text-base xl:text-lg' : 'text-xs sm:text-[13px]'
                }`}
              >
                <span className="font-bold text-emerald-300 mr-1.5">{currentSponsor.businessName}:</span>
                {currentSponsor.message}
              </p>
              {currentSponsor.ctaUrl && !isTv && (
                <a
                  href={currentSponsor.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold flex-shrink-0 self-start sm:self-center transition-all"
                >
                  <span>{currentSponsor.ctaLabel || 'Contactar'}</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </motion.div>
          </AnimatePresence>
        ) : activeSlide && insights?.found ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${insights.title}-${activeSlide.id}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="space-y-1.5"
            >
              <p
                className={`text-gray-100 leading-relaxed ${
                  isTv ? 'text-sm sm:text-base xl:text-lg' : 'text-xs sm:text-[13px]'
                }`}
              >
                {activeSlide.text}
              </p>

              {showSources && !isTv && insights.sources && insights.sources.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <span className="text-[10px] text-gray-500 font-semibold">Fuente:</span>
                  {insights.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-secondary transition-colors underline underline-offset-2 truncate max-w-[220px]"
                    >
                      <span className="truncate">{src.title}</span>
                      <ExternalLink size={9} className="flex-shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <AnimatePresence mode="wait">
            <motion.p
              key={vibeIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className={`text-gray-100 leading-relaxed ${
                isTv ? 'text-sm sm:text-base xl:text-lg font-medium' : 'text-xs sm:text-[13px]'
              }`}
            >
              {currentPositiveText}
            </motion.p>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
