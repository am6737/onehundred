import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AdminDataError } from '@/lib/admin/errors';
import { getAdminSupabaseClient, getSupabaseConfigStatus } from '@/lib/admin/supabase';
import type { AdminAuthState, AdminSession } from '@/lib/admin/types';
import { resolveAdminSession, restoreAdminSession, signInAdminWithPassword, signOutAdmin } from './adminAuth';

interface AdminAuthContextValue extends AdminAuthState {
  signIn(email: string, password: string): Promise<AdminSession>;
  signOut(): Promise<void>;
  refreshSession(): Promise<AdminSession | null>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function errorMessage(error: unknown) {
  if (error instanceof AdminDataError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unknown admin auth error.';
}

export function isExplicitDemoMode() {
  return import.meta.env.VITE_ADMIN_DATA_MODE?.trim().toLowerCase() === 'demo';
}

function demoState(): AdminAuthState {
  return {
    session: null,
    status: 'demo',
    error: 'Explicit VITE_ADMIN_DATA_MODE=demo. Admin login is bypassed and only demo repositories may be used.',
  };
}

function missingConfigState(reason: string): AdminAuthState {
  if (isExplicitDemoMode()) {
    return demoState();
  }
  return { session: null, status: 'error', error: reason };
}

function authErrorState(error: unknown): AdminAuthState {
  const message = errorMessage(error);
  if (error instanceof AdminDataError && (error.code === 'not_admin' || error.code === 'not_authenticated')) {
    return { session: null, status: 'unauthenticated', error: message };
  }
  return { session: null, status: 'error', error: message };
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const restoreStartedRef = useRef(false);
  const [state, setState] = useState<AdminAuthState>(() => {
    if (isExplicitDemoMode()) return demoState();
    const config = getSupabaseConfigStatus();
    if (!config.configured) {
      return missingConfigState(config.reason);
    }
    return { session: null, status: 'loading', error: null };
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetState = useCallback((nextState: React.SetStateAction<AdminAuthState>) => {
    if (isMountedRef.current) setState(nextState);
  }, []);

  const refreshSession = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (isExplicitDemoMode()) {
      safeSetState(demoState());
      return null;
    }
    const config = getSupabaseConfigStatus();
    if (!config.configured) {
      safeSetState(missingConfigState(config.reason));
      return null;
    }
    try {
      safeSetState((previous) => ({ ...previous, status: 'loading', error: null }));
      const adminSession = await restoreAdminSession();
      if (requestId !== requestIdRef.current) return adminSession;
      safeSetState({
        session: adminSession,
        status: adminSession ? 'authenticated' : 'unauthenticated',
        error: null,
      });
      return adminSession;
    } catch (error) {
      if (requestId === requestIdRef.current) safeSetState(authErrorState(error));
      return null;
    }
  }, [safeSetState]);

  useEffect(() => {
    if (isExplicitDemoMode()) return undefined;
    const config = getSupabaseConfigStatus();
    if (!config.configured) return undefined;

    let isCurrentSubscription = true;
    if (!restoreStartedRef.current) {
      restoreStartedRef.current = true;
      void refreshSession();
    }
    const {
      data: { subscription },
    } = getAdminSupabaseClient().auth.onAuthStateChange((_event, session) => {
      void resolveAdminSession(session)
        .then((adminSession) => {
          if (!isCurrentSubscription) return;
          safeSetState({
            session: adminSession,
            status: adminSession ? 'authenticated' : 'unauthenticated',
            error: null,
          });
        })
        .catch((error) => {
          if (!isCurrentSubscription) return;
          safeSetState(authErrorState(error));
        });
    });

    return () => {
      isCurrentSubscription = false;
      subscription.unsubscribe();
    };
  }, [refreshSession, safeSetState]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (isExplicitDemoMode()) {
      safeSetState(demoState());
      throw new AdminDataError('Demo mode does not use password sign in.', 'unsupported_admin_operation');
    }
    safeSetState((previous) => ({ ...previous, error: null }));
    try {
      const adminSession = await signInAdminWithPassword(email, password);
      safeSetState({ session: adminSession, status: 'authenticated', error: null });
      return adminSession;
    } catch (error) {
      safeSetState({ session: null, status: 'unauthenticated', error: errorMessage(error) });
      throw error;
    }
  }, [safeSetState]);

  const signOut = useCallback(async () => {
    await signOutAdmin();
    safeSetState({ session: null, status: 'unauthenticated', error: null });
  }, [safeSetState]);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      ...state,
      signIn,
      signOut,
      refreshSession,
    }),
    [refreshSession, signIn, signOut, state],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider.');
  return context;
}
