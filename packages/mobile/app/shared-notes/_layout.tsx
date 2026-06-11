import { Stack } from 'expo-router';
import { QuoteHeader } from '@/lib/components/QuoteHeader';

export default function SharedNotesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        header: () => <QuoteHeader />,
      }}
    >
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" />
    </Stack>
  );
}