import { InstagramIcon, TikTokIcon, XIcon, YouTubeIcon, SpotifyIcon, FacebookIcon, WebIcon } from '../components/PlatformIcons';

export const PLATFORMS = {
  instagram: { label: 'Instagram', hosts: ['instagram.com', 'www.instagram.com'], badge: 'bg-pink-50 text-pink-700', icon: InstagramIcon, accent: '#E1306C' },
  tiktok: { label: 'TikTok', hosts: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com'], badge: 'bg-slate-100 text-slate-800', icon: TikTokIcon, accent: '#25F4EE' },
  x: { label: 'X', hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'], badge: 'bg-slate-100 text-slate-800', icon: XIcon, accent: '#1D9BF0' },
  youtube: { label: 'YouTube', hosts: ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'], badge: 'bg-red-50 text-red-700', icon: YouTubeIcon, accent: '#FF3B4E' },
  spotify: { label: 'Spotify', hosts: ['open.spotify.com'], badge: 'bg-green-50 text-green-700', icon: SpotifyIcon, accent: '#1DB954' },
  facebook: { label: 'Facebook', hosts: ['facebook.com', 'www.facebook.com', 'fb.watch', 'm.facebook.com'], badge: 'bg-blue-50 text-blue-700', icon: FacebookIcon, accent: '#2E8CFF' },
  web: { label: 'Web', hosts: [], badge: 'bg-slate-100 text-slate-600', icon: WebIcon, accent: '#A3ACBB' }
};

export function detectPlatform(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [key, cfg] of Object.entries(PLATFORMS)) {
      if (cfg.hosts.includes(hostname)) return key;
    }
  } catch {}
  return 'web';
}

export function PlatformIcon({ platform, className = 'h-3.5 w-3.5', style }) {
  const Icon = PLATFORMS[platform]?.icon || WebIcon;
  return <Icon className={className} style={style} />;
}
