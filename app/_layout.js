import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LogBox } from 'react-native';

// 忽略特定警告
LogBox.ignoreLogs([
  'Text strings must be rendered within a <Text> component',
]);

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="comic/[id]" />
        <Stack.Screen name="reader/[chapterId]" />
        <Stack.Screen name="series/[id]" />
        <Stack.Screen name="player/[episodeId]" />
      </Stack>
    </GestureHandlerRootView>
  );
}
