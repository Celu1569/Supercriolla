import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, BellRing, X, ExternalLink, Sparkles, Radio, Gift, Megaphone, Newspaper, CheckCircle2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useConfig } from '../context/ConfigContext';
import { LivePushNotification, PushCategory } from '../types';
import { resolveDirectImageUrl } from '../utils/imageUrl';

const LAST_SEEN_PUSH_KEY = 'buenisima_last_seen_push_id';
const PROMPT_DISMISSED_AT_KEY = 'buenisima_push_prompt_dismissed_at';

interface LivePushManagerProps {
  onNavigateSection?: (sectionId: string) => void;
}

const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const notes = [587.33, 880]; // D5 -> A5 warm radio chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.13);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.13 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.13 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.13);
      osc.stop(now + idx * 0.13 + 0.38);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
  } catch {
    // Ignore audio context blocks before user gesture
  }
};

const getCategoryMeta = (category?: PushCategory, customBadge?: string) => {
  switch (category) {
    case 'contest':
      return {
        label: customBadge || 'CONCURSO',
        icon: Gift,
        accent: 'from-amber-500 to-orange-500',
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
        ringClass: 'border-amber-500/40'
      };
    case 'promo':
      return {
        label: customBadge || 'PROMO',
        icon: Sparkles,
        accent: 'from-emerald-500 to-teal-500',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
        ringClass: 'border-emerald-500/40'
      };
    case 'news':
      return {
        label: customBadge || 'NOTICIA',
        icon: Newspaper,
        accent: 'from-sky-500 to-blue-600',
        badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
        ringClass: 'border-sky-500/40'
      };
    case 'alert':
      return {
        label: customBadge || 'AVISO',
        icon: Megaphone,
        accent: 'from-violet-500 to-fuchsia-600',
        badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-400/40',
        ringClass: 'border-violet-500/40'
      };
    case 'live':
    default:
      return {
        label: customBadge || 'EN VIVO',
        icon: Radio,
        accent: 'from-rose-600 to-red-500',
        badgeClass: 'bg-red-500/20 text-red-300 border-red-400/40',
        ringClass: 'border-red-500/40'
      };
  }
};

