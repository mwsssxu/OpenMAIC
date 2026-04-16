import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ClassroomCardProps {
  classroom: {
    id: string;
    name: string;
    description?: string;
    created_at: string;
  };
  onPress: () => void;
}

export function ClassroomCard({ classroom, onPress }: ClassroomCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.content}>
        <Text style={styles.title}>{classroom.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {classroom.description || '暂无描述'}
        </Text>
        <Text style={styles.date}>
          {new Date(classroom.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: { flex: 1 },
  title: { fontSize: 18, fontWeight: 'bold' },
  description: { fontSize: 14, color: '#666', marginTop: 5 },
  date: { fontSize: 12, color: '#999', marginTop: 10 },
});