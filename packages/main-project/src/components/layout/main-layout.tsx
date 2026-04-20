'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  const { user } = useAuth();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const navItems = [
    { href: '/', label: '首页', icon: '🏠' },
    { href: '/classrooms', label: '课程', icon: '📚' },
    { href: '/questions', label: '问答', icon: '💬' },
    { href: '/enterprise', label: '企业', icon: '🏢' },
    { href: '/payment', label: '充值', icon: '💎' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - 渐变背景 */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <Image
                src="/ceban.png"
                alt="侧伴"
                width={40}
                height={40}
                className="rounded-xl"
              />
              <div>
                <h1 className="text-xl font-bold">侧伴</h1>
                <p className="text-xs text-white/70 hidden sm:block">AI互动课堂</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-4 py-2 rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* User Info */}
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full px-4 py-2 text-sm backdrop-blur hidden sm:block">
                {user?.nickname || user?.email?.split('@')[0]}
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 rounded-lg hover:bg-white/20"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
              >
                {showMobileMenu ? '✕' : '☰'}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {showMobileMenu && (
            <nav className="md:hidden mt-4 pb-2 border-t border-white/20 pt-4 animate-slide-in">
              <div className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-4 py-3 rounded-lg hover:bg-white/20 transition-colors flex items-center gap-3"
                    onClick={() => setShowMobileMenu(false)}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </nav>
          )}
        </div>

        {/* Page Title Bar */}
        {title && (
          <div className="container mx-auto px-4 pb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {title}
            </h2>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="animate-fade-in">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src="/ceban.png"
                  alt="侧伴"
                  width={24}
                  height={24}
                  className="rounded"
                />
                <span className="font-bold">侧伴</span>
              </div>
              <p className="text-gray-400 text-sm">
                AI多智能体互动课堂，让学习不再孤单
              </p>
            </div>

            {/* Links */}
            <div>
              <h3 className="font-semibold mb-3">功能</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/classrooms" className="hover:text-white">课程生成</Link></li>
                <li><Link href="/questions" className="hover:text-white">问答悬赏</Link></li>
                <li><Link href="/enterprise" className="hover:text-white">企业学习</Link></li>
                <li><Link href="/payment" className="hover:text-white">Token充值</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="font-semibold mb-3">资源</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">API文档</a></li>
                <li><a href="#" className="hover:text-white">使用指南</a></li>
                <li><a href="#" className="hover:text-white">常见问题</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="font-semibold mb-3">联系我们</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>📧 support@openmaic.com</li>
                <li>📱 微信公众号: OpenMAIC</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 mt-8 pt-4 text-center text-gray-400 text-sm">
            © 2026 侧伴. v0.23.0
          </div>
        </div>
      </footer>
    </div>
  );
}