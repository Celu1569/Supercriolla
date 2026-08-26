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
    country: "Venezuela",
    enableAutoMetadata: true,
    defaultSlogan: "La Radio de la Buena Vibra",
    defaultCoverUrl: ""
  },
  navigation: {
    logoUrl: "https://i.ibb.co/ZptWRz8G/LOGO-2.png",
    showLogo: true,
    showTitle: true,
    headerTitle: "",
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
      showAnalyzer: true,
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
      description: "Mantente al día con lo último en música, espectáculos y entretenimiento.",
      articles: [
        {
          id: "news-1",
          title: "Gran Estreno Musical de la Semana en BUENÍSIMA",
          summary: "Los artistas más sonados del momento presentan sus nuevos sencillos en exclusiva para nuestra audiencia.",
          content: "Esta semana te traemos lo último de la música latina e internacional con los estrenos más esperados. Sintoniza nuestros programas en vivo para conocer todas las entrevistas exclusivas y lanzamientos en primicia.",
          date: "26 ago 2026",
          image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1000&auto=format&fit=crop",
          author: "Redacción BUENÍSIMA",
          category: "Música",
          isPublished: true
        },
        {
          id: "news-2",
          title: "Conoce la nueva programación y shows en vivo",
          summary: "Descubre todos los horarios, locutores y sorpresas preparadas para esta temporada.",
          content: "Nuestra parrilla de programación se renueva con nuevos segmentos de opinión, música variada, complacencias en vivo a través de nuestro chat interactivo y los mejores podcasts de la radio.",
          date: "25 ago 2026",
          image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1000&auto=format&fit=crop",
          author: "Equipo de Producción",
          category: "Estación",
          isPublished: true
        },
        {
          id: "news-3",
          title: "Lo más viral en redes sociales y tendencias del momento",
          summary: "Un repaso por las noticias y videos más comentados en el mundo digital.",
          content: "Las redes no se detienen y aquí en BUENÍSIMA te mantenemos al tanto de los videos más virales, tendencias de TikTok y momentos que están dando de qué hablar en todo el mundo.",
          date: "24 ago 2026",
          image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1000&auto=format&fit=crop",
          author: "Tendencias Digitales",
          category: "Entretenimiento",
          isPublished: true
        }
      ],
      rssFeeds: [
        {
          id: "rss-1",
          name: "Billboard Español",
          url: "https://billboard.com/feed/"
        }
      ]
    },
    topVideos: {
        enabled: true,
        title: "Top 5 más viral y comentado del momento",
        description: "Los vídeos y temas más virales y comentados del momento.",
        videos: [
          {
            id: "vid-1",
            title: "Karol G - Si Antes Te Hubiera Conocido",
            url: "https://www.youtube.com/watch?v=MsdYg36mCjU"
          },
          {
            id: "vid-2",
            title: "Feid, ATL Jacob - LUNA",
            url: "https://www.youtube.com/watch?v=FqG7u_m-qg8"
          },
          {
            id: "vid-3",
            title: "Manuel Turizo - La Bachata",
            url: "https://www.youtube.com/watch?v=TiM_TFpT_DE"
          },
          {
            id: "vid-4",
            title: "Shakira, Bizarrap - Bzrp Music Sessions #53",
            url: "https://www.youtube.com/watch?v=CocEMWrm9uc"
          },
          {
            id: "vid-5",
            title: "Camilo, Carin Leon - Una Vida Pasada",
            url: "https://www.youtube.com/watch?v=8V9Mh78mJ1I"
          }
        ]
    }
  },
  layout: {
    sections: [
      { id: 'hero', visible: true },
      { id: 'topvideos', visible: true },
      { id: 'ribbons', visible: true },
      { id: 'podcast', visible: true },
      { id: 'program', visible: true },
      { id: 'gallery', visible: true },
      { id: 'news', visible: true },
      { id: 'clients', visible: true },
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
