/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 关键：生成静态文件
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;