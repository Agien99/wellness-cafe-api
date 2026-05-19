/* =====================================================
   Wellness Cafe POS - API Helper
   =====================================================
   Single source of truth for talking to the Laravel API.
   Auth token is read from sessionStorage; every call
   returns parsed JSON or throws an Error with .status.
   ===================================================== */

const API = (() => {
  const BASE = '/api';

  function token() {
    return sessionStorage.getItem('wc_token') || null;
  }

  function setSession(token, user) {
    sessionStorage.setItem('wc_token', token);
    sessionStorage.setItem('wc_user', JSON.stringify(user));
  }

  function getUser() {
    const raw = sessionStorage.getItem('wc_user');
    return raw ? JSON.parse(raw) : null;
  }

  function clearSession() {
    sessionStorage.removeItem('wc_token');
    sessionStorage.removeItem('wc_user');
  }

  async function call(method, path, body) {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    const t = token();
    if (t) headers['Authorization'] = 'Bearer ' + t;

    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(BASE + path, opts);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

    if (!res.ok) {
      const err = new Error((data && data.message) || res.statusText || 'API error');
      err.status = res.status;
      err.payload = data;
      // 401 → token expired/invalid → kick back to staff login
      if (res.status === 401 && !path.startsWith('/login')) {
        clearSession();
        if (!location.pathname.endsWith('staff.html')) {
          location.href = 'staff.html';
        }
      }
      throw err;
    }
    return data;
  }

  /**
   * Multipart upload (for product photos, etc.).
   * Don't set Content-Type manually — browser sets the boundary.
   */
  async function upload(path, file, fieldName = 'image') {
    const fd = new FormData();
    fd.append(fieldName, file);
    const headers = { 'Accept': 'application/json' };
    const t = token();
    if (t) headers['Authorization'] = 'Bearer ' + t;

    const res = await fetch(BASE + path, { method: 'POST', headers, body: fd });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const err = new Error((data && data.message) || res.statusText || 'Upload failed');
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  }

  return {
    // Auth
    login:  (username, password) => call('POST', '/login', { username, password }),
    me:     ()                   => call('GET',  '/me'),
    logout: ()                   => call('POST', '/logout'),

    // Generic
    get:    (path)               => call('GET', path),
    post:   (path, body)         => call('POST', path, body),
    put:    (path, body)         => call('PUT', path, body),
    patch:  (path, body)         => call('PATCH', path, body),
    delete: (path)               => call('DELETE', path),
    upload,

    // Session helpers
    token, setSession, getUser, clearSession,
    isAuthenticated: () => !!token(),
  };
})();
