import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const MEDIA = API.replace(/\/api\/?$/, '');
const EMPTY = { artistName: '', title: '', description: '', spotifyUrl: '', youtubeUrl: '', otherUrl: '', showOnHome: false };
const imageUrl = (url) => (url?.startsWith('/') ? `${MEDIA}${url}` : url);

export default function Songs() {
  const [songs, setSongs] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [coverFile, setCoverFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverName, setCoverName] = useState('');
  const [audioName, setAudioName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const coverInput = useRef(null);
  const audioInput = useRef(null);

  async function load() {
    const response = await fetch(`${API}/songs`, { headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Şarkılar yüklenemedi');
    setSongs(data.songs || []);
  }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  function reset() {
    setForm(EMPTY); setCoverFile(null); setAudioFile(null); setCoverPreview(''); setCoverName(''); setAudioName(''); setEditingId(null);
    if (coverInput.current) coverInput.current.value = '';
    if (audioInput.current) audioInput.current.value = '';
  }
  function chooseAudio(event) {
    const file = event.target.files[0];
    if (!file) return;
    if ((file.type !== 'audio/mpeg' && !file.name.toLowerCase().endsWith('.mp3')) || file.size > 25 * 1024 * 1024) { setError('MP3 dosyası seçin ve 25 MB sınırını aşmayın'); return; }
    setError(''); setAudioFile(file); setAudioName(file.name);
  }
  function chooseCover(event) {
    const file = event.target.files[0];
    if (!file) return;
    if ((!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) || file.size > 8 * 1024 * 1024) { setError('Kapak JPG, JPEG, PNG veya WEBP olmalı ve 8 MB sınırını aşmamalı'); return; }
    setError(''); setCoverFile(file); setCoverName(file.name); setCoverPreview(URL.createObjectURL(file));
  }
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  async function uploadFile(path, field, file) {
    if (!file) return;
    const body = new FormData(); body.append(field, file);
    const response = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` }, body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Dosya yüklenemedi');
  }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (!editingId && !audioFile) throw new Error('MP3 dosyası seçin');
      const path = editingId ? `/songs/${editingId}` : '/songs';
      const response = await fetch(`${API}${path}`, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('locy_token')}` }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Şarkı kaydedilemedi');
      const songId = editingId || data.song.id;
      await uploadFile(`/covers/songs/${songId}/cover`, 'cover', coverFile);
      await uploadFile(`/audio/songs/${songId}/audio`, 'audio', audioFile);
      reset(); await load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  function edit(song) { setEditingId(song.id); setForm({ artistName: song.artist_name || '', title: song.title, description: song.description || '', spotifyUrl: song.spotify_url || '', youtubeUrl: song.youtube_url || '', otherUrl: song.other_url || '', showOnHome: Boolean(song.show_on_home) }); setCoverName(song.cover_url ? 'Mevcut kapak görseli' : ''); setAudioName(song.audio_url ? 'Mevcut MP3' : ''); setCoverPreview(imageUrl(song.cover_url)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  async function remove(id) { if (!window.confirm('Bu şarkı silinsin mi?')) return; try { const response = await fetch(`${API}/songs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` } }); if (!response.ok) throw new Error('Şarkı silinemedi'); setSongs((current) => current.filter((song) => song.id !== id)); } catch (err) { setError(err.message); } }
  return <Layout title="Şarkılar"><div className="admin-songs-page"><div className="admin-page-heading"><p className="admin-kicker">LOCYMEDYA / MÜZİK ARŞİVİ</p><h1 className="text-3xl font-semibold">Şarkılar</h1><p className="mt-2 text-sm text-gray-500">Kapak, hikaye ve doğru bağlantı. Sade bir arşiv, güçlü bir iz.</p></div><form onSubmit={submit} className="song-form mt-6 grid gap-4 sm:grid-cols-2"><input required name="title" value={form.title} onChange={update} placeholder="Şarkı adı" className="premium-input" /><input required name="artistName" value={form.artistName} onChange={update} placeholder="Sanatçı adı" className="premium-input" /><FilePicker label="Kapak görseli" inputRef={coverInput} accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={chooseCover} preview={coverPreview} fileName={coverName} /><FilePicker label="MP3 dosyası" inputRef={audioInput} accept="audio/mpeg,.mp3" onChange={chooseAudio} fileName={audioName} /><textarea name="description" value={form.description} onChange={update} placeholder="Kısa açıklama" className="premium-input min-h-28 sm:col-span-2" /><input type="url" name="spotifyUrl" value={form.spotifyUrl} onChange={update} placeholder="Spotify linki" className="premium-input" /><input type="url" name="youtubeUrl" value={form.youtubeUrl} onChange={update} placeholder="YouTube linki" className="premium-input" /><input type="url" name="otherUrl" value={form.otherUrl} onChange={update} placeholder="Diğer platform linki" className="premium-input" /><label className="premium-toggle"><input type="checkbox" checked={form.showOnHome} onChange={(event) => setForm({ ...form, showOnHome: event.target.checked })} /><span>Ana sayfada göster</span></label>{error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}<div className="flex gap-2 sm:col-span-2"><button disabled={saving} className="rounded-full bg-gray-950 px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-gray-800 disabled:opacity-50">{saving ? 'Kaydediliyor...' : editingId ? 'Şarkıyı güncelle' : 'Şarkı ekle'}</button>{editingId && <button type="button" onClick={reset} className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm">Vazgeç</button>}</div></form><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{songs.map((song) => <article key={song.id} className="admin-song-card"><div className="admin-song-cover">{song.cover_url && <img src={imageUrl(song.cover_url)} alt="" className="h-full w-full object-cover" />}</div><div className="mt-4"><h2 className="font-medium">{song.title}</h2><p className="mt-1 text-sm text-gray-500">{song.artist_name}</p></div><div className="mt-4 flex gap-3 text-sm"><button onClick={() => edit(song)} className="text-gray-600 transition hover:text-gray-950">Düzenle</button><button onClick={() => remove(song.id)} className="text-red-500 transition hover:text-red-700">Sil</button></div></article>)}</div></div></Layout>;
}

function FilePicker({ label, inputRef, accept, onChange, preview, fileName }) {
  return <label className="file-picker"><span className="font-medium text-gray-800">{label}</span><span className="file-picker-button">Dosya seç</span><input ref={inputRef} type="file" accept={accept} onChange={onChange} />{(preview || fileName) && <div className="mt-3"><p className="truncate text-xs text-gray-500">✓ {fileName}</p>{preview && <img src={preview} alt="Kapak önizleme" className="mt-2 h-28 w-28 rounded-xl object-cover" />}</div>}</label>;
}
