// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Snack Dragon',
    short_name: 'Snack Dragon',
    description: 'Calorie counting is for the dogs',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        // This points to the magic file app/icon.png
        // Next.js automatically serves it at /icon
        src: '/icon', 
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}