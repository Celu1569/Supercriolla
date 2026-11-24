import React, { useState } from 'react';
import { Music, Sparkles, CheckCircle2, MessageCircle, Heart, User, MapPin } from 'lucide-react';
import { SongRequestConfig } from '../types';
import { recordSongRequestEvent } from '../utils/listenerAnalytics';

interface SongRequestFormProps {
  whatsappNumber?: string;
  songRequestConfig?: SongRequestConfig;
  compact?: boolean;
  currentSong?: string;
  onSuccess?: () => void;
  className?: string;
}

export const SongRequestForm: React.FC<SongRequestFormProps> = ({
  whatsappNumber = '0424 1555789',
  songRequestConfig,
  compact = false,
  currentSong,
  onSuccess,
  className = ''
}) => {
  const [listenerName, setListenerName] = useState('');
  const [listenerLocation, setListenerLocation] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [dedication, setDedication] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);

  const effectivePhone = songRequestConfig?.whatsappNumber || whatsappNumber;
  const effectiveTitle = songRequestConfig?.title || 'Pide tu Canción';
  const effectiveSubtitle = songRequestConfig?.subtitle || 'Directo al WhatsApp:';
  const showLocationField = songRequestConfig?.showLocationField !== false;
  const requireLocation = Boolean(songRequestConfig?.requireLocation);
  const locationLabel = songRequestConfig?.locationLabel || 'Lugar / Zona / Municipio';
  const locationPlaceholder = songRequestConfig?.locationPlaceholder || 'Ej. Valencia, Naguanagua, San Diego...';
  const suggestedZones = (songRequestConfig?.suggestedLocations || '')
    .split(',')
    .map((z) => z.trim())
    .filter(Boolean)
    .slice(0, 8);

  // Normalize phone for WhatsApp API
  // 0424 1555789 -> Venezuela prefix 58: 584241555789
  const cleanPhone = effectivePhone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('58')
    ? cleanPhone
    : cleanPhone.startsWith('0')
      ? `58${cleanPhone.substring(1)}`
      : cleanPhone.length === 10 && cleanPhone.startsWith('424')
        ? `58${cleanPhone}`
        : cleanPhone || '584241555789';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!songTitle.trim()) return;
    if (showLocationField && requireLocation && !listenerLocation.trim()) return;

    const nameText = listenerName.trim() || 'Oyente en Sintonía';
    const locationText = listenerLocation.trim();

    const messageLines = [
      '🎶 *¡HOLA BUENÍSIMA RADIO!* 🎶',
      '📻 *Quiero pedir una canción para escuchar en vivo:*',
      '',
      `👤 *Nombre:* ${nameText}`,
      ...(showLocationField && locationText ? [`📍 *Zona / Municipio:* ${locationText}`] : []),
      `🎵 *Canción y Artista:* ${songTitle.trim()}`,
      dedication.trim() ? `💌 *Dedicatoria:* ${dedication.trim()}` : '✨ *Mensaje:* ¡Poniéndole buena vibra al día!',
      '',
      '¡Muchas gracias por la excelente programación!'
    ];

    const encodedText = encodeURIComponent(messageLines.join('\n'));
    const waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;

    // Open WhatsApp in new window/tab or mobile app
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    recordSongRequestEvent();

    setSentSuccess(true);
    if (onSuccess) onSuccess();

    setTimeout(() => {
      setSentSuccess(false);
      setSongTitle('');
      setDedication('');
    }, 4000);
  };

  const handleUseCurrent = () => {
    if (currentSong && currentSong !== 'Sintonizando...' && currentSong !== 'BUENÍSIMA 87.7 FM') {
      setSongTitle(currentSong);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1322] via-[#090d16] to-[#04060a] border border-amber-500/20 shadow-2xl ${compact ? 'p-4' : 'p-4 sm:p-5'} text-white ${className}`}>
      {/* Decorative Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center text-white shadow-lg shadow-emerald-900/40 flex-shrink-0">
            <MessageCircle size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                <span>{effectiveTitle}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider">
                  En Vivo
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-gray-400 flex items-center gap-1">
              <span>{effectiveSubtitle}</span>
              <strong className="text-emerald-400 font-mono tracking-wide">{effectivePhone}</strong>
            </p>
          </div>
        </div>

        {currentSong && currentSong.length > 3 && currentSong !== 'Sintonizando...' && (
          <button
            type="button"
            onClick={handleUseCurrent}
            title="Copiar canción que suena ahora"
            className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-1 rounded-lg transition-colors"
          >
            <Sparkles size={11} />
            <span>Usar que suena</span>
          </button>
        )}
      </div>

      {sentSuccess ? (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
            <CheckCircle2 size={28} />
          </div>
          <h4 className="text-sm font-bold text-white">¡Abriendo WhatsApp!</h4>
          <p className="text-xs text-gray-300 max-w-xs">
            Se ha preparado tu pedido para enviarlo al equipo de cabina ({effectivePhone}).
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2.5 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1 flex items-center gap-1">
                <User size={11} className="text-amber-400" />
                <span>Tu Nombre / Apodo</span>
              </label>
              <input
                type="text"
                value={listenerName}
                onChange={(e) => setListenerName(e.target.value)}
                placeholder="Ej. Carlos Pérez"
                className="w-full bg-white/5 border border-white/10 focus:border-amber-400/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-all"
                maxLength={60}
              />
            </div>

            {showLocationField ? (
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1 flex items-center gap-1">
                  <MapPin size={11} className="text-emerald-400" />
                  <span className="truncate">{locationLabel}</span>
                  {requireLocation && <span className="text-red-400">*</span>}
                </label>
                <input
                  type="text"
                  required={requireLocation}
                  value={listenerLocation}
                  onChange={(e) => setListenerLocation(e.target.value)}
                  placeholder={locationPlaceholder}
                  className="w-full bg-white/5 border border-white/10 focus:border-emerald-400/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-all"
                  maxLength={80}
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1 flex items-center gap-1">
                  <Music size={11} className="text-amber-400" />
                  <span>Canción y Artista <span className="text-red-400">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  placeholder="Ej. Juanes - La Camisa Negra"
                  className="w-full bg-white/5 border border-white/10 focus:border-amber-400/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-all"
                  maxLength={100}
                />
              </div>
            )}
          </div>

          {showLocationField && suggestedZones.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestedZones.map((zone) => {
                const isSelected = listenerLocation.trim().toLowerCase() === zone.toLowerCase();
                return (
                  <button
                    key={zone}
                    type="button"
                    onClick={() => setListenerLocation(zone)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                      isSelected
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/25'
                    }`}
                  >
                    {zone}
                  </button>
                );
              })}
            </div>
          )}

          {showLocationField && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1 flex items-center gap-1">
                <Music size={11} className="text-amber-400" />
                <span>Canción y Artista <span className="text-red-400">*</span></span>
              </label>
              <input
                type="text"
                required
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="Ej. Juanes - La Camisa Negra"
                className="w-full bg-white/5 border border-white/10 focus:border-amber-400/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-all"
                maxLength={100}
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-gray-300 mb-1 flex items-center gap-1">
              <Heart size={11} className="text-rose-400" />
              <span>Dedicatoria o Saludo (Opcional)</span>
            </label>
            <input
              type="text"
              value={dedication}
              onChange={(e) => setDedication(e.target.value)}
              placeholder="Ej. Un saludo especial para la familia Pérez en sintonía"
              className="w-full bg-white/5 border border-white/10 focus:border-amber-400/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-all"
              maxLength={150}
            />
          </div>

          <button
            type="submit"
            className="w-full mt-1 bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 hover:from-emerald-500 hover:to-green-400 text-white font-black text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transform active:scale-98 transition-all group"
          >
            <MessageCircle size={16} className="fill-current text-white group-hover:scale-110 transition-transform" />
            <span>Enviar Pedido a WhatsApp</span>
          </button>
        </form>
      )}
    </div>
  );
};
