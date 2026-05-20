import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IOSTabBar from './IOSTabBar';

interface TabPageWrapperProps {
  children: React.ReactNode;
  hasHeader?: boolean;
}

/**
 * 包装 Tab 页面的组件，添加底部 padding 以避免被 TabBar 遮挡
 */
export const TabPageWrapper: React.FC<TabPageWrapperProps> = ({
  children,
  hasHeader = false
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.container,
      { paddingTop: hasHeader ? 0 : insets.top }
    ]}>
      <View style={styles.content}>
        {children}
      </View>
      <IOSTabBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f3f2',
  },
  content: {
    flex: 1,
    paddingBottom: 83, // 为 TabBar 留出空间
  },
});

export default TabPageWrapper;