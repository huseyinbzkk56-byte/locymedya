import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MusicPlayer from '../components/MusicPlayer';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const MEDIA = API.replace(/\/api\/?$/, '');

export default function Home() {
  const [content, setContent] = useState({ projects: [], songs: [] });
  const [error, setError] = useState('');
  const songsSectionRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/public/content`)
      .then((response) => response.json())
      .then(setContent)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const root = songsSectionRef.current;
    if (!root) return undefined;
    const elements = root.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [content.songs.length]);

  return (
    <div id="top" className="site-shell min-h-screen text-gray-950">
      <SiteHeader />

      <main id="main-content" ref={songsSectionRef}>
        <section className="hero-pattern hero-section flex min-h-[78vh] items-center px-5 pb-16 pt-[100px] text-slate-950">
          <div className="hero-copy mx-auto w-full max-w-5xl text-center">
            <p className="hero-reveal hero-eyebrow"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="m6 1 .8 3.2L10 5l-3.2.8L6 9l-.8-3.2L2 5l3.2-.8L6 1Z" fill="currentColor" /></svg> MÜZİK / PR / INFLUENCER MEDYA</p>
            <h1 className="hero-reveal hero-delay hero-title mx-auto mt-7 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight sm:text-7xl">MÜZİĞİNİZİ<br /><span>ZİRVEYE ÇIKARIN</span></h1>
            <p className="hero-reveal hero-delay-2 mx-auto mt-7 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">Geniş influencer ağımız ve güçlü Türkçe Rap sayfalarıyla şarkınızı doğru kitleyle buluşturalım, PR çalışmanızı milyonlarca kişiye ulaştıralım.</p>
            <Link to="/login" className="hero-reveal hero-delay-3 mt-9 inline-flex rounded-full bg-slate-950 px-7 py-3.5 text-sm font-medium text-white transition hover:-translate-y-1 hover:bg-slate-800">GİRİŞ YAP <svg className="ml-3" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M3 9 9 3m0 0H5m4 0v4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>
          </div>
        </section>

        <ServicesSection />
        <ProcessSection />

        <section id="songs" className="songs-section scroll-mt-20 border-y border-gray-200 px-5 py-24">
          <div className="mx-auto max-w-6xl">
            <div data-reveal className="heading-reveal">
              <SectionIntro eyebrow="MÜZİK ARŞİVİ" title="PR'INI GERÇEKLEŞTİRDİĞİMİZ ŞARKILAR" />
            </div>
            {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
            <div className="song-grid mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {content.songs.map((song, index) => (
                <article key={song.id} data-reveal style={{ '--reveal-delay': `${Math.min(index * 110, 440)}ms` }} className="song-card scroll-reveal p-3 transition duration-500">
                  {song.audio_url ? <MusicPlayer src={`${MEDIA}${song.audio_url}`} cover={song.cover_url ? <img src={song.cover_url.startsWith('/') ? `${MEDIA}${song.cover_url}` : song.cover_url} alt={`${song.title} kapak görseli`} className="h-full w-full object-cover transition duration-700" /> : null} /> : <div className="song-cover-frame">{song.cover_url && <img src={song.cover_url.startsWith('/') ? `${MEDIA}${song.cover_url}` : song.cover_url} alt={`${song.title} kapak görseli`} className="h-full w-full object-cover" />}</div>}
                  <div className="song-card-body"><h2 className="song-title truncate">{song.title}</h2><p className="song-artist truncate">{song.artist_name}</p>{song.spotify_url && <a href={song.spotify_url} target="_blank" rel="noreferrer" className="spotify-link" aria-label={`${song.title} Spotify'da aç`}><SpotifyIcon /></a>}</div>
                </article>
              ))}
            </div>
            {!content.songs.length && <Empty text="Henüz yayınlanmış şarkı yok." />}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function ServicesSection() {
  const services = [
    { title: 'Güçlü Türkçe Rap Medya Ağı', text: 'Türkçe rap dünyasının önde gelen medya ve fan sayfalarıyla müziğinizi doğru kitleyle buluşturuyor, görünürlüğünüzü ve erişiminizi artırıyoruz.', tone: 'pink', icon: <path d="M4 3.5h8v9H4v-9Zm2 1.8h4M6.5 10.2h1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /> },
    { title: 'Geniş Influencer & İçerik Üreticisi Ağı', text: 'Farklı kategorilerdeki influencer ve içerik üreticileriyle şarkınıza uygun içerikler oluşturarak geniş kitlelere ulaşmanızı sağlıyoruz.', tone: 'purple', icon: <path d="M5.2 8.2a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Zm5.6-.8a1.7 1.7 0 1 0 0-3.4M2.5 12c.2-2 1.1-3 2.7-3s2.5 1 2.7 3m1.2 0c.1-1.4.8-2.2 2-2.2 1.1 0 1.8.7 2 2.2" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" /> },
    { title: 'Trend Odaklı Viral İçerik', text: 'Güncel sosyal medya trendlerini analiz ederek şarkınızı popüler içerik formatlarına entegre ediyor ve viral olma potansiyelini artırıyoruz.', tone: 'orange', icon: <path d="M8 2.5v7.1a2.1 2.1 0 1 1-1.4-2V4.2l5.3-1.7v5.3a2.1 2.1 0 1 1-1.4-2V2.5L8 3Z" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" /> },
    { title: 'TikTok & Reels Viral Kampanyaları', text: 'TikTok ve Instagram Reels için özel kampanyalar kurguluyor, yaratıcı içeriklerle şarkınızın daha fazla kişiye ulaşmasını sağlıyoruz.', tone: 'blue', icon: <path d="M3 5.1a2 2 0 0 1 2-2h4l3 2.1v3.6l-3 2.1H5a2 2 0 0 1-2-2V5.1Zm6 1.8 3-1.7m-3 1.7 3 1.7" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" /> }
  ];
  return <section className="services-section border-y border-slate-100 px-5 py-24"><div className="mx-auto max-w-6xl"><div data-reveal className="heading-reveal services-heading mx-auto max-w-3xl text-center"><p className="services-eyebrow">HİZMETLERİMİZ</p><h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Müziğinizi Doğru Kitleyle Buluşturun</h2></div><div className="services-grid mt-12 grid gap-5 sm:grid-cols-2">{services.map((service, index) => <article key={service.title} data-reveal style={{ '--reveal-delay': `${Math.min(index * 100, 300)}ms` }} className={`service-card service-card-${service.tone} scroll-reveal`}><div className="service-icon"><svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true" focusable="false">{service.icon}</svg></div><h3>{service.title}</h3><p>{service.text}</p></article>)}</div></div></section>;
}

function ProcessSection() {
  const steps = [
    { number: '01', title: 'MÜZİĞİNİZİ ANALİZ EDİYORUZ', text: 'Şarkınızı dinliyor, müziğinizin tarzını ve hedef kitlesini analiz ederek en doğru PR stratejisini belirliyoruz.', tone: 'pink', icon: <path d="M4.2 3.2h7.6v8.6H4.2V3.2Zm1.8 1.8h4m-4 2h4m-4 2h2.1" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /> },
    { number: '02', title: 'DOĞRU PLATFORM VE İÇERİK ÜRETİCİLERİNİ BELİRLİYORUZ', text: 'Bütçenize ve projenizin hedeflerine uygun influencerları ve Türkçe Rap sayfalarını seçerek etkili bir medya ağı oluşturuyoruz.', tone: 'purple', icon: <path d="M5.1 7.7a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Zm5-.7a1.5 1.5 0 1 0 0-3m-7.7 7.4c.2-1.7 1.1-2.5 2.7-2.5s2.5.8 2.7 2.5m1.2 0c.1-1.1.7-1.8 1.7-1.8 1 0 1.6.6 1.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /> },
    { number: '03', title: 'PR ÇALIŞMANIZI HAYATA GEÇİRİYORUZ', text: 'Seçilen influencerlar ve Türkçe Rap sayfaları, şarkınıza özel içerikler üreterek müziğinizi doğru kitlelerle buluşturmaya başlıyor.', tone: 'orange', icon: <path d="m3 7.7 6.9-3.1 3.1 1.4-6.9 3.1L3 7.7Zm3.1 1.4v2.2m-2.1-.8 5.9 2.6 3.1-1.4V9.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /> },
    { number: '04', title: 'PERFORMANSI TAKİP EDİYORUZ', text: 'Yayınlanan içerikleri ve elde edilen performansı düzenli olarak takip ediyor, proje sonunda verileri analiz ederek size kapsamlı bir performans değerlendirmesi sunuyoruz.', tone: 'blue', icon: <path d="M3 11.8V8.9m3.3 2.9V6.8m3.4 5V4.7m3.3 7.1V2.9M2.8 3.4l2.8 1.5 3.5-2 3.7 1.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /> }
  ];
  return <section className="process-section border-b border-slate-100 px-5 py-24"><div className="mx-auto max-w-6xl"><div data-reveal className="heading-reveal process-heading mx-auto max-w-3xl text-center"><p className="process-eyebrow">NASIL ÇALIŞIYORUZ?</p><h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Fikri görünürlüğe, görünürlüğü etkiye dönüştürüyoruz.</h2></div><div className="process-grid mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step, index) => <article key={step.number} data-reveal style={{ '--reveal-delay': `${Math.min(index * 110, 330)}ms` }} className={`process-card process-card-${step.tone} scroll-reveal`}><div className="process-number">{step.number}</div><div className="process-icon"><svg viewBox="0 0 16 16" width="21" height="21" aria-hidden="true" focusable="false">{step.icon}</svg></div><h3>{step.title}</h3><p>{step.text}</p>{index < steps.length - 1 && <span className="process-connector" aria-hidden="true"><svg viewBox="0 0 32 8" width="32" height="8"><path d="M1 4h28m0 0-4-3m4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}</article>)}</div></div></section>;
}

function SectionIntro({ eyebrow, title }) { return <div><p className="text-xs font-medium uppercase tracking-[0.25em] text-gray-400">{eyebrow}</p><h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h2></div>; }
function Empty({ text }) { return <p className="mt-8 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">{text}</p>; }
function SpotifyIcon() { return <svg className="spotify-mark" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M7.2 10.1c3.3-1 6.4-.6 9.3.7M7.8 13c2.7-.7 5.3-.4 7.7.7M8.7 15.7c2-.4 3.9-.2 5.7.5" fill="none" stroke="#fff" strokeWidth="1.35" strokeLinecap="round" /></svg>; }
function ExternalIcon() { return <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" focusable="false"><path d="M3 9 9 3m0 0H5m4 0v4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
