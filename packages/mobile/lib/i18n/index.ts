/**
 * 移动端国际化支持 — 全局响应式
 *
 * 切换语言后所有使用 useI18n() 的组件自动重新渲染。
 * 用户生成内容（课程名、笔记等）不受影响，只有 UI 固定文案切换。
 */

export type Locale = 'zh-CN' | 'en-US';

export const defaultLocale: Locale = 'zh-CN';

const translations = {
  'zh-CN': {
    // 通用
    common: {
      loading: '加载中...',
      error: '出错了',
      retry: '重试',
      cancel: '取消',
      confirm: '确定',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      back: '返回',
      next: '下一步',
      previous: '上一步',
      done: '完成',
    },
    // 认证
    auth: {
      login: '登录',
      register: '注册',
      email: '邮箱',
      password: '密码',
      nickname: '昵称',
      loginSuccess: '登录成功',
      loginFailed: '登录失败',
      registerSuccess: '注册成功',
      registerFailed: '注册失败',
      logout: '退出登录',
      agreePolicy: '我已阅读并同意用户协议和隐私政策',
      // login.tsx
      welcomeBack: '欢迎回来',
      phoneOrEmail: '手机号 / 邮箱',
      phoneOrEmailPlaceholder: '请输入手机号或邮箱',
      passwordPlaceholder: '请输入密码',
      rememberMe: '记住我',
      forgotPassword: '忘记密码？',
      otherLoginMethods: '其他登录方式',
      noAccount: '还没有账号？',
      signUpNow: '立即注册',
      loginAgreePrefix: '登录即表示同意',
      userAgreement: '《用户服务协议》',
      and: '和',
      privacyPolicy: '《隐私政策》',
      errorEmptyFields: '请输入手机号/邮箱和密码',
      errorCheckCredentials: '请检查账号和密码',
      // register.tsx
      createAccount: '创建账号',
      emailPlaceholder: '请输入邮箱地址',
      nicknamePlaceholder: '给自己取一个名字',
      passwordRequirement: '至少8位，包含字母和数字',
      confirmPassword: '确认密码',
      confirmPasswordPlaceholder: '再次输入密码',
      otherRegisterMethods: '其他注册方式',
      hasAccount: '已有账号？',
      loginNow: '立即登录',
      errorEmptyEmailPassword: '请输入邮箱和密码',
      errorPasswordMinLength: '密码至少需要 8 位字符',
      errorPasswordComplexity: '密码需包含字母和数字',
      errorPasswordMismatch: '两次密码输入不一致',
      errorAgreePolicy: '请先同意用户协议和隐私政策',
      registerFailedRetry: '注册失败，请稍后重试',
      pwdWeak: '弱',
      pwdMedium: '中等',
      pwdStrong: '强',
      passwordStrength: '密码强度：{strength}',
      // hero
      heroMain: '为己而学',
      heroSub: '为人而行',
      heroCaption: '为自我成长而学习\n为他人福祉而行动',
      registerHeroCaption: '开启你的学习旅程\n与千万学伴共同成长',
    },
    // 课程
    classroom: {
      title: '我的课程',
      create: '创建课程',
      detail: '课程详情',
      delete: '删除课程',
      noClassrooms: '暂无课程',
      loadingScene: '加载场景...',
      sceneProgress: '场景 {current} / {total}',
      generating: '生成中...',
      searchPlaceholder: '搜索课程...',
      noResults: '未找到匹配的课程',
    },
    // 笔记
    note: {
      title: '我的笔记',
      create: '新建笔记',
      delete: '删除笔记',
      empty: '暂无笔记',
      searchPlaceholder: '搜索笔记...',
    },
    // 个人资料
    profile: {
      edit: '编辑资料',
      settings: '设置',
      language: '语言',
      logout: '退出登录',
      logoutConfirm: '确定要退出当前账号吗？',
      logoutTwice: '退出登录后需要重新登录才能使用',
      logoutConfirmExit: '确认退出',
      logoutStep1: '退出',
      deleteAccount: '注销账户',
      deleteAccountConfirm: '注销后所有数据将被永久删除，无法恢复。',
      deleteFinal: '这是最后一次确认，注销后无法撤销',
      deletePermanently: '永久注销',
      deleteContinue: '继续',
      changePassword: '修改密码',
      changePasswordConfirm: '确定要修改登录密码吗？',
      oldPassword: '当前密码',
      newPassword: '新密码（至少6位）',
      confirmPassword: '确认新密码',
      passwordMinLength: '新密码至少6位',
      passwordMismatch: '两次输入的新密码不一致',
      passwordChanged: '密码修改成功',
      allFieldsRequired: '请填写所有密码字段',
      nickname: '昵称',
      nicknamePlaceholder: '输入昵称',
      bio: '简介',
      bioPlaceholder: '介绍一下自己...',
      birthday: '生日',
      birthdayPlaceholder: '选择日期',
      birthdayInvalid: '生日格式不正确，请输入 YYYY-MM-DD',
      birthdayInvalidDate: '生日日期无效',
      gender: '性别',
      genderMale: '男',
      genderFemale: '女',
      genderOther: '其他',
      interests: '学习兴趣',
      socialLinks: '社交账号',
      wechat: '微信号',
      weibo: '微博账号',
      github: 'GitHub 用户名',
      linkedin: 'LinkedIn 链接',
      privacySettings: '隐私设置',
      showProgress: '公开学习进度',
      showProgressDesc: '其他用户可以看到你的学习进度',
      showSocial: '展示社交账号',
      showSocialDesc: '在个人主页显示绑定的社交账号',
      allowMessage: '接收陌生人消息',
      allowMessageDesc: '允许未关注的人发送私信',
      changeAvatar: '点击更换头像',
      changeAvatarSoon: '头像更换功能即将上线',
      saving: '保存中...',
      hasChanges: '有修改',
      me: '我',
      passwordShort: '密码',
      deleteShort: '注销',
      confirmChange: '确认修改',
      // profile.tsx 新增
      loadFailed: '加载资料失败，请下拉重试',
      loadingProfile: '加载资料...',
      retry: '重新加载',
      learner: '学习者',
      bioDefault: '全栈学习ing · 数据分析方向',
      streakDays: '连续天数',
      allCourses: '全部课程',
      studyHours: '学习时长',
      weeklyStudy: '本周学习',
      studyDuration: '学习时长',
      weeklyTotal: '本周累计',
      achievements: '成就徽章',
      editProfile: '编辑资料',
      notificationSettings: '通知设置',
      learningPreferences: '学习偏好',
      darkMode: '深色模式',
      helpAndFeedback: '帮助与反馈',
      darkModeEnabled: '深色模式已开启',
      darkModeDisabled: '深色模式已关闭',
      comingSoon: '即将上线',
      languageSettings: '语言设置',
      notifCourse: '课程更新',
      notifAchievement: '成就解锁',
      notifBuddy: '搭子消息',
      notifSystem: '系统通知',
      dailyGoal: '每日学习目标(分钟)',
      reminderTime: '学习提醒时间',
      prefSaved: '已保存',
      beginner: '初学者',
    },
    // 设置
    settings: {
      language: '语言设置',
    },
    // 底部导航
    tabs: {
      home: '首页',
      courses: '课程',
      questions: '题库',
      profile: '我的',
    },
    // 错误
    errors: {
      networkError: '网络连接失败',
      timeoutError: '请求超时',
      serverError: '服务器错误',
      unauthorized: '登录已过期，请重新登录',
      forbidden: '没有权限执行此操作',
      notFound: '请求的资源不存在',
      tooManyRequests: '操作过于频繁，请稍后再试',
    },
  },
  'en-US': {
    common: {
      loading: 'Loading...',
      error: 'Error',
      retry: 'Retry',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      done: 'Done',
    },
    auth: {
      login: 'Login',
      register: 'Register',
      email: 'Email',
      password: 'Password',
      nickname: 'Nickname',
      loginSuccess: 'Login successful',
      loginFailed: 'Login failed',
      registerSuccess: 'Registration successful',
      registerFailed: 'Registration failed',
      logout: 'Log Out',
      agreePolicy: 'I have read and agree to the User Agreement and Privacy Policy',
      // login.tsx
      welcomeBack: 'Welcome Back',
      phoneOrEmail: 'Phone / Email',
      phoneOrEmailPlaceholder: 'Enter phone number or email',
      passwordPlaceholder: 'Enter password',
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      otherLoginMethods: 'Other login methods',
      noAccount: "Don't have an account?",
      signUpNow: 'Sign up now',
      loginAgreePrefix: 'By logging in you agree to the',
      userAgreement: 'User Agreement',
      and: 'and',
      privacyPolicy: 'Privacy Policy',
      errorEmptyFields: 'Please enter phone/email and password',
      errorCheckCredentials: 'Please check your credentials',
      // register.tsx
      createAccount: 'Create Account',
      emailPlaceholder: 'Enter email address',
      nicknamePlaceholder: 'Choose a nickname',
      passwordRequirement: 'At least 8 chars, with letters and numbers',
      confirmPassword: 'Confirm Password',
      confirmPasswordPlaceholder: 'Re-enter password',
      otherRegisterMethods: 'Other registration methods',
      hasAccount: 'Already have an account?',
      loginNow: 'Log in now',
      errorEmptyEmailPassword: 'Please enter email and password',
      errorPasswordMinLength: 'Password must be at least 8 characters',
      errorPasswordComplexity: 'Password must contain both letters and numbers',
      errorPasswordMismatch: 'Passwords do not match',
      errorAgreePolicy: 'Please agree to the User Agreement and Privacy Policy first',
      registerFailedRetry: 'Registration failed, please try again later',
      pwdWeak: 'Weak',
      pwdMedium: 'Medium',
      pwdStrong: 'Strong',
      passwordStrength: 'Password strength: {strength}',
      // hero
      heroMain: 'Learn for Self',
      heroSub: 'Act for Others',
      heroCaption: 'Learn for personal growth\nAct for the well-being of others',
      registerHeroCaption: 'Start your learning journey\nGrow with millions of study partners',
    },
    classroom: {
      title: 'My Courses',
      create: 'Create Course',
      detail: 'Course Details',
      delete: 'Delete Course',
      noClassrooms: 'No courses yet',
      loadingScene: 'Loading scene...',
      sceneProgress: 'Scene {current} / {total}',
      generating: 'Generating...',
      searchPlaceholder: 'Search courses...',
      noResults: 'No matching courses found',
    },
    note: {
      title: 'My Notes',
      create: 'New Note',
      delete: 'Delete Note',
      empty: 'No notes yet',
      searchPlaceholder: 'Search notes...',
    },
    profile: {
      edit: 'Edit Profile',
      settings: 'Settings',
      language: 'Language',
      logout: 'Log Out',
      logoutConfirm: 'Are you sure you want to log out?',
      logoutTwice: 'You will need to log in again after signing out',
      logoutConfirmExit: 'Confirm',
      logoutStep1: 'Log Out',
      deleteAccount: 'Delete Account',
      deleteAccountConfirm: 'All data will be permanently deleted and cannot be recovered.',
      deleteFinal: 'This is the final confirmation. Deletion is irreversible.',
      deletePermanently: 'Delete Permanently',
      deleteContinue: 'Continue',
      changePassword: 'Change Password',
      changePasswordConfirm: 'Are you sure you want to change your password?',
      oldPassword: 'Current Password',
      newPassword: 'New Password (min 6 chars)',
      confirmPassword: 'Confirm New Password',
      passwordMinLength: 'Password must be at least 6 characters',
      passwordMismatch: 'New passwords do not match',
      passwordChanged: 'Password changed successfully',
      allFieldsRequired: 'All password fields are required',
      nickname: 'Nickname',
      nicknamePlaceholder: 'Enter nickname',
      bio: 'Bio',
      bioPlaceholder: 'Tell us about yourself...',
      birthday: 'Birthday',
      birthdayPlaceholder: 'Select date',
      birthdayInvalid: 'Invalid date format, use YYYY-MM-DD',
      birthdayInvalidDate: 'Invalid date',
      gender: 'Gender',
      genderMale: 'Male',
      genderFemale: 'Female',
      genderOther: 'Other',
      interests: 'Learning Interests',
      socialLinks: 'Social Links',
      wechat: 'WeChat ID',
      weibo: 'Weibo Account',
      github: 'GitHub Username',
      linkedin: 'LinkedIn URL',
      privacySettings: 'Privacy Settings',
      showProgress: 'Show Learning Progress',
      showProgressDesc: 'Other users can see your learning progress',
      showSocial: 'Show Social Links',
      showSocialDesc: 'Display linked social accounts on your profile',
      allowMessage: 'Allow Messages from Strangers',
      allowMessageDesc: 'Allow people you don\'t follow to send you messages',
      changeAvatar: 'Tap to change avatar',
      changeAvatarSoon: 'Avatar change coming soon',
      saving: 'Saving...',
      hasChanges: 'Modified',
      me: 'Me',
      passwordShort: 'Password',
      deleteShort: 'Delete',
      confirmChange: 'Confirm',
      // profile.tsx additions
      loadFailed: 'Failed to load profile, pull down to retry',
      loadingProfile: 'Loading profile...',
      retry: 'Retry',
      learner: 'Learner',
      bioDefault: 'Full-stack learning · Data Analysis',
      streakDays: 'Day Streak',
      allCourses: 'All Courses',
      studyHours: 'Study Hours',
      weeklyStudy: 'This Week',
      studyDuration: 'Study Duration',
      weeklyTotal: 'Weekly Total',
      achievements: 'Achievements',
      editProfile: 'Edit Profile',
      notificationSettings: 'Notifications',
      learningPreferences: 'Preferences',
      darkMode: 'Dark Mode',
      helpAndFeedback: 'Help & Feedback',
      darkModeEnabled: 'Dark mode enabled',
      darkModeDisabled: 'Dark mode disabled',
      comingSoon: 'Coming Soon',
      languageSettings: 'Language Settings',
      notifCourse: 'Course Updates',
      notifAchievement: 'Achievement Unlocked',
      notifBuddy: 'Buddy Messages',
      notifSystem: 'System Notifications',
      dailyGoal: 'Daily Study Goal (minutes)',
      reminderTime: 'Study Reminder Time',
      prefSaved: 'Saved',
      beginner: 'Beginner',
    },
    settings: {
      language: 'Language',
    },
    tabs: {
      home: 'Home',
      courses: 'Courses',
      questions: 'Questions',
      profile: 'Me',
    },
    errors: {
      networkError: 'Network connection failed',
      timeoutError: 'Request timed out',
      serverError: 'Server error',
      unauthorized: 'Session expired, please log in again',
      forbidden: 'You do not have permission',
      notFound: 'Resource not found',
      tooManyRequests: 'Too many requests, please try again later',
    },
  },
};

