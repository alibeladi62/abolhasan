import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // آپلود ویدئو تا سقف ۵۰۰MB در پنل (مرحله ۲) — بدنه‌ی server action باید جا شود
  experimental: {
    serverActions: { bodySizeLimit: '512mb' },
  },
};

export default nextConfig;
