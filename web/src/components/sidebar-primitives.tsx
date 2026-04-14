/**
 * Shared sidebar primitives used by both the main AppSidebar and the
 * Team sidebar. Keep this file free of any sidebar-state or auth logic.
 */
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ── Logo ──────────────────────────────────────────────────────────────────────
export function ZynqLogo({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg bg-white shadow-sm flex items-center justify-center p-0.5"
    >
      <img src="/favicon.ico" alt="ZynqCloud" className="w-full h-full object-contain rounded-md" />
    </div>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────
export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: 'bg-violet-500/10 text-violet-500',
    admin: 'bg-blue-500/10 text-blue-500',
    user:  'bg-muted text-muted-foreground',
  };
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[9.5px] font-semibold capitalize', styles[role] ?? styles.user)}>
      {role}
    </span>
  );
}

// ── Tooltip wrapper (collapsed-only) ─────────────────────────────────────────
export function NavTooltip({
  label,
  children,
  collapsed,
}: {
  label: string;
  children: React.ReactNode;
  collapsed: boolean;
}) {
  if (!collapsed) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs font-medium">{label}</TooltipContent>
    </Tooltip>
  );
}

// ── Nav item ──────────────────────────────────────────────────────────────────
export interface NavItemProps {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
  badge?: number;
}

export function NavItem({ href, label, icon: Icon, active, collapsed, badge }: NavItemProps) {
  return (
    <NavTooltip label={label} collapsed={collapsed}>
      <Link
        to={href}
        className={cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
          'outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          collapsed && 'justify-center px-2',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.75 rounded-r-full bg-primary" />
        )}
        <Icon
          className={cn(
            'shrink-0 transition-colors duration-150',
            collapsed ? 'h-4.5 w-4.5' : 'h-4 w-4',
            active
              ? 'text-primary'
              : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80',
          )}
          strokeWidth={active ? 2.2 : 1.8}
        />
        {!collapsed && (
          <>
            <span className="flex-1 truncate leading-none">{label}</span>
            {badge != null && badge > 0 && (
              <span className="ml-auto shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                {badge}
              </span>
            )}
          </>
        )}
      </Link>
    </NavTooltip>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
export function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-1.5 h-px bg-sidebar-border/50 mx-2" />;
  return (
    <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 first:mt-2">
      {label}
    </p>
  );
}

// ── Icon action button ────────────────────────────────────────────────────────
export function IconAction({
  icon: Icon,
  label,
  onClick,
  danger = false,
  className,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            danger
              ? 'text-muted-foreground/60 hover:bg-red-500/10 hover:text-red-500'
              : 'text-muted-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            className,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}
