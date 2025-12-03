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
          title: '首页',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons 
              name="home" 
              size={size} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '搜索',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons 
              name="magnify" 
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
    </Tabs>
  );
}
