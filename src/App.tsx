import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './components/Login';
import { Dashboard } from './features/dashboard/Dashboard';
import { SalesList } from './features/sales/SalesList';
import { CreateSale } from './features/sales/CreateSale';
import { CustomerList } from './features/customers/CustomerList';
import { CustomerForm } from './features/customers/CustomerForm';
import { ServicesList } from './features/services/ServicesList';
import { ServiceForm } from './features/services/ServiceForm';
import { CategoryForm } from './features/services/CategoryForm';
import { ExpenseList } from './features/expenses/ExpenseList';
import { ExpenseForm } from './features/expenses/ExpenseForm';
import { ExpenseCategoryForm } from './features/expenses/ExpenseCategoryForm';
import { PaymentList } from './features/payments/PaymentList';
import { PaymentForm } from './features/payments/PaymentForm';
import { RbacList } from './features/rbac/RbacList';
import { ReportsCenter } from './features/reports/ReportsCenter';
import { SettingsPanel } from './features/settings/SettingsPanel';
import { ExpiryTracker } from './features/documents/ExpiryTracker';

// Initialize Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Guard Component for Authenticated Sessions
const AuthenticatedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

// Guard Component for Guest Users
const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Guest Entry Gate */}
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />

            {/* Authenticated Dashboard Gates */}
            <Route
              path="/"
              element={
                <AuthenticatedRoute>
                  <Dashboard />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <AuthenticatedRoute>
                  <SalesList />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/sales/create"
              element={
                <AuthenticatedRoute>
                  <CreateSale />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <AuthenticatedRoute>
                  <CustomerList />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/customers/create"
              element={
                <AuthenticatedRoute>
                  <CustomerForm />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/customers/edit/:id"
              element={
                <AuthenticatedRoute>
                  <CustomerForm />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/services"
              element={
                <AuthenticatedRoute>
                  <ServicesList />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/services/create"
              element={
                <AuthenticatedRoute>
                  <ServiceForm />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/services/edit/:id"
              element={
                <AuthenticatedRoute>
                  <ServiceForm />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/services/category/create"
              element={
                <AuthenticatedRoute>
                  <CategoryForm />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/services/category/edit/:id"
              element={
                <AuthenticatedRoute>
                  <CategoryForm />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <AuthenticatedRoute>
                  <ExpenseList />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/expenses/create"
              element={
                <AuthenticatedRoute>
                  <ExpenseForm />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/expenses/edit/:id"
              element={
                <AuthenticatedRoute>
                  <ExpenseForm />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/expenses/category/create"
              element={
                <AuthenticatedRoute>
                  <ExpenseCategoryForm />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/expenses/category/edit/:id"
              element={
                <AuthenticatedRoute>
                  <ExpenseCategoryForm />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/payments"
              element={
                <AuthenticatedRoute>
                  <PaymentList />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/payments/create"
              element={
                <AuthenticatedRoute>
                  <PaymentForm />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/rbac"
              element={
                <AuthenticatedRoute>
                  <RbacList />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <AuthenticatedRoute>
                  <ReportsCenter />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <AuthenticatedRoute>
                  <SettingsPanel />
                </AuthenticatedRoute>
              }
            />
            <Route
              path="/expiry-tracker"
              element={
                <AuthenticatedRoute>
                  <ExpiryTracker />
                </AuthenticatedRoute>
              }
            />

            {/* Catch-all Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
