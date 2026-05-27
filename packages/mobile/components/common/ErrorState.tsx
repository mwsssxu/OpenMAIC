// packages/mobile/components/common/ErrorState.tsx

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Rounded } from '@/lib/constants/theme';
import { i18n } from '@/lib/i18n';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function ErrorState({ message, onRetry, icon = 'alert-circle' }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={Colors.feedback.errorText} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('common.retry')}
          accessibilityHint={i18n.t('accessibility.errorHint')}
        >
          <Ionicons name="refresh" size={20} color={Colors.neutral.white} />
          <Text style={styles.retryText}>{i18n.t('common.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.neutral.background,
  },
  message: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary.main,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Rounded.sm,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.white,
    marginLeft: Spacing.xs,
  },
});
