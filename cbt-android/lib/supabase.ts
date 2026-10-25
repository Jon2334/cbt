import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Load Supabase configuration from environment variables.
// These are injected at build time via Expo's extra.config or process.env.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Validate that configuration is present before creating the client.
// This prevents silent failures when running without proper .env setup.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase is not configured. Please copy .env.example to .env and fill in your Supabase credentials.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
  },
});