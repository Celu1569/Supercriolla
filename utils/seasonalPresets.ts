import { SeasonThemeId, VisualEffectId, SeasonalBackgroundConfig } from '../types';

export interface SeasonPreset {
  id: SeasonThemeId;
  name: string;
  emoji: string;
  description: string;
  badgeColor: string;
  defaults: Partial<SeasonalBackgroundConfig>;
}

export interface VisualEffectOption {
  id: VisualEffectId;
  name: string;
  emoji: string;
  description: string;
}

export const SEASON_PRESETS: SeasonPreset[] = [
  {
    id: 'default',
    name: 'Normal / Sin Temporada',
    emoji: '📻',
    description: 'Mantiene el fondo estándar configurado en tu apariencia.',
    badgeColor: '#64748b',
    defaults: {
      enabled: false,
      season: 'default',
      backgroundType: 'theme',
      effects: [],
    },
  },
  {
    id: 'christmas',
    name: 'Navidad',
    emoji: '🎄',
    description: 'Ambiente navideño con nieve cayendo, luces festivas y destellos cálidos.',
    badgeColor: '#dc2626',
    defaults: {
      enabled: true,
      season: 'christmas',
      backgroundType: 'gradient',
      gradientStart: '#071b16',
      gradientEnd: '#2a080e',
      gradientDirection: '135deg',
      backgroundFixed: true,
      overlayOpacity: 0.35,
      overlayColor: '#000000',
      effects: ['snow', 'christmas_lights', 'sparkles'],
      effectIntensity: 'medium',
    },
  },
  {
    id: 'new_year',
    name: 'Año Nuevo',
    emoji: '🎆',
    description: 'Celebración de fin de año con fuegos artificiales, confeti y brillos dorados.',
    badgeColor: '#eab308',
    defaults: {
      enabled: true,
      season: 'new_year',
      backgroundType: 'gradient',
      gradientStart: '#060919',
      gradientEnd: '#20103a',
      gradientDirection: '135deg',
      backgroundFixed: true,
      overlayOpacity: 0.3,
      overlayColor: '#000000',
      effects: ['fireworks', 'confetti', 'sparkles'],
      effectIntensity: 'medium',
    },
  },
  {
    id: 'valentine',
    name: 'Amor y Amistad',
    emoji: '❤️',
    description: 'San Valentín con corazones flotantes y atmósfera romántica.',
    badgeColor: '#ec4899',
    defaults: {
      enabled: true,
      season: 'valentine',
      backgroundType: 'gradient',
      gradientStart: '#220612',
      gradientEnd: '#460c29',
      gradientDirection: '135deg',
      backgroundFixed: true,
      overlayOpacity: 0.3,
      overlayColor: '#000000',
      effects: ['hearts', 'sparkles'],
      effectIntensity: 'medium',
    },
  },
  {
    id: 'carnival',
    name: 'Carnaval / Fiesta',
    emoji: '🎉',
    description: 'Lluvia de confeti multicolor, burbujas y resplandor festivo.',
    badgeColor: '#8b5cf6',
    defaults: {
      enabled: true,
      season: 'carnival',
      backgroundType: 'gradient',
      gradientStart: '#110a2e',
      gradientEnd: '#330e48',
      gradientDirection: '135deg',
      backgroundFixed: true,
      overlayOpacity: 0.3,
      overlayColor: '#000000',
      effects: ['confetti', 'bubbles', 'aurora'],
      effectIntensity: 'medium',
    },
  },
  {
    id: 'summer',
    name: 'Verano / Tropical',
    emoji: '☀️',
    description: 'Tonos oceánicos frescos, burbujas vibrantes y brillo solar.',
    badgeColor: '#06b6d4',
    defaults: {
      enabled: true,
      season: 'summer',
      backgroundType: 'gradient',
      gradientStart: '#041f31',
      gradientEnd: '#0b4454',
      gradientDirection: '135deg',
      backgroundFixed: true,
      overlayOpacity: 0.25,
      overlayColor: '#000000',
      effects: ['bubbles', 'aurora', 'sparkles'],
      effectIntensity: 'medium',
    },
  },
  {
    id: 'autumn',
    name: 'Otoño',
    emoji: '🍂',
    description: 'Hojas doradas cayendo suavemente sobre tonos cálidos de temporada.',
    badgeColor: '#ea580c',
    defaults: {
      enabled: true,
      season: 'autumn',
      backgroundType: 'gradient',
      gradientStart: '#1f1007',
      gradientEnd: '#3d1e0b',
      gradientDirection: '135deg',
      backgroundFixed: true,
      overlayOpacity: 0.35,
      overlayColor: '#000000',
      effects: ['leaves', 'sparkles'],
      effectIntensity: 'medium',
    },
  },
  {
    id: 'halloween',
    name: 'Halloween',
    emoji: '🎃',
    description: 'Noche mística con murciélagos, neblina aurora y destellos ámbar.',
    badgeColor: '#f97316',
    defaults: {
      enabled: true,
      season: 'halloween',
      backgroundType: 'gradient',
      gradientStart: '#0c0514',
      gradientEnd: '#2a1008',
      gradientDirection: '135deg',
      backgroundFixed: true,
      overlayOpacity: 0.35,
      overlayColor: '#000000',
      effects: ['bats', 'aurora', 'sparkles'],
      effectIntensity: 'medium',
    },
  },
  {
    id: 'custom',
    name: 'Cambio Libre',
    emoji: '🎨',
    description: 'Diseña tu propio fondo (imagen, color o degradado) y combina los efectos que quieras.',
    badgeColor: '#10b981',
    defaults: {
      enabled: true,
      season: 'custom',
    },
  },
];

export const VISUAL_EFFECT_OPTIONS: VisualEffectOption[] = [
  {
    id: 'snow',
    name: 'Nieve Cayendo',
    emoji: '❄️',
    description: 'Copos suaves con movimiento natural de brisa.',
  },
  {
    id: 'christmas_lights',
    name: 'Luces Navideñas',
    emoji: '💡',
    description: 'Guirnalda luminosa parpadeante en la parte superior.',
  },
  {
    id: 'confetti',
    name: 'Confeti Festivo',
    emoji: '🎊',
    description: 'Papelillos multicolores celebrando en pantalla.',
  },
  {
    id: 'fireworks',
    name: 'Fuegos Artificiales',
    emoji: '🎆',
    description: 'Destellos y estallidos luminosos en el cielo.',
  },
  {
    id: 'sparkles',
    name: 'Estrellas / Destellos',
    emoji: '✨',
    description: 'Partículas brillantes doradas y blancas titilando.',
  },
  {
    id: 'hearts',
    name: 'Corazones',
    emoji: '💖',
    description: 'Corazones flotando suavemente hacia arriba.',
  },
  {
    id: 'leaves',
    name: 'Hojas de Otoño',
    emoji: '🍁',
    description: 'Hojas cálidas planeando por toda la página.',
  },
  {
    id: 'bubbles',
    name: 'Burbujas Tropicales',
    emoji: '🫧',
    description: 'Burbujas translúcidas con energía veraniega.',
  },
  {
    id: 'aurora',
    name: 'Resplandor Aurora',
    emoji: '🌌',
    description: 'Halos ambientales de color animados en movimiento.',
  },
  {
    id: 'bats',
    name: 'Murciélagos / Noche',
    emoji: '🦇',
    description: 'Siluetas nocturnas volando para Halloween.',
  },
];
