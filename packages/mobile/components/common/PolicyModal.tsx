import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { apiClient } from '@/lib/api-client';

type PolicyType = 'user-agreement' | 'privacy-policy';

interface PolicyModalProps {
  visible: boolean;
  type: PolicyType;
  onClose: () => void;
}

interface PolicyData {
  title: string;
  version: string;
  effective_date: string;
  content: string;
}

export function PolicyModal({ visible, type, onClose }: PolicyModalProps) {
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchPolicy();
    }
  }, [visible, type]);

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const endpoint = type === 'user-agreement' ? '/policies/user-agreement' : '/policies/privacy-policy';
      const data = await fetch(`${apiClient.getBaseUrl()}${endpoint}`).then(r => r.json());
      setPolicy(data);
    } catch (error) {
      // 使用本地缓存内容
      setPolicy(getLocalPolicy(type));
    } finally {
      setLoading(false);
    }
  };

  const getLocalPolicy = (policyType: PolicyType): PolicyData => {
    if (policyType === 'user-agreement') {
      return {
        title: '用户协议',
        version: 'v1.0',
        effective_date: '2026-01-01',
        content: `
# OpenMAIC 用户协议

## 1. 服务说明
OpenMAIC 是一个 AI 交互式教学平台，为用户提供智能课程生成、互动学习等服务。

## 2. 用户账户
- 您必须提供真实、准确的注册信息
- 您需对账户安全负责，妥善保管登录凭证
- 不得将账户转让、出售或出借给他人使用

## 3. 用户行为规范
您承诺不会：
- 发布违法、有害、虚假或侵权内容
- 利用本服务进行任何违法活动
- 尝试破坏、干扰或侵入系统

## 4. 内容权利
- 您保留对上传内容的所有权
- AI 生成的课程大纲、场景等内容归您所有

## 5. 免责声明
- 本服务按现状提供，不保证无错误或无中断
- AI 生成内容可能存在不准确之处，请自行判断

联系我们：support@openmaic.com
        `,
      };
    }
    return {
      title: '隐私政策',
      version: 'v1.0',
      effective_date: '2026-01-01',
      content: `
# OpenMAIC 隐私政策

## 1. 我们收集的信息
- 邮箱地址（注册、登录、通知）
- 昵称、头像（个人展示，可选）
- 课程内容、学习记录

## 2. 信息使用目的
- ✅ 提供核心服务
- ✅ 账户管理和身份验证
- ✅ 改善服务质量
- ❌ 不用于商业广告推送

## 3. 信息存储与保护
- 密码使用 bcrypt 加密存储
- 传输使用 HTTPS 加密
- 数据库访问受严格权限控制

## 4. 您的权利（GDPR 合规）
- 访问权：随时查看您的个人信息
- 更正权：更新您的昵称、头像
- 导出权：导出所有个人数据
- 删除权：申请注销账户

## 5. 儿童保护
本服务面向 13 岁以上用户。

联系我们：privacy@openmaic.com
        `,
    };
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{policy?.title || '加载中...'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>关闭</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
        ) : (
          <>
            <View style={styles.meta}>
              <Text style={styles.metaText}>版本 {policy?.version}</Text>
              <Text style={styles.metaText}>生效日期 {policy?.effective_date}</Text>
            </View>
            <ScrollView style={styles.content}>
              <Text style={styles.contentText}>{policy?.content}</Text>
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 18, fontWeight: 'bold' },
  closeButton: { padding: 8 },
  closeText: { color: '#007AFF', fontSize: 16 },
  meta: {
    padding: 12,
    backgroundColor: '#f5f5f5',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: { fontSize: 12, color: '#666' },
  loader: { flex: 1, justifyContent: 'center' },
  content: { flex: 1, padding: 16 },
  contentText: { fontSize: 14, lineHeight: 24 },
});