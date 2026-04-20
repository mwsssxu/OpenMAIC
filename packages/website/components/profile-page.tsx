'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Locale, TranslationKeys } from '@/lib/i18n';
import { getMe, updateMe, changePassword, clearToken, getToken } from '@/lib/api-client';
import { User, Lock, Rocket, LogOut, Loader2, Eye, EyeOff, Check, Edit2 } from 'lucide-react';
import AvatarUpload from './avatar-upload';

const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:3031';

interface ProfilePageProps {
  locale: Locale;
  t: Record<TranslationKeys, string>;
}

export default function ProfilePage({ locale, t }: ProfilePageProps) {
  const router = useRouter();
  const [user, setUser] = useState<{
    id: string;
    email: string;
    nickname: string;
    avatar_url: string | null;
    created_at: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // 昵称修改
  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [nicknameLoading, setNicknameLoading] = useState(false);
  const [nicknameSuccess, setNicknameSuccess] = useState(false);

  // 密码修改
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    // 检查登录状态
    const token = getToken();
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    // 加载用户信息
    loadUser();
  }, [locale, router]);

  const loadUser = async () => {
    setLoading(true);
    const result = await getMe();
    if (result.data) {
      setUser(result.data);
      setNewNickname(result.data.nickname);
    } else {
      // 获取失败，可能 token 过期
      clearToken();
      router.push(`/${locale}/login`);
    }
    setLoading(false);
  };

  const handleAvatarChange = (url: string) => {
    if (user) {
      setUser({ ...user, avatar_url: url });
    }
  };

  const handleNicknameSave = async () => {
    if (!newNickname.trim() || newNickname === user?.nickname) {
      setEditingNickname(false);
      return;
    }

    setNicknameLoading(true);
    const result = await updateMe(newNickname.trim());
    if (result.data) {
      setUser(result.data);
      setNicknameSuccess(true);
      setTimeout(() => setNicknameSuccess(false), 2000);
    }
    setNicknameLoading(false);
    setEditingNickname(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    // 验证
    if (newPassword !== confirmPassword) {
      setPasswordError(t['profile.password.mismatch']);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(locale === 'zh' ? '密码至少6位' : 'Password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);
    const result = await changePassword(oldPassword, newPassword);
    setPasswordLoading(false);

    if (result.error) {
      setPasswordError(result.error);
    } else {
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  };

  const handleLogout = () => {
    clearToken();
    router.push(`/${locale}`);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-blue-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen py-20 px-4 bg-gradient-to-b from-white to-blue-50 animate-fadeIn">
      <div className="max-w-md mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <User className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t['profile.title']}</h1>
        </div>

        {/* 用户信息卡片 */}
        <div className="card mb-6">
          <div className="flex items-start gap-6">
            {/* 头像 */}
            <AvatarUpload
              currentAvatar={user.avatar_url}
              nickname={user.nickname}
              onAvatarChange={handleAvatarChange}
              locale={locale}
            />

            {/* 信息 */}
            <div className="flex-1">
              {/* 昵称 */}
              <div className="mb-3">
                {editingNickname ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                      className="input flex-1"
                      autoFocus
                    />
                    <button
                      onClick={handleNicknameSave}
                      disabled={nicknameLoading}
                      className="btn-primary text-sm px-3 py-1"
                    >
                      {nicknameLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{user.nickname}</span>
                    {nicknameSuccess && (
                      <Check className="w-4 h-4 text-success" />
                    )}
                    <button
                      onClick={() => setEditingNickname(true)}
                      className="text-gray-400 hover:text-primary"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* 邮箱 */}
              <div className="text-sm text-gray-600 mb-2">{user.email}</div>

              {/* 注册时间 */}
              <div className="text-sm text-gray-400">
                {t['profile.registered']}: {formatDate(user.created_at)}
              </div>
            </div>
          </div>
        </div>

        {/* 修改密码 */}
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            {t['profile.password.title']}
          </h2>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t['profile.password.old']}
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t['profile.password.new']}
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t['profile.password.confirm']}
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {passwordError && (
              <div className="text-red-500 text-sm">{passwordError}</div>
            )}

            {passwordSuccess && (
              <div className="text-success text-sm flex items-center gap-1">
                <Check className="w-4 h-4" />
                {t['profile.password.success']}
              </div>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="btn-primary w-full"
            >
              {passwordLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                t['profile.password.submit']
              )}
            </button>
          </form>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-4">
          <a
            href={MAIN_APP_URL}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Rocket className="w-5 h-5" />
            {t['profile.enterApp']}
          </a>
          <button
            onClick={handleLogout}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            {t['profile.logout']}
          </button>
        </div>
      </div>
    </div>
  );
}