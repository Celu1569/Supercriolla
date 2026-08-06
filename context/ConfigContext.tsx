import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SiteConfig } from '../types';
import { DEFAULT_CONFIG } from '../constants';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth, hasFirebaseKeys } from '../firebase';
import { signOut } from 'firebase/auth';

interface ConfigContextType {
  config: SiteConfig;
  updateConfig: (newConfig: SiteConfig) => void;
  resetConfig: () => void;
  isAuthenticated: boolean;
  isConfigLoaded: boolean;
  login: (username?: string, password?: string) => Promise<boolean>;
  logout: () => void;
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

  // Prevent Circular References within the object graph we are traversing
  if (seen.has(obj)) return undefined;
  
  // FILTER OUT DANGEROUS OBJECTS (DOM Nodes, Windows, Events)
  // 1. Strict Instance Checks
  if (typeof Node !== 'undefined' && obj instanceof Node) return undefined;
  if (typeof Window !== 'undefined' && obj instanceof Window) return undefined;
  if (typeof Event !== 'undefined' && obj instanceof Event) return undefined;
  
  // 2. Object toString check (catches HTMLAudioElement etc even if instance check fails)
  const typeStr = Object.prototype.toString.call(obj);
  if (typeStr.includes('Element') || typeStr.includes('Window') || typeStr.includes('Event') || typeStr.includes('Audio')) {
      return undefined;
  }

  // 3. Duck Typing & Constructor Name (safest for cross-frame)
  if (obj.constructor && obj.constructor.name) {
      const name = obj.constructor.name;
      if (
        name.includes('Element') || 
        name === 'Window' || 
        name === 'HTMLAudioElement' || 
        name.includes('Event') ||
        name.includes('Fiber') ||
        name.includes('Node')
      ) return undefined;
  }
  
  // 4. Standard DOM properties
  if (typeof obj.nodeType === 'number' && typeof obj.nodeName === 'string') return undefined;
  
  // 5. React Elements & Fiber Nodes
  if (obj.$$typeof || obj._reactInternals || obj._reactFiber) return undefined;

  // Now that we know it's a safe object to traverse, add to seen
  seen.add(obj);

  // Handle Date
  if (obj instanceof Date) return obj.toISOString();

  // Handle Arrays
  if (Array.isArray(obj)) {
    const arr = [];
    for (const item of obj) {
       const cleaned = deepClean(item, seen);
       if (cleaned !== undefined) arr.push(cleaned);
    }
    return arr;
  }

