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
      resetView: '重置视图',
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
      viewDetails: '查看详情',
      notification: '通知',
      newLessonReminder: '新课提醒',
      startLearning: '开始学习',
      remindLater: '稍后提醒',
      recentCourses: '近期课程',
      recommendedCourses: '推荐课程',
      loading: '加载中...',
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
      networkError: '网络连接失败，请检查网络后重试',
      serverError: '服务器暂时不可用，请稍后再试',
      unauthorized: '登录已过期，请重新登录',
      forbidden: '无权限执行此操作',
      notFound: '未找到内容',
      validationError: '输入有误',
      requestFailed: '操作失败，请重试',
      timeoutError: '请求超时，请稍后重试',
      unknownError: '发生未知错误',
    },
    // WebView
    webview: {
      loadingContent: '加载互动内容...',
      noContent: '互动内容',
      noContentHint: '此场景包含互动内容，需要在支持的环境中打开',
      openInBrowser: '在浏览器中打开',
      networkError: '网络连接失败，请检查网络设置',
      timeoutError: '加载超时，请稍后重试',
      serverError: '服务器错误，请稍后重试',
      contentError: '内容解析错误',
    },
    // 无障碍
    accessibility: {
      // TabBar
      tabHome: '首页',
      tabCourses: '课程',
      tabNotes: '笔记',
      tabProfile: '我的',
      tabCreate: '创建新课程',
      // 课程卡片
      courseCard: '课程',
      courseCardHint: '点击查看课程详情，长按可弹出操作菜单',
      courseProgress: '进度 {percent}%',
      courseStatusInProgress: '学习中',
      courseStatusCompleted: '已完成',
      courseStatusNotStarted: '未开始',
      // 测验
      quizQuestion: '第 {num} 题，共 {total} 题',
      quizOption: '选项 {letter}',
      quizOptionSelected: '已选中',
      quizOptionNotSelected: '未选中',
      quizSingleChoice: '单选题',
      quizMultipleChoice: '多选题',
      quizShortAnswer: '简答题',
      quizSubmitHint: '提交后查看得分',
      quizPrevHint: '返回上一题',
      quizNextHint: '前往下一题',
      // 白板
      whiteboardCanvas: '白板画布',
      whiteboardCanvasHint: '双指捏合可缩放画布，单指滑动可绘制，双击重置视图',
      whiteboardZoomIn: '放大',
      whiteboardZoomOut: '缩小',
      whiteboardResetView: '重置视图到原始大小',
      whiteboardUndo: '撤销最后一步绘制',
      whiteboardClear: '清空整个画布',
      whiteboardColorPicker: '选择画笔颜色',
      whiteboardStrokePicker: '选择画笔粗细',
      whiteboardColor: '{color}颜色',
      whiteboardStroke: '{width}像素粗细',
      // 激光笔/聚光灯
      laserPointer: '激光笔',
      laserPointerHint: '点击屏幕放置激光点',
      spotlight: '聚光灯',
      spotlightHint: '双指拖动可移动聚光灯位置',
      spotlightEnable: '启用聚光灯',
      spotlightDisable: '关闭聚光灯',
      // WebView
      interactiveContent: '互动内容',
      interactiveContentHint: '包含交互式学习内容',
      webViewReload: '重新加载内容',
      webViewBack: '返回上一页',
      webViewForward: '前进到下一页',
      webViewOpenBrowser: '在浏览器中打开',
      // 导航
      backButton: '返回',
      backButtonHint: '返回上一页',
      closeButton: '关闭',
      closeButtonHint: '关闭当前页面',
      menuButton: '菜单',
      menuButtonHint: '打开操作菜单',
      // 搜索
      searchButton: '搜索',
      searchButtonHint: '搜索课程或内容',
      // 状态
      loading: '正在加载',
      loadingHint: '请稍候',
      error: '加载失败',
      errorHint: '点击重试',
      empty: '暂无内容',
      // 筛选
      filterAll: '全部',
      filterInProgress: '学习中',
      filterCompleted: '已完成',
      filterNotStarted: '未开始',
      filterHint: '筛选显示{status}的课程',
      // 视图切换
      viewModeList: '列表视图',
      viewModeGrid: '网格视图',
      viewModeHint: '切换为{mode}显示',
      // 图标标签
      backArrowIcon: '返回箭头',
      searchIcon: '搜索图标',
      errorIcon: '错误图标',
      addIcon: '添加图标',
      listIcon: '列表图标',
      gridIcon: '网格图标',
      dropdownIcon: '下拉箭头',
      sceneIcon: '场景图标',
      courseThumbnail: '课程缩略图',
      interactiveBadge: '互动课程标识',
      redDot: '红色圆点',
      lightbulb: '灯泡',
      closeIcon: '关闭',
      loadingDot: '加载指示点',
      checkIcon: '勾选',
      uncheckIcon: '未勾选',
      selectedIcon: '选中',
      unselectedIcon: '未选中',
      codeIcon: '代码图标',
      folderIcon: '空文件夹图标',
      // 通用提示
      currentlySelected: '当前选中',
      tapToSelect: '点击选择',
      tapToEnable: '点击启用',
      tapToClose: '点击关闭',
      enterPage: '点击进入{page}',
      courseProgressLabel: '{name}，{status}，进度{percent}%',
      tapToViewCourse: '点击查看课程详情',
      resetCanvasHint: '恢复画布到原始大小和位置',
      inputAnswerHint: '输入你的答案',
      restartQuizHint: '重新开始答题',
      touchArea: '触摸区域',
      movePointerHint: '触摸移动指针位置',
      pointerTools: '指针模式选择',
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
      resetView: 'Reset View',
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
    home: {
      title: 'Home',
      greetingMorning: 'Good morning',
      greetingAfternoon: 'Good afternoon',
      greetingEvening: 'Good evening',
      greetingNight: 'Night time',
      streakDays: 'day streak',
      days: 'days',
      courses: 'courses',
      hours: 'hours',
      myCourses: 'My Courses',
      qaBounty: 'Q&A Bounty',
      sharedNotes: 'Shared Notes',
      studyBuddy: 'Study Buddy',
      studyMatching: 'Study Matching',
      growthSystem: 'Growth System',
      inviteRewards: 'Invite Rewards',
      recharge: 'Recharge',
      wallet: 'Wallet',
      enterpriseServices: 'Enterprise',
      allNotes: 'All Notes',
      favorites: 'Favorites',
      today: 'Today',
      quickRecord: 'Quick Record',
      notes: 'My Notes',
      streak: 'Streak',
      viewDetails: 'View Details',
      notification: 'Notification',
      newLessonReminder: 'New Lesson',
      startLearning: 'Start',
      remindLater: 'Later',
      loading: 'Loading...',
      recentCourses: 'Recent Courses',
      recommendedCourses: 'Recommended',
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
      networkError: 'Network connection failed. Please check your network and try again.',
      serverError: 'Server is temporarily unavailable. Please try again later.',
      unauthorized: 'Your session has expired. Please login again.',
      forbidden: 'You do not have permission to perform this action.',
      notFound: 'Content not found',
      validationError: 'Invalid input',
      requestFailed: 'Operation failed. Please try again.',
      timeoutError: 'Request timed out. Please try again later.',
      unknownError: 'An unknown error occurred',
    },
    webview: {
      loadingContent: 'Loading interactive content...',
      noContent: 'Interactive Content',
      noContentHint: 'This scene contains interactive content and needs to be opened in a supported environment.',
      openInBrowser: 'Open in Browser',
      networkError: 'Network connection failed. Please check your network settings.',
      timeoutError: 'Loading timeout. Please try again later.',
      serverError: 'Server error. Please try again later.',
      contentError: 'Content parsing error.',
    },
    accessibility: {
      // TabBar
      tabHome: 'Home',
      tabCourses: 'Courses',
      tabNotes: 'Notes',
      tabProfile: 'Me',
      tabCreate: 'Create new course',
      // Course card
      courseCard: 'Course',
      courseCardHint: 'Tap to view course details, long press for options',
      courseProgress: '{percent}% progress',
      courseStatusInProgress: 'In Progress',
      courseStatusCompleted: 'Completed',
      courseStatusNotStarted: 'Not Started',
      // Quiz
      quizQuestion: 'Question {num} of {total}',
      quizOption: 'Option {letter}',
      quizOptionSelected: 'Selected',
      quizOptionNotSelected: 'Not selected',
      quizSingleChoice: 'Single Choice',
      quizMultipleChoice: 'Multiple Choice',
      quizShortAnswer: 'Short Answer',
      quizSubmitHint: 'Submit to view your score',
      quizPrevHint: 'Go to previous question',
      quizNextHint: 'Go to next question',
      // Whiteboard
      whiteboardCanvas: 'Whiteboard canvas',
      whiteboardCanvasHint: 'Pinch to zoom, drag to draw, double tap to reset view',
      whiteboardZoomIn: 'Zoom in',
      whiteboardZoomOut: 'Zoom out',
      whiteboardResetView: 'Reset view to original size',
      whiteboardUndo: 'Undo last stroke',
      whiteboardClear: 'Clear entire canvas',
      whiteboardColorPicker: 'Choose pen color',
      whiteboardStrokePicker: 'Choose pen thickness',
      whiteboardColor: '{color} color',
      whiteboardStroke: '{width} pixel thickness',
      // Laser/Spotlight
      laserPointer: 'Laser pointer',
      laserPointerHint: 'Tap screen to place laser point',
      spotlight: 'Spotlight',
      spotlightHint: 'Drag with two fingers to move spotlight',
      spotlightEnable: 'Enable spotlight',
      spotlightDisable: 'Disable spotlight',
      // WebView
      interactiveContent: 'Interactive content',
      interactiveContentHint: 'Contains interactive learning material',
      webViewReload: 'Reload content',
      webViewBack: 'Go back',
      webViewForward: 'Go forward',
      webViewOpenBrowser: 'Open in browser',
      // Navigation
      backButton: 'Back',
      backButtonHint: 'Go back to previous page',
      closeButton: 'Close',
      closeButtonHint: 'Close current page',
      menuButton: 'Menu',
      menuButtonHint: 'Open action menu',
      // Search
      searchButton: 'Search',
      searchButtonHint: 'Search courses or content',
      // Status
      loading: 'Loading',
      loadingHint: 'Please wait',
      error: 'Failed to load',
      errorHint: 'Tap to retry',
      empty: 'No content',
      // Filter
      filterAll: 'All',
      filterInProgress: 'In Progress',
      filterCompleted: 'Completed',
      filterNotStarted: 'Not Started',
      filterHint: 'Show {status} courses',
      // View mode
      viewModeList: 'List view',
      viewModeGrid: 'Grid view',
      viewModeHint: 'Switch to {mode} view',
      // Icon labels
      backArrowIcon: 'Back arrow',
      searchIcon: 'Search icon',
      errorIcon: 'Error icon',
      addIcon: 'Add icon',
      listIcon: 'List icon',
      gridIcon: 'Grid icon',
      dropdownIcon: 'Dropdown arrow',
      sceneIcon: 'Scene icon',
      courseThumbnail: 'Course thumbnail',
      interactiveBadge: 'Interactive course badge',
      redDot: 'Red dot',
      lightbulb: 'Lightbulb',
      closeIcon: 'Close',
      loadingDot: 'Loading indicator dot',
      checkIcon: 'Checked',
      uncheckIcon: 'Unchecked',
      selectedIcon: 'Selected',
      unselectedIcon: 'Not selected',
      codeIcon: 'Code icon',
      folderIcon: 'Empty folder icon',
      // Common hints
      currentlySelected: 'Currently selected',
      tapToSelect: 'Tap to select',
      tapToEnable: 'Tap to enable',
      tapToClose: 'Tap to close',
      enterPage: 'Tap to enter {page}',
      courseProgressLabel: '{name}, {status}, {percent}% progress',
      tapToViewCourse: 'Tap to view course details',
      resetCanvasHint: 'Reset canvas to original size and position',
      inputAnswerHint: 'Enter your answer',
      restartQuizHint: 'Restart quiz',
      touchArea: 'Touch area',
      movePointerHint: 'Touch to move pointer position',
      pointerTools: 'Pointer mode selection',
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