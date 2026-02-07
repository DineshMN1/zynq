"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { Loader2, CheckCircle2, Eye, EyeOff, HardDrive, Shield } from "lucide-react";

/**
 * Render the initial administrator setup page and handle creation of the first admin account.
 *
 * The component gates rendering based on authentication state: it shows a loading spinner while auth is loading,
 * redirects to the login page if setup is not required, and otherwise displays a form to create an administrator account.
 * The form validates name and password fields, calls the registration API to create the account, establishes a session via `login`,
 * shows success or error toasts, and navigates to the dashboard on success.
 *
 * @returns The setup page UI as a JSX element.
 */
export default function SetupPage() {
  const router = useRouter();
  const { login, loading: authLoading, needsSetup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    match: false,
  });

  useEffect(() => {
    setPasswordStrength({
      length: formData.password.length >= 8,
      match: formData.password.length > 0 && formData.password === formData.confirmPassword,
    });
  }, [formData.password, formData.confirmPassword]);

  // If auth is still loading, show spinner
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If setup is not needed, redirect to login
  if (needsSetup === false) {
    router.replace('/login');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.name.length < 2) {
      toast({
        title: "Name too short",
        description: "Please enter your full name (at least 2 characters).",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please ensure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const user = await authApi.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      login(user);

      toast({
        title: "Welcome to ZynqCloud!",
        description: "Your administrator account has been created.",
      });

      setTimeout(() => {
        router.push("/dashboard/files");
      }, 500);
    } catch (err: any) {
      console.error("Registration failed:", err);

      let errorMessage = "Failed to create admin account.";
      if (err?.message) {
        try {
          const errorText = err.message;
          const jsonMatch = errorText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            errorMessage = errorData.message || errorMessage;
          }
        } catch {
          errorMessage = err.message;
        }
      }

      toast({
        title: "Setup failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex bg-background">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-card border-r border-border flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <HardDrive className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ZynqCloud</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight">
              Welcome to your<br />
              self-hosted cloud
            </h1>
            <p className="text-lg text-muted-foreground max-w-md">
              Set up your administrator account to get started.
              You&apos;ll have full control over users, storage, and security.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>End-to-end encrypted • Self-hosted • Full control</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ZynqCloud. All rights reserved.
          </p>
        </div>

        {/* Right side - Setup Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm space-y-8">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <HardDrive className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">ZynqCloud</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Initial Setup</h2>
              <p className="text-muted-foreground">
                Create your administrator account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={loading}
                  minLength={2}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={loading}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    disabled={loading}
                    minLength={8}
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formData.password.length > 0 && (
                  <div className={`flex items-center gap-2 text-xs ${passwordStrength.length ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>At least 8 characters</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    disabled={loading}
                    minLength={8}
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formData.confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-2 text-xs ${passwordStrength.match ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{passwordStrength.match ? 'Passwords match' : 'Passwords do not match'}</span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-md bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Administrator Account:</strong> This account will have full access to all
                  features including user management and system configuration.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-10"
                disabled={loading || !passwordStrength.length || !passwordStrength.match}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Administrator Account"
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}