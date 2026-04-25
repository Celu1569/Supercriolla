import React, { useState, useEffect, useCallback } from 'react';
import { useConfig } from '../context/ConfigContext';
import { SiteConfig, HeroSlide, PodcastEpisode, GalleryItem, NavItemConfig, FontFamily, Client, AutoDJTrack } from '../types';
import { Save, LogOut, Layout, Radio, Image as ImageIcon, Plus, Trash2, Youtube, Video, RectangleHorizontal, RectangleVertical, Home, Mic2, Grid, Link as LinkIcon, Upload, Monitor, Compass, Eye, EyeOff, FolderOpen, AlignLeft, AlignCenter, AlignRight, AlertTriangle, Loader2, FileImage, Download, RefreshCw, Database, Type, MessageSquare, Mic, Paperclip, Users, Phone, Calendar, Cloud, Globe, MapPin, MessageCircle, Facebook, Instagram, Twitter, Newspaper, ChevronUp, ChevronDown, PlayCircle, Lock, Volume2 } from 'lucide-react';

// --- CONSTANTS ---
const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'Inter', label: 'Inter (Moderno & Limpio)' },
  { value: 'Playfair Display', label: 'Playfair Display (Elegante Serif)' },
  { value: 'Lato', label: 'Lato (Amigable)' },
  { value: 'Montserrat', label: 'Montserrat (Geométrico Moderno)' },
  { value: 'Roboto', label: 'Roboto (Estándar Web)' },
  { value: 'Open Sans', label: 'Open Sans (Neutro)' },
  { value: 'Poppins', label: 'Poppins (Geométrico Suave)' },
  { value: 'Oswald', label: 'Oswald (Condensado Fuerte)' },
  { value: 'Raleway', label: 'Raleway (Elegante Fino)' },
  { value: 'Merriweather', label: 'Merriweather (Serif Leible)' },
  { value: 'Nunito', label: 'Nunito (Redondeado)' },
  { value: 'Ubuntu', label: 'Ubuntu (Tech / Moderno)' },
  { value: 'PT Sans', label: 'PT Sans (Humanista)' },
  { value: 'Source Sans 3', label: 'Source Sans (UI Focus)' },
  { value: 'Roboto Slab', label: 'Roboto Slab (Slab Serif)' },
  { value: 'Lora', label: 'Lora (Caligráfico Serif)' },
  { value: 'Work Sans', label: 'Work Sans (Grotesque)' },
  { value: 'Quicksand', label: 'Quicksand (Redondeado)' },
  { value: 'Fira Sans', label: 'Fira Sans (Legible)' },
  { value: 'Barlow', label: 'Barlow (Grotesque)' },
  { value: 'Helvetica', label: 'Helvetica (Clásico Sistema)' },
];

// --- COMPONENTS ---

interface TabButtonProps {
  id: string;
  activeTab: string;
  icon: React.ElementType;
  label: string;
  onClick: (id: string) => void;
}

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

// --- IMAGE COMPRESSION UTILITY ---
const compressImage = (file: File, maxWidth = 800, quality = 0.6): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }
                
                // Ensure canvas is transparent
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                
                // Determine output format based on input file type to preserve transparency
                let outputType = 'image/jpeg';
                if (file.type === 'image/png' || file.type === 'image/webp') {
                    outputType = file.type;
                }

                canvas.toBlob((blob) => {
                  if (blob) {
                    resolve(blob);
                  } else {
                    reject(new Error("Canvas to Blob failed"));
                  }
                }, outputType, quality);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

const uploadFileToStorage = async (file: File, path: string): Promise<string> => {
  try {
    let finalFile: Blob | File = file;
    let contentType = file.type;

    // We only compress images, if it's audio/video it uploads raw
    if (file.type.startsWith('image/') && file.type !== 'image/gif') {
        finalFile = await compressImage(file);
        // Determine the content type returned by compressImage
        if (file.type === 'image/png' || file.type === 'image/webp') {
            contentType = file.type;
        } else {
            contentType = 'image/jpeg';
        }
    }
    
    // Generate unique name
    const ext = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${ext}`;
    const storageRef = ref(storage, `${path}/${fileName}`);
    
    // Pass metadata
    const metadata = {
      contentType: contentType,
    };
    
    const snapshot = await uploadBytesResumable(storageRef, finalFile, metadata);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (err: any) {
    console.error("Upload error completely:", err);
    
    if (err?.code === 'storage/unauthorized') {
        throw new Error("storage/unauthorized");
    }
    
    throw err;
  }
};


const TabButton: React.FC<TabButtonProps> = ({ id, activeTab, icon: Icon, label, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center space-x-2 px-5 py-3 rounded-xl transition-all whitespace-nowrap outline-none ${
      activeTab === id 
        ? 'bg-primary text-white shadow-lg shadow-primary/20 font-bold scale-105' 
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`}
  >
    <Icon size={20} className={activeTab === id ? 'text-white' : 'text-gray-500'} />
    <span className="text-sm md:text-base">{label}</span>
  </button>
);

