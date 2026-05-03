import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '달빛인생',
    short_name: '달빛인생',
    description: '오늘의 운세와 타로부터 사주, 궁합, 띠운세까지 가볍게 확인하는 달빛인생',
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
