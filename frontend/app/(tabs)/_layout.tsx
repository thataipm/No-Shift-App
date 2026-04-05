import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: COLORS.borderSubtle,
          paddingTop: 10,
          paddingBottom: 24,
          height: 76,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarLabelStyle: {
          fontFamily: FONTS.label,
          fontSize: 11,
          letterSpacing: 0.5,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <View testID="tab-home-icon">
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="parking"
        options={{
          title: 'Ideas',
          tabBarIcon: ({ focused, color }) => (
            <View testID="tab-parking-icon">
              <Ionicons
                name={focused ? 'bulb' : 'bulb-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ focused, color }) => (
            <View testID="tab-progress-icon">
              <Ionicons
                name={focused ? 'bar-chart' : 'bar-chart-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused, color }) => (
            <View testID="tab-history-icon">
              <Ionicons
                name={focused ? 'time' : 'time-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <View testID="tab-settings-icon">
              <Ionicons
                name={focused ? 'settings-sharp' : 'settings-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
