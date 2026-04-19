import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// Web端使用localStorage，Mobile端使用SecureStore
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// Types
export interface UserStats {
  total_classrooms: number;
  total_scenes: number;
  total_media_files: number;
  total_chat_sessions: number;
}

export interface ExportedData {
  exported_at: string;
  user: {
    id: string;
    email: string;
    nickname: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
  };
  classrooms: any[];
  scenes: any[];
  media_files: any[];
  oauth_accounts: any[];
  generation_jobs: any[];
}

class ApiClient {
  private client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  private token: string | null = null;

  getBaseUrl(): string {
    return API_BASE_URL;
  }

  constructor() {
    // 自动添加 Authorization header
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Token 过期自动刷新
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token 过期，尝试刷新
          const refreshToken = await storage.getItem('refresh_token');
          if (refreshToken) {
            try {
              const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refresh_token: refreshToken,
              });
              this.setToken(data.access_token);
              await storage.setItem('auth_token', data.access_token);
              // 重试原请求
              error.config.headers.Authorization = `Bearer ${data.access_token}`;
              return this.client.request(error.config);
            } catch {
              // 刷新失败，清除登录状态
              this.setToken(null);
              await storage.deleteItem('auth_token');
              await storage.deleteItem('refresh_token');
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string | null) {
    this.token = token;
  }

