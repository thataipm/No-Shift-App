export const COLORS = {
  bg: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  surfaceHighest: '#2E2E2E',
  surfaceContainer: '#1F1F1F',
  overlay: 'rgba(15, 15, 15, 0.92)',

  primary: '#BA7517',
  primaryMuted: 'rgba(186, 117, 23, 0.15)',
  primaryDim: 'rgba(186, 117, 23, 0.55)',
  onPrimary: '#000000',
  adminAccent: '#185FA5',

  tertiaryContainer: '#FFB8AE',
  onTertiary: '#3B0000',
  outlineVariant: 'rgba(255, 255, 255, 0.12)',

  textPrimary: 'rgba(255, 255, 255, 0.92)',
  textSecondary: 'rgba(255, 255, 255, 0.60)',
  textTertiary: 'rgba(255, 255, 255, 0.38)',

  borderSubtle: 'rgba(255, 255, 255, 0.07)',
  borderActive: 'rgba(186, 117, 23, 0.35)',

  success: '#2E7D32',
  danger: '#D32F2F',
  dangerMuted: 'rgba(211, 47, 47, 0.15)',
};

export const FONTS = {
  heading: 'PlayfairDisplay_700Bold',
  headingMedium: 'PlayfairDisplay_600SemiBold',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  label: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

export const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const RADIUS = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
};

export const CARD_STYLE = {
  backgroundColor: COLORS.surface,
  borderRadius: RADIUS.lg,
  padding: SPACING.lg,
  borderWidth: 1,
  borderColor: COLORS.borderSubtle,
};
