import React, { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { Lock, Eye, EyeOff, KeyRound, RotateCcw, CheckCircle2, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, resetDefaultAuth } = useConfig();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

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

  const handleAutofillDefault = () => {
    setUsername('admin');
    setPassword('buenisima123');
    setError(false);
  };

  const handleResetToDefault = async () => {
    setResetting(true);
    setError(false);
    const ok = await resetDefaultAuth();
    setResetting(false);
    if (ok) {
      setUsername('admin');
      setPassword('buenisima123');
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 4000);
    }
  };

  const handleBackToSite = () => {
    window.location.hash = ''; // Clear hash to go to root
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white font-sans p-4">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in relative">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/30 transform hover:scale-105 transition-transform">
            <Lock size={30} />
          </div>
        </div>
        <h2 className="text-2xl font-black text-center text-white mb-1 uppercase tracking-wider">Panel Administrativo</h2>
        <p className="text-center text-gray-400 text-sm mb-6">Ingresa tus credenciales para administrar la emisora</p>
        
        {resetSuccess && (
          <div className="mb-5 p-4 bg-green-900/40 border border-green-700/60 rounded-xl flex items-start gap-3 text-green-300 text-xs">
            <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">¡Clave restablecida con éxito!</p>
              <p className="text-gray-300 mt-0.5">Se han rellenado las credenciales por defecto: <strong>admin</strong> / <strong>buenisima123</strong>. Haz clic en "Entrar al Panel".</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-800/60 rounded-xl space-y-2">
                <p className="text-red-400 text-sm text-center font-bold">Usuario o clave incorrectos.</p>
                <div className="bg-gray-950/70 p-3 rounded-lg border border-gray-800 text-xs space-y-2">
                  <p className="text-gray-300 text-center">Puedes usar las credenciales estándar:</p>
                  <div className="flex items-center justify-center gap-4 text-xs font-mono">
                    <span className="bg-gray-800 px-2 py-1 rounded text-purple-300">Usuario: admin</span>
                    <span className="bg-gray-800 px-2 py-1 rounded text-purple-300">Clave: buenisima123</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutofillDefault}
                    className="w-full mt-1 py-1.5 px-3 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <KeyRound size={13} /> Autocompletar datos por defecto
                  </button>
                </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">Usuario</label>
            <input 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: admin"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-medium"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Clave</label>
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1 focus:outline-none"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña de acceso"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 pr-10 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-medium"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-purple-900 text-white py-3.5 rounded-xl font-bold transition-all transform active:scale-98 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Entrar al Panel</span>
                </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-800 flex flex-col items-center gap-3 text-xs">
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={resetting}
              className="text-gray-400 hover:text-purple-300 flex items-center gap-1.5 transition"
              title="Restablece la clave en la base de datos a admin / buenisima123"
            >
              <RotateCcw size={13} className={resetting ? "animate-spin" : ""} />
              <span>{resetting ? 'Restableciendo...' : '¿Olvidaste la clave? Restablecer a fábrica (admin / buenisima123)'}</span>
            </button>
            <button 
                onClick={handleBackToSite}
                className="text-gray-500 hover:text-white underline bg-transparent border-none cursor-pointer transition-colors"
            >
                &larr; Volver al sitio web principal
            </button>
        </div>
      </div>
    </div>
  );
};