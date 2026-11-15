import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getWorkspaceBootstrapFn } from '@/lib/workspace.functions';
import type {
  MembershipWithInstitution,
  WorkspaceBootstrap,
} from '@/lib/workspace.server';
import { dbRoleToRoleKey, type RoleKey } from '@/lib/roles';

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  authHeaders: () => Record<string, string>;
  workspace: WorkspaceBootstrap | null;
  workspaceLoading: boolean;
  workspaceError: string | null;
  activeInstitutionId: string | null;
  activeMembership: MembershipWithInstitution | null;
  activeRoleKey: RoleKey | null;
  setActiveInstitutionId: (institutionId: string) => void;
  refreshWorkspace: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const ACTIVE_INST_STORAGE_PREFIX = 'examflow.active_institution.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
      if (!s) {
        setSelectedInstitutionId(null);
        queryClient.removeQueries({ queryKey: ['workspace-bootstrap'] });
      }
    });
    supabase.auth.getSession().then(({ data: sessionRes }) => {
      setSession(sessionRes.session);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const user = session?.user ?? null;
  const accessToken = session?.access_token ?? null;

  const authHeaders = useCallback((): Record<string, string> => {
    if (!accessToken) return {};
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const bootstrapQuery = useQuery({
    queryKey: ['workspace-bootstrap', user?.id],
    enabled: Boolean(user && accessToken),
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      if (!accessToken) throw new Error('Not authenticated');
      return getWorkspaceBootstrapFn({
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    },
  });

  const workspace = bootstrapQuery.data ?? null;

  // Restore saved institution selection ONLY if it exists in the server-verified memberships list.
  useEffect(() => {
    if (!user || !workspace) return;
    const validIds = new Set(workspace.memberships.map((m) => m.institution_id));
    if (selectedInstitutionId && validIds.has(selectedInstitutionId)) {
      return;
    }
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(`${ACTIVE_INST_STORAGE_PREFIX}${user.id}`);
    } catch {
      stored = null;
    }
    if (stored && validIds.has(stored)) {
      setSelectedInstitutionId(stored);
    } else {
      setSelectedInstitutionId(workspace.memberships[0]?.institution_id ?? null);
    }
  }, [user, workspace, selectedInstitutionId]);

  const setActiveInstitutionId = useCallback(
    (institutionId: string) => {
      if (!workspace || !user) return;
      const isMember = workspace.memberships.some((m) => m.institution_id === institutionId);
      if (!isMember) return; // Ignore untrusted / non-member institution IDs
      setSelectedInstitutionId(institutionId);
      try {
        localStorage.setItem(`${ACTIVE_INST_STORAGE_PREFIX}${user.id}`, institutionId);
      } catch {
        // Ignore storage write errors in private browsing
      }
    },
    [workspace, user],
  );

  const activeMembership = useMemo(() => {
    if (!workspace) return null;
    if (selectedInstitutionId) {
      const found = workspace.memberships.find((m) => m.institution_id === selectedInstitutionId);
      if (found) return found;
    }
    return workspace.memberships[0] ?? null;
  }, [workspace, selectedInstitutionId]);

  const activeInstitutionId = activeMembership?.institution_id ?? null;

  const activeRoleKey: RoleKey | null = useMemo(() => {
    if (activeMembership) return dbRoleToRoleKey(activeMembership.role);
    if (workspace?.isSuperAdmin) return 'super-admin';
    return null;
  }, [activeMembership, workspace]);

  const refreshWorkspace = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['workspace-bootstrap', user?.id] });
    await queryClient.invalidateQueries({ queryKey: ['institution-workspace'] });
    await queryClient.invalidateQueries({ queryKey: ['platform-overview'] });
  }, [queryClient, user?.id]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSelectedInstitutionId(null);
    queryClient.clear();
  }, [queryClient]);

  const workspaceError = bootstrapQuery.error
    ? bootstrapQuery.error instanceof Error
      ? bootstrapQuery.error.message
      : 'Failed to load workspace'
    : null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signOut,
        authHeaders,
        workspace,
        workspaceLoading: Boolean(user) && bootstrapQuery.isLoading,
        workspaceError,
        activeInstitutionId,
        activeMembership,
        activeRoleKey,
        setActiveInstitutionId,
        refreshWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
