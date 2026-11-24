import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Flame,
  Loader2,
  MessageCircle,
  MessageSquare,
  Radio,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  AlertTriangle
} from 'lucide-react';
import { fetchLast7DaysListenerTrends, ListenerTrendsSummary } from '../utils/listenerAnalytics';
import { useConfig } from '../context/ConfigContext';

type ChartMetric = 'totalListeners' | 'peakListeners' | 'engagement';

const formatShortDay = (isoDate: string): { weekday: string; shortDate: string } => {
  try {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const weekday = dt.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
    const shortDate = dt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '');
    return {
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
      shortDate
    };
  } catch {
    return { weekday: isoDate, shortDate: '' };
  }
};

export const ListenerTrendsDashboard: React.FC = () => {
  const { config } = useConfig();
  const [summary, setSummary] = useState<ListenerTrendsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [metric, setMetric] = useState<ChartMetric>('totalListeners');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [liveTrackInfo, setLiveTrackInfo] = useState<{ title: string; artist: string; listeners?: number } | null>(null);

  const loadTrends = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchLast7DaysListenerTrends();
      setSummary(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudieron cargar las estadísticas de Firestore.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLiveStatus = useCallback(async () => {
    try {
      const streamUrl = config.general.streamUrl || 'https://redradioypc.com:8010/live';
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(streamUrl)}&_t=${Date.now()}`, {
        headers: { Accept: 'application/json' }
      });
      if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
        const data = await res.json();
        if (data?.title) {
          setLiveTrackInfo({
            title: data.title,
            artist: data.artist || config.general.stationName,
            listeners: typeof data.listeners === 'number' ? data.listeners : undefined
          });
        }
      }
    } catch {
      // Optional live indicator
    }
  }, [config.general.streamUrl, config.general.stationName]);

  useEffect(() => {
    loadTrends();
    loadLiveStatus();
  }, [loadTrends, loadLiveStatus]);

  const days = summary?.days || [];
  const getMetricValue = (idx: number): number => {
    const d = days[idx];
    if (!d) return 0;
    if (metric === 'peakListeners') return d.peakListeners;
    if (metric === 'engagement') return d.songRequests + d.chatMessages;
    return d.totalListeners;
  };

  const values = days.map((_, i) => getMetricValue(i));
  const rawMax = Math.max(...values, 0);
  const yMax = rawMax === 0 ? 10 : Math.ceil(rawMax * 1.2);
  const yTicks = [0, Math.round(yMax * 0.25), Math.round(yMax * 0.5), Math.round(yMax * 0.75), yMax];

  // SVG coordinate system
  const svgW = 760;
  const svgH = 260;
  const padL = 44;
  const padR = 24;
  const padT = 22;
  const padB = 42;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const getX = (idx: number) => {
    if (days.length <= 1) return padL + plotW / 2;
    return padL + (idx / (days.length - 1)) * plotW;
  };
  const getY = (val: number) => {
    if (yMax <= 0) return padT + plotH;
    return padT + plotH - (val / yMax) * plotH;
  };

  const linePoints = days.map((_, i) => ({ x: getX(i), y: getY(values[i]), val: values[i] }));
  const polylinePath = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    linePoints.length > 0
      ? `${polylinePath} L ${linePoints[linePoints.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${linePoints[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  const activeMetricColor =
    metric === 'peakListeners'
      ? { stroke: '#34d399', fillStart: 'rgba(52, 211, 153, 0.35)', fillEnd: 'rgba(52, 211, 153, 0.0)', bar: 'rgba(52, 211, 153, 0.16)', label: 'Pico Simultáneo' }
      : metric === 'engagement'
        ? { stroke: '#a78bfa', fillStart: 'rgba(167, 139, 250, 0.35)', fillEnd: 'rgba(167, 139, 250, 0.0)', bar: 'rgba(167, 139, 250, 0.16)', label: 'Pedidos + Chat' }
        : { stroke: '#fbbf24', fillStart: 'rgba(251, 191, 36, 0.35)', fillEnd: 'rgba(251, 191, 36, 0.0)', bar: 'rgba(251, 191, 36, 0.16)', label: 'Oyentes Totales' };

  const activeDay = hoveredIdx !== null ? days[hoveredIdx] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 flex items-center justify-center shadow-lg">
              <BarChart3 size={21} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Dashboard de Audiencia</h2>
              <p className="text-xs sm:text-sm text-gray-400">
                Tendencia de oyentes de los últimos 7 días sincronizada en tiempo real desde Firestore.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {liveTrackInfo && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-900 border border-emerald-500/30 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-400">Al Aire:</span>
              <span className="font-bold text-white truncate max-w-[180px]">{liveTrackInfo.title}</span>
              {typeof liveTrackInfo.listeners === 'number' && (
                <span className="ml-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-bold">
                  {liveTrackInfo.listeners} en vivo
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              loadTrends();
              loadLiveStatus();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm font-bold text-white transition-colors disabled:opacity-60"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Actualizar Datos</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Error al consultar Firestore</p>
            <p className="text-xs text-red-300/90 mt-1 break-all">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Oyentes (7 Días)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-black text-white">
              {loading && !summary ? '...' : summary?.totalListeners7d ?? 0}
            </span>
            {summary && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  summary.trendPercent >= 0
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-rose-500/15 text-rose-300'
                }`}
              >
                {summary.trendPercent >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span>{summary.trendPercent >= 0 ? `+${summary.trendPercent}%` : `${summary.trendPercent}%`} hoy</span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Hoy: <strong className="text-gray-300">{summary?.todayCount ?? 0}</strong> · Ayer:{' '}
            <strong className="text-gray-300">{summary?.yesterdayCount ?? 0}</strong>
          </p>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Promedio Diario</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
              <Activity size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {loading && !summary ? '...' : summary?.avgDailyListeners ?? 0}
          </div>
          <p className="text-xs text-gray-500 mt-2">Sesiones promedio por día (últimos 7 días)</p>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Pico Máximo</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Flame size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {loading && !summary ? '...' : summary?.peakListeners7d ?? 0}
          </div>
          <p className="text-xs text-gray-500 mt-2">Máximo de oyentes simultáneos detectados en vivo</p>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Interacción (7 Días)</span>
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center">
              <MessageCircle size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {loading && !summary ? '...' : (summary?.totalSongRequests7d ?? 0) + (summary?.totalChatMessages7d ?? 0)}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <strong className="text-emerald-400">{summary?.totalSongRequests7d ?? 0}</strong> pedidos WhatsApp ·{' '}
            <strong className="text-violet-400">{summary?.totalChatMessages7d ?? 0}</strong> mensajes chat
          </p>
        </div>
      </div>

      {/* Main Chart Card: Listener Trends (Last 7 Days) */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-amber-400" />
              <span>Tendencia de Oyentes — Últimos 7 Días (Listener Trends)</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Datos obtenidos de la colección <code className="text-amber-300">listener_stats</code> y{' '}
              <code className="text-amber-300">messages</code> en Firestore.
            </p>
          </div>

          <div className="inline-flex bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              type="button"
              onClick={() => setMetric('totalListeners')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                metric === 'totalListeners' ? 'bg-amber-500 text-slate-950 shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Oyentes
            </button>
            <button
              type="button"
              onClick={() => setMetric('peakListeners')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                metric === 'peakListeners' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Pico En Vivo
            </button>
            <button
              type="button"
              onClick={() => setMetric('engagement')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                metric === 'engagement' ? 'bg-violet-500 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Pedidos + Chat
            </button>
          </div>
        </div>

        {loading && !summary ? (
          <div className="h-[260px] flex flex-col items-center justify-center text-gray-400">
            <Loader2 size={32} className="animate-spin text-amber-400 mb-3" />
            <p className="text-sm font-medium">Consultando tendencias de los últimos 7 días en Firestore...</p>
          </div>
        ) : (
          <div className="relative">
            {/* Hover Detail Floating Pill */}
            {activeDay && hoveredIdx !== null && (
              <div className="mb-3 sm:mb-0 sm:absolute sm:top-2 sm:right-4 z-10 bg-gray-950/95 border border-gray-700 rounded-xl px-3.5 py-2.5 shadow-xl text-xs pointer-events-none">
                <div className="font-black text-white mb-1 flex items-center gap-1.5">
                  <Calendar size={12} className="text-amber-400" />
                  <span>{formatShortDay(activeDay.date).weekday} · {activeDay.date}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-gray-400">Oyentes:</span>
                  <span className="font-bold text-amber-400 text-right">{activeDay.totalListeners}</span>
                  <span className="text-gray-400">Pico en vivo:</span>
                  <span className="font-bold text-emerald-400 text-right">{activeDay.peakListeners}</span>
                  <span className="text-gray-400">Pedidos WhatsApp:</span>
                  <span className="font-bold text-white text-right">{activeDay.songRequests}</span>
                  <span className="text-gray-400">Mensajes Chat:</span>
                  <span className="font-bold text-violet-400 text-right">{activeDay.chatMessages}</span>
                </div>
              </div>
            )}

            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full min-w-[540px] h-[260px] select-none overflow-visible"
                role="img"
                aria-label="Gráfica de tendencia de oyentes en los últimos 7 días"
              >
                <defs>
                  <linearGradient id="listenerTrendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeMetricColor.fillStart} />
                    <stop offset="100%" stopColor={activeMetricColor.fillEnd} />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines & Y-Axis Ticks */}
                {yTicks.map((tick, i) => {
                  const y = getY(tick);
                  return (
                    <g key={i}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={svgW - padR}
                        y2={y}
                        stroke="rgba(255,255,255,0.07)"
                        strokeDasharray={i === 0 ? undefined : '4 4'}
                      />
                      <text
                        x={padL - 10}
                        y={y + 4}
                        textAnchor="end"
                        fill="#9ca3af"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {tick}
                      </text>
                    </g>
                  );
                })}

                {/* Subtle Background Bars */}
                {linePoints.map((pt, idx) => {
                  const barW = 28;
                  const barH = Math.max(2, padT + plotH - pt.y);
                  return (
                    <rect
                      key={`bar-${idx}`}
                      x={pt.x - barW / 2}
                      y={pt.y}
                      width={barW}
                      height={barH}
                      rx={6}
                      fill={hoveredIdx === idx ? activeMetricColor.fillStart : activeMetricColor.bar}
                      className="transition-all duration-200"
                    />
                  );
                })}

                {/* Area Fill */}
                {areaPath && <path d={areaPath} fill="url(#listenerTrendAreaGrad)" />}

                {/* Trend Line */}
                {polylinePath && (
                  <path
                    d={polylinePath}
                    fill="none"
                    stroke={activeMetricColor.stroke}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Vertical Hover Guide */}
                {hoveredIdx !== null && linePoints[hoveredIdx] && (
                  <line
                    x1={linePoints[hoveredIdx].x}
                    y1={padT}
                    x2={linePoints[hoveredIdx].x}
                    y2={padT + plotH}
                    stroke="rgba(255,255,255,0.22)"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Data Points & X-Axis Labels */}
                {linePoints.map((pt, idx) => {
                  const day = days[idx];
                  const { weekday, shortDate } = formatShortDay(day.date);
                  const isToday = idx === days.length - 1;
                  const isHovered = hoveredIdx === idx;
                  return (
                    <g
                      key={day.date}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="cursor-pointer"
                    >
                      {/* Invisible wide hit zone */}
                      <rect
                        x={pt.x - 32}
                        y={padT}
                        width={64}
                        height={plotH + padB}
                        fill="transparent"
                      />

                      {/* Value above point */}
                      {(pt.val > 0 || isHovered) && (
                        <text
                          x={pt.x}
                          y={pt.y - 10}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="800"
                        >
                          {pt.val}
                        </text>
                      )}

                      {/* Point */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 7 : 5}
                        fill="#0f172a"
                        stroke={activeMetricColor.stroke}
                        strokeWidth={isHovered ? 3.5 : 2.5}
                      />

                      {/* X-Axis Labels */}
                      <text
                        x={pt.x}
                        y={padT + plotH + 18}
                        textAnchor="middle"
                        fill={isToday ? '#fbbf24' : '#e5e7eb'}
                        fontSize="11"
                        fontWeight={isToday ? '800' : '600'}
                      >
                        {isToday ? 'Hoy' : weekday}
                      </text>
                      <text
                        x={pt.x}
                        y={padT + plotH + 33}
                        textAnchor="middle"
                        fill="#6b7280"
                        fontSize="10"
                      >
                        {shortDate}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Radio size={16} className="text-amber-400" />
            <span>Desglose Diario (Últimos 7 Días)</span>
          </h4>
          <span className="text-xs text-gray-400">
            Directorio de oyentes registrados: <strong className="text-white">{summary?.registeredOyentesCount ?? 0}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-950/60 border-b border-gray-800 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Oyentes</th>
                <th className="px-6 py-3">Pico Simultáneo</th>
                <th className="px-6 py-3">Pedidos WhatsApp</th>
                <th className="px-6 py-3">Mensajes Chat</th>
                <th className="px-6 py-3 w-48">Actividad Relativa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/70 text-sm">
              {days.map((day, idx) => {
                const { weekday, shortDate } = formatShortDay(day.date);
                const isToday = idx === days.length - 1;
                const maxDayListeners = Math.max(...days.map((d) => d.totalListeners), 1);
                const barPct = Math.round((day.totalListeners / maxDayListeners) * 100);

                return (
                  <tr key={day.date} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-white">
                      <span className="font-bold">{isToday ? 'Hoy' : weekday}</span>{' '}
                      <span className="text-gray-400 text-xs">({shortDate})</span>
                    </td>
                    <td className="px-6 py-3.5 font-bold text-amber-400">{day.totalListeners}</td>
                    <td className="px-6 py-3.5 text-emerald-400 font-semibold">{day.peakListeners}</td>
                    <td className="px-6 py-3.5 text-gray-200">{day.songRequests}</td>
                    <td className="px-6 py-3.5 text-violet-300 flex items-center gap-1.5">
                      <MessageSquare size={13} className="opacity-70" />
                      <span>{day.chatMessages}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
