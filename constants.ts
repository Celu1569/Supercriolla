import { SiteConfig } from './types';

export const DEFAULT_CONFIG: SiteConfig = {
  general: {
    stationName: "SUPERCRIOLLA 98.7 FM",
    // User provided stream
    streamUrl: "https://redradioypc.com:8010/live", 
    fallbackStreamUrl: "",
    autoDJTracks: [],
    autoDJMode: 'alphabetical',
    logoUrl: "https://cdn-icons-png.flaticon.com/512/7508/7508493.png", // Generic Radio Icon as Logo Placeholder
    contactEmail: "supercriolla@gmail.com",
    contactPhone: "+584144105077",
    city: "Valencia",
    country: "Venezuela"
  },
  navigation: {
    logoUrl: "https://cdn-icons-png.flaticon.com/512/7508/7508493.png",
    showLogo: true,
    logoHeight: 45, // Default height
    navBackgroundColor: "#0f172a", // Slate 900
    navTextColor: "#f8fafc", // Slate 50
    navActiveColor: "#fbbf24", // Amber 400
    navFontSize: 14, // Default font size
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
    themeMode: 'dark', // Default to dark
    primaryColor: "#0f172a", // Slate 900
    secondaryColor: "#fbbf24", // Amber 400
    headingColor: "#f1f5f9", // Slate 100
    backgroundColor: "#ffffff",
    textColor: "#334155", // Slate 700
    headingFont: "Montserrat",
    bodyFont: "Inter"
  },
  content: {
    heroInterval: 5000, // 5 Seconds default
    hero: [
      {
        id: 'slide-1',
        title: "Tu Conexión con la nueva Supercriolla",
        subtitle: "La mejor música venezolana las 24 horas.",
        image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=2070&auto=format&fit=crop", // Professional Microphone/Studio
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
        subtitleSize: 18,
        subtitleFont: 'Inter',
        subtitleBold: false,
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
      },
      {
        id: 'slide-2',
        title: "Talentos en vivo sin Límites",
        subtitle: "Únete a nuestra programacion variada y entretenida.",
        image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop", // Concert/Worship Crowd
        alignment: 'center',
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
        subtitleColor: '#ffffff',
        subtitleSize: 18,
        subtitleFont: 'Inter',
        subtitleBold: false,
        subtitleHighlight: false,
        subtitleHighlightColor: 'rgba(251, 191, 36, 0.2)',
        subtitleShadow: 'soft',
        subtitleOutline: 'none',
        subtitleOutlineColor: '#000000',
        subtitleOutlineWidth: 1,
        showButton: true,
        buttonText: "Ver Eventos",
        buttonLink: "#gallery",
        buttonColor: "#ffffff",
        buttonTextColor: "#0f172a"
      },
      {
        id: 'slide-3',
        title: "Supercriolla la Nueva Era",
        subtitle: "Ahora la musica de venezuela tiene quien la represente.",
        image: "https://images.unsplash.com/photo-1478737270239-2f02b77ac6d5?q=80&w=2070&auto=format&fit=crop", // Studio Equipment
        alignment: 'right',
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
        subtitleSize: 18,
        subtitleFont: 'Inter',
        subtitleBold: false,
        subtitleHighlight: false,
        subtitleHighlightColor: 'rgba(251, 191, 36, 0.2)',
        subtitleShadow: 'soft',
        subtitleOutline: 'none',
        subtitleOutlineColor: '#000000',
        subtitleOutlineWidth: 1,
        showButton: true,
        buttonText: "Chat",
        buttonLink: "#donations",
        buttonColor: "#fbbf24",
        buttonTextColor: "#0f172a"
      }
    ],
    podcast: {
      title: "En Vivo",
      description: "Conéctate a nuestra señal de video en tiempo real.",
      liveUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk", // Lofi Girl as reliable placeholder
      isLive: true,
      episodes: [
        {
          id: 'ep-1',
          title: "Entrevista: ",
          date: "10 Oct 2023",
          image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1000&auto=format&fit=crop", // Corporate/Interview
          videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        },
        {
          id: 'ep-2',
          title: "Noche de Parrandas",
          date: "03 Oct 2023",
          image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1000&auto=format&fit=crop", // Music/Microphone
          videoUrl: "https://www.youtube.com/watch?v=LXb3EKWsInQ"
        },
        {
          id: 'ep-3',
          title: "El Poder Vocal",
          date: "25 Sep 2023",
          image: "https://images.unsplash.com/photo-1445445290350-12a3b8afc971?q=80&w=1000&auto=format&fit=crop", // Nature/Peaceful
          videoUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk"
        }
      ]
    },
    program: {
      title: "Nuestra Programación",
      description: "La mejor selección de música llanera, folklore y cultura venezolana para acompañarte todo el día.",
      programs: [
        {
          id: 'prog-1',
          title: "Amanecer Criollo",
          description: "Inicia tu día con las mejores tonadas, pasajes y el sentir de nuestra tierra venezolana.",
          schedule: "Lunes a Viernes - 6:00 AM",
          announcerImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop"
        },
        {
          id: 'prog-2',
          title: "Ruta Llanera",
          description: "Acompañamos tu mañana con contrapunteos, noticias del llano y entrevistas a grandes exponentes del folklore.",
          schedule: "Lunes a Viernes - 9:00 AM",
          announcerImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop"
        },
        {
          id: 'prog-3',
          title: "Atardecer de Coplas",
          description: "Un tiempo para disfrutar de la música recia y el arpa, cuatro y maracas en el cierre de tu jornada.",
          schedule: "Lunes a Domingo - 6:00 PM",
          announcerImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop"
        }
      ],
      weekendPrograms: [
        {
          id: 'weekend-1',
          title: "Fiesta Llanera",
          description: "Los mejores éxitos del folklore para disfrutar tu fin de semana con alegría y tradición.",
          schedule: "Sábados y Domingos - 10:00 AM",
          announcerImage: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=400&auto=format&fit=crop"
        }
      ]
    },
    gallery: {
      title: "Supercriolla Social",
      description: "Sigue nuestras redes sociales y mantente al día con lo mejor del folklore venezolano.",
      images: [
        {
            id: 'gal-1',
            url: "https://www.instagram.com/p/C4I-R4xO4_X/",
            type: 'instagram',
            format: 'portrait',
            caption: "Nuestra última presentación en vivo"
        },
        {
            id: 'gal-2',
            url: "https://www.tiktok.com/@tiktok/video/7106594312292453675",
            type: 'tiktok',
            format: 'landscape',
            caption: "Anuncio del Gran Festival Llanero"
        },
        {
            id: 'gal-3',
            url: "https://www.tiktok.com/@supercriolla/video/7342156789012345678",
            type: 'tiktok',
            format: 'portrait',
            caption: "Detrás de cámaras en cabina"
        },
        {
            id: 'gal-4',
            url: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=1000&auto=format&fit=crop",
            type: 'image',
            format: 'landscape',
            caption: "Festival de la Voz Criolla"
        }
      ]
    },
    chat: {
      title: "Comunidad Supercriolla",
      description: "Envía tus saludos, peticiones musicales y notas de voz para interactuar con nosotros.",
      enabled: true,
      allowVoiceNotes: true,
      allowFiles: true,
      primaryColor: "#25D366", // WhatsApp Green
      secondaryColor: "#128C7E", // WhatsApp Dark Green
      backgroundColor: "#DCF8C6", // WhatsApp Light Green
      adminName: "Supercriolla Admin",
      phoneNumber: "+584144105077",
      requirePhone: true,
      containerBg: "#030712", // gray-950
      messagesBg: "#030712", // gray-950
      inputBg: "#111827", // gray-900
      textColor: "#ffffff"
    },
    ribbons: [
      {
        id: 'ribbon-1',
        text: "¡Bienvenidos a Supercriolla 98.7 Fm! La emisora que resalta nuestro folklore venezolano las 24 horas.",
        fontFamily: "Inter",
        fontSize: 16,
        textColor: "#ffffff",
        backgroundColor: "#fbbf24",
        speed: 20,
        visible: true
      }
    ],
    clients: [
      {
        id: 'client-1',
        name: "Quesera El Llano",
        bannerUrl: "https://images.unsplash.com/photo-1486299267070-83823f5448dd?q=80&w=1000&auto=format&fit=crop",
        whatsapp: "+584140000001",
        instagram: "https://instagram.com/queseraelllano",
        facebook: "https://facebook.com/queseraelllano",
        address: "Av. Principal, Valencia, Carabobo",
        mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3926.368383214534!2d-68.0044!3d10.2333!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTDCsDE0JzAwLjAiTiA2OMKwMDAnMTUuOCJX!5e0!3m2!1ses!2sve!4v1634567890123!5m2!1ses!2sve",
        productImages: [
          "https://images.unsplash.com/photo-1552767059-ce182ead6c1b?q=80&w=400&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1589927986089-35812388d1f4?q=80&w=400&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1452195100486-9cc805987862?q=80&w=400&auto=format&fit=crop"
        ]
      },
      {
        id: 'client-2',
        name: "Arpistas Unidos",
        bannerUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1000&auto=format&fit=crop",
        whatsapp: "+584140000002",
        instagram: "https://instagram.com/arpistasunidos",
        address: "Calle del Arpa, San Juan de los Morros",
        mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3931.123456789012!2d-67.35!3d9.91!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zOcKwNTQnMzYuMCJOIDY3wrAyMScwMC4wIlc!5e0!3m2!1ses!2sve!4v1634567890456!5m2!1ses!2sve",
        productImages: [
          "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=400&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=400&auto=format&fit=crop"
        ]
      },
      {
        id: 'client-3',
        name: "Sombreros El Guate",
        bannerUrl: "https://images.unsplash.com/photo-1533441690026-070ad74353bb?q=80&w=1000&auto=format&fit=crop",
        whatsapp: "+584140000003",
        instagram: "https://instagram.com/sombreroselguate",
        address: "Mercado Principal, Barquisimeto",
        mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3928.123456789012!2d-69.3!3d10.06!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTDCsDAzJzM2LjAiTiA2OcKwMTgnMDAuMCJX!5e0!3m2!1ses!2sve!4v1634567890789!5m2!1ses!2sve",
        productImages: [
          "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?q=80&w=400&auto=format&fit=crop"
        ]
      },
      {
        id: 'client-4',
        name: "Carnicería Los Toros",
        bannerUrl: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?q=80&w=1000&auto=format&fit=crop",
        whatsapp: "+584140000004",
        address: "Av. Bolívar, Maracay",
        productImages: [
          "https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=400&auto=format&fit=crop"
        ]
      },
      {
        id: 'client-5',
        name: "Inversiones El Caney",
        bannerUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000&auto=format&fit=crop",
        whatsapp: "+584140000005",
        instagram: "https://instagram.com/elcaneyinv",
        address: "Sector El Castaño, Maracay",
        productImages: [
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=400&auto=format&fit=crop"
        ]
      }
    ],
    news: {
      title: "Noticias de Actualidad",
      description: "Mantente informado con las últimas noticias del mundo folclórico y cultural.",
      articles: [
        {
          id: 'news-1',
          title: "Gran Festival de la Voz Llanera 2024",
          summary: "Se anuncian las fechas para el evento más esperado del año en el llano venezolano.",
          content: "El comité organizador ha confirmado que el festival se llevará a cabo del 15 al 20 de mayo en San Juan de los Morros. Se esperan más de 50 participantes de todo el país.",
          date: "15 Abr 2024",
          image: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=1000&auto=format&fit=crop",
          author: "Redacción Supercriolla",
          category: "Eventos",
          isPublished: true
        },
        {
          id: 'news-2',
          title: "Homenaje a Simón Díaz en su aniversario",
          summary: "Diversos artistas se unen para recordar el legado del Tío Simón.",
          content: "Con un concierto sinfónico en la capital, se rendirá tributo a uno de los máximos exponentes de nuestra música. El evento contará con la participación de figuras internacionales.",
          date: "12 Mar 2024",
          image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1000&auto=format&fit=crop",
          author: "Cultura Hoy",
          category: "Cultura",
          isPublished: true
        }
      ],
      rssFeeds: []
    },
    topVideos: {
        enabled: true,
        title: "Los 5 Latigazos de la semana",
        description: "Los estrenos y artistas del llano venezolano que más suenan.",
        videos: [
            { id: "v1", title: "Latigazo 1", url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk" },
            { id: "v2", title: "Latigazo 2", url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk" },
            { id: "v3", title: "Latigazo 3", url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk" },
            { id: "v4", title: "Latigazo 4", url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk" },
            { id: "v5", title: "Latigazo 5", url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk" }
        ]
    }
  },
  social: {
    facebook: "https://facebook.com",
    instagram: "https://instagram.com",
    tiktok: "https://tiktok.com",
    youtube: "https://youtube.com",
    whatsapp: "https://whatsapp.com"
  }
};