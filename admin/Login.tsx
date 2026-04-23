import React, { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { Lock } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useConfig();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    
    const success = await login(username, password);
    setLoading(false);
    
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
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white font-sans">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-purple-600/20">
            <Lock size={32} />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-white mb-2 uppercase tracking-wider">Panel Administrativo</h2>
        <p className="text-center text-gray-400 text-sm mb-8 italic">Ingresa tus credenciales de acceso</p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                <p className="text-red-400 text-sm text-center font-medium">Usuario o clave incorrectos.</p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-500 ml-1">Usuario</label>
            <input 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nombre de usuario"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-500 ml-1">Clave</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-4 rounded-lg font-bold hover:bg-purple-700 transition-all transform active:scale-95 shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
                "Entrar al Panel"
            )}
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