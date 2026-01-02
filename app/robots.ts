import type { MetadataRoute } from 'next'
import { getAppUrl } from '@/lib/app-url'

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/admin/login', '/api/admin', '/api/admin/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}


