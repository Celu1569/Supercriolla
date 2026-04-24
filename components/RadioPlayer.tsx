import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, Radio, ListMusic, X } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { motion, AnimatePresence } from 'motion/react';

interface RadioPlayerProps {
  variant?: 'hero' | 'sticky';
}

interface TrackHistory {
   title: string;
   artist: string;
   cover: string;
   time: string;
}

export const RadioPlayer: React.FC<RadioPlayerProps> = ({ variant = 'sticky' }) => {
  const { config } = useConfig();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState(false);
  const [metadata, setMetadata] = useState({
    title: 'Recuperando señal...',
    artist: 'Conectando...',
    cover: ''
  });
  const [history, setHistory] = useState<TrackHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  // Keep track of config updates to initialize default cover if needed
  useEffect(() => {
    if (metadata.cover === '' && config.navigation.logoUrl) {
      setMetadata(prev => ({
        ...prev,
        artist: prev.artist === 'Conectando...' ? (config.general.stationName || 'Cargando...') : prev.artist,
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
        const response = await fetch(`/api/metadata?stream=${streamUrl}&logo=${logoUrl}`);
        if (response.ok) {
          const data = await response.json();
          
          // Filter generic strings
          const isGenericString = (s: string) => {
            if (!s) return true;
            const lower = s.toLowerCase();
            return lower.includes("transmision") || 
                   lower.includes("en vivo") || 
                   lower.includes("pasion por lo nuestro") ||
                   lower.includes("pasión por lo nuestro") ||
                   lower.includes("supercriolla") ||
                   lower.includes("nueva era") ||
                   lower === "unknown" ||
                   lower === "stream";
          };

          // Use provided logo as the ultimate fallback for cover
          const finalCover = data.cover || config.navigation.logoUrl || config.general.logoUrl;
          
          const finalArtist = (!data.artist || isGenericString(data.artist)) 
            ? (config.general.stationName || "Radio en Vivo")
            : data.artist;
            
          const finalTitle = (!data.title || isGenericString(data.title))
            ? "Señal en directo"
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

  // Handle clicking outside of history panel
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    }
    if (showHistory) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHistory]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      // Clear src to stop downloading data in background
      audioRef.current.src = "";
      audioRef.current.load();
      setIsPlaying(false);
    } else {
      setError(false);
      // Re-load stream to ensure it's fresh and not stuck in a buffer
      const streamUrl = config.general.streamUrl;
      let finalUrl = streamUrl;
      
      // Handle different stream formats and common radio platform hacks
      if (streamUrl) {
          // Shoutcast direct IP:PORT hack (only if it's just domain:port or IP:port)
          // We check if there's a path after the port. 
          // A simple regex to check if it's just http(s)://domain:port/ or http(s)://domain:port
          const isSimpleUrl = /^https?:\/\/[^/]+\/?$/.test(streamUrl);
          
          if (isSimpleUrl && !streamUrl.includes('?') && !streamUrl.includes(';') && !streamUrl.includes('.mp3') && !streamUrl.includes('.aac')) {
              finalUrl = `${streamUrl}${streamUrl.endsWith('/') ? '' : '/'};`;
          }
          // Listen2MyRadio listen.php hack - append .mp3 to trick browser into treating it as audio
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
            // Some browsers block auto-play or have issues with certain stream formats
            // We'll show the error but allow the user to try again
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
    
    // Automatically handle mute state based on slider
    if (newVol === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        // Unmute: Restore previous volume or default to 0.5 if it was 0
        const volToRestore = prevVolume > 0 ? prevVolume : 0.5;
        audioRef.current.volume = volToRestore;
        setVolume(volToRestore);
        setIsMuted(false);
      } else {
        // Mute: Save current volume and set to 0
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
    setError(true);
    setIsPlaying(false);
  };

  // Sync stream URL updates
  useEffect(() => {
    if(audioRef.current) {
        setError(false);
        // If it was playing, we need to restart with the new URL
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

  if (variant === 'hero') {
    return (
      <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-xl shadow-2xl max-w-md w-full relative text-center">
        {/* History Toggle for Hero */}
        <div className="absolute top-4 right-4 z-20" ref={historyRef}>
          <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 transition-colors rounded-full ${showHistory ? 'bg-secondary text-primary' : 'bg-black/20 text-white/80 hover:text-secondary hover:bg-black/40'}`}
              aria-label="Ver últimos temas"
              title="Historial de reproducción"
          >
              <ListMusic size={20} />
          </button>
          
          <AnimatePresence>
              {showHistory && (
                  <motion.div 
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-[calc(100%+0.5rem)] right-0 w-72 bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden z-[60] text-left"
                  >
                      <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
                          <h4 className="font-bold text-white flex items-center text-sm"><ListMusic size={16} className="mr-2 text-secondary"/> Últimos Sonados</h4>
                          <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                              <X size={16} />
                          </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                          {history.length > 0 ? (
                              <div className="space-y-1">
                                  {history.map((track, i) => (
                                      <div key={`${track.title}-${i}`} className="flex items-center gap-3 p-2 hover:bg-gray-800/80 rounded-lg transition-colors group">
                                          <div className="w-10 h-10 rounded overflow-hidden shadow bg-gray-800 flex-shrink-0 border border-gray-700">
                                              {track.cover ? (
                                                  <img src={track.cover} alt="" className="w-full h-full object-cover" />
                                              ) : (
                                                  <Radio className="w-5 h-5 m-2.5 text-gray-500" />
                                              )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <p className="text-sm font-bold text-white truncate group-hover:text-secondary transition-colors" title={track.title}>{track.title}</p>
                                              <p className="text-xs text-gray-400 truncate" title={track.artist}>{track.artist}</p>
                                          </div>
                                          <div className="text-[10px] text-gray-500 font-mono whitespace-nowrap bg-black/30 px-1.5 py-0.5 rounded">
                                              {track.time}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="p-6 text-center text-gray-500 text-sm">
                                  <ListMusic className="w-8 h-8 opacity-20 mx-auto mb-2" />
                                  <p>Recopilando historial...</p>
                                  <p className="text-xs opacity-60 mt-1">Espera los próximos temas</p>
                              </div>
                          )}
                      </div>
                  </motion.div>
              )}
          </AnimatePresence>
        </div>

        <audio 
            ref={audioRef} 
            onError={handleAudioError}
            preload="none"
        />
        
        {/* Metadata Display for Hero */}
        <div className="mb-6">
            <div className="relative w-32 h-32 mx-auto mb-4 rounded-lg overflow-hidden shadow-2xl border-2 border-secondary/30 flex items-center justify-center bg-gray-800">
                {metadata.cover ? (
                    <img 
                        src={metadata.cover} 
                        alt="Cover" 
                        className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-110' : 'scale-100'}`}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                            if (e.currentTarget.src !== config.navigation.logoUrl) {
                                e.currentTarget.src = config.navigation.logoUrl || '';
                            }
                        }}
                    />
                ) : (
                    <Radio className="text-white/50 w-12 h-12" />
                )}
                {!isPlaying && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Radio className="text-white/50 w-12 h-12" /></div>}
            </div>
            
            <h3 className="text-white font-bold text-lg truncate px-2" title={metadata.title}>{metadata.title}</h3>
            <p className="text-secondary text-sm font-medium truncate px-2" title={metadata.artist}>{metadata.artist || 'Radio en Vivo'}</p>
        </div>
        
        <button
          onClick={togglePlay}
          className="w-16 h-16 rounded-full bg-secondary hover:bg-yellow-400 text-primary flex items-center justify-center mx-auto transition-transform hover:scale-105 shadow-lg"
        >
          {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
        </button>
        {error && <p className="text-red-300 text-xs mt-2 font-bold bg-black/50 p-1 rounded">Offline o Error de Stream</p>}
      </div>
    );
  }

  // Sticky variant
  return (
    <>
    <div className="fixed bottom-0 left-0 right-0 bg-primary text-white border-t border-white/10 shadow-lg z-50 h-24 px-4">
      <audio 
        ref={audioRef} 
        onError={handleAudioError}
        preload="none"
      />
      <div className="container mx-auto h-full flex items-center justify-between gap-4">
        
        {/* Play/Info Section */}
        <div className="flex items-center space-x-4 flex-1 overflow-hidden">
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-secondary text-primary flex items-center justify-center hover:bg-yellow-400 transition-colors shadow-sm"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
          
          <div className="flex items-center space-x-3 flex-1 min-w-0 overflow-hidden">
            {/* Mini Cover - Always visible now */}
            <div className="w-14 h-14 rounded bg-gray-800 flex-shrink-0 overflow-hidden flex items-center justify-center shadow-inner">
                {metadata.cover || config.navigation.logoUrl ? (
                    <img 
                        src={metadata.cover || config.navigation.logoUrl} 
                        alt="Cover" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                            // Fallback to station logo if the loaded image fails
                            if (e.currentTarget.src !== config.navigation.logoUrl) {
                                e.currentTarget.src = config.navigation.logoUrl || '';
                            }
                        }}
                    />
                ) : (
                    <Radio className="text-white/50 w-7 h-7" />
                )}
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-center">
                   <p className="text-base truncate font-bold text-white mb-0.5 leading-tight" title={metadata.title}>{metadata.title}</p>
                   <p className="text-xs truncate text-secondary font-medium" title={metadata.artist}>{metadata.artist || 'Radio en Vivo'}</p>
            </div>
          </div>
          
          {error && <span className="text-xs text-red-300 font-bold ml-2 whitespace-nowrap">Offline</span>}
        </div>

        {/* Controls Right Section */}
        <div className="flex items-center gap-2 md:gap-3 w-auto md:w-1/3 justify-end relative" ref={historyRef}>
          
          {/* History Toggle */}
          <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 transition-colors rounded-full flex-shrink-0 ${showHistory ? 'bg-secondary text-primary' : 'text-white/80 hover:text-secondary hover:bg-white/10'}`}
              aria-label="Ver últimos temas"
              title="Historial de reproducción"
          >
              <ListMusic size={20} />
          </button>

          {/* History Popover */}
          <AnimatePresence>
              {showHistory && (
                  <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute bottom-[calc(100%+1.5rem)] right-0 w-72 md:w-80 bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden z-[60] text-left"
                  >
                      <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
                          <h4 className="font-bold text-white flex items-center text-sm md:text-base"><ListMusic size={16} className="mr-2 text-secondary"/> Últimos Sonados</h4>
                          <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                              <X size={16} />
                          </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                          {history.length > 0 ? (
                              <div className="space-y-1">
                                  {history.map((track, i) => (
                                      <div key={`${track.title}-${i}`} className="flex items-center gap-3 p-2 hover:bg-gray-800/80 rounded-lg transition-colors group">
                                          <div className="w-10 h-10 rounded overflow-hidden shadow bg-gray-800 flex-shrink-0 border border-gray-700">
                                              {track.cover ? (
                                                  <img src={track.cover} alt="" className="w-full h-full object-cover" />
                                              ) : (
                                                  <Radio className="w-5 h-5 m-2.5 text-gray-500" />
                                              )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <p className="text-sm font-bold text-white truncate group-hover:text-secondary transition-colors" title={track.title}>{track.title}</p>
                                              <p className="text-xs text-gray-400 truncate" title={track.artist}>{track.artist}</p>
                                          </div>
                                          <div className="text-[10px] text-gray-500 font-mono whitespace-nowrap bg-black/30 px-1.5 py-0.5 rounded">
                                              {track.time}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="p-6 text-center text-gray-500 text-sm">
                                  <ListMusic className="w-8 h-8 opacity-20 mx-auto mb-2" />
                                  <p>Recopilando historial...</p>
                                  <p className="text-xs opacity-60 mt-1">Espera los próximos temas</p>
                              </div>
                          )}
                      </div>
                  </motion.div>
              )}
          </AnimatePresence>

          {/* Volume Control - Hide on extra small screens */}
          <div className="hidden sm:flex items-center gap-2 group relative">
            <button 
                onClick={toggleMute} 
                className="p-2 text-white/80 hover:text-secondary transition-colors rounded-full hover:bg-white/10"
                aria-label={isMuted ? "Unmute" : "Mute"}
            >
                {getVolumeIcon()}
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                {isMuted ? 'Activar sonido' : 'Silenciar'}
            </div>
          </div>
          
          <div className="w-24 md:w-32 relative flex items-center group">
             <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="
                  w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer 
                  focus:outline-none focus:ring-2 focus:ring-secondary/50
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:bg-secondary
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:shadow-md
                  [&::-webkit-slider-thumb]:transition-transform
                  [&::-webkit-slider-thumb]:hover:scale-125
                  [&::-moz-range-thumb]:w-4
                  [&::-moz-range-thumb]:h-4
                  [&::-moz-range-thumb]:bg-secondary
                  [&::-moz-range-thumb]:border-none
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:transition-transform
                  [&::-moz-range-thumb]:hover:scale-125
                "
                aria-label="Volume Control"
              />
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
