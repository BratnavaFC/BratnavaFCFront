import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';
import Layout from './layout/Layout';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import GroupsPage from './pages/GroupsPage';
import GroupSettingsPage from './pages/GroupSettingsPage';
import PlayersPage from './pages/PlayersPage';
import TeamColorsPage from './pages/TeamColorsPage';
import MatchesPage from './pages/MatchesPage';
import HistoryPage from './pages/HistoryPage';
import MatchDetailsPage from './pages/MatchDetailsPage';
import UsersAdminPage from './pages/admin/UsersAdminPage';

export default function App(){
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="team-colors" element={<TeamColorsPage />} />
        <Route path="matches" element={<MatchesPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/:matchId" element={<MatchDetailsPage />} />

        <Route
          path="settings"
          element={
            <AdminRoute>
              <GroupSettingsPage />
            </AdminRoute>
          }
        />

        <Route
          path="admin/users"
          element={
            <AdminRoute>
              <UsersAdminPage />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
