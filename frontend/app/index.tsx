import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export default function Index() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
