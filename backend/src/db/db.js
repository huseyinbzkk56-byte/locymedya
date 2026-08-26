const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'locymedya.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const addColumnIfMissing = (table, column, definition) => {
	const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
	if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
addColumnIfMissing('projects', 'cover_url', 'TEXT');
addColumnIfMissing('projects', 'artist_name', 'TEXT');
addColumnIfMissing('projects', 'song_name', 'TEXT');
addColumnIfMissing('projects', 'description', 'TEXT');
addColumnIfMissing('projects', 'public_url', 'TEXT');
addColumnIfMissing('projects', 'show_on_home', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('songs', 'description', 'TEXT');
addColumnIfMissing('songs', 'artist_name', 'TEXT');
addColumnIfMissing('songs', 'spotify_url', 'TEXT');
addColumnIfMissing('songs', 'youtube_url', 'TEXT');
addColumnIfMissing('songs', 'other_url', 'TEXT');
addColumnIfMissing('songs', 'show_on_home', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'phone', 'TEXT');
addColumnIfMissing('users', 'active', 'INTEGER NOT NULL DEFAULT 1');
addColumnIfMissing('influencers', 'tiktok_url', 'TEXT');
addColumnIfMissing('influencers', 'phone', 'TEXT');
addColumnIfMissing('influencers', 'desired_fee', 'REAL');
addColumnIfMissing('influencers', 'active', 'INTEGER NOT NULL DEFAULT 1');
addColumnIfMissing('media_accounts', 'phone', 'TEXT');
addColumnIfMissing('media_accounts', 'instagram_url', 'TEXT');
addColumnIfMissing('media_accounts', 'tiktok_url', 'TEXT');
addColumnIfMissing('media_accounts', 'x_url', 'TEXT');
addColumnIfMissing('media_accounts', 'active', 'INTEGER NOT NULL DEFAULT 1');
addColumnIfMissing('links', 'title', 'TEXT');
addColumnIfMissing('links', 'preview_image', 'TEXT');
addColumnIfMissing('links', 'preview_title', 'TEXT');
addColumnIfMissing('links', 'preview_fetched_at', 'TEXT');
addColumnIfMissing('links', 'stats_views', 'INTEGER');
addColumnIfMissing('links', 'stats_likes', 'INTEGER');
addColumnIfMissing('links', 'stats_comments', 'INTEGER');
addColumnIfMissing('links', 'stats_fetched_at', 'TEXT');
addColumnIfMissing('links', 'screenshot_url', 'TEXT');
addColumnIfMissing('links', 'archived', 'INTEGER NOT NULL DEFAULT 0');

// links.platform CHECK kısıtlaması eski (instagram/tiktok/x) ise genişlet — yeni platformlar (youtube/spotify/facebook/web) eklenebilsin
const linksTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'links'").get();
if (linksTableSql && !linksTableSql.sql.includes('youtube')) {
	db.exec(`
		CREATE TABLE links_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			platform TEXT NOT NULL CHECK(platform IN ('instagram','tiktok','x','youtube','spotify','facebook','web')),
			url TEXT NOT NULL,
			title TEXT,
			created_at TEXT DEFAULT (datetime('now'))
		);
		INSERT INTO links_new (id, platform, url, title, created_at) SELECT id, platform, url, title, created_at FROM links;
		DROP TABLE links;
		ALTER TABLE links_new RENAME TO links;
	`);
}

const paymentColumns = db.prepare('PRAGMA table_info(payments)').all().map((column) => column.name);
if (!paymentColumns.includes('status')) {
	db.exec("ALTER TABLE payments ADD COLUMN status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid','pending','cancelled'))");
}
addColumnIfMissing('payments', 'media_account_id', 'INTEGER REFERENCES media_accounts(id)');

// offer_accounts: tekli platform şemasından (platform/profile_url/...) çoklu platform şemasına
// (instagram_*/tiktok_*) geçiş. Hesap id'leri korunur, offer_list_items referansları bozulmaz.
const offerAccountColumns = db.prepare('PRAGMA table_info(offer_accounts)').all().map((column) => column.name);
if (offerAccountColumns.includes('platform')) {
	const oldRows = db.prepare('SELECT * FROM offer_accounts').all();
	db.exec(`
		CREATE TABLE offer_accounts_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			category TEXT NOT NULL CHECK(category IN ('influencer','rapmedia')),
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
	`);
	const insert = db.prepare(`
		INSERT INTO offer_accounts_new
			(id, name, category, instagram_url, instagram_followers, instagram_normal_price, instagram_client_price,
			 tiktok_url, tiktok_followers, tiktok_normal_price, tiktok_client_price, created_at, updated_at)
		VALUES (@id, @name, @category, @instagram_url, @instagram_followers, @instagram_normal_price, @instagram_client_price,
			@tiktok_url, @tiktok_followers, @tiktok_normal_price, @tiktok_client_price, @created_at, @updated_at)
	`);
	for (const row of oldRows) {
		const isInstagram = row.platform === 'instagram';
		insert.run({
			id: row.id, name: row.name, category: row.category,
			instagram_url: isInstagram ? row.profile_url : null,
			instagram_followers: isInstagram ? row.followers : null,
			instagram_normal_price: isInstagram ? row.normal_price : null,
			instagram_client_price: isInstagram ? row.client_price : null,
			tiktok_url: !isInstagram ? row.profile_url : null,
			tiktok_followers: !isInstagram ? row.followers : null,
			tiktok_normal_price: !isInstagram ? row.normal_price : null,
			tiktok_client_price: !isInstagram ? row.client_price : null,
			created_at: row.created_at, updated_at: row.updated_at
		});
	}
	db.exec('DROP TABLE offer_accounts');
	db.exec('ALTER TABLE offer_accounts_new RENAME TO offer_accounts');
}

// offer_accounts.category CHECK kısıtlaması eski (influencer/rapmedia) ise genişlet — "Dizi Edit Sayfası" kategorisi eklenebilsin
const offerAccountsTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'offer_accounts'").get();
if (offerAccountsTableSql && !offerAccountsTableSql.sql.includes('dizi')) {
	db.exec(`
		CREATE TABLE offer_accounts_new2 (
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
		INSERT INTO offer_accounts_new2 SELECT * FROM offer_accounts;
		DROP TABLE offer_accounts;
		ALTER TABLE offer_accounts_new2 RENAME TO offer_accounts;
	`);
}

// İzlenme başına ödeme oranı — tüm izlenme bazlı kazanç hesaplamaları bu tek değeri kullanır
db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('view_payment_rate', '0.0015')").run();

module.exports = db;
