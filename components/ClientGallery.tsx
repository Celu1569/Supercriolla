import React, { useState } from 'react';
import { Client } from '../types';
import { Facebook, Instagram, Globe, MapPin, MessageCircle, X, ChevronLeft, ChevronRight, Phone, Plus, Users } from 'lucide-react';
import { TikTok } from './TikTokIcon';

interface ClientGalleryProps {
  clients: Client[];
  primaryColor: string;
  secondaryColor: string;
}

export const ClientGallery: React.FC<ClientGalleryProps> = ({ clients, primaryColor, secondaryColor }) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [currentProductImage, setCurrentProductImage] = useState(0);

  if (!clients || clients.length === 0) return null;

  const nextProduct = (images: string[]) => {
    setCurrentProductImage((prev) => (prev + 1) % images.length);
  };

  const prevProduct = (images: string[]) => {
    setCurrentProductImage((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  return (
    <div className="w-full">
      {/* Uniform Square Grid of Clients */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
        {clients.map((client) => {
          return (
            <div 
              key={client.id} 
              className="group relative bg-surface-alt rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-700 cursor-pointer border border-white/5 aspect-square flex flex-col"
              onClick={() => {
                  setSelectedClient(client);
                  setCurrentProductImage(0);
              }}
            >
              <div className="absolute inset-0 w-full h-full">
                <img 
                  src={client.bannerUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1000&auto=format&fit=crop'} 
                  alt={client.name} 
                  className="w-full h-full object-cover transform scale-100 group-hover:scale-110 transition-transform duration-1000 ease-out"
                  referrerPolicy="no-referrer"
                />
              </div>
              
              {/* Dynamic Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-70 group-hover:opacity-90 transition-opacity duration-700" />
              
              {/* Glassmorphism Card Content */}
              <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7">
                <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 ease-out">
                    <h3 className="text-xl sm:text-2xl font-heading font-bold text-white mb-1 group-hover:text-secondary transition-colors drop-shadow-lg">
                        {client.name}
                    </h3>
                    <div className="flex items-center text-white/60 text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                        <MapPin size={14} className="mr-1 text-secondary" />
                        <span className="truncate">{client.address || 'Ver detalles'}</span>
                    </div>
                </div>
                
                {/* Interactive indicator - Floating Pill */}
                <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full flex items-center text-[10px] font-bold text-white uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-500 -translate-x-4 group-hover:translate-x-0">
                    <Plus size={12} className="mr-1 text-secondary" /> Info
                </div>
              </div>

              {/* Decorative corner accent - Glass Circle */}
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-secondary/30 backdrop-blur-xl border border-white/20 rounded-full flex items-end justify-start p-5 opacity-0 group-hover:opacity-100 transition-all duration-700 scale-50 group-hover:scale-100">
                <Users size={20} className="text-white" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-10">
          <div 
            className="absolute inset-0 bg-black/95 backdrop-blur-md animate-fade-in" 
            onClick={() => setSelectedClient(null)} 
          />
          
          <div className="relative bg-surface w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl flex flex-col lg:flex-row border border-white/10 animate-scale-in overflow-hidden">
            <button 
                onClick={() => setSelectedClient(null)}
                className="absolute top-6 right-6 z-20 bg-black/50 hover:bg-red-500 text-white p-3 rounded-full transition-all backdrop-blur-md border border-white/10"
            >
                <X size={24} />
            </button>

            {/* Left Side: Info & Products */}
            <div className="w-full lg:w-1/2 p-10 lg:p-16 space-y-10 overflow-y-auto">
                <div className="space-y-4">
                    <div className="inline-block px-4 py-1 rounded-full bg-secondary/20 text-secondary text-xs font-bold uppercase tracking-widest border border-secondary/30">
                        Aliado Comercial
                    </div>
                    <h2 className="text-4xl lg:text-5xl font-heading font-bold text-heading leading-tight">{selectedClient.name}</h2>
                    <p className="text-on-surface-muted flex items-start text-lg">
                        <MapPin size={22} className="mr-3 mt-1 text-secondary flex-shrink-0" />
                        {selectedClient.address || 'Dirección no especificada'}
                    </p>
                </div>

                {/* Product Slider - Enhanced */}
                {selectedClient.productImages && selectedClient.productImages.length > 0 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-secondary flex items-center">
                                <span className="w-8 h-[1px] bg-secondary mr-3"></span>
                                Galería de Productos
                            </h4>
                            <span className="text-xs text-on-surface-muted font-mono">
                                {currentProductImage + 1} / {selectedClient.productImages.length}
                            </span>
                        </div>
                        
                        <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden bg-black group/slider shadow-2xl border border-white/5">
                            <img 
                                key={currentProductImage}
                                src={selectedClient.productImages[currentProductImage]} 
                                className="w-full h-full object-cover animate-fade-in"
                                referrerPolicy="no-referrer"
                            />
                            
                            {selectedClient.productImages.length > 1 && (
                                <>
                                    <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover/slider:opacity-100 transition-opacity duration-300">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); prevProduct(selectedClient.productImages); }}
                                            className="bg-black/60 hover:bg-secondary hover:text-primary text-white p-4 rounded-full transition-all backdrop-blur-md"
                                        >
                                            <ChevronLeft size={24} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); nextProduct(selectedClient.productImages); }}
                                            className="bg-black/60 hover:bg-secondary hover:text-primary text-white p-4 rounded-full transition-all backdrop-blur-md"
                                        >
                                            <ChevronRight size={24} />
                                        </button>
                                    </div>
                                    
                                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
                                        {selectedClient.productImages.map((_, idx) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => setCurrentProductImage(idx)}
                                                className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentProductImage ? 'bg-secondary w-8' : 'bg-white/30 w-2 hover:bg-white/60'}`} 
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Contact & Social - Modern Pills */}
                <div className="space-y-8 pt-6 border-t border-white/5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedClient.whatsapp && (
                            <a 
                                href={`https://wa.me/${selectedClient.whatsapp.replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="group relative overflow-hidden bg-[#25D366] text-white py-4 px-8 rounded-2xl font-bold flex items-center justify-center transition-all shadow-xl hover:shadow-green-500/30 hover:-translate-y-1"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                <MessageCircle size={22} className="mr-3 relative z-10" /> 
                                <span className="relative z-10">WhatsApp</span>
                            </a>
                        )}
                        {selectedClient.website && (
                            <a 
                                href={selectedClient.website} 
                                target="_blank" 
                                rel="noreferrer"
                                className="group relative overflow-hidden bg-primary text-white py-4 px-8 rounded-2xl font-bold flex items-center justify-center transition-all shadow-xl hover:shadow-primary/30 hover:-translate-y-1"
                            >
                                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                <Globe size={22} className="mr-3 relative z-10" /> 
                                <span className="relative z-10">Sitio Web</span>
                            </a>
                        )}
                    </div>

                    <div className="flex items-center gap-8">
                        <span className="text-xs font-bold text-on-surface-muted uppercase tracking-[0.2em]">Siguenos</span>
                        <div className="flex gap-5">
                            {selectedClient.instagram && (
                                <a href={selectedClient.instagram} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-full bg-surface-alt border border-white/10 flex items-center justify-center text-on-surface-muted hover:text-secondary hover:border-secondary transition-all hover:scale-110">
                                    <Instagram size={20} />
                                </a>
                            )}
                            {selectedClient.tiktok && (
                                <a href={selectedClient.tiktok} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-full bg-surface-alt border border-white/10 flex items-center justify-center text-on-surface-muted hover:text-secondary hover:border-secondary transition-all hover:scale-110">
                                    <TikTok size={20} />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Map - Immersive */}
            <div className="w-full lg:w-1/2 h-[400px] lg:h-auto bg-gray-900 relative group/map">
                {selectedClient.mapUrl ? (
                    <>
                        <iframe 
                            src={selectedClient.mapUrl} 
                            className="w-full h-full border-0 grayscale invert opacity-70 group-hover/map:opacity-100 transition-all duration-1000" 
                            allowFullScreen 
                            loading="lazy" 
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-surface via-transparent to-transparent hidden lg:block" />
                        <div className="absolute bottom-8 left-8 right-8 bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center justify-between opacity-0 group-hover/map:opacity-100 transition-opacity duration-500">
                            <div className="flex items-center">
                                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary mr-3">
                                    <MapPin size={20} />
                                </div>
                                <span className="text-white text-sm font-medium">¿Cómo llegar?</span>
                            </div>
                            <a 
                                href={selectedClient.mapUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-secondary transition-colors pointer-events-auto"
                            >
                                Abrir en Maps
                            </a>
                        </div>
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-surface-alt">
                        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                            <MapPin size={48} className="opacity-20" />
                        </div>
                        <p className="text-lg font-heading font-medium opacity-40">Mapa no disponible</p>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
