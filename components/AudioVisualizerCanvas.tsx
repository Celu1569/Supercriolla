import React, { useEffect, useRef } from 'react';
import { VisualizerProfile } from '../types';
import { DEFAULT_VISUALIZER_PROFILE } from '../constants';

interface AudioVisualizerCanvasProps {
  isPlaying: boolean;
  isBuffering?: boolean;
  isMuted?: boolean;
  volume?: number;
  isVisible?: boolean;
  analyzer?: AnalyserNode | null;
  profile?: VisualizerProfile;
  className?: string;
}

const hexToRgba = (hex: string, alpha: number): string => {
  const clean = (hex || '#22c55e').replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(34, 197, 94, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const AudioVisualizerCanvas: React.FC<AudioVisualizerCanvasProps> = ({
  isPlaying,
  isBuffering = false,
  isMuted = false,
  volume = 1,
  isVisible = true,
  analyzer = null,
  profile,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const activeProfile: VisualizerProfile = {
    ...DEFAULT_VISUALIZER_PROFILE,
    ...(profile || {}),
  };

  const heightPx = Math.max(32, Math.min(96, activeProfile.heightPx || 48));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const {
      mode,
      baseColor,
      midColor,
      peakColor,
      lineThickness = 3,
      sensitivity = 1.15,
      showPeakLine = true,
    } = activeProfile;

    const syncResolution = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rectW = canvas.clientWidth || 900;
      const rectH = canvas.clientHeight || heightPx;
      const w = Math.max(100, Math.floor(rectW * dpr));
      const h = Math.max(24, Math.floor(rectH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return { width: w, height: h, dpr };
    };

    const maxPoints = 96;
    const smoothed = new Array(maxPoints).fill(0.04);
    const peaks = new Array(maxPoints).fill(0.04);
    const peakTimers = new Array(maxPoints).fill(0);

    const buildVerticalGradient = (width: number, height: number, alpha = 1) => {
      const grad = ctx.createLinearGradient(0, height, 0, 0);
      grad.addColorStop(0, hexToRgba(baseColor, alpha));
      grad.addColorStop(0.45, hexToRgba(baseColor, alpha));
      grad.addColorStop(0.72, hexToRgba(midColor, alpha));
      grad.addColorStop(0.95, hexToRgba(peakColor, alpha));
      grad.addColorStop(1, hexToRgba(peakColor, alpha));
      return grad;
    };

    const drawRestingState = () => {
      const { width, height, dpr } = syncResolution();
      ctx.clearRect(0, 0, width, height);

      if (mode === 'mirror_wave') {
        const cy = height / 2;
        ctx.strokeStyle = hexToRgba(baseColor, 0.55);
        ctx.lineWidth = Math.max(1.5, lineThickness * 0.7 * dpr);
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(width, cy);
        ctx.stroke();
      } else if (mode === 'classic_vu') {
        const colStep = Math.max(10, Math.round(13 * dpr));
        const count = Math.max(24, Math.min(maxPoints, Math.floor(width / colStep)));
        const gap = Math.max(2, Math.round(3 * dpr));
        const barW = Math.max(4, (width - (count - 1) * gap) / count);
        const segH = Math.max(2, Math.round(3 * dpr));
        for (let i = 0; i < count; i++) {
          ctx.fillStyle = hexToRgba(baseColor, 0.45);
          ctx.fillRect(i * (barW + gap), height - segH - dpr, barW, segH);
        }
      } else {
        // Línea corrida continua en reposo (sin divisiones)
        const baseY = height - Math.max(2, lineThickness * dpr);
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, hexToRgba(baseColor, 0.5));
        grad.addColorStop(0.5, hexToRgba(midColor, 0.45));
        grad.addColorStop(1, hexToRgba(baseColor, 0.5));
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(2, lineThickness * 0.85 * dpr);
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        ctx.lineTo(width, baseY);
        ctx.stroke();
      }
    };

    const sampleEnergyLevels = (count: number, t: number, fftData: Uint8Array | null, hasLiveSignal: boolean, audioActive: boolean) => {
      const beatPulse = Math.pow(Math.sin(t * 1.95) * 0.5 + 0.5, 2) * 0.24;

      for (let i = 0; i < count; i++) {
        let target = 0.03;
        if (audioActive) {
          if (hasLiveSignal && fftData) {
            const norm = i / Math.max(1, count - 1);
            const binIdx = Math.min(
              fftData.length - 1,
              Math.floor(Math.pow(norm, 1.32) * (fftData.length * 0.72))
            );
            const prev = fftData[Math.max(0, binIdx - 1)] || 0;
            const curr = fftData[binIdx] || 0;
            const next = fftData[Math.min(fftData.length - 1, binIdx + 1)] || 0;
            const avg = (prev * 0.25 + curr * 0.5 + next * 0.25) / 255;
            target = Math.min(1, Math.pow(avg, 0.88) * sensitivity);
          } else {
            const norm = i / Math.max(1, count - 1);
            const bassBoost = Math.exp(-Math.pow((norm - 0.16) * 3.1, 2)) * (0.26 + beatPulse);
            const midBoost = Math.exp(-Math.pow((norm - 0.5) * 2.5, 2)) * 0.22;
            const w1 = Math.sin(t * 1.75 + i * 0.29) * 0.5 + 0.5;
            const w2 = Math.sin(t * 2.9 - i * 0.19) * 0.5 + 0.5;
            const w3 = Math.cos(t * 1.15 + i * 0.53) * 0.5 + 0.5;
            const combined = w1 * 0.42 + w2 * 0.35 + w3 * 0.23;
            target = Math.min(1, (0.12 + combined * 0.55 + bassBoost + midBoost) * (sensitivity * 0.92));
          }
        }

        smoothed[i] = smoothed[i] + (target - smoothed[i]) * 0.34;
        if (smoothed[i] >= peaks[i]) {
          peaks[i] = smoothed[i];
          peakTimers[i] = 14;
        } else if (peakTimers[i] > 0) {
          peakTimers[i] -= 1;
        } else {
          peaks[i] = Math.max(smoothed[i], peaks[i] - 0.015);
        }
      }
    };

    const drawSmoothCurvePath = (
      pointsX: number[],
      pointsY: number[],
      closeBottomHeight?: number
    ) => {
      if (pointsX.length < 2) return;
      ctx.beginPath();
      if (closeBottomHeight !== undefined) {
        ctx.moveTo(0, closeBottomHeight);
        ctx.lineTo(pointsX[0], pointsY[0]);
      } else {
        ctx.moveTo(pointsX[0], pointsY[0]);
      }

      for (let i = 0; i < pointsX.length - 1; i++) {
        const xc = (pointsX[i] + pointsX[i + 1]) / 2;
        const yc = (pointsY[i] + pointsY[i + 1]) / 2;
        ctx.quadraticCurveTo(pointsX[i], pointsY[i], xc, yc);
      }
      ctx.lineTo(pointsX[pointsX.length - 1], pointsY[pointsY.length - 1]);

      if (closeBottomHeight !== undefined) {
        ctx.lineTo(pointsX[pointsX.length - 1], closeBottomHeight);
        ctx.closePath();
      }
    };

    if (isPlaying && !isBuffering) {
      const draw = (now: number) => {
        animationRef.current = requestAnimationFrame(draw);
        const { width, height, dpr } = syncResolution();
        ctx.clearRect(0, 0, width, height);

        let fftData: Uint8Array | null = null;
        let hasLiveSignal = false;
        if (analyzer) {
          const len = analyzer.frequencyBinCount;
          fftData = new Uint8Array(len);
          analyzer.getByteFrequencyData(fftData);
          for (let j = 0; j < Math.min(len, 36); j++) {
            if (fftData[j] > 2) {
              hasLiveSignal = true;
              break;
            }
          }
        }

        const t = now * 0.005;
        const audioActive = !isMuted && volume > 0;
        const padTop = 4 * dpr;
        const usableH = Math.max(12, height - padTop - 2 * dpr);

        if (mode === 'continuous_line' || mode === 'neon_glow') {
          const ptsCount = 64;
          sampleEnergyLevels(ptsCount, t, fftData, hasLiveSignal, audioActive);

          const xs: number[] = [];
          const ys: number[] = [];
          const peakYs: number[] = [];

          for (let i = 0; i < ptsCount; i++) {
            const x = (i / (ptsCount - 1)) * width;
            const amp = Math.max(0.03, Math.min(1, smoothed[i]));
            const pAmp = Math.max(amp, Math.min(1, peaks[i]));
            xs.push(x);
            ys.push(height - amp * usableH);
            peakYs.push(height - pAmp * usableH);
          }

          // Relleno continuo sin líneas divisoras con degradado verde -> amarillo -> rojo
          const fillGrad = buildVerticalGradient(width, height, mode === 'neon_glow' ? 0.55 : 0.78);
          drawSmoothCurvePath(xs, ys, height);
          ctx.fillStyle = fillGrad;
          ctx.fill();

          // Línea corrida principal siguiendo el audio
          ctx.save();
          if (mode === 'neon_glow') {
            ctx.shadowColor = peakColor;
            ctx.shadowBlur = 12 * dpr;
          }
          ctx.strokeStyle = buildVerticalGradient(width, height, 1);
          ctx.lineWidth = Math.max(2, lineThickness * dpr);
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          drawSmoothCurvePath(xs, ys);
          ctx.stroke();
          ctx.restore();

          // Línea de pico continua roja sobre la cresta
          if (showPeakLine && audioActive) {
            ctx.save();
            ctx.strokeStyle = hexToRgba(peakColor, 0.9);
            ctx.lineWidth = Math.max(1.2, (lineThickness * 0.55) * dpr);
            if (mode === 'neon_glow') {
              ctx.shadowColor = peakColor;
              ctx.shadowBlur = 8 * dpr;
            }
            drawSmoothCurvePath(xs, peakYs);
            ctx.stroke();
            ctx.restore();
          }
        } else if (mode === 'mirror_wave') {
          const ptsCount = 64;
          sampleEnergyLevels(ptsCount, t, fftData, hasLiveSignal, audioActive);

          const cy = height / 2;
          const halfUsable = Math.max(8, (height - 6 * dpr) / 2);

          const topGrad = ctx.createLinearGradient(0, cy, 0, 0);
          topGrad.addColorStop(0, hexToRgba(baseColor, 0.85));
          topGrad.addColorStop(0.6, hexToRgba(midColor, 0.9));
          topGrad.addColorStop(1, hexToRgba(peakColor, 0.98));

          const botGrad = ctx.createLinearGradient(0, cy, 0, height);
          botGrad.addColorStop(0, hexToRgba(baseColor, 0.85));
          botGrad.addColorStop(0.6, hexToRgba(midColor, 0.9));
          botGrad.addColorStop(1, hexToRgba(peakColor, 0.98));

          const xs: number[] = [];
          const topYs: number[] = [];
          const botYs: number[] = [];
          for (let i = 0; i < ptsCount; i++) {
            const x = (i / (ptsCount - 1)) * width;
            const amp = Math.max(0.04, Math.min(1, smoothed[i]));
            xs.push(x);
            topYs.push(cy - amp * halfUsable);
            botYs.push(cy + amp * halfUsable);
          }

          drawSmoothCurvePath(xs, topYs, cy);
          ctx.fillStyle = topGrad;
          ctx.fill();

          drawSmoothCurvePath(xs, botYs, cy);
          ctx.fillStyle = botGrad;
          ctx.fill();

          // Línea central brillante y bordes continuos
          ctx.strokeStyle = topGrad;
          ctx.lineWidth = Math.max(1.5, lineThickness * 0.8 * dpr);
          drawSmoothCurvePath(xs, topYs);
          ctx.stroke();

          ctx.strokeStyle = botGrad;
          drawSmoothCurvePath(xs, botYs);
          ctx.stroke();

          if (showPeakLine && audioActive) {
            const pTopYs = peaks.slice(0, ptsCount).map((p) => cy - Math.min(1, p) * halfUsable);
            const pBotYs = peaks.slice(0, ptsCount).map((p) => cy + Math.min(1, p) * halfUsable);
            ctx.strokeStyle = hexToRgba(peakColor, 0.78);
            ctx.lineWidth = Math.max(1, 1.3 * dpr);
            drawSmoothCurvePath(xs, pTopYs);
            ctx.stroke();
            drawSmoothCurvePath(xs, pBotYs);
            ctx.stroke();
          }
        } else if (mode === 'smooth_bars') {
          // Barras verticales continuas sin líneas divisoras horizontales
          const colStep = Math.max(8, Math.round((8 + lineThickness * 1.5) * dpr));
          const barCount = Math.max(28, Math.min(maxPoints, Math.floor(width / colStep)));
          sampleEnergyLevels(barCount, t, fftData, hasLiveSignal, audioActive);

          const gap = Math.max(1.5, Math.round(2 * dpr));
          const barW = Math.max(3, (width - (barCount - 1) * gap) / barCount);
          const grad = buildVerticalGradient(width, height, 1);

          for (let i = 0; i < barCount; i++) {
            const x = i * (barW + gap);
            const h = Math.max(3 * dpr, smoothed[i] * usableH);
            const y = height - h;
            const radius = Math.min(barW / 2, 3 * dpr);

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, h, [radius, radius, 0, 0]);
            ctx.fill();

            if (showPeakLine && audioActive) {
              const py = Math.max(1, height - peaks[i] * usableH - 2 * dpr);
              ctx.fillStyle = peakColor;
              ctx.fillRect(x, py, barW, Math.max(2, 2.2 * dpr));
            }
          }
        } else {
          // classic_vu (opcional desde el panel)
          const colStep = Math.max(10, Math.round(13 * dpr));
          const barCount = Math.max(24, Math.min(maxPoints, Math.floor(width / colStep)));
          sampleEnergyLevels(barCount, t, fftData, hasLiveSignal, audioActive);

          const gap = Math.max(2, Math.round(3 * dpr));
          const barW = Math.max(4, (width - (barCount - 1) * gap) / barCount);
          const segH = Math.max(2, Math.round(3 * dpr));
          const segGap = Math.max(1, Math.round(2 * dpr));
          const totalSegs = Math.max(5, Math.floor((height - 2 * dpr) / (segH + segGap)));

          for (let i = 0; i < barCount; i++) {
            const litCount = Math.max(1, Math.min(totalSegs, Math.round(smoothed[i] * totalSegs)));
            const peakSeg = Math.min(totalSegs - 1, Math.max(0, Math.round(peaks[i] * totalSegs) - 1));
            const x = i * (barW + gap);

            for (let s = 0; s < totalSegs; s++) {
              const y = height - (s + 1) * (segH + segGap) + segGap;
              const ratio = (s + 1) / totalSegs;
              if (s < litCount) {
                ctx.fillStyle = ratio < 0.55 ? baseColor : ratio < 0.85 ? midColor : peakColor;
                ctx.fillRect(x, y, barW, segH);
              } else if (s === peakSeg && showPeakLine && audioActive) {
                ctx.fillStyle = peakColor;
                ctx.fillRect(x, y, barW, segH);
              }
            }
          }
        }
      };

      animationRef.current = requestAnimationFrame(draw);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      drawRestingState();
    }

    const handleResize = () => {
      if (!isPlaying || isBuffering) drawRestingState();
    };
    window.addEventListener('resize', handleResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (!isPlaying || isBuffering) drawRestingState();
      });
      observer.observe(canvas);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [
    isPlaying,
    isBuffering,
    isMuted,
    volume,
    isVisible,
    analyzer,
    heightPx,
    activeProfile.mode,
    activeProfile.baseColor,
    activeProfile.midColor,
    activeProfile.peakColor,
    activeProfile.lineThickness,
    activeProfile.sensitivity,
    activeProfile.showPeakLine,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${heightPx}px` }}
      className={`w-full block ${className}`}
    />
  );
};
