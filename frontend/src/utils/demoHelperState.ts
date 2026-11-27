export const DEMO_PIN_STORAGE_KEY = 'zm_demo_route_pin';
const DEMO_EVENT_NAME = 'zm:demo-mode-changed';

export function getDemoHelperPin(): string {
  try {
    return localStorage.getItem(DEMO_PIN_STORAGE_KEY) || sessionStorage.getItem(DEMO_PIN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setDemoHelperPin(pin: string): void {
  const clean = pin.trim();
  try {
    localStorage.setItem(DEMO_PIN_STORAGE_KEY, clean);
    sessionStorage.setItem(DEMO_PIN_STORAGE_KEY, clean);
  } catch {}
  window.dispatchEvent(new CustomEvent(DEMO_EVENT_NAME));
}

export function clearDemoHelperPin(): void {
  try {
    localStorage.removeItem(DEMO_PIN_STORAGE_KEY);
    sessionStorage.removeItem(DEMO_PIN_STORAGE_KEY);
  } catch {}
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