export const LivePushManager: React.FC<LivePushManagerProps> = ({ onNavigateSection }) => {
  const { config } = useConfig();
  const pushConfig = config.pushNotifications;
  const isEnabled = pushConfig?.enabled !== false;

  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const [promptDismissed, setPromptDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const ts = localStorage.getItem(PROMPT_DISMISSED_AT_KEY);
      if (!ts) return false;
      const ageMs = Date.now() - Number(ts);
      return ageMs < 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });

  const [visibleToast, setVisibleToast] = useState<LivePushNotification | null>(null);
  const [optInSuccessBanner, setOptInSuccessBanner] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const triggeredIdsRef = useRef<Set<string>>(new Set());
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerNotification = useCallback(
    (incoming: LivePushNotification | null | undefined) => {
      if (!isEnabled || !incoming || !incoming.active || !incoming.id || !incoming.title) return;

      // Prevent duplicate triggers for the same push ID in this browser/session
      if (triggeredIdsRef.current.has(incoming.id)) return;
      try {
        const lastSeenId = localStorage.getItem(LAST_SEEN_PUSH_KEY);
        if (lastSeenId === incoming.id) {
          triggeredIdsRef.current.add(incoming.id);
          return;
        }
      } catch {
        // Ignore storage errors
      }

      // Skip notifications older than 24h on initial page load
      if (incoming.sentAt) {
        const ageMs = Date.now() - new Date(incoming.sentAt).getTime();
        if (!Number.isNaN(ageMs) && ageMs > 24 * 60 * 60 * 1000) {
          triggeredIdsRef.current.add(incoming.id);
          return;
        }
      }

      triggeredIdsRef.current.add(incoming.id);
      try {
        localStorage.setItem(LAST_SEEN_PUSH_KEY, incoming.id);
      } catch {
        // Ignore
      }

      setVisibleToast(incoming);

      if (incoming.playSound !== false && pushConfig?.playSound !== false) {
        playNotificationChime();
      }

      // Fire real Browser OS Notification when permission is granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const iconUrl = resolveDirectImageUrl(
            incoming.imageUrl || pushConfig?.defaultIconUrl || config.navigation.logoUrl || ''
          );
          const nativeNotif = new Notification(incoming.title, {
            body: incoming.message,
            icon: iconUrl || undefined,
            badge: iconUrl || undefined,
            tag: incoming.id,
          });
          nativeNotif.onclick = () => {
            window.focus();
            if (incoming.actionUrl) {
              if (incoming.actionUrl.startsWith('#') && onNavigateSection) {
                onNavigateSection(incoming.actionUrl.replace('#', ''));
              } else {
                window.open(incoming.actionUrl, '_blank', 'noopener,noreferrer');
              }
            }
            nativeNotif.close();
          };
        } catch (err) {
          console.warn('Browser Notification error:', err);
        }
      }
    },
    [isEnabled, pushConfig?.playSound, pushConfig?.defaultIconUrl, config.navigation.logoUrl, onNavigateSection]
  );

  // 1. Watch Firestore realtime config.pushNotifications.activeNotification
  useEffect(() => {
    if (!isEnabled) {
      setVisibleToast(null);
      return;
    }
    if (pushConfig?.activeNotification) {
      triggerNotification(pushConfig.activeNotification);
    }
  }, [isEnabled, pushConfig?.activeNotification, triggerNotification]);

  // 2. Listen to Socket.IO real-time relay (for instant live cabin alerts)
  useEffect(() => {
    if (!isEnabled) return;
    let socket: Socket | null = null;
    try {
      socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 3000,
        reconnectionAttempts: 5
      });

      socket.on('connect', () => {
        socket?.emit('get-live-push');
      });

      socket.on('live-push', (payload: LivePushNotification) => {
        triggerNotification(payload);
      });

      socket.on('live-push-cleared', () => {
        setVisibleToast(null);
      });
    } catch {
      // Static fallback gracefully uses Firestore onSnapshot
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [isEnabled, triggerNotification]);

  // 3. Auto-hide timer for active in-page toast (pauses on hover)
  useEffect(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    if (!visibleToast || isHovered) return;

    const seconds = visibleToast.durationSeconds || pushConfig?.defaultDurationSeconds || 18;
    autoHideTimerRef.current = setTimeout(() => {
      setVisibleToast(null);
    }, Math.max(5, seconds) * 1000);

    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [visibleToast, isHovered, pushConfig?.defaultDurationSeconds]);

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setPromptDismissed(true);
        setOptInSuccessBanner(true);
        playNotificationChime();
        try {
          const icon = resolveDirectImageUrl(pushConfig?.defaultIconUrl || config.navigation.logoUrl || '');
          new Notification(config.general.stationName || 'Buenísima 87.7 FM', {
            body: '¡Alertas activadas! Recibirás estrenos, concursos y avisos en vivo.',
            icon: icon || undefined,
          });
        } catch {
          // Ignore
        }
        setTimeout(() => setOptInSuccessBanner(false), 4500);
      } else if (result === 'denied') {
        setPromptDismissed(true);
      }
    } catch {
      // Ignore permission request failure
    }
  };

  const handleDismissPrompt = () => {
    setPromptDismissed(true);
    try {
      localStorage.setItem(PROMPT_DISMISSED_AT_KEY, String(Date.now()));
    } catch {
      // Ignore
    }
  };

  const handleActionClick = (url?: string) => {
    if (!url) return;
    if (url.startsWith('#')) {
      const targetId = url.replace('#', '');
      if (onNavigateSection) {
        onNavigateSection(targetId);
      } else {
        const el = document.getElementById(targetId);
        el?.scrollIntoView({ behavior: 'smooth' });
      }
      setVisibleToast(null);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isEnabled) return null;

  const showOptInCard =
    pushConfig?.showOptInPrompt !== false &&
    permission === 'default' &&
    !promptDismissed;

  const showFloatingBell =
    !showOptInCard &&
    !visibleToast &&
    (permission === 'default' || Boolean(pushConfig?.activeNotification?.active));

  const categoryMeta = getCategoryMeta(visibleToast?.category, visibleToast?.badgeText);
  const CategoryIcon = categoryMeta.icon;

  return (
    <>
      {/* 1. Live In-Page Push Toast Card (Bottom Right) */}
      {visibleToast && (
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[95] w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-[#0b1120]/95 backdrop-blur-xl border ${categoryMeta.ringClass} shadow-[0_20px_50px_rgba(0,0,0,0.65)] text-white overflow-hidden animate-fade-in-up`}
          role="status"
          aria-live="polite"
        >
          <div className={`h-1 w-full bg-gradient-to-r ${categoryMeta.accent}`} />
          <div className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${categoryMeta.badgeClass}`}>
                <CategoryIcon size={11} className={visibleToast.category === 'live' ? 'animate-pulse' : ''} />
                <span>{categoryMeta.label}</span>
              </span>
              <button
                type="button"
                onClick={() => setVisibleToast(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Cerrar notificación"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex items-start gap-3">
              {visibleToast.imageUrl ? (
                <img
                  src={resolveDirectImageUrl(visibleToast.imageUrl)}
                  alt={visibleToast.title}
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-white/10"
                />
              ) : (
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${categoryMeta.accent} flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <BellRing size={20} className="text-white" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h4 className="font-black text-sm sm:text-base text-white leading-snug mb-1">
                  {visibleToast.title}
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                  {visibleToast.message}
                </p>
              </div>
            </div>

            {visibleToast.actionUrl && (
              <div className="mt-3 pt-2.5 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleActionClick(visibleToast.actionUrl)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${categoryMeta.accent} hover:brightness-110 transition-all shadow-md`}
                >
                  <span>{visibleToast.actionLabel || 'Ver Ahora'}</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Opt-in Confirmation Toast */}
      {optInSuccessBanner && (
        <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-[95] bg-emerald-950/95 border border-emerald-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 max-w-xs animate-fade-in-up">
          <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" />
          <p className="text-xs font-medium">
            ¡Alertas activadas! Ya estás conectado a nuestras notificaciones en vivo.
          </p>
        </div>
      )}

      {/* 3. Visitor Opt-In Prompt Banner (Bottom Left) */}
      {showOptInCard && (
        <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-[90] w-[calc(100vw-2rem)] max-w-xs rounded-2xl bg-[#0d1424]/95 backdrop-blur-xl border border-amber-500/30 shadow-2xl p-4 text-white animate-fade-in-up">
          <button
            type="button"
            onClick={handleDismissPrompt}
            className="absolute top-2.5 right-2.5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Cerrar aviso"
          >
            <X size={14} />
          </button>

          <div className="flex items-start gap-3 pr-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-900/30">
              <BellRing size={19} className="text-white animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white leading-tight">
                {pushConfig?.optInTitle || '¡Activa las Alertas En Vivo!'}
              </h4>
              <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                {pushConfig?.optInSubtitle || 'Entérate al instante de estrenos, concursos, saludos y programas en vivo.'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleRequestPermission}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs py-2 px-3 rounded-xl transition-all shadow-md"
            >
              {pushConfig?.optInButtonText || 'Activar Alertas'}
            </button>
            <button
              type="button"
              onClick={handleDismissPrompt}
              className="px-3 py-2 text-[11px] font-semibold text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
      )}

      {/* 4. Discrete Floating Bell to re-open Active Push or Enable Alerts */}
      {showFloatingBell && (
        <button
          type="button"
          onClick={() => {
            if (pushConfig?.activeNotification?.active && !visibleToast) {
              setVisibleToast(pushConfig.activeNotification);
            } else if (permission === 'default') {
              handleRequestPermission();
            }
          }}
          title={
            pushConfig?.activeNotification?.active
              ? 'Ver anuncio en vivo'
              : 'Activar alertas en vivo'
          }
          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-[88] w-11 h-11 rounded-full bg-[#0d1424]/90 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/40 shadow-xl flex items-center justify-center transition-all hover:scale-105"
        >
          <Bell size={19} />
          {pushConfig?.activeNotification?.active && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-[#0d1424] animate-ping" />
          )}
        </button>
      )}
    </>
  );
};
