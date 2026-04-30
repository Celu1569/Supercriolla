import React, { useEffect, useRef } from 'react';

export const WidgetEmbed: React.FC<{ html: string }> = ({ html }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Set HTML
    containerRef.current.innerHTML = html;

    // Find all scripts that were injected and run them
    const scripts = containerRef.current.querySelectorAll('script');
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute((attr as Attr).name, (attr as Attr).value);
      });
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [html]);

  return <div ref={containerRef} className="w-full flex justify-center" />;
};
