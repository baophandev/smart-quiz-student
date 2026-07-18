import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import StudentDashboard from './pages/StudentDashboard';
import ExamTaker from './pages/ExamTaker';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute() {
  const { user, loading, profile, signOut } = useAuth();

  useEffect(() => {
    if (user && profile && profile.role !== 'student') {
      signOut();
    }
  }, [user, profile, signOut]);

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
        <img 
          src="/image-removebg-preview.png" 
          alt="Logo" 
          className="w-12 h-12 object-contain mb-4 animate-bounce"
        />
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          Đang tải dữ liệu...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile && profile.role !== 'student') {
    return <Navigate to="/login" replace state={{ error: 'Tài khoản của bạn không có vai trò Học sinh.' }} />;
  }

  return <Outlet />;
}

function PublicRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
        <img 
          src="/image-removebg-preview.png" 
          alt="Logo" 
          className="w-12 h-12 object-contain mb-4 animate-bounce"
        />
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          Đang tải dữ liệu...
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>

          {/* Reset Password Route (Neutral) */}
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Student Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<StudentDashboard />} />
            <Route path="/exam/:examId" element={<ExamTaker />} />
          </Route>

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
