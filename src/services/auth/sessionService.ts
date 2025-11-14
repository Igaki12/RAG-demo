const STORAGE_KEY = 'ragDemo.auth.session';

export function persistSession(email: string) {
  window.localStorage.setItem(STORAGE_KEY, email);
}

export function loadSession(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}
