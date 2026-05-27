/**
 * Chat History 持久化 - 移动端版本
 *
 * 使用 AsyncStorage 存储对话历史，支持分块展示和恢复
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const CHAT_HISTORY_KEY_PREFIX = 'chatHistory:';
export const DISCUSSION_HISTORY_KEY_PREFIX = 'discussionHistory:';

export interface ChatEntry {
  id: string; // 唯一标识
  agent: string; // agent名称
  agentId?: string; // agent role/id
  message: string; // 消息内容
  persona?: string; // agent个性描述
  actions?: any[]; // 执行的动作
  timestamp: number; // 时间戳
}

export interface ChatSession {
  sceneId: string;
  entries: ChatEntry[];
  createdAt: number;
  updatedAt: number;
}

function chatKey(sceneId: string): string {
  return CHAT_HISTORY_KEY_PREFIX + sceneId;
}

function discussionKey(sceneId: string): string {
  return DISCUSSION_HISTORY_KEY_PREFIX + sceneId;
}

/** 读取聊天历史 */
export async function readChatHistory(sceneId: string): Promise<ChatEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(chatKey(sceneId));
    if (raw) {
      const session = JSON.parse(raw) as ChatSession;
      return session.entries || [];
    }
  } catch (error) {
    console.warn(`[chat-persistence] readChatHistory failed for ${sceneId}:`, error);
  }
  return [];
}

/** 保存聊天历史 */
export async function saveChatHistory(sceneId: string, entries: ChatEntry[]): Promise<void> {
  try {
    const now = Date.now();
    const existing = await AsyncStorage.getItem(chatKey(sceneId));
    let session: ChatSession;

    if (existing) {
      session = JSON.parse(existing) as ChatSession;
      session.entries = entries;
      session.updatedAt = now;
    } else {
      session = {
        sceneId,
        entries,
        createdAt: now,
        updatedAt: now,
      };
    }

    await AsyncStorage.setItem(chatKey(sceneId), JSON.stringify(session));
  } catch (error) {
    console.warn(`[chat-persistence] saveChatHistory failed for ${sceneId}:`, error);
  }
}

/** 添加单条聊天记录 */
export async function appendChatEntry(sceneId: string, entry: ChatEntry): Promise<void> {
  try {
    const entries = await readChatHistory(sceneId);
    entries.push(entry);
    await saveChatHistory(sceneId, entries);
  } catch (error) {
    console.warn(`[chat-persistence] appendChatEntry failed:`, error);
  }
}

/** 添加单条讨论记录 */
export async function appendDiscussionEntry(sceneId: string, entry: ChatEntry): Promise<void> {
  try {
    const entries = await readDiscussionHistory(sceneId);
    entries.push(entry);
    await saveDiscussionHistory(sceneId, entries);
  } catch (error) {
    console.warn(`[chat-persistence] appendDiscussionEntry failed:`, error);
  }
}

/** 清除聊天历史 */
export async function clearChatHistory(sceneId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(chatKey(sceneId));
  } catch (error) {
    console.warn(`[chat-persistence] clearChatHistory failed:`, error);
  }
}

/** 读取讨论历史 */
export async function readDiscussionHistory(sceneId: string): Promise<ChatEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(discussionKey(sceneId));
    if (raw) {
      const session = JSON.parse(raw) as ChatSession;
      return session.entries || [];
    }
  } catch (error) {
    console.warn(`[chat-persistence] readDiscussionHistory failed for ${sceneId}:`, error);
  }
  return [];
}

/** 保存讨论历史 */
export async function saveDiscussionHistory(sceneId: string, entries: ChatEntry[]): Promise<void> {
  try {
    const now = Date.now();
    const existing = await AsyncStorage.getItem(discussionKey(sceneId));
    let session: ChatSession;

    if (existing) {
      session = JSON.parse(existing) as ChatSession;
      session.entries = entries;
      session.updatedAt = now;
    } else {
      session = {
        sceneId,
        entries,
        createdAt: now,
        updatedAt: now,
      };
    }

    await AsyncStorage.setItem(discussionKey(sceneId), JSON.stringify(session));
  } catch (error) {
    console.warn(`[chat-persistence] saveDiscussionHistory failed:`, error);
  }
}

/** 获取所有聊天会话列表 */
export async function getAllChatSessions(): Promise<ChatSession[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const chatKeys = keys.filter(k => k.startsWith(CHAT_HISTORY_KEY_PREFIX) || k.startsWith(DISCUSSION_HISTORY_KEY_PREFIX));
    const items = await AsyncStorage.multiGet(chatKeys);
    return items
      .filter(([_, v]) => v !== null)
      .map(([_, v]) => JSON.parse(v!) as ChatSession)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.warn('[chat-persistence] getAllChatSessions failed:', error);
    return [];
  }
}