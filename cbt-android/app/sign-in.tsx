import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { AppButton, ErrorBanner, Field, Screen } from '../lib/ui';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setFieldError(null);
    if (!email || !password) {
      setFieldError('Isi email dan kata sandi.');
      return;
    }
    setSubmitting(true);
    const res = await signIn(email.trim(), password);
    setSubmitting(false);
    if (res.ok) {
      // Navigasi ke dashboard; AuthProvider.loadProfile akan memuat role.
      router.replace('/');
    } else {
      setFieldError(res.error ?? 'Gagal masuk.');
    }
  };

  return (
    <Screen title="Masuk">
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="nama@email.com" keyboardType="email-address" />
        <Field label="Kata Sandi" value={password} onChangeText={setPassword} placeholder="• • • • • • • •" secureTextEntry />
        <ErrorBanner message={fieldError} />
        <AppButton title={submitting ? 'Masuk...' : 'Masuk'} onPress={handleSignIn} disabled={submitting} />
        <AppButton
          title="Belum punya akun? Daftar"
          onPress={() => router.push('/sign-up')}
          style={{ backgroundColor: '#1a202c' }}
        />
      </View>
    </Screen>
  );
}
