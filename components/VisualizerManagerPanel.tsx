import React, { useState } from 'react';
import {
  Activity,
  Check,
  Palette,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Waves,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { SiteConfig, VisualizerMode, VisualizerProfile } from '../types';
import { DEFAULT_VISUALIZER_PROFILE, DEFAULT_VISUALIZER_PROFILES } from '../constants';
import { AudioVisualizerCanvas } from './AudioVisualizerCanvas';

interface VisualizerManagerPanelProps {
  formData: SiteConfig;
  setFormData: React.Dispatch<React.SetStateAction<SiteConfig>>;
  onSave: () => Promise<void> | void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

const VISUALIZER_MODES: { id: VisualizerMode; label: string; desc: string }[] = [
  {
    id: 'continuous_line',
    label: 'Línea Corrida Suave',
    desc: 'Una línea fluida continua sin divisiones con degradado de color en todo el ancho.',
  },
  {
    id: 'smooth_bars',
    label: 'Barras Lisas Continuas',
    desc: 'Barras verticales sólidas sin cortes horizontales y pico superior marcado.',
  },
  {
    id: 'mirror_wave',
    label: 'Onda Doble Espejo',
    desc: 'Espectro simétrico que se expande hacia arriba y abajo desde el eje central.',
  },
  {
    id: 'neon_glow',
    label: 'Pulso Neón Brillante',
    desc: 'Línea continua con resplandor luminoso en picos altos y relleno translúcido.',
  },
  {
    id: 'classic_vu',
    label: 'VU Segmentado Clásico',
    desc: 'Estilo matriz LED clásica dividida por bloques horizontales.',
  },
];

const COLOR_PALETTES: { name: string; base: string; mid: string; peak: string }[] = [
  { name: 'Clásico Estudio', base: '#22c55e', mid: '#facc15', peak: '#ef4444' },
  { name: 'Buenísima Dorado', base: '#10b981', mid: '#fbbf24', peak: '#ef4444' },
  { name: 'Fuego Tropical', base: '#f59e0b', mid: '#f97316', peak: '#dc2626' },
  { name: 'Neón Cibernético', base: '#06b6d4', mid: '#a855f7', peak: '#f43f5e' },
  { name: 'Océano Eléctrico', base: '#0ea5e9', mid: '#38bdf8', peak: '#facc15' },
  { name: 'Navidad Festiva', base: '#16a34a', mid: '#fbbf24', peak: '#dc2626' },
];

export const VisualizerManagerPanel: React.FC<VisualizerManagerPanelProps> = ({
  formData,
  setFormData,
  onSave,
  saveStatus,
}) => {
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const [newProfileName, setNewProfileName] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const rp = formData.appearance.radioPlayer;
  const activeVisualizer: VisualizerProfile = {
    ...DEFAULT_VISUALIZER_PROFILE,
    ...(rp?.visualizer || {}),
  };

  const savedProfiles: VisualizerProfile[] =
    rp?.visualizerProfiles && rp.visualizerProfiles.length > 0
      ? rp.visualizerProfiles
      : DEFAULT_VISUALIZER_PROFILES;

  const activeProfileId = rp?.activeVisualizerProfileId || activeVisualizer.id;
  const showAnalyzer = rp?.showAnalyzer !== false;

  const showNotice = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 2600);
  };

  const updateActiveVisualizer = (patch: Partial<VisualizerProfile>) => {
    setFormData((prev) => {
      const current = {
        ...DEFAULT_VISUALIZER_PROFILE,
        ...(prev.appearance.radioPlayer?.visualizer || {}),
      };
      const updated = { ...current, ...patch };
      return {
        ...prev,
        appearance: {
          ...prev.appearance,
          radioPlayer: {
            ...(prev.appearance.radioPlayer || {
              showAnalyzer: true,
              showMetadata: true,
              showCover: true,
              videoMode: false,
              videoUrl: '',
            }),
            visualizer: updated,
          },
        },
      };
    });
  };

  const handleSelectProfile = (profile: VisualizerProfile) => {
    setFormData((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        radioPlayer: {
          ...(prev.appearance.radioPlayer || {
            showAnalyzer: true,
            showMetadata: true,
            showCover: true,
            videoMode: false,
            videoUrl: '',
          }),
          visualizer: { ...profile },
          activeVisualizerProfileId: profile.id,
        },
      },
    }));
    showNotice(`Perfil "${profile.name}" activado en el reproductor.`);
  };

  const handleSaveAsNewProfile = () => {
    const cleanName = newProfileName.trim() || `Perfil ${savedProfiles.length + 1}`;
    const newProfile: VisualizerProfile = {
      ...activeVisualizer,
      id: `vis-${uuidv4().slice(0, 8)}`,
      name: cleanName,
    };

    setFormData((prev) => {
      const existing =
        prev.appearance.radioPlayer?.visualizerProfiles &&
        prev.appearance.radioPlayer.visualizerProfiles.length > 0
          ? prev.appearance.radioPlayer.visualizerProfiles
          : DEFAULT_VISUALIZER_PROFILES;
      return {
        ...prev,
        appearance: {
          ...prev.appearance,
          radioPlayer: {
            ...(prev.appearance.radioPlayer || {
              showAnalyzer: true,
              showMetadata: true,
              showCover: true,
              videoMode: false,
              videoUrl: '',
            }),
            visualizer: newProfile,
            visualizerProfiles: [...existing, newProfile],
            activeVisualizerProfileId: newProfile.id,
          },
        },
      };
    });
    setNewProfileName('');
    showNotice(`Nuevo perfil "${cleanName}" guardado en la lista.`);
  };

  const handleOverwriteActiveProfile = () => {
    const targetExists = savedProfiles.some((p) => p.id === activeProfileId);
    if (!targetExists) {
      handleSaveAsNewProfile();
      return;
    }

    setFormData((prev) => {
      const existing =
        prev.appearance.radioPlayer?.visualizerProfiles &&
        prev.appearance.radioPlayer.visualizerProfiles.length > 0
          ? prev.appearance.radioPlayer.visualizerProfiles
          : DEFAULT_VISUALIZER_PROFILES;
      const updatedList = existing.map((p) =>
        p.id === activeProfileId ? { ...activeVisualizer, id: p.id, name: p.name } : p
      );
      return {
        ...prev,
        appearance: {
          ...prev.appearance,
          radioPlayer: {
            ...(prev.appearance.radioPlayer || {
              showAnalyzer: true,
              showMetadata: true,
              showCover: true,
              videoMode: false,
              videoUrl: '',
            }),
            visualizerProfiles: updatedList,
          },
        },
      };
    });
    showNotice('Perfil actual actualizado con los nuevos colores y ajustes.');
  };

  const handleDeleteProfile = (id: string) => {
    if (savedProfiles.length <= 1) {
      showNotice('Debe quedar al menos 1 perfil guardado.');
      return;
    }
    const remaining = savedProfiles.filter((p) => p.id !== id);
    const nextActive = id === activeProfileId ? remaining[0] : activeVisualizer;

    setFormData((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        radioPlayer: {
          ...(prev.appearance.radioPlayer || {
            showAnalyzer: true,
            showMetadata: true,
            showCover: true,
            videoMode: false,
            videoUrl: '',
          }),
          visualizer: nextActive,
          visualizerProfiles: remaining,
          activeVisualizerProfileId: nextActive.id,
        },
      },
    }));
    showNotice('Perfil eliminado.');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Activity className="text-secondary" size={26} />
            Control de Visualizadores y Perfiles
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Personaliza el estilo de onda continua, define los colores de inicio, subida y picos, y guarda múltiples perfiles listos para activar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2.5 bg-gray-800/90 border border-gray-700 px-3.5 py-2 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={showAnalyzer}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  appearance: {
                    ...prev.appearance,
                    radioPlayer: {
                      ...(prev.appearance.radioPlayer || {
                        showAnalyzer: true,
                        showMetadata: true,
                        showCover: true,
                        videoMode: false,
                        videoUrl: '',
                      }),
                      showAnalyzer: e.target.checked,
                    },
                  },
                }));
              }}
              className="form-checkbox h-4 w-4 text-secondary rounded border-gray-600 bg-gray-900"
            />
            <span className="text-xs font-bold text-white">Visualizador Activo</span>
          </label>

          <button
            type="button"
            onClick={() => onSave()}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-primary font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Todo'}</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
          <Check size={15} />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* LIVE FULL-WIDTH PREVIEW */}
      <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-3 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${previewPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Vista Previa en Tiempo Real (Ancho Completo del Reproductor)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPreviewPlaying((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
          >
            {previewPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{previewPlaying ? 'Pausar Simulación' : 'Reproducir Simulación'}</span>
          </button>
        </div>

        {/* Mock player bar header + full-width bottom visualizer */}
        <div className="bg-gradient-to-br from-[#0e1526] via-[#080c16] to-[#05070d]">
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 border border-secondary/40 flex items-center justify-center text-secondary font-black text-lg">
                FM
              </div>
              <div className="min-w-0">
                <span className="inline-block px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase tracking-widest mb-1">
                  AL AIRE
                </span>
                <p className="text-sm font-black text-white truncate">
                  {formData.general.stationName || 'BUENÍSIMA'} — {activeVisualizer.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-24 h-3 rounded-full border border-white/20"
                style={{
                  background: `linear-gradient(90deg, ${activeVisualizer.baseColor}, ${activeVisualizer.midColor}, ${activeVisualizer.peakColor})`,
                }}
                title="Degradado activo"
              />
            </div>
          </div>

          {showAnalyzer ? (
            <div className="w-full bg-gradient-to-t from-black/55 to-transparent pt-1">
              <AudioVisualizerCanvas
                isPlaying={previewPlaying}
                isBuffering={false}
                isMuted={false}
                volume={1}
                isVisible={true}
                profile={activeVisualizer}
              />
            </div>
          ) : (
            <div className="px-6 py-3 text-center text-xs text-gray-500 italic">
              El visualizador está desactivado actualmente (activa la casilla "Visualizador Activo" arriba para mostrarlo).
            </div>
          )}
        </div>
      </div>

      {/* SAVED PROFILES MANAGER */}
      <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <Sparkles size={18} className="text-secondary" /> Perfiles Guardados ({savedProfiles.length})
            </h3>
            <p className="text-xs text-gray-400">
              Haz clic en cualquier perfil para aplicarlo al instante o crea nuevos perfiles personalizados.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Nombre del nuevo perfil..."
              className="bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded-xl text-xs focus:border-secondary outline-none w-48"
            />
            <button
              type="button"
              onClick={handleSaveAsNewProfile}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all active:scale-95"
            >
              <Plus size={14} />
              <span>Guardar Nuevo Perfil</span>
            </button>
            <button
              type="button"
              onClick={handleOverwriteActiveProfile}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold transition-all active:scale-95"
              title="Actualiza el perfil seleccionado con los cambios actuales"
            >
              <RefreshCw size={13} />
              <span>Actualizar Actual</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {savedProfiles.map((prof) => {
            const isActive = prof.id === activeProfileId;
            const modeMeta = VISUALIZER_MODES.find((m) => m.id === prof.mode);
            return (
              <div
                key={prof.id}
                onClick={() => handleSelectProfile(prof)}
                className={`group relative p-4 rounded-xl border cursor-pointer transition-all ${
                  isActive
                    ? 'bg-secondary/10 border-secondary ring-2 ring-secondary/35 shadow-lg'
                    : 'bg-gray-900/70 border-gray-700 hover:border-gray-500'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">{prof.name}</span>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-primary text-[9px] font-black uppercase">
                          Activo
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400">{modeMeta?.label || prof.mode}</span>
                  </div>

                  {savedProfiles.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProfile(prof.id);
                      }}
                      className="text-gray-500 hover:text-red-400 p-1 rounded-lg transition-colors"
                      title="Eliminar perfil"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Gradient bar preview */}
                <div
                  className="h-2.5 w-full rounded-full border border-white/10"
                  style={{
                    background: `linear-gradient(90deg, ${prof.baseColor}, ${prof.midColor}, ${prof.peakColor})`,
                  }}
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 mt-2">
                  <span>Base: {prof.baseColor}</span>
                  <span>Medio: {prof.midColor}</span>
                  <span>Pico: {prof.peakColor}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODE + COLORS + TUNING GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mode Selector */}
        <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Waves size={18} className="text-secondary" /> Estilo de Visualizador
          </h3>
          <div className="space-y-2.5">
            {VISUALIZER_MODES.map((m) => {
              const selected = activeVisualizer.mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateActiveVisualizer({ mode: m.id })}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    selected
                      ? 'bg-secondary/15 border-secondary text-white shadow-md'
                      : 'bg-gray-900/60 border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm">{m.label}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{m.desc}</div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      selected ? 'bg-secondary border-secondary text-primary' : 'border-gray-600'
                    }`}
                  >
                    {selected && <Check size={12} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Colors & Fine Controls */}
        <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Palette size={18} className="text-secondary" /> Colores y Calibración de Audio
          </h3>

          {/* 3-Stop Color Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-3 space-y-2">
              <label className="block text-[11px] font-bold text-gray-300 uppercase">
                1. Inicio (Abajo)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={activeVisualizer.baseColor}
                  onChange={(e) => updateActiveVisualizer({ baseColor: e.target.value })}
                  className="w-10 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={activeVisualizer.baseColor}
                  onChange={(e) => updateActiveVisualizer({ baseColor: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-3 space-y-2">
              <label className="block text-[11px] font-bold text-gray-300 uppercase">
                2. Subida (Medio)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={activeVisualizer.midColor}
                  onChange={(e) => updateActiveVisualizer({ midColor: e.target.value })}
                  className="w-10 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={activeVisualizer.midColor}
                  onChange={(e) => updateActiveVisualizer({ midColor: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-3 space-y-2">
              <label className="block text-[11px] font-bold text-gray-300 uppercase">
                3. Pico Máximo
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={activeVisualizer.peakColor}
                  onChange={(e) => updateActiveVisualizer({ peakColor: e.target.value })}
                  className="w-10 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={activeVisualizer.peakColor}
                  onChange={(e) => updateActiveVisualizer({ peakColor: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Quick Color Palettes */}
          <div>
            <span className="block text-xs font-bold text-gray-400 mb-2">Paletas Rápidas de Estudio:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {COLOR_PALETTES.map((pal) => (
                <button
                  key={pal.name}
                  type="button"
                  onClick={() =>
                    updateActiveVisualizer({
                      baseColor: pal.base,
                      midColor: pal.mid,
                      peakColor: pal.peak,
                    })
                  }
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 hover:border-gray-500 text-left transition-all"
                >
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 border border-white/20"
                    style={{
                      background: `linear-gradient(135deg, ${pal.base}, ${pal.mid}, ${pal.peak})`,
                    }}
                  />
                  <span className="text-[11px] font-semibold text-gray-200 truncate">{pal.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4 pt-2 border-t border-gray-700/70">
            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span className="flex items-center gap-1.5"><Sliders size={13} /> Grosor de Línea / Trazo</span>
                <span className="font-mono text-secondary">{activeVisualizer.lineThickness ?? 3} px</span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                step={0.5}
                value={activeVisualizer.lineThickness ?? 3}
                onChange={(e) => updateActiveVisualizer({ lineThickness: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-gray-700 rounded-full accent-secondary cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Sensibilidad al Audio</span>
                <span className="font-mono text-secondary">{(activeVisualizer.sensitivity ?? 1.15).toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={activeVisualizer.sensitivity ?? 1.15}
                onChange={(e) => updateActiveVisualizer({ sensitivity: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-gray-700 rounded-full accent-secondary cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
                <span>Altura de la Franja Visualizadora</span>
                <span className="font-mono text-secondary">{activeVisualizer.heightPx ?? 48} px</span>
              </div>
              <input
                type="range"
                min={36}
                max={88}
                step={2}
                value={activeVisualizer.heightPx ?? 48}
                onChange={(e) => updateActiveVisualizer({ heightPx: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-gray-700 rounded-full accent-secondary cursor-pointer"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={activeVisualizer.showPeakLine !== false}
                onChange={(e) => updateActiveVisualizer({ showPeakLine: e.target.checked })}
                className="form-checkbox h-4 w-4 text-secondary rounded border-gray-600 bg-gray-900"
              />
              <span className="text-xs font-semibold text-gray-200">
                Resaltar cresta / pico máximo con el color pico ({activeVisualizer.peakColor})
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
