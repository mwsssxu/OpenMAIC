import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { PolicyModal } from './PolicyModal';

interface PolicyAgreementProps {
  checked: boolean;
  onCheck: (checked: boolean) => void;
}

export function PolicyAgreement({ checked, onCheck }: PolicyAgreementProps) {
  const [modalType, setModalType] = useState<'user-agreement' | 'privacy-policy' | null>(null);

  const handleCheckboxPress = () => {
    onCheck(!checked);
  };

  const handleLinkPress = (type: 'user-agreement' | 'privacy-policy') => {
    setModalType(type);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={handleCheckboxPress}
        activeOpacity={0.7}
      >
        <View style={[styles.checkboxBox, checked && styles.checkboxChecked]}>
          {checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>我同意</Text>
      </TouchableOpacity>

      <View style={styles.linksContainer}>
        <Text style={styles.linkText} onPress={() => handleLinkPress('user-agreement')}>
          用户协议
        </Text>
        <Text style={styles.separator}>与</Text>
        <Text style={styles.linkText} onPress={() => handleLinkPress('privacy-policy')}>
          隐私政策
        </Text>
      </View>

      {modalType && (
        <PolicyModal
          visible={true}
          type={modalType}
          onClose={() => setModalType(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  linksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  separator: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 4,
  },
});