import { SiteConfig } from './types';

export const DEFAULT_CONFIG: SiteConfig = {
  general: {
    stationName: "BUENÍSIMA",
    // User provided stream
    streamUrl: "https://redradioypc.com:8010/live", 
    logoUrl: "https://i.ibb.co/ZptWRz8G/LOGO-2.png", 
    contactEmail: "contacto@buenisima.com",
    contactPhone: "+584144105077",
    city: "Valencia",
    country: "Venezuela",
    metaDescription: "Escucha BUENÍSIMA en vivo, la radio de la buena vibra. Música, programación, noticias, podcasts y entretenimiento las 24 horas.",
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
      showMetadata: true,
      showCover: true,
      videoMode: false,
      videoUrl: "",
      videoWidth: 320,
      videoHeight: 180,
      videoLayout: 'compact',
      playerStyle: 'modern',
      customCoverUrl: "https://i.ibb.co/kVQLN1F1/Logo-Buenisima-esfera-512x256.png",
      slogan: "La Radio de la Buena Vibra",
      autoDJTracks: [],
      autoDJMode: 'alphabetical',
      enableAutoMetadata: true,
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
      layoutStyle: 'cards',
      autoPlay: true,
      scrollMode: 'continuous',
      speed: 38,
      interval: 4000,
      direction: 'horizontal',
      infiniteLoop: true,
      pauseOnHover: true,
      scrollStep: 320,
      programs: [
        {
          id: 'prog-1',
          title: "Amanecer con Buena Vibra",
          description: "Inicia tu día con la mejor música, noticias positivas y buena energía.",
          schedule: "Lunes a Viernes - 6:00 AM",
          announcerName: "Kenny García",
          announcerImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop",
          socialLinks: {
            instagram: "https://instagram.com/buenisima877fm",
            tiktok: "https://tiktok.com/@buenisima877fm",
            whatsapp: "https://wa.me/584241555789"
          }
        },
        {
          id: 'prog-2',
          title: "La Mañana Buenísimas",
          description: "Entretenimiento, notas de actualidad, entrevistas y los hits del momento.",
          schedule: "Lunes a Viernes - 9:00 AM",
          announcerName: "Glendy García",
          announcerImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop",
          socialLinks: {
            instagram: "https://instagram.com/buenisima877fm",
            facebook: "https://facebook.com/buenisima877fm",
            whatsapp: "https://wa.me/584241555789"
          }
        },
        {
          id: 'prog-3',
          title: "El Conteo & Éxitos",
          description: "El ranking de las canciones más pedidas y sonadas en toda la región.",
          schedule: "Lunes a Viernes - 12:00 PM",
          announcerName: "Carlos Méndez",
          announcerImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop",
          socialLinks: {
            instagram: "https://instagram.com/buenisima877fm",
            twitter: "https://x.com/buenisima877fm"
          }
        },
        {
          id: 'prog-4',
          title: "Tardes de Buena Vibra",
          description: "Acompaña tu tarde con la mejor selección musical y complacencias en vivo.",
          schedule: "Lunes a Viernes - 3:00 PM",
          announcerName: "Mariana Rivas",
          announcerImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop",
          socialLinks: {
            instagram: "https://instagram.com/buenisima877fm",
            tiktok: "https://tiktok.com/@buenisima877fm",
            whatsapp: "https://wa.me/584241555789"
          }
        },
        {
          id: 'prog-5',
          title: "Conexión Tropical & Urbana",
          description: "El ritmo y la potencia de los grandes géneros latinos para activar tu día.",
          schedule: "Lunes a Viernes - 6:00 PM",
          announcerName: "DJ Alexander",
          announcerImage: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop",
          socialLinks: {
            instagram: "https://instagram.com/buenisima877fm",
            youtube: "https://youtube.com/@buenisima877fm"
          }
        },
        {
          id: 'prog-6',
          title: "Baladas & Recuerdos de Oro",
          description: "Los clásicos que marcaron tu vida en una noche íntima e inolvidable.",
          schedule: "Lunes a Viernes - 9:00 PM",
          announcerName: "Héctor Valero",
          announcerImage: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=400&auto=format&fit=crop",
          socialLinks: {
            instagram: "https://instagram.com/buenisima877fm",
            facebook: "https://facebook.com/buenisima877fm"
          }
        }
      ],
      weekendPrograms: [
        {
          id: 'prog-we-1',
          title: "Fiesta Fin de Semana",
          description: "Música bailable, mezclas exclusivas y la mejor energía para el sábado.",
          schedule: "Sábados - 10:00 AM",
          announcerName: "DJ Alexander",
          announcerImage: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?q=80&w=400&auto=format&fit=crop",
          socialLinks: {
            instagram: "https://instagram.com/buenisima877fm",
            tiktok: "https://tiktok.com/@buenisima877fm"
          }
        },
        {
          id: 'prog-we-2',
          title: "Domingos de Clásicos",
          description: "Las melodías que trascienden generaciones para disfrutar en familia.",
          schedule: "Domingos - 8:00 AM",
          announcerName: "Kenny García",
          announcerImage: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?q=80&w=400&auto=format&fit=crop",
          socialLinks: {
            instagram: "https://instagram.com/buenisima877fm",
            whatsapp: "https://wa.me/584241555789"
          }
        }
      ]
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
        title: "Más viral y comentado",
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
  advertising: {
    enabled: true,
    position: 'left',
    title: "Publicidad & Aliados",
    banners: [
      {
        id: "ad-banner-1",
        title: "Publicidad Vertical Buenísima",
        imageUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800&auto=format&fit=crop",
        linkUrl: "https://wa.me/584241555789?text=Hola%20Buen%C3%ADsima%20Radio,%20deseo%20pautar%20publicidad",
        format: "vertical",
        active: true
      },
      {
        id: "ad-banner-2",
        title: "Espacio Publicitario Cuadrado",
        imageUrl: "https://images.unsplash.com/photo-1542744094-3a31f272c490?q=80&w=600&auto=format&fit=crop",
        linkUrl: "https://wa.me/584241555789?text=Hola%20Buen%C3%ADsima%20Radio,%20deseo%20informaci%C3%B3n%20publicitaria",
        format: "square",
        active: true
      }
    ]
  },
  songRequest: {
    enabled: true,
    whatsappNumber: "0424 1555789",
    title: "Pide tu Canción",
    subtitle: "Directo a nuestra cabina por WhatsApp"
  },
  social: {
    instagram: "https://instagram.com",
    tiktok: "https://tiktok.com",
    youtube: "https://youtube.com",
    whatsapp: "https://wa.me/584241555789"
  }
};
