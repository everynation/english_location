import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://addressline1.com',
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];
}
