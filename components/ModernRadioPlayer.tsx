import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Volume2, VolumeX, Music, Info, Radio, SkipForward, SkipBack } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';

export const ModernRadioPlayer: React.FC = () => {
    const { config } = useConfig();
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(80);
    const [isMuted, setIsMuted] = useState(false);
    const [metadata, setMetadata] = useState({ title: '', artist: '', cover: '' });
    const [songInfo, setSongInfo] = useState('');
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [showInfo, setShowInfo] = useState(false);

    const streamUrl = config.streamUrl || 'https://redradioypc.com:8010/live';
    const stationLogo = config.appearance.logo || '';

    // Initialize Audio
    useEffect(() => {
        audioRef.current = new Audio(streamUrl);
        audioRef.current.volume = volume / 100;

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
    }, [streamUrl]);

    // Handle Play/Pause
    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.load();
                audioRef.current.play().catch(e => console.error("Error playing audio:", e));
            }
            setIsPlaying(!isPlaying);
        }
    };

    // Handle Volume
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume / 100;
        }
    }, [volume, isMuted]);

    // Fetch Metadata
    useEffect(() => {
        const fetchMetadata = async () => {
            setIsLoadingMetadata(true);
            try {
                const res = await fetch(`/api/metadata?stream=${encodeURIComponent(streamUrl)}&logo=${encodeURIComponent(stationLogo)}&station=${encodeURIComponent(config.radioName)}`);
                if (res.ok) {
                    const data = await res.json();
                    setMetadata({
                        title: data.title || 'En Vivo',
                        artist: data.artist || config.radioName,
                        cover: data.cover || stationLogo
                    });
                }
            } catch (e) {
                console.error("Metadata fetch error:", e);
            } finally {
                setIsLoadingMetadata(false);
            }
        };

        fetchMetadata();
        const interval = setInterval(fetchMetadata, 30000);
        return () => clearInterval(interval);
    }, [streamUrl, stationLogo, config.radioName]);

    // Fetch Song Info (Gemini)
    useEffect(() => {
        if (metadata.title && metadata.artist && metadata.title !== 'En Vivo') {
            const fetchSongInfo = async () => {
                try {
                    const res = await fetch(`/api/song-info?artist=${encodeURIComponent(metadata.artist)}&title=${encodeURIComponent(metadata.title)}`);
                    if (res.ok) {
                        const data = await res.json();
                        setSongInfo(data.text);
                    }
                } catch (e) {
                    console.error("Song info fetch error:", e);
                }
            };
            fetchSongInfo();
        } else {
            setSongInfo('Sintonizando la mejor música para ti.');
        }
    }, [metadata.title, metadata.artist]);

    return (
        <div className="w-full max-w-4xl mx-auto p-4">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl p-6 md:p-8"
            >
                {/* Background Glow */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    {/* Cover Art Section */}
                    <div className="relative group">
                        <motion.div 
                            animate={{ rotate: isPlaying ? 360 : 0 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="w-48 h-48 md:w-56 md:h-56 rounded-full overflow-hidden border-4 border-white/10 shadow-inner"
                        >
                            <img 
                                src={metadata.cover || stationLogo} 
                                alt="Cover" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                            />
                        </motion.div>
                        
                        {/* Status Ring */}
                        <div className={`absolute -inset-2 rounded-full border-2 border-dashed ${isPlaying ? 'border-primary/50 animate-spin-slow' : 'border-white/10'}`} />
                        
                        {/* Play Overlay */}
                        <button 
                            onClick={togglePlay}
                            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                        >
                            {isPlaying ? <Pause size={48} className="text-white" /> : <Play size={48} className="text-white translate-x-1" />}
                        </button>
                    </div>

                    {/* Controls & Info Section */}
                    <div className="flex-1 w-full flex flex-col gap-6">
                        <div className="text-center md:text-left">
                            <motion.h2 
                                key={metadata.title}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-2xl md:text-3xl font-bold text-white tracking-tight line-clamp-1"
                            >
                                {metadata.title}
                            </motion.h2>
                            <motion.p 
                                key={metadata.artist}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className="text-white/60 text-lg font-medium mt-1"
                            >
                                {metadata.artist}
                            </motion.p>
                        </div>

                        {/* Song Info Fact */}
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={songInfo}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-white/5 rounded-xl p-4 border border-white/5"
                            >
                                <div className="flex gap-3 items-start">
                                    <Info size={18} className="text-primary mt-1 shrink-0" />
                                    <p className="text-sm text-white/80 leading-relaxed italic">
                                        {songInfo}
                                    </p>
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        {/* Main Controls */}
                        <div className="flex items-center justify-center md:justify-start gap-8">
                            <div className="flex items-center gap-4">
                                <button className="p-2 text-white/40 hover:text-white transition-colors">
                                    <SkipBack size={24} />
                                </button>
                                <button 
                                    onClick={togglePlay}
                                    className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
                                >
                                    {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="translate-x-1" />}
                                </button>
                                <button className="p-2 text-white/40 hover:text-white transition-colors">
                                    <SkipForward size={24} />
                                </button>
                            </div>

                            {/* Volume Control */}
                            <div className="hidden sm:flex items-center gap-3 flex-1 max-w-[150px]">
                                <button onClick={() => setIsMuted(!isMuted)} className="text-white/60 hover:text-white">
                                    {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                </button>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={isMuted ? 0 : volume} 
                                    onChange={(e) => setVolume(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>
                        </div>

                        {/* Visualizer Placeholder */}
                        <div className="flex items-end gap-1 h-8 opacity-40">
                            {[...Array(24)].map((_, i) => (
                                <motion.div 
                                    key={i}
                                    animate={{ 
                                        height: isPlaying ? [8, 24, 12, 32, 16] : 8
                                    }}
                                    transition={{ 
                                        duration: 0.5 + Math.random(), 
                                        repeat: Infinity, 
                                        ease: "easeInOut" 
                                    }}
                                    className="flex-1 bg-white rounded-full w-1"
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
