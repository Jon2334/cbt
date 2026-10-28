import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from './supabase';
import type { Profile } from '../types/cbt';
import type { UserRole } from './role';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole;
  /** True until the initial session/ profile has been resolved on load. */
  loading: boolean;
  /** Recoverable auth error surfaced when the profile cannot be loaded. */
  authError: string | null;
}

export interface AuthActions {
  signIn: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

interface AuthContextValue extends AuthState, AuthActions {}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}

/**
 * Persist the authenticated session and the user's role so the rest of the app
 * can render role-specific UI. The role is read from the `profiles` table (RLS
 * protected) — it is never trusted from the client token alone.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchProfile = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,full_name,role,email,created_at,updated_at')
        .eq('id', uid)
        .single();
      if (error) {
        // Do NOT wipe a previously-resolved profile on a transient refresh
        // failure: keeping the last-known role avoids dropping role to null,
        // which previously caused a dashboard <-> login redirect loop.
        // Callers inspect the null return to decide how to react.
        // eslint-disable-next-line no-console
        console.error('Failed to load profile', error.message);
        return null;
      }
      setProfile(data as Profile);
      return data as Profile;
    },
    []
  );

  // Hydrate the initial session from storage and resolve the profile BEFORE
  // reporting the initial load complete. Previously setLoading(false) fired
  // while fetchProfile was still in flight, so role was null + loading was
  // false -> RequireAuth bounced to /login while PublicRoute bounced back to
  // /dashboard -> "Maximum update depth exceeded".
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setSession(session ?? null);
      setUser(session?.user ?? null);
      if (!session?.user) {
        if (active) setLoading(false);
        return;
      }
      const resolved = await fetchProfile(session.user.id);
      if (!active) return;
      if (!resolved) {
        // The role lives in `profiles` (RLS-protected, never trusted from the
        // token). Without it we cannot authorize. Surface a RECOVERABLE error
        // and finish loading so the route guard can render a sign-out screen.
        // We deliberately do NOT auto signOut() here: that would trigger the
        // SIGNED_OUT event in onAuthStateChange, which clears authError and
        // races this set — hiding the message the user needs to recover.
        setAuthError(
          'Profil pengguna tidak dapat dimuat. Silakan masuk kembali.'
        );
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchProfile]);

  // React to future auth changes (login, logout, token refresh).
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      setUser(session?.user ?? null);
      if (session?.user) {
        setAuthError(null);
        void fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setAuthError(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        return { ok: false, error: error.message };
      }
      // Resolve the profile (role) before the caller navigates away, so the
      // dashboard guard never renders with role=null. A failed profile load
      // here is a hard failure at login -> report it instead of navigating.
      if (data.user) {
        const resolved = await fetchProfile(data.user.id);
        if (!resolved) {
          return {
            ok: false,
            error: 'Profil pengguna tidak dapat dimuat. Coba masuk kembali.',
          };
        }
      }
      return { ok: true };
    },
    [fetchProfile]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setAuthError(null);
  }, []);

  const value: AuthContextValue = {
    session,
    user,
    profile,
    role: (profile?.role ?? null) as UserRole,
    loading,
    authError,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
