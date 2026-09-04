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
  const [loading, setLoading] = useState(true);
  const [activeBranchId, setActiveBranchIdState] = useState<string>('all');
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [allUsersList, setAllUsersList] = useState<User[]>([]);

  const computePermissions = async (currentUser: User): Promise<string[]> => {
    if (!currentUser.role_id) return [];
    try {
      const rps = await db.rolePermissions.getByRoleId(currentUser.role_id);
      const allPerms = await db.permissions.getAll();
      return rps.map(rp => {
        const p = allPerms.find(perm => perm.id === rp.permission_id);
        return p ? p.name : '';
      }).filter(Boolean);
    } catch (e) {
      console.error('Failed to load role permissions:', e);
      return [];
    }
  };

  const isSuperOrOwner = (targetUser: User | null): boolean => {
    if (!targetUser) return false;
    const roleName = targetUser.role?.name?.toLowerCase() || '';
    if (roleName === 'super admin' || roleName === 'owner') return true;
    const foundUser = allUsersList.find(u => u.id === targetUser.id);
    const foundRoleName = foundUser?.role?.name?.toLowerCase() || '';
    return foundRoleName === 'super admin' || foundRoleName === 'owner';
  };

  const loadSession = async () => {
    setLoading(true);
    try {
      // Fetch branches for selection
      const branches = await db.branches.getAll();
      setAvailableBranches(branches);

      // Fetch all users list for login switcher simulation
      const users = await db.users.getAll();
      setAllUsersList(users);

      const saved = localStorage.getItem('azizi_active_session');
      let sessionUser: User | null = null;
      if (saved) {
        const cached = getActiveUserSession();
        if (cached) {
          // Sync with the latest user object from database
          const fresh = users.find(u => u.id === cached.id);
          sessionUser = fresh ? { ...cached, ...fresh } : cached;
          setActiveUserSession(sessionUser);
        }
      }
      setUser(sessionUser);

      if (sessionUser) {
        // Set default active branch to user's branch
        // Super Admins & Owners can select 'all' branches, other roles default to their branch
        const role = sessionUser.role_id ? await db.roles.getById(sessionUser.role_id) : null;
        const roleName = role?.name?.toLowerCase() || '';
        if (roleName === 'super admin' || roleName === 'owner') {
          setActiveBranchIdState('all');
        } else {
          setActiveBranchIdState(sessionUser.branch_id || 'all');
        }

        // Load role-based permissions
        const perms = await computePermissions(sessionUser);
        setRolePermissions(perms);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

      const role = found.role_id ? await db.roles.getById(found.role_id) : null;
      const roleName = role?.name?.toLowerCase() || '';
      if (roleName === 'super admin' || roleName === 'owner') {
        setActiveBranchIdState('all');
      } else {
        setActiveBranchIdState(found.branch_id || 'all');
      }

      const perms = await computePermissions(found);
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

  const _isAdmin = (): boolean => {
    return isSuperOrOwner(user);
  };

  const hasPermission = (permissionName: string): boolean => {
    if (!user) return false;
    // Super Admins & Owners bypass permission constraints
    if (_isAdmin()) return true;
    
    // Check role permissions strictly
    return rolePermissions.includes(permissionName);
  };

  const setActiveBranchId = (id: string) => {
    // If not super admin or owner, restrict toggling
    if (!_isAdmin() && user) {
      setActiveBranchIdState(user.branch_id || 'all');
    } else {
      setActiveBranchIdState(id);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <div className="text-xs font-semibold text-muted-foreground animate-pulse">Initializing Azizi ERP...</div>
      </div>
    );
  }

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
