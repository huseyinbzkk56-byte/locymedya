-- LOCYMEDYA veritabanı şeması

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','influencer','rapmedia')),
  display_name TEXT,
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS influencers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  tiktok_url TEXT,
  phone TEXT,
  desired_fee REAL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  platform_handle TEXT,
  phone TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  x_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_id INTEGER REFERENCES artists(id),
  artist_name TEXT,
  title TEXT NOT NULL,
  cover_url TEXT,
  audio_url TEXT,
  description TEXT,
  spotify_url TEXT,
  youtube_url TEXT,
  other_url TEXT,
  show_on_home INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  artist_id INTEGER REFERENCES artists(id),
  song_id INTEGER REFERENCES songs(id),
  artist_name TEXT,
  song_name TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','completed','cancelled')),
  budget REAL,
  cover_url TEXT,
  description TEXT,
  public_url TEXT,
  show_on_home INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_influencers (
  project_id INTEGER REFERENCES projects(id),
  influencer_id INTEGER REFERENCES influencers(id),
  PRIMARY KEY (project_id, influencer_id)
);

CREATE TABLE IF NOT EXISTS project_media_accounts (
  project_id INTEGER REFERENCES projects(id),
  media_account_id INTEGER REFERENCES media_accounts(id),
  PRIMARY KEY (project_id, media_account_id)
);

-- Instagram/TikTok video linkleri (izlenme takibi için)
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id),
  owner_user_id INTEGER REFERENCES users(id),
  platform TEXT NOT NULL CHECK(platform IN ('instagram','tiktok')),
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','deleted','unreachable')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Her saatlik kontrolde yeni bir satır eklenir (geçmiş asla silinmez)
CREATE TABLE IF NOT EXISTS video_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER REFERENCES videos(id),
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  scraped_at TEXT DEFAULT (datetime('now'))
);

-- Admin tarafından değiştirilebilir ödeme kademeleri
CREATE TABLE IF NOT EXISTS payment_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  min_views INTEGER NOT NULL,
  max_views INTEGER,
  amount REAL NOT NULL,
  active INTEGER DEFAULT 1
);

-- Admin'in manuel girdiği gerçek ödeme kayıtları (otomatik hak ediş YOK)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id INTEGER REFERENCES influencers(id),
  project_id INTEGER REFERENCES projects(id),
  amount REAL NOT NULL,
  paid_at TEXT DEFAULT (datetime('now')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid','pending','cancelled'))
);

-- Genel uygulama ayarları (key/value) — örn. izlenme başına ödeme oranı
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Teklif kataloğu: influencer / Türkçe Rap Medyası hesapları (Instagram/TikTok)
-- Bir hesap/sayfa hem Instagram hem TikTok'a sahip olabilir; her platformun linki,
-- takipçisi ve fiyatı birbirinden bağımsız tutulur (herhangi biri boş olabilir).
CREATE TABLE IF NOT EXISTS offer_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('influencer','rapmedia','dizi')),
  instagram_url TEXT,
  instagram_followers INTEGER,
  instagram_normal_price REAL,
  instagram_client_price REAL,
  tiktok_url TEXT,
  tiktok_followers INTEGER,
  tiktok_normal_price REAL,
  tiktok_client_price REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Müşteriye özel teklif/link listeleri
CREATE TABLE IF NOT EXISTS offer_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  public_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','archived')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Bir teklif içindeki hesaplar (müşteriye özel fiyatla)
CREATE TABLE IF NOT EXISTS offer_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER NOT NULL REFERENCES offer_lists(id) ON DELETE CASCADE,
  media_account_id INTEGER NOT NULL REFERENCES offer_accounts(id),
  client_price REAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Public iletişim formundan gelen mesajlar
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','read','archived')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Link Listesi bölümü (Rapor sisteminden tamamen ayrı)
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK(platform IN ('instagram','tiktok','x','youtube','spotify','facebook','web')),
  url TEXT NOT NULL,
  title TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

