import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronRight,
  ExternalLink,
  Home,
  Image as ImageIcon,
  Instagram,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  Mic2,
  Moon,
  Newspaper,
  Pause,
  Phone,
  Play,
  PlayCircle,
  Radio,
  RefreshCw,
  Sun,
  Tv,
  Users,
  Video,
  Volume1,
  Volume2,
  VolumeX,
  X,
  Youtube,
  Globe,
} from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { useRadioAudio } from '../context/RadioAudioContext';
import { AudioVisualizerCanvas } from './AudioVisualizerCanvas';
import { SongInsightsPanel } from './SongInsightsPanel';
import { SongRequestForm } from './SongRequestForm';
import { ClientGallery } from './ClientGallery';
import { SocialCarousel } from './SocialCarousel';
import { SocialEmbed } from './SocialEmbed';
import { WidgetEmbed } from './WidgetEmbed';
import Chat from './Chat';
import { TikTok } from './TikTokIcon';
import { DEFAULT_VISUALIZER_PROFILE } from '../constants';
import { NewsItem, ProgramItem } from '../types';
import { resolveDirectImageUrl } from '../utils/imageUrl';

interface RadioAppShellProps {
  onDisableAppMode: () => void;
  navigationSignal?: { sectionId: string; nonce: number } | null;
}

type AppTab =
  | 'home'
  | 'radio'
  | 'programs'
  | 'news'
  | 'community'
  | 'clients'
  | 'gallery'
  | 'contact';

