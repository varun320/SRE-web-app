// Desktop (Web Notifications API) helpers. No service worker, no VAPID —
// fires only while the app tab is open, which is when the user was already
// complaining about missing OS toasts. ponytail: closed-tab push is a
// separate build (SW + subscription table + server sender) if we ever need it.

import type { NotificationRow } from './queries';
import { formatNotification } from './format';

const OPT_IN_KEY = 'sre.desktopNotif';

export function desktopSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function desktopPermission(): NotificationPermission {
  return desktopSupported() ? Notification.permission : 'denied';
}

export function desktopOptedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(OPT_IN_KEY) === '1' && desktopPermission() === 'granted';
}

export async function enableDesktopNotifications(): Promise<NotificationPermission> {
  if (!desktopSupported()) return 'denied';
  const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (p === 'granted') localStorage.setItem(OPT_IN_KEY, '1');
  return p;
}

export function disableDesktopNotifications(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(OPT_IN_KEY);
}

export function fireDesktopNotification(n: NotificationRow): void {
  if (!desktopOptedIn()) return;
  const f = formatNotification(n);
  try {
    const note = new Notification('SRE Nexus', {
      body: f.title,
      tag: n.id,
      icon: '/favicon.ico',
    });
    note.onclick = () => {
      window.focus();
      window.location.assign(f.href);
      note.close();
    };
  } catch {
    // Some browsers throw when called from non-user-gesture contexts. Silent.
  }
}
