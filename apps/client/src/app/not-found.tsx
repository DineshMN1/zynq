"use client";

import Link from "next/link";
import { Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Render a centered 404 page UI for missing routes.
 *
 * @returns The 404 page as a React element containing an application header, a "404 : Page Not Found" heading, a brief explanatory paragraph, and a "Go Home" button that navigates to the root path.
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-background to-primary/5">
      <div className="flex flex-col items-center mb-6">
        <Cloud className="h-12 w-12 text-primary mb-2" />
        <span className="text-2xl font-bold">ZynqCloud</span>
      </div>

      <h1 className="text-3xl font-bold mb-2">404 : Page Not Found</h1>

      <p className="text-muted-foreground mb-6 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist, was moved, or is no longer available.
      </p>

      <Button asChild size="lg">
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}