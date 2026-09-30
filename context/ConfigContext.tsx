import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SiteConfig } from '../types';
import { DEFAULT_CONFIG } from '../constants';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth, hasFirebaseKeys } from '../firebase';
import { signOut } from 'firebase/auth';
import { resolveDirectImageUrl } from '../utils/imageUrl';

interface ConfigContextType {
  config: SiteConfig;
  updateConfig: (newConfig: SiteConfig) => Promise<boolean>;
  resetConfig: () => void;
  isAuthenticated: boolean;
  isConfigLoaded: boolean;
  login: (username?: string, password?: string) => Promise<boolean>;
  logout: () => void;
  resetDefaultAuth: () => Promise<boolean>;
  saveAuth: (username: string, password: string) => Promise<boolean>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children?: ReactNode;
}

// Helper to sanitize objects before state updates or storage
// This is critical to prevent circular references (DOM nodes, React Events) from crashing the app
const deepClean = (obj: any, seen = new WeakSet()): any => {
  // Primitives
  if (obj === null || typeof obj !== 'object') return obj;

  // Prevent Circular References
  if (seen.has(obj)) return undefined;
  
  // FILTER OUT DANGEROUS OBJECTS (DOM Nodes, Windows, Events)
  if (typeof Node !== 'undefined' && obj instanceof Node) return undefined;
  if (typeof Window !== 'undefined' && obj instanceof Window) return undefined;
  if (typeof Event !== 'undefined' && obj instanceof Event) return undefined;
  
  const typeStr = Object.prototype.toString.call(obj);
  if (typeStr.includes('Element') || typeStr.includes('Window') || typeStr.includes('Event') || typeStr.includes('Audio')) {
      return undefined;
  }

  if (obj.constructor && obj.constructor.name) {
      const name = obj.constructor.name;
      if (
        name.includes('Element') || 
        name === 'Window' || 
        name === 'HTMLAudioElement' || 
        name.includes('Event') ||
        name.includes('Fiber')
      ) return undefined;
  }
  
  if (typeof obj.nodeType === 'number' && typeof obj.nodeName === 'string') return undefined;
  if (obj.$$typeof || obj._reactInternals || obj._reactFiber) return undefined;

  seen.add(obj);

  if (obj instanceof Date) return obj.toISOString();

  if (Array.isArray(obj)) {
    const arr = [];
    for (const item of obj) {
       const cleaned = deepClean(item, seen);
       if (cleaned !== undefined) arr.push(cleaned);
    }
    return arr;
  }

  const res: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // ONLY filter out React/DOM specific keys, NOT user data
      if (
        key.startsWith('__react') ||
        key === 'stateNode' ||
        key === '_reactInternals' ||
        key === '_reactFiber'
      ) continue;
      
      const cleaned = deepClean(obj[key], seen);
      if (cleaned !== undefined) {
        res[key] = cleaned;
      }
    }
  }
  return res;
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

const STORAGE_KEY = 'buenisima_radio_site_config_v3';
const BACKUP_STORAGE_KEY = 'buenisima_radio_site_config_backup';
const ALL_STORAGE_KEYS = [
  'buenisima_radio_site_config_v3',
  'buenisima_radio_site_config_backup',
  'buenisima_radio_site_config_v2',
  'buenisima_radio_site_config_v1',
  'buenisima_radio_site_config',
  'radio_site_config'
];

const getInitialCachedConfig = (): SiteConfig => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      // Check current and all previous/backup keys to never lose customized content
      for (const key of ALL_STORAGE_KEYS) {
        const cached = localStorage.getItem(key);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object' && parsed.general) {
              // Ensure we maintain a synced backup
              if (key !== STORAGE_KEY) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
              }
              if (key !== BACKUP_STORAGE_KEY) {
                localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(parsed));
              }
              return parsed;
            }
          } catch (pe) {
            // Ignore invalid JSON in an older key and keep trying
          }
        }
      }
    } catch (e) {
      console.warn("Could not load cached config from localStorage", e);
    }
  }
  return DEFAULT_CONFIG;
};

