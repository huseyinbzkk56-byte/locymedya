import { useEffect, useRef, useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { apiFetch } from '../api/client';

const CHANNELS = [
  {
    title: 'Instagram',
    value: '@locymedya',
    text: 'Görsellerimizi, kampanya kesitlerini ve son projelerimizi takip edin; DM üzerinden hızlıca bize ulaşın.',
    href: 'https://instagram.com/locymedya',
    tone: 'pink',
    icon: <path d="M4.7 2.5h6.6a2.2 2.2 0 0 1 2.2 2.2v6.6a2.2 2.2 0 0 1-2.2 2.2H4.7a2.2 2.2 0 0 1-2.2-2.2V4.7a2.2 2.2 0 0 1 2.2-2.2Zm3.3 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm3.4-1a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  },
  {
    title: 'E-posta',
    value: 'locymedya@gmail.com',
    text: 'Detaylı brief, iş birliği önerisi veya dosya paylaşımı için e-posta ile bize ulaşabilirsiniz.',
    href: 'mailto:locymedya@gmail.com',
    tone: 'blue',
    icon: <path d="M2.6 4.6h10.8v6.8H2.6V4.6Zm0 0 5.4 4 5.4-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  }
];

const EMPTY_FORM = { firstName: '', lastName: '', phone: '', subject: '', message: '' };

function validateContactForm(form) {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = 'İsim zorunlu';
  if (!form.lastName.trim()) errors.lastName = 'Soyisim zorunlu';
  if (!form.phone.trim()) errors.phone = 'İletişim numarası zorunlu';
  else if (!/^[0-9+\s()-]{6,30}$/.test(form.phone.trim())) errors.phone = 'Geçerli bir numara girin';
  if (!form.subject.trim()) errors.subject = 'Konu zorunlu';
  if (!form.message.trim()) errors.message = 'Mesaj zorunlu';
  else if (form.message.trim().length < 10) errors.message = 'Mesajınız en az 10 karakter olmalı';
  return errors;
}

function ContactFormSection() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');
    const nextErrors = validateContactForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await apiFetch('/contact', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setSuccess(true);
      setForm(EMPTY_FORM);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const FIELDS = [
    { key: 'firstName', label: 'İsim', placeholder: 'Adınız', type: 'text' },
    { key: 'lastName', label: 'Soyisim', placeholder: 'Soyadınız', type: 'text' },
    { key: 'phone', label: 'İletişim Numarası', placeholder: '+90 5XX XXX XX XX', type: 'tel' },
    { key: 'subject', label: 'Konu', placeholder: 'Mesajınızın konusu', type: 'text' }
  ];

  return (
    <section className="px-5 pb-16">
      <div data-reveal className="contact-form-card scroll-reveal mx-auto max-w-3xl p-6 sm:p-10">
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-500">Mesaj Gönderin</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Bize Yazın</h2>
          <p className="mt-2 text-sm text-slate-500">Formu doldurun, ekibimiz en kısa sürede size dönüş yapsın.</p>

          {success ? (
            <div className="contact-success">
              <span className="contact-success-icon">
                <svg viewBox="0 0 16 16" width="24" height="24" aria-hidden="true" focusable="false"><path d="M3 8.5 6.3 12 13 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <p className="text-lg font-semibold text-slate-950">Mesajınız başarıyla gönderildi.</p>
              <p className="max-w-sm text-sm text-slate-500">En kısa sürede sizinle iletişime geçeceğiz.</p>
              <button type="button" onClick={() => setSuccess(false)} className="mt-3 text-sm font-medium text-purple-600 hover:text-purple-800">Yeni mesaj gönder</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                {FIELDS.map((field) => (
                  <div key={field.key}>
                    <label htmlFor={field.key} className="mb-1.5 block text-sm font-medium text-slate-700">{field.label}</label>
                    <input
                      id={field.key}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={form[field.key]}
                      onChange={(event) => updateField(field.key, event.target.value)}
                      className={`contact-input${errors[field.key] ? ' has-error' : ''}`}
                    />
                    {errors[field.key] && <p className="contact-field-error">{errors[field.key]}</p>}
                  </div>
                ))}
              </div>

              <div>
                <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-slate-700">Mesajınız</label>
                <textarea
                  id="message"
                  placeholder="Projeniz veya talebiniz hakkında bize bilgi verin..."
                  value={form.message}
                  maxLength={2000}
                  onChange={(event) => updateField('message', event.target.value)}
                  className={`contact-input${errors.message ? ' has-error' : ''}`}
                />
                {errors.message && <p className="contact-field-error">{errors.message}</p>}
              </div>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}

              <button type="submit" disabled={submitting} className="contact-submit w-full rounded-full px-6 py-3.5 text-sm font-semibold text-white sm:w-auto sm:px-10">
                {submitting ? 'Gönderiliyor...' : 'GÖNDER'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Contact() {
  const pageRef = useRef(null);

  useEffect(() => {
    const root = pageRef.current;
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
  }, []);

  return (
    <div className="site-shell min-h-screen text-gray-950">
      <SiteHeader />

      <main id="main-content" ref={pageRef}>
        <section className="hero-pattern contact-hero px-5 pb-16 pt-[140px] text-slate-950">
          <div className="mx-auto w-full max-w-3xl text-center">
            <p className="hero-reveal hero-eyebrow"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="m6 1 .8 3.2L10 5l-3.2.8L6 9l-.8-3.2L2 5l3.2-.8L6 1Z" fill="currentColor" /></svg> İLETİŞİM</p>
            <h1 className="hero-reveal hero-delay hero-title mx-auto mt-7 max-w-2xl text-4xl font-semibold leading-[0.98] tracking-tight sm:text-6xl">İLETİŞİME <span>GEÇİN</span></h1>
            <p className="hero-reveal hero-delay-2 mx-auto mt-7 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">Projeniz, müzik PR çalışmanız veya iş birliği talepleriniz için bizimle iletişime geçin.</p>
          </div>
        </section>

        <section className="px-5 pb-8">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
              {CHANNELS.map((channel, index) => (
                <a
                  key={channel.title}
                  href={channel.href}
                  target={channel.href.startsWith('http') ? '_blank' : undefined}
                  rel={channel.href.startsWith('http') ? 'noreferrer' : undefined}
                  data-reveal
                  style={{ '--reveal-delay': `${index * 100}ms` }}
                  className={`contact-card service-card service-card-${channel.tone} scroll-reveal block`}
                >
                  <div className="service-icon"><svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true" focusable="false">{channel.icon}</svg></div>
                  <h3>{channel.title}</h3>
                  <p className="contact-card-value mt-3 text-sm">{channel.value}</p>
                  <p className="mt-2">{channel.text}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <ContactFormSection />

        <section className="px-5 py-16">
          <div data-reveal className="contact-panel scroll-reveal mx-auto max-w-6xl p-8 sm:p-12">
            <div className="grid gap-8 sm:grid-cols-[1.3fr,1fr] sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-300">Dönüş Süresi</p>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">Mesajınız bize ulaştıktan sonra en kısa sürede dönüş yapıyoruz.</h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">Talebinizi aldıktan sonra ekibimiz projenizi değerlendirir ve size en uygun PR / influencer stratejisiyle geri döner.</p>
              </div>
              <div className="flex flex-col gap-4 sm:border-l sm:border-white/10 sm:pl-8">
                <div>
                  <p className="text-3xl font-extrabold text-white">24 saat</p>
                  <p className="mt-1 text-sm text-slate-400">içinde ilk geri dönüş</p>
                </div>
                <a href="mailto:locymedya@gmail.com" className="inline-flex w-fit items-center rounded-full bg-white px-6 py-3 text-sm font-medium text-slate-950 transition hover:-translate-y-1 hover:bg-slate-100">
                  Hemen Yazın
                  <svg className="ml-3" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M3 9 9 3m0 0H5m4 0v4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
