require('dotenv').config();
const db = require('./db/db');
const { hashPassword } = require('./utils/password');

async function seed() {
  await db.init();
  const existing = await db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
  if (existing) {
    console.log('Zaten bir admin kullanıcı var ->', existing.username);
    return;
  }

  const passwordHash = await hashPassword('admin123');
  await db.prepare(
    'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)'
  ).run('admin', passwordHash, 'admin', 'Admin');

  console.log('İlk admin kullanıcı oluşturuldu.');
  console.log('Kullanıcı adı: admin');
  console.log('Şifre: admin123');
  console.log('ÖNEMLİ: Giriş yaptıktan sonra bu şifreyi mutlaka değiştirin.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
