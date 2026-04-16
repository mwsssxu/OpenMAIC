/**
 * 移动端国际化支持
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
    },
    // 课程
    classroom: {
      title: '我的课程',
      create: '创建课程',
      delete: '删除课程',
      noClassrooms: '暂无课程',
      loadingScene: '加载场景...',
      sceneProgress: '场景 {current} / {total}',
      generating: '生成中...',
    },
    // 白板
    whiteboard: {
      title: '互动白板',
      open: '打开白板',
      close: '关闭白板',
      clear: '清空',
      draw: '绘制',
      text: '文字',
      shape: '形状',
      color: '颜色',
      strokeWidth: '笔触宽度',
      undo: '撤销',
      redo: '重做',
      history: '历史',
    },
    // 激光笔/聚光灯
    pointer: {
      laser: '激光笔',
      spotlight: '聚光灯',
      enable: '启用',
      disable: '关闭',
      followTouch: '跟随触摸',
    },
    // 测验
    quiz: {
      title: '随堂测验',
      start: '开始答题',
      submit: '提交答案',
      correct: '正确',
      incorrect: '错误',
      score: '得分',
      analysis: '解析',
      singleChoice: '单选题',
      multipleChoice: '多选题',
      shortAnswer: '简答题',
      aiGrading: 'AI 正在批改...',
      retry: '重新答题',
      nextQuestion: '下一题',
      prevQuestion: '上一题',
    },
    // Agent
    agent: {
      teacher: '教师',
      assistant: '助教',
      student: '学生',
      thinking: '思考中...',
      speaking: '正在讲解',
      askQuestion: '提问',
      voiceInput: '语音输入',
      textInput: '文字输入',
    },
    // 聊天
    chat: {
      placeholder: '输入消息...',
      send: '发送',
      recording: '录音中...',
      stopRecording: '停止录音',
      listening: '正在聆听...',
    },
    // 导航
    navigation: {
      swipeLeft: '左滑下一页',
      swipeRight: '右滑上一页',
      pinchZoom: '双指缩放',
      doubleTap: '双击全屏',
    },
    // 成就
    achievement: {
      earned: '已获得',
      progress: '进度',
      points: '积分',
      newAchievement: '恭喜获得新成就！',
    },
    // 打卡
    checkin: {
      today: '今日打卡',
      streak: '连续 {days} 天',
      alreadyChecked: '今日已打卡',
      checkinSuccess: '打卡成功！',
    },
    // 发现
    discover: {
      title: '发现',
      popular: '热门课程',
      recent: '最新分享',
      likes: '{count} 人喜欢',
      views: '{count} 次浏览',
    },
    // 个人
    profile: {
      title: '我的',
      settings: '设置',
      language: '语言',
      about: '关于',
      exportData: '导出数据',
      deleteAccount: '注销账号',
      statistics: '学习统计',
    },
    // 设置
    settings: {
      language: '语言设置',
      theme: '主题',
      notifications: '通知',
      autoPlay: '自动播放',
      playbackSpeed: '播放速度',
    },
    // 错误消息
    errors: {
      networkError: '网络连接失败',
      serverError: '服务器错误',
      unauthorized: '请先登录',
      forbidden: '无权限访问',
      notFound: '未找到内容',
      validationError: '输入有误',
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
      logout: 'Logout',
      agreePolicy: 'I agree to the User Agreement and Privacy Policy',
    },
    classroom: {
      title: 'My Classrooms',
      create: 'Create Classroom',
      delete: 'Delete Classroom',
      noClassrooms: 'No classrooms',
      loadingScene: 'Loading scene...',
      sceneProgress: 'Scene {current} / {total}',
      generating: 'Generating...',
    },
    whiteboard: {
      title: 'Interactive Whiteboard',
      open: 'Open Whiteboard',
      close: 'Close Whiteboard',
      clear: 'Clear',
      draw: 'Draw',
      text: 'Text',
      shape: 'Shape',
      color: 'Color',
      strokeWidth: 'Stroke Width',
      undo: 'Undo',
      redo: 'Redo',
      history: 'History',
    },
    pointer: {
      laser: 'Laser Pointer',
      spotlight: 'Spotlight',
      enable: 'Enable',
      disable: 'Disable',
      followTouch: 'Follow Touch',
    },
    quiz: {
      title: 'Quiz',
      start: 'Start Quiz',
      submit: 'Submit Answers',
      correct: 'Correct',
      incorrect: 'Incorrect',
      score: 'Score',
      analysis: 'Analysis',
      singleChoice: 'Single Choice',
      multipleChoice: 'Multiple Choice',
      shortAnswer: 'Short Answer',
      aiGrading: 'AI is grading...',
      retry: 'Retry',
      nextQuestion: 'Next',
      prevQuestion: 'Previous',
    },
    agent: {
      teacher: 'Teacher',
      assistant: 'Assistant',
      student: 'Student',
      thinking: 'Thinking...',
      speaking: 'Speaking',
      askQuestion: 'Ask a question',
      voiceInput: 'Voice Input',
      textInput: 'Text Input',
    },
    chat: {
      placeholder: 'Type a message...',
      send: 'Send',
      recording: 'Recording...',
      stopRecording: 'Stop Recording',
      listening: 'Listening...',
    },
    navigation: {
      swipeLeft: 'Swipe left for next',
      swipeRight: 'Swipe right for previous',
      pinchZoom: 'Pinch to zoom',
      doubleTap: 'Double tap for fullscreen',
    },
    achievement: {
      earned: 'Earned',
      progress: 'Progress',
      points: 'Points',
      newAchievement: 'New achievement unlocked!',
    },
    checkin: {
      today: 'Today\'s Check-in',
      streak: '{days} day streak',
      alreadyChecked: 'Already checked in today',
      checkinSuccess: 'Check-in successful!',
    },
    discover: {
      title: 'Discover',
      popular: 'Popular',
      recent: 'Recent',
      likes: '{count} likes',
      views: '{count} views',
    },
    profile: {
      title: 'Me',
      settings: 'Settings',
      language: 'Language',
      about: 'About',
      exportData: 'Export Data',
      deleteAccount: 'Delete Account',
      statistics: 'Statistics',
    },
    settings: {
      language: 'Language',
      theme: 'Theme',
      notifications: 'Notifications',
      autoPlay: 'Auto-play',
      playbackSpeed: 'Playback Speed',
    },
    errors: {
      networkError: 'Network connection failed',
      serverError: 'Server error',
      unauthorized: 'Please login first',
      forbidden: 'Access denied',
      notFound: 'Not found',
      validationError: 'Invalid input',
    },
  },
};

class I18n {
  private locale: Locale = defaultLocale;

  setLocale(locale: Locale) {
    this.locale = locale;
  }

  getLocale(): Locale {
    return this.locale;
  }

  /**
   * 获取翻译文本
   * @param key - 翻译键，如 'common.loading'
   * @param params - 可选参数，用于替换 {xxx}
   */
  t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: unknown = translations[this.locale];

    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k];
    }

    if (typeof value !== 'string') {
      // 尝试获取默认语言的翻译
      let fallbackValue: unknown = translations[defaultLocale];
      for (const k of keys) {
        fallbackValue = (fallbackValue as Record<string, unknown>)?.[k];
      }
      value = fallbackValue;
    }

    if (typeof value !== 'string') {
      return key;
    }

    // 替换参数
    if (params) {
      let result = value;
      for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(`{${paramKey}}`, String(paramValue));
      }
      return result;
    }

    return value;
  }

  /**
   * 获取所有可用语言
   */
  getAvailableLocales(): { code: Locale; name: string }[] {
    return [
      { code: 'zh-CN', name: '简体中文' },
      { code: 'en-US', name: 'English (US)' },
    ];
  }
}

export const i18n = new I18n();

// React Hook
import { useState, useEffect } from 'react';
import * as AsyncStorage from 'expo-secure-store';

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    loadSavedLocale();
  }, []);

  const loadSavedLocale = async () => {
    try {
      const saved = await AsyncStorage.getItemAsync('locale');
      if (saved === 'zh-CN' || saved === 'en-US') {
        i18n.setLocale(saved);
        setLocaleState(saved);
      }
    } catch {
      // AsyncStorage unavailable
    }
  };

  const setLocale = async (newLocale: Locale) => {
    i18n.setLocale(newLocale);
    setLocaleState(newLocale);
    try {
      await AsyncStorage.setItemAsync('locale', newLocale);
    } catch {
      // AsyncStorage unavailable
    }
  };

  return {
    t: i18n.t.bind(i18n),
    locale,
    setLocale,
    availableLocales: i18n.getAvailableLocales(),
  };
}