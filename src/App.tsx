import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";
import { StudentsManagement } from "@/components/admin/StudentsManagement";
import { CoursesManagement } from "@/components/admin/CoursesManagement";
import { DepartmentsManagement } from "@/components/admin/DepartmentsManagement";
import { InstructorsManagement } from "@/components/admin/InstructorsManagement";
import { EnrollmentsManagement } from "@/components/admin/EnrollmentsManagement";
import { AttendanceManagement } from "@/components/admin/AttendanceManagement";
import { ResultsManagement } from "@/components/admin/ResultsManagement";
import { ReportsPage } from "@/components/admin/ReportsPage";
import { StudentCourses, StudentAttendance, StudentResults } from "@/components/student/StudentPages";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { session, role, loading } = useAuth();

  // Always show loading while auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only redirect to login if we're done loading AND there's no session
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // If a route requires specific roles, deny access when role is missing or not allowed
  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function Dashboard() {
  const { role } = useAuth();
  return role === 'admin' ? <AdminDashboard /> : <StudentDashboard />;
}

function AppRoutes() {
  const { session, loading } = useAuth();
  const isAuthenticated = !!session;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginForm />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      {/* Admin routes */}
      <Route path="/students" element={<ProtectedRoute allowedRoles={['admin']}><StudentsManagement /></ProtectedRoute>} />
      <Route path="/courses" element={<ProtectedRoute allowedRoles={['admin']}><CoursesManagement /></ProtectedRoute>} />
      <Route path="/departments" element={<ProtectedRoute allowedRoles={['admin']}><DepartmentsManagement /></ProtectedRoute>} />
      <Route path="/instructors" element={<ProtectedRoute allowedRoles={['admin']}><InstructorsManagement /></ProtectedRoute>} />
      <Route path="/enrollments" element={<ProtectedRoute allowedRoles={['admin']}><EnrollmentsManagement /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin']}><AttendanceManagement /></ProtectedRoute>} />
      <Route path="/results" element={<ProtectedRoute allowedRoles={['admin']}><ResultsManagement /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin']}><ReportsPage /></ProtectedRoute>} />
      {/* Student routes */}
      <Route path="/my-courses" element={<ProtectedRoute allowedRoles={['student']}><StudentCourses /></ProtectedRoute>} />
      <Route path="/my-attendance" element={<ProtectedRoute allowedRoles={['student']}><StudentAttendance /></ProtectedRoute>} />
      <Route path="/my-results" element={<ProtectedRoute allowedRoles={['student']}><StudentResults /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
