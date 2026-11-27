export const DEMO_PIN_STORAGE_KEY = 'zm_demo_route_pin';
const DEMO_EVENT_NAME = 'zm:demo-mode-changed';

function getSharedCookieDomainAttr(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname.toLowerCase();
  if (host === 'zeromall.id.vn' || host.endsWith('.zeromall.id.vn')) {
    return '; Domain=.zeromall.id.vn';
  }
  if (host === 'zeromall.local' || host.endsWith('.zeromall.local')) {
    return '; Domain=.zeromall.local';
  }
  return '';
}

function readCookiePin(): string {
  if (typeof document === 'undefined') return '';
  const prefix = `${DEMO_PIN_STORAGE_KEY}=`;
  const parts = document.cookie ? document.cookie.split(';') : [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length)).trim();
      } catch {
        return trimmed.slice(prefix.length).trim();
      }
    }
  }
  return '';
}

export function getDemoHelperPin(): string {
  try {
    return (
      localStorage.getItem(DEMO_PIN_STORAGE_KEY) ||
      sessionStorage.getItem(DEMO_PIN_STORAGE_KEY) ||
      readCookiePin() ||
      ''
    );
  } catch {
    return readCookiePin();
  }
}

export function setDemoHelperPin(pin: string): void {
  const clean = pin.trim();
  try {
    localStorage.setItem(DEMO_PIN_STORAGE_KEY, clean);
    sessionStorage.setItem(DEMO_PIN_STORAGE_KEY, clean);
  } catch {}
  if (typeof document !== 'undefined') {
    const domainAttr = getSharedCookieDomainAttr();
    document.cookie = `${DEMO_PIN_STORAGE_KEY}=${encodeURIComponent(clean)}; path=/; SameSite=Lax${domainAttr}; max-age=43200`;
  }
  window.dispatchEvent(new CustomEvent(DEMO_EVENT_NAME));
}

export function clearDemoHelperPin(): void {
  try {
    localStorage.removeItem(DEMO_PIN_STORAGE_KEY);
    sessionStorage.removeItem(DEMO_PIN_STORAGE_KEY);
  } catch {}
  if (typeof document !== 'undefined') {
    const domainAttr = getSharedCookieDomainAttr();
    document.cookie = `${DEMO_PIN_STORAGE_KEY}=; path=/; SameSite=Lax${domainAttr}; max-age=0`;
    document.cookie = `${DEMO_PIN_STORAGE_KEY}=; path=/; SameSite=Lax; max-age=0`;
  }
  window.dispatchEvent(new CustomEvent(DEMO_EVENT_NAME));
}

export function isDemoHelperEnabled(): boolean {
  return Boolean(getDemoHelperPin());
}

export function subscribeDemoHelper(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(DEMO_EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(DEMO_EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

let secretTapTimes: number[] = [];

export function handleSecretDemoTap(e?: { stopPropagation?: () => void }): void {
  e?.stopPropagation?.();
  const now = Date.now();
  secretTapTimes = [...secretTapTimes, now].filter((ts) => now - ts < 2500);
  if (secretTapTimes.length >= 5) {
    secretTapTimes = [];
    window.dispatchEvent(new CustomEvent('zm:open-route-inspector'));
  }
}
