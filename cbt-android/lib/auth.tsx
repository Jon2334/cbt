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
  /**
   * true bila ada sesi Supabase aktif — walau profil (RPC) belum selesai dimuat.
   * Dipakai untuk membedakan "belum login" (→ /sign-in) dari "sudah login tapi
   * profil masih dimuat" (→ tampilkan loading, JANGAN tendang balik ke /sign-in).
   */
  hasSession: boolean;
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
  const [hasSession, setHasSession] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Simpan fetch profile ter-cancel (hindari set state setelah unmount).
  const fetchSeq = useRef(0);

  // Terapkan sesi yang sudah diketahui → validasi role lewat RPC server-side.
  // Dipakai BAIK dari getSession (mount/refresh) maupun dari event
  // onAuthStateChange, sehingga kita tidak perlu memanggil getSession() lagi
  // di dalam callback auth (pola yang dilarang supabase-js).
  const applySession = useCallback(async (session: { access_token: string } | null) => {
    const seq = ++fetchSeq.current;

    // Ditandai SEBELUM await: event SIGNED_IN datang lebih dulu daripada
    // selesainya RPC profil, jadi layar tujuan (app/index.tsx) bisa menampilkan
    // "memuat profil" alih-alih melempar pengguna kembali ke /sign-in.
    setHasSession(session !== null);

    if (!session) {
      setProfile(null);
      setAuthError(null);
      setReady(true);
      return;
    }

    try {
      // Guard utama: role tak pernah diambil dari auth.user, tapi dari RPC
      // get_current_profile() (SECURITY INVOKER) yang memvalidasi auth.uid().
      const { data: profileRow, error: rpcErr } = await supabase.rpc('get_current_profile');
      if (seq !== fetchSeq.current) return;

      if (rpcErr) {
        // Contoh: profil belum dibuat (trigger signup belum jalan) atau
        // koneksi terputus. Jangan pernah menganggap ini "siswa terverifikasi".
        setProfile(null);
        setAuthError(rpcErr.message || 'Gagal memuat profil.');
        return;
      }

      // Supabase RPC mengembalikan array karena RETURN TYPE-nya `profiles`.
      const row: Profile | null = Array.isArray(profileRow)
        ? ((profileRow[0] as Profile) ?? null)
        : ((profileRow as Profile) ?? null);
      setProfile(row);
      setAuthError(null);
    } catch (e) {
      // Exception apa pun (network mati, JSON rusak) harus tetap menutup
      // status "ready" — kalau tidak, layar mentok di "Memverifikasi sesi...".
      if (seq !== fetchSeq.current) return;
      setProfile(null);
      setAuthError(e instanceof Error ? e.message : 'Gagal memuat profil.');
    } finally {
      if (seq === fetchSeq.current) setReady(true);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setProfile(null);
      setAuthError(error.message);
      setReady(true);
      return;
    }
    await applySession(data.session);
  }, [applySession]);

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
    setHasSession(false);
    setAuthError(null);
    setReady(true);
  }, []);

  // Init + subscribe auth state.
  useEffect(() => {
    let cancelled = false;

    // Saat mount: cek sesi tersimpan (persist via AsyncStorage di lib/supabase).
    void loadProfile();

    // supabase-js v2: onAuthStateChange menerima SATU callback dan
    // mengembalikan { data: { subscription } } untuk unsubscribe.
    // PENTING: callback ini sinkron & dipanggil dari dalam rantai lock auth.
    // Karena itu kita memakai `session` yang dikirim event, bukan memanggil
    // supabase.auth.getSession() lagi di dalamnya.
    const { data: authData } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (cancelled) return;
      if (session) {
        // Sesi aktif (termasuk refresh token) → muat profile + role.
        void applySession(session);
      } else {
        setProfile(null);
        setHasSession(false);
        setAuthError(null);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      authData?.subscription?.unsubscribe?.();
    };
  }, [loadProfile, applySession]);

  const value = useMemo<AuthShape>(
    () => ({
      profile,
      ready,
      hasSession,
      role: profile?.role ?? null,
      isStudent: profile?.role === 'student',
      authError,
      signIn,
      signUp,
      signOut,
      refreshProfile: loadProfile,
    }),
    [profile, ready, hasSession, authError, signIn, signUp, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthShape {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider.');
  return ctx;
}
