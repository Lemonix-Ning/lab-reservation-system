import { createContext, useContext, ReactNode, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useRole } from './RoleContext';

interface PermissionContextType {
  permissions: string[];
  isLoading: boolean;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
}

const PermissionContext = createContext<PermissionContextType>({
  permissions: [],
  isLoading: true,
  hasPermission: () => false,
  hasAnyPermission: () => false,
});

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentRole } = useRole();
  
  const { data: permissions = [], isLoading } = trpc.permission.myPermissions.useQuery(
    undefined,
    { enabled: !!user }
  );

  const value = useMemo(() => ({
    permissions,
    isLoading,
    hasPermission: (code: string) => {
      // 使用 currentRole（可能是切换后的角色）而不是 user.role
      if (currentRole === 'sysAdmin') return true;
      return permissions.includes(code);
    },
    hasAnyPermission: (codes: string[]) => {
      if (currentRole === 'sysAdmin') return true;
      return codes.some(code => permissions.includes(code));
    },
  }), [permissions, isLoading, currentRole]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  return useContext(PermissionContext);
}
