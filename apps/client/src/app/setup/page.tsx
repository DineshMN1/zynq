"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Password strength indicator
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    match: false,
  });

  useEffect(() => {
    checkSetupStatus();
  }, []);

  useEffect(() => {
    // Update password strength
    setPasswordStrength({
      length: formData.password.length >= 8,
      match: formData.password.length > 0 && formData.password === formData.confirmPassword,
    });
  }, [formData.password, formData.confirmPassword]);

  const checkSetupStatus = async () => {
    try {
      const response = await authApi.checkSetupStatus();
      if (!response.needsSetup) {
        // Setup already complete, redirect to login
        router.push("/");
      }
    } catch (error) {
      console.error("Failed to check setup status:", error);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
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
        title: "Welcome to zynqCloud!",
        description: "Your administrator account has been created successfully.",
      });

      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard/files");
      }, 1000);
    } catch (err: any) {
      console.error("Registration failed:", err);

      // Parse error message
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

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Checking setup status...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">Welcome to zynqCloud</CardTitle>
            <CardDescription className="text-base">
              Create your administrator account to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={loading}
                  minLength={8}
                />

                {/* Password strength indicator */}
                {formData.password.length > 0 && (
                  <div className="space-y-1 mt-2">
                    <div className={`flex items-center gap-2 text-xs ${passwordStrength.length ? 'text-green-600' : 'text-gray-500'}`}>
                      <CheckCircle2 className={`h-3 w-3 ${passwordStrength.length ? 'text-green-600' : 'text-gray-400'}`} />
                      <span>At least 8 characters</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  disabled={loading}
                  minLength={8}
                />

                {/* Password match indicator */}
                {formData.confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-2 text-xs mt-2 ${passwordStrength.match ? 'text-green-600' : 'text-red-600'}`}>
                    <CheckCircle2 className={`h-3 w-3 ${passwordStrength.match ? 'text-green-600' : 'text-red-400'}`} />
                    <span>{passwordStrength.match ? 'Passwords match' : 'Passwords do not match'}</span>
                  </div>
                )}
              </div>

              <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                <p className="text-sm text-foreground">
                  <strong>Administrator Account:</strong> This account will have full access to all
                  features including user management, storage settings, and system configuration.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !passwordStrength.length || !passwordStrength.match}
                size="lg"
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
          </CardContent>
        </Card>
      </div>
      <ToastContainer />
    </>
  );
}
