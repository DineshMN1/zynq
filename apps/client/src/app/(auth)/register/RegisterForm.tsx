'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  CheckCircle2,
  HardDrive,
  Eye,
  EyeOff,
  XCircle,
} from 'lucide-react';
import { authApi, inviteApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const errorText = err.message;
    const jsonMatch = errorText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const errorData = JSON.parse(jsonMatch[0]) as { message?: string };
        if (typeof errorData.message === 'string') {
          return errorData.message;
        }
      } catch {
        return errorText || fallback;
      }
    }
    return errorText || fallback;
  }

  if (typeof err === 'string') return err;
  return fallback;
}

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteValidationError, setInviteValidationError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Password strength indicator
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    match: false,
  });

  useEffect(() => {
    const token = searchParams.get('invite') || searchParams.get('inviteToken');
    if (token) {
      setInviteToken(token);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!inviteToken) return;

    let isActive = true;
    const validateInvite = async () => {
      setInviteLoading(true);
      setInviteValidationError('');
      try {
        const result = await inviteApi.validate(inviteToken);
        if (!isActive) return;
        setFormData((prev) => ({ ...prev, email: result.email }));
      } catch (err) {
        if (!isActive) return;
        setInviteValidationError(
          getErrorMessage(err, 'Invalid or expired invitation'),
        );
      } finally {
        if (!isActive) return;
        setInviteLoading(false);
      }
    };

    validateInvite();
    return () => {
      isActive = false;
    };
  }, [inviteToken]);

  useEffect(() => {
    // Update password strength
    setPasswordStrength({
      length: formData.password.length >= 8,
      match:
        formData.password.length > 0 &&
        formData.password === formData.confirmPassword,
    });
  }, [formData.password, formData.confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const user = await authApi.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        inviteToken: inviteToken || undefined,
      });
      login(user);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  if (inviteToken && inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (inviteToken && inviteValidationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <HardDrive className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ZynqCloud</span>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Invalid Invitation</h2>
                <p className="text-sm text-muted-foreground">
                  Link can&apos;t be used.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>
                This invitation link is invalid, expired, or has been revoked.
              </p>
              <p>Please contact your administrator to request a new invite.</p>
            </div>
          </div>
          <Button asChild className="w-full h-10">
            <Link href="/login">Go to Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 bg-card border-r border-border flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <HardDrive className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">ZynqCloud</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Secure, self-hosted
            <br />
            file storage
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Create your account to start storing and sharing files with complete
            privacy and control.
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} ZynqCloud. All rights reserved.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <HardDrive className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ZynqCloud</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Create your account
            </h2>
            <p className="text-muted-foreground">
              {inviteToken
                ? 'Complete your registration with the invite'
                : 'Get started with ZynqCloud'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Tony Stark"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
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
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                disabled={loading || !!inviteToken}
                className="h-10"
              />
              {inviteToken && (
                <p className="text-xs text-muted-foreground">
                  This email is locked to your invitation.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
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
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {formData.password.length > 0 && (
                <div
                  className={`flex items-center gap-2 text-xs ${passwordStrength.length ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                >
                  {passwordStrength.length ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  <span>At least 8 characters</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
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
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {formData.confirmPassword.length > 0 && (
                <div
                  className={`flex items-center gap-2 text-xs ${passwordStrength.match ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
                >
                  {passwordStrength.match ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {passwordStrength.match
                      ? 'Passwords match'
                      : 'Passwords do not match'}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10"
              disabled={
                loading || !passwordStrength.length || !passwordStrength.match
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