  // ==================== Auth ====================

  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    return data;
  }

  async register(email: string, password: string, nickname?: string) {
    const { data } = await this.client.post('/auth/register', { email, password, nickname });
    return data;
  }

  async getCurrentUser() {
    const { data } = await this.client.get('/auth/me');
    return data;
  }

  async updateUser(nickname?: string, avatar_url?: string) {
    const { data } = await this.client.put('/auth/me', { nickname, avatar_url });
    return data;
  }

  async changePassword(oldPassword: string, newPassword: string) {
    const { data } = await this.client.post('/auth/password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return data;
  }

  async deleteAccount() {
    const { data } = await this.client.delete('/auth/me');
    // 清除本地 token
    this.setToken(null);
    await storage.deleteItem('auth_token');
    await storage.deleteItem('refresh_token');
    return data;
  }

  async exportData(): Promise<ExportedData> {
    const { data } = await this.client.get('/auth/me/export');
    return data;
  }

  async getStats(): Promise<UserStats> {
    const { data } = await this.client.get('/auth/me/stats');
    return data;
  }

  // ==================== Classrooms ====================

  async getClassrooms() {
    const { data } = await this.client.get('/classrooms');
    return data;
  }

  async getClassroom(id: string) {
    const { data } = await this.client.get(`/classrooms/${id}`);
    return data;
  }

  async createClassroom(name: string, description?: string) {
    const { data } = await this.client.post('/classrooms', { name, description });
    return data;
  }

  async updateClassroom(id: string, name?: string, description?: string) {
    const { data } = await this.client.put(`/classrooms/${id}`, { name, description });
    return data;
  }

  async deleteClassroom(id: string) {
    const { data } = await this.client.delete(`/classrooms/${id}`);
    return data;
  }

  // ==================== Generation ====================

  async generateOutlines(requirement: string, options?: Record<string, any>) {
    const { data } = await this.client.post('/generate/outlines', {
      requirement,
      ...options,
    });
    return data;
  }

  // 流式生成大纲（返回完整结果，内部处理流式）
  async generateOutlinesStream(
    requirement: string,
    language: string = 'zh-CN',
    agents?: Array<{ id: string; name: string; role: string; persona: string }>,
    webSearch?: boolean
  ) {
    // 由于移动端不支持SSE，这里调用普通API但返回相同格式
    // 服务端可以后续优化为真正的流式
    const { data } = await this.client.post('/generate/outlines', {
      requirement,
      language,
      agent_ids: agents?.map(a => a.id),
      web_search: webSearch,
    });
    return data;
  }

  async generateAgentProfiles(stageName: string, stageDescription?: string, sceneOutlines?: any[], language?: string) {
    const { data } = await this.client.post('/generate/agent-profiles', {
      stage_name: stageName,
      stage_description: stageDescription,
      scene_outlines: sceneOutlines,
      language: language || 'zh-CN',
    });
    return data;
  }

  async getDefaultAgents(language?: string) {
    const { data } = await this.client.get('/generate/default-agents', {
      params: { language: language || 'zh-CN' },
    });
    return data;
  }

  async generateScenes(outlines: any[], options?: Record<string, any>) {
    const { data } = await this.client.post('/generate/scenes', {
      outlines,
      ...options,
    });
    return data;
  }

  async startGenerationJob(requirement: string, options?: Record<string, any>) {
    const { data } = await this.client.post('/generate/classroom', {
      requirement,
      ...options,
    });
    return data;
  }

  async getGenerationJob(jobId: string) {
    const { data } = await this.client.get(`/generate/classroom/${jobId}`);
    return data;
  }

  // ==================== Chat (SSE) ====================

  streamChat(messages: any[], config: any, storeState: any) {
    const url = `${API_BASE_URL}/chat`;
    // SSE 需要使用 EventSource 或 fetch
    return {
      url,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, config, storeState }),
    };
  }

  // ==================== Token Economy ====================

  async getTokenBalance() {
    const { data } = await this.client.get('/tokens/balance');
    return data;
  }

  async getTokenTransactions(limit?: number, offset?: number) {
    const { data } = await this.client.get('/tokens/transactions', {
      params: { limit, offset },
    });
    return data;
  }

  async exchangeTokens(points: number) {
    const { data } = await this.client.post('/tokens/exchange', { points });
    return data;
  }

  async getTokenPackages() {
    const { data } = await this.client.get('/tokens/packages');
    return data;
  }

  async purchaseTokens(packageId: string) {
    const { data } = await this.client.post('/tokens/purchase', { package_id: packageId });
    return data;
  }

  // ==================== Points Economy ====================

  async getPointsBalance() {
    const { data } = await this.client.get('/points/balance');
    return data;
  }

  async getPointsTransactions(limit?: number, offset?: number) {
    const { data } = await this.client.get('/points/transactions', {
      params: { limit, offset },
    });
    return data;
  }

  async getPointsSources() {
    const { data } = await this.client.get('/points/sources');
    return data;
  }

  async claimNewUserPackage() {
    const { data } = await this.client.post('/points/new_user_package');
    return data;
  }

  // ==================== Questions ====================

  async getQuestions(page?: number, limit?: number, sort?: string) {
    const { data } = await this.client.get('/questions', {
      params: { page, limit, sort },
    });
    return data;
  }

  async getQuestion(id: string) {
    const { data } = await this.client.get(`/questions/${id}`);
    return data;
  }

  async createQuestion(title: string, content: string, bounty?: number, tags?: string) {
    const { data } = await this.client.post('/questions', { title, content, bounty, tags });
    return data;
  }

  // ==================== Answers ====================

  async getAnswers(questionId: string) {
    const { data } = await this.client.get(`/answers/question/${questionId}`);
    return data;
  }

  async createAnswer(questionId: string, content: string) {
    const { data } = await this.client.post('/answers', { question_id: questionId, content });
    return data;
  }

  async voteAnswer(answerId: string, vote: number) {
    const { data } = await this.client.post(`/answers/${answerId}/vote`, { vote });
    return data;
  }

  async acceptAnswer(answerId: string) {
    const { data } = await this.client.post(`/answers/${answerId}/accept`);
    return data;
  }

  // ==================== Invitations ====================

  async getMyInviteCode() {
    const { data } = await this.client.get('/invitations/my-code');
    return data;
  }

  async getInvitationStats() {
    const { data } = await this.client.get('/invitations/stats');
    return data;
  }

  async applyInviteCode(code: string) {
    const { data } = await this.client.post('/invitations/apply', { code });
    return data;
  }

  // ==================== Payment ====================

  async getPaymentPackages() {
    const { data } = await this.client.get('/payment/packages');
    return data;
  }

  async createPaymentOrder(packageId: string, paymentMethod: string) {
    const { data } = await this.client.post('/payment/create-order', {
      package_id: packageId,
      payment_method: paymentMethod,
    });
    return data;
  }

  async getPaymentOrders() {
    const { data } = await this.client.get('/payment/orders');
    return data;
  }

  async mockPayment(orderId: string) {
    const { data } = await this.client.post(`/payment/mock-pay/${orderId}`);
    return data;
  }

  // ==================== Buddy ====================

  async getBuddyTypes() {
    const { data } = await this.client.get('/buddy/types');
    return data;
  }

  async getMyBuddyConfig() {
    const { data } = await this.client.get('/buddy/my-config');
    return data;
  }

  async setBuddyConfig(buddyType: string, buddyName?: string, toneStyle?: string) {
    const { data } = await this.client.post('/buddy/config', {
      buddy_type: buddyType,
      buddy_name: buddyName,
      tone_style: toneStyle,
    });
    return data;
  }

  async getBuddyMessages(page?: number, limit?: number, unreadOnly?: boolean) {
    const { data } = await this.client.get('/buddy/messages', {
      params: { page, limit, unread_only: unreadOnly },
    });
    return data;
  }

  async markBuddyMessageRead(messageId: string) {
    const { data } = await this.client.post(`/buddy/messages/${messageId}/read`);
    return data;
  }

  // ==================== Notes ====================

  async getNotes(page?: number, limit?: number, sort?: string) {
    const { data } = await this.client.get('/notes', {
      params: { page, limit, sort },
    });
    return data;
  }

  async getNote(id: string) {
    const { data } = await this.client.get(`/notes/${id}`);
    return data;
  }

  async publishNote(title: string, content: string, visibility?: string, price?: number, tags?: string) {
    const { data } = await this.client.post('/notes', {
      title,
      content,
      visibility,
      price,
      tags,
    });
    return data;
  }

  async purchaseNote(noteId: string) {
    const { data } = await this.client.post(`/notes/${noteId}/purchase`);
    return data;
  }

  async rateNote(noteId: string, rating: number) {
    const { data } = await this.client.post(`/notes/${noteId}/rating`, { rating });
    return data;
  }

  async getMyNoteEarnings() {
    const { data } = await this.client.get('/notes/my/earnings');
    return data;
  }

  // ==================== Matching ====================

  async getMatchingPreferences() {
    const { data } = await this.client.get('/matching/preferences');
    return data;
  }

  async setMatchingPreferences(goalTags: string[], courseIds: string[], progressLevel: string, schedulePreference: string) {
    const { data } = await this.client.post('/matching/preferences', {
      goal_tags: goalTags,
      course_ids: courseIds,
      progress_level: progressLevel,
      schedule_preference: schedulePreference,
    });
    return data;
  }

  async searchMatches() {
    const { data } = await this.client.post('/matching/search');
    return data;
  }

  async getPendingMatches() {
    const { data } = await this.client.get('/matching/pending');
    return data;
  }

  async acceptMatch(matchId: string) {
    const { data } = await this.client.post(`/matching/${matchId}/accept`);
    return data;
  }

  async rejectMatch(matchId: string) {
    const { data } = await this.client.post(`/matching/${matchId}/reject`);
    return data;
  }

  async getAcceptedMatches() {
    const { data } = await this.client.get('/matching/accepted');
    return data;
  }

  // ==================== Gamification ====================

  async getMyLeague() {
    const { data } = await this.client.get('/gamification/league');
    return data;
  }

  async getLeagueLeaderboard(tier?: string) {
    const { data } = await this.client.get('/gamification/league/leaderboard', {
      params: { tier },
    });
    return data;
  }

  async getDailyTasks() {
    const { data } = await this.client.get('/gamification/tasks');
    return data;
  }

  async updateTaskProgress(taskId: string, progress: number) {
    const { data } = await this.client.post(`/gamification/tasks/${taskId}/progress`, { progress });
    return data;
  }

  async completeCheckinTask() {
    const { data } = await this.client.post('/gamification/tasks/checkin-complete');
    return data;
  }

  async getStreakRewards(streak?: number) {
    const { data } = await this.client.get('/gamification/streak-rewards', {
      params: { streak },
    });
    return data;
  }

  // ==================== Checkin ====================

  async dailyCheckin() {
    const { data } = await this.client.post('/checkin/checkin');
    return data;
  }

  async getCheckinStatus() {
    const { data } = await this.client.get('/checkin/me');
    return data;
  }

  async getCheckinLeaderboard() {
    const { data } = await this.client.get('/checkin/leaderboard');
    return data;
  }

  // ==================== Achievements ====================

  async getAchievements() {
    const { data } = await this.client.get('/achievements');
    return data;
  }

  async getMyAchievements() {
    const { data } = await this.client.get('/achievements/me');
    return data;
  }

  async getAchievementProgress() {
    const { data } = await this.client.get('/achievements/me/progress');
    return data;
  }

  async checkAchievements() {
    const { data } = await this.client.post('/achievements/check');
    return data;
  }

  // ==================== Subscriptions ====================

  async getSubscriptionStatus() {
    const { data } = await this.client.get('/subscriptions/status');
    return data;
  }

  async getSubscriptionFeatures() {
    const { data } = await this.client.get('/subscriptions/features');
    return data;
  }

  async startTrial() {
    const { data } = await this.client.post('/subscriptions/trial');
    return data;
  }

  // ==================== Assessments ====================

  async getAssessmentTypes() {
    const { data } = await this.client.get('/assessments/types');
    return data;
  }

  async createAssessment(courseId: string, assessmentType: string) {
    const { data } = await this.client.post('/assessments/create', {
      course_id: courseId,
      assessment_type: assessmentType,
    });
    return data;
  }

  async getAssessment(assessmentId: string) {
    const { data } = await this.client.get(`/assessments/${assessmentId}`);
    return data;
  }

  async submitAssessment(assessmentId: string, answers: any[]) {
    const { data } = await this.client.post('/assessments/submit', {
      assessment_id: assessmentId,
      answers,
    });
    return data;
  }

  async getAssessmentResults(courseId: string) {
    const { data } = await this.client.get(`/assessments/results/${courseId}`);
    return data;
  }

  async getAssessmentStats() {
    const { data } = await this.client.get('/assessments/stats');
    return data;
  }

  // ==================== Course Recommendations ====================

  async markCourseCompleted(courseId: string, body?: any) {
    const { data } = await this.client.post(`/recommendations/completions/${courseId}`, body || {});
    return data;
  }

  async getMyCompletions() {
    const { data } = await this.client.get('/recommendations/completions');
    return data;
  }

  async getCourseRecommendations(courseId: string) {
    const { data } = await this.client.get(`/recommendations/${courseId}/recommendations`);
    return data;
  }

  async getMyLearningPaths() {
    const { data } = await this.client.get('/recommendations/paths');
    return data;
  }

  async createLearningPath(name: string, courseIds: string[], description?: string) {
    const { data } = await this.client.post('/recommendations/paths', {
      name,
      course_ids: courseIds,
      description,
    });
    return data;
  }

  // ==================== Review (Spaced Repetition) ====================

  async getReviewSchedules(status?: string) {
    const { data } = await this.client.get('/review/schedules', {
      params: { status },
    });
    return data;
  }

  async getReviewRecords(courseId?: string) {
    const { data } = await this.client.get('/review/records', {
      params: { course_id: courseId },
    });
    return data;
  }

  async startReview(scheduleId: string) {
    const { data } = await this.client.post(`/review/start/${scheduleId}`);
    return data;
  }

  async completeReview(scheduleId: string, effectivenessRating?: number, notes?: string) {
    const { data } = await this.client.post('/review/complete', {
      schedule_id: scheduleId,
      effectiveness_rating: effectivenessRating,
      notes,
    });
    return data;
  }

  async getReviewStats() {
    const { data } = await this.client.get('/review/stats');
    return data;
  }

  // ==================== Learning Passport ====================

  async getMyPassport() {
    const { data } = await this.client.get('/passport/me');
    return data;
  }

  async getPassportSkills() {
    const { data } = await this.client.get('/passport/skills');
    return data;
  }

  async getSkillPassport(skillName: string) {
    const { data } = await this.client.get(`/passport/skill/${skillName}`);
    return data;
  }

  async createProjectPortfolio(projectName: string, projectType: string, description?: string, contentUrl?: string) {
    const { data } = await this.client.post('/passport/projects', {
      project_name: projectName,
      project_type: projectType,
      description,
      content_url: contentUrl,
    });
    return data;
  }

  async getMyProjects() {
    const { data } = await this.client.get('/passport/projects/me');
    return data;
  }

  async requestSkillAssessment(skillName: string) {
    const { data } = await this.client.post('/passport/assess', {
      skill_name: skillName,
    });
    return data;
  }

  // ==================== Enterprise ====================

  async getMyEnterprise() {
    const { data } = await this.client.get('/enterprise/my');
    return data;
  }

  async createEnterprise(name: string, industry?: string, size?: string, planType?: string) {
    const { data } = await this.client.post('/enterprise/', {
      name,
      industry,
      size,
      plan_type: planType || 'basic',
      contact_email: '', // will be filled from user
    });
    return data;
  }

  async getEnterpriseDetail(enterpriseId: string) {
    const { data } = await this.client.get(`/enterprise/${enterpriseId}`);
    return data;
  }

  async getEnterpriseMembers(enterpriseId: string, role?: string) {
    const { data } = await this.client.get(`/enterprise/${enterpriseId}/members`, {
      params: { role },
    });
    return data;
  }

  async inviteEnterpriseMembers(enterpriseId: string, emails: string[], role?: string) {
    const { data } = await this.client.post(`/enterprise/${enterpriseId}/members/invite`, {
      enterprise_id: enterpriseId,
      emails,
      role: role || 'member',
    });
    return data;
  }

  async getEnterpriseCourses(enterpriseId: string) {
    const { data } = await this.client.get(`/enterprise/${enterpriseId}/courses`);
    return data;
  }

  async getEnterpriseStats(enterpriseId: string) {
    const { data } = await this.client.get(`/enterprise/${enterpriseId}/stats`);
    return data;
  }

  // ==================== Note Citations ====================

  async addNoteCitation(noteId: string, sceneId: string, contentSnippet: string, citationType?: string) {
    const { data } = await this.client.post(`/notes/${noteId}/citations`, {
      note_id: noteId,
      scene_id: sceneId,
      content_snippet: contentSnippet,
      citation_type: citationType || 'direct',
    });
    return data;
  }

  async getNoteCitations(noteId: string) {
    const { data } = await this.client.get(`/notes/${noteId}/citations`);
    return data;
  }

  async getSceneCitations(sceneId: string, page?: number, limit?: number) {
    const { data } = await this.client.get(`/notes/scenes/${sceneId}/citations`, {
      params: { page, limit },
    });
    return data;
  }

  async getCourseCitationStats(courseId: string) {
    const { data } = await this.client.get(`/notes/courses/${courseId}/citation-stats`);
    return data;
  }

  async deleteNoteCitation(noteId: string, citationId: string) {
    const { data } = await this.client.delete(`/notes/${noteId}/citations/${citationId}`);
    return data;
  }

  // ==================== Video Course ====================

  async createCourseFromVideo(videoUrl: string, language?: string, depth?: string) {
    const { data } = await this.client.post('/generate/from-video', {
      video_url: videoUrl,
      language: language || 'zh-CN',
      depth: depth || 'understand',
    });
    return data;
  }

  async getVideoSources() {
    const { data } = await this.client.get('/generate/video-sources');
    return data;
  }

  async getVideoSourceStatus(videoSourceId: string) {
    const { data } = await this.client.get(`/generate/video-source/${videoSourceId}`);
    return data;
  }

  // ==================== AI Personas ====================

  async getAvailablePersonas() {
    const { data } = await this.client.get('/personas');
    return data;
  }

  async startPersonaSession(personaId: string, topic?: string, mode?: string) {
    const { data } = await this.client.post('/personas/session', {
      persona_id: personaId,
      topic,
      mode: mode || 'teaching',
    });
    return data;
  }

  async getPersonaSession(sessionId: string) {
    const { data } = await this.client.get(`/personas/session/${sessionId}`);
    return data;
  }

  async sendPersonaMessage(sessionId: string, message: string) {
    const { data } = await this.client.post(`/personas/session/${sessionId}/message`, {
      user_message: message,
    });
    return data;
  }

  async endPersonaSession(sessionId: string, rating?: number, feedback?: string) {
    const { data } = await this.client.post(`/personas/session/${sessionId}/end`, {
      rating,
      feedback,
    });
    return data;
  }

  // ==================== Share Cards ====================

  async createShareCard(cardType: string, referenceId: string, title: string, subtitle?: string) {
    const { data } = await this.client.post('/share-cards', {
      card_type: cardType,
      reference_id: referenceId,
      title,
      subtitle,
    });
    return data;
  }

  async getMyShareCards() {
    const { data } = await this.client.get('/share-cards/me');
    return data;
  }

  async getShareCard(cardId: string) {
    const { data } = await this.client.get(`/share-cards/${cardId}`);
    return data;
  }

  // ==================== Programming Exercises ====================

  async getProgrammingExercises(courseId: string) {
    const { data } = await this.client.get('/programming/exercises', {
      params: { course_id: courseId },
    });
    return data;
  }

  async getExerciseDetail(exerciseId: string) {
    const { data } = await this.client.get(`/programming/exercises/${exerciseId}`);
    return data;
  }

  async submitCode(exerciseId: string, code: string, language: string) {
    const { data } = await this.client.post('/programming/submit', {
      exercise_id: exerciseId,
      code,
      language,
    });
    return data;
  }

  async getMySubmissions(exerciseId?: string) {
    const { data } = await this.client.get('/programming/submissions', {
      params: { exercise_id: exerciseId },
    });
    return data;
  }

  // ==================== Depth Levels ====================

  async getDepthProgress(courseId: string) {
    const { data } = await this.client.get('/depth/progress', {
      params: { course_id: courseId },
    });
    return data;
  }

  async setCourseDepth(courseId: string, depth: string) {
    const { data } = await this.client.post('/depth/set', {
      course_id: courseId,
      depth,
    });
    return data;
  }

  async getDepthStats() {
    const { data } = await this.client.get('/depth/stats');
    return data;
  }

  // ==================== Note Reminders ====================

  async getNoteReminders(status?: string) {
    const { data } = await this.client.get('/note-reminders', {
      params: { status },
    });
    return data;
  }

  async completeNoteReminder(reminderId: string, noteId: string) {
    const { data } = await this.client.post(`/note-reminders/${reminderId}/complete`, {
      note_id: noteId,
    });
    return data;
  }

  async skipNoteReminder(reminderId: string, reason?: string) {
    const { data } = await this.client.post(`/note-reminders/${reminderId}/skip`, {
      reason,
    });
    return data;
  }

  async getReminderTemplates() {
    const { data } = await this.client.get('/note-reminders/templates');
    return data;
  }
}

export const apiClient = new ApiClient();