import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useConfig } from '../context/ConfigContext';
import { Radio, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Clock, Copy, Check, MessageCircle, ArrowLeft, Tv, RefreshCw, Sparkles } from 'lucide-react';
import { resolveDirectImageUrl } from '../utils/imageUrl';
import { io, Socket } from 'socket.io-client';
import { parseAndResolveStreamMetadata, isRealMusicCover, DEFAULT_RADIO_COVER } from '../utils/musicMetadata';

interface MetadataState {
  title: string;
  artist: string;
  cover: string;
}

const DEFAULT_COVER = DEFAULT_RADIO_COVER;

export const SmartDisplayView: React.FC = () => {
  const { config } = useConfig();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Display / Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Time state for ambient clock
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // Metadata state
  const stationName = config.general.stationName || "BUENÍSIMA 87.7 FM";
  const defaultSlogan = config.appearance.radioPlayer?.slogan || "La Radio de la Buena Vibra";
  const streamUrl = config.general.streamUrl || 'https://redradioypc.com:8010/live';

  const [metadata, setMetadata] = useState<MetadataState>(() => {
    try {
      const cached = localStorage.getItem('last_radio_metadata');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return {
      title: stationName,
      artist: defaultSlogan,
      cover: resolveDirectImageUrl(config.appearance.radioPlayer?.customCoverUrl) || DEFAULT_COVER
    };
  });

  // Digital Clock Timer
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setCurrentDate(now.toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Controls auto-hide after inactivity for ambient smart display view
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setControlsVisible(false);
      }
    }, 8000);
  }, [isPlaying]);

  useEffect(() => {
    const handleActivity = () => resetHideTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);
    resetHideTimer();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Smoothly apply metadata and resolve cover art if needed
  const applyMetadata = useCallback(async (data: { title?: string; artist?: string; cover?: string }) => {
    if (!data) return;
    const { title = '', artist = '', cover = DEFAULT_COVER } = data;

    if (cover && isRealMusicCover(cover)) {
      const sanitized = {
        title: title || stationName,
        artist: artist || defaultSlogan,
        cover: cover
      };
      setMetadata(sanitized);
      try {
        localStorage.setItem('last_radio_metadata', JSON.stringify(sanitized));
      } catch (_) {}
      return;
    }

    const rawToResolve = title || artist;
    if (rawToResolve) {
      const resolved = await parseAndResolveStreamMetadata(rawToResolve, stationName, defaultSlogan);
      setMetadata(resolved);
      try {
        localStorage.setItem('last_radio_metadata', JSON.stringify(resolved));
      } catch (_) {}
    }
  }, [stationName, defaultSlogan]);

  // Metadata fetcher with direct fallback for deployed/static environments
  const fetchMetadata = useCallback(async () => {
    // 1. Try internal API first
    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(streamUrl)}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.title || data.artist)) {
          await applyMetadata(data);
          return;
        }
      }
    } catch (_) {}

    // 2. Direct CORS Proxy Fallback
    try {
      const host = new URL(streamUrl).host;
      const statusUrl = `https://${host}/status-json.xsl`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(statusUrl)}`;
      
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const text = await response.text();
        const cleaned = text.trim()
          .replace(/,\s*\]\s*\}\s*\}\s*$/, ']}}')
          .replace(/,\s*\]/g, ']');

        let extractedTitle = "";
        try {
          const data = JSON.parse(cleaned);
          const source = data.icestats?.source;
          const srcArray = Array.isArray(source) ? source : [source];
          const bestSrc = srcArray.find((s: any) => s && s.title && s.title !== "-") || srcArray[0];
          if (bestSrc && (bestSrc.title || bestSrc.yp_currently_playing)) {
            extractedTitle = bestSrc.title || bestSrc.yp_currently_playing;
          }
        } catch (_) {
          const titleMatch = text.match(/"(?:title|yp_currently_playing|StreamTitle)"\s*:\s*"([^"]+)"/i);
          if (titleMatch && titleMatch[1]) {
            extractedTitle = titleMatch[1];
          }
        }

        if (extractedTitle) {
          await applyMetadata({ title: extractedTitle });
        }
      }
    } catch (_) {}
  }, [streamUrl, applyMetadata]);

  // Real-time Socket.IO listener
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true
      });
      socket.on('radio-metadata', (data: any) => {
        applyMetadata(data);
      });
      socket.emit('get-radio-metadata');
    } catch (_) {}

    return () => {
      if (socket) socket.disconnect();
    };
  }, [applyMetadata]);

  // Real-time SSE listener
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/metadata/stream');
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          applyMetadata(data);
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      if (es) es.close();
    };
  }, [applyMetadata]);

  // Polling fallback
  useEffect(() => {
    fetchMetadata();
    const interval = setInterval(fetchMetadata, 8000);
    return () => clearInterval(interval);
  }, [fetchMetadata]);

  // Audio Playback Handlers
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsBuffering(true);
      setHasError(false);
      // Append cache buster to stream URL
      audioRef.current.src = `${streamUrl}${streamUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      audioRef.current.load();
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch(err => {
          console.warn("[SmartDisplay] Play error:", err);
          setIsPlaying(false);
          setIsBuffering(false);
          setHasError(true);
        });
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  // Cover image fallback
  const displayCover = resolveDirectImageUrl(config.appearance.radioPlayer?.customCoverUrl) || DEFAULT_COVER;
  const isMusicCover = !!(metadata.cover && metadata.cover.startsWith('http') && 
                        !metadata.cover.includes('Logo-Buenisima-esfera') && 
                        !metadata.cover.includes('i.ibb.co'));
  const currentCover = isMusicCover ? metadata.cover : displayCover;

  // Direct Screen Link generator
  const getDisplayLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-kkn6qkgcsgj7v5xyziprtq-53201889037.us-west2.run.app';
    return `${origin}/#/pantalla`;
  };

  const copyDisplayLink = () => {
    const link = getDisplayLink();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      });
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#030712] text-white overflow-hidden flex flex-col justify-between select-none font-sans z-50">
      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef}
        preload="none"
        onPlay={() => { setIsPlaying(true); setIsBuffering(false); }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onError={() => { setHasError(true); setIsPlaying(false); setIsBuffering(false); }}
      />

      {/* Dynamic Ambient Background Blur */}
      <div 
        className="absolute inset-0 bg-cover bg-center -z-20 transition-all duration-1000 filter blur-3xl opacity-30 transform scale-110"
        style={{ backgroundImage: `url(${currentCover})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/80 to-[#030712]/60 -z-10" />

      {/* TOP HEADER: Station brand, Live Badge, and Digital Clock */}
      <header className={`p-4 sm:p-6 md:p-8 flex items-center justify-between transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}>
        <div className="flex items-center gap-3 sm:gap-4">
          <button 
            onClick={() => { window.location.hash = '#/'; }}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white backdrop-blur-md shadow-lg transition-transform active:scale-95"
            title="Volver a la Web Principal"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl overflow-hidden border-2 border-secondary shadow-lg flex-shrink-0 bg-black">
              <img src={DEFAULT_COVER} alt={stationName} className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">{stationName}</h1>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600/90 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  EN VIVO
                </span>
              </div>
              <p className="text-xs sm:text-sm text-secondary font-bold tracking-wide">{defaultSlogan}</p>
            </div>
          </div>
        </div>

        {/* Ambient Clock (Google Nest Hub / Smart Display style) */}
        <div className="text-right flex flex-col items-end">
          <div className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-white font-mono drop-shadow-md">
            {currentTime}
          </div>
          <div className="text-[11px] sm:text-xs md:text-sm text-gray-400 capitalize hidden sm:block">
            {currentDate}
          </div>
        </div>
      </header>

      {/* CENTER STAGE: Giant Vinyl Cover, Audio Spectrum Waves, and Real-Time Song Title */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-10 md:gap-16 px-6 sm:px-12 md:px-16 max-w-7xl mx-auto w-full my-auto">
        {/* Album Artwork Vinyl Section */}
        <div className="relative group cursor-pointer" onClick={togglePlay}>
          {/* Animated Glow Aura */}
          <div className={`absolute -inset-4 rounded-full bg-gradient-to-tr from-secondary/40 to-primary/40 blur-2xl opacity-75 transition-transform duration-1000 ${isPlaying ? 'scale-110 animate-pulse' : 'scale-90 opacity-20'}`} />

          {/* Vinyl Container */}
          <div className={`relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full p-2 bg-gradient-to-tr from-neutral-900 via-black to-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 flex items-center justify-center transition-transform ${isPlaying ? 'rotate-animation' : ''}`}>
            {/* Vinyl Grooves */}
            <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none" />
            <div className="absolute inset-8 rounded-full border border-white/5 pointer-events-none" />
            <div className="absolute inset-12 rounded-full border border-white/5 pointer-events-none" />

            {/* Inner Album Artwork */}
            <div className="w-32 h-32 sm:w-44 sm:h-44 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-full overflow-hidden border-4 border-black/80 shadow-inner relative">
              <img 
                src={currentCover} 
                alt={metadata.title} 
                className="w-full h-full object-cover"
              />
              {/* Spindle hole */}
              <div className="absolute inset-0 m-auto w-6 h-6 rounded-full bg-black border-2 border-white/40 shadow-inner" />
            </div>

            {/* Hover / Play Overlay */}
            <div className={`absolute inset-0 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary text-primary flex items-center justify-center shadow-2xl transform active:scale-90 transition-transform">
                {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-1" />}
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Song Information & Spectrum */}
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-2xl">
          {/* Live Wave Visualizer */}
          <div className="flex items-center gap-1.5 mb-3 sm:mb-4 h-8">
            {[40, 75, 55, 90, 60, 85, 45, 95, 70, 50, 80, 65, 90, 45, 85].map((height, i) => (
              <span 
                key={i}
                className={`w-1 sm:w-1.5 rounded-full bg-gradient-to-t from-secondary to-yellow-300 transition-all duration-300 ${isPlaying ? 'animate-pulse' : 'opacity-30'}`}
                style={{ 
                  height: isPlaying ? `${Math.max(12, height * (0.6 + ((i % 3) * 0.2)))}%` : '15%',
                  animationDelay: `${i * 90}ms`,
                  animationDuration: `${600 + (i % 4) * 150}ms`
                }}
              />
            ))}
            <span className="text-[10px] sm:text-xs font-black uppercase text-secondary tracking-widest ml-2 bg-secondary/10 px-2 py-0.5 rounded-full border border-secondary/20">
              {isPlaying ? 'Audio HD • 128 kbps' : 'Pausado'}
            </span>
          </div>

          {/* Song Title */}
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-2 drop-shadow-lg line-clamp-2">
            {metadata.title || stationName}
          </h2>

          {/* Artist / Slogan */}
          <p className="text-base sm:text-xl md:text-2xl font-bold text-gray-300 tracking-wide mb-6">
            {metadata.artist || defaultSlogan}
          </p>

          {/* WhatsApp Song Request Callout */}
          <a
            href="https://api.whatsapp.com/send?phone=584241555789&text=%C2%A1Hola%20BUEN%C3%8DSIMA%2087.7%20FM!%20Estoy%20escuchando%20en%20pantalla%20y%20quiero%20pedir%20una%20canci%C3%B3n"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-xl transition-all transform hover:scale-105 active:scale-95 border border-emerald-400/30 mb-2"
          >
            <MessageCircle size={18} className="fill-current text-white" />
            <span>Pedidos al WhatsApp: <strong>0424 1555789</strong></span>
          </a>
        </div>
      </main>

      {/* BOTTOM CONTROL BAR: Play/Pause, Volume, Fullscreen & Google Screen Share Modal */}
      <footer className={`p-4 sm:p-6 md:p-8 bg-black/60 backdrop-blur-xl border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none sm:opacity-20 hover:opacity-100 hover:pointer-events-auto'}`}>
        {/* Left: Share Link for Google Nest / TV */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowShareModal(true)}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs sm:text-sm font-bold text-white flex items-center gap-2 shadow-md transition-all active:scale-95"
            title="Ver enlace para Pantalla de Google"
          >
            <Tv size={16} className="text-secondary" />
            <span>Enlace Pantalla Google</span>
          </button>

          <button 
            onClick={copyDisplayLink}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-secondary/15 hover:bg-secondary/25 border border-secondary/30 text-xs sm:text-sm font-bold text-secondary flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            title="Copiar enlace de pantalla"
          >
            {copiedLink ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            <span className="hidden sm:inline">{copiedLink ? '¡Enlace Copiado!' : 'Copiar URL'}</span>
          </button>
        </div>

        {/* Center: Main Play / Pause Button with Buffering feedback */}
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            disabled={isBuffering}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-secondary hover:bg-yellow-400 text-primary flex items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.6)] transform hover:scale-105 active:scale-95 transition-all"
            title={isPlaying ? "Pausar" : "Reproducir"}
          >
            {isBuffering ? (
              <RefreshCw size={24} className="animate-spin text-primary" />
            ) : isPlaying ? (
              <Pause size={28} fill="currentColor" />
            ) : (
              <Play size={28} fill="currentColor" className="ml-1" />
            )}
          </button>

          {hasError && (
            <span className="text-xs text-red-400 font-bold bg-red-950/80 px-3 py-1 rounded-full border border-red-500/30">
              Error de conexión • Clic en Play
            </span>
          )}
        </div>

        {/* Right: Volume & Fullscreen Toggle */}
        <div className="flex items-center gap-4">
          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleMute}
              className="p-2 text-gray-300 hover:text-white transition-colors"
              title={isMuted ? "Activar sonido" : "Silenciar"}
            >
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-20 sm:w-28 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-secondary"
              title={`Volumen: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            />
          </div>

          {/* Fullscreen Button */}
          <button 
            onClick={toggleFullscreen}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center gap-1.5 text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
            title="Pantalla Completa"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            <span className="hidden md:inline">{isFullscreen ? 'Salir' : 'Pantalla Completa'}</span>
          </button>
        </div>
      </footer>

      {/* SHARE / GOOGLE DISPLAY MODAL */}
      {showShareModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={() => setShowShareModal(false)}
        >
          <div 
            className="bg-gray-900 border border-gray-700 p-6 sm:p-8 rounded-3xl max-w-lg w-full shadow-2xl text-left space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-secondary/20 text-secondary flex items-center justify-center">
                  <Tv size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Enlace para Pantalla de Google</h3>
                  <p className="text-xs text-gray-400">Google Nest Hub, Smart TV, Chromecast o Chrome</p>
                </div>
              </div>
              <button 
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Usa este enlace directo optimizado a pantalla completa con reloj digital, carátulas en tiempo real y transmisión continua sin barras pesadas de navegación:
            </p>

            {/* Link box with Copy Button */}
            <div className="bg-black/60 p-3 rounded-2xl border border-gray-700 flex items-center justify-between gap-3">
              <input 
                type="text" 
                readOnly 
                value={getDisplayLink()}
                className="bg-transparent text-secondary text-xs sm:text-sm font-mono flex-1 outline-none truncate"
              />
              <button
                onClick={copyDisplayLink}
                className="px-4 py-2 rounded-xl bg-secondary text-primary font-black text-xs hover:bg-yellow-400 flex items-center gap-1.5 shadow-lg active:scale-95 transition-all flex-shrink-0"
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedLink ? '¡Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            {/* Instructions list */}
            <div className="bg-gray-800/60 p-4 rounded-2xl border border-gray-700/60 space-y-2 text-xs text-gray-300">
              <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                <Sparkles size={14} className="text-secondary" />
                ¿Cómo abrirlo en tu pantalla?
              </div>
              <p>• <strong>Google Nest Hub:</strong> Di <em>"Ok Google, abre este enlace"</em> o envíalo desde la app Google Home / navegador.</p>
              <p>• <strong>Chromecast / Google TV:</strong> Abre el enlace en Google Chrome y selecciona <strong>"Transmitir pantalla / pestaña"</strong> (Cast).</p>
              <p>• <strong>Cualquier Smart TV o Navegador:</strong> Ingresa la dirección URL directamente en el navegador del televisor y presiona <em>Pantalla Completa</em>.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  copyDisplayLink();
                  setShowShareModal(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-secondary text-primary font-black text-xs hover:bg-yellow-400 shadow-lg"
              >
                Copiar y Usar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rotation animation styling */}
      <style>{`
        @keyframes vinylRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .rotate-animation {
          animation: vinylRotate 20s linear infinite;
        }
      `}</style>
    </div>
  );
};
