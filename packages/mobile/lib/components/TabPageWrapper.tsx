import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveDimensions, responsiveValue, ResponsiveSpacing } from '@/lib/utils/responsive';

interface TabPageWrapperProps {
  children: React.ReactNode;
  hasHeader?: boolean;
}

/**
 * 包装 Tab 页面的组件，添加底部 padding 以避免被 TabBar 遮挡
 * TabBar 由 _layout.tsx 统一渲染，此处不再重复渲染
 *
 * 响应式特性：
 * - 手机：全宽布局，底部适配 TabBar
 * - 平板：添加水平边距，更大的底部 padding
 */
export const TabPageWrapper: React.FC<TabPageWrapperProps> = ({ children, hasHeader }) => {
  const insets = useSafeAreaInsets();
  const { breakpoint, isTablet } = useResponsiveDimensions();

  // TabBar 高度 = 基础高度 + 安全区域 + padding
  // 基础高度随设备类型变化
  const baseTabBarHeight = responsiveValue(
    { compact: 49, regular: 49, medium: 56, large: 60 },
    breakpoint
  );
  const tabBarHeight = baseTabBarHeight + insets.bottom + 8;

  // 平板上添加水平边距
  const horizontalPadding = responsiveValue(
    ResponsiveSpacing.sm,
    breakpoint
  );

  return (
    <View style={[
      styles.container,
      {
        paddingTop: hasHeader ? 0 : Math.max(insets.top, 44), // 确保至少44px顶部空间
        paddingHorizontal: isTablet ? horizontalPadding : 0,
      }
    ]}>
      <View style={[styles.content, { paddingBottom: tabBarHeight }]}>
        {children}
      </View>
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
  },
});

export default TabPageWrapper;