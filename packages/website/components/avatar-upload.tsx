'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Camera, Loader2 } from 'lucide-react';
import { uploadAvatar, updateMe } from '@/lib/api-client';

interface AvatarUploadProps {
  currentAvatar: string | null;
  nickname: string;
  onAvatarChange: (url: string) => void;
  locale: 'zh' | 'en';
}

export default function AvatarUpload({ currentAvatar, nickname, onAvatarChange, locale }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError(locale === 'zh' ? '请选择图片文件' : 'Please select an image file');
      return;
    }

    // 验证文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError(locale === 'zh' ? '图片大小不能超过5MB' : 'Image size cannot exceed 5MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // 上传头像
      const uploadResult = await uploadAvatar(file);
      if (uploadResult.error) {
        setError(uploadResult.error);
        return;
      }

      // 更新用户信息
      const updateResult = await updateMe(undefined, uploadResult.data?.url);
      if (updateResult.error) {
        setError(updateResult.error);
        return;
      }

      // 通知父组件
      if (uploadResult.data?.url) {
        onAvatarChange(uploadResult.data.url);
      }
    } catch (err) {
      setError(locale === 'zh' ? '上传失败' : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      <div
        onClick={handleClick}
        className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-primary transition-colors relative group"
      >
        {currentAvatar ? (
          <Image
            src={currentAvatar}
            alt={nickname || 'Avatar'}
            width={96}
            height={96}
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <span className="text-3xl text-gray-400">{nickname?.[0] || '?'}</span>
          </div>
        )}

        {/* 上传遮罩 */}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <div className="text-red-500 text-sm mt-2 text-center">{error}</div>
      )}
    </div>
  );
}