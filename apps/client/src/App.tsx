import { Routes, Route, Navigate } from 'react-router-dom';

import IndexPage from './app/page';
import LoginPage from './app/(auth)/login/page';
import RegisterPage from './app/(auth)/register/page';
import ForgotPasswordPage from './app/(auth)/forgot-password/page';
import ResetPasswordPage from './app/(auth)/reset-password/page';
import SetupPage from './app/(auth)/setup/page';
import PublicSharePage from './app/share/[token]/page';
import DashboardLayout from './app/dashboard/layout';
import DashboardFilesPage from './app/dashboard/files/page';
import DashboardProfilePage from './app/dashboard/profile/page';
import DashboardTrashPage from './app/dashboard/trash/page';
import DashboardSharedPage from './app/dashboard/shared/page';
import DashboardShareTokenPage from './app/dashboard/share/[token]/page';
import DashboardSettingsPage from './app/dashboard/settings/page';
import DashboardSettingsUsersPage from './app/dashboard/settings/users/page';
import DashboardSettingsInvitesPage from './app/dashboard/settings/invites/page';
import DashboardSettingsNotificationsPage from './app/dashboard/settings/notifications/page';
import DashboardSettingsMonitoringPage from './app/dashboard/settings/monitoring/page';
import NotFoundPage from './app/not-found';

export default function App() {
  return (
    <Routes>
      {/* Root — redirects based on auth state */}
      <Route path="/" element={<IndexPage />} />

      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/setup" element={<SetupPage />} />

      {/* Public share (unauthenticated) */}
      <Route path="/share/:token" element={<PublicSharePage />} />

      {/* Protected dashboard — nested routes use <Outlet /> in layout */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard/files" replace />} />
        <Route path="files" element={<DashboardFilesPage />} />
        <Route path="profile" element={<DashboardProfilePage />} />
        <Route path="trash" element={<DashboardTrashPage />} />
        <Route path="shared" element={<DashboardSharedPage />} />
        <Route path="share/:token" element={<DashboardShareTokenPage />} />
        <Route path="settings" element={<DashboardSettingsPage />} />
        <Route path="settings/users" element={<DashboardSettingsUsersPage />} />
        <Route
          path="settings/invites"
          element={<DashboardSettingsInvitesPage />}
        />
        <Route
          path="settings/notifications"
          element={<DashboardSettingsNotificationsPage />}
        />
        <Route
          path="settings/monitoring"
          element={<DashboardSettingsMonitoringPage />}
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