const sanitizeBrandConfig = (cfg: SiteConfig): SiteConfig => {
  if (!cfg || typeof cfg !== 'object') return DEFAULT_CONFIG;
  
  // Deep copy to avoid mutating original
  const c = JSON.parse(JSON.stringify(cfg)) as SiteConfig;

  // Helper to ensure path exists without overwriting user data
  const ensure = (target: any, path: string, defaultValue: any) => {
    const parts = path.split('.');
    let curr = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]]) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    const lastPart = parts[parts.length - 1];
    if (curr[lastPart] === undefined || curr[lastPart] === null || curr[lastPart] === '') {
      curr[lastPart] = defaultValue;
      return true;
    }
    return false;
  };

  // Ensure root sections exist without overwriting sub-properties
  if (!c.general) c.general = { ...DEFAULT_CONFIG.general };
  if (!c.appearance) c.appearance = { ...DEFAULT_CONFIG.appearance };
  if (!c.navigation) c.navigation = { ...DEFAULT_CONFIG.navigation };
  if (!c.content) c.content = { ...DEFAULT_CONFIG.content };
  if (!c.layout) c.layout = { ...DEFAULT_CONFIG.layout };
  if (!c.social) c.social = { ...DEFAULT_CONFIG.social };

  // Safeguard: Only set default if user has never specified a station name or colors
  if (!c.general.stationName) c.general.stationName = DEFAULT_CONFIG.general.stationName;
  if (!c.appearance.primaryColor) c.appearance.primaryColor = DEFAULT_CONFIG.appearance.primaryColor;
  
  // Hero slides - PRESERVE user uploaded images and slides completely
  if (!c.content.hero || !Array.isArray(c.content.hero) || c.content.hero.length === 0) {
    c.content.hero = [...DEFAULT_CONFIG.content.hero];
  }

  // Top Videos section - ensure structure but NEVER overwrite user videos
  if (!c.content.topVideos) {
    c.content.topVideos = { ...DEFAULT_CONFIG.content.topVideos };
  } else {
    if (c.content.topVideos.enabled === undefined) c.content.topVideos.enabled = true;
    if (!c.content.topVideos.title) c.content.topVideos.title = "Más viral y comentado";
    if (!c.content.topVideos.videos) c.content.topVideos.videos = [];
  }

  // News section - ensure structure but NEVER overwrite user articles
  if (!c.content.news) {
    c.content.news = { ...DEFAULT_CONFIG.content.news };
  } else {
    if (!c.content.news.articles) c.content.news.articles = [];
    if (!c.content.news.rssFeeds) c.content.news.rssFeeds = [];
  }

  // Gallery section - ensure structure and preserve user images
  if (!c.content.gallery) {
    c.content.gallery = { ...DEFAULT_CONFIG.content.gallery };
  } else {
    if (!c.content.gallery.images) c.content.gallery.images = [];
  }

  // Clients / Partners - ensure array exists without wiping items
  if (!c.content.clients) {
    c.content.clients = DEFAULT_CONFIG.content.clients ? [...DEFAULT_CONFIG.content.clients] : [];
  }

  // Radio Player appearance and logic consolidation
  if (!c.appearance.radioPlayer) {
    c.appearance.radioPlayer = { ...DEFAULT_CONFIG.appearance.radioPlayer };
  } else {
    const rp = c.appearance.radioPlayer;
    const gen = c.general as any;

    // Migrate from General to RadioPlayer if present
    if (gen.autoDJTracks && (!rp.autoDJTracks || rp.autoDJTracks.length === 0)) {
        rp.autoDJTracks = gen.autoDJTracks;
    }
    if (gen.autoDJMode && !rp.autoDJMode) {
        rp.autoDJMode = gen.autoDJMode;
    }
    if (gen.defaultSlogan && !rp.slogan) {
        rp.slogan = gen.defaultSlogan;
    }
    if (gen.defaultCoverUrl && !rp.customCoverUrl) {
        rp.customCoverUrl = gen.defaultCoverUrl;
    }

    if (rp.showAnalyzer === undefined) rp.showAnalyzer = true;
    // Always enable live metadata and cover art so listeners see song titles and covers
    rp.showMetadata = true;
    rp.showCover = true;
    if (rp.videoMode === undefined) rp.videoMode = false;
    if (!rp.videoUrl) rp.videoUrl = '';
    if (!rp.videoLayout) rp.videoLayout = 'compact';
    if (!rp.playerStyle) rp.playerStyle = 'modern';
    
    if (rp.customCoverUrl) {
      rp.customCoverUrl = resolveDirectImageUrl(rp.customCoverUrl);
    } else {
      rp.customCoverUrl = 'https://i.ibb.co/kVQLN1F1/Logo-Buenisima-esfera-512x256.png';
    }
    
    if (rp.videoWidth === undefined) rp.videoWidth = 320;
    if (rp.videoHeight === undefined) rp.videoHeight = 180;
    
    if (!rp.slogan) rp.slogan = "La Radio de la Buena Vibra";
    if (!rp.autoDJTracks) rp.autoDJTracks = [];
    if (!rp.autoDJMode) rp.autoDJMode = 'alphabetical';
  }

  // Program section
  if (!c.content.program) {
    c.content.program = { ...DEFAULT_CONFIG.content.program };
  } else {
    if (!c.content.program.layoutStyle) c.content.program.layoutStyle = 'grid';
    if (!c.content.program.programs) c.content.program.programs = [];
    if (!c.content.program.weekendPrograms) c.content.program.weekendPrograms = [];
  }

  // Ensure layout sections are present without altering user visibility order
  const defaultSectionIds = ['hero', 'topvideos', 'ribbons', 'podcast', 'program', 'gallery', 'news', 'clients', 'chat', 'contact'];
  if (!c.layout.sections || c.layout.sections.length === 0) {
    c.layout.sections = defaultSectionIds.map(id => ({ id, visible: true }));
  } else {
    const existingIds = new Set(c.layout.sections.map(s => s.id));
    defaultSectionIds.forEach(id => {
      if (!existingIds.has(id)) {
        c.layout.sections.push({ id, visible: true });
      }
    });
  }

  return c;
};

