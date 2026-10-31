import { useState, type ComponentProps, type PropsWithChildren, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from './theme';
import type { Role, TabKey } from './types';

export function CuritText({ children, style, weight = 'regular', ...props }: PropsWithChildren<{ style?: StyleProp<TextStyle>; weight?: keyof typeof fonts } & ComponentProps<typeof Text>>) {
  return <Text {...props} style={[styles.text, { fontFamily: fonts[weight] }, style]}>{children}</Text>;
}

export function ScreenFrame({ children, footer }: PropsWithChildren<{ footer?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.outer}>
      <View style={[styles.phone, { paddingTop: insets.top, paddingBottom: footer ? 0 : insets.bottom }]}>
        <View style={styles.flex}>{children}</View>
        {footer ? <View style={{ paddingBottom: insets.bottom }}>{footer}</View> : null}
      </View>
    </View>
  );
}

export function Header({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: () => void; action?: ReactNode }) {
  return (
    <View style={styles.header}>
      {back ? <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={back} hitSlop={12} style={styles.headerSide}><Icon name="back" /></Pressable> : <View style={styles.headerSide} />}
      <View style={styles.headerTitleWrap}>
        <CuritText weight="bold" numberOfLines={1} style={styles.headerTitle}>{title}</CuritText>
        {subtitle ? <CuritText numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</CuritText> : null}
      </View>
      <View style={[styles.headerSide, styles.headerAction]}>{action}</View>
    </View>
  );
}

const paths: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  discover: 'M11 19a8 8 0 1 1 5.3-2l4.8 4.8-1.4 1.4-4.8-4.8A8 8 0 0 1 11 19Zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z',
  chat: 'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 6h12v2H6zm0-3h12v2H6z',
  management: 'M4 3h16a2 2 0 0 1 2 2v4H2V5a2 2 0 0 1 2-2Zm-2 8h9v11H4a2 2 0 0 1-2-2zm11 0h9v9a2 2 0 0 1-2 2h-7z',
  my: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-9 9a9 9 0 0 1 18 0v1H3z',
  back: 'M15.5 5 8.5 12l7 7-1.5 1.5L5.5 12 14 3.5z',
  chevron: 'm9 5 7 7-7 7-1.5-1.5L13 12 7.5 6.5z',
  qr: 'M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm8-2h3v3h-3zm5 0h3v5h-3zm-5 5h5v3h-5zm7 2h1v1h-1z',
  store: 'M3 9h18l-2-6H5zm2 2h14v10H5zm3 3v7h3v-7zm6 0v4h3v-4z',
  heart: 'M12 21s-8-4.6-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.4-8 11-8 11z',
};

export function Icon({ name, size = 22, color = colors.ink }: { name: keyof typeof paths; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={paths[name]} fill={color} /></Svg>;
}

export function BottomNav({ role, active, onChange }: { role: Role; active: TabKey; onChange: (tab: TabKey) => void }) {
  const labels: [TabKey, string][] = [
    ['home', '홈'], ['discover', '탐색'], ['chat', '채팅'], ['management', role === 'creator' ? '협업관리' : '매장 관리'], ['my', '마이'],
  ];
  return (
    <View style={styles.bottomNav}>
      {labels.map(([key, label]) => {
        const selected = key === active;
        return (
          <Pressable key={key} style={styles.navItem} onPress={() => onChange(key)} accessibilityRole="button" accessibilityState={{ selected }}>
            <Icon name={key} size={21} color={selected ? colors.brand : colors.subtle} />
            <CuritText weight={selected ? 'semibold' : 'regular'} style={[styles.navLabel, selected && styles.navLabelActive]}>{label}</CuritText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary', disabled }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button_${variant}`], (pressed || disabled) && { opacity: .62 }]}>
      <CuritText weight="semibold" style={[styles.buttonText, variant !== 'primary' && { color: colors.ink }]}>{label}</CuritText>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const accessibilityLabel = props.accessibilityLabel ?? props.label;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = props.secureTextEntry === true;
  const { style, ...inputProps } = props;
  return (
    <View style={styles.fieldWrap}>
      {props.label ? <CuritText weight="semibold" style={styles.fieldLabel}>{props.label}</CuritText> : null}
      <View style={isPassword ? styles.passwordField : undefined}>
        <TextInput
          placeholderTextColor="#B7B7B7"
          {...inputProps}
          secureTextEntry={isPassword && !passwordVisible}
          accessibilityLabel={accessibilityLabel}
          style={[styles.field, isPassword && styles.passwordInput, style]}
        />
        {isPassword ? <Pressable
          accessibilityRole="button"
          accessibilityLabel={passwordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
          hitSlop={8}
          style={styles.passwordToggle}
          onPress={() => setPasswordVisible(value => !value)}
        ><CuritText weight="semibold" style={styles.passwordToggleText}>{passwordVisible ? '숨기기' : '보기'}</CuritText></Pressable> : null}
      </View>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityState={onPress ? { selected: Boolean(active) } : undefined} disabled={!onPress} hitSlop={onPress ? 8 : undefined} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><CuritText weight={active ? 'semibold' : 'regular'} style={[styles.chipText, active && { color: colors.surface }]}>{label}</CuritText></Pressable>;
}

export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionTitle}><CuritText weight="bold" style={{ fontSize: 18 }}>{title}</CuritText>{action ? <Pressable accessibilityRole="button" disabled={!onPress} hitSlop={10} onPress={onPress} style={styles.sectionAction}><CuritText style={{ color: colors.muted }}>{action}</CuritText></Pressable> : null}</View>;
}

export function Empty({ title, description }: { title: string; description: string }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><Icon name="chat" color={colors.brand} /></View><CuritText weight="bold" style={{ fontSize: 16 }}>{title}</CuritText><CuritText style={styles.emptyDescription}>{description}</CuritText></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  text: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  outer: { flex: 1, backgroundColor: Platform.OS === 'web' ? colors.canvas : colors.surface, alignItems: 'center' },
  phone: { width: '100%', maxWidth: 430, flex: 1, backgroundColor: colors.surface, ...Platform.select({ web: { boxShadow: '0 8px 40px rgba(0,0,0,.10)' } as ViewStyle }) },
  header: { minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  headerSide: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerAction: { alignItems: 'flex-end' },
  headerTitleWrap: { flex: 1, minWidth: 0, alignItems: 'center' },
  headerTitle: { width: '100%', flexShrink: 1, textAlign: 'center', fontSize: 17 },
  headerSubtitle: { width: '100%', flexShrink: 1, color: colors.muted, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  bottomNav: { height: 74, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', backgroundColor: colors.surface },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  navLabel: { color: colors.subtle, fontSize: 10, lineHeight: 12 },
  navLabelActive: { color: colors.brand },
  button: { minHeight: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  button_primary: { backgroundColor: colors.brand },
  button_secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  button_ghost: { backgroundColor: 'transparent' },
  buttonText: { color: colors.surface, fontSize: 15 },
  fieldWrap: { gap: 8 }, fieldLabel: { fontSize: 13 },
  field: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 15, fontFamily: fonts.regular, color: colors.ink, backgroundColor: colors.surface },
  passwordField: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 76 },
  passwordToggle: { position: 'absolute', right: 6, minWidth: 58, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  passwordToggleText: { color: colors.brand, fontSize: 12 },
  chip: { minHeight: 44, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, lineHeight: 15 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionAction: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 10 },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  emptyDescription: { color: colors.muted, textAlign: 'center' },
});
