/**
 * Audio Storage - 使用 expo-file-system 存储 TTS 音频文件
 */

import { Paths, Directory, File } from 'expo-file-system';

const AUDIO_DIR_NAME = 'audio';

/**
 * 获取音频存储目录
 */
function getAudioDirectory(): Directory {
  return new Directory(Paths.document, AUDIO_DIR_NAME);
}

/**
 * 初始化音频存储目录
 */
export function initAudioStorage(): void {
  const audioDir = getAudioDirectory();
  if (!audioDir.exists) {
    audioDir.create({ idempotent: true });
  }
}

/**
 * 保存音频文件（同步版本，适用于小文件）
 *
 * @param audioId - 音频 ID（不含扩展名）
 * @param base64 - base64 编码的音频数据
 * @param format - 音频格式（mp3, wav, etc.）
 * @returns 文件路径
 */
export function saveAudioFile(
  audioId: string,
  base64: string,
  format: string = 'mp3'
): string {
  initAudioStorage();

  const audioDir = getAudioDirectory();
  const fileName = `${audioId}.${format}`;

  // Create file and write base64 data
  const file = audioDir.createFile(fileName, `audio/${format}`);
  file.write(base64, { encoding: 'base64' });

  return file.uri;
}

/**
 * 保存音频文件（异步版本，适用于大文件，避免阻塞 UI）
 *
 * @param audioId - 音频 ID（不含扩展名）
 * @param base64 - base64 编码的音频数据
 * @param format - 音频格式（mp3, wav, etc.）
 * @returns Promise<string> 文件路径
 */
export async function saveAudioFileAsync(
  audioId: string,
  base64: string,
  format: string = 'mp3'
): Promise<string> {
  // 使用 setTimeout 将同步操作推迟到下一个事件循环，避免阻塞 UI
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const filePath = saveAudioFile(audioId, base64, format);
        resolve(filePath);
      } catch (err) {
        reject(err);
      }
    }, 0);
  });
}

/**
 * 获取音频文件路径
 *
 * @param audioId - 音频 ID
 * @param format - 音频格式（默认 mp3）
 * @returns 文件路径（如果不存在返回 null）
 */
export function getAudioPath(
  audioId: string,
  format: string = 'mp3'
): string | null {
  const audioDir = getAudioDirectory();
  const fileName = `${audioId}.${format}`;
  const file = new File(audioDir, fileName);

  if (file.exists) {
    return file.uri;
  }
  return null;
}

/**
 * 删除音频文件
 *
 * @param audioId - 音频 ID
 * @param format - 音频格式
 */
export function deleteAudioFile(
  audioId: string,
  format: string = 'mp3'
): void {
  const audioDir = getAudioDirectory();
  const fileName = `${audioId}.${format}`;
  const file = new File(audioDir, fileName);

  if (file.exists) {
    file.delete();
  }
}

/**
 * 清理所有音频文件
 */
export function clearAllAudioFiles(): void {
  const audioDir = getAudioDirectory();
  if (audioDir.exists) {
    audioDir.delete();
  }
  initAudioStorage();
}

/**
 * 获取所有已存储的音频 ID 列表
 */
export function listStoredAudioIds(): string[] {
  initAudioStorage();

  const audioDir = getAudioDirectory();
  const files = audioDir.list();

  // 提取 audioId（去掉扩展名）
  return files
    .filter(f => f instanceof File && (f.name.endsWith('.mp3') || f.name.endsWith('.wav')))
    .map(f => (f as File).name.replace(/\.(mp3|wav)$/, ''));
}