  // Handle Objects
  const res: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Filter out React internals and potentially dangerous keys by name
      if (
        key.startsWith('_') || 
        key.startsWith('__react') ||
        key === 'children' || 
        key === 'ref' || 
        key === 'current' || 
        key === 'target' || 
        key === 'nativeEvent' ||
        key === 'stateNode'
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

const sanitizeBrandConfig = (cfg: SiteConfig): SiteConfig => {
  let updated = false;
  const c = JSON.parse(JSON.stringify(cfg)) as SiteConfig;

  // Station Name & Logo
  if (!c.general?.stationName || /supercriolla|uncion|unción/i.test(c.general.stationName)) {
    if (!c.general) c.general = { ...DEFAULT_CONFIG.general };
    c.general.stationName = "BUENÍSIMA";
    updated = true;
  }
  if (!c.general?.logoUrl || c.general.logoUrl.includes('flaticon') || c.general.logoUrl.includes('7508493')) {
    if (!c.general) c.general = { ...DEFAULT_CONFIG.general };
    c.general.logoUrl = "https://i.ibb.co/ZptWRz8G/LOGO-2.png";
    updated = true;
  }
  if (!c.navigation?.logoUrl || c.navigation.logoUrl.includes('flaticon') || c.navigation.logoUrl.includes('7508493')) {
    if (!c.navigation) c.navigation = { ...DEFAULT_CONFIG.navigation };
    c.navigation.logoUrl = "https://i.ibb.co/ZptWRz8G/LOGO-2.png";
    updated = true;
  }

  // Hero Slides
  if (c.content?.hero) {
    c.content.hero = c.content.hero.map((slide) => {
      let newTitle = slide.title;
      let newSubtitle = slide.subtitle;
      if (/supercriolla|uncion|unción/i.test(slide.title || '')) {
        newTitle = "BUENÍSIMA";
        updated = true;
      }
      if (/supercriolla|uncion|unción|folklore|cristiana/i.test(slide.subtitle || '')) {
        newSubtitle = "La Radio de la Buena Vibra";
        updated = true;
      }
      return { ...slide, title: newTitle, subtitle: newSubtitle };
    });
  }

  // Ribbons
  if (c.content?.ribbons) {
    c.content.ribbons = c.content.ribbons.map((r) => {
      if (/supercriolla|uncion|unción/i.test(r.text || '')) {
        updated = true;
        return {
          ...r,
          text: "¡Bienvenidos a BUENÍSIMA! La Radio de la Buena Vibra las 24 horas."
        };
      }
      return r;
    });
  }

  // Chat
  if (c.content?.chat) {
    if (/supercriolla|uncion|unción/i.test(c.content.chat.title || '')) {
      c.content.chat.title = "Comunidad BUENÍSIMA";
      updated = true;
    }
    if (/supercriolla|uncion|unción/i.test(c.content.chat.adminName || '')) {
      c.content.chat.adminName = "BUENÍSIMA Admin";
      updated = true;
    }
  }

  // Auto-sync sanitized config back to Firestore if updated
  if (updated && hasFirebaseKeys && db) {
    try {
      const configDocRef = doc(db, 'settings', 'config');
      setDoc(configDocRef, deepClean(c));
    } catch (e) {
      console.warn("Could not auto-update sanitized brand to Firestore", e);
    }
  }

  return c;
};

export const ConfigProvider = ({ children }: ConfigProviderProps) => {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Sync config with Firestore
  useEffect(() => {
    if (!hasFirebaseKeys) {
        console.log("Firebase keys missing. Operating in standalone mode with default config.");
        setIsConfigLoaded(true);
        return;
    }

    const configDocRef = doc(db, 'settings', 'config');
    
    // Realtime sync
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const firestoreConfig = snapshot.data() as SiteConfig;
        
        let parsed = firestoreConfig;
        // DATA MIGRATION & VALIDATION
        const needsMigration = 
            !parsed.content || 
            !parsed.content.podcast || 
            !parsed.content.chat || 
            !parsed.content.gallery ||
            !parsed.content.ribbons ||
            !parsed.content.clients ||
            !parsed.navigation ||
            !parsed.navigation.items ||
            parsed.navigation.logoHeight === undefined ||
            parsed.navigation.navActiveColor === undefined ||
            parsed.content.heroInterval === undefined; 
        
        if (parsed.appearance) {
            if (parsed.appearance.primaryColor === "#4c007d") {
                parsed.appearance.primaryColor = DEFAULT_CONFIG.appearance.primaryColor;
            }
            if (!parsed.appearance.radioPlayer) {
                parsed.appearance.radioPlayer = DEFAULT_CONFIG.appearance.radioPlayer;
            }
        }

        if (!parsed.general?.streamUrl || parsed.general?.streamUrl.includes("listen2myradio.com")) {
            if(!parsed.general) parsed.general = DEFAULT_CONFIG.general;
            parsed.general.streamUrl = DEFAULT_CONFIG.general.streamUrl;
        }

        let finalConfig: SiteConfig;
        if (needsMigration) {
          console.warn("Detected old config schema in Firestore. Merging with defaults.");
          finalConfig = {
            ...DEFAULT_CONFIG,
            ...parsed,
            navigation: { 
                ...DEFAULT_CONFIG.navigation, 
                ...parsed.navigation,
                items: parsed.navigation?.items || DEFAULT_CONFIG.navigation.items
            },
            content: { 
                ...DEFAULT_CONFIG.content, 
                ...parsed.content,
                heroInterval: parsed.content?.heroInterval ?? DEFAULT_CONFIG.content.heroInterval,
                clients: parsed.content?.clients ?? DEFAULT_CONFIG.content.clients,
                program: {
                    ...DEFAULT_CONFIG.content.program,
                    ...parsed.content?.program,
                    weekendPrograms: parsed.content?.program?.weekendPrograms ?? DEFAULT_CONFIG.content.program.weekendPrograms ?? []
                },
                hero: (parsed.content?.hero || DEFAULT_CONFIG.content.hero).map((slide: any) => ({
                    ...slide,
                    titleColor: slide.titleColor || slide.textColor || '#ffffff',
                    titleSize: slide.titleSize || 48,
                    titleShadow: slide.titleShadow || slide.textShadow || 'strong',
                    titleOutline: slide.titleOutline || slide.textOutline || 'none',
                    subtitleColor: slide.subtitleColor || slide.textColor || '#ffffff',
                    subtitleSize: slide.subtitleSize || 18,
                    subtitleShadow: slide.subtitleShadow || slide.textShadow || 'soft',
                    subtitleOutline: slide.subtitleOutline || slide.textOutline || 'none'
                }))
            },
            appearance: { 
                ...DEFAULT_CONFIG.appearance, 
                ...parsed.appearance,
                radioPlayer: parsed.appearance?.radioPlayer || DEFAULT_CONFIG.appearance.radioPlayer
            }
          };
        } else {
          finalConfig = parsed;
        }

        setConfig(sanitizeBrandConfig(finalConfig));
      } else {
        // If doc doesn't exist, use default and attempt to initialize it in Firestore
        console.log("Config document missing in Firestore. Initializing with defaults.");
        setConfig(DEFAULT_CONFIG);
        
        if (hasFirebaseKeys) {
            try {
                const configDocRef = doc(db, 'settings', 'config');
                setDoc(configDocRef, DEFAULT_CONFIG);
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

  const updateConfig = async (newConfig: SiteConfig) => {
    const cleaned = deepClean(newConfig);
    if (!cleaned) return; 
    
    // Always update locally immediately for snappy UI
    setConfig(cleaned);

    if (!hasFirebaseKeys) {
        console.warn("Cannot sync to Firestore: Firebase keys missing.");
        return;
    }
    
    try {
      // Sync to Firestore
      const configDocRef = doc(db, 'settings', 'config');
      await setDoc(configDocRef, cleaned);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'settings/config');
      console.warn("Could not sync config changes to Firestore; changes stored locally in app state.");
    }
  };

  const resetConfig = async () => {
    if (confirm("¿Estás seguro de restablecer toda la configuración por defecto?")) {
        setConfig(DEFAULT_CONFIG);

        if (!hasFirebaseKeys) return;

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

    // Emergency Fallback Usernames
    const isAdminUser = cleanUser === 'admin' || 
                        cleanUser === 'uncionradio' || 
                        cleanUser === 'uncionradio87.7fm' || 
                        cleanUser === 'uncionradio87.7fm@gmail.com';

    if (!hasFirebaseKeys) {
        if (isAdminUser && (cleanPass === 'admin' || cleanPass === 'uncionradio123' || cleanPass === 'admin123')) {
            setIsAuthenticated(true);
            localStorage.setItem('radio_admin_auth', 'true');
            return true;
        }
        return false;
    }
    
    try {
      const authDocRef = doc(db, 'settings', 'auth');
      const snap = await getDoc(authDocRef).catch(err => {
          console.warn("Error al leer desde Firestore, usando modo emergencia:", err);
          return null;
      });
      
      let validUser = 'admin';
      let validPass = 'uncionradio123';
      
      if (snap && snap.exists()) {
        const data = snap.data();
        validUser = (data.username || validUser).trim().toLowerCase();
        validPass = (data.password || validPass).trim();
      } else {
        // If auth doc doesn't exist, initialize it with default so user isn't locked out
        try {
          await setDoc(authDocRef, { username: 'admin', password: 'uncionradio123' });
        } catch (initErr) {
          console.error("Could not initialize auth doc", initErr);
        }
      }

      const matchesRemote = (cleanUser === validUser && cleanPass === validPass);
      const matchesEmergency = isAdminUser && (cleanPass === 'admin' || cleanPass === 'uncionradio123' || cleanPass === 'admin123');

      if (matchesRemote || matchesEmergency) {
        setIsAuthenticated(true);
        localStorage.setItem('radio_admin_auth', 'true');
        return true;
      }
      
      return false;
    } catch (e) {
      if (isAdminUser && (cleanPass === 'admin' || cleanPass === 'uncionradio123' || cleanPass === 'admin123')) {
          setIsAuthenticated(true);
          localStorage.setItem('radio_admin_auth', 'true');
          return true;
      }
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
    <ConfigContext.Provider value={{ config, updateConfig, resetConfig, isAuthenticated, isConfigLoaded, login, logout }}>
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