import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Volume1, Radio, Disc, RefreshCw, Maximize2, Minimize2, Tv, Sparkles, Wifi } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { motion, AnimatePresence } from 'motion/react';
import { resolveDirectImageUrl } from '../utils/imageUrl';
import { io, Socket } from 'socket.io-client';

const DEFAULT_COVER = "/images/default-cover.svg";

export const RadioPlayer: React.FC = () => {
  const { config } = useConfig();
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number>();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.85);
  const [isVisible, setIsVisible] = useState(true);
  const [isStickyMinimized, setIsStickyMinimized] = useState(false);

  const [hasError, setHasError] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [metadata, setMetadata] = useState<{ title: string; artist: string; cover: string }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('last_radio_metadata');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.title || parsed.artist)) {
            return {
              title: parsed.title || '',
              artist: parsed.artist || '',
              cover: parsed.cover || ''
            };
          }
        }
      } catch (_) {}
    }
    return { title: '', artist: '', cover: '' };
  });
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  // Apply new metadata smoothly
  const applyMetadata = useCallback((data: { title?: string; artist?: string; cover?: string }) => {
    if (!data || (!data.title && !data.artist)) return;
    const sanitized = {
      title: data.title || '',
      artist: data.artist || '',
      cover: data.cover || ''
    };
    setMetadata(prev => {
      if (prev.title === sanitized.title && prev.artist === sanitized.artist && prev.cover === sanitized.cover) {
        return prev;
      }
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('last_radio_metadata', JSON.stringify(sanitized));
        }
      } catch (_) {}
      return sanitized;
    });
  }, []);

  // Fetch metadata via HTTP polling API
  const fetchMetadata = useCallback(async () => {
    setIsFetchingMetadata(true);
    try {
      const streamUrl = config.general.streamUrl || 'https://redradioypc.com:8010/live';
      const response = await fetch(`/api/metadata?url=${encodeURIComponent(streamUrl)}&_t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        applyMetadata(data);
      }
    } catch (err) {
      console.warn("Could not fetch metadata:", err);
    } finally {
      setIsFetchingMetadata(false);
    }
  }, [config.general.streamUrl, applyMetadata]);

  // 1. WebSocket Real-Time Connection via Socket.IO
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: Infinity
      });

      socket.on('connect', () => {
        setIsLiveConnected(true);
        socket?.emit('get-radio-metadata');
      });

      socket.on('disconnect', () => {
        setIsLiveConnected(false);
      });

      socket.on('radio-metadata', (data: any) => {
        setIsLiveConnected(true);
        applyMetadata(data);
      });
    } catch (err) {
      console.warn("WebSocket initialization warning:", err);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [applyMetadata]);

  // 2. Server-Sent Events (SSE) Real-Time stream fallback
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/metadata/stream');
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          applyMetadata(data);
          setIsLiveConnected(true);
        } catch (_) {}
      };
      es.onerror = () => {
        // SSE will attempt auto-reconnect
      };
    } catch (_) {}

    return () => {
      if (es) es.close();
    };
  }, [applyMetadata]);

  // 3. Regular Polling Interval (every 5 seconds) to guarantee no stagnation
  useEffect(() => {
    fetchMetadata();
    const interval = setInterval(fetchMetadata, 5000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchMetadata();
      }
    };

    const handleFocus = () => {
      fetchMetadata();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchMetadata]);

  // Fallback values from config
  const stationName = config.general.stationName || 'BUENÍSIMA 87.7 FM';
  const defaultSlogan = config.general.defaultSlogan || 'La Radio de la Buena Vibra';
  const displayTitle = metadata.title || stationName;
  const displayArtist = metadata.artist || defaultSlogan;

  // Selected player style and custom covers
  const playerStyle = config.appearance.radioPlayer?.playerStyle || 'modern';
  const customCover = resolveDirectImageUrl(config.appearance.radioPlayer?.customCoverUrl);
  const defaultStationCover = resolveDirectImageUrl(config.general.defaultCoverUrl);
  
  // Smart cover selection: live song artwork from Apple/iTunes first; if none, station logo; fallback SVG
  const isMusicCover = !!(metadata.cover && metadata.cover.startsWith('http') && !metadata.cover.includes('default-cover.svg'));
  const displayCover = isMusicCover 
    ? metadata.cover 
    : (customCover || defaultStationCover || metadata.cover || DEFAULT_COVER);

  const videoUrl = config.appearance.radioPlayer?.videoUrl || '';
  const isVideoMode = config.appearance.radioPlayer?.videoMode && videoUrl;
  const videoLayout = config.appearance.radioPlayer?.videoLayout || 'compact';

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };
  
  const youtubeId = videoUrl ? getYouTubeId(videoUrl) : null;
  const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1` : videoUrl;

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Audio Visualizer effect
  useEffect(() => {
      if (!audioRef.current || !canvasRef.current || config.appearance.radioPlayer?.showAnalyzer === false) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (isPlaying) {
          if (!audioCtxRef.current) {
              const Ctx = window.AudioContext || (window as any).webkitAudioContext;
              if (Ctx) {
                  audioCtxRef.current = new Ctx();
                  analyzerRef.current = audioCtxRef.current.createAnalyser();
                  analyzerRef.current.fftSize = 128;
                  try {
                      sourceRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
                      sourceRef.current.connect(analyzerRef.current);
                      analyzerRef.current.connect(audioCtxRef.current.destination);
                  } catch (e) {
                      // Audio context already initialized or cross-origin
                  }
              }
          }

          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
              audioCtxRef.current.resume();
          }

          const draw = () => {
              animationRef.current = requestAnimationFrame(draw);
              if (!analyzerRef.current) return;
              const bufferLength = analyzerRef.current.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);
              analyzerRef.current.getByteFrequencyData(dataArray);

              const width = canvas.width;
              const height = canvas.height;
              ctx.clearRect(0, 0, width, height);

              const activeBars = Math.floor(bufferLength * 0.75);
              const spacing = 4;
              const barWidth = Math.min((width - (activeBars * spacing)) / activeBars, 8);
              const totalWidth = activeBars * (barWidth + spacing) - spacing;
              let x = (width - totalWidth) / 2;

              for (let i = 0; i < activeBars; i++) {
                  const barHeightScale = dataArray[i] / 255;
                  const barHeight = Math.max(Math.pow(barHeightScale, 1.2) * height * 0.9, 3);
                  
                  ctx.fillStyle = config.appearance.secondaryColor || '#fbbf24';
                  ctx.beginPath();
                  const radius = barWidth / 2;
                  ctx.roundRect(x, height - barHeight, barWidth, barHeight, [radius, radius, 0, 0]);
                  ctx.fill();
                  x += barWidth + spacing;
              }
          };
          draw();
      } else {
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      return () => {
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
  }, [isPlaying, config.appearance.radioPlayer?.showAnalyzer, config.appearance.secondaryColor]);

  const togglePlay = async () => {
      if (!audioRef.current) return;
      
      if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
      } else {
          setHasError(false);
          setIsPlaying(true);
          let finalUrl = config.general.streamUrl || 'https://redradioypc.com:8010/live';
          
          if (/^https?:\/\/[^/]+\/?$/.test(finalUrl) && !finalUrl.includes('?')) {
              finalUrl = `${finalUrl}${finalUrl.endsWith('/') ? '' : '/'};`;
          }
          finalUrl += (finalUrl.includes('?') ? '&' : '?') + `cb=${Date.now()}`;

          audioRef.current.src = finalUrl;
          try {
              await audioRef.current.play();
              // Re-fetch metadata once playing starts
              fetchMetadata();
          } catch (e: any) {
              if (e.name !== 'AbortError') {
                  setHasError(true);
                  setIsPlaying(false);
              }
          }
      }
  };

  const getVolumeIcon = () => {
      if (isMuted || volume === 0) return <VolumeX size={18} />;
      if (volume < 0.4) return <Volume1 size={18} />;
      return <Volume2 size={18} />;
  };

  const toggleMute = () => {
      if (isMuted) {
          setIsMuted(false);
          setVolume(prevVolume > 0 ? prevVolume : 0.85);
      } else {
          setPrevVolume(volume);
          setIsMuted(true);
          setVolume(0);
      }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    const fallback = customCover || defaultStationCover || DEFAULT_COVER;
    if (target.src !== fallback && fallback) {
      target.src = fallback;
    } else if (target.src !== DEFAULT_COVER) {
      target.src = DEFAULT_COVER;
    }
  };

  // -------------------------------------------------------------
  // RENDER PLAYER BASED ON SELECTED STYLE
  // -------------------------------------------------------------

  // Hidden Audio Element (always active in background)
  const audioElement = (
    <audio 
      ref={audioRef} 
      crossOrigin="anonymous" 
      onEnded={() => setIsPlaying(false)} 
      onError={() => { setHasError(true); setIsPlaying(false); }} 
      preload="none" 
    />
  );

  // STYLE 1: RETRO VINYL / NEON
  if (playerStyle === 'retro') {
    return (
      <div className="w-full relative z-30 bg-[#08080d] border-b border-white/10 text-white overflow-hidden shadow-2xl">
        {audioElement}
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Vinyl Disc Animation */}
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0 group">
              <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-gray-900 via-gray-800 to-black p-1 shadow-2xl border border-yellow-500/30 flex items-center justify-center ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
                <div className="w-full h-full rounded-full border-4 border-dashed border-white/20 p-2 flex items-center justify-center">
                  <img 
                    src={displayCover} 
                    alt={displayTitle} 
                    onError={handleImageError}
                    className="w-14 h-14 rounded-full object-cover shadow-inner"
                  />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black p-1 rounded-full text-xs font-black shadow-lg">
                <Disc size={16} className={isPlaying ? 'animate-spin' : ''} />
              </div>
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${isPlaying ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-gray-400'}`}>
                  {isPlaying ? 'EN VIVO' : 'PAUSADO'}
                </span>
                <span className="text-[11px] font-bold text-yellow-400 tracking-widest uppercase">
                  {displayArtist}
                </span>
                <button onClick={fetchMetadata} title="Actualizar título" className="p-1 hover:text-yellow-400 text-gray-500 transition-colors">
                  <RefreshCw size={12} className={isFetchingMetadata ? 'animate-spin text-yellow-400' : ''} />
                </button>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate max-w-md" title={displayTitle}>
                {displayTitle}
              </h3>
              <p className="text-xs text-gray-400 font-mono">
                {stationName} • 87.7 FM
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black flex items-center justify-center shadow-lg shadow-yellow-500/20 transition-transform active:scale-95 flex-shrink-0"
              title={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
            </button>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-4 py-2 w-44">
              <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
                {getVolumeIcon()}
              </button>
              <input
                type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(val === 0);
                }}
                className="w-full h-1 bg-white/20 rounded-full accent-yellow-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STYLE 2: GLASSMORPHISM CARD
  if (playerStyle === 'card') {
    return (
      <div className="w-full py-6 px-4 relative z-30 flex justify-center">
        {audioElement}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl bg-black/60 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col md:flex-row items-center justify-between gap-6"
        >
          {/* Cover & Title */}
          <div className="flex items-center gap-5 flex-1 min-w-0 w-full md:w-auto">
            {config.appearance.radioPlayer?.showCover !== false && (
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-2xl border border-white/20 flex-shrink-0 group">
                <img 
                  src={displayCover} 
                  alt={displayTitle} 
                  onError={handleImageError}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-1 right-1 text-yellow-400">
                  <Radio size={14} className={isPlaying ? 'animate-pulse' : ''} />
                </div>
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isPlaying ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-gray-400'}`}>
                  {isPlaying ? '● Al Aire' : '○ Pausado'}
                </span>
                <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest truncate">{displayArtist}</p>
                <button onClick={fetchMetadata} title="Actualizar canción" className="text-gray-500 hover:text-white transition-colors">
                  <RefreshCw size={12} className={isFetchingMetadata ? 'animate-spin text-yellow-400' : ''} />
                </button>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white truncate drop-shadow-md" title={displayTitle}>
                {displayTitle}
              </h2>
              <p className="text-xs text-gray-400">{stationName}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <button
              onClick={togglePlay}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-300 hover:from-yellow-400 hover:to-amber-200 text-black flex items-center justify-center shadow-xl shadow-yellow-500/20 transition-transform active:scale-95 flex-shrink-0"
              title={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
            </button>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 w-40 sm:w-48">
              <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
                {getVolumeIcon()}
              </button>
              <input
                type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(val === 0);
                }}
                className="w-full h-1.5 bg-white/20 rounded-full accent-yellow-400 cursor-pointer"
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // STYLE 3: COMPACT MINIMALIST
  if (playerStyle === 'compact') {
    return (
      <div className="w-full bg-[#0a0a0f] border-b border-white/10 px-4 py-3 relative z-30 shadow-md">
        {audioElement}
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black flex items-center justify-center flex-shrink-0 shadow transition-transform active:scale-95"
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>

            {config.appearance.radioPlayer?.showCover !== false && (
              <img 
                src={displayCover} 
                alt={displayTitle} 
                onError={handleImageError}
                className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0"
              />
            )}

            <div className="min-w-0 truncate">
              <span className="text-xs font-black text-white truncate block">{displayTitle}</span>
              <span className="text-[10px] text-yellow-400 truncate block uppercase tracking-wider">{displayArtist}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={fetchMetadata} className="text-gray-500 hover:text-white p-1">
              <RefreshCw size={14} className={isFetchingMetadata ? 'animate-spin text-yellow-400' : ''} />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5 border border-white/10">
              <button onClick={toggleMute} className="text-gray-400 hover:text-white">
                {getVolumeIcon()}
              </button>
              <input
                type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(val === 0);
                }}
                className="w-24 h-1 bg-white/20 rounded-full accent-yellow-400"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STYLE 4: STICKY DOCK (Pinned to Bottom of viewport)
  if (playerStyle === 'sticky') {
    return (
      <>
        {audioElement}
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-[#06060a]/95 backdrop-blur-2xl border-t border-white/15 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]"
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {config.appearance.radioPlayer?.showCover !== false && (
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/20 flex-shrink-0">
                  <img 
                    src={displayCover} 
                    alt={displayTitle} 
                    onError={handleImageError}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-red-500 animate-ping' : 'bg-gray-500'}`}></span>
                  <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest truncate">{displayArtist}</span>
                </div>
                <h4 className="text-sm font-black text-white truncate max-w-sm sm:max-w-md">{displayTitle}</h4>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black flex items-center justify-center shadow-lg shadow-yellow-500/20 active:scale-95 flex-shrink-0"
              >
                {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
              </button>

              <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 w-36">
                <button onClick={toggleMute} className="text-gray-400 hover:text-white">
                  {getVolumeIcon()}
                </button>
                <input
                  type="range" min="0" max="1" step="0.01" value={volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    setIsMuted(val === 0);
                  }}
                  className="w-full h-1 bg-white/20 rounded-full accent-yellow-400"
                />
              </div>

              <button onClick={fetchMetadata} className="text-gray-400 hover:text-white p-2">
                <RefreshCw size={16} className={isFetchingMetadata ? 'animate-spin text-yellow-400' : ''} />
              </button>
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  // DEFAULT STYLE: MODERN STUDIO
  return (
    <div className="w-full animate-fade-in shadow-2xl z-30 relative">
      <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: isVisible ? 1 : 0, height: isVisible ? 'auto' : 0 }}
          className="relative bg-[#060608] border-b border-white/10 transition-all duration-700 ease-out origin-top overflow-hidden"
          style={{ display: isVisible ? 'flex' : 'none' }}
      >
          {audioElement}

          {/* Background Spectrum Analyzer */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-black/40">
              {config.appearance.radioPlayer?.showAnalyzer !== false && (
                  <canvas 
                      ref={canvasRef} 
                      width={1024} 
                      height={100} 
                      className={`absolute bottom-0 left-0 right-0 w-full h-full z-10 pointer-events-none opacity-20 transition-opacity duration-500 ${isPlaying ? 'opacity-20' : 'opacity-0'}`} 
                  />
              )}
          </div>

          {/* Player Inner Layout */}
          <div className={`relative z-20 flex flex-col ${videoLayout === 'full' ? 'lg:flex-row' : 'md:flex-row'} items-center justify-between gap-6 p-4 lg:px-8 w-full max-w-[1500px] mx-auto min-h-[110px]`}>
              
              {/* Cover & Station Info Area */}
              <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0 w-full md:w-auto">
                  {/* Integrated Video (Compact Mode) */}
                  {isVideoMode && videoLayout === 'compact' && (
                      <div 
                          className="relative overflow-hidden rounded-2xl shadow-2xl border border-white/20 bg-black aspect-video ring-2 ring-secondary/20 flex-shrink-0"
                          style={{ 
                              width: config.appearance.radioPlayer?.videoWidth ? `${config.appearance.radioPlayer.videoWidth}px` : '240px',
                              height: config.appearance.radioPlayer?.videoHeight ? `${config.appearance.radioPlayer.videoHeight}px` : '135px'
                          }}
                      >
                          <iframe 
                              src={embedUrl}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                          />
                      </div>
                  )}

                  {/* Album Cover Art */}
                  {config.appearance.radioPlayer?.showCover !== false && (
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 flex-shrink-0 group">
                          <AnimatePresence mode="wait">
                              <motion.img 
                                  key={displayCover}
                                  initial={{ opacity: 0, scale: 0.85 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 1.05 }}
                                  transition={{ duration: 0.3 }}
                                  src={displayCover} 
                                  alt={displayTitle}
                                  onError={handleImageError}
                                  className="w-full h-full object-cover rounded-2xl shadow-2xl border-2 border-white/10 group-hover:border-secondary/50 transition-colors bg-black/40"
                              />
                          </AnimatePresence>
                          <div className="absolute -bottom-1 -right-1 bg-secondary text-primary p-1.5 rounded-lg shadow-lg">
                              <Radio size={14} className={isPlaying ? 'animate-pulse' : ''} />
                          </div>
                      </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors ${isPlaying ? 'bg-red-600 text-white shadow-red-500/50' : 'bg-white/10 text-white/80'}`}>
                              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-white animate-ping' : 'bg-secondary'}`}></span>
                              {isPlaying ? 'Al Aire' : 'En Sintonía'}
                          </span>
                          {isLiveConnected && (
                            <span className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-400 font-mono tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <Wifi size={10} className="animate-pulse text-emerald-400" />
                              <span>EN VIVO</span>
                            </span>
                          )}
                          {(config.appearance.radioPlayer?.showMetadata !== false) && (
                              <motion.p 
                                key={displayArtist}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-xs sm:text-sm font-black text-secondary uppercase tracking-[0.2em] truncate drop-shadow-md flex items-center gap-1.5"
                              >
                                  <span>{hasError ? 'Error de Transmisión' : displayArtist}</span>
                                  <button onClick={fetchMetadata} title="Comprobar título en vivo" className="text-gray-400 hover:text-white transition-colors">
                                    <RefreshCw size={12} className={isFetchingMetadata ? 'animate-spin text-secondary' : ''} />
                                  </button>
                              </motion.p>
                          )}
                      </div>
                      <motion.h2 
                        key={displayTitle}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xl sm:text-2xl lg:text-3xl font-black text-white truncate drop-shadow-2xl leading-tight tracking-tight"
                        title={displayTitle}
                      >
                          {(config.appearance.radioPlayer?.showMetadata !== false) ? displayTitle : stationName}
                      </motion.h2>
                  </div>
              </div>

              {/* Expanded Video Area */}
              {isVideoMode && videoLayout === 'full' && (
                  <div className="relative w-full lg:max-w-2xl aspect-video overflow-hidden rounded-2xl shadow-2xl border border-white/10 bg-black my-2">
                      <iframe 
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                  </div>
              )}

              {/* Controls */}
              <div className={`flex items-center gap-4 sm:gap-6 w-full ${videoLayout === 'full' ? 'lg:w-auto' : 'md:w-auto'} justify-center md:justify-end flex-shrink-0`}>
                  <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={togglePlay}
                      className="w-16 h-16 rounded-full bg-secondary text-primary flex items-center justify-center shadow-lg hover:shadow-secondary/20 transition-all flex-shrink-0 group"
                      title={isPlaying ? "Pausar" : "Reproducir"}
                  >
                      {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                  </motion.button>

                  <div className="flex-1 md:w-44 lg:w-56 flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-5 py-3 backdrop-blur-xl">
                      <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors flex-shrink-0">
                          {getVolumeIcon()}
                      </button>
                      <input
                          type="range"
                          min="0" max="1" step="0.01"
                          value={volume}
                          onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setVolume(val);
                              if (val > 0) setIsMuted(false);
                              else setIsMuted(true);
                          }}
                          className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-secondary"
                      />
                  </div>
              </div>
          </div>
      </motion.div>

      {/* Button to open player when hidden */}
      {!isVisible && (
          <div className="py-6 flex justify-center w-full animate-fade-in">
              <motion.button 
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setIsVisible(true)}
                  className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-black rounded-full shadow-xl text-lg tracking-widest uppercase"
              >
                  <Radio className="animate-pulse" />
                  <span>Escuchar en Vivo</span>
              </motion.button>
          </div>
      )}
    </div>
  );
};
