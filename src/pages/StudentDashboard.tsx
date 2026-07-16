import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, Clock, Award, History, LogOut, CheckCircle2, 
  XCircle, ChevronRight, Calendar, Search, 
  HelpCircle, Eye, AlertCircle, Sparkles, Trophy, X, Loader2, Key
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  duration: number;
  questionsCount: number;
  createdAt: string;
  credit_cost: number;
  course_name?: string | null;
}

interface Attempt {
  id: string;
  exam_id: string;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  correct_answers_count: number | null;
  total_questions_count: number | null;
  status: 'in_progress' | 'completed';
  answers: any[] | null;
  exam: {
    title: string;
    duration: number;
  } | null;
}

export default function StudentDashboard() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'exams' | 'history'>('exams');
  const [searchTerm, setSearchTerm] = useState('');

  // Attempt Review Modal
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Change Password States
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 6) {
      setPwError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('Mật khẩu mới và xác nhận mật khẩu không trùng khớp.');
      return;
    }

    setPwLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPwSuccess('Đổi mật khẩu thành công!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowChangePasswordModal(false);
      }, 1500);
    } catch (err: any) {
      console.error('Lỗi cập nhật mật khẩu:', err);
      setPwError(err.message || 'Có lỗi xảy ra khi đổi mật khẩu.');
    } finally {
      setPwLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      // Refresh student profile to update credits/VIP status
      if (refreshProfile) {
        await refreshProfile();
      }

      // Fetch courses this student is enrolled in
      const { data: enrollments, error: enrollErr } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('student_id', user.id);

      if (enrollErr) throw enrollErr;
      const enrolledCourseIds = (enrollments || []).map((e: any) => e.course_id);

      // 1. Fetch published exams
      let examsQuery = supabase
        .from('exams')
        .select(`
          id,
          title,
          duration,
          status,
          created_at,
          credit_cost,
          course_id,
          course:courses(name),
          exam_questions (
            question_id
          )
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (enrolledCourseIds.length > 0) {
        examsQuery = examsQuery.in('course_id', enrolledCourseIds);
      } else {
        setExams([]);
        setLoading(false);
        return;
      }

      const { data: examsData, error: examsErr } = await examsQuery;

      if (examsErr) throw examsErr;

      // 2. Fetch attempts of this student
      const { data: attemptsData, error: attemptsErr } = await supabase
        .from('exam_attempts')
        .select(`
          id,
          exam_id,
          started_at,
          completed_at,
          score,
          correct_answers_count,
          total_questions_count,
          status,
          answers,
          exam:exams (
            title,
            duration
          )
        `)
        .eq('student_id', user.id)
        .order('completed_at', { ascending: false });

      if (attemptsErr) throw attemptsErr;

      // Map exams
      const mappedExams = (examsData || []).map((ex: any) => ({
        id: ex.id,
        title: ex.title,
        duration: ex.duration,
        questionsCount: ex.exam_questions?.length || 0,
        createdAt: new Date(ex.created_at).toLocaleDateString('vi-VN'),
        credit_cost: ex.credit_cost !== undefined && ex.credit_cost !== null ? ex.credit_cost : 5,
        course_name: ex.course?.name || null
      }));

      setExams(mappedExams);
      
      const mappedAttempts = (attemptsData || []).map((att: any) => ({
        id: att.id,
        exam_id: att.exam_id,
        started_at: att.started_at,
        completed_at: att.completed_at,
        score: att.score,
        correct_answers_count: att.correct_answers_count,
        total_questions_count: att.total_questions_count,
        status: att.status,
        answers: att.answers,
        exam: Array.isArray(att.exam) 
          ? att.exam[0] || null 
          : att.exam || null
      }));
      
      setAttempts(mappedAttempts as Attempt[]);
    } catch (err: any) {
      console.error('Lỗi tải dữ liệu học tập:', err);
      setError('Không thể kết nối cơ sở dữ liệu để tải thông tin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  // Trigger KaTeX rendering whenever reviewQuestions list changes
  useEffect(() => {
    if (typeof (window as any).renderMathInElement === 'function') {
      const timer = setTimeout(() => {
        (window as any).renderMathInElement(document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [reviewQuestions]);

  const handleOpenReview = async (attempt: Attempt) => {
    setSelectedAttempt(attempt);
    if (!attempt.answers || attempt.answers.length === 0) return;
    
    setReviewLoading(true);
    try {
      // Fetch details of questions in this exam to show contents during review
      const { data, error: qErr } = await supabase
        .from('exam_questions')
        .select(`
          question_order,
          question:questions (
            id,
            content,
            question_type,
            metadata
          )
        `)
        .eq('exam_id', attempt.exam_id)
        .order('question_order', { ascending: true });

      if (qErr) throw qErr;

      // Merge student answers with question contents
      const merged = (data || []).map((item: any) => {
        const studentAnsObj = attempt.answers?.find((a: any) => a.question_id === item.question?.id);
        return {
          order: item.question_order,
          id: item.question?.id,
          content: item.question?.content,
          type: item.question?.question_type,
          metadata: item.question?.metadata,
          selected: studentAnsObj ? studentAnsObj.selected_answer : null,
          isCorrect: studentAnsObj ? studentAnsObj.is_correct : false,
          score: studentAnsObj ? studentAnsObj.score : 0,
        };
      });

      setReviewQuestions(merged);
    } catch (err) {
      console.error('Lỗi tải chi tiết bài làm review:', err);
      alert('Không thể tải câu hỏi của lượt thi này.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleStartExam = async (exam: Exam) => {
    // 1. Check if there is an in_progress attempt for this exam
    const hasInProgress = attempts.some(a => a.exam_id === exam.id && a.status === 'in_progress');
    
    if (hasInProgress) {
      // If already in progress, just resume without checks or warnings
      navigate(`/exam/${exam.id}`);
      return;
    }

    // 2. Check VIP / Premium status
    if (profile?.is_premium) {
      if (window.confirm(`Bạn đang sở hữu tài khoản VIP Vô Hạn xu. Bắt đầu làm đề thi này chứ?`)) {
        navigate(`/exam/${exam.id}`);
      }
      return;
    }

    // 3. Normal user checks credits
    const cost = exam.credit_cost;
    const currentCredits = profile?.credits || 0;

    if (cost > 0) {
      if (currentCredits < cost) {
        alert(`Bạn không đủ xu để làm đề thi này!\n\n- Chi phí đề thi: ${cost} Xu\n- Số dư xu hiện tại: ${currentCredits} Xu\n\nHãy liên hệ Giáo viên để gia hạn thêm xu hoặc nâng cấp tài khoản VIP Vô Hạn!`);
        return;
      }

      if (window.confirm(`Bắt đầu làm bài thi này sẽ tiêu phí ${cost} Xu từ tài khoản của bạn.\n\n- Chi phí đề thi: ${cost} Xu\n- Số dư hiện tại: ${currentCredits} Xu\n- Số dư còn lại: ${currentCredits - cost} Xu\n\nBạn có chắc chắn muốn bắt đầu làm bài không?`)) {
        navigate(`/exam/${exam.id}`);
      }
    } else {
      if (window.confirm('Bạn đã sẵn sàng làm đề thi miễn phí này? Đồng hồ đếm ngược sẽ bắt đầu chạy ngay lập tức!')) {
        navigate(`/exam/${exam.id}`);
      }
    }
  };

  // Math Statistics
  const completedAttempts = attempts.filter(a => a.status === 'completed');
  const totalCompleted = completedAttempts.length;
  
  const avgScore = totalCompleted 
    ? (completedAttempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalCompleted).toFixed(2)
    : '0.00';

  const maxScore = totalCompleted
    ? Math.max(...completedAttempts.map(a => a.score || 0)).toFixed(2)
    : '0.00';

  const filteredExams = exams.filter(ex => 
    ex.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    ex.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistory = attempts.filter(a => 
    a.exam?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.exam_id.toLowerCase().includes(searchTerm.toLowerCase())
  );



  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      {/* Premium Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200/80 z-30 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/image-removebg-preview.png" 
              alt="Logo" 
              className="w-9 h-9 object-contain"
            />
            <div>
              <span className="text-sm font-bold text-slate-800 tracking-tight block">SMART QUIZ</span>
              <span className="text-[10px] text-emerald-600 font-bold tracking-wider uppercase block -mt-1">Cổng Học Sinh</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {profile && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-extrabold text-xs shadow-2xs hover:scale-105 transition-all">
                {profile.is_premium ? (
                  <>
                    <span className="text-sm">👑</span>
                    <span className="bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent font-black">VIP VÔ HẠN</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">🪙</span>
                    <span>{profile.credits} Xu</span>
                  </>
                )}
              </div>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800 leading-none">{profile?.full_name || user?.email}</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Học sinh</p>
            </div>
            <button
              onClick={() => {
                setPwError(null);
                setPwSuccess(null);
                setNewPassword('');
                setConfirmPassword('');
                setShowChangePasswordModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-indigo-50 text-slate-650 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đổi mật khẩu</span>
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-rose-50 text-slate-650 hover:text-rose-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Welcome Card */}
        <div className="relative rounded-3xl bg-slate-900 text-white overflow-hidden p-6 sm:p-8 shadow-xl">
          <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-indigo-600/30 blur-[80px] pointer-events-none" />
          <div className="absolute bottom-[-10%] left-[20%] w-[200px] h-[200px] rounded-full bg-emerald-600/20 blur-[80px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-semibold animate-pulse-soft">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Không gian luyện tập trực tuyến</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                Chào mừng, <span className="bg-gradient-to-r from-emerald-400 to-indigo-300 bg-clip-text text-transparent">{profile?.full_name || 'Học sinh'}</span>!
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
                Luyện tập trắc nghiệm trực tuyến để chuẩn bị tốt nhất cho các kỳ thi chính thức.
              </p>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto overflow-x-auto shrink-0 pb-1 md:pb-0">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[120px] text-center">
                <Award className="w-5 h-5 text-indigo-400 mx-auto mb-1.5" />
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Đã hoàn thành</span>
                <span className="text-lg font-black text-white">{totalCompleted} đề</span>
              </div>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[120px] text-center">
                <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Điểm trung bình</span>
                <span className="text-lg font-black text-white">{avgScore}</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-w-[120px] text-center">
                <Sparkles className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Điểm cao nhất</span>
                <span className="text-lg font-black text-white">{maxScore}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab & Search Panel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex bg-slate-100 rounded-xl p-1 w-full sm:w-auto">
            <button
              onClick={() => { setActiveTab('exams'); setSearchTerm(''); }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'exams'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Đề thi hiện có</span>
            </button>
            <button
              onClick={() => { setActiveTab('history'); setSearchTerm(''); }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Lịch sử làm bài</span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'exams' ? "Tìm kiếm đề thi..." : "Tìm lịch sử thi..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white placeholder:text-slate-400 transition-all"
            />
          </div>
        </div>

        {/* Main Tabs Contents */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
            {[1, 2].map(idx => (
              <div key={idx} className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-4">
                <div className="h-4 bg-slate-200 rounded w-1/4" />
                <div className="h-5 bg-slate-200 rounded w-2/3" />
                <div className="h-8 bg-slate-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200/80 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
            <h3 className="text-base font-bold text-slate-800">Lỗi kết nối</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">{error}</p>
            <button onClick={fetchDashboardData} className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors">
              Thử lại
            </button>
          </div>
        ) : activeTab === 'exams' ? (
          filteredExams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredExams.map((ex) => (
                <div key={ex.id} className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between group">
                  <div className="space-y-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                        {ex.id}
                      </span>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                        Sẵn sàng
                      </span>
                      {ex.course_name && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-md">
                          📚 {ex.course_name}
                        </span>
                      )}
                      {ex.credit_cost > 0 ? (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-250 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                          <span>🪙</span>
                          <span>{ex.credit_cost} Xu</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span>Miễn phí</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-800 my-0 tracking-tight leading-snug">
                      {ex.title}
                    </h3>

                    {/* Specs */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{ex.duration} phút</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{ex.questionsCount} câu hỏi</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{ex.createdAt}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartExam(ex)}
                    className="mt-6 w-full flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs hover:shadow-md"
                  >
                    <span>Làm bài ngay</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-200/80 text-center shadow-xs">
              <BookOpen className="w-12 h-12 text-slate-350 mb-3" />
              <h3 className="text-base font-bold text-slate-800">Chưa có đề thi nào khả dụng</h3>
              <p className="text-sm text-slate-500 max-w-xs mt-1">
                Hiện tại giáo viên chưa xuất bản đề thi nào. Hãy quay lại sau nhé!
              </p>
            </div>
          )
        ) : (
          filteredHistory.length > 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-450 uppercase text-[10px] font-bold tracking-wider">
                      <th className="p-4 pl-6">Mã / Tên Đề Thi</th>
                      <th className="p-4">Thời Gian Hoàn Thành</th>
                      <th className="p-4">Số Câu Đúng</th>
                      <th className="p-4">Điểm Số</th>
                      <th className="p-4">Trạng Thái</th>
                      <th className="p-4 pr-6 text-center">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-650 font-medium">
                    {filteredHistory.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 pl-6">
                          <div className="space-y-1">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-105 border border-slate-200 px-1.5 py-0.5 rounded">
                              {att.exam_id}
                            </span>
                            <span className="block font-semibold text-slate-800 text-xs sm:text-sm">{att.exam?.title || 'Đề thi đã bị xóa'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-500">
                          {att.completed_at 
                            ? new Date(att.completed_at).toLocaleString('vi-VN')
                            : 'Đang làm dở'}
                        </td>
                        <td className="p-4 text-xs">
                          {att.status === 'completed' 
                            ? `${att.correct_answers_count}/${att.total_questions_count}`
                            : '--'}
                        </td>
                        <td className="p-4 font-bold text-slate-850">
                          {att.status === 'completed'
                            ? <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                                (att.score || 0) >= 8 
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : (att.score || 0) >= 5
                                    ? 'bg-indigo-50 text-indigo-600'
                                    : 'bg-rose-50 text-rose-600'
                              }`}>{att.score?.toFixed(2)}</span>
                            : '--'}
                        </td>
                        <td className="p-4 text-xs">
                          {att.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50/30 px-2 py-0.5 rounded-lg border border-emerald-100">
                              <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                              Hoàn thành
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50/30 px-2 py-0.5 rounded-lg border border-amber-100 animate-pulse">
                              <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                              Đang làm
                            </span>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-center">
                          {att.status === 'completed' && (
                            <button
                              onClick={() => handleOpenReview(att)}
                              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-indigo-100 hover:bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Xem lại bài</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-200/80 text-center shadow-xs">
              <History className="w-12 h-12 text-slate-350 mb-3" />
              <h3 className="text-base font-bold text-slate-800">Chưa có lịch sử làm bài</h3>
              <p className="text-sm text-slate-500 max-w-xs mt-1">
                Lịch sử thi trắc nghiệm của bạn sẽ hiển thị tại đây sau khi bạn nộp bài làm đầu tiên.
              </p>
            </div>
          )
        )}
      </main>

      {/* Review Attempt Details Modal */}
      {selectedAttempt && reviewQuestions.length > 0 && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setSelectedAttempt(null)}
        >
          <div 
            className="relative w-full max-w-4xl bg-white rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedAttempt(null)}
              className="absolute right-5 top-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base sm:text-lg font-bold text-slate-800">Xem lại bài thi: {selectedAttempt.exam?.title}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                <span>Mã đề: <span className="font-semibold text-slate-700">{selectedAttempt.exam_id}</span></span>
                <span>•</span>
                <span>Hoàn thành lúc: <span className="font-semibold text-slate-700">{selectedAttempt.completed_at ? new Date(selectedAttempt.completed_at).toLocaleString('vi-VN') : ''}</span></span>
                <span>•</span>
                <span className="font-bold text-indigo-600">Điểm: {selectedAttempt.score?.toFixed(2)}</span>
                <span>•</span>
                <span className="font-bold text-emerald-600">Số câu đúng: {selectedAttempt.correct_answers_count}/{selectedAttempt.total_questions_count}</span>
              </div>
            </div>

            {/* Scrollable Questions Review */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/30">
              {reviewLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span>Đang tải thông tin câu hỏi bài thi...</span>
                </div>
              ) : (
                reviewQuestions.map((q, idx) => {
                  const isCorrect = q.isCorrect;
                  const score = q.score;

                  return (
                    <div key={q.id || idx} className={`bg-white border rounded-2xl p-5 shadow-2xs space-y-4 relative ${
                      isCorrect ? 'border-emerald-100 hover:border-emerald-200' : 'border-rose-100 hover:border-rose-200'
                    }`}>
                      {/* Question Index & Status Badge */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-800">Câu {q.order}</span>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            {q.type === 'trac_nghiem' 
                              ? 'Trắc nghiệm' 
                              : q.type === 'dung_sai' 
                              ? 'Đúng/Sai' 
                              : q.type === 'tra_loi_ngan' 
                              ? 'Trả lời ngắn' 
                              : q.type === 'noi_cau' 
                              ? 'Nối câu' 
                              : 'Ngữ liệu / Đọc hiểu'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isCorrect ? (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-550" />
                              <span>Đúng (+{score}đ)</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-rose-550" />
                              <span>Sai (0đ)</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      {/<[a-z][\s\S]*>/i.test(q.content) ? (
                        <div 
                          className="text-sm font-semibold text-slate-800 my-0 leading-relaxed html-question-content [&_img]:max-w-full [&_img]:h-auto [&_table]:border-collapse [&_table]:my-2 [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:p-2" 
                          dangerouslySetInnerHTML={{ __html: q.content }} 
                        />
                      ) : (
                        <p className="text-sm font-semibold text-slate-800 my-0 leading-relaxed whitespace-pre-line">{q.content}</p>
                      )}

                      {/* Options and selected answers depending on type */}
                      {q.type === 'trac_nghiem' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-xs">
                          {(q.metadata?.options || []).map((opt: any) => {
                            const isSelected = q.selected === opt.key;
                            const isCorrectAnswer = opt.key === q.metadata?.correct_answer;
                            
                            let optionStyle = 'border-slate-200 bg-white text-slate-700';
                            if (isSelected) optionStyle = 'border-rose-300 bg-rose-50/20 text-rose-700';
                            if (isCorrectAnswer) optionStyle = 'border-emerald-300 bg-emerald-50/30 text-emerald-700 font-bold';

                            return (
                              <div key={opt.key} className={`flex items-start gap-2.5 p-3 border rounded-xl leading-relaxed ${optionStyle}`}>
                                <span className="font-extrabold tracking-wider shrink-0 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md text-[10px]">
                                  {opt.key}
                                </span>
                                <span className="flex-1">
                                  {/<[a-z][\s\S]*>/i.test(opt.text) ? (
                                    <span dangerouslySetInnerHTML={{ __html: opt.text }} />
                                  ) : (
                                    opt.text
                                  )}
                                </span>
                                {isSelected && !isCorrectAnswer && <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                                {isCorrectAnswer && <CheckCircle2 className="w-4 h-4 text-emerald-550 shrink-0 mt-0.5" />}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'dung_sai' && (
                        <div className="space-y-2 mt-2 text-xs">
                          {(q.metadata?.options || []).map((opt: any) => {
                            const studentChoice = q.selected?.[opt.key]; // 'Đ' or 'S' or null
                            const correctChoice = q.metadata?.correct_answer?.[opt.key]; // 'Đ' or 'S'
                            const isSubCorrect = studentChoice === correctChoice;

                            return (
                              <div key={opt.key} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-xl gap-2 ${
                                isSubCorrect ? 'border-emerald-100 bg-emerald-50/10' : 'border-rose-100 bg-rose-50/10'
                              }`}>
                                <div className="flex items-start gap-2">
                                  <span className="font-extrabold tracking-wider shrink-0 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md text-[10px]">
                                    {opt.key}
                                  </span>
                                  <span className="text-slate-700">
                                    {/<[a-z][\s\S]*>/i.test(opt.text) ? (
                                      <span dangerouslySetInnerHTML={{ __html: opt.text }} />
                                    ) : (
                                      opt.text
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs shrink-0 self-end sm:self-auto">
                                  <span className="text-slate-400">Bạn chọn: <strong className={studentChoice === 'Đ' ? 'text-indigo-650' : 'text-amber-600'}>{studentChoice || 'Không trả lời'}</strong></span>
                                  <span className="text-slate-350">|</span>
                                  <span className="text-slate-500 font-bold">Đáp án: <strong className={correctChoice === 'Đ' ? 'text-emerald-700' : 'text-amber-700'}>{correctChoice}</strong></span>
                                  {isSubCorrect ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-550" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-rose-550" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'tra_loi_ngan' && (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs mt-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-medium">Bạn trả lời:</span>
                            <strong className={isCorrect ? 'text-emerald-600' : 'text-rose-600'}>
                              {q.selected || '(Trống)'}
                            </strong>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-medium font-sans">Đáp án đúng:</span>
                            <strong className="text-emerald-700">{q.metadata?.correct_answer}</strong>
                          </div>
                        </div>
                      )}

                      {q.type === 'noi_cau' && (
                        <div className="space-y-3 mt-2 text-xs">
                          {/* Options definitions */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50/50 rounded-xl">
                            <div>
                              <p className="font-bold text-slate-500 mb-1 text-[10px] uppercase">Vế trái (L)</p>
                              <div className="space-y-1">
                                {(q.metadata?.left_options || []).map((l: any) => (
                                  <p key={l.key} className="leading-snug">
                                    <span className="font-bold text-slate-700 mr-1">{l.key}.</span>
                                    {/<[a-z][\s\S]*>/i.test(l.text) ? (
                                      <span dangerouslySetInnerHTML={{ __html: l.text }} />
                                    ) : (
                                      l.text
                                    )}
                                  </p>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="font-bold text-slate-500 mb-1 text-[10px] uppercase">Vế phải (R)</p>
                              <div className="space-y-1">
                                {(q.metadata?.right_options || []).map((r: any) => (
                                  <p key={r.key} className="leading-snug">
                                    <span className="font-bold text-slate-700 mr-1">{r.key}.</span>
                                    {/<[a-z][\s\S]*>/i.test(r.text) ? (
                                      <span dangerouslySetInnerHTML={{ __html: r.text }} />
                                    ) : (
                                      r.text
                                    )}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Matching answers comparison */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 border border-slate-200 rounded-xl bg-white space-y-1.5">
                              <p className="font-bold text-slate-400 text-[10px] uppercase">Cặp ghép bạn chọn:</p>
                              {Object.entries(q.selected || {}).length === 0 ? (
                                <p className="text-rose-500 italic">Không ghép nối câu</p>
                              ) : (
                                Object.entries(q.selected || {}).map(([lKey, rKey]) => (
                                  <div key={lKey} className="flex items-center gap-2">
                                    <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{lKey}</span>
                                    <span className="text-slate-400">ghép với</span>
                                    <span className="font-bold text-indigo-650 bg-indigo-50/50 px-1.5 py-0.5 rounded border border-indigo-100">{rKey as string}</span>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="p-3 border border-emerald-100 rounded-xl bg-emerald-50/10 space-y-1.5">
                              <p className="font-bold text-emerald-600 text-[10px] uppercase">Đáp án đúng chính xác:</p>
                              {Object.entries(q.metadata?.correct_answer || {}).map(([lKey, rKey]) => (
                                <div key={lKey} className="flex items-center gap-2">
                                  <span className="font-bold text-slate-700 bg-slate-105 px-1.5 py-0.5 rounded border border-slate-200">{lKey}</span>
                                  <span className="text-slate-400">ghép với</span>
                                  <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150">{rKey as string}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {q.type === 'ngu_lieu' && (
                        <div className="space-y-4 pl-4 border-l-2 border-indigo-200 mt-2 text-xs">
                          {(q.metadata?.sub_questions || []).map((sub: any, subIdx: number) => {
                            const studentAns = q.selected?.[sub.id] || '';
                            const correctAns = sub.correct_answer || '';
                            const isSubCorrect = studentAns === correctAns;

                            return (
                              <div key={sub.id || subIdx} className={`space-y-3 p-4 border rounded-2xl bg-white ${
                                isSubCorrect ? 'border-emerald-100 hover:border-emerald-250 bg-emerald-50/5' : 'border-rose-150 hover:border-rose-200 bg-rose-50/5'
                              }`}>
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="font-bold text-slate-800">
                                    {sub.title || `Câu hỏi ${subIdx + 1}`}
                                  </span>
                                  <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                                    isSubCorrect ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-rose-700 bg-rose-50 border border-rose-100'
                                  }`}>
                                    {isSubCorrect ? 'Đúng' : 'Sai'}
                                  </span>
                                </div>

                                {/<[a-z][\s\S]*>/i.test(sub.content) ? (
                                  <div 
                                    className="font-semibold text-slate-700 leading-relaxed html-question-content [&_img]:max-w-full [&_img]:h-auto [&_table]:border-collapse [&_table]:my-2 [&_td]:border [&_td]:border-slate-350 [&_td]:p-2"
                                    dangerouslySetInnerHTML={{ __html: sub.content }}
                                  />
                                ) : (
                                  <p className="font-semibold text-slate-700 leading-relaxed whitespace-pre-line my-0">
                                    {sub.content}
                                  </p>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                  {(sub.options || []).map((opt: any) => {
                                    const isOptSelected = studentAns === opt.key;
                                    const isOptCorrect = opt.key === correctAns;

                                    let optionStyle = 'border-slate-200 bg-white text-slate-600';
                                    if (isOptSelected) optionStyle = 'border-rose-300 bg-rose-50/20 text-rose-700';
                                    if (isOptCorrect) optionStyle = 'border-emerald-300 bg-emerald-50/30 text-emerald-700 font-bold';

                                    return (
                                      <div key={opt.key} className={`flex items-start gap-2 p-2.5 border rounded-xl leading-relaxed ${optionStyle}`}>
                                        <span className="font-extrabold shrink-0 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[9px]">
                                          {opt.key}
                                        </span>
                                        <span className="flex-1">
                                          {/<[a-z][\s\S]*>/i.test(opt.text) ? (
                                            <span dangerouslySetInnerHTML={{ __html: opt.text }} />
                                          ) : (
                                            opt.text
                                          )}
                                        </span>
                                        {isOptSelected && !isOptCorrect && <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                                        {isOptCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-550 shrink-0 mt-0.5" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 text-right bg-slate-50/50">
              <button
                onClick={() => setSelectedAttempt(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Đóng xem lại
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setShowChangePasswordModal(false)}
        >
          <div 
            className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setShowChangePasswordModal(false)}
              className="absolute right-5 top-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-base sm:text-lg font-bold text-slate-800">Đổi mật khẩu tài khoản</h2>
              <p className="text-xs text-slate-500 mt-1">Vui lòng điền mật khẩu mới của bạn</p>
            </div>

            {/* Feedback Alerts */}
            {pwError && (
              <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-2xl mb-4 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-505 mt-0.5" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 rounded-2xl mb-4 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-505 mt-0.5" />
                <span>{pwSuccess}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650 cursor-pointer"
                  >
                    {showPassword ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Xác nhận mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650 cursor-pointer"
                  >
                    {showConfirmPassword ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {pwLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang cập nhật...</span>
                    </>
                  ) : (
                    <span>Đổi mật khẩu</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
