import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { UserProfile, UserRole } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  // During automated unit tests, keep storage isolated in-memory/mock to avoid unmigrated network timeouts
  if (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env?.NODE_ENV === 'test') {
    return false;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') {
    return false;
  }
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('your-carecircle-id')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// ============================================================================
// SUPABASE AUTHENTICATION SERVICE HELPERS
// ============================================================================

export async function signUpUser(params: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  timezone: string;
}): Promise<{ user: User | null; session: Session | null; error: string | null }> {
  if (!supabase) {
    return { user: null, session: null, error: 'Database is not configured' };
  }

  const { data, error } = await supabase.auth.signUp({
    email: params.email.trim().toLowerCase(),
    password: params.password,
    options: {
      data: {
        full_name: params.fullName.trim(),
        role: params.role,
        timezone: params.timezone,
      },
    },
  });

  if (error) {
    return { user: null, session: null, error: error.message };
  }

  // Ensure public.profiles record is created/upserted immediately
  if (data.user) {
    const profilePayload = {
      id: data.user.id,
      email: params.email.trim().toLowerCase(),
      full_name: params.fullName.trim(),
      role: params.role,
      timezone: params.timezone,
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    if (profileError) {
      console.warn('[CareCircle Auth] Profile upsert notice:', profileError.message);
    }
  }

  return { user: data.user, session: data.session, error: null };
}

export async function signInUser(
  email: string,
  password: string
): Promise<{ user: User | null; session: Session | null; error: string | null }> {
  if (!supabase) {
    return { user: null, session: null, error: 'Database is not configured' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    return { user: null, session: null, error: error.message };
  }

  return { user: data.user, session: data.session, error: null };
}

export async function signOutUser(): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.auth.signOut();
  return { error: error ? error.message : null };
}

export async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Database is not configured' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  return { error: error ? error.message : null };
}

export async function updateUserPassword(newPassword: string): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Database is not configured' };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  return { error: error ? error.message : null };
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

