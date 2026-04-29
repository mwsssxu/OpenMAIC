import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, SecondaryColorMap, getShadowColor } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

// 快捷操作配置 - 使用主题色
const quickActions = [
  { title: '查看课程', icon: 'book', color: SecondaryColorMap.courses, route: '/courses' },
  { title: '发布问题', icon: 'help-circle', color: SecondaryColorMap.questions, route: '/questions' },
  { title: '写笔记', icon: 'create', color: SecondaryColorMap.notes, route: '/notes' },
];

// 功能入口配置 - 使用 SecondaryColorMap
const workbenchItems = [
  { key: 'courses', title: '我的课程', icon: 'book', color: SecondaryColorMap.courses, route: '/courses' },
  { key: 'questions', title: '问答悬赏', icon: 'chatbubble-ellipses', color: SecondaryColorMap.questions, route: '/questions' },
  { key: 'notes', title: '共享笔记', icon: 'document-text', color: SecondaryColorMap.notes, route: '/notes' },
  { key: 'buddy', title: '学习搭子', icon: 'happy', color: SecondaryColorMap.buddy, route: '/buddy' },
  { key: 'matching', title: '学习匹配', icon: 'people', color: SecondaryColorMap.matching, route: '/matching' },
  { key: 'gamification', title: '成长体系', icon: 'trophy', color: SecondaryColorMap.gamification, route: '/gamification' },
  { key: 'invite', title: '邀请奖励', icon: 'gift', color: SecondaryColorMap.invite, route: '/invite' },
  { key: 'payment', title: '充值中心', icon: 'card', color: SecondaryColorMap.payment, route: '/payment' },
  { key: 'wallet', title: '钱包', icon: 'cash', color: SecondaryColorMap.wallet, route: '/wallet' },
  { key: 'enterprise', title: '企业服务', icon: 'briefcase', color: SecondaryColorMap.enterprise, route: '/enterprise' },
];

export default function WorkbenchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { onPress } = useFeedback();

  const handlePress = (route: string) => {
    onPress();
    router.push(route as any);
  };

  return (
    <ScrollView style={styles.container}>
      {/* 用户信息卡片 */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={28} color={Colors.neutral.white} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.nickname || user?.email || '用户'}</Text>
          <Text style={styles.userHint}>欢迎来到个人工作台 ✨</Text>
        </View>
      </View>

      {/* 功能入口网格 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>常用功能</Text>
        <View style={styles.grid}>
          {workbenchItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.gridItem}
              onPress={() => handlePress(item.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: item.color, shadowColor: item.color, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2 }]}>
                <Ionicons name={item.icon as any} size={24} color={Colors.neutral.white} />
              </View>
              <Text style={styles.itemTitle}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 快捷操作 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>快捷操作</Text>
        <View style={styles.quickActions}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.title}
              style={[styles.quickBtn, { backgroundColor: action.color }]}
              onPress={() => router.push(action.route as any)}
            >
              <Ionicons name={action.icon as any} size={20} color={Colors.neutral.white} />
              <Text style={styles.quickBtnText}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral.background,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.neutral.backgroundAlt,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.textPrimary,
  },
  userHint: {
    fontSize: 14,
    color: Colors.neutral.textSecondary,
    marginTop: 4,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.textPrimary,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.neutral.backgroundAlt,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  gridItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 13,
    color: Colors.neutral.textPrimary,
    textAlign: 'center',
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.neutral.backgroundAlt,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  quickBtnText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral.white,
  },
});