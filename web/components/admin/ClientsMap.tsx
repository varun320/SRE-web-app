'use client';

import { useEffect, useRef } from 'react';
import type { ClientRow } from '@/lib/clients';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

declare global {
  interface Window { L?: any }
}

function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.L) return Promise.resolve(window.L);
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function ClientsMap({ clients }: { clients: ClientRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        worldCopyJump: false,
        maxBounds: [[-85, -180], [85, 180]],
        maxBoundsViscosity: 1,
        minZoom: 2,
      }).setView([25, 45], 2);
      mapRef.current = map;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19,
        noWrap: true,
        bounds: [[-85.0511, -180], [85.0511, 180]],
      }).addTo(map);

      const points: [number, number][] = [];
      for (const c of clients) {
        if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
        const link = c.sharepointUrl
          ? `<a href="${escapeHtml(c.sharepointUrl)}" target="_blank" rel="noopener noreferrer">Open SharePoint →</a>`
          : '';
        const loc = c.location ? `<div style="color:#666;font-size:12px">${escapeHtml(c.location)}</div>` : '';
        L.marker([c.lat, c.lng])
          .addTo(map)
          .bindPopup(`<div><strong>${escapeHtml(c.name)}</strong>${loc}${link ? `<div style="margin-top:6px">${link}</div>` : ''}</div>`);
        points.push([c.lat, c.lng]);
      }
      if (points.length > 1) map.fitBounds(points, { padding: [40, 40] });
      else if (points.length === 1) map.setView(points[0], 5);
    }).catch(() => { /* offline / CDN blocked; container stays empty */ });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [clients]);

  return <div ref={containerRef} className="w-full h-[70vh] rounded-lg border border-border overflow-hidden relative z-0 isolate" />;
}
