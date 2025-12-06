import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6200EE',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '漫画',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons 
              name="book-open-variant" 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ebooks"
        options={{
          title: '电子书',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="book-open-page-variant"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: '视频',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="play-circle"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="favorite"
        options={{
          title: '收藏',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons 
              name="heart" 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '设置',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons 
              name="account"
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="novel"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
