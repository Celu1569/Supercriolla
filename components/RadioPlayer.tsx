import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, Volume1, Radio, X, Clock, Disc3, ListMusic, Maximize, Minimize2, Monitor, Share2, Facebook, Twitter, Instagram, MessageCircle } from 'lucide-react';
import { TikTok } from './TikTokIcon';
import { useConfig } from '../context/ConfigContext';
import { motion, AnimatePresence } from 'motion/react';

interface TrackHistory {
  title: string;
  artist: string;
  cover: string;
  time: string;
}

// Cache to avoid hitting iTunes API repeatedly for the same song
const COVER_CACHE: Record<string, string> = {};

export const RadioPlayer: React.FC = () => {
  const { config } = useConfig();
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number>();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [metadata, setMetadata] = useState({
    title: 'Cargando transmisión...',
    artist: 'Conectando con el servidor',
    cover: ''
  });
  const [history, setHistory] = useState<TrackHistory[]>([]);

  const [playerStyle, setPlayerStyle] = useState<'minimal' | 'modern'>(() => {
      if (typeof window !== 'undefined') {
          return (localStorage.getItem('radio_player_style') as 'minimal' | 'modern') || 'modern';
      }
      return 'modern';
  });

  useEffect(() => {
      localStorage.setItem('radio_player_style', playerStyle);
  }, [playerStyle]);

  // Make sure we have a clear fallback for images
  const defaultCover = config.navigation.logoUrl || config.general.logoUrl || '';
  const stationName = config.general.stationName || 'Radio en Vivo';
  const defaultSlogan = 'Pasión por lo nuestro'; // Updated per user's manual change

  // Synchronize audio element with state changes
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
                  analyzerRef.current.fftSize = 128; // gives 64 frequency bins
                  try {
                      sourceRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
                      sourceRef.current.connect(analyzerRef.current);
                      analyzerRef.current.connect(audioCtxRef.current.destination);
                  } catch (e) {
                      console.error("Audio context error (CORS might block this):", e);
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

              // Responsive Canvas sizing
              const width = canvas.width;
              const height = canvas.height;
              ctx.clearRect(0, 0, width, height);

              // Usually the last 1/3 of the frequencies in a compressed radio stream have 0 energy.
              const activeBars = Math.floor(bufferLength * 0.75); // ~48 bars
              
              // Calculate width to center the visualizer
              const spacing = 4;
              const barWidth = Math.min((width - (activeBars * spacing)) / activeBars, 16);
              const totalWidth = activeBars * (barWidth + spacing) - spacing;
              let x = (width - totalWidth) / 2;

              for (let i = 0; i < activeBars; i++) {
                  const barHeightScale = dataArray[i] / 255;
                  const barHeight = Math.max(Math.pow(barHeightScale, 1.2) * height * 0.9, 3); // Make peaks slightly more dynamic

                  // Limit colors: Green (low), Yellow (mid), Red (peak)
                  const gradient = ctx.createLinearGradient(0, height, 0, 0);
                  gradient.addColorStop(0, '#22c55e'); // Green base
                  gradient.addColorStop(0.5, '#eab308'); // Yellow middle
                  gradient.addColorStop(0.9, '#ef4444'); // Red peak

                  ctx.fillStyle = gradient;
                  
                  // Fill bar with drop shadow
                  ctx.shadowBlur = 6;
                  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
                  
                  ctx.beginPath();
                  ctx.roundRect(x, height - barHeight, barWidth, barHeight, [barWidth/2, barWidth/2, 0, 0]);
                  ctx.fill();
                  
                  ctx.shadowBlur = 0;

                  x += barWidth + spacing;
              }
          };

          draw();
      } else {
          // Instead of immediate clear, maybe let it naturally decay or just stop drawing
          if (animationRef.current) {
              cancelAnimationFrame(animationRef.current);
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      return () => {
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
  }, [isPlaying, config.appearance.radioPlayer?.showAnalyzer]);

  // Restart audio if stream changes
  useEffect(() => {
     let timeout: NodeJS.Timeout;
     if (audioRef.current && isPlaying) {
         audioRef.current.pause();
         setIsPlaying(false);
         // slight delay then play again
         timeout = setTimeout(() => {
            togglePlay();
         }, 500);
     }
     return () => {
         if (timeout) clearTimeout(timeout);
     };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.general.streamUrl]);

  // Metadata Fetcher Effect
  useEffect(() => {
    let isActive = true;

    const fetchMetadata = async () => {
      try {
        const streamUrl = config.general.streamUrl || "";
        
        let finalTitle = defaultSlogan;
        let finalArtist = stationName;
        let finalCover = defaultCover;

        // Try getting artwork and metadata from our own proxy API to avoid CORS/SSL issues
        if (streamUrl) {
            try {
                const query = new URLSearchParams({
                    stream: streamUrl,
                    station: stationName,
                    logo: defaultCover
                });
                const res = await fetch(`/api/metadata?${query.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.title && data.title !== "") finalTitle = data.title;
                    if (data.artist && data.artist !== "") finalArtist = data.artist;
                    if (data.cover && data.cover !== "") finalCover = data.cover;
                }
            } catch (e) {
                console.warn("API proxy fetch error:", e);
            }
        }

        if (isActive) {
            setMetadata({
                title: finalTitle,
                artist: finalArtist,
                cover: finalCover
            });
            setHasError(false);
        }
      } catch (e) {
         console.warn("Metadata error", e);
         if (isActive && metadata.title === 'Cargando transmisión...') {
             setMetadata({ title: defaultSlogan, artist: stationName, cover: defaultCover });
         }
      }
    };

    fetchMetadata();
    const interval = setInterval(fetchMetadata, 15000);
    return () => {
        isActive = false;
        clearInterval(interval);
    };
  }, [config.general.streamUrl, config.general.stationName, defaultSlogan, defaultCover]);

  // History sync
  useEffect(() => {
      const trackId = `${metadata.title}-${metadata.artist}`;
      // Do not log fallbacks or generics
      if (metadata.title !== defaultSlogan && metadata.title !== 'Cargando transmisión...') {
          setHistory(prev => {
              if (prev[0]?.title === metadata.title) return prev;
              
              const newTrack = {
                  title: metadata.title,
                  artist: metadata.artist,
                  cover: metadata.cover || defaultCover,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              };
              return [newTrack, ...prev.filter(t => t.title !== metadata.title)].slice(0, 7);
          });
      }
  }, [metadata, defaultSlogan, defaultCover]);

  const handleShare = (network: string) => {
      const url = window.location.href;
      const text = `¡Escuchando ${metadata.title} en vivo!`;
      
      switch (network) {
          case 'facebook':
              window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
              break;
          case 'twitter':
              window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
              break;
          case 'whatsapp':
              window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + " " + url)}`, '_blank');
              break;
          case 'instagram':
          case 'tiktok':
              if (navigator.share) {
                  navigator.share({ title: 'Radio en vivo', text, url }).catch(console.error);
              } else {
                  navigator.clipboard.writeText(url);
                  alert("¡Enlace copiado al portapapeles! Listo para pegar en " + network);
              }
              break;
          case 'native':
              if (navigator.share) {
                  navigator.share({ title: 'Radio en vivo', text, url }).catch(console.error);
              } else {
                  navigator.clipboard.writeText(url);
                  alert("¡Enlace copiado al portapapeles!");
              }
              break;
      }
  };

  const togglePlay = async () => {
      if (!audioRef.current) return;
      
      if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          audioRef.current.removeAttribute('src');
          audioRef.current.load(); // Ensure buffering stops completely
      } else {
          setHasError(false);
          setIsPlaying(true); // Optimistic UI update
          let rawUrl = config.general.streamUrl || '';
          
          if (!rawUrl) {
              setHasError(true);
              setIsPlaying(false);
              return;
          }

          // Anti-cache / shoutcast hacks
          let finalUrl = rawUrl;
          if (/^https?:\/\/[^/]+\/?$/.test(rawUrl) && !rawUrl.includes('?')) {
              finalUrl = `${rawUrl}${rawUrl.endsWith('/') ? '' : '/'};`;
          } else if (rawUrl.includes('listen.php') && !rawUrl.includes('.mp3')) {
              finalUrl = `${rawUrl}&.mp3`;
          }

          // Add timestamp to bypass iOS/browser cache locks on live streams
          finalUrl += (finalUrl.includes('?') ? '&' : '?') + `cb=${Date.now()}`;

          audioRef.current.src = finalUrl;
          
          try {
              await audioRef.current.play();
          } catch (e: any) {
              if (e.name !== 'AbortError') {
                  console.error("Play error:", e);
                  setHasError(true);
                  setIsPlaying(false);
              } else {
                  console.log("Play interrupted (AbortError), ignoring.");
              }
          }
      }
  };

  const getVolumeIcon = () => {
      if (isMuted || volume === 0) return <VolumeX size={20} />;
      if (volume < 0.4) return <Volume1 size={20} />;
      return <Volume2 size={20} />;
  };

  const toggleMute = () => {
      if (isMuted) {
          setIsMuted(false);
          setVolume(prevVolume > 0 ? prevVolume : 0.8);
      } else {
          setPrevVolume(volume);
          setIsMuted(true);
          setVolume(0);
      }
  };

  // --- Dynamic Styles ---
  let containerClasses = "";
  let innerClasses = "";
  let coverClasses = "";
  let titleClasses = "";
  let playBtnClasses = "";

  if (playerStyle === 'minimal') {
      containerClasses = "h-auto w-full overflow-hidden";
      innerClasses = "flex flex-col lg:flex-row items-center justify-between gap-6 p-6 pt-16 lg:py-4 lg:pl-10 lg:pr-[240px] w-full max-w-[1920px] mx-auto min-h-[140px]";
      coverClasses = "w-[120px] h-[120px] lg:w-[100px] lg:h-[100px] rounded-[24px] shadow-lg";
      titleClasses = "text-2xl font-bold truncate";
      playBtnClasses = "w-14 h-14 lg:w-16 lg:h-16";
  } else {
      // Modern (default)
      containerClasses = "h-auto lg:h-[300px] w-full overflow-hidden";
      innerClasses = "flex flex-col lg:flex-row items-center gap-6 lg:gap-10 p-6 pt-16 lg:p-8 h-full w-full max-w-[1600px] mx-auto";
      coverClasses = "w-[200px] sm:w-[240px] lg:w-[220px] aspect-square rounded-[24px] lg:rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]";
      titleClasses = "text-2xl lg:text-4xl font-black";
      playBtnClasses = "w-14 h-14 sm:w-16 sm:h-16";
  }

  return (
    <div className="w-full animate-fade-in shadow-2xl z-30 relative">
      
      {/* Expanding Player */}
      <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: isVisible ? 1 : 0, height: isVisible ? 'auto' : 0 }}
          className={`relative bg-[#060608] border-b border-white/10 transition-all duration-700 ease-out origin-top ${containerClasses}`}
          style={{ display: isVisible ? 'flex' : 'none' }}
      >
          {/* Audio Element Hidden */}
          <audio ref={audioRef} crossOrigin="anonymous" onEnded={() => setIsPlaying(false)} onError={() => { setHasError(true); setIsPlaying(false); }} preload="none" />

          {/* Deep Atmosphere Backgrounds */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-black">
              {/* Dynamic Backgrounds */}
              {config.appearance.radioPlayer?.backgroundImages && config.appearance.radioPlayer.backgroundImages.map((img, idx) => (
                  <div 
                      key={idx}
                      className="absolute inset-0 z-0 transition-all duration-300 pointer-events-none"
                      style={{
                          backgroundImage: `url("${img}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          animation: `flagWind ${config.appearance.radioPlayer?.animationSpeed ?? 12}s ease-in-out infinite alternate`,
                          filter: `blur(${config.appearance.radioPlayer?.blurIntensity ?? 0}px) brightness(${config.appearance.radioPlayer?.brightness ?? 1})`,
                          mixBlendMode: (config.appearance.radioPlayer?.mixBlendMode && config.appearance.radioPlayer.mixBlendMode !== 'normal') ? config.appearance.radioPlayer.mixBlendMode as any : undefined,
                          opacity: config.appearance.radioPlayer?.opacity ?? 0.5
                      }}
                  />
              ))}

              <AnimatePresence>
                  {metadata.cover && (
                      <motion.div 
                          key={metadata.cover}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 2 }}
                          className="absolute inset-0 z-0 opacity-40"
                      >
                          <img src={metadata.cover} alt="blur" className="w-full h-full object-cover blur-[70px] scale-[1.3]" />
                      </motion.div>
                  )}
              </AnimatePresence>
              {/* Dim layer so text stays readable */}
              <div className="absolute inset-0 bg-black/60 z-10 transition-colors duration-1000"></div>

              {/* Real-time Web Audio API Spectrum Analyzer */}
              {config.appearance.radioPlayer?.showAnalyzer !== false && (
                  <canvas 
                      ref={canvasRef} 
                      width={1024} 
                      height={100} 
                      className={`absolute bottom-0 left-0 right-0 w-full h-20 z-20 pointer-events-none opacity-80 transition-opacity duration-500 ${isPlaying ? 'opacity-80' : 'opacity-0'}`} 
                  />
              )}

              <style>{`
                  @keyframes flagWind {
                      0% { transform: scale(1.1) rotate(-1deg) translateY(0%) translateX(-1%); }
                      50% { transform: scale(1.15) rotate(1deg) translateY(2%) translateX(1%); }
                      100% { transform: scale(1.1) rotate(0deg) translateY(-1%) translateX(2%); }
                  }
                  @keyframes analyzerBar {
                      0% { transform: scaleY(0.1); }
                      50% { transform: scaleY(1); }
                      100% { transform: scaleY(0.1); }
                  }
                  @keyframes analyzerBigBar {
                      0% { transform: scaleY(0.2); opacity: 0.5; }
                      50% { transform: scaleY(0.6); opacity: 0.8; }
                      100% { transform: scaleY(1); opacity: 1; }
                  }
              `}</style>
          </div>

          {/* Top Controls Area - Absolute ONLY for Modern */}
          <div className={`z-50 flex items-center gap-3 ${playerStyle === 'minimal' ? 'hidden' : 'absolute top-4 right-4 lg:top-6 lg:right-6'}`}>
              {/* Layout Toggles */}
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-1 opacity-90 hover:opacity-100 transition-opacity">
                  <button 
                      onClick={() => setPlayerStyle('minimal')} 
                      className={`p-2 rounded-full cursor-pointer transition-colors ${playerStyle === 'minimal' ? 'bg-secondary text-primary' : 'text-white/60 hover:text-white hover:bg-white/10'}`} 
                      title="Vista Mini"
                  >
                      <Minimize2 size={16} strokeWidth={2.5} />
                  </button>
                  <button 
                      onClick={() => setPlayerStyle('modern')} 
                      className={`p-2 rounded-full cursor-pointer transition-colors ${playerStyle === 'modern' ? 'bg-secondary text-primary' : 'text-white/60 hover:text-white hover:bg-white/10'}`} 
                      title="Vista Clásica"
                  >
                      <Monitor size={16} strokeWidth={2.5} />
                  </button>
              </div>

              {/* Close Button */}
              <button 
                  onClick={() => setIsVisible(false)}
                  className="p-3 rounded-full bg-black/40 hover:bg-black/80 text-white/70 hover:text-white backdrop-blur-md transition-all border border-white/10"
              >
                  <X size={20} strokeWidth={2.5} />
              </button>
          </div>

          {/* Player Inner Layout */}
          <div className={`relative z-20 ${innerClasses}`}>
              
              {/* Cover Art Area */}
              <div className="flex-shrink-0 flex items-center justify-center relative group">
                  <motion.div 
                      whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className={`relative z-10 bg-gray-900 border border-white/10 overflow-hidden flex items-center justify-center ${coverClasses}`}
                  >
                      {metadata.cover ? (
                          <img 
                              src={metadata.cover} 
                              alt="Cover Artwork" 
                              className={`w-full h-full object-cover `}
                              onError={(e) => { e.currentTarget.src = defaultCover; }}
                          />
                      ) : (
                          <Disc3 className="w-1/3 h-1/3 text-white/10 animate-pulse" />
                      )}
                      
                      {/* Playback Overlay Hint on Cover */}
                      <AnimatePresence>
                          {!isPlaying && (
                              <motion.div 
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                  className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center pointer-events-none"
                              >
                                  <div className={`rounded-full bg-secondary text-primary flex items-center justify-center mb-4 w-16 h-16`}>
                                      <Play size={28} fill="currentColor" className="ml-1 md:ml-2" />
                                  </div>
                              </motion.div>
                          )}
                      </AnimatePresence>
                  </motion.div>
              </div>

              {/* Info & Controls */}
              <div className={`flex flex-col min-w-0 z-20 w-full ${playerStyle === 'minimal' ? 'flex-1 lg:flex-row items-center lg:items-center text-center lg:text-left gap-6' : 'flex-1 lg:text-left text-center'}`}>
                  
                  {/* Info Column (Minimal: inline, Modern: stacked) */}
                  <div className={`flex flex-col ${playerStyle === 'minimal' ? 'flex-1 items-center lg:items-start space-y-1' : 'w-full'}`}>
                          {/* Status Badge */}
                          <div className={`flex flex-col items-center flex-wrap gap-4 ${playerStyle === 'minimal' ? 'lg:flex-row lg:items-center w-full mb-2' : 'w-full mb-6 lg:mb-8'}`}>
                              <motion.div 
                                  key={isPlaying ? 'playing' : 'paused'}
                                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                  className={`inline-flex items-center justify-center gap-2 px-3 py-1 lg:px-4 lg:py-1.5 rounded-full backdrop-blur-md shadow-lg border text-[10px] md:text-xs font-bold tracking-widest uppercase
                                              ${isPlaying ? 'bg-secondary/20 border-secondary/40 text-white' : 'bg-white/5 border-white/10 text-white/50'}`}
                              >
                                  <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-secondary animate-pulse shadow-[0_0_10px_theme(colors.secondary)]' : 'bg-gray-500'}`}></span>
                                  {hasError ? 'Error de Transmisión' : isPlaying ? 'Al Aire Ahora' : 'Radio en Pausa'}
                              </motion.div>
                          </div>
                      
                      {/* Title & Artist */}
                      <div className={`w-full px-2 lg:px-0 ${playerStyle === 'minimal' ? 'mb-2' : 'space-y-2 mb-6 lg:mb-10'}`}>
                          <h2 className={`${titleClasses} font-heading leading-tight text-white drop-shadow-2xl`}>
                              {metadata.title}
                          </h2>
                          <h3 className={`font-sans font-medium text-white/70 drop-shadow-md truncate w-full ${playerStyle === 'minimal' ? 'text-sm lg:text-base' : 'text-xl sm:text-2xl'}`}>
                              {metadata.artist}
                          </h3>
                      </div>
                  </div>

                  {/* Core Interactions */}
                  <div className={`flex items-center gap-4 sm:gap-6 w-full ${playerStyle === 'minimal' ? 'flex-1 justify-between sm:justify-end lg:max-w-[450px] ml-auto' : 'justify-center lg:justify-start'}`}>
                      
                      {/* Big Play Button */}
                      <motion.button
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={togglePlay}
                          className={`${playBtnClasses} rounded-full bg-secondary text-primary flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.2)] hover:shadow-[0_0_40px_rgba(251,191,36,0.5)] transition-all flex-shrink-0 z-10`}
                      >
                          {isPlaying ? <Pause size={playerStyle === 'minimal' ? 20 : 32} fill="currentColor" /> : <Play size={playerStyle === 'minimal' ? 20 : 32} fill="currentColor" className="ml-1 md:ml-2" />}
                      </motion.button>

                      {/* Volume Slider */}
                      <div className={`flex-1 flex flex-row items-center gap-3 bg-white/5 border border-white/10 rounded-full px-4 py-3 backdrop-blur-md ${playerStyle === 'minimal' ? 'max-w-full' : 'max-w-[200px] lg:max-w-[280px] md:gap-4 md:px-5 md:py-4'}`}>
                          <button onClick={toggleMute} className="text-white/50 hover:text-white transition-colors flex-shrink-0">
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

                      {/* Minimal Mode inline controls */}
                      {playerStyle === 'minimal' && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => handleShare('native')} className="p-2 rounded-full cursor-pointer transition-colors text-white/50 hover:text-white hover:bg-white/10" title="Compartir">
                                  <Share2 size={16} strokeWidth={2.5} />
                              </button>
                              <div className="flex items-center gap-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full p-1 opacity-90 transition-opacity">
                                  <button 
                                      onClick={() => setPlayerStyle('minimal')} 
                                      className="p-1.5 rounded-full cursor-pointer transition-colors bg-secondary text-primary" 
                                      title="Vista Mini"
                                  >
                                      <Minimize2 size={16} strokeWidth={2.5} />
                                  </button>
                                  <button 
                                      onClick={() => setPlayerStyle('modern')} 
                                      className="p-1.5 rounded-full cursor-pointer transition-colors text-white/60 hover:text-white hover:bg-white/10" 
                                      title="Vista Clásica"
                                  >
                                      <Monitor size={16} strokeWidth={2.5} />
                                  </button>
                              </div>
                              <button 
                                  onClick={() => setIsVisible(false)}
                                  className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white backdrop-blur-md transition-all border border-white/10"
                              >
                                  <X size={18} strokeWidth={2.5} />
                              </button>
                          </div>
                      )}
                  </div>

                  {/* Share Buttons */}
                  {playerStyle === 'modern' && (
                      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3 mt-6 lg:mt-8">
                          <button onClick={() => handleShare('facebook')} className="p-2.5 rounded-full bg-white/5 hover:bg-[#1877F2] hover:text-white text-white/60 transition-all" title="Compartir en Facebook">
                              <Facebook size={18} />
                          </button>
                          <button onClick={() => handleShare('twitter')} className="p-2.5 rounded-full bg-white/5 hover:bg-black hover:text-white text-white/60 transition-all border border-transparent hover:border-white/20" title="Compartir en X">
                             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
                          </button>
                          <button onClick={() => handleShare('whatsapp')} className="p-2.5 rounded-full bg-white/5 hover:bg-[#25D366] hover:text-white text-white/60 transition-all" title="Compartir en WhatsApp">
                              <MessageCircle size={18} />
                          </button>
                          <button onClick={() => handleShare('instagram')} className="p-2.5 rounded-full bg-white/5 hover:bg-gradient-to-tr hover:from-[#fdf497] hover:via-[#fd5949] hover:to-[#285AEB] hover:text-white text-white/60 transition-all" title="Compartir en Instagram">
                              <Instagram size={18} />
                          </button>
                          <button onClick={() => handleShare('tiktok')} className="p-2.5 rounded-full bg-white/5 hover:bg-black hover:text-white text-white/60 transition-all border border-transparent hover:border-white/20" title="Compartir en TikTok">
                              <TikTok size={18} />
                          </button>
                          <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                          <button onClick={() => handleShare('native')} className="p-2.5 rounded-full bg-white/5 hover:bg-white/20 text-white/60 hover:text-white transition-all flex items-center gap-2 text-xs font-semibold" title="Opciones de compartir">
                              <Share2 size={16} /> <span className="hidden sm:inline">Compartir</span>
                          </button>
                      </div>
                  )}

              </div>

              {/* History Side Panel */}
              {playerStyle !== 'minimal' && (
                  <div className={`hidden lg:flex flex-col bg-black/20 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 flex-shrink-0 w-[320px] xl:w-[380px] h-full ml-auto`}>
                      <h4 className="text-white/50 text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <ListMusic size={14} /> Historial
                      </h4>
                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                          {history.length > 0 ? history.slice(0, 4).map((track, i) => (
                              <motion.div 
                                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                  key={i + track.time} 
                                  className="flex items-center gap-4 group p-2.5 rounded-[16px] hover:bg-white/10 transition-colors"
                              >
                                  <img src={track.cover} alt="cover" className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-md flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                      <p className="text-sm font-bold text-white truncate group-hover:text-secondary transition-colors">{track.title}</p>
                                      <p className="text-xs text-white/50 truncate font-medium">{track.artist}</p>
                                  </div>
                                  <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-1 rounded-md flex items-center gap-1 flex-shrink-0">
                                      <Clock size={10} /> {track.time}
                                  </span>
                              </motion.div>
                          )) : (
                              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 text-white">
                                  <Disc3 size={32} className="mb-3 animate-[spin_5s_linear_infinite]" />
                                  <p className="text-sm font-medium">No hay canciones</p>
                              </div>
                          )}
                      </div>
                  </div>
              )}
          </div>
      </motion.div>

      {/* Button to open player when hidden */}
      {!isVisible && (
          <div className="py-6 flex justify-center w-full animate-fade-in">
              <motion.button 
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setIsVisible(true)}
                  className="flex items-center gap-3 px-8 lg:px-12 py-4 lg:py-5 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-black rounded-full shadow-[0_20px_40px_rgba(251,191,36,0.3)] text-lg lg:text-xl ring-4 ring-secondary/20 relative overflow-hidden group"
              >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  <Radio className="relative z-10 animate-pulse" />
                  <span className="relative z-10 tracking-widest uppercase">Escuchar en Vivo</span>
              </motion.button>
          </div>
      )}
    </div>
  );
};
