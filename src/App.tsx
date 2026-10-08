import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { TMU_ROOT } from './lib/tenants'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './layouts/DashboardLayout'
import PortalLayout from './layouts/PortalLayout'
import DashboardPage from './pages/dashboard/DashboardPage'
import ApplicantsPage from './pages/dashboard/ApplicantsPage'
import ApplicantDetailPage from './pages/dashboard/ApplicantDetailPage'
import NewApplicantPage from './pages/dashboard/NewApplicantPage'
import UsersPage from './pages/dashboard/UsersPage'
import TenantsPage from './pages/dashboard/TenantsPage'
import ReportsPage from './pages/dashboard/ReportsPage'
import AuditLogPage from './pages/dashboard/AuditLogPage'
import ConsentsPage from './pages/dashboard/ConsentsPage'
import ArrearsPage from './pages/dashboard/ArrearsPage'
import PolicyParamsPage from './pages/dashboard/PolicyParamsPage'
import PilotGuardrailsPage from './pages/dashboard/PilotGuardrailsPage'
import BorrowerPortalPage from './pages/portal/BorrowerPortalPage'
import BorrowerLoginPage from './pages/portal/BorrowerLoginPage'
import BorrowerRegisterPage from './pages/portal/BorrowerRegisterPage'
import BorrowerApplyPage from './pages/portal/BorrowerApplyPage'
import BorrowerAccountPage from './pages/portal/BorrowerAccountPage'
import AccountPage from './pages/dashboard/AccountPage'
import ApplicationDetailPage from './pages/dashboard/ApplicationDetailPage'
import CashLoanHomePage from './pages/cashloan/CashLoanHomePage'
import NexoraHomePage from './pages/nexora/NexoraHomePage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* TMU Investments — cash loan site + borrower portal */}
        <Route path={TMU_ROOT} element={<CashLoanHomePage />} />
        <Route path={`${TMU_ROOT}/portal`} element={<PortalLayout />}>
          <Route index element={<BorrowerPortalPage />} />
          <Route path="login" element={<BorrowerLoginPage />} />
          <Route path="register" element={<BorrowerRegisterPage />} />
          <Route path="apply" element={<BorrowerApplyPage />} />
          <Route path="account" element={<BorrowerAccountPage />} />
        </Route>
        <Route path="/tmu" element={<Navigate to={TMU_ROOT} replace />} />
        <Route path="/tmu-cashloan" element={<Navigate to={TMU_ROOT} replace />} />
        <Route path="/portal/*" element={<LegacyPortalRedirect />} />
        <Route path="/portal" element={<LegacyPortalRedirect />} />
        
        {/* Protected dashboard routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin', 'intake', 'officer', 'approver', 'finance']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="applicants" element={<ApplicantsPage />} />
          <Route path="applicants/new" element={<NewApplicantPage />} />
          <Route path="applicants/:id" element={<ApplicantDetailPage />} />
          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="audit-log" element={<AuditLogPage />} />
          <Route path="consents" element={<ConsentsPage />} />
          <Route path="arrears" element={<ArrearsPage />} />
          <Route path="policy-params" element={<PolicyParamsPage />} />
          <Route path="pilot-guardrails" element={<PilotGuardrailsPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
        
        {/* Nexora Systems Flagship Homepage */}
        <Route path="/" element={<NexoraHomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

function LegacyPortalRedirect() {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={`${TMU_ROOT}${pathname}${search}${hash}`} replace />
}

export default App