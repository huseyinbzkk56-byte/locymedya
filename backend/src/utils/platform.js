const PLATFORMS = {
	instagram: { label: 'Instagram', hosts: ['instagram.com', 'www.instagram.com'], badgeBg: '#FCE7F3', badgeText: '#BE185D', accent: '#E1306C' },
	tiktok: { label: 'TikTok', hosts: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com'], badgeBg: '#F1F5F9', badgeText: '#0F172A', accent: '#25F4EE' },
	x: { label: 'X', hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'], badgeBg: '#F1F5F9', badgeText: '#0F172A', accent: '#1D9BF0' },
	youtube: { label: 'YouTube', hosts: ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'], badgeBg: '#FEE2E2', badgeText: '#B91C1C', accent: '#FF3B4E' },
	spotify: { label: 'Spotify', hosts: ['open.spotify.com'], badgeBg: '#DCFCE7', badgeText: '#15803D', accent: '#1DB954' },
	facebook: { label: 'Facebook', hosts: ['facebook.com', 'www.facebook.com', 'fb.watch', 'm.facebook.com'], badgeBg: '#DBEAFE', badgeText: '#1D4ED8', accent: '#2E8CFF' },
	web: { label: 'Web', hosts: [], badgeBg: '#F1F5F9', badgeText: '#475569', accent: '#A3ACBB' }
};

function detectPlatform(url) {
	try {
		const hostname = new URL(url).hostname.toLowerCase();
		for (const [key, cfg] of Object.entries(PLATFORMS)) {
			if (cfg.hosts.includes(hostname)) return key;
		}
	} catch {}
	return 'web';
}

module.exports = { PLATFORMS, detectPlatform };
