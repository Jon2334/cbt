// Komponen UI dasar reusable di seluruh layar.
// Pakai StyleSheet bawaan RN (bukan dependensi eksternal).
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({
  children,
  title,
  right,
}: {
  children: React.ReactNode;
  title?: string;
  right?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </SafeAreaView>
  );
}

export function AppButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[styles.btn, disabled ? styles.btnDisabled : null, style]}
    activeOpacity={0.8}
    >
      <Text style={styles.btnText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        placeholderTextColor="#888"
        autoCapitalize="none"
      />
    </View>
  );
}

export function Body({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Spinner() {
  return <ActivityIndicator style={{ alignSelf: 'center', marginVertical: 24 }} size="large" color="#2979ff" />;
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

export function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create<{
  screen: ViewStyle;
  header: ViewStyle;
  title: TextStyle;
  body: TextStyle;
  error: TextStyle;
  row: ViewStyle;
  btn: ViewStyle;
  btnDisabled: ViewStyle;
  btnText: TextStyle;
  field: ViewStyle;
  label: TextStyle;
  input: TextStyle;
}>({
  screen: { flex: 1, backgroundColor: '#0f1324', padding: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { color: '#e8eaf6', fontSize: 20, fontWeight: '600' },
  body: { color: '#b0bec5', fontSize: 14, lineHeight: 20 },
  error: { color: '#ff8a80', fontSize: 13, marginVertical: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  btn: {
    backgroundColor: '#2979ff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  field: { marginBottom: 14 },
  label: { color: '#cfd8dc', fontSize: 13, marginBottom: 4 },
  input: {
    backgroundColor: '#1d2733',
    color: '#eceff1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
