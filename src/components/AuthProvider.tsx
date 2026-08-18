import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Branch } from '../types/database';
import { db, getActiveUserSession, setActiveUserSession } from '../lib/db';

interface AuthContextType {
  user: User | null;
  activeBranchId: string; // 'all' or branch UUID
  setActiveBranchId: (id: string) => void;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permissionName: string) => boolean;
  isAdmin: boolean;
  availableBranches: Branch[];
  allUsersList: User[];
  reloadSession: () => void;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeBranchId, setActiveBranchIdState] = useState<string>('all');
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [allUsersList, setAllUsersList] = useState<User[]>([]);

  const loadSession = async () => {
    const sessionUser = getActiveUserSession();
    setUser(sessionUser);

    // Fetch branches for selection
    const branches = await db.branches.getAll();
    setAvailableBranches(branches);

    // Fetch all users list for login switcher simulation
    const users = await db.users.getAll();
    setAllUsersList(users);

    if (sessionUser) {
      // Set default active branch to user's branch
      // Super Admins can select 'all' branches, other roles are pinned to their branch
      const role = await db.roles.getById(sessionUser.role_id);
      if (role?.name === 'Super Admin') {
        setActiveBranchIdState('all');
      } else {
        setActiveBranchIdState(sessionUser.branch_id);
      }

      // Load permissions
      const rps = await db.rolePermissions.getByRoleId(sessionUser.role_id);
      const allPerms = await db.permissions.getAll();
      const perms = rps.map(rp => {
        const p = allPerms.find(perm => perm.id === rp.permission_id);
        return p ? p.name : '';
      }).filter(Boolean);
      
      setRolePermissions(perms);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  const login = async (email: string, password?: string): Promise<boolean> => {
    const users = await db.users.getAll();
    const found = users.find(u => 
      u.email.toLowerCase() === email.toLowerCase() && 
      (!password || u.password === password || (!u.password && password === 'password'))
    );
    if (found) {
      setActiveUserSession(found);
      setUser(found);
      
      // Load branch options & permissions
      const branches = await db.branches.getAll();
      setAvailableBranches(branches);

      const role = await db.roles.getById(found.role_id);
      if (role?.name === 'Super Admin') {
        setActiveBranchIdState('all');
      } else {
        setActiveBranchIdState(found.branch_id);
      }

      const rps = await db.rolePermissions.getByRoleId(found.role_id);
      const allPerms = await db.permissions.getAll();
      const perms = rps.map(rp => {
        const p = allPerms.find(perm => perm.id === rp.permission_id);
        return p ? p.name : '';
      }).filter(Boolean);
      setRolePermissions(perms);

      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('azizi_active_session');
    setUser(null);
    setRolePermissions([]);
    setActiveBranchIdState('all');
  };

  const hasPermission = (permissionName: string): boolean => {
    if (!user) return false;
    // Super Admins bypass permission constraints
    const isSuperAdmin = _isAdmin();
    if (isSuperAdmin) return true;
    
    return rolePermissions.includes(permissionName);
  };

  const _isAdmin = (): boolean => {
    if (!user) return false;
    const adminRole = allUsersList.find(u => u.id === user.id)?.role;
    return adminRole?.name === 'Super Admin';
  };

  const setActiveBranchId = (id: string) => {
    // If not super admin, restrict toggling
    if (!_isAdmin() && user) {
      setActiveBranchIdState(user.branch_id);
    } else {
      setActiveBranchIdState(id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeBranchId,
        setActiveBranchId,
        login,
        logout,
        hasPermission,
        isAdmin: _isAdmin(),
        availableBranches,
        allUsersList,
        reloadSession: loadSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
