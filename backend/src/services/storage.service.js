const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function configured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

// resourceType: 'image' | 'video' (mp3 dahil her ikili dosya 'video' kaynağı olarak yüklenir — Cloudinary'nin ses/video için kullandığı tür budur)
function uploadBuffer(buffer, { folder, resourceType = 'image' }) {
  if (!configured()) return Promise.reject(new Error('Dosya depolama yapılandırılmamış (CLOUDINARY_* .env değerleri eksik)'));
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: resourceType }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

// Cloudinary URL'sinden (https://res.cloudinary.com/<cloud>/<resourceType>/upload/.../<folder>/<publicId>.<ext>) public_id çıkarır
function publicIdFromUrl(url, folder) {
  if (!url || !url.includes('res.cloudinary.com')) return null;
  const match = url.match(new RegExp(`${folder}/([^./]+)\\.[a-zA-Z0-9]+$`));
  return match ? `${folder}/${match[1]}` : null;
}

async function destroyByUrl(url, folder, resourceType = 'image') {
  const publicId = publicIdFromUrl(url, folder);
  if (!publicId || !configured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch {
    // silent — eski dosyanın silinememesi kritik değil
  }
}

module.exports = { uploadBuffer, destroyByUrl, configured };
