"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { Loader2, ShieldCheck, CheckCircle2, Cloud, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Renders the initial administrator setup page and manages the setup flow (status check, form validation, registration, login, and redirects).
 *
 * @returns The React element for the initial administrator setup UI.
 */
export default function SetupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
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
    checkSetupStatus();
  }, []);

  useEffect(() => {
    setPasswordStrength({
      length: formData.password.length >= 8,
      match: formData.password.length > 0 && formData.password === formData.confirmPassword,
    });
  }, [formData.password, formData.confirmPassword]);

  const checkSetupStatus = async () => {
    try {
      const response = await authApi.checkSetupStatus();
      if (!response.needsSetup) {
        router.push("/login");
      }
    } catch (error) {
      console.error("Failed to check setup status:", error);
    } finally {
      setChecking(false);
    }
  };

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
        description: "Your administrator account has been created successfully.",
      });

      setTimeout(() => {
        router.push("/dashboard/files");
      }, 1000);
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

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-lg font-medium">Checking setup status...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <Cloud className="h-10 w-10 text-primary" />
              <span className="text-3xl font-bold">ZynqCloud</span>
            </Link>
          </div>

          <Card className="border-2 shadow-xl">
            <CardHeader className="text-center space-y-4 pb-2">
              <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Initial Setup</CardTitle>
                <CardDescription className="text-base mt-2">
                  Create your administrator account to get started
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
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
                    className="h-11"
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
                    className="h-11"
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
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  {formData.password.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <div className={`flex items-center gap-2 text-xs transition-colors ${passwordStrength.length ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        <CheckCircle2 className={`h-3.5 w-3.5 ${passwordStrength.length ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                        <span>At least 8 characters</span>
                      </div>
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
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  {formData.confirmPassword.length > 0 && (
                    <div className={`flex items-center gap-2 text-xs mt-2 transition-colors ${passwordStrength.match ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                      <CheckCircle2 className={`h-3.5 w-3.5 ${passwordStrength.match ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`} />
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
                  className="w-full h-11 text-base font-medium"
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
            </CardContent>
          </Card>
        </motion.div>
      </div>
      <ToastContainer />
    </>
  );
}