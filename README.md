# LOCYMEDYA — Faz 1 (Temel)

Bu, LOCYMEDYA PR/influencer yönetim platformunun **temelidir**. Talimattaki 32 bölümün
tamamı tek seferde, test edilmemiş şekilde yazılmadı — bunun yerine sağlam ve gerçekten
çalışan bir temel kuruldu. Kalan bölümler aşağıda net şekilde listeleniyor.

## Bu fazda tamamlananlar

- Express backend + SQLite veritabanı (dosya tabanlı, kurulum gerektirmez)
- 4 rollü kullanıcı sistemi: `admin`, `influencer`, `artist`, `rapmedia`
- E-posta gerektirmeyen kullanıcı adı/şifre girişi, bcrypt ile hash'lenmiş şifreler, JWT oturum
- Admin: kullanıcı oluşturma / silme / şifre sıfırlama
- Rol bazlı yetkilendirme (her rol sadece kendi endpoint'lerine erişir)
- Her rol için ayrı, birbirinin verisini göremeyen dashboard (admin genel istatistik,
  influencer sadece kendi ödemeleri, sanatçı sadece kendi projeleri, rap medya sadece
  kendine atanan projeler)
- Tüm ana tablolar: users, artists, influencers, media_accounts, projects, songs,
  videos, video_metrics, payments, payment_rules, links
- Beyaz, temiz, mobil öncelikli arayüz (Tailwind), hover/geçiş animasyonları

## Henüz YAPILMADI (bir sonraki fazlar)

Bunları burada yazmadım çünkü hiçbiri gerçek API bağlantısı, saatlik zamanlanmış görev veya
uzun test döngüsü olmadan "gerçekten çalışıyor" diyemeyeceğim şeyler:

1. PR projesi oluşturma/düzenleme ekranları (backend şeması hazır, arayüz eksik)
2. Şarkı ekleme, kapak/mp3 yükleme
3. Link Listesi (Instagram/TikTok/X) — ekleme, kategorilere ayırma, sunum/PDF export
4. **Apify entegrasyonu (TikTok + Instagram gerçek izlenme verisi)** — bunun için
   sizin gerçek bir Apify hesabı ve `APIFY_API_TOKEN` sağlamanız, ayrıca kullanılacak
   Actor'ların (TikTok/Instagram) güncel input/output formatının doğrulanması gerekiyor.
   Bu adım internet erişimi gerektirdiği için bu sohbetin çalışma ortamında test edilemedi.
5. Saatlik otomatik izlenme kontrolü (node-cron ile zamanlanmış görev)
6. Silinen/erişilemeyen video tespiti ve ödeme hesaplamasından hariç tutma mantığı
7. Admin tarafından düzenlenebilir ödeme kademeleri arayüzü (tablo backend'de var)
8. Aylık raporlar ve "en çok izlenenler" (sadece admin)
9. "Hesaplarımız" carousel bileşeni

## Kurulum (kendi bilgisayarınızda veya Claude Code'da)

```bash
# Backend
cd backend
cp .env.example .env
# .env dosyasını açıp JWT_SECRET alanına uzun rastgele bir metin yazın
npm install
npm run seed     # ilk admin kullanıcıyı oluşturur (admin / admin123)
npm run dev       # http://localhost:4000

# Frontend (yeni bir terminalde)
cd frontend
npm install
npm run dev       # http://localhost:5173
```

Giriş: `admin` / `admin123` — giriş yaptıktan sonra mutlaka şifreyi değiştirin.

## Önemli notlar

- Hiçbir yerde sahte/random izlenme verisi üretilmedi. `video_metrics` tablosu şu an
  boş — gerçek Apify entegrasyonu kurulmadan doldurulmayacak.
- `APIFY_API_TOKEN` hiçbir kod dosyasına yazılmadı, sadece `.env` üzerinden okunacak
  şekilde tasarlandı (`.env` dosyası `.gitignore` içinde, asla paylaşmayın).
- Bu paket bu sohbetin çalışma ortamında `npm install` ile test edilemedi çünkü o
  ortamın internet erişimi kapalı. Kod sözdizimi olarak doğrulandı ama gerçek
  çalıştırma testi sizin makinenizde veya Claude Code'da yapılmalı.

## Devam etmek için

Bu klasörü Claude Code'a (kendi bilgisayarınızda) verip yukarıdaki "Henüz YAPILMADI"
listesini sırayla yaptırabilirsiniz — Claude Code gerçek npm install çalıştırabilir,
gerçek bir sunucuyu ayakta tutabilir ve Apify API'sini gerçekten test edebilir.
