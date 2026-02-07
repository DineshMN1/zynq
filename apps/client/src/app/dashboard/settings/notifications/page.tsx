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
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Mail,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Bell,
  Send,
} from "lucide-react";
import { smtpApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    smtp_host: "",
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: "",
    smtp_pass: "",
    smtp_from: "",
  });

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
      const data = await smtpApi.getSettings();
      setFormData({
        smtp_host: data.smtp_host || "",
        smtp_port: data.smtp_port || 587,
        smtp_secure: data.smtp_secure || false,
        smtp_user: data.smtp_user || "",
        smtp_pass: data.smtp_pass || "",
        smtp_from: data.smtp_from || "",
      });
    } catch (err) {
      console.error("Failed to load SMTP settings:", err);
      setError("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      await smtpApi.updateSettings({
        smtp_host: formData.smtp_host,
        smtp_port: formData.smtp_port,
        smtp_secure: formData.smtp_secure,
        smtp_user: formData.smtp_user || undefined,
        smtp_pass: formData.smtp_pass || undefined,
        smtp_from: formData.smtp_from,
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

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await smtpApi.testConnection();
      setTestResult(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setTestResult({
          success: false,
          message: err.message || "Connection test failed.",
        });
      } else {
        setTestResult({
          success: false,
          message: "Connection test failed.",
        });
      }
    } finally {
      setTesting(false);
    }
  };

  if (!user || loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

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

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bell className="h-8 w-8" />
          Notifications
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure notification channels for system alerts and user communications
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email (SMTP)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                SMTP Configuration
              </CardTitle>
              <CardDescription>
                Configure email notifications for password resets, invitations, and system alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp_host">SMTP Host</Label>
                  <Input
                    id="smtp_host"
                    placeholder="smtp.gmail.com"
                    value={formData.smtp_host}
                    onChange={(e) =>
                      setFormData({ ...formData, smtp_host: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_port">SMTP Port</Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    placeholder="587"
                    value={formData.smtp_port}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        smtp_port: parseInt(e.target.value) || 587,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use SSL/TLS (Secure)</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable for port 465, disable for port 587 with STARTTLS
                  </p>
                </div>
                <Switch
                  checked={formData.smtp_secure}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, smtp_secure: checked })
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp_user">Username</Label>
                  <Input
                    id="smtp_user"
                    placeholder="your-email@gmail.com"
                    value={formData.smtp_user}
                    onChange={(e) =>
                      setFormData({ ...formData, smtp_user: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_pass">Password / App Password</Label>
                  <div className="relative">
                    <Input
                      id="smtp_pass"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.smtp_pass}
                      onChange={(e) =>
                        setFormData({ ...formData, smtp_pass: e.target.value })
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_from">From Address</Label>
                <Input
                  id="smtp_from"
                  placeholder='ZynqCloud <no-reply@yourdomain.com>'
                  value={formData.smtp_from}
                  onChange={(e) =>
                    setFormData({ ...formData, smtp_from: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  The sender address that appears in emails (e.g., &quot;ZynqCloud
                  &lt;no-reply@example.com&gt;&quot;)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Connection</CardTitle>
              <CardDescription>
                Verify that your SMTP settings are correct by testing the connection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !formData.smtp_host}
              >
                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test SMTP Connection
              </Button>

              {testResult && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg ${
                    testResult.success
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0" />
                  )}
                  <span className="text-sm">{testResult.message}</span>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
