import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { Ionicons } from '@expo/vector-icons';

export default function DiscoverScreen() {
  const { onPress } = useFeedback();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="compass" size={48} color={Colors.primary.main} />
        <Text style={styles.title}>发现课程</Text>
        <Text style={styles.subtitle}>探索热门课程和推荐内容</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>热门推荐</Text>
        <View style={styles.cardGrid}>
          <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={[styles.cardIcon, { backgroundColor: Colors.secondary.info }]}>
              <Ionicons name="code-slash" size={28} color={Colors.neutral.white} />
            </View>
            <Text style={styles.cardTitle}>编程入门</Text>
            <Text style={styles.cardDesc}>零基础学编程</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={[styles.cardIcon, { backgroundColor: Colors.secondary.success }]}>
              <Ionicons name="bar-chart" size={28} color={Colors.neutral.white} />
            </View>
            <Text style={styles.cardTitle}>数据分析</Text>
            <Text style={styles.cardDesc}>数据驱动决策</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={[styles.cardIcon, { backgroundColor: Colors.secondary.fun }]}>
              <Ionicons name="brush" size={28} color={Colors.neutral.white} />
            </View>
            <Text style={styles.cardTitle}>创意设计</Text>
            <Text style={styles.cardDesc}>释放创意潜能</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={[styles.cardIcon, { backgroundColor: Colors.secondary.wisdom }]}>
              <Ionicons name="language" size={28} color={Colors.neutral.white} />
            </View>
            <Text style={styles.cardTitle}>语言学习</Text>
            <Text style={styles.cardDesc}>打开新世界</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最新上架</Text>
        <TouchableOpacity style={styles.listItem} onPress={onPress}>
          <Ionicons name="star" size={20} color={Colors.primary.main} />
          <Text style={styles.listText}>AI 人工智能基础</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={onPress}>
          <Ionicons name="star" size={20} color={Colors.primary.main} />
          <Text style={styles.listText}>产品经理实战</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={onPress}>
          <Ionicons name="star" size={20} color={Colors.primary.main} />
          <Text style={styles.listText}>UI/UX 设计思维</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  header: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: Colors.neutral.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.neutral.textPrimary, marginTop: 16 },
  subtitle: { fontSize: 16, color: Colors.neutral.textSecondary, marginTop: 8 },
  section: {
    margin: 12,
    padding: 16,
    backgroundColor: Colors.neutral.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary, marginBottom: 16 },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    padding: 16,
    marginBottom: 12,
    backgroundColor: Colors.neutral.backgroundAlt,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: Colors.neutral.textPrimary },
  cardDesc: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: 4 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: Colors.neutral.backgroundAlt,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  listText: { fontSize: 14, color: Colors.neutral.textPrimary, marginLeft: 12 },
});
