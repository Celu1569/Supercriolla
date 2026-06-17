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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-black/95 backdrop-blur-md animate-fade-in" 
            onClick={() => setSelectedClient(null)} 
          />
          
          <div className="relative bg-surface w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col md:flex-row border border-white/10 animate-scale-in overflow-hidden">
            <button 
                onClick={() => setSelectedClient(null)}
                className="absolute top-4 right-4 z-20 bg-black/50 hover:bg-red-500 text-white p-2 rounded-full transition-all backdrop-blur-md border border-white/10"
            >
                <X size={20} />
            </button>

            {/* Left Side: Info & Actions */}
            <div className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center text-left">
                
                <div className="space-y-4 mb-8">
                    <div className="inline-block px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-bold uppercase tracking-widest border border-secondary/20">
                        Aliado Comercial
                    </div>
                    <h2 className="text-3xl md:text-4xl font-heading font-bold text-heading leading-tight">{selectedClient.name}</h2>
                    <p className="text-on-surface-muted flex items-start text-base">
                        <MapPin size={18} className="mr-2 mt-0.5 text-secondary flex-shrink-0" />
                        {selectedClient.address || 'Dirección no especificada'}
                    </p>
                </div>

                {/* Social & Actions Horizontal */}
                <div className="flex flex-wrap items-center gap-3">
                    {selectedClient.mapUrl && (
                        <a 
                            href={selectedClient.mapUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="bg-secondary text-primary px-4 py-2 rounded-xl text-sm font-bold hover:bg-white transition-colors flex items-center"
                        >
                            <MapPin size={16} className="mr-2" />
                            Cómo llegar
                        </a>
                    )}
                    
                    {selectedClient.whatsapp && (
                        <a 
                            href={`https://wa.me/${selectedClient.whatsapp.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white flex items-center justify-center transition-all"
                            title="WhatsApp"
                        >
                            <MessageCircle size={18} />
                        </a>
                    )}

                    {selectedClient.website && (
                        <a 
                            href={selectedClient.website} 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-10 h-10 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-all border border-primary/20 hover:border-primary"
                            title="Sitio Web"
                        >
                            <Globe size={18} />
                        </a>
                    )}

                    {selectedClient.instagram && (
                        <a 
                            href={selectedClient.instagram} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="w-10 h-10 rounded-full bg-white/5 text-on-surface-muted hover:text-white hover:bg-[#E1306C] flex items-center justify-center transition-all"
                            title="Instagram"
                        >
                            <Instagram size={18} />
                        </a>
                    )}

                    {selectedClient.tiktok && (
                        <a 
                            href={selectedClient.tiktok} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="w-10 h-10 rounded-full bg-white/5 text-on-surface-muted hover:text-black hover:bg-white flex items-center justify-center transition-all"
                            title="TikTok"
                        >
                            <TikTok size={18} />
                        </a>
                    )}
                </div>
            </div>

            {/* Right Side: Product Gallery */}
            <div className="w-full md:w-1/2 bg-black/40 flex flex-col justify-center p-8 border-t md:border-t-0 md:border-l border-white/5">
                {selectedClient.productImages && selectedClient.productImages.length > 0 ? (
                    <div className="w-full max-w-sm mx-auto">
                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-black group/slider shadow-xl border border-white/5">
                            <img 
                                key={currentProductImage}
                                src={selectedClient.productImages[currentProductImage]} 
                                className="w-full h-full object-cover animate-fade-in"
                                referrerPolicy="no-referrer"
                            />
                            
                            {selectedClient.productImages.length > 1 && (
                                <>
                                    <div className="absolute inset-0 flex items-center justify-between px-3 opacity-0 group-hover/slider:opacity-100 transition-opacity duration-300">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); prevProduct(selectedClient.productImages); }}
                                            className="bg-black/60 hover:bg-secondary hover:text-primary text-white p-2 rounded-full transition-all backdrop-blur-md"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); nextProduct(selectedClient.productImages); }}
                                            className="bg-black/60 hover:bg-secondary hover:text-primary text-white p-2 rounded-full transition-all backdrop-blur-md"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                    
                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                                        {selectedClient.productImages.map((_, idx) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => setCurrentProductImage(idx)}
                                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentProductImage ? 'bg-secondary w-6' : 'bg-white/40 w-1.5 hover:bg-white'}`} 
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-sm mx-auto aspect-[4/3] rounded-2xl bg-white/5 flex flex-col items-center justify-center text-on-surface-muted border border-white/5">
                        <Users size={32} className="opacity-20 mb-2" />
                        <span className="text-sm">Sin imágenes</span>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
