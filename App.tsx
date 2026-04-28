import React, { useState, useEffect } from 'react';
import { ConfigProvider, useConfig } from './context/ConfigContext';
import PublicView from './components/PublicView';
import { AdminPanel } from './admin/AdminPanel';
import { Login } from './admin/Login';

// Component to handle global style injection based on config
const ThemeApplicator: React.FC = () => {
    const { config } = useConfig();

    useEffect(() => {
        const root = document.documentElement;
        const { appearance } = config;

        // Apply Colors
        root.style.setProperty('--color-primary', appearance.primaryColor);
        root.style.setProperty('--color-secondary', appearance.secondaryColor);
        root.style.setProperty('--color-heading', appearance.headingColor || appearance.primaryColor);
        
        // Theme Mode Colors (Dark/Light)
        if (appearance.themeMode === 'light') {
            root.style.setProperty('--color-surface', appearance.backgroundColor || '#ffffff');
            root.style.setProperty('--color-surface-alt', '#f3f4f6'); // gray-100
            root.style.setProperty('--color-text', appearance.textColor || '#1f2937'); // gray-800
            root.style.setProperty('--color-text-muted', '#4b5563'); // gray-600
        } else {
            root.style.setProperty('--color-surface', '#030712'); // gray-950
            root.style.setProperty('--color-surface-alt', '#111827'); // gray-900
            root.style.setProperty('--color-text', '#f9fafb'); // gray-50
            root.style.setProperty('--color-text-muted', '#9ca3af'); // gray-400
        }

        // Apply Fonts
        // Fallback for Helvetica to system font
        const bodyFontStack = appearance.bodyFont === 'Helvetica' ? 'Helvetica, Arial, sans-serif' : `"${appearance.bodyFont}", sans-serif`;
        const headingFontStack = appearance.headingFont === 'Helvetica' ? 'Helvetica, Arial, sans-serif' : `"${appearance.headingFont}", serif`;

        root.style.setProperty('--font-body', bodyFontStack);
        root.style.setProperty('--font-heading', headingFontStack);

    }, [config]);

    return null;
};

const AppLoader = () => {
    return (
        <div className="fixed inset-0 min-h-screen bg-[#030712] flex flex-col items-center justify-center z-50">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
            <p className="mt-4 text-white/50 text-sm animate-pulse tracking-widest uppercase">Cargando...</p>
        </div>
    );
};

const AppContent: React.FC = () => {
  const { isConfigLoaded } = useConfig();
  const [route, setRoute] = useState(window.location.hash || '#/');

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash || '#/');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (!isConfigLoaded) {
      return <AppLoader />;
  }

  return (
    <>
        <ThemeApplicator />
        {route.startsWith('#/admin') ? (
            <AdminPanel />
        ) : route.startsWith('#/login') ? (
            <Login />
        ) : (
            <PublicView />
        )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <ConfigProvider>
      <AppContent />
    </ConfigProvider>
  );
};

export default App;