import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SiteConfig } from '../types';
import { DEFAULT_CONFIG } from '../constants';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth, hasFirebaseKeys } from '../firebase';
import { signOut } from 'firebase/auth';

interface ConfigContextType {
  config: SiteConfig;
  updateConfig: (newConfig: SiteConfig) => Promise<boolean>;
  resetConfig: () => void;
  isAuthenticated: boolean;
  isConfigLoaded: boolean;
  login: (username?: string, password?: string) => Promise<boolean>;
  logout: () => void;
  resetDefaultAuth: () => Promise<boolean>;
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

const getInitialCachedConfig = (): SiteConfig => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && parsed.general) {
          return parsed;
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

  // Helper to ensure path exists and merge with default values ONLY if missing
  const ensure = (target: any, path: string, defaultValue: any) => {
    const parts = path.split('.');
    let curr = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]]) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    const lastPart = parts[parts.length - 1];
    if (curr[lastPart] === undefined || curr[lastPart] === null) {
      curr[lastPart] = defaultValue;
      return true;
    }
    return false;
  };

  // Ensure root sections exist
  if (!c.general) c.general = { ...DEFAULT_CONFIG.general };
  if (!c.appearance) c.appearance = { ...DEFAULT_CONFIG.appearance };
  if (!c.navigation) c.navigation = { ...DEFAULT_CONFIG.navigation };
  if (!c.content) c.content = { ...DEFAULT_CONFIG.content };
  if (!c.layout) c.layout = { ...DEFAULT_CONFIG.layout };
  if (!c.social) c.social = { ...DEFAULT_CONFIG.social };

  // Specific critical fields
  ensure(c, 'general.stationName', DEFAULT_CONFIG.general.stationName);
  ensure(c, 'appearance.primaryColor', DEFAULT_CONFIG.appearance.primaryColor);
  
  // Top Videos section - ensure structure but DON'T overwrite arrays if they exist
  if (!c.content.topVideos) {
    c.content.topVideos = { ...DEFAULT_CONFIG.content.topVideos };
  } else {
    if (c.content.topVideos.enabled === undefined) c.content.topVideos.enabled = true;
    if (!c.content.topVideos.title) c.content.topVideos.title = "Más viral y comentado";
    if (!c.content.topVideos.videos) c.content.topVideos.videos = [];
  }

  // News section
  if (!c.content.news) {
    c.content.news = { ...DEFAULT_CONFIG.content.news };
  } else {
    if (!c.content.news.articles) c.content.news.articles = [];
    if (!c.content.news.rssFeeds) c.content.news.rssFeeds = [];
  }

  // Ensure layout sections are present
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
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
          }
        } catch (lsErr) {
          console.warn("Could not cache Firestore config locally", lsErr);
        }
      } else {
        // If doc doesn't exist, use cached/default and attempt to initialize it in Firestore
        console.log("Config document missing in Firestore. Initializing with defaults.");
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

    // 2. Persist to localStorage immediately
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
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

    // Emergency Fallback Usernames & Passwords
    const isAdminUser = cleanUser === 'admin' || 
                        cleanUser === 'administrador' ||
                        cleanUser === 'buenisima' || 
                        cleanUser === 'buenisimaradio' || 
                        cleanUser === 'uncion' ||
                        cleanUser === 'uncionradio' ||
                        cleanUser === 'uncionradio87.7fm' || 
                        cleanUser === 'uncionradio87.7fm@gmail.com';

    const isUniversalMasterPass = cleanPass === 'buenisima123' || 
                                  cleanPass === 'admin' || 
                                  cleanPass === 'admin123' || 
                                  cleanPass === '123456';

    if (!hasFirebaseKeys) {
        if (isAdminUser || cleanPass === 'buenisima123') {
            setIsAuthenticated(true);
            localStorage.setItem('radio_admin_auth', 'true');
            return true;
        }
        return false;
    }
    
    try {
      const authDocRef = doc(db, 'settings', 'auth');
      const snap = await getDoc(authDocRef).catch(err => {
          console.warn("Error al leer credenciales desde Firestore, usando modo emergencia:", err);
          return null;
      });
      
      let validUser = 'admin';
      let validPass = 'buenisima123';
      
      if (snap && snap.exists()) {
        const data = snap.data();
        validUser = (data.username || validUser).trim().toLowerCase();
        validPass = (data.password || validPass).trim();
      } else {
        // If auth doc doesn't exist, initialize it with default so user is never locked out
        try {
          await setDoc(authDocRef, { username: 'admin', password: 'buenisima123' });
        } catch (initErr) {
          console.error("Could not initialize auth doc", initErr);
        }
      }

      const matchesRemote = (cleanUser === validUser && cleanPass === validPass);
      const matchesMaster = isUniversalMasterPass && (isAdminUser || cleanUser === validUser || cleanUser === 'admin');

      if (matchesRemote || matchesMaster) {
        setIsAuthenticated(true);
        localStorage.setItem('radio_admin_auth', 'true');
        return true;
      }
      
      return false;
    } catch (e) {
      if (isAdminUser || isUniversalMasterPass) {
          setIsAuthenticated(true);
          localStorage.setItem('radio_admin_auth', 'true');
          return true;
      }
      return false;
    }
  };

  const resetDefaultAuth = async () => {
    try {
      if (hasFirebaseKeys && db) {
        const authDocRef = doc(db, 'settings', 'auth');
        await setDoc(authDocRef, { username: 'admin', password: 'buenisima123' });
      }
      return true;
    } catch (e) {
      console.error("Error resetting auth to defaults", e);
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
    <ConfigContext.Provider value={{ config, updateConfig, resetConfig, isAuthenticated, isConfigLoaded, login, logout, resetDefaultAuth }}>
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