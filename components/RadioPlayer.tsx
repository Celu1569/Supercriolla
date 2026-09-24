import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Volume1, Radio, X } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { motion, AnimatePresence } from 'motion/react';

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
  const [isVisible, setIsVisible] = useState(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('radio_player_visible') === 'true';
      }
      return true;
  });
  
  useEffect(() => {
      localStorage.setItem('radio_player_visible', isVisible.toString());
  }, [isVisible]);

  const [hasError, setHasError] = useState(false);
  const [metadata, setMetadata] = useState({ title: '', artist: '', cover: '' });

  // Fetch metadata periodically
  useEffect(() => {
    const showMetadata = config.appearance.radioPlayer?.showMetadata !== false;
    
    if (!isPlaying || !showMetadata) {
        if (!isPlaying) setMetadata({ title: '', artist: '', cover: '' });
        return;
    }

    const fetchMetadata = async () => {
      try {
        const streamUrl = config.general.streamUrl;
        if (!streamUrl) return;
        
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(streamUrl)}`);
        const data = await response.json();
        if (data && (data.title || data.artist)) {
          setMetadata(data);
        }
      } catch (err) {
        console.warn("Could not fetch metadata:", err);
      }
    };

    fetchMetadata();
    const interval = setInterval(fetchMetadata, 20000);
    return () => clearInterval(interval);
  }, [isPlaying, config.general.enableAutoMetadata, config.general.streamUrl]);

  // Fallback values from config
  const stationName = config.general.stationName || 'Radio en Vivo';
  const defaultSlogan = config.general.defaultSlogan || 'La Radio de la Buena Vibra';
  const displayTitle = metadata.title || stationName;
  const displayArtist = metadata.artist || (isPlaying ? 'Transmitiendo en Vivo' : defaultSlogan);
  const displayCover = metadata.cover || config.general.defaultCoverUrl || config.navigation.logoUrl;

  const videoUrl = config.appearance.radioPlayer?.videoUrl || '';
  const isVideoMode = config.appearance.radioPlayer?.videoMode && videoUrl;
  const videoLayout = config.appearance.radioPlayer?.videoLayout || 'compact';

  // Helper to extract YouTube ID
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };
  
  const youtubeId = videoUrl ? getYouTubeId(videoUrl) : null;
  const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1` : videoUrl;

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
                  analyzerRef.current.fftSize = 128;
                  try {
                      sourceRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
                      sourceRef.current.connect(analyzerRef.current);
                      analyzerRef.current.connect(audioCtxRef.current.destination);
                  } catch (e) {
                      console.error("Audio context error:", e);
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
          let finalUrl = config.general.streamUrl || '';
          
          if (!finalUrl) {
              setHasError(true);
              setIsPlaying(false);
              return;
          }

          // Anti-cache / shoutcast hacks
          if (/^https?:\/\/[^/]+\/?$/.test(finalUrl) && !finalUrl.includes('?')) {
              finalUrl = `${finalUrl}${finalUrl.endsWith('/') ? '' : '/'};`;
          }
          finalUrl += (finalUrl.includes('?') ? '&' : '?') + `cb=${Date.now()}`;

          audioRef.current.src = finalUrl;
          try {
              await audioRef.current.play();
          } catch (e: any) {
              if (e.name !== 'AbortError') {
                  setHasError(true);
                  setIsPlaying(false);
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

  return (
    <div className="w-full animate-fade-in shadow-2xl z-30 relative">
      <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: isVisible ? 1 : 0, height: isVisible ? 'auto' : 0 }}
          className="relative bg-[#060608] border-b border-white/10 transition-all duration-700 ease-out origin-top overflow-hidden"
          style={{ display: isVisible ? 'flex' : 'none' }}
      >
          <audio ref={audioRef} crossOrigin="anonymous" onEnded={() => setIsPlaying(false)} onError={() => { setHasError(true); setIsPlaying(false); }} preload="none" />

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

          {/* Player Inner Layout - Enhanced Version */}
          <div className={`relative z-20 flex flex-col ${videoLayout === 'full' ? 'lg:flex-row' : 'md:flex-row'} items-center justify-between gap-4 p-4 lg:px-8 w-full max-w-[1400px] mx-auto min-h-[100px]`}>
              
              {/* Cover & Station Info */}
              <div className="flex items-center gap-4 flex-1 min-w-0 w-full md:w-auto">
                  {config.appearance.radioPlayer?.showCover !== false && !isVideoMode && (
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 group">
                          <AnimatePresence mode="wait">
                              <motion.img 
                                  key={displayCover}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 1.1 }}
                                  src={displayCover} 
                                  alt={displayTitle}
                                  className="w-full h-full object-cover rounded-xl shadow-2xl border border-white/10"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                      (e.target as HTMLImageElement).src = config.navigation.logoUrl;
                                  }}
                              />
                          </AnimatePresence>
                          <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Radio className="text-secondary animate-pulse" size={24} />
                          </div>
                      </div>
                  )}

                  <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                          {isPlaying && (
                              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                          )}
                          <motion.p 
                            key={displayArtist}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-[10px] sm:text-xs font-black text-secondary uppercase tracking-[0.2em] truncate"
                          >
                              {hasError ? 'Error de Transmisión' : displayArtist}
                          </motion.p>
                      </div>
                      <motion.h2 
                        key={displayTitle}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xl sm:text-2xl lg:text-3xl font-black text-white truncate drop-shadow-lg leading-tight"
                      >
                          {displayTitle}
                      </motion.h2>
                  </div>
              </div>

              {/* Video Area (If Video Mode Active) */}
              {isVideoMode && (
                  <div 
                    className={`relative overflow-hidden rounded-2xl shadow-2xl border border-white/10 bg-black ${videoLayout === 'full' ? 'w-full lg:max-w-2xl' : 'w-full md:w-64'} aspect-video`}
                    style={videoLayout === 'compact' && config.appearance.radioPlayer?.videoWidth ? { width: `${config.appearance.radioPlayer.videoWidth}px` } : {}}
                  >
                      <iframe 
                        src={embedUrl}
                        className="w-full h-full"
                        style={config.appearance.radioPlayer?.videoHeight ? { height: `${config.appearance.radioPlayer.videoHeight}px` } : {}}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                  </div>
              )}

              {/* Controls */}
              <div className={`flex items-center gap-4 sm:gap-6 w-full ${videoLayout === 'full' ? 'lg:w-auto' : 'md:w-auto'} justify-center md:justify-end`}>
                  {/* Play Button */}
                  <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={togglePlay}
                      className="w-16 h-16 rounded-full bg-secondary text-primary flex items-center justify-center shadow-lg hover:shadow-secondary/20 transition-all flex-shrink-0 group"
                  >
                      {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                  </motion.button>

                  {/* Volume Slider */}
                  <div className="flex-1 md:w-48 lg:w-64 flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-5 py-3 backdrop-blur-xl">
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

                  {/* Close Button */}
                  <button 
                      onClick={() => setIsVisible(false)}
                      className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/10 hidden sm:flex"
                  >
                      <X size={20} strokeWidth={2.5} />
                  </button>
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
