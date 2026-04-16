import { View, Text, StyleSheet, Image } from 'react-native';

interface AgentAvatarProps {
  agentId: string;
  name: string;
  avatarUrl?: string;
  size?: number;
}

export function AgentAvatar({ agentId, name, avatarUrl, size = 40 }: AgentAvatarProps) {
  return (
    <View style={[styles.container, { width: size + 10 }]}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.avatar, { width: size, height: size }]}
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size }]}>
          <Text style={styles.initial}>{name[0] || 'A'}</Text>
        </View>
      )}
      <Text style={[styles.name, { maxWidth: size + 10 }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  avatar: { borderRadius: 999 },
  placeholder: {
    borderRadius: 999,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  name: { fontSize: 12, marginTop: 4, textAlign: 'center' },
});