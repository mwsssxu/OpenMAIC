import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ClassroomCardProps {
  classroom: {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    interactiveMode?: boolean; // 是否为深度交互课程
    scene_count?: number;
  };
  onPress: () => void;
  thumbnail?: React.ReactNode; // 可选的缩略图组件
}

export function ClassroomCard({ classroom, onPress, thumbnail }: ClassroomCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* 缩略图区域 */}
      {thumbnail && (
        <View style={styles.thumbnailArea}>
          {thumbnail}
          {/* Deep-Interactive Badge */}
          {classroom.interactiveMode && (
            <View style={styles.interactiveBadge}>
              <Ionicons name="game-controller" size={12} color="white" />
              <Text style={styles.interactiveBadgeText}>互动</Text>
            </View>
          )}
        </View>
      )}

      {/* 内容区域 */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{classroom.name}</Text>
          {/* 无缩略图时，Badge 放在标题旁 */}
          {!thumbnail && classroom.interactiveMode && (
            <View style={styles.interactiveBadgeSmall}>
              <Ionicons name="game-controller" size={10} color="white" />
            </View>
          )}
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {classroom.description || '暂无描述'}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="layers-outline" size={12} color="#999" />
          <Text style={styles.metaText}>
            {classroom.scene_count || 0} 场景
          </Text>
          <Text style={styles.date}>
            {new Date(classroom.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnailArea: {
    height: 100,
    backgroundColor: '#f5f7fa',
    position: 'relative',
  },
  interactiveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  interactiveBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  interactiveBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  content: {
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#999',
    marginRight: 8,
  },
  date: {
    fontSize: 11,
    color: '#999',
  },
});