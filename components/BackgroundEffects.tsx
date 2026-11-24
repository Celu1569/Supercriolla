import React, { useEffect, useRef } from 'react';
import { SeasonalBackgroundConfig, VisualEffectId } from '../types';
import { resolveDirectImageUrl } from '../utils/imageUrl';

interface BackgroundEffectsProps {
  config?: SeasonalBackgroundConfig;
  previewMode?: boolean;
}

interface Particle {
  effect: VisualEffectId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  rotation: number;
  vRot: number;
  color: string;
  phase: number;
  life?: number;
  maxLife?: number;
}

interface FireworkRocket {
  x: number;
  y: number;
  targetY: number;
  vy: number;
  color: string;
}

const CONFETTI_COLORS = ['#fbbf24', '#ef4444', '#3b82f6', '#10b981', '#ec4899', '#a855f7', '#06b6d4'];
const LEAF_COLORS = ['#ea580c', '#d97706', '#dc2626', '#ca8a04', '#b45309'];
const HEART_COLORS = ['#f43f5e', '#ec4899', '#fb7185', '#e11d48'];
const FIREWORK_COLORS = ['#fbbf24', '#38bdf8', '#f472b6', '#4ade80', '#c084fc', '#fb7185'];

export const BackgroundEffects: React.FC<BackgroundEffectsProps> = ({ config, previewMode = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isEnabled = !!config?.enabled;
  const effects = isEnabled && Array.isArray(config?.effects) ? config.effects : [];
  const intensity = config?.effectIntensity || 'medium';
  const multiplier = intensity === 'low' ? 0.55 : intensity === 'high' ? 1.65 : 1;

  const hasCanvasEffects = effects.some((e) => e !== 'christmas_lights' && e !== 'aurora');
  const hasChristmasLights = isEnabled && effects.includes('christmas_lights');
  const hasAurora = isEnabled && effects.includes('aurora');

  useEffect(() => {
    if (!isEnabled || !hasCanvasEffects) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = previewMode ? canvas.parentElement?.clientWidth || window.innerWidth : window.innerWidth;
    let height = previewMode ? canvas.parentElement?.clientHeight || window.innerHeight : window.innerHeight;

    const resize = () => {
      if (!canvas) return;
      width = previewMode ? canvas.parentElement?.clientWidth || 600 : window.innerWidth;
      height = previewMode ? canvas.parentElement?.clientHeight || 300 : window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener('resize', resize);

    const areaFactor = Math.max(0.4, Math.min(1.5, (width * height) / (1440 * 900)));
    const particles: Particle[] = [];
    const rockets: FireworkRocket[] = [];

    const createParticle = (effect: VisualEffectId, randomY = false): Particle => {
      const yStart = randomY ? Math.random() * height : effect === 'hearts' || effect === 'bubbles' ? height + 20 : -20;

      switch (effect) {
        case 'snow':
          return {
            effect,
            x: Math.random() * width,
            y: yStart,
            vx: (Math.random() - 0.5) * 0.6,
            vy: 0.9 + Math.random() * 1.6,
            size: 2 + Math.random() * 4.5,
            alpha: 0.45 + Math.random() * 0.5,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.02,
            color: '#ffffff',
            phase: Math.random() * Math.PI * 2,
          };
        case 'confetti':
          return {
            effect,
            x: Math.random() * width,
            y: yStart,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 1.5 + Math.random() * 2.2,
            size: 5 + Math.random() * 6,
            alpha: 0.75 + Math.random() * 0.25,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.14,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            phase: Math.random() * Math.PI * 2,
          };
        case 'sparkles':
          return {
            effect,
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            size: 2 + Math.random() * 3.5,
            alpha: Math.random(),
            rotation: Math.random() * Math.PI,
            vRot: 0.015,
            color: Math.random() > 0.35 ? '#fde047' : '#ffffff',
            phase: Math.random() * Math.PI * 2,
          };
        case 'hearts':
          return {
            effect,
            x: Math.random() * width,
            y: yStart,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -(0.9 + Math.random() * 1.5),
            size: 8 + Math.random() * 10,
            alpha: 0.55 + Math.random() * 0.4,
            rotation: (Math.random() - 0.5) * 0.4,
            vRot: (Math.random() - 0.5) * 0.015,
            color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
            phase: Math.random() * Math.PI * 2,
          };
        case 'leaves':
          return {
            effect,
            x: Math.random() * width,
            y: yStart,
            vx: (Math.random() - 0.3) * 1.1,
            vy: 1.0 + Math.random() * 1.5,
            size: 8 + Math.random() * 9,
            alpha: 0.7 + Math.random() * 0.3,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.05,
            color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
            phase: Math.random() * Math.PI * 2,
          };
        case 'bubbles':
          return {
            effect,
            x: Math.random() * width,
            y: yStart,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -(0.8 + Math.random() * 1.4),
            size: 5 + Math.random() * 14,
            alpha: 0.2 + Math.random() * 0.35,
            rotation: 0,
            vRot: 0,
            color: '#67e8f9',
            phase: Math.random() * Math.PI * 2,
          };
        case 'bats':
          return {
            effect,
            x: Math.random() * width,
            y: Math.random() * (height * 0.75),
            vx: (Math.random() > 0.5 ? 1 : -1) * (1.2 + Math.random() * 1.8),
            vy: (Math.random() - 0.5) * 0.6,
            size: 12 + Math.random() * 10,
            alpha: 0.65 + Math.random() * 0.3,
            rotation: 0,
            vRot: 0,
            color: Math.random() > 0.25 ? '#1f122b' : '#f97316',
            phase: Math.random() * Math.PI * 2,
          };
        default:
          return {
            effect,
            x: Math.random() * width,
            y: yStart,
            vx: 0,
            vy: 1,
            size: 3,
            alpha: 0.7,
            rotation: 0,
            vRot: 0,
            color: '#ffffff',
            phase: 0,
          };
      }
    };

    const countByEffect: Record<VisualEffectId, number> = {
      snow: Math.round(55 * areaFactor * multiplier),
      confetti: Math.round(45 * areaFactor * multiplier),
      sparkles: Math.round(40 * areaFactor * multiplier),
      hearts: Math.round(24 * areaFactor * multiplier),
      leaves: Math.round(26 * areaFactor * multiplier),
      bubbles: Math.round(28 * areaFactor * multiplier),
      bats: Math.round(12 * areaFactor * multiplier),
      fireworks: 0,
      christmas_lights: 0,
      aurora: 0,
    };

    effects.forEach((ef) => {
      const targetCount = countByEffect[ef] || 0;
      for (let i = 0; i < targetCount; i++) {
        particles.push(createParticle(ef, true));
      }
    });

    const spawnFireworkExplosion = (x: number, y: number, color: string) => {
      const sparkCount = Math.round(26 * multiplier);
      for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.2;
        const speed = 1.5 + Math.random() * 3.8;
        particles.push({
          effect: 'fireworks',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 2.2,
          alpha: 1,
          rotation: 0,
          vRot: 0,
          color,
          phase: 0,
          life: 0,
          maxLife: 45 + Math.random() * 25,
        });
      }
    };

    let tick = 0;
    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      tick++;
      ctx.clearRect(0, 0, width, height);

      // Firework spawner
      if (effects.includes('fireworks')) {
        const spawnInterval = intensity === 'high' ? 35 : intensity === 'low' ? 95 : 58;
        if (tick % spawnInterval === 10 && rockets.length < 5) {
          rockets.push({
            x: width * (0.15 + Math.random() * 0.7),
            y: height,
            targetY: height * (0.12 + Math.random() * 0.38),
            vy: -(6 + Math.random() * 3.5),
            color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
          });
        }

        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i];
          r.y += r.vy;
          r.vy *= 0.985;

          ctx.save();
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = r.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = r.color;
          ctx.fill();
          ctx.restore();

          if (r.y <= r.targetY || r.vy > -1.5) {
            spawnFireworkExplosion(r.x, r.y, r.color);
            rockets.splice(i, 1);
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (p.effect === 'fireworks') {
          p.life = (p.life || 0) + 1;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.045; // gravity
          p.vx *= 0.97;
          const progress = p.life / (p.maxLife || 60);
          if (progress >= 1) {
            particles.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - progress);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - progress * 0.4), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        p.phase += 0.03;
        p.rotation += p.vRot;

        if (p.effect === 'snow' || p.effect === 'leaves' || p.effect === 'confetti') {
          p.x += p.vx + Math.sin(p.phase) * 0.55;
          p.y += p.vy;
          if (p.y > height + 25) {
            Object.assign(p, createParticle(p.effect, false));
          }
          if (p.x > width + 25) p.x = -20;
          if (p.x < -25) p.x = width + 20;
        } else if (p.effect === 'hearts' || p.effect === 'bubbles') {
          p.x += p.vx + Math.sin(p.phase) * 0.45;
          p.y += p.vy;
          if (p.y < -30) {
            Object.assign(p, createParticle(p.effect, false));
          }
        } else if (p.effect === 'sparkles') {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha = 0.2 + Math.abs(Math.sin(p.phase * 1.4)) * 0.8;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        } else if (p.effect === 'bats') {
          p.x += p.vx;
          p.y += Math.sin(p.phase * 2) * 0.9 + p.vy;
          if (p.x > width + 40) p.x = -35;
          if (p.x < -40) p.x = width + 35;
          if (p.y < 20) p.y = 20;
          if (p.y > height * 0.85) p.y = height * 0.85;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;

        if (p.effect === 'snow') {
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 4;
          ctx.shadowColor = 'rgba(255,255,255,0.8)';
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.effect === 'confetti') {
          ctx.fillStyle = p.color;
          ctx.scale(1, Math.cos(p.phase * 2));
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.effect === 'sparkles') {
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          const s = p.size;
          ctx.beginPath();
          ctx.moveTo(0, -s * 1.8);
          ctx.lineTo(s * 0.45, -s * 0.45);
          ctx.lineTo(s * 1.8, 0);
          ctx.lineTo(s * 0.45, s * 0.45);
          ctx.lineTo(0, s * 1.8);
          ctx.lineTo(-s * 0.45, s * 0.45);
          ctx.lineTo(-s * 1.8, 0);
          ctx.lineTo(-s * 0.45, -s * 0.45);
          ctx.closePath();
          ctx.fill();
        } else if (p.effect === 'hearts') {
          ctx.fillStyle = p.color;
          const s = p.size * 0.55;
          ctx.beginPath();
          ctx.moveTo(0, s * 0.35);
          ctx.bezierCurveTo(-s, -s * 0.6, -s * 1.6, s * 0.4, 0, s * 1.5);
          ctx.bezierCurveTo(s * 1.6, s * 0.4, s, -s * 0.6, 0, s * 0.35);
          ctx.fill();
        } else if (p.effect === 'leaves') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.7, p.size * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.effect === 'bubbles') {
          ctx.strokeStyle = 'rgba(165, 243, 252, 0.75)';
          ctx.lineWidth = 1.4;
          ctx.fillStyle = 'rgba(103, 232, 249, 0.12)';
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.22, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          ctx.fill();
        } else if (p.effect === 'bats') {
          const wing = Math.sin(p.phase * 5) * (p.size * 0.35);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(-p.size * 0.6, -p.size * 0.7 + wing, -p.size, 0);
          ctx.quadraticCurveTo(-p.size * 0.5, p.size * 0.25, 0, p.size * 0.3);
          ctx.quadraticCurveTo(p.size * 0.5, p.size * 0.25, p.size, 0);
          ctx.quadraticCurveTo(p.size * 0.6, -p.size * 0.7 + wing, 0, 0);
          ctx.fill();
        }

        ctx.restore();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [isEnabled, hasCanvasEffects, JSON.stringify(effects), intensity, previewMode]);

  if (!isEnabled) return null;

  const bgType = config?.backgroundType || 'theme';
  const resolvedBgImg = config?.backgroundImageUrl ? resolveDirectImageUrl(config.backgroundImageUrl) : '';
  const overlayOpacity = config?.overlayOpacity !== undefined ? config.overlayOpacity : 0.4;
  const overlayColor = config?.overlayColor || '#000000';

  const getAuroraColors = () => {
    switch (config?.season) {
      case 'christmas':
        return ['rgba(220, 38, 38, 0.24)', 'rgba(22, 163, 74, 0.24)', 'rgba(250, 204, 21, 0.16)'];
      case 'halloween':
        return ['rgba(249, 115, 22, 0.24)', 'rgba(147, 51, 234, 0.26)', 'rgba(234, 179, 8, 0.14)'];
      case 'valentine':
        return ['rgba(236, 72, 153, 0.25)', 'rgba(244, 63, 94, 0.22)', 'rgba(168, 85, 247, 0.16)'];
      case 'summer':
        return ['rgba(6, 182, 212, 0.26)', 'rgba(16, 185, 129, 0.22)', 'rgba(250, 204, 21, 0.18)'];
      default:
        return ['rgba(56, 189, 248, 0.22)', 'rgba(168, 85, 247, 0.22)', 'rgba(251, 191, 36, 0.16)'];
    }
  };

  const auroraPalette = getAuroraColors();
  const posClass = previewMode ? 'absolute inset-0' : 'fixed inset-0';

  return (
    <>
      {/* 1. Page Background Layer */}
      {bgType !== 'theme' && (
        <div
          className={`${posClass} pointer-events-none z-0 overflow-hidden transition-all duration-700`}
          style={{
            backgroundColor: bgType === 'solid' ? config?.backgroundColor || '#030712' : undefined,
            backgroundImage:
              bgType === 'gradient'
                ? `linear-gradient(${config?.gradientDirection || '135deg'}, ${config?.gradientStart || '#071b1e'}, ${config?.gradientEnd || '#1a0b1c'})`
                : bgType === 'image' && resolvedBgImg
                  ? `url("${resolvedBgImg}")`
                  : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: bgType === 'image' && config?.backgroundFixed !== false && !previewMode ? 'fixed' : 'scroll',
          }}
        >
          {/* Optional Contrast Overlay for Readability */}
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              backgroundColor: overlayColor,
              opacity: overlayOpacity,
            }}
          />
        </div>
      )}

      {/* 2. Aurora Glow Effect */}
      {hasAurora && (
        <div className={`${posClass} pointer-events-none z-[1] overflow-hidden`}>
          <div
            className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full blur-3xl animate-pulse"
            style={{ background: auroraPalette[0], animationDuration: '6s' }}
          />
          <div
            className="absolute top-1/3 -right-32 w-[36rem] h-[36rem] rounded-full blur-3xl animate-pulse"
            style={{ background: auroraPalette[1], animationDuration: '8s' }}
          />
          <div
            className="absolute -bottom-32 left-1/3 w-[32rem] h-[32rem] rounded-full blur-3xl animate-pulse"
            style={{ background: auroraPalette[2], animationDuration: '7s' }}
          />
        </div>
      )}

      {/* 3. Christmas Lights Garland */}
      {hasChristmasLights && (
        <div
          className={`${previewMode ? 'absolute top-0 left-0 right-0' : 'fixed top-0 left-0 right-0'} pointer-events-none z-[45] flex justify-around items-start overflow-hidden h-8 px-1`}
        >
          {Array.from({ length: previewMode ? 14 : 28 }).map((_, idx) => {
            const colors = ['#ef4444', '#22c55e', '#facc15', '#3b82f6', '#ec4899'];
            const c = colors[idx % colors.length];
            const delay = `${(idx % 5) * 0.35}s`;
            return (
              <div key={idx} className="flex flex-col items-center">
                <div className="w-px h-2.5 bg-gray-600/80" />
                <div
                  className="w-2.5 h-3.5 rounded-full animate-pulse"
                  style={{
                    backgroundColor: c,
                    boxShadow: `0 0 10px 2px ${c}`,
                    animationDelay: delay,
                    animationDuration: '1.6s',
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Multi-Effect Particle Canvas */}
      {hasCanvasEffects && (
        <canvas
          ref={canvasRef}
          className={`${posClass} pointer-events-none z-[35]`}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default BackgroundEffects;
