"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  HardDrive,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { adminApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const GB = 1024 * 1024 * 1024;
const TB = 1024 * GB;

const PRESETS = [
  { label: "5 GB", value: 5 * GB },
  { label: "10 GB", value: 10 * GB },
  { label: "50 GB", value: 50 * GB },
  { label: "100 GB", value: 100 * GB },
  { label: "1 TB", value: TB },
  { label: "Unlimited", value: 0 },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "Unlimited";
  if (bytes >= TB) return `${(bytes / TB).toFixed(1)} TB`;
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${bytes} bytes`;
}

function bytesToGB(bytes: number): string {
  if (bytes === 0) return "0";
  return (bytes / GB).toFixed(2);
}

function gbToBytes(gb: string): number {
  const num = parseFloat(gb);
  if (isNaN(num) || num <= 0) return 0;
  return Math.floor(num * GB);
}

export default function StorageSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [bulkResult, setBulkResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [defaultLimitGB, setDefaultLimitGB] = useState("10");
  const [maxLimitGB, setMaxLimitGB] = useState("0");

  useEffect(() => {
    if (user && !isAdmin) {
      router.push("/dashboard/settings");
    } else if (user) {
      loadSettings();
    }
  }, [user, isAdmin, router]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getStorageSettings();
      setDefaultLimitGB(bytesToGB(data.default_storage_limit));
      setMaxLimitGB(bytesToGB(data.max_storage_limit));
    } catch (err) {
      console.error("Failed to load storage settings:", err);
      setError("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    const defaultLimit = gbToBytes(defaultLimitGB);
    const maxLimit = gbToBytes(maxLimitGB);

    // Validate: default cannot exceed max (if max is set)
    if (maxLimit > 0 && defaultLimit > maxLimit) {
      setError("Default storage limit cannot exceed maximum storage limit.");
      setSaving(false);
      return;
    }

    try {
      await adminApi.updateStorageSettings({
        default_storage_limit: defaultLimit,
        max_storage_limit: maxLimit,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to save settings.");
      } else {
        setError("Failed to save settings.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdate = async () => {
    setBulkUpdating(true);
    setBulkResult(null);

    try {
      const result = await adminApi.bulkUpdateStorageLimits();
      setBulkResult({
        success: true,
        message: `Successfully updated ${result.updatedCount} users to ${formatBytes(result.appliedLimit)}.`,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setBulkResult({
          success: false,
          message: err.message || "Bulk update failed.",
        });
      } else {
        setBulkResult({
          success: false,
          message: "Bulk update failed.",
        });
      }
    } finally {
      setBulkUpdating(false);
    }
  };

  const applyPreset = (value: number, target: "default" | "max") => {
    const gbValue = value === 0 ? "0" : bytesToGB(value);
    if (target === "default") {
      setDefaultLimitGB(gbValue);
    } else {
      setMaxLimitGB(gbValue);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center text-center">
              <XCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You do not have permission to access this page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Storage Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure default and maximum storage limits for users
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Limits
          </CardTitle>
          <CardDescription>
            Set the default storage limit for new users and the maximum allowed
            limit. Set to 0 for unlimited.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default_limit">Default Storage Limit (GB)</Label>
              <Input
                id="default_limit"
                type="number"
                step="0.1"
                min="0"
                placeholder="10"
                value={defaultLimitGB}
                onChange={(e) => setDefaultLimitGB(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Storage quota assigned to new users. Current:{" "}
                {formatBytes(gbToBytes(defaultLimitGB))}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset.value, "default")}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_limit">Maximum Storage Limit (GB)</Label>
              <Input
                id="max_limit"
                type="number"
                step="0.1"
                min="0"
                placeholder="0 (unlimited)"
                value={maxLimitGB}
                onChange={(e) => setMaxLimitGB(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Maximum storage quota that can be assigned to any user. 0 = no
                cap. Current: {formatBytes(gbToBytes(maxLimitGB))}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset.value, "max")}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Bulk Update
          </CardTitle>
          <CardDescription>
            Apply the default storage limit to all existing users. This will
            override their current storage limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={bulkUpdating}>
                {bulkUpdating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Apply Default to All Users
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will update the storage limit for ALL users to the
                  current default limit ({formatBytes(gbToBytes(defaultLimitGB))}
                  ). This action cannot be easily undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkUpdate}>
                  Yes, Update All Users
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {bulkResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                bulkResult.success
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {bulkResult.success ? (
                <CheckCircle className="h-5 w-5 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0" />
              )}
              <span className="text-sm">{bulkResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
        {saved && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Settings saved successfully!
          </p>
        )}
      </div>
    </div>
  );
}
