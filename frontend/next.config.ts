import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 使用静态导出模式，构建时生成 frontend/out 目录
  output: 'export',
  // 可选：自定义 .next 临时目录（不影响导出到 out）
  distDir: 'assets',
  // 静态导出下禁用 Image 优化，避免默认 loader 报错
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://127.0.0.1:8000/api/:path*' },
      { source: '/video-hls/:path*', destination: 'http://127.0.0.1:8000/video-hls/:path*' },
      { source: '/music-hls/:path*', destination: 'http://127.0.0.1:8000/music-hls/:path*' },
      { source: '/video-upload/:path*', destination: 'http://127.0.0.1:8000/video-upload/:path*' },
      { source: '/music-upload/:path*', destination: 'http://127.0.0.1:8000/music-upload/:path*' },
      { source: '/ws/:path*', destination: 'http://127.0.0.1:8000/ws/:path*' },
    ]
  },
}

export default nextConfig;
