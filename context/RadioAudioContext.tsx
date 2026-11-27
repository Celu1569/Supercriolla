import React, { createContext, useContext, useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useConfig } from './ConfigContext';
import { resolveDirectImageUrl } from '../utils/imageUrl';
import {
  parseAndResolveStreamMetadata,
  resolveMusicArtwork,
  fetchIcecastStatusFromBrowser,
  isRealMusicCover,
  DEFAULT_RADIO_COVER,
} from '../utils/musicMetadata';
import { recordListenerSession, recordPeakListenerCount } from '../utils/listenerAnalytics';

const DEFAULT_COVER = DEFAULT_RADIO_COVER;

export interface RadioMetadataState {
  title: string;
  artist: string;
  cover: string;
}

interface RadioAudioContextValue {
  isPlaying: boolean;
  isBuffering: boolean;
  isReconnecting: boolean;
  hasError: boolean;
  isLiveConnected: boolean;
  isFetchingMetadata: boolean;
  volume: number;
  isMuted: boolean;
  analyzerNode: AnalyserNode | null;
  metadata: RadioMetadataState;
  stationName: string;
  defaultSlogan: string;
  displayTitle: string;
  displayArtist: string;
  displayCover: string;
  finalCover: string;
  togglePlay: () => Promise<void>;
  setVolumeLevel: (val: number) => void;
  toggleMute: () => void;
  fetchMetadata: (force?: boolean) => Promise<void>;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

const RadioAudioContext = createContext<RadioAudioContextValue | undefined>(undefined);

export const RadioAudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { config } = useConfig();
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [analyzerNode, setAnalyzerNode] = useState<AnalyserNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [activeSource, setActiveSource] = useState<'direct' | 'proxy'>('direct');
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.85);
  const [hasError, setHasError] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const stationName = config.general.stationName || 'BUENÍSIMA 87.7 FM';
  const defaultSlogan =
    config.appearance.radioPlayer?.slogan ||
    (config.general as any).defaultSlogan ||
    'La Radio de la Buena Vibra';

  const [metadata, setMetadata] = useState<RadioMetadataState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('last_radio_metadata');
        if (cached) {
          const parsed = JSON.parse(cached);
          const isRecent = parsed?.updatedAt && Date.now() - Number(parsed.updatedAt) < 5 * 60 * 1000;
          if (parsed && isRecent && parsed.title && parsed.title !== 'Sintonizando...' && isRealMusicCover(parsed.cover)) {
            return {
              title: parsed.title || stationName,
              artist: parsed.artist || defaultSlogan,
              cover: parsed.cover || DEFAULT_COVER,
            };
          }
        }
      } catch (_) {}
    }
    return { title: stationName, artist: defaultSlogan, cover: DEFAULT_COVER };
  });

  const applyMetadata = useCallback(
    async (data: { title?: string; artist?: string; cover?: string; rawTitle?: string; listeners?: number }) => {
      if (!data) return;

      if (typeof data.listeners === 'number' && data.listeners > 0) {
        recordPeakListenerCount(data.listeners);
      }

      const { title = '', artist = '', cover = DEFAULT_COVER, rawTitle = '' } = data;
      if (title === 'Sintonizando...' && !rawTitle) return;

      const persistMeta = (nextMeta: RadioMetadataState) => {
        setMetadata((prev) => {
          if (prev.title === nextMeta.title && prev.artist === nextMeta.artist && prev.cover === nextMeta.cover) {
            return prev;
          }
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem('last_radio_metadata', JSON.stringify({ ...nextMeta, updatedAt: Date.now() }));
            }
          } catch (_) {}
          return nextMeta;
        });
      };

      if (cover && isRealMusicCover(cover)) {
        persistMeta({
          title: title || stationName,
          artist: artist || defaultSlogan,
          cover,
        });
        return;
      }

      const isGenericArtist =
        !artist || artist === defaultSlogan || artist === stationName || artist === 'Buenísima 87.7 FM';
      if (rawTitle) {
        const resolved = await parseAndResolveStreamMetadata(rawTitle, stationName, defaultSlogan);
        persistMeta({ title: resolved.title, artist: resolved.artist, cover: resolved.cover });
        return;
      }

      if (title && !isGenericArtist) {
        const resolved = await resolveMusicArtwork(artist, title);
        if (resolved) {
          persistMeta({ title: resolved.title, artist: resolved.artist, cover: resolved.cover });
          return;
        }
        persistMeta({ title, artist, cover: DEFAULT_COVER });
        return;
      }

      const rawToResolve = title || artist;
      if (rawToResolve) {
        const resolved = await parseAndResolveStreamMetadata(rawToResolve, stationName, defaultSlogan);
        persistMeta({ title: resolved.title, artist: resolved.artist, cover: resolved.cover });
      }
    },
    [stationName, defaultSlogan]
  );

  const fetchMetadata = useCallback(
    async (force = false) => {
      setIsFetchingMetadata(true);
      const streamUrl = config.general.streamUrl || 'https://redradioypc.com:8010/live';

      try {
        const response = await fetch(
          `/api/metadata?url=${encodeURIComponent(streamUrl)}&_t=${Date.now()}${force ? '&refresh=true' : ''}`,
          { headers: { Accept: 'application/json' } }
        );
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const data = await response.json();
          const isGeneric =
            !data?.title ||
            data.title === 'Sintonizando...' ||
            (data.title === 'BUENÍSIMA 87.7 FM' && !isRealMusicCover(data.cover));
          if (data && !isGeneric) {
            await applyMetadata(data);
            setIsFetchingMetadata(false);
            return;
          }
        }
      } catch (_) {}

      try {
        const liveStatus = await fetchIcecastStatusFromBrowser(streamUrl);
        if (liveStatus?.rawTitle) {
          await applyMetadata({
            rawTitle: liveStatus.rawTitle,
            title: liveStatus.rawTitle,
            listeners: liveStatus.listeners,
          });
        }
      } catch (err) {
        console.warn('[RadioAudio] Direct metadata fallback failed:', err);
      } finally {
        setIsFetchingMetadata(false);
      }
    },
    [config.general.streamUrl, applyMetadata]
  );

  // Socket.IO real-time updates
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: Infinity,
      });

      socket.on('connect', () => {
        setIsLiveConnected(true);
        socket?.emit('get-radio-metadata');
      });
      socket.on('disconnect', () => setIsLiveConnected(false));
      socket.on('radio-metadata', (data: any) => {
        setIsLiveConnected(true);
        applyMetadata(data);
      });
    } catch (_) {}

    return () => {
      if (socket) socket.disconnect();
    };
  }, [applyMetadata]);

  // SSE stream fallback
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
    } catch (_) {}

    return () => {
      if (es) es.close();
    };
  }, [applyMetadata]);

  // Regular polling + listener session visit log
  useEffect(() => {
    recordListenerSession('visit');
    fetchMetadata(true);
    const interval = setInterval(() => fetchMetadata(false), 15000);

    const handleVisibilityChange = () => {
      if (!document.hidden) fetchMetadata();
    };
    const handleFocus = () => fetchMetadata();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchMetadata]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const getStreamUrls = useCallback(() => {
    const rawDirect = config.general.streamUrl || 'https://redradioypc.com:8010/live';
    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isHttpStream = rawDirect.startsWith('http:');
    const hasNonStandardPort = /:\d+/.test(rawDirect) && !rawDirect.includes(':443') && !rawDirect.includes(':80');
    const shouldPreferProxy = (isHttpsPage && isHttpStream) || hasNonStandardPort;

    let directUrl = rawDirect;
    if (/^https?:\/\/[^/]+\/?$/.test(directUrl) && !directUrl.includes('?')) {
      directUrl = `${directUrl}${directUrl.endsWith('/') ? '' : '/'};`;
    }
    const directWithCb = `${directUrl}${directUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
    const proxyUrl = `/api/stream?url=${encodeURIComponent(rawDirect)}&cb=${Date.now()}`;

    return { directUrl: directWithCb, proxyUrl, rawDirect, shouldPreferProxy };
  }, [config.general.streamUrl]);

  useEffect(() => {
    if (!isPlaying || isBuffering || config.appearance.radioPlayer?.showAnalyzer === false) return;

    if (!audioCtxRef.current && audioRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        try {
          audioCtxRef.current = new Ctx();
          analyzerRef.current = audioCtxRef.current.createAnalyser();
          analyzerRef.current.fftSize = 256;
          analyzerRef.current.smoothingTimeConstant = 0.72;
          if (audioRef.current.crossOrigin && !sourceRef.current) {
            sourceRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
            sourceRef.current.connect(analyzerRef.current);
            analyzerRef.current.connect(audioCtxRef.current.destination);
          }
          setAnalyzerNode(analyzerRef.current);
        } catch (_) {}
      }
    }

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, [isPlaying, isBuffering, config.appearance.radioPlayer?.showAnalyzer]);

  const handleStreamRecovery = useCallback(
    (forceSource?: 'direct' | 'proxy') => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (retryCountRef.current < 4) {
        retryCountRef.current += 1;
        setIsReconnecting(true);
        setIsBuffering(true);
        setHasError(false);

        const nextSource: 'direct' | 'proxy' = forceSource || (activeSource === 'direct' ? 'proxy' : 'direct');

        reconnectTimeoutRef.current = setTimeout(() => {
          if (!audioRef.current) return;
          const { directUrl, proxyUrl } = getStreamUrls();
          const targetUrl = nextSource === 'proxy' ? proxyUrl : directUrl;

          setActiveSource(nextSource);
          if (nextSource === 'proxy') {
            audioRef.current.crossOrigin = 'anonymous';
          } else {
            audioRef.current.removeAttribute('crossOrigin');
          }

          audioRef.current.src = targetUrl;
          audioRef.current.load();
          audioRef.current
            .play()
            .then(() => {
              setIsBuffering(false);
              setIsReconnecting(false);
              setHasError(false);
              retryCountRef.current = 0;
            })
            .catch((err) => {
              if (err.name !== 'AbortError') {
                handleStreamRecovery(nextSource === 'direct' ? 'proxy' : 'direct');
              }
            });
        }, 1500);
      } else {
        setIsPlaying(false);
        setIsBuffering(false);
        setIsReconnecting(false);
        setHasError(true);
      }
    },
    [activeSource, getStreamUrls]
  );

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsBuffering(false);
      setIsReconnecting(false);
      setHasError(false);
      retryCountRef.current = 0;
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    } else {
      setHasError(false);
      setIsPlaying(true);
      setIsBuffering(true);
      retryCountRef.current = 0;

      const { directUrl, proxyUrl, shouldPreferProxy } = getStreamUrls();
      const useSource = activeSource || (shouldPreferProxy ? 'proxy' : 'direct');
      const finalUrl = useSource === 'proxy' ? proxyUrl : directUrl;

      if (useSource === 'proxy') {
        audioRef.current.crossOrigin = 'anonymous';
      } else {
        audioRef.current.removeAttribute('crossOrigin');
      }

      audioRef.current.src = finalUrl;
      try {
        await audioRef.current.play();
        setIsBuffering(false);
        setIsReconnecting(false);
        setHasError(false);
        retryCountRef.current = 0;
        recordListenerSession('play');
        fetchMetadata(true);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          handleStreamRecovery(useSource === 'direct' ? 'proxy' : 'direct');
        }
      }
    }
  }, [isPlaying, activeSource, getStreamUrls, fetchMetadata, handleStreamRecovery]);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  const setVolumeLevel = useCallback((val: number) => {
    setVolume(val);
    setIsMuted(val === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(prevVolume > 0 ? prevVolume : 0.85);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      setVolume(0);
    }
  }, [isMuted, prevVolume, volume]);

  const showAutoMetadata = config.appearance.radioPlayer?.enableAutoMetadata !== false;
  const displayTitle = showAutoMetadata ? metadata.title || stationName : stationName;
  const displayArtist = showAutoMetadata ? metadata.artist || defaultSlogan : defaultSlogan;
  const displayCover = resolveDirectImageUrl(config.appearance.radioPlayer?.customCoverUrl) || DEFAULT_COVER;
  const isMusicCover = !!(
    metadata.cover &&
    metadata.cover.startsWith('http') &&
    !metadata.cover.includes('Logo-Buenisima-esfera') &&
    !metadata.cover.includes('i.ibb.co')
  );
  const finalCover = isMusicCover ? metadata.cover : displayCover;

  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const target = e.currentTarget;
      const fallback = displayCover || DEFAULT_COVER;
      if (target.src !== fallback && fallback) {
        target.src = fallback;
      } else if (target.src !== DEFAULT_COVER) {
        target.src = DEFAULT_COVER;
      }
    },
    [displayCover]
  );

  const handleAudioPlaying = () => {
    setIsBuffering(false);
    setIsReconnecting(false);
    setHasError(false);
    retryCountRef.current = 0;
  };

  const handleAudioWaiting = () => {
    if (isPlaying) setIsBuffering(true);
  };

  const handleAudioStalled = () => {
    if (isPlaying && !isReconnecting) {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isPlaying) handleStreamRecovery();
      }, 4500);
    }
  };

  return (
    <RadioAudioContext.Provider
      value={{
        isPlaying,
        isBuffering,
        isReconnecting,
        hasError,
        isLiveConnected,
        isFetchingMetadata,
        volume,
        isMuted,
        analyzerNode,
        metadata,
        stationName,
        defaultSlogan,
        displayTitle,
        displayArtist,
        displayCover,
        finalCover,
        togglePlay,
        setVolumeLevel,
        toggleMute,
        fetchMetadata,
        handleImageError,
      }}
    >
      <audio
        ref={audioRef}
        onPlaying={handleAudioPlaying}
        onWaiting={handleAudioWaiting}
        onStalled={handleAudioStalled}
        onEnded={() => {
          if (isPlaying) handleStreamRecovery();
        }}
        onError={() => {
          if (isPlaying) handleStreamRecovery();
        }}
        preload="none"
      />
      {children}
    </RadioAudioContext.Provider>
  );
};

export const useRadioAudio = (): RadioAudioContextValue => {
  const ctx = useContext(RadioAudioContext);
  if (!ctx) {
    throw new Error('useRadioAudio must be used inside a RadioAudioProvider');
  }
  return ctx;
};
