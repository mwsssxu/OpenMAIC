'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Settings,
  History,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { name: '仪表盘', path: '/', icon: LayoutDashboard },
  { name: '管理员管理', path: '/admins', icon: Users },
  { name: '用户管理', path: '/users', icon: Users },
  { name: '内容审核', path: '/content', icon: FileText, children: [
    { name: '问题审核', path: '/content/questions' },
    { name: '回答审核', path: '/content/answers' },
    { name: '笔记审核', path: '/content/notes' },
  ]},
  { name: '数据统计', path: '/statistics', icon: BarChart3, children: [
    { name: '用户统计', path: '/statistics/users' },
    { name: '课程统计', path: '/statistics/classrooms' },
    { name: '经济统计', path: '/statistics/economy' },
  ]},
  { name: '系统配置', path: '/settings', icon: Settings, children: [
    { name: 'LLM配置', path: '/settings/llm' },
    { name: '价格配置', path: '/settings/pricing' },
    { name: '规则配置', path: '/settings/rules' },
  ]},
  { name: '操作日志', path: '/logs', icon: History },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (path: string) => {
    setExpandedItems(prev =>
      prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-blue-600">OpenMAIC Admin</h1>
      </div>

      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedItems.includes(item.path);

          return (
            <div key={item.path}>
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(item.path)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              ) : (
                <Link
                  href={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              )}

              {hasChildren && isExpanded && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.children!.map((child) => (
                    <Link
                      key={child.path}
                      href={child.path}
                      className={`block px-3 py-2 rounded-lg text-sm transition ${
                        pathname === child.path
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 transition"
        >
          <LogOut className="w-5 h-5" />
          退出登录
        </button>
      </div>
    </aside>
  );
}