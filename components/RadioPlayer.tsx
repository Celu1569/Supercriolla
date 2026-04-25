import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, Radio, ListMusic, X, Clock } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { motion, AnimatePresence } from 'motion/react';

interface TrackHistory {
   title: string;
   artist: string;
   cover: string;
   time: string;
}

export const RadioPlayer: React.FC = () => {
  const { config } = useConfig();
  const audioRef = useRef<HTMLAudioElement>(null);
  const testAudioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState(false);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [autoDJIndex, setAutoDJIndex] = useState(0);
  
  const fallbackList = useMemo(() => {
     let list = config.general.autoDJTracks || [];
     if (!list || list.length === 0) {
         if (config.general.fallbackStreamUrl) {
              return [{ url: config.general.fallbackStreamUrl, title: 'Respaldo', id: 'legacy' }];
         }
         return [];
     }
     
     const cloned = [...list];
     if (config.general.autoDJMode === 'random') {
          // Fisher-Yates shuffle
          for (let i = cloned.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
          }
     }
     return cloned;
  }, [config.general.autoDJTracks, config.general.autoDJMode, config.general.fallbackStreamUrl]);

  const [metadata, setMetadata] = useState({
    title: 'Cargando...',
    artist: 'Radio en Vivo',
    cover: ''
  });
  const [history, setHistory] = useState<TrackHistory[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const historyRef = useRef<HTMLDivElement>(null);

  // Keep track of config updates to initialize default cover if needed
  useEffect(() => {
    if (metadata.cover === '' && config.navigation.logoUrl) {
      setMetadata(prev => ({
        ...prev,
        artist: prev.artist === 'Radio en Vivo' ? (config.general.stationName || 'En Línea') : prev.artist,
        cover: config.navigation.logoUrl
      }));
    }
  }, [config.navigation.logoUrl, config.general.stationName, metadata.cover]);

  // Real metadata fetcher
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const streamUrl = encodeURIComponent(config.general.streamUrl || "");
        const logoUrl = encodeURIComponent(config.navigation.logoUrl || "");
        const stationName = encodeURIComponent(config.general.stationName || "");
        const response = await fetch(`/api/metadata?stream=${streamUrl}&logo=${logoUrl}&station=${stationName}`);
        if (response.ok) {
          const data = await response.json();
          
          // Filter generic strings
          const isGenericString = (s: string) => {
            if (!s) return true;
            const lower = s.toLowerCase();
            return lower.includes("transmision") || 
                   lower.includes("en vivo") || 
                   lower.includes("recuperando señal") ||
                   lower.includes("conectando") ||
                   lower === "unknown" ||
                   lower === "stream";
          };

          // Use provided logo as the ultimate fallback for cover
          const finalCover = data.cover || config.navigation.logoUrl || config.general.logoUrl;
          
          const finalArtist = (!data.artist || isGenericString(data.artist)) 
            ? (config.general.stationName || "Radio en Vivo")
            : data.artist;
            
          const finalTitle = (!data.title || isGenericString(data.title))
            ? "Música que te mueve"
            : data.title;
          
          setMetadata({
            title: finalTitle,
            artist: finalArtist,
            cover: finalCover
          });
        }
      } catch (e) {
        console.error("Metadata fetch error:", e);
      }
    };

    const interval = setInterval(fetchMetadata, 15000); // 15s
    fetchMetadata();
    
    return () => clearInterval(interval);
  }, [config.general.streamUrl, config.navigation.logoUrl, config.general.stationName]);

  // Track History updates
  const lastTrackRef = useRef<string>('');
  useEffect(() => {
     if (metadata.title && metadata.title !== "Señal en directo" && metadata.title !== "Recuperando señal...") {
         const trackId = `${metadata.title}-${metadata.artist}`;
         if (lastTrackRef.current !== trackId) {
             lastTrackRef.current = trackId;
             setHistory(prev => {
                 // Prevent duplicates
                 if (prev[0]?.title === metadata.title) return prev;
                 
                 const newTrack = {
                     title: metadata.title,
                     artist: metadata.artist,
                     cover: metadata.cover || config.navigation.logoUrl || '',
                     time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                 };
                 // Filter out the same title if it was playing previously so we don't spam the list, taking the newest time
                 return [newTrack, ...prev.filter(t => t.title !== metadata.title)].slice(0, 5);
             });
         }
     }
  }, [metadata, config.navigation.logoUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      // Clear src to stop downloading data in background, but safely
      audioRef.current.removeAttribute("src");
      setIsPlaying(false);
      setIsFallbackMode(false);
      if (testAudioRef.current) {
          testAudioRef.current.removeAttribute("src");
      }
    } else {
      if (!config.general.streamUrl) {
          setError(true);
          console.error("No stream URL missing");
          return;
      }
      setError(false);
      // Re-load stream to ensure it's fresh and not stuck in a buffer
      const streamUrl = config.general.streamUrl;
      let finalUrl = streamUrl;
      
      // Handle different stream formats and common radio platform hacks
      if (streamUrl) {
          // Shoutcast direct IP:PORT hack (only if it's just domain:port or IP:port)
          const isSimpleUrl = /^https?:\/\/[^/]+\/?$/.test(streamUrl);
          
          if (isSimpleUrl && !streamUrl.includes('?') && !streamUrl.includes(';') && !streamUrl.includes('.mp3') && !streamUrl.includes('.aac')) {
              finalUrl = `${streamUrl}${streamUrl.endsWith('/') ? '' : '/'};`;
          }
          // Listen2MyRadio listen.php hack
          else if (streamUrl.includes('listen.php') && !streamUrl.includes('.mp3')) {
              finalUrl = `${streamUrl}&.mp3`;
          }
      }

      audioRef.current.src = finalUrl;
      audioRef.current.load();
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setError(false);
          })
          .catch((err) => {
            console.error("Playback error:", err.message);
            setError(true);
            setIsPlaying(false);
          });
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
    
    if (newVol === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        const volToRestore = prevVolume > 0 ? prevVolume : 0.5;
        audioRef.current.volume = volToRestore;
        setVolume(volToRestore);
        setIsMuted(false);
      } else {
        setPrevVolume(volume);
        audioRef.current.volume = 0;
        setVolume(0);
        setIsMuted(true);
      }
    }
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX size={20} />;
    if (volume < 0.5) return <Volume1 size={20} />;
    return <Volume2 size={20} />;
  };

  const handleAudioError = (e: any) => {
    // If we deliberately cleared the source to pause a stream, ignore the error
    if (!audioRef.current?.getAttribute("src") && !audioRef.current?.src) {
        return;
    }
    const error = e.target.error;
    let message = "Error desconocido";
    
    if (error) {
        switch (error.code) {
            case 1: message = "Abortado por el usuario"; break;
            case 2: message = "Error de red"; break;
            case 3: message = "Error de decodificación"; break;
            case 4: message = "Fuente no compatible o no encontrada"; break;
        }
    }
    
    console.error("Audio element error:", message, error);

    // Enter fallback mode if main stream fails and fallback is available
    if (fallbackList.length > 0 && !isFallbackMode) {
         console.log("Señal caída. Activando Auto DJ de respaldo...");
         setIsFallbackMode(true);
         setError(false);
         if (audioRef.current) {
              setAutoDJIndex(0);
              const track = fallbackList[0];
              audioRef.current.src = track.url;
              audioRef.current.loop = false;
              audioRef.current.load();
              audioRef.current.play().catch(e => console.error("AutoDJ play error:", e));
              setIsPlaying(true);
              setMetadata(prev => ({ ...prev, title: track.title, artist: 'Auto DJ' }));
         }
         return;
    }

    // Determine if it was an error while trying to play AutoDJ track itself
    if (isFallbackMode) {
        // Skip failed track and go to next
        handleTrackEnded();
        return;
    }

    setError(true);
    setIsPlaying(false);
  };

  const handleTrackEnded = () => {
      if (isFallbackMode && fallbackList.length > 0) {
          const nextIndex = (autoDJIndex + 1) % fallbackList.length;
          setAutoDJIndex(nextIndex);
          const nextTrack = fallbackList[nextIndex];
          if (audioRef.current) {
              audioRef.current.src = nextTrack.url;
              audioRef.current.load();
              audioRef.current.play().catch(e => console.error("AutoDJ play error:", e));
              setMetadata(prev => ({ ...prev, title: nextTrack.title, artist: 'Auto DJ' }));
          }
      }
  };

  // Background checker for live stream recovery
  useEffect(() => {
     let checkInterval: any;
     if (isFallbackMode && config.general.streamUrl) {
         checkInterval = setInterval(() => {
             if (testAudioRef.current) {
                 const streamUrl = config.general.streamUrl;
                 let testUrl = streamUrl;
                 const isSimpleUrl = /^https?:\/\/[^/]+\/?$/.test(streamUrl);
                 if (isSimpleUrl && !streamUrl.includes('?') && !streamUrl.includes(';') && !streamUrl.includes('.mp3') && !streamUrl.includes('.aac')) {
                     testUrl = `${streamUrl}${streamUrl.endsWith('/') ? '' : '/'};`;
                 } else if (streamUrl.includes('listen.php') && !streamUrl.includes('.mp3')) {
                     testUrl = `${streamUrl}&.mp3`;
                 }
                 testUrl = testUrl + (testUrl.includes('?') ? '&' : '?') + `test=${Date.now()}`;
                 
                 testAudioRef.current.src = testUrl;
                 testAudioRef.current.load(); 
             }
         }, 30000); // Check every 30s
     }
     return () => clearInterval(checkInterval);
  }, [isFallbackMode, config.general.streamUrl]);

  const handleTestAudioCanPlay = () => {
      // The main stream is back online!
      if (isFallbackMode) {
          console.log("¡La señal en vivo regresó!");
          setIsFallbackMode(false);
          if (testAudioRef.current) {
              testAudioRef.current.removeAttribute("src"); // Stop test
          }
          if (audioRef.current && isPlaying) {
              const streamUrl = config.general.streamUrl;
              let finalUrl = streamUrl;
              if (streamUrl) {
                  const isSimpleUrl = /^https?:\/\/[^/]+\/?$/.test(streamUrl);
                  if (isSimpleUrl && !streamUrl.includes('?') && !streamUrl.includes(';') && !streamUrl.includes('.mp3') && !streamUrl.includes('.aac')) {
                      finalUrl = `${streamUrl}${streamUrl.endsWith('/') ? '' : '/'};`;
                  } else if (streamUrl.includes('listen.php') && !streamUrl.includes('.mp3')) {
                      finalUrl = `${streamUrl}&.mp3`;
                  }
              }
              audioRef.current.src = finalUrl;
              audioRef.current.loop = false;
              audioRef.current.load();
              audioRef.current.play().catch(e => console.error("Stream resume play error:", e));
          }
      }
  };

  // Sync stream URL updates
  useEffect(() => {
    if(audioRef.current) {
        setError(false);
        if(isPlaying) {
            const streamUrl = config.general.streamUrl;
            let finalUrl = streamUrl;
            if (streamUrl) {
                const isSimpleUrl = /^https?:\/\/[^/]+\/?$/.test(streamUrl);
                if (isSimpleUrl && !streamUrl.includes('?') && !streamUrl.includes(';') && !streamUrl.includes('.mp3') && !streamUrl.includes('.aac')) {
                    finalUrl = `${streamUrl}${streamUrl.endsWith('/') ? '' : '/'};`;
                } else if (streamUrl.includes('listen.php') && !streamUrl.includes('.mp3')) {
                    finalUrl = `${streamUrl}&.mp3`;
                }
            }
            audioRef.current.src = finalUrl;
            audioRef.current.load();
            audioRef.current.play().catch(e => console.error("Auto-play error:", e));
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.general.streamUrl]);

  // Atmospheric Design for the Main Player with Continuous History
  return (
    <div className="w-full max-w-[1600px] mx-auto overflow-hidden animate-fade-in px-4 my-8">
      <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
          className={`relative bg-[#0a0502] rounded-[32px] overflow-hidden border border-white/10 shadow-2xl transition-all duration-500 ${isVisible ? 'h-[600px]' : 'h-0 pointer-events-none mb-0'}`}
          style={{ 
              display: isVisible ? 'block' : 'none'
          }}
      >
          {/* Background Atmosphere */}
          <div className="absolute inset-0 z-0 overflow-hidden bg-[#0a0502]">
              <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-primary/40 to-black/80 z-10"></div>
              <AnimatePresence mode="wait">
                  {metadata.cover && (
                      <motion.div 
                          key={`main-bg-${metadata.cover}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.35 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 1.5 }}
                          className="absolute inset-0 z-0 pointer-events-none"
                      >
                          <img 
                              src={metadata.cover} 
                              alt="" 
                              className="w-full h-full object-cover blur-[80px] scale-110"
                              referrerPolicy="no-referrer"
                          />
                      </motion.div>
                  )}
              </AnimatePresence>
          </div>

          {/* Close Button */}
          <button 
              onClick={() => setIsVisible(false)}
              className="absolute top-8 right-8 z-30 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/10"
              title="Cerrar reproductor"
          >
              <X size={24} />
          </button>

          {/* Main Content Grid - Now 3 Columns for History Side Panel */}
          <div className="relative z-10 h-full flex flex-col lg:flex-row items-center gap-8 lg:gap-12 px-8 lg:px-12 py-12">
              <audio ref={audioRef} onError={handleAudioError} onEnded={handleTrackEnded} preload="none" />
              <audio ref={testAudioRef} onCanPlay={handleTestAudioCanPlay} preload="none" className="hidden pointer-events-none" muted />
              
              {/* Visualizer/Cover Area */}
              <div className="relative group w-full lg:w-[380px] flex-shrink-0 flex items-center justify-center">
                  
                  <motion.div 
                      whileHover={{ scale: 1.02 }}
                      className="relative z-10 aspect-square w-full rounded-[40px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] border-2 border-white/10 bg-gray-900 group"
                  >
                      {metadata.cover ? (
                          <img 
                              src={metadata.cover} 
                              alt="Cover" 
                              className={`w-full h-full object-cover transition-transform duration-[10000ms] ${isPlaying ? 'scale-125' : 'scale-100'}`}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                  if (e.currentTarget.src !== config.navigation.logoUrl) {
                                      e.currentTarget.src = config.navigation.logoUrl || '';
                                  }
                              }}
                          />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-gray-900">
                              <Radio className="text-secondary/20 w-32 h-32" />
                          </div>
                      )}
                      
                      <AnimatePresence>
                          {!isPlaying && (
                              <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="absolute inset-0 bg-black/40 flex items-center justify-center"
                              >
                                  <div className="w-24 h-24 rounded-full bg-secondary/20 backdrop-blur-sm border border-secondary/30 flex items-center justify-center">
                                      <Play size={40} className="text-secondary ml-2 fill-current" />
                                  </div>
                              </motion.div>
                          )}
                      </AnimatePresence>
                  </motion.div>
              </div>

              {/* Info & Core Controls (Center) */}
              <div className="flex-1 w-full text-center lg:text-left flex flex-col items-center lg:items-start min-w-0">
                  <div className="mb-8 space-y-4 w-full">
                      <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-xs font-bold tracking-widest uppercase"
                      >
                          <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-secondary animate-pulse' : 'bg-gray-500'}`}></span>
                          {isPlaying ? 'Al Aire Ahora' : 'Radio en Pausa'}
                      </motion.div>
                      
                      <div className="space-y-3">
                         <h2 className="text-3xl lg:text-4xl font-heading font-black text-white leading-tight break-words line-clamp-2 drop-shadow-lg" title={metadata.title}>
                             {metadata.title}
                         </h2>
                         <h3 className="text-lg lg:text-xl font-sans font-medium text-secondary/80 truncate w-full" title={metadata.artist}>
                             {metadata.artist}
                         </h3>
                      </div>
                  </div>

                  <div className="flex items-center gap-8 mb-10">
                      <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={togglePlay}
                          className="w-16 h-16 rounded-full bg-secondary text-primary flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] transition-all"
                      >
                          {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                      </motion.button>

                      <div className="w-[200px] lg:w-[260px] flex items-center gap-4 group">
                          <button onClick={toggleMute} className="text-white/40 hover:text-white transition-colors">
                              {getVolumeIcon()}
                          </button>
                          <div className="flex-1 relative flex items-center h-10">
                              <input
                                  type="range"
                                  min="0" max="1" step="0.01"
                                  value={volume}
                                  onChange={handleVolumeChange}
                                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-secondary"
                              />
                          </div>
                      </div>
                  </div>
              </div>

              {/* Permanent History Side Panel (Right) */}
              <div className="hidden lg:flex w-[320px] h-full flex-col bg-white/5 border-l border-white/10 p-6 flex-shrink-0 animate-fade-in-right">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 rounded-lg bg-secondary/10">
                          <ListMusic size={20} className="text-secondary" />
                      </div>
                      <h4 className="text-sm font-black text-white uppercase tracking-widest">Lo Último</h4>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                      {history.length > 0 ? history.map((track, i) => (
                          <motion.div 
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              key={i} 
                              className="flex items-center gap-4 group p-2 rounded-xl hover:bg-white/5 transition-colors"
                          >
                              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 shadow-lg group-hover:border-secondary/30 transition-colors">
                                  <img 
                                      src={track.cover || config.navigation.logoUrl} 
                                      alt="" 
                                      className="w-full h-full object-cover" 
                                      onError={(e) => { e.currentTarget.src = config.navigation.logoUrl || '' }}
                                  />
                              </div>
                              <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-white truncate group-hover:text-secondary transition-colors">{track.title}</p>
                                  <p className="text-xs text-white/40 truncate">{track.artist}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] font-mono text-secondary/60 bg-secondary/5 px-1.5 rounded flex items-center gap-1">
                                          <Clock size={8} /> {track.time}
                                      </span>
                                  </div>
                              </div>
                          </motion.div>
                      )) : (
                          <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                              <Radio size={40} className="mb-4" />
                              <p className="text-xs">Actualizando historial...</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
          
          <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 rounded-[32px]"></div>
      </motion.div>
      
      {!isVisible && (
          <div className="py-4 flex justify-center">
               <button 
                  onClick={() => setIsVisible(true)}
                  className="flex items-center gap-3 px-10 py-5 bg-secondary text-primary font-black rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all text-lg ring-4 ring-secondary/10"
               >
                  <Radio className="animate-pulse" />
                  ESCUCHAR EN VIVO
               </button>
          </div>
      )}
    </div>
  );
};