const getYoutubeEmbedUrl = (url: string) => {
  if (!url) return '';
  const cleanUrl = url.trim();
  const regExp =
    /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|live\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
  const match = cleanUrl.match(regExp);
  if (match && match[1] && match[1].length === 11) {
    return `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  }
  return cleanUrl;
};

const AppVideoPlayer: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  const embedUrl = getYoutubeEmbedUrl(url);
  const isYoutube = embedUrl.includes('youtube.com/embed') || embedUrl.includes('youtube-nocookie.com/embed');
  const isDirectVideo = url.match(/\.(mp4|webm|ogg)$/i);

  if (!url) {
    return (
      <div className="relative w-full pb-[56.25%] bg-black rounded-2xl overflow-hidden">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <Video size={40} className="mb-2 opacity-50" />
          <p className="text-sm">Selecciona un video o transmisión</p>
        </div>
      </div>
    );
  }

  if (isYoutube) {
    return (
      <div className="relative w-full pb-[56.25%] bg-black rounded-2xl overflow-hidden shadow-xl">
        <iframe
          key={embedUrl}
          className="absolute inset-0 w-full h-full"
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  if (isDirectVideo || url.includes('/assets/') || url.startsWith('blob:')) {
    return (
      <div className="relative w-full pb-[56.25%] bg-black rounded-2xl overflow-hidden shadow-xl">
        <video key={url} className="absolute inset-0 w-full h-full" controls autoPlay playsInline>
          <source src={url} type={url.endsWith('webm') ? 'video/webm' : 'video/mp4'} />
        </video>
      </div>
    );
  }

  const lower = url.toLowerCase();
  const type = lower.includes('instagram.com')
    ? 'instagram'
    : lower.includes('tiktok.com')
    ? 'tiktok'
    : lower.includes('facebook.com')
    ? 'facebook'
    : lower.includes('x.com') || lower.includes('twitter.com')
    ? 'twitter'
    : '';

  return (
    <div className="w-full bg-black/30 rounded-2xl overflow-hidden flex justify-center">
      <SocialEmbed url={url} type={type as any} />
    </div>
  );
};

export const RadioAppShell: React.FC<RadioAppShellProps> = ({
  onDisableAppMode,
  navigationSignal,
}) => {
  const { config, updateConfig } = useConfig();
  const {
    isPlaying,
    isBuffering,
    isReconnecting,
    hasError,
    isLiveConnected,
    isFetchingMetadata,
    volume,
    isMuted,
    analyzerNode,
    stationName,
    defaultSlogan,
    displayTitle,
    displayArtist,
    finalCover,
    togglePlay,
    setVolumeLevel,
    toggleMute,
    fetchMetadata,
    handleImageError,
  } = useRadioAudio();

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [programScope, setProgramScope] = useState<'week' | 'weekend'>('week');
  const [playerMode, setPlayerMode] = useState<'live' | 'episode'>('live');
  const [selectedEpisode, setSelectedEpisode] = useState(config.content.podcast.episodes[0] || null);
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<ProgramItem | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null);
  const [showSongModal, setShowSongModal] = useState(false);
  const [rssArticles, setRssArticles] = useState<NewsItem[]>([]);
  const [isLoadingRss, setIsLoadingRss] = useState(false);
  const [secretClicks, setSecretClicks] = useState(0);

  const isDark = config.appearance.themeMode !== 'light';
  const hasCustomBg = !!(config.appearance.seasonal?.enabled && config.appearance.seasonal.backgroundType !== 'theme');

  useEffect(() => {
    if (!navigationSignal?.sectionId) return;
    const sec = navigationSignal.sectionId.toLowerCase();
    if (sec === 'podcast' || sec === 'topvideos') {
      setActiveTab('radio');
    } else if (sec === 'program') {
      setActiveTab('programs');
    } else if (sec === 'news') {
      setActiveTab('news');
    } else if (sec === 'clients') {
      setActiveTab('clients');
    } else if (sec === 'gallery') {
      setActiveTab('gallery');
    } else if (sec === 'contact') {
      setActiveTab('contact');
    } else if (sec === 'donations' || sec === 'chat') {
      setActiveTab('community');
    } else {
      setActiveTab('home');
    }
    setMobileDrawerOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [navigationSignal]);

  useEffect(() => {
    const feeds = config.content.news?.rssFeeds || [];
    if (feeds.length === 0) {
      setRssArticles([]);
      return;
    }
    const fetchRss = async () => {
      setIsLoadingRss(true);
      try {
        const urls = feeds.map((f) => encodeURIComponent(f.url)).join(',');
        const res = await fetch(`/api/rss?urls=${urls}`);
        if (res.ok) {
          const data = await res.json();
          setRssArticles(data || []);
        }
      } catch (_) {}
      finally {
        setIsLoadingRss(false);
      }
    };
    fetchRss();
  }, [config.content.news?.rssFeeds]);

  const toggleTheme = () => {
    updateConfig({
      ...config,
      appearance: {
        ...config.appearance,
        themeMode: isDark ? 'light' : 'dark',
      },
    });
  };

  const handleSecretAccess = () => {
    const next = secretClicks + 1;
    setSecretClicks(next);
    setTimeout(() => setSecretClicks(0), 2000);
    if (next >= 5) {
      window.location.hash = '#/login';
      setSecretClicks(0);
    }
  };

  const allNews = useMemo(() => {
    const manual = (config.content.news?.articles || []).filter((a) => a.isPublished);
    return [...manual, ...rssArticles].sort((a, b) => {
      const dA = new Date(a.date).getTime();
      const dB = new Date(b.date).getTime();
      if (!isNaN(dA) && !isNaN(dB)) return dB - dA;
      return 0;
    });
  }, [config.content.news?.articles, rssArticles]);

  const weekPrograms = config.content.program?.programs || [];
  const weekendPrograms = config.content.program?.weekendPrograms || [];
  const displayedPrograms =
    programScope === 'weekend' && weekendPrograms.length > 0 ? weekendPrograms : weekPrograms;

  const activeVideoUrl =
    playerMode === 'live' ? config.content.podcast.liveUrl : selectedEpisode?.videoUrl || '';
  const activeVideoTitle =
    playerMode === 'live' ? 'Transmisión En Vivo' : selectedEpisode?.title || 'Episodio';

  const logoUrl = resolveDirectImageUrl(config.navigation.logoUrl || config.general.logoUrl);

  const getVolumeIcon = (size = 18) => {
    if (isMuted || volume === 0) return <VolumeX size={size} />;
    if (volume < 0.4) return <Volume1 size={size} />;
    return <Volume2 size={size} />;
  };

  const navItems: { id: AppTab; label: string; shortLabel: string; icon: React.ElementType }[] = [
    { id: 'home', label: 'En Vivo', shortLabel: 'Inicio', icon: Home },
    { id: 'radio', label: 'Radio & TV', shortLabel: 'TV', icon: PlayCircle },
    { id: 'programs', label: 'Programación', shortLabel: 'Parrilla', icon: Calendar },
    { id: 'news', label: 'Noticias', shortLabel: 'Noticias', icon: Newspaper },
    { id: 'community', label: 'Comunidad', shortLabel: 'Chat', icon: MessageSquare },
    { id: 'clients', label: 'Aliados', shortLabel: 'Aliados', icon: Users },
    { id: 'gallery', label: 'Galería', shortLabel: 'Galería', icon: ImageIcon },
    { id: 'contact', label: 'Contacto', shortLabel: 'Contacto', icon: Phone },
  ];

  // Semantic Surface Tokens (Strict Dark / Light pairing)
  const canvasBg = hasCustomBg
    ? 'bg-transparent'
    : isDark
    ? 'bg-[#090d16] text-slate-100'
    : 'bg-[#f4f6fa] text-slate-900';

  const sidebarSurface = isDark
    ? 'bg-[#0d1322]/95 border-white/10 text-slate-100'
    : 'bg-white/95 border-slate-200 text-slate-900';

  const headerSurface = isDark
    ? 'bg-[#0d1322]/90 border-white/10 text-slate-100'
    : 'bg-white/90 border-slate-200 text-slate-900';

  const cardSurface = isDark
    ? 'bg-[#12192b]/95 border border-white/10 text-slate-100'
    : 'bg-white border border-slate-200/90 text-slate-900 shadow-sm';

  const subtleSurface = isDark
    ? 'bg-white/[0.04] border border-white/10'
    : 'bg-slate-100/80 border border-slate-200/80';

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  const statusLabel = isReconnecting
    ? 'Reconectando'
    : isBuffering && isPlaying
    ? 'Sintonizando'
    : isPlaying
    ? 'Al Aire'
    : hasError
    ? 'Sin Señal'
    : 'En Sintonía';

  const activeHeadingMap: Record<AppTab, string> = {
    home: 'Escucha en Vivo',
    radio: 'Radio TV & Podcast',
    programs: 'Parrilla de Programación',
    news: 'Noticias y Actualidad',
    community: 'Comunidad & Chat en Vivo',
    clients: 'Comercios Aliados',
    gallery: 'Galería',
    contact: 'Contacto',
  };

  const switchToTab = (tab: AppTab) => {
    setActiveTab(tab);
    setMobileDrawerOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className={`min-h-screen app-body flex ${canvasBg} transition-colors duration-300 relative`}>
      {/* DESKTOP APP LEFT SIDEBAR */}
      <aside
        className={`hidden lg:flex flex-col w-64 shrink-0 border-r backdrop-blur-xl fixed inset-y-0 left-0 z-40 ${sidebarSurface}`}
      >
        {/* Brand Header */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-current/10">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={stationName}
              className="w-10 h-10 rounded-xl object-contain bg-black/20 p-1 shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0">
              <Radio size={20} />
            </div>
          )}
          <div className="min-w-0">
            <div className="app-display font-extrabold text-base tracking-tight truncate">
              {stationName}
            </div>
            <div className={`text-xs truncate ${mutedText}`}>{defaultSlogan}</div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchToTab(item.id)}
                className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-secondary text-primary shadow-md'
                    : isDark
                    ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <Icon size={19} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Web Version Switch */}
        <div className="p-4 border-t border-current/10">
          {/* Switch off App Mode -> Return to Web Version */}
          <button
            type="button"
            onClick={onDisableAppMode}
            className={`w-full min-h-[44px] flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${
              isDark
                ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
            }`}
            title="Desactivar Modo App y volver a la página web clásica"
          >
            <span className="flex items-center gap-2">
              <Globe size={15} className="text-secondary shrink-0" />
              <span>Modo App</span>
            </span>
            <span className="inline-flex items-center w-9 h-5 rounded-full bg-emerald-500 p-0.5 justify-end">
              <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </span>
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen">
        {/* TOP APP BAR (56px mobile / 64px desktop) */}
        <header
          className={`sticky top-0 z-30 h-14 lg:h-16 border-b backdrop-blur-xl px-4 lg:px-8 flex items-center justify-between gap-4 ${headerSurface}`}
        >
          {/* Left: Mobile Drawer Trigger + Logo + Title OR Desktop View Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-current/10 transition-colors shrink-0"
              aria-label="Abrir menú vertical"
            >
              <Menu size={21} />
            </button>
            {logoUrl && (
              <img
                src={logoUrl}
                alt={stationName}
                className="w-8 h-8 rounded-lg object-contain lg:hidden shrink-0"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="min-w-0">
              <h1 className="app-display font-bold text-base lg:text-lg tracking-tight truncate lg:hidden">
                {stationName}
              </h1>
              <h1 className="app-display font-bold text-lg tracking-tight truncate hidden lg:block">
                {activeHeadingMap[activeTab]}
              </h1>
            </div>
          </div>

          {/* Right: Clean Single-Line Controls + App/Web Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href="#/pantalla"
              className={`min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                isDark
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
              }`}
              title="Abrir Pantalla TV"
            >
              <Tv size={15} className="text-secondary shrink-0" />
              <span className="hidden sm:inline">Pantalla TV</span>
            </a>

            <button
              type="button"
              onClick={toggleTheme}
              className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border transition-colors shrink-0 ${
                isDark
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
              }`}
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              type="button"
              onClick={onDisableAppMode}
              className="min-h-[40px] flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl bg-secondary text-primary font-bold text-xs shadow-sm hover:brightness-105 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              title="Desactivar Modo App y ver la versión web completa"
            >
              <Globe size={15} className="shrink-0" />
              <span>Versión Web</span>
            </button>
          </div>
        </header>

        {/* SCROLLABLE APP VIEWPORT */}
        <main
          className={`flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-7 ${
            activeTab === 'home' ? 'pb-24 lg:pb-10' : 'pb-40 lg:pb-28'
          }`}
        >
          {/* TAB 1: HOME (LIVE RADIO STUDIO + DISCOVERY) */}
          {activeTab === 'home' && (
            <div className="space-y-8 animate-fade-in">
              {/* Main Studio Row: Live Player + Quick Request */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 lg:gap-6 items-stretch">
                {/* Main Now Playing Studio Card */}
                <section
                  className={`${
                    config.songRequest?.enabled !== false ? 'xl:col-span-8' : 'xl:col-span-12'
                  } rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl ${
                    isDark
                      ? 'bg-gradient-to-br from-[#11192e] via-[#0c1222] to-[#080c17] border border-white/10 text-white'
                      : 'bg-gradient-to-br from-[#0f172a] via-[#131c31] to-[#0a0f1d] border border-slate-800 text-white'
                  }`}
                >
                  <div className="p-5 sm:p-7 space-y-5 flex-1 flex flex-col justify-between">
                    {/* Top: Cover + Track Info + Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                      <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                        {/* Clean Square Cover */}
                        <div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-2xl overflow-hidden border border-white/15 bg-black/40 shadow-2xl shrink-0">
                          <img
                            src={finalCover}
                            alt={displayTitle}
                            onError={handleImageError}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Track Metadata */}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 text-secondary font-bold">
                              {isPlaying && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                              <span>{statusLabel}</span>
                            </span>
                            {isLiveConnected && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-400">Señal Directa</span>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => fetchMetadata(true)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                              title="Actualizar canción en vivo"
                            >
                              <RefreshCw size={13} className={isFetchingMetadata ? 'animate-spin text-secondary' : ''} />
                            </button>
                          </div>

                          <h2
                            className="app-display font-extrabold text-white tracking-tight leading-snug text-balance line-clamp-2"
                            style={{ fontSize: 'clamp(1.25rem, 2.4vw, 2rem)' }}
                            title={displayTitle}
                          >
                            {displayTitle}
                          </h2>

                          <p className="text-sm sm:text-base font-semibold text-secondary truncate">
                            {hasError
                              ? 'Señal interrumpida · Toca reproducir'
                              : isReconnecting
                              ? 'Reconectando audio...'
                              : displayArtist}
                          </p>
                        </div>
                      </div>

                      {/* Primary Transport Controls + Pedir Canción inside Player */}
                      <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
                        <button
                          type="button"
                          onClick={togglePlay}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-secondary hover:brightness-110 text-primary flex items-center justify-center shadow-xl shadow-secondary/20 transition-transform active:scale-95 shrink-0"
                          title={isPlaying ? 'Pausar radio' : 'Escuchar radio en vivo'}
                        >
                          {isPlaying ? (
                            <Pause size={28} fill="currentColor" />
                          ) : (
                            <Play size={28} fill="currentColor" className="ml-1" />
                          )}
                        </button>

                        <div className="flex items-center gap-2.5 bg-white/[0.06] border border-white/10 rounded-full px-4 py-2.5 flex-1 md:w-40 min-w-[140px]">
                          <button
                            type="button"
                            onClick={toggleMute}
                            className="text-gray-300 hover:text-white transition-colors shrink-0 min-h-[24px]"
                            title={isMuted ? 'Activar volumen' : 'Silenciar'}
                          >
                            {getVolumeIcon(18)}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-white/20 rounded-full accent-secondary cursor-pointer"
                            aria-label="Volumen"
                          />
                        </div>

                        {config.songRequest?.enabled !== false && (
                          <button
                            type="button"
                            onClick={() => setShowSongModal(true)}
                            className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg transition-all active:scale-95 whitespace-nowrap shrink-0"
                            title="Pedir tu canción favorita al aire"
                          >
                            <MessageCircle size={16} />
                            <span>Pedir Canción</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Song & Artist Info / Positive Buenísima / Sponsor Card */}
                    {config.appearance.radioPlayer?.showSongInsights !== false &&
                      config.appearance.radioPlayer?.songInsightsConfig?.enabled !== false && (
                        <SongInsightsPanel
                          title={displayTitle}
                          artist={displayArtist}
                          stationName={stationName}
                          defaultSlogan={defaultSlogan}
                          isPlaying={isPlaying}
                          insightsConfig={config.appearance.radioPlayer?.songInsightsConfig}
                        />
                      )}
                  </div>

                  {/* Full-width Continuous Bottom Visualizer */}
                  {config.appearance.radioPlayer?.showAnalyzer !== false && (
                    <div className="w-full bg-gradient-to-t from-black/50 to-transparent pt-1">
                      <AudioVisualizerCanvas
                        isPlaying={isPlaying}
                        isBuffering={isBuffering}
                        isMuted={isMuted}
                        volume={volume}
                        isVisible={true}
                        analyzer={analyzerNode}
                        profile={config.appearance.radioPlayer?.visualizer || DEFAULT_VISUALIZER_PROFILE}
                      />
                    </div>
                  )}
                </section>

                {/* Side Card: Compact WhatsApp Request */}
                {config.songRequest?.enabled !== false && (
                  <aside className="xl:col-span-4 flex flex-col justify-stretch">
                    <div className="h-full flex flex-col justify-center">
                      <SongRequestForm
                        whatsappNumber={config.songRequest?.whatsappNumber || '0424 1555789'}
                        songRequestConfig={config.songRequest}
                        compact={true}
                      />
                    </div>
                  </aside>
                )}
              </div>

              {/* Quick Programs Strip */}
              {weekPrograms.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="app-display font-bold text-xl sm:text-2xl tracking-tight">
                        {config.content.program?.title || 'Programación de Hoy'}
                      </h3>
                      <p className={`text-sm ${mutedText}`}>
                        Conecta con nuestros locutores y programas grabados
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchToTab('programs')}
                      className="min-h-[40px] flex items-center gap-1 text-sm font-bold text-secondary hover:underline whitespace-nowrap shrink-0"
                    >
                      <span>Ver todos</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {weekPrograms.slice(0, 4).map((prog) => (
                      <button
                        key={prog.id}
                        type="button"
                        onClick={() => setSelectedProgram(prog)}
                        className={`text-left p-4 rounded-2xl transition-all hover:-translate-y-0.5 flex items-center gap-3.5 ${cardSurface}`}
                      >
                        {prog.announcerImage ? (
                          <img
                            src={resolveDirectImageUrl(prog.announcerImage)}
                            alt={prog.title}
                            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-current/10"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                            <Mic2 size={22} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="font-bold text-sm sm:text-base leading-snug truncate">
                            {prog.title}
                          </div>
                          <div className={`text-xs truncate tabular-nums ${mutedText}`}>
                            {prog.schedule}
                            {prog.announcerName ? ` · ${prog.announcerName}` : ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Top Viral Videos Grid (if enabled) */}
              {config.content.topVideos?.enabled && (config.content.topVideos.videos || []).length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="app-display font-bold text-xl sm:text-2xl tracking-tight">
                        {config.content.topVideos.title || 'Lo Más Viral'}
                      </h3>
                      <p className={`text-sm ${mutedText}`}>{config.content.topVideos.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {config.content.topVideos.videos.slice(0, 4).map((v, idx) => {
                      const match = v.url.match(
                        /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|live\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/
                      );
                      const vidId = match && match[1] && match[1].length === 11 ? match[1] : null;
                      const thumb = vidId ? `https://img.youtube.com/vi/${vidId}/hqdefault.jpg` : '';
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setPlayingVideo({ url: v.url, title: v.title })}
                          className={`text-left rounded-2xl overflow-hidden group transition-all hover:-translate-y-0.5 flex flex-col ${cardSurface}`}
                        >
                          <div className="relative w-full pb-[56.25%] bg-black/50 overflow-hidden">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={v.title}
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                                <Video size={28} />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/45 transition-colors flex items-center justify-center">
                              <div className="w-11 h-11 rounded-full bg-secondary text-primary flex items-center justify-center shadow-lg">
                                <Play size={18} fill="currentColor" className="ml-0.5" />
                              </div>
                            </div>
                          </div>
                          <div className="p-4 space-y-1">
                            <div className={`text-xs font-semibold tabular-nums ${mutedText}`}>
                              Top #{idx + 1} · Video destacado
                            </div>
                            <div className="font-bold text-sm leading-snug line-clamp-2">{v.title}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Latest News Preview */}
              {allNews.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="app-display font-bold text-xl sm:text-2xl tracking-tight">
                        {config.content.news?.title || 'Últimas Noticias'}
                      </h3>
                      <p className={`text-sm ${mutedText}`}>
                        Actualidad local, música y entretenimiento
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchToTab('news')}
                      className="min-h-[40px] flex items-center gap-1 text-sm font-bold text-secondary hover:underline whitespace-nowrap shrink-0"
                    >
                      <span>Leer todas</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {allNews.slice(0, 3).map((article) => (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => {
                          if (article.isRss && article.url) {
                            window.open(article.url, '_blank', 'noopener,noreferrer');
                          } else {
                            setSelectedArticle(article);
                          }
                        }}
                        className={`text-left rounded-2xl overflow-hidden flex flex-col transition-all hover:-translate-y-0.5 ${cardSurface}`}
                      >
                        <div className="h-44 w-full bg-black/30 overflow-hidden">
                          <img
                            src={resolveDirectImageUrl(article.image)}
                            alt={article.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="p-5 flex-1 flex flex-col gap-2">
                          <div className={`text-xs font-medium tabular-nums ${mutedText}`}>
                            {[article.category || 'Actualidad', article.date].filter(Boolean).join(' · ')}
                          </div>
                          <h4 className="app-display font-bold text-base leading-snug line-clamp-2">
                            {article.title}
                          </h4>
                          <p className={`text-sm leading-relaxed line-clamp-2 mt-auto ${mutedText}`}>
                            {article.summary}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Partners / Sponsors Preview */}
              {config.content.clients && config.content.clients.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="app-display font-bold text-xl sm:text-2xl tracking-tight">
                        Comercios y Aliados
                      </h3>
                      <p className={`text-sm ${mutedText}`}>
                        Marcas que impulsan nuestra programación diaria
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchToTab('clients')}
                      className="min-h-[40px] flex items-center gap-1 text-sm font-bold text-secondary hover:underline whitespace-nowrap shrink-0"
                    >
                      <span>Explorar</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <ClientGallery
                    clients={config.content.clients}
                    primaryColor={config.appearance.primaryColor}
                    secondaryColor={config.appearance.secondaryColor}
                  />
                </section>
              )}
            </div>
          )}

          {/* TAB 2: RADIO & TV / PODCAST */}
          {activeTab === 'radio' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="app-display font-extrabold text-2xl sm:text-3xl tracking-tight">
                    {config.content.podcast?.title || 'Radio & TV En Vivo'}
                  </h2>
                  <p className={`text-sm sm:text-base mt-1 ${mutedText}`}>
                    {config.content.podcast?.description}
                  </p>
                </div>

                {/* Mode Switcher */}
                <div className={`inline-flex p-1 rounded-xl ${subtleSurface} self-start`}>
                  <button
                    type="button"
                    onClick={() => setPlayerMode('live')}
                    className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                      playerMode === 'live' ? 'bg-red-600 text-white shadow' : mutedText
                    }`}
                  >
                    Señal En Vivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerMode('episode')}
                    className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                      playerMode === 'episode' ? 'bg-secondary text-primary shadow' : mutedText
                    }`}
                  >
                    Episodios ({config.content.podcast.episodes.length})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-4">
                  <AppVideoPlayer url={activeVideoUrl} title={activeVideoTitle} />
                  <div className={`p-5 rounded-2xl ${cardSurface}`}>
                    <h3 className="app-display font-bold text-lg sm:text-xl">{activeVideoTitle}</h3>
                    <p className={`text-sm mt-1 ${mutedText}`}>
                      {playerMode === 'live'
                        ? 'Transmisión audiovisual en directo.'
                        : selectedEpisode?.date || 'Episodio bajo demanda'}
                    </p>
                  </div>
                </div>

                <div className={`lg:col-span-4 rounded-2xl p-4 space-y-3 max-h-[560px] overflow-y-auto ${cardSurface}`}>
                  <h3 className="app-display font-bold text-base px-1">Episodios Recientes</h3>
                  {config.content.podcast.episodes.length > 0 ? (
                    config.content.podcast.episodes.map((ep) => {
                      const active = selectedEpisode?.id === ep.id && playerMode === 'episode';
                      return (
                        <button
                          key={ep.id}
                          type="button"
                          onClick={() => {
                            setSelectedEpisode(ep);
                            setPlayerMode('episode');
                          }}
                          className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                            active
                              ? 'bg-secondary/15 border border-secondary/40'
                              : isDark
                              ? 'hover:bg-white/[0.05] border border-transparent'
                              : 'hover:bg-slate-100 border border-transparent'
                          }`}
                        >
                          <img
                            src={resolveDirectImageUrl(ep.image)}
                            alt={ep.title}
                            className="w-20 h-14 rounded-lg object-cover shrink-0 bg-black/40"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm line-clamp-2 leading-snug">{ep.title}</div>
                            <div className={`text-xs mt-0.5 tabular-nums ${mutedText}`}>{ep.date}</div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <p className={`text-sm py-8 text-center ${mutedText}`}>
                      No hay episodios grabados aún.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROGRAMS */}
          {activeTab === 'programs' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="app-display font-extrabold text-2xl sm:text-3xl tracking-tight">
                    {config.content.program?.title || 'Programación'}
                  </h2>
                  <p className={`text-sm sm:text-base mt-1 ${mutedText}`}>
                    {config.content.program?.description}
                  </p>
                </div>

                {weekendPrograms.length > 0 && (
                  <div className={`inline-flex p-1 rounded-xl ${subtleSurface} self-start`}>
                    <button
                      type="button"
                      onClick={() => setProgramScope('week')}
                      className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                        programScope === 'week' ? 'bg-secondary text-primary shadow' : mutedText
                      }`}
                    >
                      Lun a Vie
                    </button>
                    <button
                      type="button"
                      onClick={() => setProgramScope('weekend')}
                      className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                        programScope === 'weekend' ? 'bg-secondary text-primary shadow' : mutedText
                      }`}
                    >
                      Fin de Semana
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayedPrograms.map((prog) => (
                  <div
                    key={prog.id}
                    className={`rounded-2xl p-5 flex flex-col justify-between gap-4 ${cardSurface}`}
                  >
                    <div className="flex items-start gap-4">
                      {prog.announcerImage ? (
                        <img
                          src={resolveDirectImageUrl(prog.announcerImage)}
                          alt={prog.title}
                          className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-current/10"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                          <Mic2 size={26} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className={`text-xs font-semibold tabular-nums ${mutedText}`}>
                          {prog.schedule}
                          {prog.announcerName ? ` · ${prog.announcerName}` : ''}
                        </div>
                        <h3 className="app-display font-bold text-lg leading-snug">{prog.title}</h3>
                      </div>
                    </div>

                    <p className={`text-sm leading-relaxed ${mutedText}`}>{prog.description}</p>

                    <div className="flex items-center justify-between pt-3 border-t border-current/10">
                      <button
                        type="button"
                        onClick={() => setSelectedProgram(prog)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 text-sm font-bold text-secondary hover:underline whitespace-nowrap"
                      >
                        <PlayCircle size={16} />
                        <span>
                          {prog.episodes && prog.episodes.length > 0
                            ? `Escuchar episodios (${prog.episodes.length})`
                            : 'Ver detalles'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: NEWS */}
          {activeTab === 'news' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="app-display font-extrabold text-2xl sm:text-3xl tracking-tight flex items-center gap-3">
                  <span>{config.content.news?.title || 'Noticias'}</span>
                  {isLoadingRss && <span className="text-xs font-medium text-secondary">Actualizando...</span>}
                </h2>
                <p className={`text-sm sm:text-base mt-1 ${mutedText}`}>
                  {config.content.news?.description}
                </p>
              </div>

              {allNews.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allNews.map((article) => (
                    <article
                      key={article.id}
                      onClick={() => {
                        if (article.isRss && article.url) {
                          window.open(article.url, '_blank', 'noopener,noreferrer');
                        } else {
                          setSelectedArticle(article);
                        }
                      }}
                      className={`rounded-2xl overflow-hidden cursor-pointer flex flex-col transition-all hover:-translate-y-0.5 ${cardSurface}`}
                    >
                      <div className="h-48 w-full bg-black/30 overflow-hidden">
                        <img
                          src={resolveDirectImageUrl(article.image)}
                          alt={article.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="p-5 flex-1 flex flex-col gap-2.5">
                        <div className={`text-xs font-medium tabular-nums ${mutedText}`}>
                          {[article.category, article.date, article.author].filter(Boolean).join(' · ')}
                        </div>
                        <h3 className="app-display font-bold text-lg leading-snug line-clamp-2">
                          {article.title}
                        </h3>
                        <p className={`text-sm leading-relaxed line-clamp-3 flex-1 ${mutedText}`}>
                          {article.summary}
                        </p>
                        <div className="pt-2 text-sm font-bold text-secondary inline-flex items-center gap-1.5">
                          <span>{article.isRss ? 'Abrir nota original' : 'Leer artículo'}</span>
                          <ExternalLink size={14} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={`p-12 rounded-2xl text-center ${cardSurface}`}>
                  <Newspaper size={36} className="mx-auto mb-3 opacity-40" />
                  <p className={mutedText}>Aún no hay noticias publicadas.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: COMMUNITY (INDEPENDENT LIVE CHAT SECTION) */}
          {activeTab === 'community' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="app-display font-extrabold text-2xl sm:text-3xl tracking-tight">
                  Comunidad & Chat en Vivo
                </h2>
                <p className={`text-sm sm:text-base mt-1 ${mutedText}`}>
                  Conecta y conversa en directo con los oyentes y locutores de {stationName}.
                </p>
              </div>

              <div className={`rounded-3xl p-4 sm:p-6 ${cardSurface}`}>
                <Chat config={config.content.chat} />
              </div>
            </div>
          )}

          {/* TAB 6: ALIADOS (INDEPENDENT VERTICAL MENU SECTION) */}
          {activeTab === 'clients' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="app-display font-extrabold text-2xl sm:text-3xl tracking-tight">
                  Nuestros Aliados
                </h2>
                <p className={`text-sm sm:text-base mt-1 ${mutedText}`}>
                  Conoce las empresas, comercios y marcas que impulsan nuestra programación.
                </p>
              </div>

              <div className={`rounded-3xl p-5 sm:p-7 ${cardSurface}`}>
                {config.content.clients && config.content.clients.length > 0 ? (
                  <ClientGallery
                    clients={config.content.clients}
                    primaryColor={config.appearance.primaryColor}
                    secondaryColor={config.appearance.secondaryColor}
                  />
                ) : (
                  <div className="text-center py-12 space-y-2">
                    <Users size={36} className="mx-auto opacity-40" />
                    <p className={mutedText}>Aún no hay comercios aliados registrados.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: GALERÍA (INDEPENDENT VERTICAL MENU SECTION) */}
          {activeTab === 'gallery' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="app-display font-extrabold text-2xl sm:text-3xl tracking-tight">
                  {config.content.gallery?.title || 'Galería'}
                </h2>
                <p className={`text-sm sm:text-base mt-1 ${mutedText}`}>
                  {config.content.gallery?.description || 'Momentos, eventos y contenido destacado de la emisora.'}
                </p>
              </div>

              <div className={`rounded-3xl p-5 sm:p-7 ${cardSurface}`}>
                {config.content.gallery?.mode === 'widget' && config.content.gallery.widgetCode ? (
                  <WidgetEmbed html={config.content.gallery.widgetCode} />
                ) : (
                  <SocialCarousel items={config.content.gallery?.images || []} />
                )}
              </div>
            </div>
          )}

          {/* TAB 8: CONTACTO (INDEPENDENT VERTICAL MENU SECTION AT THE END) */}
          {activeTab === 'contact' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="app-display font-extrabold text-2xl sm:text-3xl tracking-tight">
                  Contacto
                </h2>
                <p className={`text-sm sm:text-base mt-1 ${mutedText}`}>
                  Comunícate directamente con la estación, publicidad y cabina en vivo.
                </p>
              </div>

              <div className={`rounded-3xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 ${cardSurface}`}>
                <div className="space-y-4">
                  <h3 className="app-display font-bold text-2xl">{stationName}</h3>
                  <p className={`text-sm leading-relaxed ${mutedText}`}>{defaultSlogan}</p>
                  <div className="flex items-center gap-3 pt-2">
                    {config.social.instagram && (
                      <a
                        href={config.social.instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center hover:text-secondary transition-colors"
                        aria-label="Instagram"
                      >
                        <Instagram size={19} />
                      </a>
                    )}
                    {config.social.tiktok && (
                      <a
                        href={config.social.tiktok}
                        target="_blank"
                        rel="noreferrer"
                        className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center hover:text-secondary transition-colors"
                        aria-label="TikTok"
                      >
                        <TikTok className="w-4 h-4 fill-current" />
                      </a>
                    )}
                    {config.social.youtube && (
                      <a
                        href={config.social.youtube}
                        target="_blank"
                        rel="noreferrer"
                        className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center hover:text-secondary transition-colors"
                        aria-label="YouTube"
                      >
                        <Youtube size={19} />
                      </a>
                    )}
                    {config.social.whatsapp && (
                      <a
                        href={config.social.whatsapp}
                        target="_blank"
                        rel="noreferrer"
                        className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center hover:text-secondary transition-colors"
                        aria-label="WhatsApp"
                      >
                        <Phone size={19} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="app-display font-bold text-lg">Información de Contacto</h4>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-3">
                      <Phone size={17} className="text-secondary shrink-0" />
                      <span className="tabular-nums">{config.general.contactPhone}</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Mail size={17} className="text-secondary shrink-0" />
                      <span>{config.general.contactEmail}</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <MapPin size={17} className="text-secondary shrink-0" />
                      <span>
                        {config.general.city || 'Ciudad'}, {config.general.country || 'País'}
                      </span>
                      <button
                        type="button"
                        onClick={handleSecretAccess}
                        className="ml-1 inline-flex items-center"
                        title="Panel de Control"
                      >
                        <img
                          src="https://flagcdn.com/w40/ve.png"
                          alt="Venezuela"
                          className="h-4 w-auto rounded-sm"
                        />
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* PERSISTENT MINI-PLAYER BAR (Shown when user browses other tabs besides Home) */}
      {activeTab !== 'home' && (
        <div
          className={`fixed left-0 right-0 lg:left-64 bottom-16 lg:bottom-0 z-30 border-t backdrop-blur-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-2xl ${
            isDark
              ? 'bg-[#0b1120]/95 border-white/15 text-white'
              : 'bg-white/95 border-slate-200 text-slate-900'
          }`}
        >
          <button
            type="button"
            onClick={() => switchToTab('home')}
            className="flex items-center gap-3 min-w-0 flex-1 text-left"
          >
            <img
              src={finalCover}
              alt={displayTitle}
              onError={handleImageError}
              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-current/15"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 flex-1">
              <div className="app-display font-bold text-sm truncate">{displayTitle}</div>
              <div className="text-xs font-semibold text-secondary truncate">{displayArtist}</div>
            </div>
          </button>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden md:flex items-center gap-2 w-32">
              <button type="button" onClick={toggleMute} className={`${mutedText} hover:text-secondary p-1`}>
                {getVolumeIcon(16)}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                className="w-full h-1 bg-current/20 rounded-full accent-secondary cursor-pointer"
                aria-label="Volumen mini reproductor"
              />
            </div>

            {config.songRequest?.enabled !== false && (
              <button
                type="button"
                onClick={() => setShowSongModal(true)}
                className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all whitespace-nowrap shrink-0"
                title="Pedir Canción"
              >
                <MessageCircle size={15} />
                <span className="hidden sm:inline">Pedir Canción</span>
              </button>
            )}

            <button
              type="button"
              onClick={togglePlay}
              className="w-11 h-11 rounded-full bg-secondary text-primary flex items-center justify-center shadow-md active:scale-95 transition-transform shrink-0"
              title={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>
          </div>
        </div>
      )}

      {/* MOBILE VERTICAL MENU DRAWER (All 8 independent sections) */}
      {mobileDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in flex"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <aside
            className={`w-72 max-w-[82vw] h-full flex flex-col border-r shadow-2xl ${sidebarSurface}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex items-center justify-between border-b border-current/10">
              <div className="flex items-center gap-2.5 min-w-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={stationName}
                    className="w-9 h-9 rounded-xl object-contain bg-black/20 p-1 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0">
                    <Radio size={18} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="app-display font-extrabold text-sm tracking-tight truncate">
                    {stationName}
                  </div>
                  <div className={`text-[11px] truncate ${mutedText}`}>{defaultSlogan}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-current/10"
                aria-label="Cerrar menú"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchToTab(item.id)}
                    className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                      active
                        ? 'bg-secondary text-primary shadow-md'
                        : isDark
                        ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-current/10">
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  onDisableAppMode();
                }}
                className={`w-full min-h-[44px] flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${
                  isDark
                    ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Globe size={15} className="text-secondary shrink-0" />
                  <span>Versión Web</span>
                </span>
                <span className="inline-flex items-center w-9 h-5 rounded-full bg-emerald-500 p-0.5 justify-end">
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MOBILE BOTTOM APP TAB BAR (Thumb-Zone Ergonomics, 5 destinations, min 44px touch target) */}
      <nav
        className={`lg:hidden fixed bottom-0 inset-x-0 h-16 z-40 border-t backdrop-blur-xl grid grid-cols-5 items-center px-1 ${
          isDark
            ? 'bg-[#0b1120]/95 border-white/10 text-slate-300'
            : 'bg-white/95 border-slate-200 text-slate-600'
        }`}
      >
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchToTab(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-secondary font-bold' : 'opacity-80'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
              <span className="text-[11px] leading-none whitespace-nowrap">{item.shortLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeTab === 'community' || activeTab === 'clients' || activeTab === 'gallery' || activeTab === 'contact'
              ? 'text-secondary font-bold'
              : 'opacity-80'
          }`}
        >
          <Menu size={20} strokeWidth={2.1} />
          <span className="text-[11px] leading-none whitespace-nowrap">Menú</span>
        </button>
      </nav>

      {/* ARTICLE READER MODAL */}
      {selectedArticle && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className={`w-full max-w-3xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col relative ${cardSurface}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedArticle(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
            <div className="overflow-y-auto">
              {selectedArticle.image && (
                <img
                  src={resolveDirectImageUrl(selectedArticle.image)}
                  alt={selectedArticle.title}
                  className="w-full h-64 sm:h-80 object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="p-6 sm:p-8 space-y-4">
                <div className={`text-xs font-semibold tabular-nums ${mutedText}`}>
                  {[selectedArticle.category, selectedArticle.date, selectedArticle.author].filter(Boolean).join(' · ')}
                </div>
                <h2 className="app-display font-extrabold text-2xl sm:text-3xl leading-tight">
                  {selectedArticle.title}
                </h2>
                <p className={`text-base font-medium leading-relaxed ${mutedText}`}>
                  {selectedArticle.summary}
                </p>
                <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap pt-2 border-t border-current/10">
                  {selectedArticle.content}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIDEO MODAL */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setPlayingVideo(null)}
        >
          <div
            className="bg-[#0e1526] border border-white/15 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10 gap-3">
              <h3 className="app-display font-bold text-white text-base sm:text-lg truncate">
                {playingVideo.title}
              </h3>
              <button
                type="button"
                onClick={() => setPlayingVideo(null)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            <div className="w-full bg-black">
              <AppVideoPlayer url={playingVideo.url} title={playingVideo.title} />
            </div>
          </div>
        </div>
      )}

      {/* PROGRAM EPISODES MODAL */}
      {selectedProgram && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedProgram(null)}
        >
          <div
            className={`w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col ${cardSurface}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-current/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {selectedProgram.announcerImage ? (
                  <img
                    src={resolveDirectImageUrl(selectedProgram.announcerImage)}
                    alt={selectedProgram.title}
                    className="w-14 h-14 rounded-2xl object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                    <Mic2 size={24} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className={`text-xs font-semibold tabular-nums ${mutedText}`}>
                    {selectedProgram.schedule}
                    {selectedProgram.announcerName ? ` · ${selectedProgram.announcerName}` : ''}
                  </div>
                  <h3 className="app-display font-bold text-xl truncate">{selectedProgram.title}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProgram(null)}
                className="w-10 h-10 rounded-full bg-current/10 flex items-center justify-center shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <p className={`text-sm leading-relaxed ${mutedText}`}>{selectedProgram.description}</p>
              {selectedProgram.episodes && selectedProgram.episodes.length > 0 ? (
                <div className="space-y-3">
                  {selectedProgram.episodes.map((ep) => (
                    <div key={ep.id} className={`p-4 rounded-2xl space-y-2.5 ${subtleSurface}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-sm">{ep.title}</div>
                        <span className={`text-xs tabular-nums ${mutedText}`}>{ep.date}</span>
                      </div>
                      {ep.audioUrl && (
                        <audio controls controlsList="nodownload" className="w-full h-10" src={ep.audioUrl} />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-sm italic py-4 ${mutedText}`}>
                  No hay episodios grabados para este programa todavía.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SONG REQUEST MODAL */}
      {showSongModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={() => setShowSongModal(false)}
        >
          <div className="w-full max-w-lg relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowSongModal(false)}
              className="absolute -top-3 -right-3 z-20 w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center border border-white/20"
            >
              <X size={17} />
            </button>
            <SongRequestForm
              whatsappNumber={config.songRequest?.whatsappNumber || '0424 1555789'}
              songRequestConfig={config.songRequest}
              onSuccess={() => setTimeout(() => setShowSongModal(false), 2500)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
