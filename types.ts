export interface SocialLinks {
  facebook: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  whatsapp: string;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  date: string;
  image: string;
  videoUrl: string; // YouTube URL or MP4 URL
}

export interface ProgramItem {
  id: string;
  title: string;
  description: string;
  schedule: string;
  icon?: string; // Optional icon name from lucide
  announcerImage?: string; // New: Image of the announcer
}

export interface ProgramConfig {
  title: string;
  description: string;
  programs: ProgramItem[];
  weekendPrograms?: ProgramItem[]; // New: Programming for weekends
}

export interface PodcastConfig {
  title: string;
  description: string;
  liveUrl: string;
  isLive: boolean; // Toggle to show "LIVE" badge
  episodes: PodcastEpisode[];
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderPhone?: string;
  text?: string;
  audioUrl?: string;
  fileUrl?: string;
  fileName?: string;
  timestamp: string;
  isAdmin?: boolean;
}

export interface ChatConfig {
  title: string;
  description: string;
  enabled: boolean;
  allowVoiceNotes: boolean;
  allowFiles: boolean;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  adminName: string;
  phoneNumber: string;
  requirePhone?: boolean;
  containerBg?: string;
  messagesBg?: string;
  inputBg?: string;
  textColor?: string;
}

export interface GalleryItem {
  id: string;
  url: string;
  type?: 'image' | 'instagram' | 'tiktok' | 'facebook' | 'twitter' | 'youtube';
  format: 'landscape' | 'portrait'; // 16:9 or 9:16
  caption?: string;
}

export interface GalleryConfig {
  title: string;
  description: string;
  images: GalleryItem[];
}

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  alignment: 'left' | 'center' | 'right'; // Horizontal alignment
  verticalAlignment?: 'top' | 'center' | 'bottom'; // Vertical alignment
  contentMaxWidth?: number; // Max width in pixels for the text container
  
  // Title styles
  titleColor: string;
  titleSize: number;
  titleFont?: FontFamily;
  titleBold?: boolean;
  titleHighlight?: boolean;
  titleHighlightColor?: string;
  titleShadow?: 'none' | 'soft' | 'strong';
  titleOutline?: 'none' | 'light' | 'dark' | 'custom';
  titleOutlineColor?: string;
  titleOutlineWidth?: number;
  
  // Subtitle styles
  subtitleColor: string;
  subtitleSize: number;
  subtitleFont?: FontFamily;
  subtitleBold?: boolean;
  subtitleHighlight?: boolean;
  subtitleHighlightColor?: string;
  subtitleShadow?: 'none' | 'soft' | 'strong';
  subtitleOutline?: 'none' | 'light' | 'dark' | 'custom';
  subtitleOutlineColor?: string;
  subtitleOutlineWidth?: number;

  // Legacy (keep for now to avoid breaking changes during migration)
  textColor?: string; 
  textShadow?: 'none' | 'soft' | 'strong';
  textOutline?: 'none' | 'light' | 'dark';

  showButton: boolean; // Enable/Disable CTA
  buttonText: string;
  buttonLink: string;
  buttonColor: string; // Background color of button
  buttonTextColor: string; // Text color of button
}

export interface NavItemConfig {
    id: string;
    label: string;
    visible: boolean;
    link?: string; // e.g. '#podcast', '#news', 'https://...'
    children?: NavItemConfig[]; // For dropdowns
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  date: string;
  image: string;
  author?: string;
  category?: string;
  isPublished: boolean;
  url?: string;
  isRss?: boolean;
}

export interface RssFeed {
  id: string;
  name: string;
  url: string;
}

export interface TopVideo {
  id: string;
  title: string;
  url: string;
}

export interface WeeklyTopList {
  id: string;
  date: string; // e.g. "Semana del 10 al 16 de Mayo 2026"
  videos: TopVideo[];
}

export interface MonthlyTopSummary {
  id: string;
  month: string; // e.g. "Mayo 2026"
  summaryText: string;
  videos: TopVideo[]; // Top videos of the month
}

export interface TopVideosConfig {
  enabled: boolean;
  title: string;
  description: string;
  videos: TopVideo[];
  history?: WeeklyTopList[]; // Make optional for backward compatibility
  monthlySummaries?: MonthlyTopSummary[]; // Make optional for backward compatibility
}

export interface NewsConfig {
  title: string;
  description: string;
  articles: NewsItem[];
  rssFeeds?: RssFeed[];
}

export interface NavigationConfig {
    logoUrl: string;
    showLogo: boolean;
    logoHeight: number; // New: Control logo size in pixels
    navBackgroundColor: string;
    navTextColor: string;
    navActiveColor: string; // New: Color for active/highlighted item
    navFontSize?: number; // New: Control font size of menu items
    items: NavItemConfig[];
}

export type FontFamily = 
  | 'Inter' 
  | 'Playfair Display' 
  | 'Lato' 
  | 'Montserrat' 
  | 'Roboto' 
  | 'Open Sans' 
  | 'Poppins' 
  | 'Oswald' 
  | 'Raleway' 
  | 'Merriweather' 
  | 'Nunito' 
  | 'Ubuntu' 
  | 'PT Sans' 
  | 'Source Sans 3' 
  | 'Roboto Slab' 
  | 'Lora' 
  | 'Work Sans' 
  | 'Quicksand' 
  | 'Fira Sans' 
  | 'Barlow'
  | 'Helvetica';

export interface RibbonConfig {
  id: string;
  text: string;
  fontFamily: FontFamily;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  speed: number; // For marquee effect if desired, or just static
  visible: boolean;
}

export interface Client {
  id: string;
  name: string;
  bannerUrl: string;
  whatsapp: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  website?: string;
  address?: string;
  mapUrl?: string;
  productImages: string[];
}

export interface AutoDJTrack {
  id: string;
  url: string;
  title: string;
}

export interface SiteConfig {
  general: {
    stationName: string;
    streamUrl: string;
    fallbackStreamUrl?: string; // Audio file to play when stream fails
    autoDJTracks?: AutoDJTrack[];
    autoDJMode?: 'alphabetical' | 'random';
    logoUrl: string; // Deprecated in favor of navigation.logoUrl, kept for legacy compatibility
    contactEmail: string;
    contactPhone: string;
    city?: string;
    country?: string;
  };
  navigation: NavigationConfig;
  appearance: {
    themeMode: 'light' | 'dark';
    primaryColor: string;
    secondaryColor: string;
    headingColor: string; // New: Global color for H1, H2, H3
    backgroundColor: string;
    textColor: string;
    headingFont: FontFamily;
    bodyFont: FontFamily;
  };
  content: {
    hero: HeroSlide[]; 
    heroInterval: number; // New: Duration in milliseconds for each slide
    podcast: PodcastConfig;
    program: ProgramConfig;
    gallery: GalleryConfig;
    chat: ChatConfig; // Replaces donations
    ribbons: RibbonConfig[]; // New: Multiple text ribbons below hero
    clients?: Client[]; // New: Client gallery
    news?: NewsConfig; // New: News section
    topVideos?: TopVideosConfig; // New: Los 5 latigazos
  };
  social: SocialLinks;
}