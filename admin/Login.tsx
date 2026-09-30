import React, { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { Lock, Eye, EyeOff, KeyRound, RotateCcw, CheckCircle2, ShieldCheck, AlertTriangle, UserPlus, Save } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, saveAuth } = useConfig();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Recovery Mode State
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [secretCount, setSecretCount] = useState(0);
  const [recoveryStatus, setRecoveryStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSecretClick = () => {
    const next = secretCount + 1;
    setSecretCount(next);
    if (next >= 5) {
      setRecoveryMode(true);
      setSecretCount(0);
    }
    setTimeout(() => setSecretCount(0), 3000);
  };

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return;
    
    setLoading(true);
    const ok = await saveAuth(username, password);
    setLoading(false);
    
    if (ok) {
      setRecoveryStatus('success');
      setTimeout(() => {
        setRecoveryMode(false);
        setRecoveryStatus('idle');
      }, 3000);
    } else {
      setRecoveryStatus('error');
    }
  };

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
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white font-sans p-4">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in relative overflow-hidden">
        {recoveryMode && (
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 animate-pulse z-50"></div>
        )}
        
        <div className="flex justify-center mb-6">
          <button 
            type="button"
            onClick={handleSecretClick}
            className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/30 transform hover:scale-105 transition-transform outline-none"
          >
            <Lock size={30} />
          </button>
        </div>

        {recoveryMode ? (
          <div className="animate-fade-in">
             <h2 className="text-xl font-black text-center text-amber-500 mb-1 uppercase tracking-wider flex items-center justify-center gap-2">
                <UserPlus size={20} /> Definir Administrador
             </h2>
             <p className="text-center text-gray-400 text-[10px] mb-6 uppercase tracking-tighter">Modo de recuperación activado</p>

             {recoveryStatus === 'success' && (
               <div className="mb-4 p-3 bg-green-900/40 border border-green-700/60 rounded-xl text-green-300 text-xs font-bold flex items-center gap-2">
                 <CheckCircle2 size={16} /> ¡Credenciales guardadas! Ya puedes entrar.
               </div>
             )}

             <form onSubmit={handleSetupAdmin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-500/70 ml-1">Nuevo Usuario</label>
                  <input 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej: administrador"
                    className="w-full bg-gray-800 border border-amber-900/30 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-amber-500 transition-all text-sm font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-500/70 ml-1">Nueva Clave (8+ dígitos)</label>
                  <input 
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full bg-gray-800 border border-amber-900/30 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-amber-500 transition-all text-sm font-medium"
                    required
                    minLength={8}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || password.length < 8}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3.5 rounded-xl font-bold transition-all transform active:scale-98 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {loading ? <RotateCcw className="animate-spin" size={18} /> : <Save size={18} />}
                  <span>Guardar y Activar Acceso</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setRecoveryMode(false)}
                  className="w-full py-2 text-[10px] text-gray-500 hover:text-gray-300 uppercase tracking-widest"
                >
                  Cancelar Recuperación
                </button>
             </form>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-black text-center text-white mb-1 uppercase tracking-wider">Acceso Administrativo</h2>
            <p className="text-center text-gray-400 text-sm mb-6">Ingresa tus credenciales personalizadas</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-4 bg-red-900/30 border border-red-800/60 rounded-xl">
                    <p className="text-red-400 text-sm text-center font-bold">Credenciales incorrectas.</p>
                    <p className="text-gray-400 text-[10px] text-center mt-1 uppercase tracking-tighter">La clave de fábrica ha sido eliminada por seguridad.</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">Usuario</label>
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nombre de usuario"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Clave Secreta</label>
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
                    placeholder="Contraseña de 8+ dígitos"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 pr-10 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-medium"
                    required
                  />
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
          </>
        )}

        <div className="mt-8 pt-4 border-t border-gray-800 flex flex-col items-center gap-3 text-xs">
            <div className="text-gray-500 text-[10px] uppercase tracking-widest flex items-center gap-2">
                <KeyRound size={12} /> Seguridad de Acceso Activada
            </div>
            <button 
                onClick={handleBackToSite}
                className="text-gray-500 hover:text-white underline bg-transparent border-none cursor-pointer transition-colors mt-2"
            >
                &larr; Volver al sitio web principal
            </button>
        </div>
      </div>
    </div>
  );
};