class I18n {
  private locale: Locale = defaultLocale;
  private listeners: Set<() => void> = new Set();

  setLocale(locale: Locale) {
    this.locale = locale;
    this.listeners.forEach(fn => fn());
  }

  getLocale(): Locale {
    return this.locale;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: unknown = translations[this.locale];

    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k];
    }

    if (typeof value !== 'string') {
      let fallbackValue: unknown = translations[defaultLocale];
      for (const k of keys) {
        fallbackValue = (fallbackValue as Record<string, unknown>)?.[k];
      }
      value = fallbackValue;
    }

    if (typeof value !== 'string') {
      return key;
    }

    if (params) {
      let result = value;
      for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(`{${paramKey}}`, String(paramValue));
      }
      return result;
    }

    return value;
  }

  getAvailableLocales(): { code: Locale; name: string }[] {
    return [
      { code: 'zh-CN', name: '简体中文' },
      { code: 'en-US', name: 'English (US)' },
    ];
  }
}

export const i18n = new I18n();

// ============ React Hook — 全局响应式 ============
import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

const LOCALE_KEY = 'locale';

export function useI18n() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    // 启动时加载持久化的 locale
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(LOCALE_KEY);
        if (saved === 'zh-CN' || saved === 'en-US') {
          i18n.setLocale(saved);
        }
      } catch {}
    })();

    // 订阅 locale 变更 → 强制重渲染
    const unsub = i18n.subscribe(() => forceUpdate(n => n + 1));
    return unsub;
  }, []);

  const setLocale = useCallback(async (newLocale: Locale) => {
    i18n.setLocale(newLocale);
    try {
      await SecureStore.setItemAsync(LOCALE_KEY, newLocale);
    } catch {}
  }, []);

  return {
    t: i18n.t.bind(i18n),
    locale: i18n.getLocale(),
    setLocale,
    availableLocales: i18n.getAvailableLocales(),
  };
}
