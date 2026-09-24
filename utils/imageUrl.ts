// Utility to convert shared links (Google Drive, ImgBB, Dropbox) into direct image URLs

export const resolveDirectImageUrl = (url?: string | null): string => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // ImgBB known user station logos and generic handler
  if (trimmed.includes('ibb.co/V02Ffm8m') || trimmed.includes('ibb.co/kVQLN1F1')) {
    return 'https://i.ibb.co/kVQLN1F1/Logo-Buenisima-esfera-512x256.png';
  }

  // Google Drive
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    const idMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
    }
  }

  // Dropbox
  if (trimmed.includes('dropbox.com') && !trimmed.includes('raw=1')) {
    return trimmed.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/[?&]dl=0/, '?raw=1');
  }

  return trimmed;
};