export const ConfigProvider = ({ children }: ConfigProviderProps) => {
  const [config, setConfig] = useState<SiteConfig>(getInitialCachedConfig);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Sync config with Firestore
  useEffect(() => {
    if (!hasFirebaseKeys || !db) {
        console.log("Firebase keys missing. Operating in standalone mode with cached/default config.");
        setIsConfigLoaded(true);
        return;
    }

    const configDocRef = doc(db, 'settings', 'config');
    
    // Realtime sync
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const firestoreConfig = snapshot.data() as SiteConfig;
        const sanitized = sanitizeBrandConfig(firestoreConfig);
        
        setConfig(sanitized);
        try {
          if (typeof window !== 'undefined') {
            const jsonStr = JSON.stringify(sanitized);
            localStorage.setItem(STORAGE_KEY, jsonStr);
            localStorage.setItem(BACKUP_STORAGE_KEY, jsonStr);
          }
        } catch (lsErr) {
          console.warn("Could not cache Firestore config locally", lsErr);
        }
      } else {
        // If doc doesn't exist, use cached/default and initialize it in Firestore with user's customized data
        console.log("Config document missing in Firestore. Preserving cached configuration.");
        const initial = getInitialCachedConfig();
        setConfig(initial);
        
        if (hasFirebaseKeys && db) {
            try {
                setDoc(configDocRef, deepClean(initial));
            } catch (initErr) {
                console.error("Failed to initialize config in Firestore", initErr);
            }
        }
      }
      setIsConfigLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/config');
      setIsConfigLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  const updateConfig = async (newConfig: SiteConfig): Promise<boolean> => {
    const cleaned = deepClean(newConfig);
    if (!cleaned) return false; 
    
    // 1. Always update locally immediately for snappy UI
    setConfig(cleaned);

    // 2. Persist to localStorage immediately (both primary and backup keys)
    try {
      if (typeof window !== 'undefined') {
        const jsonStr = JSON.stringify(cleaned);
        localStorage.setItem(STORAGE_KEY, jsonStr);
        localStorage.setItem(BACKUP_STORAGE_KEY, jsonStr);
      }
    } catch (lsErr) {
      console.warn("LocalStorage save error:", lsErr);
    }

    if (!hasFirebaseKeys || !db) {
        console.warn("Cannot sync to Firestore: Firebase keys missing.");
        return true;
    }
    
    // 3. Sync to Firestore in Cloud
    try {
      const configDocRef = doc(db, 'settings', 'config');
      await setDoc(configDocRef, cleaned);
      return true;
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'settings/config');
      console.warn("Could not sync config changes to Firestore; changes stored locally in app state & localStorage.");
      return false;
    }
  };

  const resetConfig = async () => {
    if (confirm("¿Estás seguro de restablecer toda la configuración por defecto?")) {
        setConfig(DEFAULT_CONFIG);
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
            }
        } catch (e) {}

        if (!hasFirebaseKeys || !db) return;

        try {
            const configDocRef = doc(db, 'settings', 'config');
            await setDoc(configDocRef, DEFAULT_CONFIG);
        } catch (e) {
            console.error("Failed to reset config in firestore", e);
        }
    }
  };

  // Check auth state from Local Storage for persistence
  useEffect(() => {
    const isAuth = localStorage.getItem('radio_admin_auth') === 'true';
    if (isAuth) {
        setIsAuthenticated(true);
    }
  }, []);

  const login = async (username?: string, password?: string) => {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!hasFirebaseKeys || !db) {
        // Standalone mode - no auth possible without Firebase
        return false;
    }
    
    try {
      const authDocRef = doc(db, 'settings', 'auth');
      const snap = await getDoc(authDocRef).catch(err => {
          console.warn("Error al leer credenciales desde Firestore:", err);
          return null;
      });
      
      if (snap && snap.exists()) {
        const data = snap.data();
        const validUser = (data.username || '').trim().toLowerCase();
        const validPass = (data.password || '').trim();
        
        if (cleanUser === validUser && cleanPass === validPass && validPass.length >= 8) {
          setIsAuthenticated(true);
          localStorage.setItem('radio_admin_auth', 'true');
          return true;
        }
      }
      
      return false;
    } catch (e) {
      console.error("Firestore Auth Error:", e);
      return false;
    }
  };

  const resetDefaultAuth = async () => {
    // Only allow resetting to a specific secure key if requested, 
    // but the user wants to ELIMINATE the factory default.
    // I will return false to disable this feature or make it a no-op that needs manual Firestore action.
    console.warn("Reset to default auth disabled for security.");
    return false;
  };

  const saveAuth = async (username: string, password: string) => {
    if (!hasFirebaseKeys || !db) return false;
    try {
      const authDocRef = doc(db, 'settings', 'auth');
      await setDoc(authDocRef, { username, password });
      return true;
    } catch (e) {
      console.error("Error saving auth:", e);
      return false;
    }
  };

  const logout = async () => {
    localStorage.removeItem('radio_admin_auth');
    setIsAuthenticated(false);
    if (hasFirebaseKeys) {
        try {
            await signOut(auth);
        } catch (e) {}
    }
  };

  return (
    <ConfigContext.Provider value={{ config, updateConfig, resetConfig, isAuthenticated, isConfigLoaded, login, logout, resetDefaultAuth, saveAuth }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};