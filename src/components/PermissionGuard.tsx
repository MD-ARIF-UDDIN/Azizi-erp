import React from 'react';
import { useAuth } from './AuthProvider';
import { ShieldAlert } from 'lucide-react';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission: string;
  fallback?: 'none' | 'ui';
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  fallback = 'none'
}) => {
  const { hasPermission } = useAuth();
  const isAuthorized = hasPermission(permission);

  if (isAuthorized) {
    return <>{children}</>;
  }

  if (fallback === 'none') {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-border bg-card/40 backdrop-blur-sm max-w-xl mx-auto space-y-4 shadow-xl">
      <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
        <ShieldAlert size={24} />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-lg text-foreground">Access Denied</h3>
        <p className="text-sm text-muted-foreground">
          Your account role does not have authorization to view or manage this module.
        </p>
      </div>
      <div className="text-xs text-muted-foreground/80 bg-secondary/30 px-3 py-1.5 rounded-lg border border-border">
        Required Permission: <code className="text-primary font-bold">{permission}</code>
      </div>
    </div>
  );
};
