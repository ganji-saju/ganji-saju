import type { MetadataRoute } from 'next';
import { DEFAULT_DESCRIPTION, SITE_NAME } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ff4f9a',
    icons: [
      {
        src: '/globe.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