const InputGroup: React.FC<{ label: string; children?: React.ReactNode; className?: string }> = ({ label, children, className = "mb-8" }) => (
  <div className={className}>
    <label className="block text-sm md:text-base font-bold text-gray-300 mb-3 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const AdminAuthManager: React.FC = () => {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('uncionradio123');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        const fetchAuth = async () => {
            try {
                const authDocRef = doc(db, 'settings', 'auth');
                const snap = await getDoc(authDocRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setUsername(data.username || 'admin');
                    setPassword(data.password || 'uncionradio123');
                }
                setLoading(false);
            } catch (e) {
                console.error("Error fetching auth", e);
                setLoading(false);
            }
        };
        fetchAuth();
    }, []);

    const handleSaveAuth = async () => {
        setSaving(true);
        setStatus('idle');
        try {
            const authDocRef = doc(db, 'settings', 'auth');
            await setDoc(authDocRef, { username, password });
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (e) {
            console.error("Error saving auth", e);
            setStatus('error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p>Cargando configuración de seguridad...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-8">
            <SectionHeader 
                title="Seguridad y Acceso" 
                subtitle="Configura el usuario y la clave para entrar a este panel. El acceso por correo ha sido deshabilitado." 
            />
            
            <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl max-w-2xl mx-auto">
                <div className="flex items-center space-x-4 mb-8 pb-4 border-b border-gray-700">
                    <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center text-purple-500">
                        <Lock size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Credenciales del Administrador</h3>
                        <p className="text-sm text-gray-400 font-medium">Estos datos reemplazan el inicio de sesión con Google.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <InputGroup label="Nombre de Usuario">
                        <input 
                            type="text" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 text-white p-4 rounded-xl focus:border-purple-500 outline-none transition-all shadow-inner"
                            placeholder="Ej: administrador"
                        />
                    </InputGroup>

                    <InputGroup label="Clave de Acceso">
                        <input 
                            type="text" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 text-white p-4 rounded-xl focus:border-purple-500 outline-none transition-all shadow-inner"
                            placeholder="Ej: ClaveSegura2024"
                        />
                        <p className="text-xs text-gray-500 mt-2 flex items-center">
                            <AlertTriangle size={12} className="mr-1 text-amber-500" />
                            Asegúrate de recordar estos datos antes de cerrar tu sesión.
                        </p>
                    </InputGroup>

                    <div className="pt-4">
                        <button 
                            onClick={handleSaveAuth}
                            disabled={saving}
                            className={`w-full py-4 rounded-xl font-bold text-white transition-all transform active:scale-95 flex items-center justify-center shadow-lg ${
                                status === 'success' ? 'bg-green-600' :
                                status === 'error' ? 'bg-red-600' :
                                saving ? 'bg-gray-700' : 'bg-purple-600 hover:bg-purple-700'
                            }`}
                        >
                            {saving ? <Loader2 size={20} className="animate-spin mr-2" /> : 
                             status === 'success' ? <RefreshCw size={20} className="mr-2" /> :
                             <Save size={20} className="mr-2" />}
                            
                            {saving ? 'Guardando...' : 
                             status === 'success' ? 'Credenciales Actualizadas' :
                             status === 'error' ? 'Error al guardar' : 'Actualizar Credenciales'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-700 pb-6 mb-8">
        <div className="mb-4 md:mb-0">
            <h2 className="text-3xl font-bold text-white tracking-tight">{title}</h2>
            {subtitle && <p className="text-gray-400 text-base mt-2">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
    </div>
);

// Standard Media Uploader (Vertical)
interface MediaUploaderProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: 'image' | 'video' | 'audio';
}

const MediaUploader: React.FC<MediaUploaderProps> = ({ label, value, onChange, type = 'image' }) => {
  const [activeMethod, setActiveMethod] = useState<'url' | 'upload'>('url');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'video') {
        alert("Para videos, recomendamos usar enlaces de YouTube. Subir videos directamente llenará el almacenamiento del navegador.");
        return;
    }

    try {
        setIsProcessing(true);
        const urlToSave = await uploadFileToStorage(file, 'uploads');
        onChange(urlToSave);
    } catch (error: any) {
        console.error("Error compressing/uploading:", error);
        if (error?.message === 'storage/unauthorized') {
             alert(`⚠️ ERROR DE PERMISOS DE FIREBASE STORAGE ⚠️\n\nNo tienes permiso para subir. Esto pasa porque Firebase Storage bloquea las subidas por seguridad.\n\nPara solucionarlo, debes ir a tu consola de Firebase:\n1. Ve a "Build" > "Storage" > pestaña "Reglas" (Rules).\n2. Cambia la regla a: allow read, write: if true;\n3. Dale a "Publicar" (Publish).`);
        } else {
             alert(`Hubo un error al procesar o subir el archivo: ${error?.message || 'Error de red o permisos.'}`);
        }
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-bold text-gray-300 mb-2">{label}</label>
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-sm transition-shadow hover:shadow-md">
        
        <div className="flex border-b border-gray-700 bg-gray-900">
            <button onClick={() => setActiveMethod('url')} className={`flex-1 py-2 text-xs font-bold flex items-center justify-center space-x-2 transition-colors ${activeMethod === 'url' ? 'bg-gray-800 text-primary border-t-2 border-primary' : 'text-gray-400 hover:text-gray-200'}`}>
                <LinkIcon size={14} /> <span>URL</span>
            </button>
            <button onClick={() => setActiveMethod('upload')} className={`flex-1 py-2 text-xs font-bold flex items-center justify-center space-x-2 transition-colors ${activeMethod === 'upload' ? 'bg-gray-800 text-primary border-t-2 border-primary' : 'text-gray-400 hover:text-gray-200'}`}>
                <Monitor size={14} /> <span>PC</span>
            </button>
        </div>

        <div className="p-4">
            {activeMethod === 'url' && (
                <div className="relative">
                    <input 
                        type="text" 
                        value={value || ''} 
                        onChange={(e) => onChange(e.target.value)} 
                        className="w-full bg-gray-900 border border-gray-600 pl-9 pr-3 py-2 rounded-lg text-sm text-white focus:ring-2 focus:ring-primary/50 outline-none placeholder-gray-500" 
                        placeholder="https://..." 
                    />
                    <div className="absolute left-3 top-2.5 text-gray-500">{type === 'image' ? <ImageIcon size={16}/> : type === 'audio' ? <Volume2 size={16}/> : <Youtube size={16}/>}</div>
                </div>
            )}
            {activeMethod === 'upload' && (
                <div className={`border-2 border-dashed border-primary/20 bg-primary/10 rounded-lg p-6 text-center relative cursor-pointer ${isProcessing ? 'opacity-50' : ''}`}>
                    <input type="file" accept={type === 'audio' ? 'audio/*' : 'image/*'} onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" disabled={isProcessing} />
                    <div className="pointer-events-none">
                        {isProcessing ? <Loader2 size={28} className="animate-spin text-primary mx-auto" /> : <Upload size={28} className="mx-auto text-primary/50" />}
                    </div>
                </div>
            )}
        </div>
        {value && type === 'image' && (
             <div className="h-32 w-full bg-gray-900 border-t border-gray-700 flex items-center justify-center overflow-hidden">
                <img src={value} className="h-full object-contain" />
             </div>
        )}
        {value && type === 'audio' && (
             <div className="w-full bg-gray-900 border-t border-gray-700 p-2 flex items-center justify-center">
                <audio src={value} controls className="w-full max-w-sm h-10" />
             </div>
        )}
      </div>
    </div>
  );
};

// --- AUTO DJ MANAGER ---
interface AutoDJManagerProps {
    tracks: AutoDJTrack[];
    mode: 'alphabetical' | 'random';
    onChange: (tracks: AutoDJTrack[], mode: 'alphabetical' | 'random') => void;
}

const AutoDJManager: React.FC<AutoDJManagerProps> = ({ tracks = [], mode = 'alphabetical', onChange }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);
        
        try {
            const newTracks: AutoDJTrack[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const url = await uploadFileToStorage(file, 'auto_dj');
                newTracks.push({
                    id: uuidv4(),
                    url,
                    title: file.name.replace(/\.[^/.]+$/, "")
                });
                setUploadProgress(Math.round(((i + 1) / files.length) * 100));
            }
            
            onChange([...tracks, ...newTracks], mode);
        } catch (error: any) {
            console.error("Error uploading Auto DJ tracks:", error);
             if (error?.message === 'storage/unauthorized') {
                alert(`⚠️ ERROR DE PERMISOS DE FIREBASE STORAGE ⚠️`);
             } else {
                alert(`Error: ${error?.message}`);
             }
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            if(e.target) e.target.value = ''; // Reset
        }
    };

    const removeTrack = (idToRemove: string) => {
        onChange(tracks.filter(t => t.id !== idToRemove), mode);
    };
    
    const updateAutoDJMode = (newMode: 'alphabetical' | 'random') => {
        onChange(tracks, newMode);
    };

    return (
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <div>
                     <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Volume2 size={16} className="text-primary" /> Auto DJ (Playlist de Respaldo)
                     </h4>
                     <p className="text-xs text-gray-400 mt-1">
                        Sube varias canciones que sonarán automáticamente si el streaming principal se cae.
                     </p>
                </div>
                <div className="flex flex-row items-center gap-2 w-full sm:w-auto overflow-hidden">
                    <select 
                        value={mode} 
                        onChange={(e) => updateAutoDJMode(e.target.value as any)}
                        className="bg-gray-900 border border-gray-600 text-sm text-white rounded p-2 focus:ring-1 focus:ring-primary flex-1"
                    >
                        <option value="alphabetical">En orden (Alfabetico/Subida)</option>
                        <option value="random">Aleatorio (Random)</option>
                    </select>
                    
                    <label className={`cursor-pointer bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-3 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16}/>}
                        <span>{isUploading ? `${uploadProgress}%` : 'Subir Música'}</span>
                        <input type="file" accept="audio/*" multiple onChange={handleFileUpload} className="hidden" disabled={isUploading} />
                    </label>
                </div>
            </div>

            {tracks.length === 0 ? (
                <div className="text-center py-8 bg-gray-900/50 rounded-lg border border-dashed border-gray-700">
                    <Volume2 size={32} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-gray-400 text-sm">No hay canciones en el Auto DJ.</p>
                </div>
            ) : (
                <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                    {tracks.map((track, i) => (
                        <div key={track.id} className="flex flex-row items-center justify-between bg-gray-900 p-2 rounded border border-gray-700 hover:border-gray-600 group">
                            <div className="flex flex-row items-center gap-3 overflow-hidden">
                                <span className="text-gray-500 font-mono text-xs w-5 text-right">{i + 1}.</span>
                                <input 
                                    className="bg-transparent border-none text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary w-full truncate" 
                                    value={track.title} 
                                    onChange={(e) => {
                                        const newTracks = [...tracks];
                                        newTracks[i].title = e.target.value;
                                        onChange(newTracks, mode);
                                    }}
                                />
                            </div>
                            <button onClick={() => removeTrack(track.id)} className="text-red-400/50 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- COMPACT HERO SLIDE COMPONENT ---
interface CompactHeroSlideProps {
    slide: HeroSlide;
    index: number;
    onUpdate: (field: keyof HeroSlide, value: any) => void;
    onRemove: () => void;
}

const CompactHeroSlide: React.FC<CompactHeroSlideProps> = ({ slide, index, onUpdate, onRemove }) => {
    const [isUploading, setIsUploading] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setIsUploading(true);
            const urlToSave = await uploadFileToStorage(file, 'hero_slides');
            onUpdate('image', urlToSave);
        } catch (err: any) {
             console.error("Error uploading hero slide:", err);
             if (err?.message === 'storage/unauthorized') {
                alert(`⚠️ ERROR DE PERMISOS DE FIREBASE STORAGE ⚠️\n\nNo tienes permiso para subir. Esto pasa porque Firebase Storage bloquea las subidas por seguridad.\n\nPara solucionarlo, debes ir a tu consola de Firebase:\n1. Ve a "Build" > "Storage" > pestaña "Reglas" (Rules).\n2. Cambia la regla a: allow read, write: if true;\n3. Dale a "Publicar" (Publish).`);
             } else {
                alert(`Error al procesar o subir la imagen: ${err?.message || 'Error desconocido'}`);
             }
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow relative">
             <div className="absolute top-2 right-2 z-20">
                 <button onClick={onRemove} className="text-gray-500 hover:text-red-500 transition-colors p-1 bg-gray-900/50 rounded flex items-center justify-center" title="Eliminar"><Trash2 size={16}/></button>
             </div>
             
             <div className="flex items-start gap-2 mb-2">
                 <span className="bg-gray-700 text-gray-300 text-xs font-bold px-2 py-0.5 rounded">{index + 1}</span>
                 <h4 className="text-xs font-bold text-gray-400 uppercase pt-0.5">Control de Banner Individual</h4>
             </div>

             <div className="flex flex-col gap-4">
                 {/* Top: Large Image Preview */}
                 <div className="w-full">
                     <div className="relative aspect-[16/5] md:aspect-[21/6] bg-gray-900 rounded-lg overflow-hidden border border-gray-600 group shadow-inner">
                         {slide.image ? (
                             <img src={slide.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                         ) : (
                             <div className="flex items-center justify-center h-full text-gray-600"><FileImage size={48} className="opacity-20"/></div>
                         )}
                         
                         {/* Real-time Text Preview Overlay */}
                         <div 
                             className={`absolute inset-0 flex flex-col pointer-events-none bg-black/40 p-6 md:p-8 ${
                                 slide.alignment === 'left' ? 'items-start text-left' : 
                                 slide.alignment === 'right' ? 'items-end text-right' : 
                                 'items-center text-center'
                             } ${
                                 slide.verticalAlignment === 'top' ? 'justify-start pt-6 md:pt-10' : 
                                 slide.verticalAlignment === 'bottom' ? 'justify-end pb-6 md:pb-10' : 
                                 'justify-center'
                             }`}
                         >
                             <div style={{ maxWidth: slide.contentMaxWidth ? `${slide.contentMaxWidth / 3.5}px` : '100%' }}>
                                 <h5 
                                     className="font-bold leading-tight mb-2"
                                     style={{ 
                                         fontFamily: slide.titleFont ? `"${slide.titleFont}", sans-serif` : undefined,
                                         fontWeight: slide.titleBold ? 'bold' : 'normal',
                                         backgroundColor: slide.titleHighlight ? slide.titleHighlightColor || 'rgba(251, 191, 36, 0.4)' : 'transparent',
                                         padding: slide.titleHighlight ? '2px 8px' : '0',
                                         borderRadius: slide.titleHighlight ? '4px' : '0',
                                         display: slide.titleHighlight ? 'inline-block' : 'block',
                                         color: slide.titleColor || '#ffffff',
                                         fontSize: `${Math.max(12, (slide.titleSize || 40) / 2.5)}px`,
                                         textShadow: slide.titleShadow === 'strong' ? '0 2px 4px rgba(0,0,0,0.8)' : slide.titleShadow === 'soft' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                                         ...(slide.titleOutline === 'dark' ? { WebkitTextStroke: '0.5px black' } : 
                                            slide.titleOutline === 'light' ? { WebkitTextStroke: '0.2px white' } : 
                                            slide.titleOutline === 'custom' ? { WebkitTextStroke: `${(slide.titleOutlineWidth || 1) / 4}px ${slide.titleOutlineColor}` } : {})
                                     }}
                                 >
                                     {slide.title || 'Título del Banner'}
                                 </h5>
                                 <p 
                                     className="opacity-90 leading-tight mb-4"
                                     style={{ 
                                         fontFamily: slide.subtitleFont ? `"${slide.subtitleFont}", sans-serif` : undefined,
                                         fontWeight: slide.subtitleBold ? 'bold' : 'normal',
                                         backgroundColor: slide.subtitleHighlight ? slide.subtitleHighlightColor || 'rgba(251, 191, 36, 0.2)' : 'transparent',
                                         padding: slide.subtitleHighlight ? '2px 6px' : '0',
                                         borderRadius: slide.subtitleHighlight ? '4px' : '0',
                                         display: slide.subtitleHighlight ? 'inline-block' : 'block',
                                         color: slide.subtitleColor || '#ffffff',
                                         fontSize: `${Math.max(8, (slide.subtitleSize || 20) / 2.5)}px`,
                                         textShadow: slide.subtitleShadow === 'strong' ? '0 2px 4px rgba(0,0,0,0.8)' : slide.subtitleShadow === 'soft' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                                         ...(slide.subtitleOutline === 'dark' ? { WebkitTextStroke: '0.3px black' } : 
                                            slide.subtitleOutline === 'light' ? { WebkitTextStroke: '0.1px white' } : 
                                            slide.subtitleOutline === 'custom' ? { WebkitTextStroke: `${(slide.subtitleOutlineWidth || 1) / 4}px ${slide.subtitleOutlineColor}` } : {})
                                     }}
                                 >
                                     {slide.subtitle || 'Subtítulo descriptivo del banner'}
                                 </p>
                                 {slide.showButton && (
                                     <div 
                                        className="px-4 py-1.5 rounded-full font-bold text-[10px] md:text-xs shadow-lg inline-block"
                                        style={{ 
                                            backgroundColor: slide.buttonColor || '#ffffff',
                                            color: slide.buttonTextColor || '#000000'
                                        }}
                                     >
                                         {slide.buttonText || "Botón"}
                                     </div>
                                 )}
                             </div>
                         </div>
                         <div className="absolute top-2 left-2 bg-primary/80 text-[10px] text-white px-2 py-0.5 rounded uppercase tracking-widest font-bold shadow-lg backdrop-blur-sm">Vista Previa</div>
                     </div>
                     
                     <div className="flex items-center gap-2 mt-2">
                         <div className="relative flex-grow">
                             <input 
                                type="text" 
                                value={slide.image || ''} 
                                onChange={(e) => onUpdate('image', e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded text-xs py-1.5 pl-2 pr-2 text-gray-300 focus:ring-1 focus:ring-primary placeholder-gray-600 font-mono"
                                placeholder="URL de la imagen (https://...)"
                                disabled={isUploading}
                             />
                         </div>
                         <label className={`cursor-pointer bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded border border-gray-600 flex items-center gap-2 text-xs font-bold transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`} title="Subir desde mi PC">
                             {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Monitor size={14}/>}
                             <span>{isUploading ? 'SUBIENDO...' : 'SUBIR'}</span>
                             <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
                         </label>
                     </div>
                 </div>

                 {/* Bottom: Controls Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2 border-t border-gray-700">
                     {/* Text Inputs */}
                     <div className="md:col-span-7 flex flex-col gap-4">
                         <div className="space-y-3">
                             <div>
                                 <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Título Principal</label>
                                 <input 
                                    type="text" 
                                    value={slide.title || ''}
                                    onChange={(e) => onUpdate('title', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm font-bold text-white placeholder-gray-500 focus:border-primary outline-none transition-colors"
                                    placeholder="Título Principal"
                                 />
                             </div>
                             <div>
                                 <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Subtítulo Descriptivo</label>
                                 <textarea 
                                    value={slide.subtitle || ''}
                                    onChange={(e) => onUpdate('subtitle', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-gray-300 placeholder-gray-500 focus:border-primary outline-none transition-colors h-16 resize-none"
                                    placeholder="Subtítulo descriptivo"
                                 />
                             </div>
                         </div>

                         <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center">
                                    <input 
                                        type="checkbox" 
                                        id={`btn-toggle-${slide.id}`}
                                        checked={!!slide.showButton} 
                                        onChange={(e) => onUpdate('showButton', e.target.checked)}
                                        className="mr-2 h-4 w-4 accent-primary bg-gray-700 border-gray-600 rounded"
                                    />
                                    <label htmlFor={`btn-toggle-${slide.id}`} className="text-[10px] font-bold text-gray-300 uppercase tracking-widest cursor-pointer">Activar Botón de Acción</label>
                                </div>
                            </div>
                            
                            {slide.showButton && (
                                <div className="grid grid-cols-2 gap-3">
                                    <input 
                                        type="text" 
                                        value={slide.buttonText || ''} 
                                        onChange={(e) => onUpdate('buttonText', e.target.value)}
                                        className="bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-xs text-white placeholder-gray-600"
                                        placeholder="Texto del Botón"
                                    />
                                    <input 
                                        type="text" 
                                        value={slide.buttonLink || ''} 
                                        onChange={(e) => onUpdate('buttonLink', e.target.value)}
                                        className="bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-xs text-white placeholder-gray-600"
                                        placeholder="Enlace (ej: #podcast)"
                                    />
                                </div>
                            )}
                         </div>
                     </div>

                     {/* Style Controls */}
                     <div className="md:col-span-5 flex flex-col gap-4">
                          <div className="flex justify-between items-center bg-gray-900/50 p-2 px-3 rounded-lg border border-gray-700">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Alineación H/V</span>
                              <div className="flex gap-2">
                                  <div className="flex bg-gray-800 rounded p-0.5" title="Alineación Horizontal">
                                     {(['left', 'center', 'right'] as const).map(align => (
                                         <button
                                             key={align}
                                             onClick={() => onUpdate('alignment', align)}
                                             className={`p-1 rounded transition-all ${slide.alignment === align ? 'bg-primary shadow-lg text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                         >
                                             {align === 'left' ? <AlignLeft size={16}/> : align === 'center' ? <AlignCenter size={16}/> : <AlignRight size={16}/>}
                                         </button>
                                     ))}
                                  </div>
                                  <div className="flex bg-gray-800 rounded p-0.5" title="Alineación Vertical">
                                      {(['top', 'center', 'bottom'] as const).map(valign => (
                                          <button
                                              key={valign}
                                              onClick={() => onUpdate('verticalAlignment', valign)}
                                              className={`p-1 rounded transition-all ${slide.verticalAlignment === valign ? 'bg-secondary text-primary shadow-lg font-bold px-1' : 'text-gray-400 hover:text-gray-200 px-1'}`}
                                          >
                                              <Layout size={16} className={valign === 'top' ? 'rotate-180' : valign === 'bottom' ? '' : 'opacity-40'} />
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          </div>

                          <div className="flex justify-between items-center bg-gray-900/50 p-2 px-3 rounded-lg border border-gray-700">
                               <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Ancho Contenido</span>
                               <div className="flex items-center bg-gray-950 border border-gray-700 rounded px-2">
                                   <input 
                                       type="range" 
                                       min="300" 
                                       max="1400" 
                                       step="50"
                                       value={slide.contentMaxWidth || 800} 
                                       onChange={e => onUpdate('contentMaxWidth', parseInt(e.target.value))} 
                                       className="w-24 mr-2 accent-primary h-1" 
                                   />
                                   <span className="text-[10px] text-white w-8 text-right font-mono">{slide.contentMaxWidth || 800}</span>
                               </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                              {/* Title Style Card */}
                              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 space-y-3">
                                  <div className="flex justify-between items-center">
                                      <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Título</label>
                                      <div className="flex items-center gap-2">
                                          <input type="color" value={slide.titleColor || '#ffffff'} onChange={e => onUpdate('titleColor', e.target.value)} className="w-5 h-5 rounded cursor-pointer border-none p-0 bg-transparent" title="Color de fuente" />
                                          <div className="flex items-center bg-gray-950 border border-gray-700 rounded px-1">
                                              <span className="text-[8px] text-gray-500 mr-1">TALLA</span>
                                              <input type="number" value={slide.titleSize || 48} onChange={e => onUpdate('titleSize', parseInt(e.target.value))} className="w-8 bg-transparent border-none py-0.5 text-[10px] text-white focus:outline-none" />
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <select 
                                     value={slide.titleFont || 'Inter'} 
                                     onChange={(e) => onUpdate('titleFont', e.target.value)}
                                     className="w-full text-[10px] border border-gray-700 rounded py-1 px-2 bg-gray-950 text-white focus:outline-none"
                                  >
                                      {FONT_OPTIONS.map(font => (
                                          <option key={font.value} value={font.value}>{font.label}</option>
                                      ))}
                                  </select>

                                  <div className="flex items-center gap-4 bg-gray-950/50 p-2 rounded border border-gray-700">
                                  <div className="flex items-center gap-1.5 pointer-events-auto">
                                          <input 
                                              type="checkbox" 
                                              id={`title-bold-${slide.id}`}
                                              checked={!!slide.titleBold} 
                                              onChange={(e) => onUpdate('titleBold', e.target.checked)}
                                              className="h-3.5 w-3.5 accent-primary rounded border-gray-600 bg-gray-800"
                                          />
                                          <label htmlFor={`title-bold-${slide.id}`} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer">Negrita</label>
                                      </div>
                                      <div className="flex items-center gap-1.5 pointer-events-auto">
                                          <input 
                                              type="checkbox" 
                                              id={`title-highlight-${slide.id}`}
                                              checked={!!slide.titleHighlight} 
                                              onChange={(e) => onUpdate('titleHighlight', e.target.checked)}
                                              className="h-3.5 w-3.5 accent-primary rounded border-gray-600 bg-gray-800"
                                          />
                                          <label htmlFor={`title-highlight-${slide.id}`} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer">Resaltado</label>
                                          {slide.titleHighlight && (
                                              <input 
                                                  type="color" 
                                                  value={slide.titleHighlightColor || '#fbbf24'} 
                                                  onChange={(e) => onUpdate('titleHighlightColor', e.target.value)} 
                                                  className="w-3.5 h-3.5 rounded-full cursor-pointer border border-gray-600 p-0 bg-transparent flex-shrink-0" 
                                                  title="Color de resaltado"
                                              />
                                          )}
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                      <select 
                                         value={slide.titleShadow || 'none'} 
                                         onChange={(e) => onUpdate('titleShadow', e.target.value)}
                                         className="w-full text-[10px] border border-gray-700 rounded py-1 px-2 bg-gray-950 text-white focus:outline-none"
                                      >
                                          <option value="none">Sin Sombra</option>
                                          <option value="soft">Sombra Suave</option>
                                          <option value="strong">Sombra Fuerte</option>
                                      </select>
                                      <select 
                                         value={slide.titleOutline || 'none'} 
                                         onChange={(e) => onUpdate('titleOutline', e.target.value)}
                                         className="w-full text-[10px] border border-gray-700 rounded py-1 px-2 bg-gray-950 text-white focus:outline-none"
                                      >
                                          <option value="none">Sin Borde</option>
                                          <option value="light">Borde Claro</option>
                                          <option value="dark">Borde Obscuro</option>
                                          <option value="custom">Personalizado</option>
                                      </select>
                                  </div>

                                  {slide.titleOutline === 'custom' && (
                                      <div className="flex items-center justify-between bg-gray-950/50 p-2 rounded border border-gray-700">
                                           <div className="flex items-center gap-2">
                                               <span className="text-[8px] text-gray-400 uppercase">C:</span>
                                               <input type="color" value={slide.titleOutlineColor || '#000000'} onChange={e => onUpdate('titleOutlineColor', e.target.value)} className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent" />
                                           </div>
                                           <div className="flex items-center gap-2">
                                               <span className="text-[8px] text-gray-400 uppercase">Ancho:</span>
                                               <input type="number" step="0.5" min="0.1" max="10" value={slide.titleOutlineWidth || 1} onChange={e => onUpdate('titleOutlineWidth', parseFloat(e.target.value))} className="w-8 bg-transparent border-none py-0.5 text-[10px] text-white focus:outline-none" />
                                           </div>
                                      </div>
                                  )}
                              </div>

                              {/* Subtitle Style Card */}
                              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 space-y-3">
                                  <div className="flex justify-between items-center">
                                      <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Subtítulo</label>
                                      <div className="flex items-center gap-2">
                                          <input type="color" value={slide.subtitleColor || '#ffffff'} onChange={e => onUpdate('subtitleColor', e.target.value)} className="w-5 h-5 rounded cursor-pointer border-none p-0 bg-transparent" title="Color de fuente" />
                                          <div className="flex items-center bg-gray-950 border border-gray-700 rounded px-1">
                                              <span className="text-[8px] text-gray-500 mr-1">TALLA</span>
                                              <input type="number" value={slide.subtitleSize || 18} onChange={e => onUpdate('subtitleSize', parseInt(e.target.value))} className="w-8 bg-transparent border-none py-0.5 text-[10px] text-white focus:outline-none" />
                                          </div>
                                      </div>
                                  </div>

                                  <select 
                                     value={slide.subtitleFont || 'Inter'} 
                                     onChange={(e) => onUpdate('subtitleFont', e.target.value)}
                                     className="w-full text-[10px] border border-gray-700 rounded py-1 px-2 bg-gray-950 text-white focus:outline-none"
                                  >
                                      {FONT_OPTIONS.map(font => (
                                          <option key={font.value} value={font.value}>{font.label}</option>
                                      ))}
                                  </select>

                                  <div className="flex items-center gap-4 bg-gray-950/50 p-2 rounded border border-gray-700">
                                  <div className="flex items-center gap-1.5 pointer-events-auto">
                                          <input 
                                              type="checkbox" 
                                              id={`subtitle-bold-${slide.id}`}
                                              checked={!!slide.subtitleBold} 
                                              onChange={(e) => onUpdate('subtitleBold', e.target.checked)}
                                              className="h-3.5 w-3.5 accent-primary rounded border-gray-600 bg-gray-800"
                                          />
                                          <label htmlFor={`subtitle-bold-${slide.id}`} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer">Negrita</label>
                                      </div>
                                      <div className="flex items-center gap-1.5 pointer-events-auto">
                                          <input 
                                              type="checkbox" 
                                              id={`subtitle-highlight-${slide.id}`}
                                              checked={!!slide.subtitleHighlight} 
                                              onChange={(e) => onUpdate('subtitleHighlight', e.target.checked)}
                                              className="h-3.5 w-3.5 accent-primary rounded border-gray-600 bg-gray-800"
                                          />
                                          <label htmlFor={`subtitle-highlight-${slide.id}`} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer">Resaltado</label>
                                          {slide.subtitleHighlight && (
                                              <input 
                                                  type="color" 
                                                  value={slide.subtitleHighlightColor || '#fbbf24'} 
                                                  onChange={(e) => onUpdate('subtitleHighlightColor', e.target.value)} 
                                                  className="w-3.5 h-3.5 rounded-full cursor-pointer border border-gray-600 p-0 bg-transparent flex-shrink-0" 
                                                  title="Color de resaltado"
                                              />
                                          )}
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                      <select 
                                         value={slide.subtitleShadow || 'none'} 
                                         onChange={(e) => onUpdate('subtitleShadow', e.target.value)}
                                         className="w-full text-[10px] border border-gray-700 rounded py-1 px-2 bg-gray-950 text-white focus:outline-none"
                                      >
                                          <option value="none">Sin Sombra</option>
                                          <option value="soft">Sombra Suave</option>
                                          <option value="strong">Sombra Fuerte</option>
                                      </select>
                                      <select 
                                         value={slide.subtitleOutline || 'none'} 
                                         onChange={(e) => onUpdate('subtitleOutline', e.target.value)}
                                         className="w-full text-[10px] border border-gray-700 rounded py-1 px-2 bg-gray-950 text-white focus:outline-none"
                                      >
                                          <option value="none">Sin Borde</option>
                                          <option value="light">Borde Claro</option>
                                          <option value="dark">Borde Obscuro</option>
                                          <option value="custom">Personalizado</option>
                                      </select>
                                  </div>

                                  {slide.subtitleOutline === 'custom' && (
                                      <div className="flex items-center justify-between bg-gray-950/50 p-2 rounded border border-gray-700">
                                           <div className="flex items-center gap-2">
                                               <span className="text-[8px] text-gray-400 uppercase">C:</span>
                                               <input type="color" value={slide.subtitleOutlineColor || '#000000'} onChange={e => onUpdate('subtitleOutlineColor', e.target.value)} className="w-4 h-4 rounded cursor-pointer border-none p-0 bg-transparent" />
                                           </div>
                                           <div className="flex items-center gap-2">
                                               <span className="text-[8px] text-gray-400 uppercase">Ancho:</span>
                                               <input type="number" step="0.5" min="0.1" max="10" value={slide.subtitleOutlineWidth || 1} onChange={e => onUpdate('subtitleOutlineWidth', parseFloat(e.target.value))} className="w-8 bg-transparent border-none py-0.5 text-[10px] text-white focus:outline-none" />
                                           </div>
                                      </div>
                                  )}
                              </div>

                              {/* Button Style Card */}
                              {slide.showButton && (
                                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 flex items-center justify-between">
                                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Colores Botón</label>
                                      <div className="flex gap-4">
                                          <div className="flex items-center gap-1">
                                              <span className="text-[8px] text-gray-500 uppercase">Fondo</span>
                                              <input type="color" value={slide.buttonColor || '#ffffff'} onChange={e => onUpdate('buttonColor', e.target.value)} className="w-5 h-5 rounded cursor-pointer border-none p-0 bg-transparent" />
                                          </div>
                                          <div className="flex items-center gap-1">
                                              <span className="text-[8px] text-gray-500 uppercase">Texto</span>
                                              <input type="color" value={slide.buttonTextColor || '#000000'} onChange={e => onUpdate('buttonTextColor', e.target.value)} className="w-5 h-5 rounded cursor-pointer border-none p-0 bg-transparent" />
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </div>
                     </div>
                 </div>
             </div>
        </div>
    );
};


// --- MAIN COMPONENT ---

// --- LEADS VIEW COMPONENT ---
const LeadsView: React.FC = () => {
    const [leads, setLeads] = useState<{name: string, phone: string, lastSeen: string}[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            // Fetch directly from Firestore for Netlify compatibility
            const { collection, getDocs, orderBy, query, limit } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            
            const messagesRef = collection(db, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1000));
            const snapshot = await getDocs(q);
            
            const leadsMap = new Map();
            snapshot.docs.forEach(doc => {
                const msg = doc.data();
                if (msg.sender && msg.senderPhone && !msg.isAdmin) {
                    // Prevenir duplicados, mantener el más reciente
                    if (!leadsMap.has(msg.senderPhone)) {
                        leadsMap.set(msg.senderPhone, {
                            name: msg.sender,
                            phone: msg.senderPhone,
                            lastSeen: msg.timestamp || new Date().toISOString()
                        });
                    }
                }
            });
            
            setLeads(Array.from(leadsMap.values()));
        } catch (error) {
            console.error('Error fetching leads:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    const exportToCSV = () => {
        const headers = ['Nombre', 'Teléfono', 'Última Actividad'];
        const csvContent = [
            headers.join(','),
            ...leads.map(lead => [
                `"${lead.name}"`,
                `"${lead.phone}"`,
                `"${new Date(lead.lastSeen).toLocaleString()}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `oyentes_uncion_radio_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <SectionHeader 
                title="Base de Datos de Oyentes" 
                subtitle="Lista de personas que han participado en el chat con su número de celular." 
                action={
                    <div className="flex space-x-2">
                        <button 
                            onClick={fetchLeads}
                            className="bg-gray-700 text-white px-3 py-2 rounded-lg hover:bg-gray-600 flex items-center transition-colors text-sm"
                        >
                            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </button>
                        <button 
                            onClick={exportToCSV}
                            disabled={leads.length === 0}
                            className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-500 flex items-center transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={16} className="mr-2" />
                            Exportar CSV
                        </button>
                    </div>
                }
            />

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-900/50 border-b border-gray-700">
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Oyente</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Celular / WhatsApp</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Última Actividad</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Loader2 className="animate-spin mb-2" size={32} />
                                            <p>Cargando oyentes...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : leads.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Users size={48} className="mb-4 opacity-20" />
                                            <p className="text-lg font-medium">No hay oyentes registrados aún</p>
                                            <p className="text-sm">Asegúrate de que la opción "Solicitar Celular" esté activa en el Chat.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                leads.map((lead, idx) => (
                                    <tr key={idx} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold mr-3">
                                                    {lead.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-white font-medium">{lead.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center text-gray-300">
                                                <Phone size={14} className="mr-2 text-green-500" />
                                                {lead.phone}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center text-gray-400 text-sm">
                                                <Calendar size={14} className="mr-2" />
                                                {new Date(lead.lastSeen).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <a 
                                                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-green-500 hover:text-green-400 font-bold text-xs flex items-center"
                                            >
                                                Contactar WhatsApp →
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const AdminPanel: React.FC = () => {
  const { config, updateConfig, logout, isAuthenticated } = useConfig();
  const [formData, setFormData] = useState<SiteConfig>(config);
  
  const [activeTab, setActiveTab] = useState<string>('appearance');
  const [adminProgramTab, setAdminProgramTab] = useState<'week' | 'weekend'>('week');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync state if config changes externally (e.g. reset)
  useEffect(() => {
    setFormData(config);
  }, [config]);

  if (!isAuthenticated) {
    window.location.hash = '#/login';
    return null;
  }

  const handleSave = () => {
    setSaveStatus('saving');
    setTimeout(() => {
        try {
            updateConfig(formData);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (e) {
            console.error(e);
            setSaveStatus('error');
            alert("Error: No se pudieron guardar los cambios. Es posible que las imágenes sean demasiado pesadas.");
        }
    }, 500);
  };

  const handleLogout = () => {
    logout();
    window.location.hash = ''; // Clear hash to go to root
  };

  const handleViewSite = () => {
    window.location.hash = ''; // Clear hash to go to root
  };

  // --- CONTENT HANDLERS ---
  const addSlide = () => {
    const newSlide: HeroSlide = {
        id: `slide-${Date.now()}`,
        title: "Nuevo Título",
        subtitle: "Nuevo Subtítulo",
        image: "https://picsum.photos/1900/600",
        alignment: 'center',
        titleColor: '#ffffff',
        titleSize: 48,
        titleShadow: 'strong',
        titleOutline: 'none',
        subtitleColor: '#ffffff',
        subtitleSize: 18,
        subtitleShadow: 'soft',
        subtitleOutline: 'none',
        showButton: true,
        buttonText: "Más Información",
        buttonLink: "#",
        buttonColor: formData.appearance.secondaryColor,
        buttonTextColor: formData.appearance.primaryColor
    };
    setFormData(prev => ({...prev, content: {...prev.content, hero: [...prev.content.hero, newSlide]}}));
  };

  const removeSlide = (id: string) => {
    if (formData.content.hero.length <= 1) {
        alert("Debes tener al menos un slide.");
        return;
    }
    setFormData(prev => ({...prev, content: {...prev.content, hero: prev.content.hero.filter(slide => slide.id !== id)}}));
  };

  const updateSlide = (id: string, field: keyof HeroSlide, value: any) => {
    setFormData(prev => ({...prev, content: {...prev.content, hero: prev.content.hero.map(slide => slide.id === id ? { ...slide, [field]: value } : slide)}}));
  };

  const addEpisode = () => {
      const newEp: PodcastEpisode = {
          id: `ep-${Date.now()}`,
          title: "Nuevo Episodio",
          date: new Date().toLocaleDateString(),
          image: "https://picsum.photos/400/250",
          videoUrl: ""
      };
      setFormData(prev => ({...prev, content: {...prev.content, podcast: {...prev.content.podcast, episodes: [newEp, ...prev.content.podcast.episodes]}}}));
  };

  const removeEpisode = (id: string) => {
      setFormData(prev => ({...prev, content: {...prev.content, podcast: {...prev.content.podcast, episodes: prev.content.podcast.episodes.filter(e => e.id !== id)}}}));
  };

  const updateEpisode = (id: string, field: keyof PodcastEpisode, value: string) => {
    setFormData(prev => ({...prev, content: {...prev.content, podcast: {...prev.content.podcast, episodes: prev.content.podcast.episodes.map(e => e.id === id ? { ...e, [field]: value } : e)}}}));
  };

  const addGalleryItem = () => {
    const newItem: GalleryItem = {
        id: `gal-${Date.now()}`,
        url: "",
        type: 'image',
        format: 'landscape',
        caption: ""
    };
    setFormData(prev => ({...prev, content: {...prev.content, gallery: {...prev.content.gallery, images: [newItem, ...prev.content.gallery.images]}}}));
  };

  const removeGalleryItem = (id: string) => {
    setFormData(prev => ({...prev, content: {...prev.content, gallery: {...prev.content.gallery, images: prev.content.gallery.images.filter(img => img.id !== id)}}}));
  };

  const updateGalleryItem = (id: string, field: keyof GalleryItem, value: any) => {
    setFormData(prev => ({...prev, content: {...prev.content, gallery: {...prev.content.gallery, images: prev.content.gallery.images.map(img => img.id === id ? { ...img, [field]: value } : img)}}}));
  };

  const updateNavItem = (id: string, field: string, value: any) => {
    setFormData(prev => {
        const updateRec = (items: NavItemConfig[]): NavItemConfig[] => {
            return items.map(item => {
                if (item.id === id) return { ...item, [field]: value };
                if (item.children) return { ...item, children: updateRec(item.children) };
                return item;
            });
        };
        return {
            ...prev,
            navigation: {
                ...prev.navigation,
                items: updateRec(prev.navigation.items || [])
            }
        };
    });
  };

  const removeNavItem = (id: string) => {
    setFormData(prev => {
        const removeRec = (items: NavItemConfig[]): NavItemConfig[] => {
            return items.filter(item => item.id !== id).map(item => ({
                ...item,
                children: item.children ? removeRec(item.children) : undefined
            }));
        };
        return {
            ...prev,
            navigation: {
                ...prev.navigation,
                items: removeRec(prev.navigation.items || [])
            }
        };
    });
  };

  const addNavItem = (parentId?: string) => {
      const newItem: NavItemConfig = {
          id: uuidv4(),
          label: "Nueva Sección",
          visible: true,
          link: "#"
      };
      
      setFormData(prev => {
          if (!parentId) {
              return {
                  ...prev,
                  navigation: {
                      ...prev.navigation,
                      items: [...(prev.navigation.items || []), newItem]
                  }
              };
          }
          
          const addRec = (items: NavItemConfig[]): NavItemConfig[] => {
              return items.map(item => {
                  if (item.id === parentId) {
                      return {
                          ...item,
                          children: [...(item.children || []), newItem]
                      };
                  }
                  if (item.children) {
                      return { ...item, children: addRec(item.children) };
                  }
                  return item;
              });
          };
          
          return {
              ...prev,
              navigation: {
                  ...prev.navigation,
                  items: addRec(prev.navigation.items || [])
              }
          };
      });
  };

  const moveNavItem = (id: string, direction: 'up' | 'down') => {
      setFormData(prev => {
          const moveRec = (items: NavItemConfig[]): NavItemConfig[] => {
              const idx = items.findIndex(item => item.id === id);
              if (idx !== -1) {
                  const newItems = [...items];
                  if (direction === 'up' && idx > 0) {
                      [newItems[idx], newItems[idx - 1]] = [newItems[idx - 1], newItems[idx]];
                  } else if (direction === 'down' && idx < newItems.length - 1) {
                      [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
                  }
                  return newItems;
              }
              return items.map(item => ({
                  ...item,
                  children: item.children ? moveRec(item.children) : undefined
              }));
          };
          return {
              ...prev,
              navigation: {
                  ...prev.navigation,
                  items: moveRec(prev.navigation.items || [])
              }
          };
      });
  };

  const addProgram = () => {
    const newProg = {
      id: `prog-${Date.now()}`,
      title: "Nuevo Programa",
      description: "Descripción del programa",
      schedule: "Horario",
      announcerImage: ""
    };
    setFormData(prev => ({...prev, content: {...prev.content, program: {...prev.content.program, programs: [...(prev.content.program.programs || []), newProg]}}}));
  };

  const removeProgram = (id: string) => {
    setFormData(prev => ({...prev, content: {...prev.content, program: {...prev.content.program, programs: prev.content.program.programs.filter(p => p.id !== id)}}}));
  };

  const updateProgram = (id: string, field: string, value: string) => {
    setFormData(prev => ({...prev, content: {...prev.content, program: {...prev.content.program, programs: prev.content.program.programs.map(p => p.id === id ? { ...p, [field]: value } : p)}}}));
  };

  const addWeekendProgram = () => {
    const newProg = {
      id: `weekend-${Date.now()}`,
      title: "Nuevo Programa Fin de Semana",
      description: "Descripción del programa",
      schedule: "Sábados y Domingos",
      announcerImage: ""
    };
    setFormData(prev => ({...prev, content: {...prev.content, program: {...prev.content.program, weekendPrograms: [...(prev.content.program.weekendPrograms || []), newProg]}}}));
  };

  const removeWeekendProgram = (id: string) => {
    setFormData(prev => ({...prev, content: {...prev.content, program: {...prev.content.program, weekendPrograms: (prev.content.program.weekendPrograms || []).filter(p => p.id !== id)}}}));
  };

  const updateWeekendProgram = (id: string, field: string, value: string) => {
    setFormData(prev => ({...prev, content: {...prev.content, program: {...prev.content.program, weekendPrograms: (prev.content.program.weekendPrograms || []).map(p => p.id === id ? { ...p, [field]: value } : p)}}}));
  };

  const addRibbon = () => {
    const newRibbon: any = {
      id: `ribbon-${Date.now()}`,
      text: "Nuevo mensaje del cintillo",
      fontFamily: "Inter",
      fontSize: 16,
      textColor: "#ffffff",
      backgroundColor: formData.appearance.secondaryColor,
      speed: 20,
      visible: true
    };
    setFormData(prev => ({...prev, content: {...prev.content, ribbons: [...(prev.content.ribbons || []), newRibbon]}}));
  };

  const removeRibbon = (id: string) => {
    setFormData(prev => ({...prev, content: {...prev.content, ribbons: prev.content.ribbons.filter(r => r.id !== id)}}));
  };

  const updateRibbon = (id: string, field: string, value: any) => {
    setFormData(prev => ({...prev, content: {...prev.content, ribbons: prev.content.ribbons.map(r => r.id === id ? { ...r, [field]: value } : r)}}));
  };

  // --- CLIENTS HANDLERS ---
  const addClient = () => {
    const newClient: Client = {
      id: `client-${Date.now()}`,
      name: "Nuevo Cliente",
      bannerUrl: "",
      whatsapp: "",
      facebook: "",
      instagram: "",
      twitter: "",
      website: "",
      address: "",
      mapUrl: "",
      productImages: []
    };
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        clients: [...(prev.content.clients || []), newClient]
      }
    }));
  };

  const removeClient = (id: string) => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        clients: (prev.content.clients || []).filter(c => c.id !== id)
      }
    }));
  };

  const updateClient = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        clients: (prev.content.clients || []).map(c => c.id === id ? { ...c, [field]: value } : c)
      }
    }));
  };

  // --- NEWS HANDLERS ---
  const addNewsArticle = () => {
    const newArticle = {
        id: uuidv4(),
        title: "Nueva Noticia",
        summary: "Breve resumen de la noticia...",
        content: "Contenido completo aquí...",
        date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
        image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000&auto=format&fit=crop",
        author: formData.content.chat.adminName || "Admin",
        category: "General",
        isPublished: true
    };
    
    setFormData(prev => ({
        ...prev,
        content: {
            ...prev.content,
            news: {
                title: prev.content.news?.title || "Noticias",
                description: prev.content.news?.description || "Mantente informado.",
                articles: [newArticle, ...(prev.content.news?.articles || [])]
            }
        }
    }));
  };

  const removeNewsArticle = (id: string) => {
    setFormData(prev => ({
        ...prev,
        content: {
            ...prev.content,
            news: prev.content.news ? {
                ...prev.content.news,
                articles: (prev.content.news.articles || []).filter(a => a.id !== id)
            } : undefined
        }
    }));
  };

  const updateNewsArticle = (id: string, field: string, value: any) => {
    setFormData(prev => ({
        ...prev,
        content: {
            ...prev.content,
            news: prev.content.news ? {
                ...prev.content.news,
                articles: (prev.content.news.articles || []).map(a => a.id === id ? { ...a, [field]: value } : a)
            } : undefined
        }
    }));
  };

  const addRssFeed = () => {
    const newFeed = {
        id: uuidv4(),
        name: "Nuevo Portal",
        url: ""
    };
    setFormData(prev => ({
        ...prev,
        content: {
            ...prev.content,
            news: {
                title: prev.content.news?.title || "Noticias",
                description: prev.content.news?.description || "Mantente informado.",
                articles: prev.content.news?.articles || [],
                rssFeeds: [newFeed, ...(prev.content.news?.rssFeeds || [])]
            }
        }
    }));
  };

  const removeRssFeed = (id: string) => {
    setFormData(prev => ({
        ...prev,
        content: {
            ...prev.content,
            news: prev.content.news ? {
                ...prev.content.news,
                rssFeeds: (prev.content.news.rssFeeds || []).filter(f => f.id !== id)
            } : undefined
        }
    }));
  };

  const updateRssFeed = (id: string, field: string, value: string) => {
    setFormData(prev => ({
        ...prev,
        content: {
            ...prev.content,
            news: prev.content.news ? {
                ...prev.content.news,
                rssFeeds: (prev.content.news.rssFeeds || []).map(f => f.id === id ? { ...f, [field]: value } : f)
            } : undefined
        }
    }));
  };

  const addTopVideo = () => {
    const newVideo = { id: uuidv4(), title: "Nuevo Latigazo", url: "" };
    setFormData(prev => ({
        ...prev,
        content: {
            ...prev.content,
            topVideos: {
                enabled: prev.content.topVideos?.enabled ?? true,
                title: prev.content.topVideos?.title || "Los 5 Latigazos de la semana",
                description: prev.content.topVideos?.description || "",
                videos: [...(prev.content.topVideos?.videos || []), newVideo],
                history: prev.content.topVideos?.history || [],
                monthlySummaries: prev.content.topVideos?.monthlySummaries || []
            }
        }
    }));
  };

  const removeTopVideo = (id: string) => {
    setFormData(prev => ({
        ...prev,
        content: {
            ...prev.content,
            topVideos: prev.content.topVideos ? {
                ...prev.content.topVideos,
                videos: (prev.content.topVideos.videos || []).filter(v => v.id !== id)
            } : undefined
        }
    }));
  };

  const updateTopVideo = (id: string, field: string, value: string) => {
    setFormData(prev => ({
        ...prev,
        content: {
            ...prev.content,
            topVideos: prev.content.topVideos ? {
                ...prev.content.topVideos,
                videos: (prev.content.topVideos.videos || []).map(v => v.id === id ? { ...v, [field]: value } : v)
            } : undefined
        }
    }));
  };

  const addWeeklyList = () => {
      const newList = {
          id: uuidv4(),
          date: `Semana ${new Date().toLocaleDateString()}`,
          videos: []
      };
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  history: [newList, ...(prev.content.topVideos?.history || [])]
              }
          }
      }));
  };

  const removeWeeklyList = (id: string) => {
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  history: (prev.content.topVideos?.history || []).filter(h => h.id !== id)
              }
          }
      }));
  };
  
  const updateWeeklyList = (id: string, field: string, value: any) => {
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  history: (prev.content.topVideos?.history || []).map(h => h.id === id ? { ...h, [field]: value } : h)
              }
          }
      }));
  };

  const addVideoToWeeklyList = (listId: string) => {
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  history: (prev.content.topVideos?.history || []).map(h => {
                      if (h.id === listId) {
                          return { ...h, videos: [...h.videos, { id: uuidv4(), title: 'Nuevo Video Historico', url: '' }] };
                      }
                      return h;
                  })
              }
          }
      }));
  };

  const removeVideoFromWeeklyList = (listId: string, videoId: string) => {
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  history: (prev.content.topVideos?.history || []).map(h => {
                      if (h.id === listId) {
                          return { ...h, videos: h.videos.filter(v => v.id !== videoId) };
                      }
                      return h;
                  })
              }
          }
      }));
  };

  const updateVideoInWeeklyList = (listId: string, videoId: string, field: string, value: string) => {
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  history: (prev.content.topVideos?.history || []).map(h => {
                      if (h.id === listId) {
                          return { ...h, videos: h.videos.map(v => v.id === videoId ? { ...v, [field]: value } : v) };
                      }
                      return h;
                  })
              }
          }
      }));
  };

  const addMonthlySummary = () => {
      const newSummary = {
          id: uuidv4(),
          month: `Mes de ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          summaryText: "Resumen del mes...",
          videos: []
      };
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  monthlySummaries: [newSummary, ...(prev.content.topVideos?.monthlySummaries || [])]
              }
          }
      }));
  };

  const removeMonthlySummary = (id: string) => {
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  monthlySummaries: (prev.content.topVideos?.monthlySummaries || []).filter(ms => ms.id !== id)
              }
          }
      }));
  };

  const updateMonthlySummary = (id: string, field: string, value: any) => {
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  monthlySummaries: (prev.content.topVideos?.monthlySummaries || []).map(ms => ms.id === id ? { ...ms, [field]: value } : ms)
              }
          }
      }));
  };

  const addVideoToMonthlySummary = (summaryId: string) => {
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  monthlySummaries: (prev.content.topVideos?.monthlySummaries || []).map(ms => {
                      if (ms.id === summaryId) {
                          return { ...ms, videos: [...ms.videos, { id: uuidv4(), title: 'Video del mes', url: '' }] };
                      }
                      return ms;
                  })
              }
          }
      }));
  };

  const removeVideoFromMonthlySummary = (summaryId: string, videoId: string) => {
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  monthlySummaries: (prev.content.topVideos?.monthlySummaries || []).map(ms => {
                      if (ms.id === summaryId) {
                          return { ...ms, videos: ms.videos.filter(v => v.id !== videoId) };
                      }
                      return ms;
                  })
              }
          }
      }));
  };

  const updateVideoInMonthlySummary = (summaryId: string, videoId: string, field: string, value: string) => {
      setFormData(prev => ({
          ...prev,
          content: {
              ...prev.content,
              topVideos: {
                  ...prev.content.topVideos!,
                  monthlySummaries: (prev.content.topVideos?.monthlySummaries || []).map(ms => {
                      if (ms.id === summaryId) {
                          return { ...ms, videos: ms.videos.map(v => v.id === videoId ? { ...v, [field]: value } : v) };
                      }
                      return ms;
                  })
              }
          }
      }));
  };

  const addClientProductImage = (clientId: string, imageUrl: string) => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        clients: (prev.content.clients || []).map(c => 
          c.id === clientId ? { ...c, productImages: [...c.productImages, imageUrl] } : c
        )
      }
    }));
  };

  const removeClientProductImage = (clientId: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        clients: (prev.content.clients || []).map(c => 
          c.id === clientId ? { ...c, productImages: c.productImages.filter((_, i) => i !== index) } : c
        )
      }
    }));
  };

  const SaveAction = () => (
      <div className="mt-8 pt-6 border-t border-gray-700 flex justify-end">
          <button 
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg text-white font-bold transition-all shadow-md transform active:scale-95 ${
                    saveStatus === 'saved' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : saveStatus === 'error' ? 'bg-red-600 hover:bg-red-700'
                    : saveStatus === 'saving' ? 'bg-gray-600 cursor-wait' : 'bg-primary hover:bg-purple-900 hover:scale-105'
                }`}
            >
                {saveStatus === 'saving' ? (<><span>Guardando...</span></>) : 
                 saveStatus === 'saved' ? (<><Save size={18} /><span>Guardado!</span></>) : 
                 saveStatus === 'error' ? (<><AlertTriangle size={18} /><span>Error de Espacio</span></>) : 
                 (<><Save size={18} /><span>Guardar Cambios</span></>)}
            </button>
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col relative w-full">
      
      {/* Top Header */}
      <header className="bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 py-4 shadow-md z-30 sticky top-0 w-full">
        <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-purple-800 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-purple-900/30">
                {formData.general.stationName.substring(0,1)}
            </div>
            <div>
                <span className="block font-bold text-white text-lg lg:text-xl tracking-tight">Panel de Administración</span>
                <span className="block text-sm text-gray-500">v1.3.0 - Unción Radio</span>
            </div>
        </div>
        
        <div className="flex items-center space-x-4">
             <button onClick={handleViewSite} className="hidden md:block text-sm font-bold text-gray-400 hover:text-white transition-colors">
                Ver Sitio Público &rarr;
             </button>
             <button onClick={handleLogout} className="flex items-center space-x-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 px-3 py-2 rounded-lg transition-colors" title="Cerrar Sesión">
                <LogOut size={20} />
             </button>
             <button 
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className={`flex items-center px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${
                    saveStatus === 'saving' ? 'bg-gray-700 cursor-not-allowed' :
                    saveStatus === 'saved' ? 'bg-green-600 shadow-green-900/50' :
                    saveStatus === 'error' ? 'bg-red-600 shadow-red-900/50' :
                    'bg-primary hover:bg-primary/90 shadow-primary/30 hover:scale-105'
                }`}
            >
                {saveStatus === 'saving' ? <Loader2 size={20} className="animate-spin md:mr-2" /> : 
                 saveStatus === 'saved' ? <Layout size={20} className="md:mr-2" /> : 
                 <Save size={20} className="md:mr-2" />}
                <span className="hidden md:inline">
                    {saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Cambios'}
                </span>
            </button>
        </div>
      </header>
      
      {/* Horizontal Tabs Navigation */}
      <nav className="bg-gray-900/95 backdrop-blur-md border-b border-gray-800 flex overflow-x-auto custom-scrollbar px-6 py-3 space-x-3 z-20 sticky top-[80px] w-full">
          <TabButton id="appearance" activeTab={activeTab} onClick={setActiveTab} icon={Layout} label="Apariencia" />
          <TabButton id="header" activeTab={activeTab} onClick={setActiveTab} icon={Compass} label="Menú" />
          <TabButton id="sections" activeTab={activeTab} onClick={setActiveTab} icon={Grid} label="Secciones" />
          <TabButton id="hero" activeTab={activeTab} onClick={setActiveTab} icon={Home} label="Banner" />
          <TabButton id="topvideos" activeTab={activeTab} onClick={setActiveTab} icon={PlayCircle} label="Top Videos" />
          <TabButton id="podcast" activeTab={activeTab} onClick={setActiveTab} icon={Mic2} label="Podcast" />
          <TabButton id="program" activeTab={activeTab} onClick={setActiveTab} icon={Calendar} label="Program" />
          <TabButton id="gallery" activeTab={activeTab} onClick={setActiveTab} icon={Grid} label="Galería" />
          <TabButton id="clients" activeTab={activeTab} onClick={setActiveTab} icon={Users} label="Aliados" />
          <TabButton id="news" activeTab={activeTab} onClick={setActiveTab} icon={Newspaper} label="Noticias" />
          <TabButton id="chat" activeTab={activeTab} onClick={setActiveTab} icon={MessageSquare} label="Chat" />
          <TabButton id="leads" activeTab={activeTab} onClick={setActiveTab} icon={Users} label="Oyentes" />
          <TabButton id="general" activeTab={activeTab} onClick={setActiveTab} icon={Radio} label="Footer" />
          <TabButton id="auth" activeTab={activeTab} onClick={setActiveTab} icon={Lock} label="Acceso" />
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full bg-gray-950 p-4 md:p-12 mb-20">
        <div className="max-w-7xl mx-auto bg-gray-900/50 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-800 p-6 md:p-12 min-h-full">
            
            {activeTab === 'appearance' && (
              <div className="space-y-6 animate-fade-in">
                 <SectionHeader title="Apariencia y Marca" subtitle="Personaliza los colores y fuentes de tu sitio web." />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputGroup label="Color Primario (Dominante)">
                        <div className="flex space-x-2">
                            <input type="color" value={formData.appearance.primaryColor} onChange={e => setFormData(prev => ({...prev, appearance: {...prev.appearance, primaryColor: e.target.value}}))} className="h-11 w-20 rounded-lg cursor-pointer border border-gray-600 bg-transparent" />
                            <input type="text" value={formData.appearance.primaryColor} onChange={e => setFormData(prev => ({...prev, appearance: {...prev.appearance, primaryColor: e.target.value}}))} className="flex-1 bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg uppercase" />
                        </div>
                    </InputGroup>
                    <InputGroup label="Color Secundario (Acentos)">
                        <div className="flex space-x-2">
                            <input type="color" value={formData.appearance.secondaryColor} onChange={e => setFormData(prev => ({...prev, appearance: {...prev.appearance, secondaryColor: e.target.value}}))} className="h-11 w-20 rounded-lg cursor-pointer border border-gray-600 bg-transparent" />
                            <input type="text" value={formData.appearance.secondaryColor} onChange={e => setFormData(prev => ({...prev, appearance: {...prev.appearance, secondaryColor: e.target.value}}))} className="flex-1 bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg uppercase" />
                        </div>
                    </InputGroup>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                     <InputGroup label="Color de Títulos">
                        <div className="flex space-x-2">
                            <input type="color" value={formData.appearance.headingColor || formData.appearance.primaryColor} onChange={e => setFormData(prev => ({...prev, appearance: {...prev.appearance, headingColor: e.target.value}}))} className="h-11 w-20 rounded-lg cursor-pointer border border-gray-600 bg-transparent" />
                            <input type="text" value={formData.appearance.headingColor || formData.appearance.primaryColor} onChange={e => setFormData(prev => ({...prev, appearance: {...prev.appearance, headingColor: e.target.value}}))} className="flex-1 bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg uppercase" />
                        </div>
                    </InputGroup>
                     <InputGroup label="Color de Texto General">
                        <div className="flex space-x-2">
                            <input type="color" value={formData.appearance.textColor} onChange={e => setFormData(prev => ({...prev, appearance: {...prev.appearance, textColor: e.target.value}}))} className="h-11 w-20 rounded-lg cursor-pointer border border-gray-600 bg-transparent" />
                            <input type="text" value={formData.appearance.textColor} onChange={e => setFormData(prev => ({...prev, appearance: {...prev.appearance, textColor: e.target.value}}))} className="flex-1 bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg uppercase" />
                        </div>
                    </InputGroup>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputGroup label="Fuente de Títulos">
                        <select value={formData.appearance.headingFont} onChange={e => setFormData(prev => ({...prev, appearance: {...prev.appearance, headingFont: e.target.value as FontFamily}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg">
                            {FONT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </InputGroup>
                    <InputGroup label="Fuente de Cuerpo">
                        <select value={formData.appearance.bodyFont} onChange={e => setFormData(prev => ({...prev, appearance: {...prev.appearance, bodyFont: e.target.value as FontFamily}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg">
                             {FONT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </InputGroup>
                 </div>
                 <SaveAction />
              </div>
            )}

            {activeTab === 'ribbon' && (
                <div className="animate-fade-in space-y-6">
                    <SectionHeader 
                        title="Cintillos de Texto" 
                        subtitle="Configura los mensajes que aparecen debajo del banner principal. Puedes agregar múltiples cintillos que se mostrarán en una sola línea continua." 
                        action={
                            <button onClick={addRibbon} className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-900 flex items-center text-sm shadow-md transition-all active:scale-95">
                                <Plus size={18} className="mr-1"/> Agregar Cintillo
                            </button>
                        }
                    />

                    {/* Global Preview */}
                    {(formData.content.ribbons || []).some(r => r.visible) && (
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8">
                            <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Vista Previa Global (En Vivo)</h3>
                            <div className="border border-gray-900 rounded-lg overflow-hidden bg-black/20 min-h-[60px] flex items-center">
                                <div className="w-full overflow-hidden relative">
                                    <div className="flex whitespace-nowrap">
                                        {(formData.content.ribbons || []).filter(r => r.visible).map((r, i) => (
                                            <div 
                                                key={r.id} 
                                                className="py-3 px-8 flex-shrink-0"
                                                style={{ 
                                                    backgroundColor: r.backgroundColor, 
                                                    color: r.textColor, 
                                                    fontFamily: r.fontFamily, 
                                                    fontSize: `${r.fontSize}px` 
                                                }}
                                            >
                                                {r.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2 italic">* En la web pública, si tienen velocidad, se desplazarán continuamente.</p>
                        </div>
                    )}
                    
                    <div className="space-y-8">
                        {(formData.content.ribbons || []).map((ribbon, idx) => (
                            <div key={ribbon.id} className="bg-gray-800 p-6 rounded-xl border border-gray-700 relative group">
                                <button 
                                    onClick={() => removeRibbon(ribbon.id)} 
                                    className="absolute top-4 right-4 text-gray-500 hover:text-red-500 transition-colors p-1"
                                    title="Eliminar Cintillo"
                                >
                                    <Trash2 size={20} />
                                </button>

                                <div className="flex items-center gap-2 mb-6">
                                    <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded">Cintillo #{idx + 1}</span>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Configuración</h3>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={ribbon.visible} 
                                                    onChange={(e) => updateRibbon(ribbon.id, 'visible', e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                <span className="ml-3 text-xs font-medium text-gray-400">{ribbon.visible ? 'Visible' : 'Oculto'}</span>
                                            </label>
                                        </div>

                                        <InputGroup label="Texto del Mensaje">
                                            <textarea 
                                                value={ribbon.text || ''}
                                                onChange={(e) => updateRibbon(ribbon.id, 'text', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-primary outline-none h-24 resize-none"
                                                placeholder="Escribe el mensaje aquí..."
                                            />
                                        </InputGroup>

                                        <div className="grid grid-cols-2 gap-4">
                                            <InputGroup label="Fuente">
                                                <select 
                                                    value={ribbon.fontFamily || 'Inter'}
                                                    onChange={(e) => updateRibbon(ribbon.id, 'fontFamily', e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary outline-none text-sm"
                                                >
                                                    {FONT_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </InputGroup>

                                            <InputGroup label="Tamaño (px)">
                                                <input 
                                                    type="number" 
                                                    value={ribbon.fontSize || 16}
                                                    onChange={(e) => updateRibbon(ribbon.id, 'fontSize', parseInt(e.target.value))}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-primary outline-none"
                                                />
                                            </InputGroup>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <InputGroup label="Color de Texto">
                                                <div className="flex items-center p-2 bg-gray-900 rounded-lg border border-gray-700">
                                                    <input 
                                                        type="color" 
                                                        value={ribbon.textColor || '#ffffff'}
                                                        onChange={(e) => updateRibbon(ribbon.id, 'textColor', e.target.value)}
                                                        className="w-12 h-10 rounded cursor-pointer border-none bg-transparent"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={ribbon.textColor || '#ffffff'}
                                                        onChange={(e) => updateRibbon(ribbon.id, 'textColor', e.target.value)}
                                                        className="ml-2 flex-1 bg-transparent border-none text-xs text-white uppercase focus:ring-0"
                                                    />
                                                </div>
                                            </InputGroup>

                                            <InputGroup label="Color de Fondo">
                                                <div className="flex items-center p-2 bg-gray-900 rounded-lg border border-gray-700">
                                                    <input 
                                                        type="color" 
                                                        value={ribbon.backgroundColor || '#000000'}
                                                        onChange={(e) => updateRibbon(ribbon.id, 'backgroundColor', e.target.value)}
                                                        className="w-12 h-10 rounded cursor-pointer border-none bg-transparent"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={ribbon.backgroundColor || '#000000'}
                                                        onChange={(e) => updateRibbon(ribbon.id, 'backgroundColor', e.target.value)}
                                                        className="ml-2 flex-1 bg-transparent border-none text-xs text-white uppercase focus:ring-0"
                                                    />
                                                </div>
                                            </InputGroup>
                                        </div>

                                        <InputGroup label={`Velocidad: ${ribbon.speed === 0 ? 'Estático' : ribbon.speed}`}>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="100" 
                                                value={ribbon.speed || 0}
                                                onChange={(e) => updateRibbon(ribbon.id, 'speed', parseInt(e.target.value))}
                                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                        </InputGroup>
                                    </div>

                                    <div className="flex flex-col justify-center">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-widest">Vista Previa</h3>
                                        <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-900 min-h-[120px] flex items-center justify-center p-6 shadow-inner">
                                            {ribbon.visible ? (
                                                <div 
                                                    style={{ 
                                                        backgroundColor: ribbon.backgroundColor,
                                                        color: ribbon.textColor,
                                                        fontFamily: ribbon.fontFamily,
                                                        fontSize: `${ribbon.fontSize}px`
                                                    }}
                                                    className="w-full py-4 px-8 text-center shadow-lg rounded-lg overflow-hidden relative"
                                                >
                                                    {ribbon.speed > 0 ? (
                                                        <div className="whitespace-nowrap inline-block animate-marquee">
                                                            {ribbon.text}
                                                            <span className="mx-10">{ribbon.text}</span>
                                                        </div>
                                                    ) : (
                                                        ribbon.text
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-gray-600">
                                                    <EyeOff size={32} className="mb-2 opacity-20" />
                                                    <span className="italic text-sm">Cintillo Oculto</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {(!formData.content.ribbons || formData.content.ribbons.length === 0) && (
                            <div className="text-center py-20 bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-700">
                                <Type size={48} className="mx-auto text-gray-600 mb-4 opacity-20" />
                                <p className="text-gray-400 font-medium">No hay cintillos configurados.</p>
                                <button onClick={addRibbon} className="mt-4 text-primary hover:text-white font-bold transition-colors">
                                    Haz clic aquí para agregar el primero
                                </button>
                            </div>
                        )}
                    </div>

                    <SaveAction />
                </div>
            )}
            
            {activeTab === 'header' && (
                <div className="space-y-6 animate-fade-in">
                    <SectionHeader title="Encabezado y Navegación" subtitle="Personaliza el logo, el título y los estilos del menú." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                         <div className="space-y-4">
                             <InputGroup label="Nombre del Sitio (Título)">
                                <input type="text" value={formData.general.stationName || ''} onChange={e => setFormData(prev => ({...prev, general: {...prev.general, stationName: e.target.value}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg" />
                             </InputGroup>
                             <div className="flex items-center space-x-3 bg-gray-800 p-3 rounded-lg border border-gray-700">
                                <input type="checkbox" id="showLogo" checked={!!formData.navigation.showLogo} onChange={e => setFormData(prev => ({...prev, navigation: {...prev.navigation, showLogo: e.target.checked}}))} className="h-5 w-5 accent-primary rounded bg-gray-700 border-gray-600" />
                                <label htmlFor="showLogo" className="text-sm font-bold text-gray-300">Mostrar Logotipo</label>
                             </div>
                             {formData.navigation.showLogo && (
                                <>
                                    <MediaUploader 
                                        label="Logotipo" 
                                        value={formData.navigation.logoUrl || ''} 
                                        onChange={(val) => setFormData(prev => ({...prev, navigation: {...prev.navigation, logoUrl: val}}))} 
                                        type="image" 
                                    />
                                    <InputGroup label={`Tamaño del Logo: ${formData.navigation.logoHeight || 60}px`}>
                                        <input type="range" min="20" max="120" value={formData.navigation.logoHeight || 60} onChange={e => setFormData(prev => ({...prev, navigation: {...prev.navigation, logoHeight: parseInt(e.target.value)}}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                    </InputGroup>
                                </>
                             )}
                         </div>
                         <div className="space-y-4">
                             <InputGroup label="Color de Fondo (Nav)">
                                <div className="flex space-x-2">
                                    <input type="color" value={formData.navigation.navBackgroundColor || '#000000'} onChange={e => setFormData(prev => ({...prev, navigation: {...prev.navigation, navBackgroundColor: e.target.value}}))} className="h-10 w-16 rounded cursor-pointer border-none bg-transparent" />
                                    <input type="text" value={formData.navigation.navBackgroundColor || '#000000'} onChange={e => setFormData(prev => ({...prev, navigation: {...prev.navigation, navBackgroundColor: e.target.value}}))} className="flex-1 bg-gray-800 border border-gray-600 text-white p-2 rounded-lg" />
                                </div>
                             </InputGroup>
                             <InputGroup label="Color de Texto (Links)">
                                <div className="flex space-x-2">
                                    <input type="color" value={formData.navigation.navTextColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, navigation: {...prev.navigation, navTextColor: e.target.value}}))} className="h-10 w-16 rounded cursor-pointer border-none bg-transparent" />
                                    <input type="text" value={formData.navigation.navTextColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, navigation: {...prev.navigation, navTextColor: e.target.value}}))} className="flex-1 bg-gray-800 border border-gray-600 text-white p-2 rounded-lg" />
                                </div>
                             </InputGroup>
                             <InputGroup label="Color Resaltado (Active)">
                                <div className="flex space-x-2">
                                    <input type="color" value={formData.navigation.navActiveColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, navigation: {...prev.navigation, navActiveColor: e.target.value}}))} className="h-10 w-16 rounded cursor-pointer border-none bg-transparent" />
                                    <input type="text" value={formData.navigation.navActiveColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, navigation: {...prev.navigation, navActiveColor: e.target.value}}))} className="flex-1 bg-gray-800 border border-gray-600 text-white p-2 rounded-lg" />
                                </div>
                             </InputGroup>
                             <InputGroup label={`Tamaño de Fuente Menú: ${formData.navigation.navFontSize || 14}px`}>
                                <input type="range" min="10" max="24" value={formData.navigation.navFontSize || 14} onChange={e => setFormData(prev => ({...prev, navigation: {...prev.navigation, navFontSize: parseInt(e.target.value)}}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary" />
                             </InputGroup>
                         </div>
                    </div>

                    <SaveAction />
                </div>
            )}

            {activeTab === 'sections' && (
              <div className="space-y-6 animate-fade-in">
                 <SectionHeader 
                    title="Configuración del Menú" 
                    subtitle="Gestiona el orden, los nombres y la jerarquía de los enlaces en el menú principal." 
                    action={
                        <button onClick={() => addNavItem()} className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-900 flex items-center text-sm shadow-md transition-all active:scale-95">
                            <Plus size={18} className="mr-1"/> Agregar al Menú
                        </button>
                    }
                 />
                 
                 <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="space-y-4 max-w-4xl mx-auto">
                        {(formData.navigation.items || []).map(item => (
                            <div key={item.id}>
                                {(() => {
                                    const renderItem = (navItem: NavItemConfig, level = 0): React.ReactNode => (
                                        <div key={navItem.id} className={`bg-gray-900 border rounded-xl overflow-hidden mb-3 ${level > 0 ? 'ml-6 md:ml-12 border-gray-700' : 'border-gray-800 shadow-lg shadow-black/20'}`}>
                                            <div className="bg-gray-800 px-4 py-2.5 flex items-center justify-between gap-4 border-b border-gray-700">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col">
                                                        <button onClick={() => moveNavItem(navItem.id, 'up')} className="text-gray-500 hover:text-white p-0.5" title="Subir"><ChevronUp size={14}/></button>
                                                        <button onClick={() => moveNavItem(navItem.id, 'down')} className="text-gray-500 hover:text-white p-0.5" title="Bajar"><ChevronDown size={14}/></button>
                                                    </div>
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${navItem.visible ? 'bg-primary/20 text-primary' : 'bg-gray-700 text-gray-500'}`}>
                                                        {navItem.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        value={navItem.label} 
                                                        onChange={e => updateNavItem(navItem.id, 'label', e.target.value)}
                                                        className="bg-transparent border-none text-white font-bold focus:ring-0 p-0 text-sm md:text-base outline-none min-w-[150px]"
                                                        placeholder="Nombre del Item"
                                                    />
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={!!navItem.visible} 
                                                            onChange={(e) => updateNavItem(navItem.id, 'visible', e.target.checked)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                                    </label>
                                                    <button 
                                                        onClick={() => removeNavItem(navItem.id)}
                                                        className="text-gray-400 hover:text-red-500 p-1.5 transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest pl-1">Vincular a (ID o URL)</label>
                                                    <div className="flex items-center bg-gray-950 rounded-lg px-3 py-2 border border-gray-700">
                                                        <LinkIcon size={14} className="text-gray-500 mr-2" />
                                                        <input 
                                                            type="text" 
                                                            value={navItem.link || ''} 
                                                            onChange={e => updateNavItem(navItem.id, 'link', e.target.value)}
                                                            className="bg-transparent border-none text-white text-xs flex-1 focus:ring-0 p-0 outline-none"
                                                            placeholder="Ej: #podcast, #news, o URL completa"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-end pb-1">
                                                    {level === 0 && (
                                                        <button 
                                                            onClick={() => addNavItem(navItem.id)}
                                                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-secondary hover:text-white transition-colors bg-secondary/10 px-3 py-1.5 rounded-lg border border-secondary/20"
                                                        >
                                                            <Plus size={14} /> Añadir Sub-Menú
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {navItem.children && navItem.children.length > 0 && (
                                                <div className="bg-gray-950/30 p-2 border-t border-gray-800">
                                                    {navItem.children.map(child => renderItem(child, level + 1))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                    return renderItem(item);
                                })()}
                            </div>
                        ))}

                        {(formData.navigation.items || []).length === 0 && (
                            <div className="text-center py-20 bg-gray-900 rounded-2xl border-2 border-dashed border-gray-700">
                                <Layout size={48} className="mx-auto text-gray-700 mb-4 opacity-30" />
                                <p className="text-gray-400">El menú está vacío. Agrega secciones o enlaces personalizados.</p>
                                <button onClick={() => addNavItem()} className="mt-4 text-primary font-bold hover:underline">Agregar Item</button>
                            </div>
                        )}
                    </div>
                 </div>

                 <div className="bg-blue-900/20 border border-blue-900/50 p-5 rounded-xl flex items-start shadow-inner">
                    <AlertTriangle className="text-blue-400 mr-4 mt-0.5 flex-shrink-0" size={20} />
                    <div className="space-y-2">
                        <p className="text-sm text-blue-100 font-bold">Instrucciones del Menú:</p>
                        <ul className="text-xs text-blue-200/80 space-y-1 list-disc pl-4">
                            <li>Usa el símbolo <strong>#</strong> seguido del nombre de la sección para scroll interno (Ej: <code>#podcast</code>, <code>#news</code>).</li>
                            <li>Usa URLs completas para enlaces externos (Ej: <code>https://google.com</code>).</li>
                            <li>Puedes crear menús desplegables añadiendo "Sub-Menús" a los items principales.</li>
                            <li>El orden de los elementos aquí es el mismo que aparecerá en el sitio.</li>
                        </ul>
                    </div>
                 </div>

                 <SaveAction />
              </div>
            )}

            {activeTab === 'hero' && (
              <div className="space-y-6 animate-fade-in">
                <SectionHeader title="Banner de Inicio" subtitle="Gestiona las imágenes deslizantes." action={ <button onClick={addSlide} className="bg-primary text-white px-3 py-2 rounded-lg hover:bg-opacity-90 flex items-center shadow-md text-sm"> <Plus size={16} className="mr-1"/> Agregar Slide </button> } />
                <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl mb-6">
                    <InputGroup label={`Tiempo de Rotación: ${(formData.content.heroInterval / 1000).toFixed(1)} segundos`}>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-gray-500">2s</span>
                            <input type="range" min="2000" max="15000" step="500" value={formData.content.heroInterval || 5000} onChange={(e) => setFormData(prev => ({...prev, content: { ...prev.content, heroInterval: parseInt(e.target.value) }}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary" />
                            <span className="text-xs font-bold text-gray-500">15s</span>
                        </div>
                    </InputGroup>
                </div>
                <div className="space-y-4">
                    {formData.content.hero.map((slide, index) => (
                        <CompactHeroSlide 
                            key={slide.id} 
                            slide={slide} 
                            index={index} 
                            onUpdate={(field, val) => updateSlide(slide.id, field, val)} 
                            onRemove={() => removeSlide(slide.id)} 
                        />
                    ))}
                </div>
                <SaveAction />
              </div>
            )}

            {activeTab === 'podcast' && (
              <div className="space-y-6 animate-fade-in">
                <SectionHeader title="Podcast y Transmisión" subtitle="Configura el video en vivo y la lista de episodios." />
                <div className="space-y-4 mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputGroup label="Título de la Sección">
                            <input type="text" value={formData.content.podcast.title || ''} onChange={(e) => setFormData(prev => ({...prev, content: {...prev.content, podcast: {...prev.content.podcast, title: e.target.value}}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg" />
                        </InputGroup>
                        <div className="flex items-end mb-4 pb-2">
                             <label className="flex items-center cursor-pointer bg-red-900/20 px-4 py-2.5 rounded-lg border border-red-900/50 hover:bg-red-900/30 transition-colors w-full">
                                <input type="checkbox" checked={!!formData.content.podcast.isLive} onChange={(e) => setFormData(prev => ({...prev, content: {...prev.content, podcast: {...prev.content.podcast, isLive: e.target.checked}}}))} className="h-5 w-5 accent-red-600 rounded bg-gray-800 border-gray-600" />
                                <span className="ml-3 font-bold text-red-400">Mostrar indicador "EN VIVO"</span>
                             </label>
                        </div>
                    </div>
                    <InputGroup label="Descripción">
                        <textarea rows={2} value={formData.content.podcast.description || ''} onChange={(e) => setFormData(prev => ({...prev, content: {...prev.content, podcast: {...prev.content.podcast, description: e.target.value}}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg" />
                    </InputGroup>
                    <div className="p-6 bg-gray-800 border border-gray-700 rounded-xl shadow-inner mb-6">
                        <h4 className="font-bold text-gray-200 text-sm mb-4 flex items-center border-b border-gray-700 pb-2"><Video size={18} className="mr-2 text-primary"/> Transmisión Principal</h4>
                        <MediaUploader label="URL del Video" value={formData.content.podcast.liveUrl || ''} onChange={(val) => setFormData(prev => ({...prev, content: {...prev.content, podcast: {...prev.content.podcast, liveUrl: val}}}))} type="video" />
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-700 pb-4 pt-8 mb-4">
                        <h3 className="text-lg font-bold text-white">Episodios</h3>
                        <button onClick={addEpisode} className="bg-secondary text-primary px-4 py-2 rounded-lg font-bold hover:bg-yellow-500 flex items-center text-sm shadow-md"> <Plus size={18} className="mr-1"/> Agregar Episodio </button>
                    </div>
                    <div className="space-y-4">
                        {formData.content.podcast.episodes.map((ep, idx) => (
                            <div key={ep.id} className="border border-gray-700 p-4 rounded-xl bg-gray-800 shadow-sm flex flex-col space-y-3 hover:bg-gray-750 transition-all relative">
                                <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-2">
                                    <span className="font-bold text-gray-500 text-xs uppercase tracking-wide">Episodio #{formData.content.podcast.episodes.length - idx}</span>
                                    <button onClick={() => removeEpisode(ep.id)} className="text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputGroup label="Título">
                                        <input type="text" value={ep.title || ''} onChange={e => updateEpisode(ep.id, 'title', e.target.value)} className="bg-gray-900 border border-gray-600 p-2 rounded-lg w-full text-sm text-white" />
                                    </InputGroup>
                                    <InputGroup label="Fecha">
                                        <input type="text" value={ep.date || ''} onChange={e => updateEpisode(ep.id, 'date', e.target.value)} className="bg-gray-900 border border-gray-600 p-2 rounded-lg w-full text-sm text-white" />
                                    </InputGroup>
                                </div>
                                <MediaUploader label="Video del Episodio" value={ep.videoUrl || ''} onChange={(val) => updateEpisode(ep.id, 'videoUrl', val)} type="video" />
                                <MediaUploader 
                                    label="Imagen Miniatura" 
                                    value={ep.image || ''} 
                                    onChange={(val) => updateEpisode(ep.id, 'image', val)} 
                                    type="image" 
                                />
                            </div>
                        ))}
                    </div>
                </div>
                <SaveAction />
              </div>
            )}

            {activeTab === 'program' && (
              <div className="space-y-6 animate-fade-in">
                <SectionHeader 
                    title="Gestión de Programación" 
                    subtitle="Administra los programas que se muestran en la sección de programación." 
                    action={
                        <button 
                            onClick={adminProgramTab === 'week' ? addProgram : addWeekendProgram} 
                            className="bg-primary text-on-primary px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center transition-colors font-bold shadow-lg shadow-primary/20"
                        >
                            <Plus size={20} className="mr-2" /> Agregar {adminProgramTab === 'week' ? 'Programa' : 'Fin de Semana'}
                        </button>
                    }
                />
                
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label="Título de la Sección">
                            <input type="text" value={formData.content.program.title || ''} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, program: {...prev.content.program, title: e.target.value}}}))} className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" />
                        </InputGroup>
                        <InputGroup label="Descripción General">
                            <input type="text" value={formData.content.program.description || ''} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, program: {...prev.content.program, description: e.target.value}}}))} className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" />
                        </InputGroup>
                    </div>

                    {/* Admin Programming Tabs */}
                    <div className="flex border-b border-gray-700">
                        <button 
                            onClick={() => setAdminProgramTab('week')}
                            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${adminProgramTab === 'week' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            Lunes a Viernes
                        </button>
                        <button 
                            onClick={() => setAdminProgramTab('weekend')}
                            className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${adminProgramTab === 'weekend' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            Fin de Semana
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(adminProgramTab === 'week' ? formData.content.program.programs : (formData.content.program.weekendPrograms || []))?.map((prog) => (
                            <div key={prog.id} className="bg-gray-900 p-6 rounded-xl border border-gray-700 relative group animate-fade-in">
                                <button 
                                    onClick={() => adminProgramTab === 'week' ? removeProgram(prog.id) : removeWeekendProgram(prog.id)} 
                                    className="absolute top-4 right-4 text-red-400 hover:text-red-300 p-2 hover:bg-red-900/30 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                                
                                <div className="space-y-4">
                                    <InputGroup label="Título del Programa">
                                        <input 
                                            type="text" 
                                            value={prog.title || ''} 
                                            onChange={e => adminProgramTab === 'week' ? updateProgram(prog.id, 'title', e.target.value) : updateWeekendProgram(prog.id, 'title', e.target.value)} 
                                            className="w-full bg-gray-800 border border-gray-700 text-white p-2 rounded focus:border-primary outline-none" 
                                        />
                                    </InputGroup>
                                    <InputGroup label="Horario">
                                        <input 
                                            type="text" 
                                            value={prog.schedule || ''} 
                                            onChange={e => adminProgramTab === 'week' ? updateProgram(prog.id, 'schedule', e.target.value) : updateWeekendProgram(prog.id, 'schedule', e.target.value)} 
                                            className="w-full bg-gray-800 border border-gray-700 text-white p-2 rounded focus:border-primary outline-none" 
                                            placeholder={adminProgramTab === 'week' ? "Ej. Lunes a Viernes - 8:00 AM" : "Ej. Sábados y Domingos - 10:00 AM"} 
                                        />
                                    </InputGroup>
                                    <InputGroup label="Reseña / Descripción">
                                        <textarea 
                                            rows={3} 
                                            value={prog.description || ''} 
                                            onChange={e => adminProgramTab === 'week' ? updateProgram(prog.id, 'description', e.target.value) : updateWeekendProgram(prog.id, 'description', e.target.value)} 
                                            className="w-full bg-gray-800 border border-gray-700 text-white p-2 rounded focus:border-primary outline-none" 
                                        />
                                    </InputGroup>
                                    <MediaUploader 
                                        label="Foto del Locutor" 
                                        value={prog.announcerImage || ''} 
                                        onChange={(val) => adminProgramTab === 'week' ? updateProgram(prog.id, 'announcerImage', val) : updateWeekendProgram(prog.id, 'announcerImage', val)} 
                                        type="image" 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <SaveAction />
              </div>
            )}

            {activeTab === 'clients' && (
              <div className="space-y-6 animate-fade-in">
                <SectionHeader title="Galería de Clientes" subtitle="Gestiona los banners de tus clientes, sus redes sociales y productos." />
                
                <div className="flex justify-end">
                    <button 
                        onClick={addClient}
                        className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-900 flex items-center shadow-lg transition-all"
                    >
                        <Plus size={18} className="mr-2" /> Agregar Cliente
                    </button>
                </div>

                <div className="space-y-8">
                    {(formData.content.clients || []).map((client) => (
                        <div key={client.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-xl">
                            <div className="bg-gray-700 px-6 py-3 flex items-center justify-between">
                                <h3 className="font-bold text-white flex items-center">
                                    <Users size={18} className="mr-2 text-secondary" /> {client.name || "Sin Nombre"}
                                </h3>
                                <button 
                                    onClick={() => removeClient(client.id)}
                                    className="text-red-400 hover:text-red-300 p-1 transition-colors"
                                    title="Eliminar Cliente"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            
                            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <InputGroup label="Nombre del Cliente">
                                        <input 
                                            type="text" 
                                            value={client.name || ''} 
                                            onChange={e => updateClient(client.id, 'name', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" 
                                        />
                                    </InputGroup>
                                    
                                    <MediaUploader 
                                        label="Banner del Cliente (Imagen Principal)" 
                                        value={client.bannerUrl} 
                                        onChange={val => updateClient(client.id, 'bannerUrl', val)} 
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <InputGroup label="WhatsApp (Número)">
                                            <input 
                                                type="text" 
                                                value={client.whatsapp || ''} 
                                                onChange={e => updateClient(client.id, 'whatsapp', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" 
                                                placeholder="Ej. +584140000000"
                                            />
                                        </InputGroup>
                                        <InputGroup label="Sitio Web">
                                            <input 
                                                type="text" 
                                                value={client.website || ''} 
                                                onChange={e => updateClient(client.id, 'website', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" 
                                                placeholder="https://..."
                                            />
                                        </InputGroup>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <InputGroup label="Facebook">
                                            <input 
                                                type="text" 
                                                value={client.facebook || ''} 
                                                onChange={e => updateClient(client.id, 'facebook', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg text-xs" 
                                            />
                                        </InputGroup>
                                        <InputGroup label="Instagram">
                                            <input 
                                                type="text" 
                                                value={client.instagram || ''} 
                                                onChange={e => updateClient(client.id, 'instagram', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg text-xs" 
                                            />
                                        </InputGroup>
                                        <InputGroup label="Twitter">
                                            <input 
                                                type="text" 
                                                value={client.twitter || ''} 
                                                onChange={e => updateClient(client.id, 'twitter', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg text-xs" 
                                            />
                                        </InputGroup>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <InputGroup label="Dirección Física">
                                        <textarea 
                                            value={client.address || ''} 
                                            onChange={e => updateClient(client.id, 'address', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg h-20" 
                                            placeholder="Calle, Ciudad, Referencia..."
                                        />
                                    </InputGroup>
                                    
                                    <InputGroup label="URL de Google Maps (Iframe src)">
                                        <input 
                                            type="text" 
                                            value={client.mapUrl || ''} 
                                            onChange={e => updateClient(client.id, 'mapUrl', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg text-xs" 
                                            placeholder="https://www.google.com/maps/embed?pb=..."
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1 italic">Pega solo el atributo 'src' del código de inserción de Google Maps.</p>
                                    </InputGroup>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-400 mb-2">Imágenes de Productos (Slider)</label>
                                        <div className="grid grid-cols-4 gap-2 mb-2">
                                            {client.productImages.map((img, idx) => (
                                                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-600 group">
                                                    <img src={img} className="w-full h-full object-cover" />
                                                    <button 
                                                        onClick={() => removeClientProductImage(client.id, idx)}
                                                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <MediaUploader 
                                            label="Agregar Imagen de Producto" 
                                            value="" 
                                            onChange={val => addClientProductImage(client.id, val)} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {(formData.content.clients || []).length === 0 && (
                        <div className="text-center py-20 bg-gray-800 rounded-xl border border-dashed border-gray-600">
                            <Users size={48} className="mx-auto text-gray-600 mb-4" />
                            <p className="text-gray-400">No hay clientes registrados aún.</p>
                        </div>
                    )}
                </div>
                
                <SaveAction />
              </div>
            )}

            {activeTab === 'gallery' && (
              <div className="space-y-6 animate-fade-in">
                 <SectionHeader title="Galería de Imágenes" subtitle="Organiza las fotos de eventos." />
                <div className="space-y-4 mb-8">
                     <div className="grid md:grid-cols-2 gap-4">
                        <InputGroup label="Título Galería">
                            <input type="text" value={formData.content.gallery.title} onChange={(e) => setFormData(prev => ({...prev, content: {...prev.content, gallery: {...prev.content.gallery, title: e.target.value}}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg" />
                        </InputGroup>
                        <InputGroup label="Descripción">
                             <input type="text" value={formData.content.gallery.description} onChange={(e) => setFormData(prev => ({...prev, content: {...prev.content, gallery: {...prev.content.gallery, description: e.target.value}}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg" />
                        </InputGroup>
                     </div>
                     <div className="flex justify-between items-center border-b border-gray-700 pb-4 pt-6 mb-4">
                        <h3 className="text-lg font-bold text-white">Imágenes ({formData.content.gallery.images.length})</h3>
                        <button onClick={addGalleryItem} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center text-sm shadow-md transition-transform active:scale-95"> <Plus size={18} className="mr-1"/> Agregar Imagen </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {formData.content.gallery.images.map((img) => (
                            <div key={img.id} className="border border-gray-700 p-4 rounded-xl bg-gray-800 shadow-sm hover:bg-gray-750 transition-all flex flex-col relative group">
                                <button onClick={() => removeGalleryItem(img.id)} className="absolute top-2 right-2 text-gray-500 hover:text-red-500 bg-gray-900 rounded-full p-1.5 shadow-sm border border-gray-700 z-10" title="Eliminar"> <Trash2 size={16} /> </button>
                                <div className="mb-4">
                                    <InputGroup label="Tipo de Contenido">
                                        <select 
                                            value={img.type || 'image'} 
                                            onChange={e => updateGalleryItem(img.id, 'type', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-600 text-white p-2 rounded text-xs"
                                        >
                                            <option value="image">Imagen / Foto</option>
                                            <option value="instagram">Instagram Post</option>
                                            <option value="tiktok">TikTok Video</option>
                                            <option value="facebook">Facebook Post</option>
                                            <option value="twitter">X (Twitter) Post</option>
                                        </select>
                                    </InputGroup>
                                    
                                    {(img.type === 'image' || !img.type) ? (
                                        <MediaUploader 
                                            label="Archivo de Imagen" 
                                            value={img.url} 
                                            onChange={(val) => updateGalleryItem(img.id, 'url', val)} 
                                            type="image" 
                                        />
                                    ) : (
                                        <InputGroup label="URL de la Publicación">
                                            <input 
                                                type="text" 
                                                value={img.url} 
                                                onChange={e => updateGalleryItem(img.id, 'url', e.target.value)} 
                                                className="w-full bg-gray-900 border border-gray-600 text-white p-2 rounded text-xs"
                                                placeholder={`https://www.${img.type}.com/...`}
                                            />
                                        </InputGroup>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <InputGroup label="Leyenda">
                                        <input type="text" value={img.caption || ''} onChange={e => updateGalleryItem(img.id, 'caption', e.target.value)} className="bg-gray-900 border border-gray-600 p-2 rounded w-full text-xs text-white placeholder-gray-500" />
                                    </InputGroup>
                                    <div className="flex items-center space-x-2 pt-1">
                                        <button onClick={() => updateGalleryItem(img.id, 'format', 'landscape')} className={`flex-1 py-1.5 rounded border flex items-center justify-center text-xs transition-colors ${img.format === 'landscape' ? 'bg-indigo-900/40 border-indigo-500 text-indigo-200 font-bold' : 'bg-gray-900 border-gray-600 text-gray-400 hover:bg-gray-700'}`}> <RectangleHorizontal size={14} className="mr-1.5"/> 16:9 </button>
                                        <button onClick={() => updateGalleryItem(img.id, 'format', 'portrait')} className={`flex-1 py-1.5 rounded border flex items-center justify-center text-xs transition-colors ${img.format === 'portrait' ? 'bg-indigo-900/40 border-indigo-500 text-indigo-200 font-bold' : 'bg-gray-900 border-gray-600 text-gray-400 hover:bg-gray-700'}`}> <RectangleVertical size={14} className="mr-1.5"/> 9:16 </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <SaveAction />
              </div>
            )}
            
            {activeTab === 'leads' && <LeadsView />}
            
            {activeTab === 'help' && (
              <div className="space-y-6 animate-fade-in">
                <SectionHeader title="Ayuda: Firebase y Persistencia" subtitle="Información importante sobre cómo se guardan tus datos." />
                
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
                    <div className="flex items-start space-x-4">
                        <div className="bg-yellow-500/20 p-3 rounded-lg text-yellow-500">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">¿Por qué no se guardan mis imágenes en Firebase?</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Actualmente, esta aplicación guarda la configuración en el <strong>almacenamiento local (LocalStorage)</strong> de tu navegador. 
                                Esto significa que los cambios que hagas solo se verán en el navegador donde los realizaste.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div className="bg-gray-900 p-5 rounded-xl border border-gray-700">
                            <h4 className="font-bold text-primary mb-3 flex items-center">
                                <ImageIcon size={18} className="mr-2" /> Límite de Espacio (5MB)
                            </h4>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                El navegador tiene un límite de 5MB para guardar datos. Las imágenes que subes se convierten a texto (Base64), lo cual ocupa mucho espacio. 
                                <br/><br/>
                                <strong>Solución:</strong> Usa imágenes comprimidas o enlaces externos (URLs) para evitar saturar el almacenamiento.
                            </p>
                        </div>
                        <div className="bg-gray-900 p-5 rounded-xl border border-gray-700">
                            <h4 className="font-bold text-secondary mb-3 flex items-center">
                                <Globe size={18} className="mr-2" /> Despliegue en Firebase
                            </h4>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Firebase Hosting es estático. Para que los cambios sean globales (que todos los vean), necesitarías integrar <strong>Firebase Firestore</strong>.
                                <br/><br/>
                                <strong>Recomendación:</strong> Usa la función de <strong>"Exportar Backup"</strong> en la pestaña Base de Datos para guardar tus cambios en un archivo y poder restaurarlos si cambias de navegador.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                        <p className="text-sm text-primary font-bold mb-2">Pasos para que tus cambios sean permanentes en Firebase:</p>
                        <ol className="text-xs text-gray-300 list-decimal list-inside space-y-2">
                            <li>Realiza todos tus cambios en el panel de administración localmente.</li>
                            <li>Ve a la pestaña <strong>Base de Datos</strong> y haz clic en <strong>Descargar Backup (JSON)</strong>.</li>
                            <li>Si deseas que el sitio web tenga estos datos por defecto al cargar, debes reemplazar el contenido del archivo <code className="bg-black px-1 rounded">constants.ts</code> con los datos de tu backup (requiere conocimientos técnicos).</li>
                        </ol>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'news' && (
              <div className="space-y-6 animate-fade-in">
                <SectionHeader 
                    title="Gestión de Noticias" 
                    subtitle="Administra las noticias y artículos que se muestran en el sitio." 
                    action={
                        <button onClick={addNewsArticle} className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-900 flex items-center text-sm shadow-md transition-all active:scale-95">
                            <Plus size={18} className="mr-1"/> Agregar Noticia
                        </button>
                    }
                />
                
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label="Título de la Sección">
                            <input type="text" value={formData.content.news?.title || ''} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, news: {...prev.content.news!, title: e.target.value}}}))} className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg focus:border-primary outline-none" />
                        </InputGroup>
                        <InputGroup label="Descripción">
                            <input type="text" value={formData.content.news?.description || ''} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, news: {...prev.content.news!, description: e.target.value}}}))} className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg focus:border-primary outline-none" />
                        </InputGroup>
                    </div>
                </div>

                <div className="space-y-6">
                    {(formData.content.news?.articles || []).map((article, idx) => (
                        <div key={article.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg animate-fade-in">
                            <div className="bg-gray-700 px-6 py-3 flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded mr-3">Noticia #{formData.content.news!.articles.length - idx}</span>
                                    <h3 className="font-bold text-white truncate max-w-xs">{article.title || "Sin título"}</h3>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <label className="relative inline-flex items-center cursor-pointer mr-2" title={article.isPublished ? 'Publicado' : 'Borrador'}>
                                        <input 
                                            type="checkbox" 
                                            checked={!!article.isPublished} 
                                            onChange={(e) => updateNewsArticle(article.id, 'isPublished', e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                    </label>
                                    <button 
                                        onClick={() => removeNewsArticle(article.id)}
                                        className="text-gray-400 hover:text-red-500 p-1.5 transition-colors bg-gray-800 rounded-lg"
                                        title="Eliminar Noticia"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <InputGroup label="Título de la Noticia">
                                        <input 
                                            type="text" 
                                            value={article.title || ''} 
                                            onChange={e => updateNewsArticle(article.id, 'title', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 text-white p-2.5 rounded-lg focus:border-primary outline-none" 
                                        />
                                    </InputGroup>

                                    <div className="grid grid-cols-2 gap-4">
                                        <InputGroup label="Categoría">
                                            <input 
                                                type="text" 
                                                value={article.category || ''} 
                                                onChange={e => updateNewsArticle(article.id, 'category', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 text-white p-2.5 rounded-lg focus:border-primary outline-none" 
                                                placeholder="Ej. Nacional, Deportes..."
                                            />
                                        </InputGroup>
                                        <InputGroup label="Fecha">
                                            <input 
                                                type="text" 
                                                value={article.date || ''} 
                                                onChange={e => updateNewsArticle(article.id, 'date', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 text-white p-2.5 rounded-lg focus:border-primary outline-none" 
                                            />
                                        </InputGroup>
                                    </div>

                                    <InputGroup label="Autor">
                                        <input 
                                            type="text" 
                                            value={article.author || ''} 
                                            onChange={e => updateNewsArticle(article.id, 'author', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 text-white p-2.5 rounded-lg focus:border-primary outline-none" 
                                        />
                                    </InputGroup>

                                    <MediaUploader 
                                        label="Imagen de la Noticia" 
                                        value={article.image || ''} 
                                        onChange={val => updateNewsArticle(article.id, 'image', val)} 
                                    />
                                </div>

                                <div className="space-y-4">
                                    <InputGroup label="Resumen (Breve)">
                                        <textarea 
                                            value={article.summary || ''} 
                                            onChange={e => updateNewsArticle(article.id, 'summary', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 text-white p-2.5 rounded-lg h-24 resize-none" 
                                            placeholder="Un breve resumen que aparece en la lista..."
                                        />
                                    </InputGroup>

                                    <InputGroup label="Contenido Completo">
                                        <textarea 
                                            value={article.content || ''} 
                                            onChange={e => updateNewsArticle(article.id, 'content', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 text-white p-2.5 rounded-lg h-56" 
                                            placeholder="Escribe toda la noticia aquí..."
                                        />
                                    </InputGroup>
                                </div>
                            </div>
                        </div>
                    ))}

                    {(formData.content.news?.articles || []).length === 0 && (
                        <div className="text-center py-20 bg-gray-800 rounded-xl border border-dashed border-gray-700">
                            <Newspaper size={48} className="mx-auto text-gray-700 mb-4 opacity-50" />
                            <p className="text-gray-400">No hay noticias registradas. ¡Crea la primera!</p>
                            <button onClick={addNewsArticle} className="mt-4 text-primary hover:underline font-bold">Agregar Noticia</button>
                        </div>
                    )}
                </div>

                <div className="mt-12">
                    <SectionHeader 
                        title="Fuentes RSS Automáticas" 
                        subtitle="Agrega URLs de RSS (XML) para mostrar noticias automáticamente de otros portales en vivo." 
                        action={
                            <button onClick={addRssFeed} className="bg-secondary text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 flex items-center text-sm shadow-md transition-all active:scale-95">
                                <Plus size={18} className="mr-1"/> Agregar RSS
                            </button>
                        }
                    />
                    
                    <div className="space-y-4">
                        {(formData.content.news?.rssFeeds || []).map((feed, idx) => (
                            <div key={feed.id} className="bg-gray-800 p-6 rounded-xl border border-gray-700 relative flex items-center gap-6">
                                <div className="flex-1 space-y-4">
                                    <div className="flex gap-4">
                                        <div className="w-1/3">
                                            <InputGroup label="Nombre del Diario / Portal">
                                                <input 
                                                    type="text" 
                                                    value={feed.name || ''} 
                                                    onChange={e => updateRssFeed(feed.id, 'name', e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-700 text-white p-2.5 rounded-lg focus:border-secondary outline-none" 
                                                    placeholder="Ej. Diario Libre"
                                                />
                                            </InputGroup>
                                        </div>
                                        <div className="w-2/3">
                                            <InputGroup label="Enlace del feed RSS (.xml)">
                                                <input 
                                                    type="text" 
                                                    value={feed.url || ''} 
                                                    onChange={e => updateRssFeed(feed.id, 'url', e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-700 text-white p-2.5 rounded-lg focus:border-secondary outline-none font-mono text-sm" 
                                                    placeholder="https://www.dominio.com/rss/portada.xml"
                                                />
                                            </InputGroup>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => removeRssFeed(feed.id)} 
                                    className="text-gray-500 hover:text-red-500 transition-colors p-3 bg-gray-900 rounded-xl"
                                    title="Eliminar RSS"
                                >
                                    <Trash2 size={24} />
                                </button>
                            </div>
                        ))}
                        
                        {(formData.content.news?.rssFeeds || []).length === 0 && (
                            <div className="text-center py-8 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
                                <p className="text-gray-400 text-sm">No hay fuentes RSS configuradas.</p>
                            </div>
                        )}
                    </div>
                </div>

                <SaveAction />
              </div>
            )}

            {activeTab === 'topvideos' && (
              <div className="space-y-6 animate-fade-in">
                  <SectionHeader title="Los 5 Latigazos de la Semana" subtitle="Añade los estrenos y videos más sonados de YouTube." />
                  
                  <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-white">Habilitar Sección</h3>
                            <p className="text-sm text-gray-400">Mostrar o esconder esta sección del sitio de forma global.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={formData.content.topVideos?.enabled ?? true} 
                                onChange={(e) => setFormData(prev => ({...prev, content: {...prev.content, topVideos: {...prev.content.topVideos!, enabled: e.target.checked}}}))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputGroup label="Título de la Sección">
                          <input type="text" value={formData.content.topVideos?.title || ''} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, topVideos: {...prev.content.topVideos!, title: e.target.value}}}))} className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" />
                      </InputGroup>
                      <InputGroup label="Descripción">
                          <input type="text" value={formData.content.topVideos?.description || ''} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, topVideos: {...prev.content.topVideos!, description: e.target.value}}}))} className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" />
                      </InputGroup>
                  </div>

                  <div className="mt-8 border-t border-gray-700 pt-8">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-bold text-white">Videos de YouTube</h3>
                          {(formData.content.topVideos?.videos || []).length < 5 && (
                              <button onClick={addTopVideo} className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-900 flex items-center text-sm shadow-md transition-all active:scale-95">
                                  <Plus size={18} className="mr-1"/> Añadir Video {((formData.content.topVideos?.videos || []).length)}/5
                              </button>
                          )}
                      </div>

                      <div className="space-y-4">
                          {(formData.content.topVideos?.videos || []).map((video, idx) => (
                              <div key={video.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col md:flex-row items-center gap-4">
                                  <div className="w-12 h-12 flex-shrink-0 bg-gray-900 rounded-lg flex items-center justify-center font-bold text-gray-500 text-xl border border-gray-700">
                                      {idx + 1}
                                  </div>
                                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                      <InputGroup label="Artista / Título">
                                          <input 
                                              type="text" 
                                              value={video.title || ''} 
                                              onChange={e => updateTopVideo(video.id, 'title', e.target.value)}
                                              className="w-full bg-gray-900 border border-gray-700 text-white p-2.5 rounded-lg focus:border-primary outline-none" 
                                              placeholder="Ej: Reynaldo Armas - El Indio"
                                          />
                                      </InputGroup>
                                      <InputGroup label="URL de YouTube">
                                          <div className="flex relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Youtube size={16} className="text-gray-500" />
                                            </div>
                                            <input 
                                                type="text" 
                                                value={video.url || ''} 
                                                onChange={e => updateTopVideo(video.id, 'url', e.target.value)}
                                                className="w-full pl-10 bg-gray-900 border border-gray-700 text-white p-2.5 rounded-lg focus:border-primary outline-none" 
                                                placeholder="https://www.youtube.com/watch?v=..."
                                            />
                                          </div>
                                      </InputGroup>
                                  </div>
                                  <button onClick={() => removeTopVideo(video.id)} className="p-3 bg-gray-900 text-gray-400 hover:text-red-500 hover:bg-red-900/20 rounded-xl transition-colors">
                                      <Trash2 size={20} />
                                  </button>
                              </div>
                          ))}
                          
                          {(formData.content.topVideos?.videos || []).length === 0 && (
                              <div className="text-center py-10 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
                                  <Youtube size={32} className="mx-auto text-gray-600 mb-3" />
                                  <p className="text-gray-400">No hay videos añadidos.</p>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* History of Weekly Top Videos */}
                  <div className="mt-12 border-t border-gray-700 pt-8">
                      <div className="flex justify-between items-center mb-6">
                          <div>
                              <h3 className="text-xl font-bold text-white">Historial Semanal</h3>
                              <p className="text-sm text-gray-400">Guarda las listas anteriores de los 5 latigazos.</p>
                          </div>
                          <button onClick={addWeeklyList} className="bg-secondary text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 flex items-center text-sm shadow-md transition-all active:scale-95">
                              <Plus size={18} className="mr-1"/> Añadir Semana Histórica
                          </button>
                      </div>

                      <div className="space-y-6">
                          {(formData.content.topVideos?.history || []).map((weekList) => (
                              <div key={weekList.id} className="bg-gray-800 p-6 rounded-xl border border-gray-700 relative">
                                  <button onClick={() => removeWeeklyList(weekList.id)} className="absolute top-4 right-4 text-red-400 hover:text-red-300 p-2 hover:bg-red-900/30 rounded-lg transition-colors">
                                      <Trash2 size={18} />
                                  </button>
                                  
                                  <InputGroup label="Semana (e.g. Semana del 10 al 16 de Mayo)">
                                      <input 
                                          type="text" 
                                          value={weekList.date || ''} 
                                          onChange={e => updateWeeklyList(weekList.id, 'date', e.target.value)}
                                          className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg mb-4" 
                                      />
                                  </InputGroup>

                                  <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                                      <h4 className="text-sm font-bold text-gray-300">Videos de la semana</h4>
                                      {(weekList.videos || []).length < 5 && (
                                          <button onClick={() => addVideoToWeeklyList(weekList.id)} className="text-xs text-primary font-bold hover:underline">
                                              + Añadir Video {((weekList.videos || []).length)}/5
                                          </button>
                                      )}
                                  </div>

                                  <div className="space-y-3">
                                      {(weekList.videos || []).map((video, idx) => (
                                          <div key={video.id} className="flex flex-col md:flex-row items-center gap-3 bg-gray-900 p-3 rounded-lg border border-gray-700">
                                              <span className="font-bold text-gray-500 w-6 text-center">{idx + 1}</span>
                                              <input 
                                                  type="text" 
                                                  value={video.title || ''} 
                                                  onChange={e => updateVideoInWeeklyList(weekList.id, video.id, 'title', e.target.value)}
                                                  className="flex-1 bg-gray-800 border border-gray-700 text-white p-2 rounded focus:border-primary outline-none text-sm" 
                                                  placeholder="Artista - Título"
                                              />
                                              <input 
                                                  type="text" 
                                                  value={video.url || ''} 
                                                  onChange={e => updateVideoInWeeklyList(weekList.id, video.id, 'url', e.target.value)}
                                                  className="flex-1 bg-gray-800 border border-gray-700 text-white p-2 rounded focus:border-primary outline-none text-sm" 
                                                  placeholder="URL de YouTube"
                                              />
                                              <button onClick={() => removeVideoFromWeeklyList(weekList.id, video.id)} className="text-red-400 hover:text-red-300 p-2">
                                                  <Trash2 size={16} />
                                              </button>
                                          </div>
                                      ))}
                                      {(weekList.videos || []).length === 0 && (
                                          <p className="text-xs text-gray-500 italic">No hay videos en esta semana.</p>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Monthly Summaries */}
                  <div className="mt-12 border-t border-gray-700 pt-8">
                      <div className="flex justify-between items-center mb-6">
                          <div>
                              <h3 className="text-xl font-bold text-white">Resumen Mensual de Posiciones</h3>
                              <p className="text-sm text-gray-400">Guarda los rankings consolidados por mes.</p>
                          </div>
                          <button onClick={addMonthlySummary} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center text-sm shadow-md transition-all active:scale-95">
                              <Plus size={18} className="mr-1"/> Añadir Resumen Mensual
                          </button>
                      </div>

                      <div className="space-y-6">
                          {(formData.content.topVideos?.monthlySummaries || []).map((summary) => (
                              <div key={summary.id} className="bg-gray-800 p-6 rounded-xl border border-gray-700 relative">
                                  <button onClick={() => removeMonthlySummary(summary.id)} className="absolute top-4 right-4 text-red-400 hover:text-red-300 p-2 hover:bg-red-900/30 rounded-lg transition-colors">
                                      <Trash2 size={18} />
                                  </button>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                      <InputGroup label="Mes (e.g. Mayo 2026)">
                                          <input 
                                              type="text" 
                                              value={summary.month || ''} 
                                              onChange={e => updateMonthlySummary(summary.id, 'month', e.target.value)}
                                              className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" 
                                          />
                                      </InputGroup>
                                  </div>
                                  <InputGroup label="Texto Resumen o Análisis">
                                      <textarea 
                                          rows={3}
                                          value={summary.summaryText || ''} 
                                          onChange={e => updateMonthlySummary(summary.id, 'summaryText', e.target.value)}
                                          className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg mb-4" 
                                          placeholder="Un comentario sobre las posiciones de este mes..."
                                      />
                                  </InputGroup>

                                  <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                                      <h4 className="text-sm font-bold text-gray-300">Posiciones del Mes</h4>
                                      <button onClick={() => addVideoToMonthlySummary(summary.id)} className="text-xs text-primary font-bold hover:underline">
                                          + Añadir Posición
                                      </button>
                                  </div>

                                  <div className="space-y-3">
                                      {(summary.videos || []).map((video, idx) => (
                                          <div key={video.id} className="flex flex-col md:flex-row items-center gap-3 bg-gray-900 p-3 rounded-lg border border-gray-700">
                                              <span className="font-bold text-gray-500 w-6 text-center">{idx + 1}</span>
                                              <input 
                                                  type="text" 
                                                  value={video.title || ''} 
                                                  onChange={e => updateVideoInMonthlySummary(summary.id, video.id, 'title', e.target.value)}
                                                  className="flex-1 bg-gray-800 border border-gray-700 text-white p-2 rounded focus:border-primary outline-none text-sm" 
                                                  placeholder="Artista - Título"
                                              />
                                              <input 
                                                  type="text" 
                                                  value={video.url || ''} 
                                                  onChange={e => updateVideoInMonthlySummary(summary.id, video.id, 'url', e.target.value)}
                                                  className="flex-1 bg-gray-800 border border-gray-700 text-white p-2 rounded focus:border-primary outline-none text-sm" 
                                                  placeholder="URL de YouTube (Opcional)"
                                              />
                                              <button onClick={() => removeVideoFromMonthlySummary(summary.id, video.id)} className="text-red-400 hover:text-red-300 p-2">
                                                  <Trash2 size={16} />
                                              </button>
                                          </div>
                                      ))}
                                      {(summary.videos || []).length === 0 && (
                                          <p className="text-xs text-gray-500 italic">No hay videos en este resumen.</p>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  <SaveAction />
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="space-y-6 animate-fade-in">
                <SectionHeader title="Configuración de Chat" subtitle="Convierte la sección de interacción en un chat estilo WhatsApp." />
                
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white">Estado del Chat</h3>
                            <p className="text-sm text-gray-400">Habilita o deshabilita el chat en la vista pública.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={formData.content.chat.enabled} 
                                onChange={(e) => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, enabled: e.target.checked}}}))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputGroup label="Título de la Sección">
                            <input type="text" value={formData.content.chat.title || ''} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, title: e.target.value}}}))} className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" />
                        </InputGroup>
                        <InputGroup label="Nombre del Administrador">
                            <input type="text" value={formData.content.chat.adminName || ''} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, adminName: e.target.value}}}))} className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" />
                        </InputGroup>
                        <InputGroup label="Número de Celular (WhatsApp)">
                            <input type="text" value={formData.content.chat.phoneNumber || ''} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, phoneNumber: e.target.value}}}))} className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" placeholder="Ej. +50760000000" />
                        </InputGroup>
                        <div className="flex items-center space-x-3 bg-gray-900 p-3 rounded-lg border border-gray-700">
                            <input 
                                type="checkbox" 
                                id="requirePhone" 
                                checked={formData.content.chat.requirePhone} 
                                onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, requirePhone: e.target.checked}}}))} 
                                className="h-5 w-5 accent-primary rounded bg-gray-800 border-gray-600" 
                            />
                            <label htmlFor="requirePhone" className="text-sm font-bold text-gray-300">Solicitar Celular al entrar al Chat (Base de Datos)</label>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <InputGroup label="Fondo del Chat">
                            <div className="flex space-x-2">
                                <input type="color" value={formData.content.chat.containerBg || '#030712'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, containerBg: e.target.value, messagesBg: e.target.value}}}))} className="h-10 w-12 rounded cursor-pointer border-none bg-transparent" />
                                <input type="text" value={formData.content.chat.containerBg || '#030712'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, containerBg: e.target.value, messagesBg: e.target.value}}}))} className="flex-1 bg-gray-900 border border-gray-600 text-white p-2 rounded-lg text-xs" />
                            </div>
                        </InputGroup>
                        <InputGroup label="Fondo de Cabecera/Input">
                            <div className="flex space-x-2">
                                <input type="color" value={formData.content.chat.inputBg || '#111827'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, inputBg: e.target.value}}}))} className="h-10 w-12 rounded cursor-pointer border-none bg-transparent" />
                                <input type="text" value={formData.content.chat.inputBg || '#111827'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, inputBg: e.target.value}}}))} className="flex-1 bg-gray-900 border border-gray-600 text-white p-2 rounded-lg text-xs" />
                            </div>
                        </InputGroup>
                        <InputGroup label="Color de Texto General">
                            <div className="flex space-x-2">
                                <input type="color" value={formData.content.chat.textColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, textColor: e.target.value}}}))} className="h-10 w-12 rounded cursor-pointer border-none bg-transparent" />
                                <input type="text" value={formData.content.chat.textColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, textColor: e.target.value}}}))} className="flex-1 bg-gray-900 border border-gray-600 text-white p-2 rounded-lg text-xs" />
                            </div>
                        </InputGroup>
                        <div className="flex flex-col justify-end pb-2">
                            <div className="flex space-x-2">
                                <button 
                                    onClick={() => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, containerBg: '#ffffff', messagesBg: '#ffffff', inputBg: '#f3f4f6', textColor: '#1f2937'}}}))}
                                    className="flex-1 bg-white text-gray-900 text-[10px] font-bold py-2 rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                                >
                                    Tema Claro
                                </button>
                                <button 
                                    onClick={() => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, containerBg: '#030712', messagesBg: '#030712', inputBg: '#111827', textColor: '#ffffff'}}}))}
                                    className="flex-1 bg-gray-950 text-white text-[10px] font-bold py-2 rounded border border-gray-700 hover:bg-gray-900 transition-colors"
                                >
                                    Tema Oscuro
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6">
                        <InputGroup label="Descripción / Instrucciones">
                            <textarea rows={2} value={formData.content.chat.description || ''} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, description: e.target.value}}}))} className="w-full bg-gray-900 border border-gray-600 text-white p-2.5 rounded-lg" />
                        </InputGroup>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Permisos</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-white flex items-center"><Mic size={16} className="mr-2 text-primary"/> Notas de Voz</span>
                                <input type="checkbox" checked={formData.content.chat.allowVoiceNotes} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, allowVoiceNotes: e.target.checked}}}))} className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-primary focus:ring-primary" />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-white flex items-center"><Paperclip size={16} className="mr-2 text-primary"/> Archivos</span>
                                <input type="checkbox" checked={formData.content.chat.allowFiles} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, allowFiles: e.target.checked}}}))} className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-primary focus:ring-primary" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 col-span-2">
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Colores del Chat</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InputGroup label="Color Burbuja Usuario">
                                <div className="flex space-x-2">
                                    <input type="color" value={formData.content.chat.backgroundColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, backgroundColor: e.target.value}}}))} className="h-10 w-12 rounded cursor-pointer border border-gray-600 bg-transparent" />
                                    <input type="text" value={formData.content.chat.backgroundColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, backgroundColor: e.target.value}}}))} className="flex-1 bg-gray-900 border border-gray-600 text-xs text-white p-2 rounded uppercase" />
                                </div>
                            </InputGroup>
                            <InputGroup label="Color Burbuja Admin">
                                <div className="flex space-x-2">
                                    <input type="color" value={formData.content.chat.primaryColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, primaryColor: e.target.value}}}))} className="h-10 w-12 rounded cursor-pointer border border-gray-600 bg-transparent" />
                                    <input type="text" value={formData.content.chat.primaryColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, primaryColor: e.target.value}}}))} className="flex-1 bg-gray-900 border border-gray-600 text-xs text-white p-2 rounded uppercase" />
                                </div>
                            </InputGroup>
                            <InputGroup label="Color de Acento">
                                <div className="flex space-x-2">
                                    <input type="color" value={formData.content.chat.secondaryColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, secondaryColor: e.target.value}}}))} className="h-10 w-12 rounded cursor-pointer border border-gray-600 bg-transparent" />
                                    <input type="text" value={formData.content.chat.secondaryColor || '#ffffff'} onChange={e => setFormData(prev => ({...prev, content: {...prev.content, chat: {...prev.content.chat, secondaryColor: e.target.value}}}))} className="flex-1 bg-gray-900 border border-gray-600 text-xs text-white p-2 rounded uppercase" />
                                </div>
                            </InputGroup>
                        </div>
                    </div>
                </div>
                <SaveAction />
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-6 animate-fade-in">
                <SectionHeader title="General / Footer" subtitle="Configura la información del pie de página." />
                <h3 className="text-md font-bold text-gray-300 uppercase tracking-wide border-b border-gray-700 pb-2 mb-4">Stream y Contacto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputGroup label="URL del Streaming en Vivo (Principal)">
                    <input type="text" value={formData.general.streamUrl || ''} onChange={e => setFormData(prev => ({...prev, general: {...prev.general, streamUrl: e.target.value}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg" />
                    </InputGroup>
                    <div className="md:col-span-2">
                        <AutoDJManager 
                            tracks={formData.general.autoDJTracks || []}
                            mode={formData.general.autoDJMode || 'alphabetical'}
                            onChange={(tracks, mode) => setFormData(p => ({
                                ...p, 
                                general: {
                                    ...p.general, 
                                    autoDJTracks: tracks,
                                    autoDJMode: mode
                                }
                            }))}
                        />
                    </div>
                    <InputGroup label="Email de Contacto">
                    <input type="email" value={formData.general.contactEmail || ''} onChange={e => setFormData(prev => ({...prev, general: {...prev.general, contactEmail: e.target.value}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg" />
                    </InputGroup>
                    <InputGroup label="Teléfono">
                    <input type="text" value={formData.general.contactPhone || ''} onChange={e => setFormData(prev => ({...prev, general: {...prev.general, contactPhone: e.target.value}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg" />
                    </InputGroup>
                    <InputGroup label="Ciudad">
                    <input type="text" value={formData.general.city || ''} onChange={e => setFormData(prev => ({...prev, general: {...prev.general, city: e.target.value}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg" />
                    </InputGroup>
                    <InputGroup label="País">
                    <input type="text" value={formData.general.country || ''} onChange={e => setFormData(prev => ({...prev, general: {...prev.general, country: e.target.value}}))} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg" />
                    </InputGroup>
                </div>
                <h3 className="text-md font-bold text-gray-300 uppercase tracking-wide border-b border-gray-700 pb-2 mb-4 mt-8">Redes Sociales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {Object.entries(formData.social).map(([key, val]) => (
                        <InputGroup key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
                            <input type="text" value={val || ''} onChange={e => setFormData(prev => {
                                const newSocial = { ...prev.social, [key]: e.target.value };
                                return { ...prev, social: newSocial as any };
                            })} className="w-full bg-gray-800 border border-gray-600 text-white p-2.5 rounded-lg" />
                        </InputGroup>
                     ))}
                </div>
                <SaveAction />
              </div>
            )}

            {activeTab === 'auth' && <AdminAuthManager />}
            
        </div>
      </main>
    </div>
  );
};