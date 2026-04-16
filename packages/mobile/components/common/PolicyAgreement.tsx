import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PolicyModal } from './PolicyModal';

interface PolicyAgreementProps {
  checked: boolean;
  onCheck: (checked: boolean) => void;
}

export function PolicyAgreement({ checked, onCheck }: PolicyAgreementProps) {
  const [modalType, setModalType] = useState<'user-agreement' | 'privacy-policy' | null>(null);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => onCheck(!checked)}
      >
        <View style={[styles.checkboxBox, checked && styles.checkboxChecked]}>
          {checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>

      <Text style={styles.agreementText}>
        我已阅读并同意{' '}
        <Text style={styles.link} onPress={() => setModalType('user-agreement')}>
          用户协议
        </Text>
        {' '}和{' '}
        <Text style={styles.link} onPress={() => setModalType('privacy-policy')}>
          隐私政策
        </Text>
      </Text>

      <PolicyModal
        visible={modalType !== null}
        type={modalType!}
        onClose={() => setModalType(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
    paddingHorizontal: 10,
  },
  checkbox: {
    marginRight: 10,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  agreementText: {
    fontSize: 13,
    color: '#666',
  },
  link: {
    color: '#007AFF',
    fontWeight: '500',
  },
});