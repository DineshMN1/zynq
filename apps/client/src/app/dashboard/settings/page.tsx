'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, X } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { settingsApi, brandingApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [telemetry, setTelemetry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [appName, setAppName] = useState('');
  const [brandingLoading, setBrandingLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdmin) {
      brandingApi
        .get()
        .then((data) => {
          setCurrentLogo(data.app_logo);
          setAppName(data.app_name || '');
        })
        .catch(() => {});
    }
  }, [isAdmin]);

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await settingsApi.update({ theme, telemetry });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be smaller than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBrandingSave = async () => {
    setBrandingLoading(true);
    try {
      await brandingApi.update({
        app_logo: logoPreview ?? currentLogo,
        app_name: appName,
      });
      if (logoPreview) {
        setCurrentLogo(logoPreview);
        setLogoPreview(null);
      }
      toast.success('Branding saved');
    } catch {
      toast.error('Failed to save branding');
    } finally {
      setBrandingLoading(false);
    }
  };

  const handleLogoReset = async () => {
    setBrandingLoading(true);
    try {
      await brandingApi.update({ app_logo: null });
      setCurrentLogo(null);
      setLogoPreview(null);
      toast.success('Logo removed');
    } catch {
      toast.error('Failed to remove logo');
    } finally {
      setBrandingLoading(false);
    }
  };

  const displayLogo = logoPreview ?? currentLogo;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your application preferences
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>
              Customize the app logo and name shown in the sidebar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>App Logo</Label>
              <div className="flex items-center gap-4">
                {displayLogo ? (
                  <div className="relative h-12 w-12 rounded-lg border border-border overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayLogo}
                      alt="App logo"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-lg border border-dashed border-border flex items-center justify-center shrink-0 bg-muted">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-3.5 w-3.5" />
                    {displayLogo ? 'Change' : 'Upload'}
                  </Button>
                  {(currentLogo || logoPreview) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogoReset}
                      disabled={brandingLoading}
                    >
                      <X className="mr-2 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, SVG up to 2MB. Displayed at 32x32px in the sidebar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="app-name">App Name</Label>
              <Input
                id="app-name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="ZynqCloud"
                className="max-w-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the default name.
              </p>
            </div>

            <Button onClick={handleBrandingSave} disabled={brandingLoading}>
              {brandingLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Branding
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose between light and dark theme
              </p>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) =>
                setTheme(checked ? 'dark' : 'light')
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>
            Control your data and privacy settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Anonymous Telemetry</Label>
              <p className="text-sm text-muted-foreground">
                Help us improve by sending anonymous usage data
              </p>
            </div>
            <Switch checked={telemetry} onCheckedChange={setTelemetry} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
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
