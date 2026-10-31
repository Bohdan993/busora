// Plain module (not 'use client'): read by server and client components
export const NAV_ITEMS = [
  { href: '/', key: 'home' },
  { href: '/routes', key: 'routes' },
  { href: '/schedule', key: 'schedule' },
  { href: '/fares', key: 'fares' },
  { href: '/rules', key: 'rules' },
  { href: '/contacts', key: 'contacts' }
] as const;
