"use client";

import { Button } from "@/components/ui/button";
import { ChevronRight, Home, ArrowLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface FileBreadcrumbProps {
  pathStack: BreadcrumbItem[];
  onBreadcrumbClick: (index: number) => void;
  onGoBack: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function FileBreadcrumb({
  pathStack,
  onBreadcrumbClick,
  onGoBack,
  onRefresh,
  isRefreshing,
}: FileBreadcrumbProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Back button */}
      {pathStack.length > 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onGoBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Breadcrumb path - Nextcloud style */}
      <nav className="flex items-center min-w-0 flex-1 overflow-x-auto no-scrollbar">
        <ol className="flex items-center gap-1 text-sm">
          {pathStack.map((folder, i) => (
            <li key={i} className="flex items-center">
              <button
                onClick={() => onBreadcrumbClick(i)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors",
                  "hover:bg-muted",
                  i === pathStack.length - 1
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {i === 0 ? (
                  <>
                    <Home className="h-4 w-4" />
                    <span className="hidden sm:inline">Home</span>
                  </>
                ) : (
                  <span className="truncate max-w-[120px] sm:max-w-[180px]" title={folder.name}>
                    {folder.name}
                  </span>
                )}
              </button>
              {i < pathStack.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Refresh button */}
      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      )}
    </div>
  );
}
