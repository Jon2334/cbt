import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from './supabase';
import type { Profile } from './types';

// ---------------------------------------------------------------------------
// AuthProvider — sumber kebenaran sesi & profil siswa.
//
// PRINSIP:
//  - Sesi dibaca dari supabase (supabase.auth.getSession + onAuthStateChange).
//  - Role TIDAK pernah diturunkan langsung dari auth.user; kita panggil RPC
//    get_current_profile() (SECURITY INVOKER) yang di server memvalidasi
//    auth.uid() dan mengembalikan profil dengan role sesungguhnya.
//  - Ini berarti login "demo palsu" tidak akan lolos: session asli + role
//    server-side wajib tersedia sebelum fitur siswa dikunci dibuka.
// ---------------------------------------------------------------------------

type AuthShape = {
  profile: Profile | null;
  /** true setelah sesi awal & profil selesai dimuat (untuk mencegah flash). */
  ready: boolean;
  /** Peran yang terkonfirmasi; null jika belum ada profile. */
  role: Profile['role'] | null;
  isStudent: boolean;
  /** Token sesaat untuk refresh setelah re-auth. */
  authError: string | null;

  signIn(email: string, password: string): Promise<{ ok: boolean; error: string | null }>;
  signUp(fullName: string, email: string, password: string): Promise<{ ok: boolean; needsEmailConfirm: boolean; error: string | null }>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
};

const AuthContext = createContext<AuthShape | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Simpan fetch profile ter-cancel (hindari set state setelah unmount).
  const fetchSeq = useRef(0);

  const loadProfile = useCallback(async () => {
    const seq = ++fetchSeq.current;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setProfile(null);
      setReady(true);
      return;
    }

    const session = data.session;
    if (!session) {
      setProfile(null);
      setAuthError(null);
      setReady(true);
      return;
    }

    // Validasi role via RPC server-side (get_current_profile). Ini guard utama.
    const { data: profileRow, error: rpcErr } = await supabase.rpc('get_current_profile');
    if (seq !== fetchSeq.current) return;

    if (rpcErr) {
      // Contoh: profile belum dibuat, atau koneksi terputus. Tidak dianggap
      // "student terverifikasi" — set authError agar UI bisa memblok.
      setProfile(null);
      setAuthError(rpcErr.message || 'Gagal memuat profil.');
      setReady(true);
      return;
    }

    // Supabase RPC mengembalikan array karena RETURN TYPE-nya `profiles`.
    const row: Profile | null = Array.isArray(profileRow) ? profileRow[0] : (profileRow as Profile);
    setProfile(row ?? null);
    setAuthError(null);
    setReady(true);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      return { ok: false, error: error.message };
    }
    // Sesi berubah → onAuthStateChange akan memuat ulang profile otomatis.
    setAuthError(null);
    return { ok: true, error: null };
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    // Trigger handle_new_user (004_auth_trigger_role_safe.sql) membuat profil
    // secara otomatis setelah signup. Kita wajibkan full_name; role
    // diset 'student' di server (tidak bisa dipilih user).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      setAuthError(error.message);
      return { ok: false, needsEmailConfirm: false, error: error.message };
    }
    // data.user ada tapi data.session null → konfirmasi email diperlukan.
    const needsEmailConfirm = !data.session;
    return {
      ok: true,
      needsEmailConfirm,
      error: null,
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setAuthError(null);
    setReady(true);
  }, []);

  // Init + subscribe auth state.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    // Saat mount: cek sesi tersimpan (persist via AsyncStorage di lib/supabase).
    loadProfile();

    // supabase-js v2: onAuthStateChange menerima SATU callback dan
    // mengembalikan { data: { subscription } } untuk unsubscribe.
    const { data: authData } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (cancelled) return;
      if (session) {
        // Sesi aktif (termasuk refresh token) → muat profile + role.
        loadProfile();
      } else {
        setProfile(null);
        setReady(true);
      }
    });
    unsub = () => authData?.subscription?.unsubscribe?.();

    // JALAN: jika API onAuthStateChange hanya menerima callback (tanpa return
    // unsubscribe), gunakan versi standar.
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [loadProfile]);

  const value = useMemo<AuthShape>(
    () => ({
      profile,
      ready,
      role: profile?.role ?? null,
      isStudent: profile?.role === 'student',
      authError,
      signIn,
      signUp,
      signOut,
      refreshProfile: loadProfile,
    }),
    [profile, ready, authError, signIn, signUp, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthShape {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider.');
  return ctx;
}
