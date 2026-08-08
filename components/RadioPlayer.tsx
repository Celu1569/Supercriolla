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

  // Fallback values from config
  const stationName = config.general.stationName || 'Radio en Vivo';
  const defaultSlogan = config.general.defaultSlogan || 'La Radio de la Buena Vibra';

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

          {/* Player Inner Layout - Compact Mini Version */}
          <div className="relative z-20 flex flex-col md:flex-row items-center justify-between gap-4 p-4 lg:px-8 w-full max-w-[1400px] mx-auto min-h-[100px]">
              
              {/* Station Info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center text-primary flex-shrink-0 shadow-lg">
                      <Radio className={isPlaying ? 'animate-pulse' : ''} size={24} />
                  </div>
                  <div className="min-w-0">
                      <h2 className="text-xl font-black text-white truncate drop-shadow-md">
                          {stationName}
                      </h2>
                      <p className="text-sm font-medium text-white/50 truncate">
                          {hasError ? 'Error de Transmisión' : isPlaying ? 'Transmitiendo en Vivo' : defaultSlogan}
                      </p>
                  </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto">
                  {/* Play Button */}
                  <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={togglePlay}
                      className="w-14 h-14 rounded-full bg-secondary text-primary flex items-center justify-center shadow-lg hover:shadow-secondary/20 transition-all flex-shrink-0"
                  >
                      {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                  </motion.button>

                  {/* Volume Slider */}
                  <div className="flex-1 md:w-48 flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 backdrop-blur-md">
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
                          className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-secondary"
                      />
                  </div>

                  {/* Close Button */}
                  <button 
                      onClick={() => setIsVisible(false)}
                      className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/10 hidden sm:flex"
                  >
                      <X size={18} strokeWidth={2.5} />
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
