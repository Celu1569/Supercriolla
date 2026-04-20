import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, Radio } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { motion, AnimatePresence } from 'motion/react';

interface RadioPlayerProps {
  variant?: 'hero' | 'sticky';
}

export const RadioPlayer: React.FC<RadioPlayerProps> = ({ variant = 'sticky' }) => {
  const { config } = useConfig();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [prevVolume, setPrevVolume] = useState(0.8); // Store previous volume for unmute
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState(false);
  const [metadata, setMetadata] = useState({
    title: 'Cargando...',
    artist: 'Supercriolla',
    cover: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=200&auto=format&fit=crop'
  });

  // Real metadata fetcher
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch('/api/radio/metadata');
        if (response.ok) {
          const data = await response.json();
          setMetadata(data);
        }
      } catch (e) {
        console.error("Metadata fetch error:", e);
      }
    };

    const interval = setInterval(fetchMetadata, 20000); // Update every 20s
    fetchMetadata();
    
    return () => clearInterval(interval);
  }, []);

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
      <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-xl shadow-2xl max-w-md w-full text-center">
        <audio 
            ref={audioRef} 
            onError={handleAudioError}
            preload="none"
        />
        
        {/* Metadata Display for Hero */}
        <div className="mb-6">
            <div className="relative w-32 h-32 mx-auto mb-4 rounded-lg overflow-hidden shadow-2xl border-2 border-secondary/30">
                <img 
                    src={metadata.cover} 
                    alt="Cover" 
                    className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-110' : 'scale-100'}`}
                    referrerPolicy="no-referrer"
                />
                {!isPlaying && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Radio className="text-white/50 w-12 h-12" /></div>}
            </div>
            <h3 className="text-white font-bold text-lg truncate px-2">{metadata.title}</h3>
            <p className="text-secondary text-sm font-medium truncate px-2">{metadata.artist}</p>
        </div>

        <div className="flex items-center justify-center mb-4">
            <Radio className={`text-secondary w-5 h-5 mr-2 ${isPlaying ? 'animate-pulse' : ''}`} />
            <span className="text-white font-heading text-sm uppercase tracking-widest">En Vivo Ahora</span>
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
          
          <div className="flex items-center space-x-3 overflow-hidden">
            {/* Mini Cover */}
            <div className="hidden xs:block w-12 h-12 rounded bg-gray-800 flex-shrink-0 overflow-hidden border border-white/10">
                <img src={metadata.cover} alt="Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="overflow-hidden">
                <p className="font-bold text-[10px] text-secondary uppercase tracking-widest flex items-center">
                    {isPlaying && <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 animate-pulse"></span>}
                    En el aire
                </p>
                <p className="text-sm truncate font-bold text-white">{metadata.title}</p>
                <p className="text-xs truncate text-white/60">{metadata.artist}</p>
            </div>
          </div>
          
          {error && <span className="text-xs text-red-300 font-bold ml-2 whitespace-nowrap">Offline</span>}
        </div>

        {/* Volume Control Section */}
        <div className="flex items-center gap-3 w-auto md:w-1/3 max-w-[200px] justify-end">
          <div className="relative group">
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
