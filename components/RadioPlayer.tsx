import React, { useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Volume1, Radio, Disc, RefreshCw, Tv, MessageCircle, Wifi } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { useRadioAudio } from '../context/RadioAudioContext';
import { motion, AnimatePresence } from 'motion/react';
import { AudioVisualizerCanvas } from './AudioVisualizerCanvas';
import { SongInsightsPanel } from './SongInsightsPanel';
import { DEFAULT_VISUALIZER_PROFILE } from '../constants';

interface RadioPlayerProps {
  onOpenSongRequest?: () => void;
}

export const RadioPlayer: React.FC<RadioPlayerProps> = ({ onOpenSongRequest }) => {
  const { config } = useConfig();
  const {
    isPlaying,
    isBuffering,
    isReconnecting,
    hasError,
    isLiveConnected,
    isFetchingMetadata,
    volume,
    isMuted,
    analyzerNode,
    stationName,
    defaultSlogan,
    displayTitle,
    displayArtist,
    finalCover,
    togglePlay,
    setVolumeLevel,
    toggleMute,
    fetchMetadata,
    handleImageError,
  } = useRadioAudio();

  const [isVisible, setIsVisible] = useState(true);

  const playerStyle = config.appearance.radioPlayer?.playerStyle || 'modern';
  const videoUrl = config.appearance.radioPlayer?.videoUrl || '';
  const isVideoMode = config.appearance.radioPlayer?.videoMode && videoUrl;
  const videoLayout = config.appearance.radioPlayer?.videoLayout || 'compact';

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const youtubeId = videoUrl ? getYouTubeId(videoUrl) : null;
  const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1` : videoUrl;

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX size={18} />;
    if (volume < 0.4) return <Volume1 size={18} />;
    return <Volume2 size={18} />;
  };

  const audioElement: React.ReactNode = null;

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
                    src={finalCover} 
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
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                  isReconnecting ? 'bg-amber-500 text-black animate-pulse' :
                  isBuffering && isPlaying ? 'bg-blue-500 text-white animate-pulse' :
                  isPlaying ? 'bg-red-500 text-white animate-pulse' : 
                  hasError ? 'bg-rose-600 text-white' : 'bg-white/10 text-gray-400'
                }`}>
                  {isReconnecting ? 'RECONECTANDO' :
                   isBuffering && isPlaying ? 'SINTONIZANDO' :
                   isPlaying ? 'EN VIVO' : 
                   hasError ? 'SIN AUDIO' : 'PAUSADO'}
                </span>
                <span className="text-[11px] font-bold text-yellow-400 tracking-widest uppercase truncate max-w-xs">
                  {hasError ? 'Señal interrumpida • Clic para reintentar' : (isReconnecting ? 'Reconectando transmisión...' : displayArtist)}
                </span>
                <button onClick={() => fetchMetadata(true)} title="Actualizar título" className="p-1 hover:text-yellow-400 text-gray-500 transition-colors">
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
                onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-full accent-yellow-400 cursor-pointer"
              />
            </div>

            {onOpenSongRequest && (
              <button
                onClick={onOpenSongRequest}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/35 text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
                title="Pedir canción directo a WhatsApp"
              >
                <MessageCircle size={14} className="text-emerald-400" />
                <span>Pedir Canción</span>
              </button>
            )}
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
                  src={finalCover} 
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
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isReconnecting ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  isBuffering && isPlaying ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse' :
                  isPlaying ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  hasError ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-white/10 text-gray-400'
                }`}>
                  {isReconnecting ? '● Reconectando' :
                   isBuffering && isPlaying ? '● Sintonizando' :
                   isPlaying ? '● Al Aire' :
                   hasError ? '✕ Sin Audio' : '○ Pausado'}
                </span>
                <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest truncate">
                  {hasError ? 'Señal interrumpida • Clic para reintentar' : (isReconnecting ? 'Recuperando transmisión...' : displayArtist)}
                </p>
                <button onClick={() => fetchMetadata(true)} title="Actualizar canción" className="text-gray-500 hover:text-white transition-colors">
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
                onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/20 rounded-full accent-yellow-400 cursor-pointer"
              />
            </div>

            {onOpenSongRequest && (
              <button
                onClick={onOpenSongRequest}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/35 text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
                title="Pedir canción directo a WhatsApp"
              >
                <MessageCircle size={14} className="text-emerald-400" />
                <span>Pedir Canción</span>
              </button>
            )}
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
                src={finalCover} 
                alt={displayTitle} 
                onError={handleImageError}
                className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0"
              />
            )}

            <div className="min-w-0 truncate">
              <span className="text-xs font-black text-white truncate block">{displayTitle}</span>
              <span className="text-[10px] text-yellow-400 truncate block uppercase tracking-wider">
                {hasError ? 'Sin audio (Clic en Play)' : (isReconnecting ? 'Reconectando...' : (isBuffering && isPlaying ? 'Sintonizando...' : displayArtist))}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onOpenSongRequest && (
              <button
                onClick={onOpenSongRequest}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/35 text-[11px] font-bold transition-all active:scale-95 whitespace-nowrap"
                title="Pedir canción directo a WhatsApp"
              >
                <MessageCircle size={13} className="text-emerald-400" />
                <span className="hidden sm:inline">Pedir Canción</span>
              </button>
            )}
            <button onClick={() => fetchMetadata(true)} className="text-gray-500 hover:text-white p-1">
              <RefreshCw size={14} className={isFetchingMetadata ? 'animate-spin text-yellow-400' : ''} />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5 border border-white/10">
              <button onClick={toggleMute} className="text-gray-400 hover:text-white">
                {getVolumeIcon()}
              </button>
              <input
                type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
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
                    src={finalCover} 
                    alt={displayTitle} 
                    onError={handleImageError}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    isReconnecting ? 'bg-amber-400 animate-ping' :
                    isBuffering && isPlaying ? 'bg-blue-400 animate-pulse' :
                    isPlaying ? 'bg-red-500 animate-ping' : 
                    hasError ? 'bg-rose-500' : 'bg-gray-500'
                  }`}></span>
                  <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest truncate">
                    {hasError ? 'Sin audio • Clic Play' : (isReconnecting ? 'Reconectando...' : (isBuffering && isPlaying ? 'Sintonizando...' : (displayArtist !== defaultSlogan ? displayArtist : '')))}
                  </span>
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
                  onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/20 rounded-full accent-yellow-400"
                />
              </div>

              <button onClick={() => fetchMetadata(true)} className="text-gray-400 hover:text-white p-2">
                <RefreshCw size={16} className={isFetchingMetadata ? 'animate-spin text-yellow-400' : ''} />
              </button>
              {onOpenSongRequest && (
                <button
                  onClick={onOpenSongRequest}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/35 text-[11px] font-bold transition-all active:scale-95 whitespace-nowrap"
                  title="Pedir canción directo a WhatsApp"
                >
                  <MessageCircle size={13} className="text-emerald-400" />
                  <span className="hidden sm:inline">Pedir Canción</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  // DEFAULT STYLE: MODERN STUDIO (Organizado arriba + Visualizador de ancho completo en la línea inferior)
  return (
    <div className="w-full animate-fade-in z-30 relative">
      <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: isVisible ? 1 : 0, height: isVisible ? 'auto' : 0 }}
          className="relative flex-col rounded-2xl bg-gradient-to-br from-[#0e1526]/95 via-[#080c16]/95 to-[#05070d]/95 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.65)] transition-all duration-700 ease-out origin-top overflow-hidden"
          style={{ display: isVisible ? 'flex' : 'none' }}
      >
          {audioElement}

          {/* Subtle Top Ambient Accent Line */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-secondary/60 to-transparent pointer-events-none" />

          {/* Player Inner Layout */}
          <div className={`relative z-20 flex flex-col ${videoLayout === 'full' ? 'lg:flex-row' : 'lg:flex-row'} items-center justify-between gap-4 sm:gap-5 px-4 py-4 sm:px-6 sm:py-5 w-full mx-auto`}>
              
              {/* ZONE 1: Cover & Station Info */}
              <div className={`flex items-center gap-4 sm:gap-5 min-w-0 w-full ${
                config.appearance.radioPlayer?.showSongInsights !== false &&
                config.appearance.radioPlayer?.songInsightsConfig?.enabled !== false &&
                !isVideoMode
                  ? 'lg:w-[300px] xl:w-[340px] 2xl:w-[380px] flex-shrink-0'
                  : 'flex-1 lg:w-auto'
              }`}>
                  {/* Integrated Video (Compact Mode) */}
                  {isVideoMode && videoLayout === 'compact' && (
                      <div 
                          className="relative overflow-hidden rounded-2xl shadow-2xl border border-white/20 bg-black aspect-video ring-2 ring-secondary/20 flex-shrink-0"
                          style={{ 
                              width: config.appearance.radioPlayer?.videoWidth ? `${config.appearance.radioPlayer.videoWidth}px` : '220px',
                              height: config.appearance.radioPlayer?.videoHeight ? `${config.appearance.radioPlayer.videoHeight}px` : '124px'
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
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 xl:w-28 xl:h-28 flex-shrink-0 group">
                          <AnimatePresence mode="wait">
                              <motion.img 
                                  key={finalCover}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 1.04 }}
                                  transition={{ duration: 0.3 }}
                                  src={finalCover} 
                                  alt={displayTitle}
                                  onError={handleImageError}
                                  className="w-full h-full object-cover rounded-2xl shadow-2xl border border-white/15 group-hover:border-secondary/60 transition-colors bg-black/40"
                              />
                          </AnimatePresence>
                          <div className="absolute -bottom-1.5 -right-1.5 bg-secondary text-primary p-1.5 rounded-xl shadow-lg border border-black/30">
                              <Radio size={13} className={isPlaying ? 'animate-pulse' : ''} />
                          </div>
                      </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors ${
                            isReconnecting ? 'bg-amber-600 text-white animate-pulse' :
                            isBuffering && isPlaying ? 'bg-blue-600 text-white animate-pulse' :
                            isPlaying ? 'bg-red-600 text-white shadow-red-500/50' : 
                            hasError ? 'bg-rose-700 text-white' : 'bg-white/10 text-white/80'
                          }`}>
                              <span className={`w-2 h-2 rounded-full ${
                                isReconnecting ? 'bg-amber-200 animate-ping' :
                                isBuffering && isPlaying ? 'bg-blue-200 animate-pulse' :
                                isPlaying ? 'bg-white animate-ping' : 
                                hasError ? 'bg-rose-200' : 'bg-secondary'
                              }`}></span>
                              {isReconnecting ? 'Reconectando' :
                               isBuffering && isPlaying ? 'Sintonizando' :
                               isPlaying ? 'Al Aire' : 
                               hasError ? 'Sin Señal' : 'En Sintonía'}
                          </span>
                          {isLiveConnected && (
                            <span className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-400 font-mono tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <Wifi size={10} className="animate-pulse text-emerald-400" />
                              <span>EN VIVO</span>
                            </span>
                          )}
                      </div>

                      {(config.appearance.radioPlayer?.showMetadata !== false) && (
                          <motion.div 
                            key={displayArtist}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-xs sm:text-sm font-black text-secondary uppercase tracking-[0.12em] line-clamp-1 drop-shadow-md flex items-center gap-1.5"
                          >
                              <span className="truncate">{hasError ? 'Señal interrumpida - Toca Reproducir' : (isReconnecting ? 'Reconectando...' : displayArtist)}</span>
                              <button onClick={() => fetchMetadata(true)} title="Comprobar título en vivo" className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                                <RefreshCw size={12} className={isFetchingMetadata ? 'animate-spin text-secondary' : ''} />
                              </button>
                          </motion.div>
                      )}

                      <motion.h2 
                        key={displayTitle}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-lg sm:text-xl xl:text-2xl font-black text-white line-clamp-1 sm:line-clamp-2 drop-shadow-xl leading-tight tracking-tight"
                        title={displayTitle}
                      >
                          {(config.appearance.radioPlayer?.showMetadata !== false) ? displayTitle : stationName}
                      </motion.h2>
                  </div>
              </div>

              {/* Expanded Video Area */}
              {isVideoMode && videoLayout === 'full' && (
                  <div className="relative w-full lg:max-w-xl aspect-video overflow-hidden rounded-2xl shadow-2xl border border-white/10 bg-black my-1">
                      <iframe 
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                  </div>
              )}

              {/* ZONE 2: Song & Artist Info / History / Positive Buenísima Messages / Sponsors */}
              {config.appearance.radioPlayer?.showSongInsights !== false &&
                config.appearance.radioPlayer?.songInsightsConfig?.enabled !== false &&
                !isVideoMode && (
                <SongInsightsPanel
                  title={displayTitle}
                  artist={displayArtist}
                  stationName={stationName}
                  defaultSlogan={defaultSlogan}
                  isPlaying={isPlaying}
                  insightsConfig={config.appearance.radioPlayer?.songInsightsConfig}
                />
              )}

              {/* ZONE 3: Organized Playback, Volume & Quick Actions */}
              <div className="flex flex-col items-center lg:items-end gap-2.5 w-full lg:w-auto flex-shrink-0">
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-center lg:justify-end">
                      <motion.button
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={togglePlay}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-secondary text-primary flex items-center justify-center shadow-lg shadow-secondary/20 hover:brightness-110 transition-all flex-shrink-0"
                          title={isPlaying ? "Pausar" : "Reproducir"}
                      >
                          {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                      </motion.button>

                      <div className="flex-1 sm:w-44 xl:w-48 flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 backdrop-blur-xl">
                          <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors flex-shrink-0">
                              {getVolumeIcon()}
                          </button>
                          <input
                              type="range"
                              min="0" max="1" step="0.01"
                              value={volume}
                              onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                              className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-secondary"
                          />
                      </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-center lg:justify-end">
                      {onOpenSongRequest && (
                        <button
                          onClick={onOpenSongRequest}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/35 text-[11px] font-bold transition-all active:scale-95"
                          title="Pedir canción directo a WhatsApp"
                        >
                          <MessageCircle size={13} className="text-emerald-400" />
                          <span>Pedir Canción</span>
                        </button>
                      )}

                      <a
                        href="#/pantalla"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 text-[11px] font-bold transition-all active:scale-95"
                        title="Abrir en Modo Pantalla de Google / Smart TV"
                      >
                        <Tv size={13} className="text-secondary" />
                        <span>Pantalla TV</span>
                      </a>
                  </div>
              </div>
          </div>

          {/* BOTTOM FULL-WIDTH CONTINUOUS AUDIO VISUALIZER (No divider lines) */}
          {config.appearance.radioPlayer?.showAnalyzer !== false && !isVideoMode && (
            <div className="relative z-20 w-full bg-gradient-to-t from-black/55 to-transparent pt-1">
              <AudioVisualizerCanvas
                isPlaying={isPlaying}
                isBuffering={isBuffering}
                isMuted={isMuted}
                volume={volume}
                isVisible={isVisible}
                analyzer={analyzerNode}
                profile={config.appearance.radioPlayer?.visualizer || DEFAULT_VISUALIZER_PROFILE}
              />
            </div>
          )}
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
