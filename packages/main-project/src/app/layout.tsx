import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster as SonnerToaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OpenMAIC Business - 商业策略研究平台',
  description: 'AI驱动的商业策略学习平台，将文档转化为交互式课程体验',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <SonnerToaster position="top-center" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}