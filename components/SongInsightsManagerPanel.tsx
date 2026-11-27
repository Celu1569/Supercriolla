import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  Clock,
  ExternalLink,
  HeartHandshake,
  MessageSquareHeart,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Sparkles,
  Store,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { PlayerSponsorMention, SiteConfig, SongInsightsConfig } from '../types';
import { DEFAULT_POSITIVE_MESSAGES, DEFAULT_SONG_INSIGHTS_CONFIG } from '../constants';
import { SongInsightsPanel } from './SongInsightsPanel';

interface SongInsightsManagerPanelProps {
  formData: SiteConfig;
  setFormData: React.Dispatch<React.SetStateAction<SiteConfig>>;
  onSave: () => Promise<void> | void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export const SongInsightsManagerPanel: React.FC<SongInsightsManagerPanelProps> = ({
  formData,
  setFormData,
  onSave,
  saveStatus,
}) => {
  const rp = formData.appearance.radioPlayer;
  const currentConfig: SongInsightsConfig = {
    ...DEFAULT_SONG_INSIGHTS_CONFIG,
    ...(rp?.songInsightsConfig || {}),
    enabled:
      rp?.songInsightsConfig?.enabled !== undefined
        ? rp.songInsightsConfig.enabled
        : rp?.showSongInsights !== false,
  };

  const [testArtist, setTestArtist] = useState('Marc Anthony');
  const [testTitle, setTestTitle] = useState('Vivir Mi Vida');
  const [previewArtist, setPreviewArtist] = useState('Marc Anthony');
  const [previewTitle, setPreviewTitle] = useState('Vivir Mi Vida');
  const [previewVariant, setPreviewVariant] = useState<'default' | 'tv'>('default');

  const [newPositiveMsg, setNewPositiveMsg] = useState('');
  const [newSponsorName, setNewSponsorName] = useState('');
  const [newSponsorMessage, setNewSponsorMessage] = useState('');
  const [newSponsorBadge, setNewSponsorBadge] = useState('Comercio Aliado');
  const [newSponsorCtaLabel, setNewSponsorCtaLabel] = useState('WhatsApp');
  const [newSponsorCtaUrl, setNewSponsorCtaUrl] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2600);
  };

  const updateInsightsConfig = (patch: Partial<SongInsightsConfig>) => {
    setFormData((prev) => {
      const prevRp = prev.appearance.radioPlayer || {
        showAnalyzer: true,
        showMetadata: true,
        showCover: true,
        videoMode: false,
        videoUrl: '',
      };
      const prevCfg: SongInsightsConfig = {
        ...DEFAULT_SONG_INSIGHTS_CONFIG,
        ...(prevRp.songInsightsConfig || {}),
        enabled:
          prevRp.songInsightsConfig?.enabled !== undefined
            ? prevRp.songInsightsConfig.enabled
            : prevRp.showSongInsights !== false,
      };
      const merged: SongInsightsConfig = { ...prevCfg, ...patch };
      return {
        ...prev,
        appearance: {
          ...prev.appearance,
          radioPlayer: {
            ...prevRp,
            showSongInsights: merged.enabled !== false,
            songInsightsConfig: merged,
          },
        },
      };
    });
  };

  const positiveMessages =
    currentConfig.positiveMessages && currentConfig.positiveMessages.length > 0
      ? currentConfig.positiveMessages
      : DEFAULT_POSITIVE_MESSAGES;

  const sponsorMentions = currentConfig.sponsorMentions || [];

  const handleAddPositive = () => {
    const clean = newPositiveMsg.trim();
    if (!clean) return;
    updateInsightsConfig({
      positiveMessages: [...positiveMessages, clean],
    });
    setNewPositiveMsg('');
    flashNotice('Mensaje positivo agregado.');
  };

  const handleUpdatePositive = (idx: number, val: string) => {
    const next = positiveMessages.map((m, i) => (i === idx ? val : m));
    updateInsightsConfig({ positiveMessages: next });
  };

  const handleDeletePositive = (idx: number) => {
    if (positiveMessages.length <= 1) {
      flashNotice('Debe quedar al menos 1 mensaje positivo.');
      return;
    }
    updateInsightsConfig({
      positiveMessages: positiveMessages.filter((_, i) => i !== idx),
    });
  };

  const handleAddSponsor = () => {
    const biz = newSponsorName.trim();
    const msg = newSponsorMessage.trim();
    if (!biz || !msg) {
      flashNotice('Escribe el nombre del comercio y su mensaje promocional.');
      return;
    }

    let finalUrl = newSponsorCtaUrl.trim();
    // Convert plain Venezuelan phone numbers into clickable wa.me links automatically
    if (finalUrl && !finalUrl.startsWith('http') && /^[\d\s+\-()]+$/.test(finalUrl)) {
      const digits = finalUrl.replace(/\D/g, '');
      const normalized = digits.startsWith('0') ? `58${digits.slice(1)}` : digits.startsWith('58') ? digits : `58${digits}`;
      finalUrl = `https://wa.me/${normalized}`;
    }

    const item: PlayerSponsorMention = {
      id: `sp-${uuidv4().slice(0, 8)}`,
      businessName: biz,
      message: msg,
      badgeText: newSponsorBadge.trim() || 'Comercio Aliado',
      ctaLabel: newSponsorCtaLabel.trim() || 'Contactar',
      ctaUrl: finalUrl || undefined,
      active: true,
    };

    updateInsightsConfig({
      enableSponsorMentions: true,
      sponsorMentions: [...sponsorMentions, item],
    });

    setNewSponsorName('');
    setNewSponsorMessage('');
    setNewSponsorCtaUrl('');
    flashNotice(`Comercio "${biz}" agregado al rotador del reproductor.`);
  };

  const handleToggleSponsor = (id: string) => {
    updateInsightsConfig({
      sponsorMentions: sponsorMentions.map((s) =>
        s.id === id ? { ...s, active: !s.active } : s
      ),
    });
  };

  const handleDeleteSponsor = (id: string) => {
    updateInsightsConfig({
      sponsorMentions: sponsorMentions.filter((s) => s.id !== id),
    });
  };

  const handleRunTest = () => {
    setPreviewArtist(testArtist.trim());
    setPreviewTitle(testTitle.trim());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Master Activation Switch */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
            <BookOpen className="text-secondary" size={26} />
            Info Canción, Artista & Comercios en el Player
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Activa y controla todas las funciones del panel central del reproductor: historia musical gratuita (Wikipedia + Catálogo), mensajes positivos y menciones para comerciantes aliados.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => updateInsightsConfig({ enabled: !currentConfig.enabled })}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider border transition-all active:scale-95 ${
              currentConfig.enabled
                ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-900/20'
                : 'bg-red-900/30 border-red-600/60 text-red-300'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                currentConfig.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span>{currentConfig.enabled ? 'Panel Activado en el Player' : 'Panel Desactivado'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSave()}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-primary font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save size={16} />
            <span>
              {saveStatus === 'saving'
                ? 'Guardando...'
                : saveStatus === 'saved'
                ? '¡Guardado!'
                : 'Guardar Cambios'}
            </span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
          <Check size={15} />
          <span>{notice}</span>
        </div>
      )}

      {/* LIVE INTERACTIVE TESTER + PREVIEW */}
      <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 bg-gray-900/90 border-b border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio size={15} className="text-secondary animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
              Vista Previa y Probador en Vivo (Sin Costos ni Cuotas)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={testArtist}
              onChange={(e) => setTestArtist(e.target.value)}
              placeholder="Artista (ej. Karol G)"
              className="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-lg text-xs w-36 sm:w-44 focus:border-secondary outline-none"
            />
            <input
              type="text"
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              placeholder="Canción (ej. Provenza)"
              className="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-lg text-xs w-36 sm:w-44 focus:border-secondary outline-none"
            />
            <button
              type="button"
              onClick={handleRunTest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-primary text-xs font-black hover:brightness-110 transition-all"
            >
              <RefreshCw size={12} />
              <span>Probar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTestArtist('La Radio de la Buena Vibra');
                setTestTitle('BUENÍSIMA 87.7 FM');
                setPreviewArtist('La Radio de la Buena Vibra');
                setPreviewTitle('BUENÍSIMA 87.7 FM');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-[11px] font-bold"
            >
              Probar Sin Canción
            </button>
            <div className="flex items-center bg-gray-950 border border-gray-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setPreviewVariant('default')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  previewVariant === 'default' ? 'bg-secondary text-primary' : 'text-gray-400 hover:text-white'
                }`}
              >
                Player Web
              </button>
              <button
                type="button"
                onClick={() => setPreviewVariant('tv')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  previewVariant === 'tv' ? 'bg-secondary text-primary' : 'text-gray-400 hover:text-white'
                }`}
              >
                Pantalla TV
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-[#0e1526] via-[#080c16] to-[#05070d]">
          {currentConfig.enabled ? (
            <SongInsightsPanel
              variant={previewVariant}
              title={previewTitle}
              artist={previewArtist}
              stationName={formData.general.stationName || 'BUENÍSIMA'}
              defaultSlogan={rp?.slogan || 'La Radio de la Buena Vibra'}
              isPlaying={true}
              insightsConfig={currentConfig}
            />
          ) : (
            <div className="py-5 text-center text-xs text-gray-400 border border-dashed border-gray-700 rounded-xl">
              El panel central está desactivado. Haz clic en <strong>"Panel Desactivado"</strong> arriba para activarlo.
            </div>
          )}
        </div>
      </div>

      {/* CONTROLS GRID: DATA ENGINE + VISIBLE MODULES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Data Source & General Controls */}
        <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Sparkles size={18} className="text-secondary" /> Motor de Información y Ajustes Generales
          </h3>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase mb-2">
              Motor de Consulta Musical
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => updateInsightsConfig({ dataSourceMode: 'free' })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  (currentConfig.dataSourceMode || 'free') === 'free'
                    ? 'bg-emerald-600/15 border-emerald-500 text-white ring-1 ring-emerald-500/40'
                    : 'bg-gray-900/60 border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">
                    100% Gratis: Wikipedia ES/EN + Catálogo Musical
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                    Recomendado · Sin Costo
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Funciona siempre sin API keys, sin pagos ni bloqueos de cuota (429). Obtiene biografías, historia, álbum, año de lanzamiento y curiosidades reales.
                </p>
              </button>

              <button
                type="button"
                onClick={() => updateInsightsConfig({ dataSourceMode: 'gemini' })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  currentConfig.dataSourceMode === 'gemini'
                    ? 'bg-secondary/15 border-secondary text-white ring-1 ring-secondary/40'
                    : 'bg-gray-900/60 border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Gemini IA con Búsqueda Web</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-300 text-[10px] font-bold uppercase">
                    Requiere cuota API
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Úsalo solo si dispones de una clave Gemini API con cuota activa en Settings &gt; Secrets.
                </p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase mb-1.5">
              Título del Encabezado del Panel
            </label>
            <input
              type="text"
              value={currentConfig.panelTitle || ''}
              onChange={(e) => updateInsightsConfig({ panelTitle: e.target.value })}
              placeholder="Historia & Buena Vibra"
              className="w-full bg-gray-900 border border-gray-700 text-white px-3.5 py-2.5 rounded-xl text-sm focus:border-secondary outline-none"
            />
          </div>

          <div className="pt-2 border-t border-gray-700/70 space-y-3">
            <div className="flex justify-between text-xs font-bold text-gray-300">
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-secondary" /> Tiempo de rotación entre mensajes/pestañas
              </span>
              <span className="text-secondary font-mono">{currentConfig.rotationSeconds || 10} seg</span>
            </div>
            <input
              type="range"
              min={4}
              max={30}
              step={1}
              value={currentConfig.rotationSeconds || 10}
              onChange={(e) =>
                updateInsightsConfig({ rotationSeconds: parseInt(e.target.value, 10) })
              }
              className="w-full h-1.5 bg-gray-700 rounded-full accent-secondary cursor-pointer"
            />
          </div>
        </div>

        {/* Right: Granular Toggle Switches */}
        <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <UserCheck size={18} className="text-secondary" /> Control de Funciones Visibles
          </h3>

          <div className="space-y-3">
            {[
              {
                key: 'showArtistInfo' as const,
                title: 'Biografía / Datos del Artista',
                desc: 'Muestra origen, estilo musical y trayectoria verificada del cantante o banda.',
              },
              {
                key: 'showSongStory' as const,
                title: 'Historia, Álbum y Año de la Canción',
                desc: 'Muestra historia del tema, disco al que pertenece, género y año de estreno.',
              },
              {
                key: 'showAnecdotes' as const,
                title: 'Anécdotas y Datos Curiosos',
                desc: 'Muestra hitos, duración oficial o curiosidades musicales relacionadas.',
              },
              {
                key: 'showSources' as const,
                title: 'Mostrar Enlaces de Fuente (Wikipedia)',
                desc: 'Muestra el enlace directo al artículo consultado para mayor credibilidad.',
              },
              {
                key: 'autoRotateTabs' as const,
                title: 'Rotación Automática de Contenido',
                desc: 'Alterna automáticamente entre historia, artista, anécdotas y comercios aliados (tanto en Web como en Pantalla TV).',
              },
              {
                key: 'allowListenerToggle' as const,
                title: 'Botón de Ocultar / Mostrar para el Oyente (Web)',
                desc: 'Permite al visitante minimizar el panel en la web (en Pantalla TV siempre permanece visible).',
              },
            ].map((opt) => {
              const checked = currentConfig[opt.key] !== false;
              return (
                <label
                  key={opt.key}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-900/60 border border-gray-700/70 hover:border-gray-500 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => updateInsightsConfig({ [opt.key]: e.target.checked })}
                    className="form-checkbox h-5 w-5 text-secondary rounded border-gray-600 bg-gray-800 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-bold text-white block">{opt.title}</span>
                    <span className="text-[11px] text-gray-400">{opt.desc}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* MERCHANT ENGAGEMENT / SPONSOR MENTIONS (MONETIZATION HOOK) */}
      <div className="bg-gradient-to-br from-emerald-950/40 via-gray-900 to-gray-900 border border-emerald-600/35 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <Store size={20} className="text-emerald-400" />
              Menciones para Comercios y Patrocinantes dentro del Player
            </h3>
            <p className="text-xs text-gray-300 mt-1 max-w-3xl">
              Estrategia gratuita para atraer comerciantes: dales unos días de prueba gratis mostrando su negocio y botón de WhatsApp justo dentro del reproductor junto a la música que suena, para que comprueben el impacto en vivo y se conviertan en anunciantes de la radio.
            </p>
          </div>

          <label className="flex items-center gap-2.5 bg-gray-950/80 border border-emerald-500/40 px-4 py-2.5 rounded-xl cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={currentConfig.enableSponsorMentions || false}
              onChange={(e) => updateInsightsConfig({ enableSponsorMentions: e.target.checked })}
              className="form-checkbox h-5 w-5 text-emerald-400 rounded border-gray-600 bg-gray-900"
            />
            <span className="text-xs font-black uppercase text-emerald-300">
              Activar Menciones Comerciales
            </span>
          </label>
        </div>

        {/* Frequency selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              id: 'interleave' as const,
              title: 'Intercalado con la Música (Recomendado)',
              desc: 'Alterna las menciones comerciales con los datos de cada canción y también cuando no hay ficha disponible.',
            },
            {
              id: 'fallback_only' as const,
              title: 'Solo en Pausas / Sin Ficha Musical',
              desc: 'Se muestra alternando con los mensajes positivos cuando no hay historia de canción.',
            },
            {
              id: 'sponsors_only' as const,
              title: 'Modo Vitrina Comercial Continua',
              desc: 'Muestra permanentemente tus comercios aliados en ese espacio del reproductor.',
            },
          ].map((freq) => {
            const active = (currentConfig.sponsorFrequency || 'interleave') === freq.id;
            return (
              <button
                key={freq.id}
                type="button"
                onClick={() => updateInsightsConfig({ sponsorFrequency: freq.id })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  active
                    ? 'bg-emerald-500/15 border-emerald-400 text-white'
                    : 'bg-gray-900/70 border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="font-bold text-xs text-white">{freq.title}</div>
                <div className="text-[11px] text-gray-400 mt-1">{freq.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Add new sponsor form */}
        <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
            <HeartHandshake size={14} /> Agregar Comercio / Anunciante al Reproductor
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={newSponsorName}
              onChange={(e) => setNewSponsorName(e.target.value)}
              placeholder="Nombre del comercio (ej. Bodegón La Central)"
              className="bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-xl text-xs focus:border-emerald-400 outline-none"
            />
            <input
              type="text"
              value={newSponsorBadge}
              onChange={(e) => setNewSponsorBadge(e.target.value)}
              placeholder="Etiqueta (ej. Aliado / Oferta Hoy)"
              className="bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-xl text-xs focus:border-emerald-400 outline-none"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newSponsorCtaLabel}
                onChange={(e) => setNewSponsorCtaLabel(e.target.value)}
                placeholder="Botón (WhatsApp)"
                className="w-28 bg-gray-900 border border-gray-700 text-white px-2.5 py-2 rounded-xl text-xs focus:border-emerald-400 outline-none"
              />
              <input
                type="text"
                value={newSponsorCtaUrl}
                onChange={(e) => setNewSponsorCtaUrl(e.target.value)}
                placeholder="Teléfono WhatsApp o URL Instagram"
                className="flex-1 bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-xl text-xs focus:border-emerald-400 outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newSponsorMessage}
              onChange={(e) => setNewSponsorMessage(e.target.value)}
              placeholder="Texto corto atractivo (ej. ¡20% de descuento en repuestos mencionando a Buenísimas!)"
              className="flex-1 bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-xl text-xs focus:border-emerald-400 outline-none"
            />
            <button
              type="button"
              onClick={handleAddSponsor}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all active:scale-95"
            >
              <Plus size={14} />
              <span>Agregar Comercio</span>
            </button>
          </div>
        </div>

        {/* List of saved sponsors */}
        {sponsorMentions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sponsorMentions.map((sp) => (
              <div
                key={sp.id}
                className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                  sp.active
                    ? 'bg-gray-900/90 border-emerald-500/40'
                    : 'bg-gray-900/40 border-gray-800 opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-emerald-300 uppercase">
                      {sp.badgeText || 'Aliado'}
                    </span>
                    <span className="text-sm font-bold text-white truncate">{sp.businessName}</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{sp.message}</p>
                  {sp.ctaUrl && (
                    <a
                      href={sp.ctaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                    >
                      <span>{sp.ctaLabel || 'Ver enlace'}</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleSponsor(sp.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                      sp.active
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    {sp.active ? 'Activo' : 'Pausado'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSponsor(sp.id)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                    title="Eliminar comercio"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Aún no has agregado menciones de comercios. Agrega un negocio de prueba arriba para mostrarle a los comerciantes cómo se ve su publicidad en vivo en tu radio.
          </p>
        )}
      </div>

      {/* POSITIVE MESSAGES MANAGER */}
      <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <MessageSquareHeart size={18} className="text-secondary" />
              Mensajes Positivos de Disfrute ({positiveMessages.length})
            </h3>
            <p className="text-xs text-gray-400">
              Se muestran automáticamente cuando no hay información de la canción o cuando suena la identificación de la emisora.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              updateInsightsConfig({ positiveMessages: [...DEFAULT_POSITIVE_MESSAGES] });
              flashNotice('Mensajes positivos por defecto restaurados.');
            }}
            className="text-xs font-bold text-gray-300 hover:text-white px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700"
          >
            Restaurar Predeterminados
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newPositiveMsg}
            onChange={(e) => setNewPositiveMsg(e.target.value)}
            placeholder="Escribe un nuevo mensaje positivo para tus oyentes (usa BUENÍSIMA o {station})..."
            className="flex-1 bg-gray-900 border border-gray-700 text-white px-3.5 py-2 rounded-xl text-xs focus:border-secondary outline-none"
          />
          <button
            type="button"
            onClick={handleAddPositive}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-primary font-black text-xs hover:brightness-110 transition-all"
          >
            <Plus size={14} />
            <span>Agregar</span>
          </button>
        </div>

        <div className="space-y-2">
          {positiveMessages.map((msg, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={msg}
                onChange={(e) => handleUpdatePositive(idx, e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 text-gray-200 px-3 py-2 rounded-xl text-xs focus:border-secondary outline-none"
              />
              <button
                type="button"
                onClick={() => handleDeletePositive(idx)}
                className="p-2 rounded-xl bg-gray-900 border border-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                title="Eliminar mensaje"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
