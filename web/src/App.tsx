import { Routes, Route, Navigate } from 'react-router-dom';

import IndexPage from './pages/home';
import LoginPage from './pages/auth/login';
import RegisterPage from './pages/auth/register';
import ForgotPasswordPage from './pages/auth/forgot-password';
import ResetPasswordPage from './pages/auth/reset-password';
import SetupPage from './pages/auth/setup';
import PublicSharePage from './pages/share/public-share';
import DashboardLayout from './pages/dashboard/layout';
import DashboardFilesPage from './pages/dashboard/files';
import DashboardProfilePage from './pages/dashboard/profile';
import DashboardTrashPage from './pages/dashboard/trash';
import DashboardSharedPage from './pages/dashboard/shared';
import DashboardShareTokenPage from './pages/dashboard/share-detail';
import DashboardSettingsPage from './pages/dashboard/settings/index';
import DashboardSettingsUsersPage from './pages/dashboard/settings/users';
import DashboardSettingsNotificationsPage from './pages/dashboard/settings/notifications';
import DashboardSettingsMonitoringPage from './pages/dashboard/settings/monitoring';
import NotFoundPage from './pages/not-found';

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
