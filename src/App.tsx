import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';
import GroupAdminRoute from './routes/GroupAdminRoute';
import Layout from './layout/Layout';
import { useAccountStore } from './auth/accountStore';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import GroupsPage from './pages/GroupsPage';
import GroupSettingsPage from './pages/GroupSettingsPage';
import TeamColorsPage from './pages/TeamColorsPage';
import MatchesPage from './pages/MatchesPage';
import HistoryPage from './pages/HistoryPage';
import MatchDetailsPage from './pages/MatchDetailsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import GodModeAdminPage from './pages/admin/GodModeAdminPage';
import GodModeRoute from './routes/GodModeRoute';
import VisualStatsPage from "./pages/VisualStatsPage";
import CalendarPage from './pages/CalendarPage';
import PaymentsPage from './pages/PaymentsPage';
import PlayerSpotlightPage from './pages/PlayerSpotlightPage';
import PollsPage from './pages/PollsPage';
import BirthdayStatusPage from './pages/BirthdayStatusPage';

export default function App() {
    const activeAccountId = useAccountStore((s) => s.activeAccountId);

    return (
        <>
        <Toaster position="bottom-right" richColors />
        <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route
                path="/app"
                element={
                    <ProtectedRoute>
                        <Layout key={activeAccountId ?? 'guest'} />
                    </ProtectedRoute>
                }
            >
                <Route index element={<DashboardPage />} />
                <Route path="groups" element={<GroupsPage />} />
                <Route path="team-colors" element={<TeamColorsPage />} />
                <Route path="matches" element={<MatchesPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="history/:groupId/:matchId" element={<MatchDetailsPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="groups/:groupId/visual-stats" element={<VisualStatsPage />} />
                <Route path="spotlight" element={<PlayerSpotlightPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="polls" element={<PollsPage />} />
                <Route path="birthday-status" element={<BirthdayStatusPage />} />

                <Route
                    path="settings"
                    element={
                        <GroupAdminRoute>
                            <GroupSettingsPage />
                        </GroupAdminRoute>
                    }
                />

                {/* ✅ AGORA USER TAMBÉM ACESSA (Minha conta) */}
                <Route path="admin/users" element={<AdminUsersPage />} />

                <Route
                    path="admin/godmode"
                    element={
                        <GodModeRoute>
                            <GodModeAdminPage />
                        </GodModeRoute>
                    }
                />
            </Route>

            <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
        </>
    );
}