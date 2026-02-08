'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  User,
  Mail,
  Shield,
  Calendar,
  Eye,
  EyeOff,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authApi, storageApi, type StorageOverview } from '@/lib/api';
import { formatBytes } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/toast-container';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message || fallback;
  }
  if (typeof err === 'string') return err;
  return fallback;
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [storageOverview, setStorageOverview] =
    useState<StorageOverview | null>(null);

  // Profile form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Password form
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    match: false,
  });

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadStorage = async () => {
      try {
        const overview = await storageApi.getOverview();
        setStorageOverview(overview);
      } catch (error) {
        console.error('Failed to load storage overview:', error);
      }
    };
    loadStorage();
  }, [user]);

  useEffect(() => {
    setPasswordStrength({
      length: passwordForm.newPassword.length >= 8,
      match:
        passwordForm.newPassword.length > 0 &&
        passwordForm.newPassword === passwordForm.confirmPassword,
    });
  }, [passwordForm.newPassword, passwordForm.confirmPassword]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter your name.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await authApi.updateProfile({ name: name.trim() });
      await refreshUser();
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: 'Update failed',
        description: 'Unable to update your profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordForm.currentPassword) {
      toast({
        title: 'Current password required',
        description: 'Please enter your current password.',
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'New password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure both passwords are the same.',
        variant: 'destructive',
      });
      return;
    }

    setPasswordLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      toast({
        title: 'Password changed',
        description: 'Your password has been updated successfully.',
      });
    } catch (error: unknown) {
      console.error('Failed to change password:', error);
      toast({
        title: 'Password change failed',
        description: getErrorMessage(
          error,
          'Unable to change password. Please check your current password.',
        ),
        variant: 'destructive',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const storageUsed = storageOverview?.user.usedBytes ?? user.storage_used ?? 0;
  const storageLimit =
    storageOverview?.user.quotaBytes ?? user.storage_limit ?? 0;
  const isUnlimited = storageLimit === 0;
  const usagePercentage = storageOverview
    ? Math.min(storageOverview.user.usedPercentage, 100)
    : isUnlimited
      ? 0
      : Math.min(Math.round((storageUsed / storageLimit) * 100), 100);
  const systemFreeBytes = storageOverview?.system.freeBytes ?? 0;
  const systemTotalBytes = storageOverview?.system.totalBytes ?? 0;

  return (
    <>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings
          </p>
        </div>

        {/* Profile Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-medium">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{user.name}</h2>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      user.role === 'owner'
                        ? 'default'
                        : user.role === 'admin'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Role:</span>
                <span className="capitalize">{user.role}</span>
              </div>
              {user.created_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Member since:</span>
                  <span>{formatDate(user.created_at)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Storage Usage Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage Usage
            </CardTitle>
            <CardDescription>Your current storage utilization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>{formatBytes(storageUsed)} used</span>
              <span>
                {isUnlimited ? 'Unlimited' : formatBytes(storageLimit)}
              </span>
            </div>
            <Progress
              value={usagePercentage}
              className={`h-2 ${
                usagePercentage >= 90
                  ? '[&>div]:bg-red-500'
                  : usagePercentage >= 75
                    ? '[&>div]:bg-amber-500'
                    : '[&>div]:bg-primary'
              }`}
            />
            <p className="text-xs text-muted-foreground">
              {storageOverview
                ? `${usagePercentage}% of system storage is used by you.`
                : isUnlimited
                  ? 'You have unlimited storage.'
                  : `${usagePercentage}% of your storage is used.`}
            </p>
            {storageOverview &&
              (user.role === 'admin' || user.role === 'owner') && (
                <p className="text-xs text-muted-foreground">
                  System free: {formatBytes(systemFreeBytes)} of{' '}
                  {formatBytes(systemTotalBytes)}
                </p>
              )}
          </CardContent>
        </Card>

        {/* Update Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Update Profile
            </CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact an administrator if needed.
                </p>
              </div>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword: e.target.value,
                      })
                    }
                    placeholder="Enter current password"
                    disabled={passwordLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    disabled={passwordLoading}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword: e.target.value,
                      })
                    }
                    placeholder="Enter new password"
                    disabled={passwordLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    disabled={passwordLoading}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {passwordForm.newPassword.length > 0 && (
                  <div
                    className={`flex items-center gap-2 text-xs ${passwordStrength.length ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>At least 8 characters</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="Confirm new password"
                    disabled={passwordLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    disabled={passwordLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {passwordForm.confirmPassword.length > 0 && (
                  <div
                    className={`flex items-center gap-2 text-xs ${passwordStrength.match ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
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
                disabled={
                  passwordLoading ||
                  !passwordStrength.length ||
                  !passwordStrength.match
                }
              >
                {passwordLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <ToastContainer />
    </>
  );
}
