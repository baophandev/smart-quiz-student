import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error('Verify session error:', err);
        setIsAuthorized(false);
      } finally {
        setCheckingSession(false);
      }
    };

    verifySession();

    // Listen for auth state changes (in case tokens are parsed asynchronously)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }
      setCheckingSession(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const validateForm = () => {
    if (!password || !confirmPassword) {
      setErrorMsg('Vui lòng nhập đầy đủ mật khẩu mới và xác nhận mật khẩu.');
      return false;
    }
    if (password.length < 6) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu và xác nhận mật khẩu không trùng khớp.');
      return false;
    }
    return true;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!validateForm()) return;

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setSuccessMsg('Đặt lại mật khẩu thành công! Đang đăng xuất và chuyển hướng...');
      
      // Sign out to clear recovery session context securely
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate('/login', { 
          state: { 
            success: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới của bạn.' 
          } 
        });
      }, 2000);
    } catch (err: any) {
      console.error('Update password error:', err);
      setErrorMsg(err.message || 'Có lỗi xảy ra khi cập nhật mật khẩu. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
        <img 
          src="/image-removebg-preview.png" 
          alt="Logo" 
          className="w-12 h-12 object-contain mb-4 animate-bounce"
        />
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          Đang xác thực liên kết...
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-screen flex items-center justify-center overflow-hidden bg-slate-950 font-sans">
      {/* Decorative Glowing Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" />

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Card Container */}
      <div className="w-full max-w-md p-6 relative z-10">
        
        {/* Logo / Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <img 
            src="/image-removebg-preview.png" 
            alt="Logo" 
            className="w-14 h-14 object-contain mb-4 transform hover:scale-105 transition-transform duration-200"
          />
          <h2 className="text-2xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-200 bg-clip-text text-transparent">
            ĐẶT LẠI MẬT KHẨU
          </h2>
          <p className="text-slate-400 text-xs mt-1">Nhập mật khẩu mới cho tài khoản của bạn</p>
        </div>

        {/* Card */}
        <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          {!isAuthorized ? (
            <div className="text-center py-4 space-y-6">
              <div className="flex items-center justify-center text-rose-500">
                <AlertCircle className="w-16 h-16 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Liên kết không hợp lệ</h3>
                <p className="text-slate-400 text-xs leading-relaxed max-w-xs mx-auto">
                  Đường dẫn đặt lại mật khẩu của bạn đã hết hạn, không hợp lệ hoặc đã được sử dụng. Vui lòng gửi một yêu cầu đặt lại mật khẩu mới.
                </p>
              </div>
              <button
                onClick={() => navigate('/forgot-password')}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-emerald-500 text-white rounded-2xl text-sm font-semibold hover:from-indigo-600 hover:to-emerald-600 transition-all duration-200 cursor-pointer"
              >
                Gửi yêu cầu mới
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-block text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Quay lại Đăng nhập
              </button>
            </div>
          ) : (
            <>
              {/* Feedback Alerts */}
              {errorMsg && (
                <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-200 p-3.5 rounded-2xl mb-6 text-xs animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-3.5 rounded-2xl mb-6 text-xs animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleResetPassword} className="space-y-5">
                {/* Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-xs font-medium text-slate-300 ml-1">
                    Mật khẩu mới
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4.5 w-4.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-11 pr-11 py-3 bg-slate-950/50 border border-slate-800 rounded-2xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4.5 w-4.5" />
                      ) : (
                        <Eye className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-300 ml-1">
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4.5 w-4.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-11 pr-11 py-3 bg-slate-950/50 border border-slate-800 rounded-2xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4.5 w-4.5" />
                      ) : (
                        <Eye className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-500 to-emerald-500 text-white rounded-2xl text-sm font-semibold hover:from-indigo-600 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transform hover:-translate-y-0.5 transition-all duration-200 cursor-pointer mt-6"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      <span>Đang cập nhật...</span>
                    </>
                  ) : (
                    <span>Cập nhật mật khẩu</span>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer Link */}
        <p className="text-center mt-6 text-xs text-slate-500">
          v2.0.2 Smart Quiz App &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
