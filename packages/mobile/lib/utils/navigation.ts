/**
 * Web-compatible navigation utilities
 *
 * router.back() may silently do nothing on web when navigation stack is empty.
 * window.history.back() works reliably on web browsers.
 */
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * Hook: returns a goBack function safe for both web and native.
 * Usage: const goBack = useGoBack(); goBack();
 */
export function useGoBack() {
  const router = useRouter();
  return () => {
    if (Platform.OS === 'web') {
      window.history.back();
    } else {
      router.back();
    }
  };
}

/**
 * Direct goBack — call inside a component that already has router.
 * Prefer useGoBack() hook for clarity.
 */
export function goBack(router: ReturnType<typeof useRouter>) {
  if (Platform.OS === 'web') {
    window.history.back();
  } else {
    router.back();
  }
}