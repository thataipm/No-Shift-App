import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { COLORS, FONTS } from '../../constants/theme';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: focused ? '◉' : '○',
    parking: focused ? '▣' : '□',
    progress: focused ? '▲' : '△',
    history: focused ? '■' : '◻',
    settings: focused ? '⚙' : '⚙',
  };
  return (
    <View style={{ alignItems: 'center' }}>
      {/* Using text as tab icons to avoid extra icon library */}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <View testID="tab-home-icon" style={[styles.iconDot, focused && styles.iconDotActive]} />
          ),
        }}
      />
      <Tabs.Screen
        name="parking"
        options={{
          title: 'Ideas',
          tabBarIcon: ({ focused }) => (
            <View testID="tab-parking-icon" style={[styles.iconDot, focused && styles.iconDotActive]} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ focused }) => (
            <View testID="tab-progress-icon" style={[styles.iconDot, focused && styles.iconDotActive]} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => (
            <View testID="tab-history-icon" style={[styles.iconDot, focused && styles.iconDotActive]} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <View testID="tab-settings-icon" style={[styles.iconDot, focused && styles.iconDotActive]} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 10,
    paddingBottom: 24,
    height: 76,
  },
  tabLabel: {
    fontFamily: FONTS.label,
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  iconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textTertiary,
    marginBottom: 2,
  },
  iconDotActive: {
    backgroundColor: COLORS.primary,
    width: 20,
    borderRadius: 3,
  },
});
