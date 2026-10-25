import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { AppButton, ErrorBanner, Field, Screen } from '../lib/ui';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSignUp = async () => {
    setFieldError(null);
    if (!fullName || !email || !password) {
      setFieldError('Lengkapi nama, email, dan kata sandi.');
      return;
    }
    if (password.length < 6) {
      setFieldError('Kata sandi minimal 6 karakter.');
      return;
    }
    setSubmitting(true);
    const res = await signUp(fullName.trim(), email.trim(), password);
    setSubmitting(false);

    if (res.ok) {
      // Trigger handle_new_user membuat profil otomatis.
      if (res.needsEmailConfirm) {
        setFieldError('Akun terdaftar. Konfirmasi email dulu, lalu masuk.');
      } else {
        // Sesi otomsis ada (tanpa konfirmasi email) → masuk ke dashboard.
        router.replace('/');
      }
    } else {
      setFieldError(res.error ?? 'Gagal mendaftar.');
    }
  };

  return (
    <Screen title="Daftar">
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Field label="Nama Lengkap" value={fullName} onChangeText={setFullName} placeholder="Nama lengkap" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="nama@email.com" keyboardType="email-address" />
        <Field label="Kata Sandi" value={password} onChangeText={setPassword} placeholder="minimal 6 karakter" secureTextEntry />
        <ErrorBanner message={fieldError} />
        <AppButton title={submitting ? 'Mendaftar...' : 'Daftar'} onPress={handleSignUp} disabled={submitting} />
        <AppButton
          title="Sudah punya akun? Masuk"
          onPress={() => router.replace('/sign-in')}
          style={{ backgroundColor: '#1a202c' }}
        />
      </View>
    </Screen>
  );
}
