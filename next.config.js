function supabaseImageRemotePatterns() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return []
  let url
  try {
    url = new URL(raw)
  } catch {
    return []
  }
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return []
  return [
    {
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
    },
  ]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['undici', 'cheerio', 'pg'],
    // Force Next.js to include these files in the serverless function bundle.
    // Required because we read them at runtime via fs.readFile (tracer can't see dynamic reads).
    outputFileTracingIncludes: {
      '/api/agents/[slug]': [
        './agents/**/*.md',
      ],
      '/api/agents/[slug]/prompt': [
        './agents/**/*.md',
      ],
      '/api/agents/[slug]/prompt/export': [
        './agents/**/*.md',
      ],
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native$': 'react-native-web',
    }
    return config
  },
  images: {
    remotePatterns: supabaseImageRemotePatterns(),
  },
}

module.exports = nextConfig
