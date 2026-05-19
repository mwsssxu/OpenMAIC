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
      searchPlaceholder: '搜索课程...',
      noResults: '未找到匹配的课程',
      searchHint: '尝试其他关键词',
      // 新增iOS风格页面的翻译
      all: '全部',
      inProgress: '学习中',
      completed: '已完成',
      notStarted: '未开始',
      recentCourses: '近期课程',
      recommendedCourses: '推荐课程',
      courseCatalog: '课程目录',
      courseIntro: '课程简介',
      expandAll: '展开全部',
      collapse: '收起',
      continueLearning: '继续学习',
      download: '下载',
      share: '分享',
      totalLessons: '共 {count} 节',
      lessons: '课时',
      totalDuration: '总时长',
      difficulty: '难度',
      students: '学员',
      rating: '评分',
      current: '当前',
      slide: '幻灯片',
      quiz: '测验',
      interactive: '互动',
      scene: '场景',
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
      swipeHint: '左右滑动切换题目',
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
    // 课程完成
    classroomComplete: {
      title: '课程完成',
      trailLabels: {
        slide: '页',
        quiz: '小测',
        interactive: '互动',
        pbl: '项目',
      },
      quizScoreLabel: '答对 {{correct}} / {{total}}',
      encouragement: {
        high: '太棒了，完美发挥！',
        mid: '表现不错，继续加油！',
        low: '万事开头难，回去再练练吧。',
      },
    },
    // 首页
    home: {
      title: '首页',
      greetingMorning: '早上好',
      greetingAfternoon: '下午好',
      greetingEvening: '晚上好',
      greetingNight: '夜深了',
      streakDays: '天连续学习',
      days: '天',
      courses: '门课程',
      hours: '小时',
      myCourses: '我的课程',
      qaBounty: '问答悬赏',
      sharedNotes: '共享笔记',
      studyBuddy: '学习搭子',
      studyMatching: '学习匹配',
      growthSystem: '成长体系',
      inviteRewards: '邀请奖励',
      recharge: '充值中心',
      wallet: '钱包',
      enterpriseServices: '企业服务',
      allNotes: '全部笔记',
      favorites: '收藏',
      today: '今日',
      quickRecord: '快速记录',
      notes: '我的笔记',
      streak: '连续学习',
      notification: '通知',
      newLessonReminder: '新课提醒',
      startLearning: '开始学习',
      remindLater: '稍后提醒',
    },
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
      // 新增
      languageSettings: '语言设置',
      chinese: '简体中文',
      english: 'English',
      tokenBalance: 'Token余额',
      pointsBalance: '积分余额',
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
    // 课程
    classroom: {
      title: 'My Classrooms',
      create: 'Create Classroom',
      delete: 'Delete Classroom',
      noClassrooms: 'No classrooms',
      loadingScene: 'Loading scene...',
      sceneProgress: 'Scene {current} / {total}',
      generating: 'Generating...',
      searchPlaceholder: 'Search classrooms...',
      noResults: 'No matching classrooms',
      searchHint: 'Try different keywords',
      // iOS-style pages
      all: 'All',
      inProgress: 'In Progress',
      completed: 'Completed',
      notStarted: 'Not Started',
      recentCourses: 'Recent Courses',
      recommendedCourses: 'Recommended',
      courseCatalog: 'Course Catalog',
      courseIntro: 'Introduction',
      expandAll: 'Expand All',
      collapse: 'Collapse',
      continueLearning: 'Continue Learning',
      download: 'Download',
      share: 'Share',
      totalLessons: '{count} lessons',
      lessons: 'Lessons',
      totalDuration: 'Duration',
      difficulty: 'Level',
      students: 'Students',
      rating: 'Rating',
      current: 'Current',
      slide: 'Slide',
      quiz: 'Quiz',
      interactive: 'Interactive',
      scene: 'Scene',
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
      swipeHint: 'Swipe left/right to change question',
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
    classroomComplete: {
      title: 'Course Complete',
      trailLabels: {
        slide: 'Slides',
        quiz: 'Quizzes',
        interactive: 'Interactive',
        pbl: 'Projects',
      },
      quizScoreLabel: '{{correct}} / {{total}} correct',
      encouragement: {
        high: 'Excellent, perfect score!',
        mid: 'Good job, keep it up!',
        low: 'Keep practicing, you\'ll get better!',
      },
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
      // New
      languageSettings: 'Language Settings',
      chinese: 'Chinese',
      english: 'English',
      tokenBalance: 'Token Balance',
      pointsBalance: 'Points Balance',
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