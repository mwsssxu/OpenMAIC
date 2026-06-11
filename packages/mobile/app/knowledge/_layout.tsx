import React from 'react';
import { Stack } from 'expo-router';
import { QuoteHeader } from '@/lib/components/QuoteHeader';

export default function KnowledgeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        header: () => <QuoteHeader />,
      }}
    >
      <Stack.Screen name="[id]" />
    </Stack>
  );
}