const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('HATA: TURSO_DATABASE_URL ve TURSO_AUTH_TOKEN .env dosyasında tanımlı olmalı.');
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

function toRunResult(result) {
  return {
    changes: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid === undefined || result.lastInsertRowid === null
      ? undefined
      : Number(result.lastInsertRowid)
  };
}

// better-sqlite3 ile aynı şekil: db.prepare(sql).get/all/run(...args) — ama async (await gerekir)
function prepareOn(executor) {
  return function prepare(sql) {
    return {
      async get(...args) {
        const result = await executor({ sql, args });
        return result.rows[0];
      },
      async all(...args) {
        const result = await executor({ sql, args });
        return result.rows;
      },
      async run(...args) {
        const result = await executor({ sql, args });
        return toRunResult(result);
      }
    };
  };
}

// Tek bir SQL bağlantısı üzerinde çalışan atomik işlem. Kullanım:
//   const id = await db.transaction(async (tx) => { ... tx.prepare(sql).run(...) ...; return id; });
async function transaction(fn) {
  const tx = await client.transaction('write');
  try {
    const result = await fn({ prepare: prepareOn((stmt) => tx.execute(stmt)) });
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

const db = {
  prepare: prepareOn((stmt) => client.execute(stmt)),
  transaction,
  async exec(sql) {
    await client.executeMultiple(sql);
  }
};

async function columnsOf(table) {
  const rows = await db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.map((row) => row.name);
}

async function addColumnIfMissing(table, column, definition) {
  const columns = await columnsOf(table);
  if (!columns.includes(column)) await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function tableSql(table) {
  const row = await db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return row ? row.sql : null;
}

let initPromise = null;

function init() {
  if (!initPromise) initPromise = runInit();
  return initPromise;
}

async function runInit() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.exec(schema);

  await addColumnIfMissing('projects', 'cover_url', 'TEXT');
  await addColumnIfMissing('projects', 'artist_name', 'TEXT');
  await addColumnIfMissing('projects', 'song_name', 'TEXT');
  await addColumnIfMissing('projects', 'description', 'TEXT');
  await addColumnIfMissing('projects', 'public_url', 'TEXT');
  await addColumnIfMissing('projects', 'show_on_home', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('songs', 'description', 'TEXT');
  await addColumnIfMissing('songs', 'artist_name', 'TEXT');
  await addColumnIfMissing('songs', 'spotify_url', 'TEXT');
  await addColumnIfMissing('songs', 'youtube_url', 'TEXT');
  await addColumnIfMissing('songs', 'other_url', 'TEXT');
  await addColumnIfMissing('songs', 'show_on_home', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('users', 'phone', 'TEXT');
  await addColumnIfMissing('users', 'active', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('users', 'admin_scope', "TEXT NOT NULL DEFAULT 'full'");
  await addColumnIfMissing('influencers', 'tiktok_url', 'TEXT');
  await addColumnIfMissing('influencers', 'phone', 'TEXT');
  await addColumnIfMissing('influencers', 'desired_fee', 'REAL');
  await addColumnIfMissing('influencers', 'active', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('media_accounts', 'phone', 'TEXT');
  await addColumnIfMissing('media_accounts', 'instagram_url', 'TEXT');
  await addColumnIfMissing('media_accounts', 'tiktok_url', 'TEXT');
  await addColumnIfMissing('media_accounts', 'x_url', 'TEXT');
  await addColumnIfMissing('media_accounts', 'active', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('links', 'title', 'TEXT');
  await addColumnIfMissing('links', 'preview_image', 'TEXT');
  await addColumnIfMissing('links', 'preview_title', 'TEXT');
  await addColumnIfMissing('links', 'preview_fetched_at', 'TEXT');
  await addColumnIfMissing('links', 'stats_views', 'INTEGER');
  await addColumnIfMissing('links', 'stats_likes', 'INTEGER');
  await addColumnIfMissing('links', 'stats_comments', 'INTEGER');
  await addColumnIfMissing('links', 'stats_fetched_at', 'TEXT');
  await addColumnIfMissing('links', 'screenshot_url', 'TEXT');
  await addColumnIfMissing('links', 'archived', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('links', 'account_id', 'INTEGER REFERENCES offer_accounts(id)');

  // links.platform CHECK kısıtlaması eski (instagram/tiktok/x) ise genişlet — yeni platformlar (youtube/spotify/facebook/web) eklenebilsin
  const linksSql = await tableSql('links');
  if (linksSql && !linksSql.includes('youtube')) {
    await db.exec(`
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
    await addColumnIfMissing('links', 'preview_image', 'TEXT');
    await addColumnIfMissing('links', 'preview_title', 'TEXT');
    await addColumnIfMissing('links', 'preview_fetched_at', 'TEXT');
    await addColumnIfMissing('links', 'stats_views', 'INTEGER');
    await addColumnIfMissing('links', 'stats_likes', 'INTEGER');
    await addColumnIfMissing('links', 'stats_comments', 'INTEGER');
    await addColumnIfMissing('links', 'stats_fetched_at', 'TEXT');
    await addColumnIfMissing('links', 'screenshot_url', 'TEXT');
    await addColumnIfMissing('links', 'archived', 'INTEGER NOT NULL DEFAULT 0');
    await addColumnIfMissing('links', 'account_id', 'INTEGER REFERENCES offer_accounts(id)');
  }

  const paymentColumns = await columnsOf('payments');
  if (!paymentColumns.includes('status')) {
    await db.exec("ALTER TABLE payments ADD COLUMN status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid','pending','cancelled'))");
  }
  await addColumnIfMissing('payments', 'media_account_id', 'INTEGER REFERENCES media_accounts(id)');

  // offer_accounts: tekli platform şemasından (platform/profile_url/...) çoklu platform şemasına
  // (instagram_*/tiktok_*) geçiş. Hesap id'leri korunur, offer_list_items referansları bozulmaz.
  const offerAccountColumns = await columnsOf('offer_accounts');
  if (offerAccountColumns.includes('platform')) {
    const oldRows = await db.prepare('SELECT * FROM offer_accounts').all();
    await db.exec(`
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of oldRows) {
      const isInstagram = row.platform === 'instagram';
      await insert.run(
        row.id, row.name, row.category,
        isInstagram ? row.profile_url : null,
        isInstagram ? row.followers : null,
        isInstagram ? row.normal_price : null,
        isInstagram ? row.client_price : null,
        !isInstagram ? row.profile_url : null,
        !isInstagram ? row.followers : null,
        !isInstagram ? row.normal_price : null,
        !isInstagram ? row.client_price : null,
        row.created_at, row.updated_at
      );
    }
    await db.exec('DROP TABLE offer_accounts');
    await db.exec('ALTER TABLE offer_accounts_new RENAME TO offer_accounts');
  }

  // offer_accounts.category CHECK kısıtlaması eski (influencer/rapmedia) ise genişlet — "Dizi Edit Sayfası" kategorisi eklenebilsin
  const offerAccountsSql = await tableSql('offer_accounts');
  if (offerAccountsSql && !offerAccountsSql.includes('dizi')) {
    await db.exec(`
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

  // offer_accounts.category CHECK kısıtlaması eski ise genişlet — "Futbol Edit" ve "Araba Edit" kategorileri eklenebilsin
  const offerAccountsSql2 = await tableSql('offer_accounts');
  if (offerAccountsSql2 && !offerAccountsSql2.includes('futbol')) {
    await db.exec(`
      PRAGMA foreign_keys=OFF;
      CREATE TABLE offer_accounts_new3 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('influencer','rapmedia','dizi','futbol','araba')),
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
      INSERT INTO offer_accounts_new3 SELECT * FROM offer_accounts;
      DROP TABLE offer_accounts;
      ALTER TABLE offer_accounts_new3 RENAME TO offer_accounts;
      PRAGMA foreign_keys=ON;
    `);
  }

  await addColumnIfMissing('offer_lists', 'total_price', 'REAL');

  // Video Raporları ve izlenme sorguları için performans indexleri
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_video_metrics_video_scraped ON video_metrics(video_id, scraped_at);
    CREATE INDEX IF NOT EXISTS idx_videos_owner_user_id ON videos(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_videos_project_id ON videos(project_id);
    CREATE INDEX IF NOT EXISTS idx_manual_report_videos_report_id ON manual_report_videos(report_id);
    CREATE INDEX IF NOT EXISTS idx_manual_report_video_metrics_video ON manual_report_video_metrics(video_id, scraped_at);
  `);

  // İzlenme başına ödeme oranı — tüm izlenme bazlı kazanç hesaplamaları bu tek değeri kullanır
  await db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('view_payment_rate', '0.0015')").run();
}

module.exports = db;
module.exports.init = init;
