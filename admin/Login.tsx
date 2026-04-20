import React, { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { Lock } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useConfig();
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login();
    if (success) {
      window.location.hash = '#/admin';
    } else {
      setError(true);
    }
  };

  const handleBackToSite = () => {
    window.location.hash = ''; // Clear hash to go to root
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Lock size={32} />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-white mb-2">Panel Administrativo</h2>
        <p className="text-center text-gray-400 text-sm mb-6">Inicia sesión con Google para continuar</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                <p className="text-red-400 text-sm text-center font-medium">Error de autenticación o acceso denegado.</p>
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-purple-900 transition-all transform active:scale-95 shadow-lg flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                <path d="M1 1h22v22H1z" fill="none"/>
            </svg>
            <span>Iniciar Sesión con Google</span>
          </button>
        </form>
        <div className="mt-8 text-center border-t border-gray-800 pt-4">
            <button 
                onClick={handleBackToSite}
                className="text-sm text-gray-500 hover:text-white underline bg-transparent border-none cursor-pointer transition-colors"
            >
                &larr; Volver al sitio web
            </button>
        </div>
      </div>
    </div>
  );
};