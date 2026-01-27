"use client";

import { Button } from "@/components/ui/button";
import { ChevronRight, Home, ArrowLeft } from "lucide-react";

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface FileBreadcrumbProps {
  pathStack: BreadcrumbItem[];
  onBreadcrumbClick: (index: number) => void;
  onGoBack: () => void;
}

export function FileBreadcrumb({
  pathStack,
  onBreadcrumbClick,
  onGoBack,
}: FileBreadcrumbProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center text-sm text-muted-foreground gap-1">
        {pathStack.map((folder, i) => (
          <span key={i} className="flex items-center">
            <button
              onClick={() => onBreadcrumbClick(i)}
              className="hover:text-primary transition-colors"
            >
              {i === 0 ? (
                <Home className="inline h-4 w-4 mr-1" />
              ) : (
                folder.name
              )}
            </button>
            {i < pathStack.length - 1 && (
              <ChevronRight className="h-4 w-4 mx-1 opacity-60" />
            )}
          </span>
        ))}
      </div>

      {pathStack.length > 1 && (
        <Button variant="ghost" size="sm" onClick={onGoBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      )}
    </div>
  );
}
