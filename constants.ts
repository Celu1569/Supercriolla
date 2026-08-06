import { SiteConfig } from './types';

export const DEFAULT_CONFIG: SiteConfig = {
  general: {
    stationName: "BUENÍSIMA",
    // User provided stream
    streamUrl: "https://redradioypc.com:8010/live", 
    fallbackStreamUrl: "",
    autoDJTracks: [],
    autoDJMode: 'alphabetical',
    logoUrl: "https://i.ibb.co/ZptWRz8G/LOGO-2.png", 
    contactEmail: "contacto@buenisima.com",
    contactPhone: "+584144105077",
    city: "Valencia",
    country: "Venezuela"
  },
  navigation: {
    logoUrl: "https://i.ibb.co/ZptWRz8G/LOGO-2.png",
    showLogo: true,
    logoHeight: 45,
    navBackgroundColor: "#0f172a",
    navTextColor: "#f8fafc",
    navActiveColor: "#fbbf24",
    navFontSize: 14,
    items: [
        { id: 'hero', label: "Inicio", visible: true, link: "#hero" },
        { id: 'podcast', label: "Podcast / En Vivo", visible: true, link: "#podcast" },
        { id: 'program', label: "Programación", visible: true, link: "#program" },
        { id: 'gallery', label: "Galería", visible: true, link: "#gallery" },
        { id: 'clients', label: "Clientes", visible: true, link: "#clients" },
        { id: 'news', label: "Noticias", visible: true, link: "#news" },
        { id: 'donations', label: "Chat", visible: true, link: "#donations" },
        { id: 'contact', label: "Contacto", visible: true, link: "#contact" }
    ]
  },
  appearance: {
    themeMode: 'dark',
    primaryColor: "#0f172a",
    secondaryColor: "#fbbf24",
    headingColor: "#f1f5f9",
    backgroundColor: "#ffffff",
    textColor: "#334155",
    headingFont: "Montserrat",
    bodyFont: "Inter",
    radioPlayer: {
      backgroundImages: ["https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=2070&auto=format&fit=crop"],
      blurIntensity: 0,
      brightness: 1,
      mixBlendMode: 'normal',
      showAnalyzer: true,
      opacity: 0.5,
      animationSpeed: 12
    }
  },
  content: {
    heroInterval: 5000,
    hero: [
      {
        id: 'slide-1',
        title: "BUENÍSIMA",
        subtitle: "La Radio de la Buena Vibra",
        image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=2070&auto=format&fit=crop",
        alignment: 'left',
        verticalAlignment: 'center',
        contentMaxWidth: 800,
        titleColor: '#ffffff',
        titleSize: 48,
        titleFont: 'Montserrat',
        titleBold: true,
        titleHighlight: false,
        titleHighlightColor: 'rgba(251, 191, 36, 0.4)',
        titleShadow: 'strong',
        titleOutline: 'none',
        titleOutlineColor: '#000000',
        titleOutlineWidth: 1,
        subtitleColor: '#fbbf24',
        subtitleSize: 22,
        subtitleFont: 'Inter',
        subtitleBold: true,
        subtitleHighlight: false,
        subtitleHighlightColor: 'rgba(251, 191, 36, 0.2)',
        subtitleShadow: 'soft',
        subtitleOutline: 'none',
        subtitleOutlineColor: '#000000',
        subtitleOutlineWidth: 1,
        showButton: true,
        buttonText: "Escuchar en Vivo",
        buttonLink: "#podcast",
        buttonColor: "#fbbf24",
        buttonTextColor: "#0f172a"
      }
    ],
    podcast: {
      title: "En Vivo",
      description: "Sintoniza la señal en vivo de BUENÍSIMA, la radio de la buena vibra.",
      liveUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      isLive: true,
      episodes: []
    },
    program: {
      title: "Nuestra Programación",
      description: "La mejor selección musical y entretenimiento para llenar tu día de buena vibra.",
      programs: [
        {
          id: 'prog-1',
          title: "Amanecer con Buena Vibra",
          description: "Inicia tu día con la mejor música y buena energía.",
          schedule: "Lunes a Viernes - 6:00 AM",
          announcerImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop"
        }
      ],
      weekendPrograms: []
    },
    gallery: {
      title: "Galería",
      description: "Momentos especiales en nuestra estación.",
      mode: 'manual',
      widgetCode: '',
      images: []
    },
    chat: {
      title: "Comunidad BUENÍSIMA",
      description: "Envía tus mensajes, saludos y peticiones en vivo.",
      enabled: true,
      allowVoiceNotes: true,
      allowFiles: true,
      primaryColor: "#25D366",
      secondaryColor: "#128C7E",
      backgroundColor: "#DCF8C6",
      adminName: "BUENÍSIMA Admin",
      phoneNumber: "+584144105077",
      requirePhone: true,
      containerBg: "#030712",
      messagesBg: "#030712",
      inputBg: "#111827",
      textColor: "#ffffff"
    },
    ribbons: [
      {
        id: 'ribbon-1',
        text: "¡Bienvenidos a BUENÍSIMA! La Radio de la Buena Vibra las 24 horas.",
        fontFamily: "Inter",
        fontSize: 16,
        textColor: "#ffffff",
        backgroundColor: "#fbbf24",
        speed: 20,
        visible: true
      }
    ],
    clients: [],
    news: {
      title: "Noticias y Novedades",
      description: "Mantente al día con lo último en música y entretenimiento.",
      articles: [],
      rssFeeds: []
    },
    topVideos: {
        enabled: true,
        title: "Top Vídeos",
        description: "Los vídeos y temas con la mejor vibra.",
        videos: []
    }
  },
  layout: {
    sections: [
      { id: 'hero', visible: true },
      { id: 'ribbons', visible: true },
      { id: 'podcast', visible: true },
      { id: 'program', visible: true },
      { id: 'chat', visible: true },
      { id: 'contact', visible: true }
    ]
  },
  social: {
    instagram: "https://instagram.com",
    tiktok: "https://tiktok.com",
    youtube: "https://youtube.com",
    whatsapp: "https://whatsapp.com"
  }
};
