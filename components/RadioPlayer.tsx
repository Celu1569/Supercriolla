import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, Volume1, Radio, X, Clock, Disc3, ListMusic, Maximize, Minimize2, Monitor } from 'lucide-react';
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

  // Restart audio if stream changes
  useEffect(() => {
     if (audioRef.current && isPlaying) {
         audioRef.current.pause();
         setIsPlaying(false);
         // slight delay then play again
         setTimeout(() => {
            togglePlay();
         }, 500);
     }
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

  const togglePlay = () => {
      if (!audioRef.current) return;
      
      if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          audioRef.current.removeAttribute('src'); // Stop buffering
      } else {
          setHasError(false);
          let rawUrl = config.general.streamUrl || '';
          
          if (!rawUrl) {
              setHasError(true);
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
          audioRef.current.load();
          
          const p = audioRef.current.play();
          if (p !== undefined) {
              p.then(() => setIsPlaying(true)).catch(e => {
                  console.error("Play error:", e);
                  setHasError(true);
                  setIsPlaying(false);
              });
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
      containerClasses = "h-auto rounded-[32px] lg:rounded-full overflow-hidden max-w-5xl mx-auto";
      innerClasses = "flex flex-col lg:flex-row items-center justify-center gap-6 p-6 pt-16 md:px-10 lg:py-4 lg:pl-6 lg:pr-[180px] w-full min-h-[140px]";
      coverClasses = "w-[120px] h-[120px] lg:w-[100px] lg:h-[100px] rounded-full shadow-lg";
      titleClasses = "text-2xl font-bold truncate";
      playBtnClasses = "w-14 h-14";
  } else {
      // Modern (default)
      containerClasses = "h-auto lg:h-[500px] xl:h-[600px] rounded-[32px] overflow-hidden";
      innerClasses = "flex flex-col lg:flex-row items-center gap-8 lg:gap-12 p-8 pt-20 lg:p-12 h-full w-full";
      coverClasses = "w-[240px] sm:w-[300px] lg:w-[380px] aspect-square rounded-[32px] lg:rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]";
      titleClasses = "text-3xl lg:text-5xl font-black";
      playBtnClasses = "w-16 h-16 sm:w-20 sm:h-20";
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto overflow-hidden animate-fade-in px-4 my-8">
      
      {/* Expanding Player */}
      <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: isVisible ? 1 : 0, height: isVisible ? 'auto' : 0 }}
          className={`relative bg-[#060608] border border-white/10 shadow-2xl transition-all duration-700 ease-out origin-bottom ${containerClasses}`}
          style={{ display: isVisible ? 'flex' : 'none' }}
      >
          {/* Audio Element Hidden */}
          <audio ref={audioRef} onEnded={() => setIsPlaying(false)} onError={() => { setHasError(true); setIsPlaying(false); }} preload="none" />

          {/* Deep Atmosphere Backgrounds */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-black">
              <AnimatePresence>
                  {metadata.cover && (
                      <motion.div 
                          key={metadata.cover}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 2 }}
                          className="absolute inset-0 z-0"
                      >
                          <img src={metadata.cover} alt="blur" className="w-full h-full object-cover blur-[60px] scale-[1.2] saturate-[1.5]" />
                      </motion.div>
                  )}
              </AnimatePresence>
              {/* Dim layer so text stays readable */}
              <div className="absolute inset-0 bg-black/40 z-10 transition-colors duration-1000"></div>
          </div>

          {/* Top Controls Area */}
          <div className={`absolute z-50 flex items-center gap-3 ${playerStyle === 'minimal' ? 'top-4 right-4 lg:top-1/2 lg:-translate-y-1/2 lg:right-6' : 'top-4 right-4 lg:top-6 lg:right-6'}`}>
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
                      <motion.div 
                          key={isPlaying ? 'playing' : 'paused'}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          className={`inline-flex items-center justify-center gap-2 px-3 py-1 lg:px-4 lg:py-1.5 rounded-full backdrop-blur-md shadow-lg border text-[10px] md:text-xs font-bold tracking-widest uppercase mb-4 lg:mb-6
                                      ${isPlaying ? 'bg-secondary/20 border-secondary/40 text-white' : 'bg-white/5 border-white/10 text-white/50'}
                                      ${playerStyle === 'minimal' ? 'lg:mb-2' : ''}`}
                      >
                          <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-secondary animate-pulse shadow-[0_0_10px_theme(colors.secondary)]' : 'bg-gray-500'}`}></span>
                          {hasError ? 'Error de Transmisión' : isPlaying ? 'Al Aire Ahora' : 'Radio en Pausa'}
                      </motion.div>
                      
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
                  <div className={`flex items-center gap-4 sm:gap-6 w-full ${playerStyle === 'minimal' ? 'flex-1 justify-center lg:justify-end max-w-sm ml-auto' : 'justify-center lg:justify-start'}`}>
                      
                      {/* Big Play Button */}
                      <motion.button
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={togglePlay}
                          className={`${playBtnClasses} rounded-full bg-secondary text-primary flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.2)] hover:shadow-[0_0_40px_rgba(251,191,36,0.5)] transition-all flex-shrink-0 z-10`}
                      >
                          {isPlaying ? <Pause size={playerStyle === 'minimal' ? 20 : 32} fill="currentColor" /> : <Play size={playerStyle === 'minimal' ? 20 : 32} fill="currentColor" className="ml-1 md:ml-2" />}
                      </motion.button>

                      {/* Volume Slider */}
                      <div className={`flex-1 flex flex-row items-center gap-3 bg-white/5 border border-white/10 rounded-full px-4 py-3 backdrop-blur-md ${playerStyle === 'minimal' ? 'max-w-[200px]' : 'max-w-[200px] lg:max-w-[280px] md:gap-4 md:px-5 md:py-4'}`}>
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
                  </div>
              </div>

              {/* History Side Panel */}
              {playerStyle !== 'minimal' && (
                  <div className={`hidden lg:flex flex-col bg-black/20 backdrop-blur-xl border border-white/10 rounded-[24px] p-6 flex-shrink-0 w-[320px] xl:w-[380px] h-full ml-auto`}>
                      <h4 className="text-white/50 text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <ListMusic size={14} /> Historial
                      </h4>
                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                          {history.length > 0 ? history.map((track, i) => (
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
