import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

const STATUS_LABELS = { unread: 'Okunmadı', read: 'Okundu', archived: 'Arşivlendi' };
const STATUS_STYLES = {
  unread: 'bg-blue-50 text-blue-700',
  read: 'bg-gray-100 text-gray-600',
  archived: 'bg-amber-50 text-amber-700'
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminContactMessages() {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [activeMessage, setActiveMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await apiFetch('/contact');
      setMessages(data.messages);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function openMessage(id) {
    setActiveId(id);
    setActiveMessage(null);
    try {
      const data = await apiFetch(`/contact/${id}`);
      setActiveMessage(data.message);
      setMessages((current) => current.map((item) => (item.id === id ? { ...item, status: data.message.status } : item)));
      setUnreadCount((current) => (messages.find((item) => item.id === id)?.status === 'unread' ? Math.max(0, current - 1) : current));
    } catch (err) {
      setError(err.message);
      setActiveId(null);
    }
  }

  function closeModal() {
    setActiveId(null);
    setActiveMessage(null);
  }

  async function setStatus(id, status) {
    setBusy(true);
    try {
      const data = await apiFetch(`/contact/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMessages((current) => current.map((item) => (item.id === id ? data.message : item)));
      if (activeMessage?.id === id) setActiveMessage(data.message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMessage(id) {
    if (!window.confirm('Bu mesaj kalıcı olarak silinsin mi?')) return;
    setBusy(true);
    try {
      await apiFetch(`/contact/${id}`, { method: 'DELETE' });
      setMessages((current) => current.filter((item) => item.id !== id));
      if (activeId === id) closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title="İletişim Mesajları">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link to="/admin" className="text-sm text-gray-500 hover:text-gray-900">← Admin paneli</Link>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-semibold tracking-tight">
              İletişim Mesajları
              {unreadCount > 0 && <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">{unreadCount} okunmadı</span>}
            </h1>
            <p className="mt-2 text-sm text-gray-500">Public iletişim formundan gelen mesajları görüntüleyin ve yönetin.</p>
          </div>
          <span className="text-sm text-gray-500">{messages.length} kayıt</span>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3">İsim Soyisim</th>
                <th className="px-4 py-3">Konu</th>
                <th className="px-4 py-3">Telefon</th>
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {messages.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => openMessage(item.id)}
                  className={`cursor-pointer transition hover:bg-gray-50 ${item.status === 'unread' ? 'font-semibold text-gray-950' : 'text-gray-600'}`}
                >
                  <td className="px-4 py-3">{item.first_name} {item.last_name}</td>
                  <td className="max-w-xs truncate px-4 py-3">{item.subject}</td>
                  <td className="px-4 py-3">{item.phone}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-400">{formatDate(item.created_at)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !messages.length && <p className="p-8 text-center text-sm text-gray-400">Henüz iletişim mesajı yok.</p>}
          {loading && <p className="p-8 text-center text-sm text-gray-400">Yükleniyor...</p>}
        </div>
      </div>

      {activeId && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={closeModal}>
          <div onClick={(event) => event.stopPropagation()} className="modal-panel w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl sm:p-8">
            {!activeMessage ? (
              <p className="py-8 text-center text-sm text-gray-400">Yükleniyor...</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Mesaj Detayı</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">{activeMessage.first_name} {activeMessage.last_name}</h2>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[activeMessage.status]}`}>{STATUS_LABELS[activeMessage.status]}</span>
                </div>

                <dl className="mt-5 space-y-3 text-sm">
                  <div><dt className="text-gray-400">İletişim Numarası</dt><dd className="mt-0.5 font-medium text-gray-900">{activeMessage.phone}</dd></div>
                  <div><dt className="text-gray-400">Konu</dt><dd className="mt-0.5 font-medium text-gray-900">{activeMessage.subject}</dd></div>
                  <div><dt className="text-gray-400">Mesaj</dt><dd className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-gray-800">{activeMessage.message}</dd></div>
                  <div><dt className="text-gray-400">Gönderilme Tarihi</dt><dd className="mt-0.5 font-medium text-gray-900">{formatDate(activeMessage.created_at)}</dd></div>
                </dl>

                <div className="mt-6 flex flex-wrap gap-2">
                  {activeMessage.status !== 'unread' && <button disabled={busy} onClick={() => setStatus(activeMessage.id, 'unread')} className="press-feedback rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50">Okunmadı yap</button>}
                  {activeMessage.status !== 'read' && <button disabled={busy} onClick={() => setStatus(activeMessage.id, 'read')} className="press-feedback rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50">Okundu yap</button>}
                  {activeMessage.status !== 'archived' && <button disabled={busy} onClick={() => setStatus(activeMessage.id, 'archived')} className="press-feedback rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50">Arşivle</button>}
                  <button disabled={busy} onClick={() => removeMessage(activeMessage.id)} className="press-feedback rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50">Sil</button>
                  <button onClick={closeModal} className="press-feedback ml-auto rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700">Kapat</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
