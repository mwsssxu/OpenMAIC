import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
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
            <View style={[styles.cardIcon, { backgroundColor: Colors.primary.main }]}>
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
            <View style={[styles.cardIcon, { backgroundColor: Colors.accent.main }]}>
              <Ionicons name="brush" size={28} color={Colors.neutral.white} />
            </View>
            <Text style={styles.cardTitle}>创意设计</Text>
            <Text style={styles.cardDesc}>释放创意潜能</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={[styles.cardIcon, { backgroundColor: Colors.primary.light }]}>
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
          <Ionicons name="star" size={20} color={Colors.accent.main} />
          <Text style={styles.listText}>AI 人工智能基础</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={onPress}>
          <Ionicons name="star" size={20} color={Colors.accent.main} />
          <Text style={styles.listText}>产品经理实战</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={onPress}>
          <Ionicons name="star" size={20} color={Colors.accent.main} />
          <Text style={styles.listText}>UI/UX 设计思维</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  header: {
    padding: Spacing.xl,
    alignItems: 'center',
    backgroundColor: Colors.neutral.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.neutral.textPrimary, marginTop: Spacing.md },
  subtitle: { fontSize: 16, color: Colors.neutral.textSecondary, marginTop: Spacing.sm },
  section: {
    margin: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral.textPrimary, marginBottom: Spacing.md },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.neutral.background,
    borderRadius: Rounded.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: Rounded.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: Colors.neutral.textPrimary },
  cardDesc: { fontSize: 12, color: Colors.neutral.textSecondary, marginTop: Spacing.xs },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm + 2,
    backgroundColor: Colors.neutral.background,
    borderRadius: Rounded.sm,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  listText: { fontSize: 14, color: Colors.neutral.textPrimary, marginLeft: Spacing.sm },
});