/** @type {import('next').NextConfig} */
const nextConfig = {
  // 服务器配置
  experimental: {
    // 启用服务器端工具
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
  // 环境变量
  env: {
    PORT: process.env.PORT || '3030',
  },
  
  // 输出配置
  output: 'standalone',
}

export default nextConfig
