import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '狼人杀 App',
  description: '狼人杀创建房间、经典板子与自选角色 MVP'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
