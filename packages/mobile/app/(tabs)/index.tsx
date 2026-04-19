import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { Ionicons } from '@expo/vector-icons';

// 功能入口配置
const workbenchItems = [
  { key: 'courses', title: '我的课程', icon: 'book', color: '#5b9bd5', route: '/courses' },
  { key: 'questions', title: '问答悬赏', icon: 'chatbubble-ellipses', color: '#f59e0b', route: '/questions' },
  { key: 'notes', title: '共享笔记', icon: 'document-text', color: '#10b981', route: '/notes' },
  { key: 'buddy', title: '学习搭子', icon: 'happy', color: '#ec4899', route: '/buddy' },
  { key: 'matching', title: '学习匹配', icon: 'people', color: '#8b5cf6', route: '/matching' },
  { key: 'gamification', title: '成长体系', icon: 'trophy', color: '#ef4444', route: '/gamification' },
  { key: 'invite', title: '邀请奖励', icon: 'gift', color: '#06b6d4', route: '/invite' },
  { key: 'payment', title: '充值中心', icon: 'card', color: '#84cc16', route: '/payment' },
  { key: 'wallet', title: '钱包', icon: 'cash', color: '#f97316', route: '/wallet' },
  { key: 'enterprise', title: '企业服务', icon: 'briefcase', color: '#6366f1', route: '/enterprise' },
];

export default function WorkbenchScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const handlePress = (route: string) => {
    router.push(route as any);
  };

  return (
    <ScrollView style={styles.container}>
      {/* 用户信息卡片 */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Ionicons name="person-circle" size={60} color="#5b9bd5" />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.nickname || user?.email || '用户'}</Text>
          <Text style={styles.userHint}>欢迎来到个人工作台</Text>
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
              <View style={[styles.iconBox, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon as any} size={28} color="white" />
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
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/courses' as any)}
          >
            <Ionicons name="book" size={20} color="#5b9bd5" />
            <Text style={styles.quickBtnText}>查看课程</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/questions' as any)}
          >
            <Ionicons name="help-circle" size={20} color="#f59e0b" />
            <Text style={styles.quickBtnText}>发布问题</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/notes' as any)}
          >
            <Ionicons name="create" size={20} color="#10b981" />
            <Text style={styles.quickBtnText}>写笔记</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  avatar: {
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  userHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 10,
  },
  gridItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 15,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: '#f0f4f8',
  },
  quickBtnText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#333',
  },
});