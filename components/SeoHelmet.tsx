import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useConfig } from '../context/ConfigContext';
import { resolveDirectImageUrl } from '../utils/imageUrl';

interface SeoHelmetProps {
  route?: string;
  title?: string;
  description?: string;
}

export const SeoHelmet: React.FC<SeoHelmetProps> = ({ route = '#/', title: titleOverride, description: descriptionOverride }) => {
  const { config } = useConfig();

  const stationName = (config.general.stationName || 'BUENÍSIMA').trim();
  const slogan = (config.appearance.radioPlayer?.slogan || 'La Radio de la Buena Vibra').trim();
  const city = config.general.city?.trim();
  const country = config.general.country?.trim();
  const locationSuffix = [city, country].filter(Boolean).join(', ');

  // Determine route-aware title
  let pageTitle = `${stationName} - ${slogan}`;
  if (route.startsWith('#/admin')) {
    pageTitle = `Panel de Administración | ${stationName}`;
  } else if (route.startsWith('#/login')) {
    pageTitle = `Iniciar Sesión | ${stationName}`;
  } else if (
    route.startsWith('#/pantalla') ||
    route.startsWith('#/display') ||
    route.startsWith('#/tv') ||
    route.startsWith('#/player') ||
    route.startsWith('#/google')
  ) {
    pageTitle = `Pantalla En Vivo | ${stationName} - ${slogan}`;
  }

  const finalTitle = titleOverride || pageTitle;

  // Determine meta description from config with intelligent fallback
  const configuredDescription = config.general.metaDescription?.trim();
  const podcastDescription = config.content.podcast?.description?.trim();
  const fallbackDescription = locationSuffix
    ? `Escucha ${stationName} en vivo desde ${locationSuffix}. ${slogan}: música, programación, noticias y entretenimiento las 24 horas.`
    : `Escucha ${stationName} en vivo. ${slogan}: música, programación, noticias, podcasts y entretenimiento las 24 horas.`;

  const finalDescription =
    descriptionOverride ||
    configuredDescription ||
    podcastDescription ||
    fallbackDescription;

  const rawLogo = config.navigation?.logoUrl || config.general.logoUrl || 'https://i.ibb.co/ZptWRz8G/LOGO-2.png';
  const faviconUrl = resolveDirectImageUrl(rawLogo) || 'https://i.ibb.co/ZptWRz8G/LOGO-2.png';

  const heroImage = config.content.hero?.[0]?.image ? resolveDirectImageUrl(config.content.hero[0].image) : '';
  const ogImage = heroImage || faviconUrl;
  const canonicalUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'RadioStation',
    name: stationName,
    description: finalDescription,
    ...(canonicalUrl ? { url: canonicalUrl } : {}),
    ...(ogImage ? { image: ogImage } : {}),
    ...(locationSuffix
      ? {
          areaServed: locationSuffix,
        }
      : {}),
  };

  return (
    <Helmet htmlAttributes={{ lang: 'es' }}>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />

      {/* Favicon */}
      <link rel="icon" type="image/png" href={faviconUrl} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* OpenGraph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={stationName} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {/* Schema.org JSON-LD */}
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
    </Helmet>
  );
};

export default SeoHelmet;
