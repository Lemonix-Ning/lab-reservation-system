import { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';

type UserRole = 'student' | 'teacher' | 'labAdmin' | 'sysAdmin';

type RoleContextType = {
  devRole: UserRole | null;
  setDevRole: (role: UserRole | null) => void;
  currentRole: UserRole;
  isAdmin: boolean;
  isTeacher: boolean;
  isLabAdmin: boolean;
  isSysAdmin: boolean;
};

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // 从 localStorage 恢复 devRole
  const [devRole, setDevRole] = useState<UserRole | null>(() => {
    const saved = localStorage.getItem('dev-role-override');
    return saved as UserRole | null;
  });
  
  // 保存 devRole 到 localStorage
  const setDevRoleWithPersist = (role: UserRole | null) => {
    setDevRole(role);
    if (role) {
      localStorage.setItem('dev-role-override', role);
    } else {
      localStorage.removeItem('dev-role-override');
    }
  };
  
  // 处理旧数据兼容性：admin -> sysAdmin, user -> student
  const normalizeRole = (role?: string): UserRole => {
    if (!role) return 'student';
    if (role === 'admin') return 'sysAdmin';
    if (role === 'user') return 'student';
    return (role as UserRole) || 'student';
  };
  
  const userRole = normalizeRole(user?.role);
  const currentRole = devRole || userRole;
  
  const isSysAdmin = currentRole === 'sysAdmin';
  const isLabAdmin = currentRole === 'labAdmin';
  const isTeacher = currentRole === 'teacher';
  const isStudent = currentRole === 'student';
  const isAdmin = isSysAdmin || isLabAdmin; // admin 代表任何管理角色

  return (
    <RoleContext.Provider value={{ devRole, setDevRole: setDevRoleWithPersist, currentRole, isAdmin, isTeacher, isLabAdmin, isSysAdmin }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
