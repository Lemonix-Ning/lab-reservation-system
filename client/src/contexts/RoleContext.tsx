import { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';

type RoleContextType = {
  devRole: 'admin' | 'student' | null;
  setDevRole: (role: 'admin' | 'student' | null) => void;
  currentRole: 'admin' | 'student' | 'user';
  isAdmin: boolean;
};

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [devRole, setDevRole] = useState<'admin' | 'student' | null>(null);
  
  // 映射 user role 到 student
  const userRole = user?.role === 'user' ? 'student' : (user?.role as 'admin' | 'student' || 'student');
  const currentRole = devRole || userRole || 'student';
  const isAdmin = currentRole === 'admin';

  return (
    <RoleContext.Provider value={{ devRole, setDevRole, currentRole, isAdmin }}>
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
