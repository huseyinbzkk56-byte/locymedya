const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('locy_token');
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Bir hata oluştu' }));
    throw new Error(err.error || 'Bir hata oluştu');
  }
  return res.json();
}

export async function login(username, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  localStorage.setItem('locy_token', data.token);
  localStorage.setItem('locy_user', JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem('locy_token');
  localStorage.removeItem('locy_user');
}

export function getCurrentUser() {
  const raw = localStorage.getItem('locy_user');
  return raw ? JSON.parse(raw) : null;
}
