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

  const fetchProfile = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,full_name,role,email,created_at,updated_at')
        .eq('id', uid)
        .single();
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load profile', error.message);
        setProfile(null);
        return null;
      }
      setProfile(data as Profile);
      return data as Profile;
    },
    []
  );

  // Hydrate the initial session from storage.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) void fetchProfile(session.user.id);
      setLoading(false);
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
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        return { ok: false, error: error.message };
      }
      // Ensure the profile (and therefore the role) is resolved before
      // navigating away from the login page.
      if (data.user) {
        await fetchProfile(data.user.id);
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
  }, []);

  const value: AuthContextValue = {
    session,
    user,
    profile,
    role: (profile?.role ?? null) as UserRole,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
