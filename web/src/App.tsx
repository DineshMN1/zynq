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
import AdminLayout from './pages/admin/layout';
import AdminUsersPage from './pages/dashboard/settings/users';
import AdminNotificationsPage from './pages/dashboard/settings/notifications';
import AdminMonitoringPage from './pages/dashboard/settings/monitoring';
import TeamLayout from './pages/team/layout';
import TeamFilesPage from './pages/team/files';
import TeamActivityPage from './pages/team/activity';
import TeamMembersPage from './pages/team/members';
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
      </Route>

      {/* Admin panel — separate layout with its own sidebar */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/users" replace />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="monitoring" element={<AdminMonitoringPage />} />
      </Route>

      {/* Team space — separate layout with its own sidebar */}
      <Route path="/team" element={<TeamLayout />}>
        <Route index element={<Navigate to="/team/files" replace />} />
        <Route path="files" element={<TeamFilesPage />} />
        <Route path="photos" element={<TeamFilesPage />} />
        <Route path="docs" element={<TeamFilesPage />} />
        <Route path="videos" element={<TeamFilesPage />} />
        <Route path="audio" element={<TeamFilesPage />} />
        <Route path="code" element={<TeamFilesPage />} />
        <Route path="others" element={<TeamFilesPage />} />
        <Route path="activity" element={<TeamActivityPage />} />
        <Route path="members" element={<TeamMembersPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
