import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SiteConfig } from '../types';
import { DEFAULT_CONFIG } from '../constants';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';

interface ConfigContextType {
  config: SiteConfig;
  updateConfig: (newConfig: SiteConfig) => void;
  resetConfig: () => void;
  isAuthenticated: boolean;
  login: () => Promise<boolean>;
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

export const ConfigProvider = ({ children }: ConfigProviderProps) => {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Sync config with Firestore
  useEffect(() => {
    // Attempt local storage fallback just in case network is disconnected
    const savedLocal = localStorage.getItem('radio_site_config');
    if (savedLocal) {
        try {
            setConfig(JSON.parse(savedLocal));
        } catch (e) {}
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
        
        if (parsed.appearance && parsed.appearance.primaryColor === "#4c007d") {
            parsed.appearance.primaryColor = DEFAULT_CONFIG.appearance.primaryColor;
        }

        if (!parsed.general?.streamUrl || parsed.general?.streamUrl.includes("listen2myradio.com")) {
            if(!parsed.general) parsed.general = DEFAULT_CONFIG.general;
            parsed.general.streamUrl = DEFAULT_CONFIG.general.streamUrl;
        }

        if (needsMigration) {
          console.warn("Detected old config schema in Firestore. Merging with defaults.");
          const merged = {
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
                // Ensure specifically heroInterval is set if missing in parsed.content
                heroInterval: parsed.content?.heroInterval ?? DEFAULT_CONFIG.content.heroInterval,
                // Ensure clients is initialized
                clients: parsed.content?.clients ?? DEFAULT_CONFIG.content.clients,
                // Ensure weekendPrograms is initialized
                program: {
                    ...DEFAULT_CONFIG.content.program,
                    ...parsed.content?.program,
                    weekendPrograms: parsed.content?.program?.weekendPrograms ?? DEFAULT_CONFIG.content.program.weekendPrograms ?? []
                },
                // Migrate hero slides
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
            appearance: { ...DEFAULT_CONFIG.appearance, ...parsed.appearance }
          };
          
          localStorage.setItem('radio_site_config', JSON.stringify(merged));
          setConfig(merged);
        } else {
          localStorage.setItem('radio_site_config', JSON.stringify(parsed));
          setConfig(parsed);
        }
      } else {
        // If doc doesn't exist, just use default locally. An admin will create it when they save.
        setConfig(DEFAULT_CONFIG);
      }
    }, (error) => {
      console.error('Firestore Error sync config: ', JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        operationType: 'get',
        path: 'settings/config'
      }));
    });

    return () => unsubscribe();
  }, []);

  const updateConfig = async (newConfig: SiteConfig) => {
    const cleaned = deepClean(newConfig);
    if (!cleaned) return; 
    
    try {
      // Optimistic upate
      setConfig(cleaned);
      localStorage.setItem('radio_site_config', JSON.stringify(cleaned));
      
      // Sync to Firestore
      const configDocRef = doc(db, 'settings', 'config');
      await setDoc(configDocRef, cleaned);
    } catch (e: any) {
      console.error("Failed to save config", JSON.stringify({
          error: e instanceof Error ? e.message : String(e),
          operationType: 'write',
          path: 'settings/config'
      }));
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        alert("⚠️ Error: No hay espacio suficiente para guardar los cambios en caché. Recomendamos reiniciar la app.");
      } else {
        alert("Ocurrió un error al intentar guardar la configuración en la base de datos.");
      }
    }
  };

  const resetConfig = async () => {
    if (confirm("¿Estás seguro de restablecer toda la configuración por defecto?")) {
        try {
            const configDocRef = doc(db, 'settings', 'config');
            await setDoc(configDocRef, DEFAULT_CONFIG);
            setConfig(DEFAULT_CONFIG);
            localStorage.setItem('radio_site_config', JSON.stringify(DEFAULT_CONFIG));
        } catch (e) {
            console.error("Failed to reset config in firestore", e);
        }
    }
  };

  // Check auth state from Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // For this specific app, we check if they are the designated admin or have logged in properly
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Firebase Login Error", e);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setIsAuthenticated(false);
    } catch (e) {
      console.error("Logout Error", e);
    }
  };

  return (
    <ConfigContext.Provider value={{ config, updateConfig, resetConfig, isAuthenticated, login, logout }}>
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