import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Clock, ArrowLeft, ArrowRight, CheckSquare, Loader2, 
  AlertCircle, CheckCircle, Trophy
} from 'lucide-react';

interface Question {
  id: string;
  order: number;
  content: string;
  type: 'trac_nghiem' | 'dung_sai' | 'tra_loi_ngan' | 'noi_cau';
  metadata: any;
  shuffledOptions?: any[]; // for trac_nghiem
}

export default function ExamTaker() {
  const { examId } = useParams<{ examId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // State
  const [examTitle, setExamTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New result modal states
  const [duration, setDuration] = useState<number>(45);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultData, setResultData] = useState<{
    score: number;
    correctAnswersCount: number;
    totalQuestionsCount: number;
    timeSpentStr: string;
    isManual: boolean;
  } | null>(null);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState<number>(0); // seconds
  const timerRef = useRef<any>(null);
  const startExamCalled = useRef(false);
  const lastExamIdRef = useRef<string | null>(null);

  // Fisher-Yates Shuffle
  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // 1. Fetch Exam details and start attempt
  useEffect(() => {
    const initExam = async () => {
      if (!examId || !user) return;

      // Ngăn chặn race condition / gọi trùng lặp do React Strict Mode chạy useEffect 2 lần
      if (lastExamIdRef.current !== examId) {
        startExamCalled.current = false;
        lastExamIdRef.current = examId;
      }
      if (startExamCalled.current) return;
      startExamCalled.current = true;

      try {
        setLoading(true);
        setError(null);

        // A. Start Exam Attempt on DB
        const { error: attemptErr } = await supabase.rpc(
          'start_exam_attempt',
          {
            p_exam_id: examId,
            p_student_id: user.id
          }
        );

        if (attemptErr) throw attemptErr;

        // B. Fetch Exam Info
        const { data: examData, error: examErr } = await supabase
          .from('exams')
          .select('title, duration')
          .eq('id', examId)
          .single();

        if (examErr) throw examErr;
        setExamTitle(examData.title);
        setDuration(examData.duration || 45);

        // C. Fetch Questions
        const { data: qData, error: qErr } = await supabase
          .from('exam_questions')
          .select(`
            question_order,
            question:questions (
              id,
              content,
              question_type,
              difficulty_level,
              metadata
            )
          `)
          .eq('exam_id', examId)
          .order('question_order', { ascending: true });

        if (qErr) throw qErr;

        const validQuestions = (qData || [])
          .filter((item: any) => item.question)
          .map((item: any) => {
            const q = item.question;
            const questionObj: Question = {
              id: q.id,
              order: item.question_order,
              content: q.content,
              type: q.question_type,
              metadata: q.metadata || {}
            };

            // Shuffle options if type is trac_nghiem
            if (q.question_type === 'trac_nghiem' && q.metadata?.options) {
              questionObj.shuffledOptions = shuffleArray(q.metadata.options);
            }
            return questionObj;
          });

        setQuestions(validQuestions);

        // D. Setup Countdown Timer (LocalStorage check for Anti-F5)
        const storageTimeKey = `exam_time_left_${examId}_${user.id}`;
        const savedTimeLeft = localStorage.getItem(storageTimeKey);
        
        if (savedTimeLeft !== null) {
          const parsed = parseInt(savedTimeLeft, 10);
          setTimeLeft(parsed > 0 ? parsed : 0);
        } else {
          // Duration in minutes converted to seconds
          const durationSeconds = (examData.duration || 45) * 60;
          setTimeLeft(durationSeconds);
          localStorage.setItem(storageTimeKey, durationSeconds.toString());
        }

        // E. Fetch in_progress answers from LocalStorage if any
        const storageAnswersKey = `exam_answers_${examId}_${user.id}`;
        const savedAnswers = localStorage.getItem(storageAnswersKey);
        if (savedAnswers) {
          try {
            setAnswers(JSON.parse(savedAnswers));
          } catch (e) {
            console.error('Lỗi phân tích cú pháp câu trả lời nháp:', e);
          }
        }
      } catch (err: any) {
        console.error('Lỗi khi bắt đầu làm đề thi:', err);
        setError(err.message || 'Không thể tải đề thi này hoặc có lỗi phân quyền.');
      } finally {
        setLoading(false);
      }
    };

    initExam();
  }, [examId, user]);

  // 2. Active timer effect
  useEffect(() => {
    if (loading || timeLeft <= 0 || submitting) return;

    const storageTimeKey = `exam_time_left_${examId}_${user?.id}`;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        localStorage.setItem(storageTimeKey, next.toString());
        if (next <= 0) {
          clearInterval(timerRef.current!);
          // Trigger Auto-Submit when time is up
          handleAutoSubmit();
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, timeLeft, submitting]);

  // 3. Save answers to LocalStorage whenever they change
  useEffect(() => {
    if (Object.keys(answers).length === 0 || !user || !examId) return;
    const storageAnswersKey = `exam_answers_${examId}_${user.id}`;
    localStorage.setItem(storageAnswersKey, JSON.stringify(answers));
  }, [answers, examId, user]);

  // 4. Anti-copy / Anti-cheat protections
  useEffect(() => {
    // Disable right click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Disable text selection start
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    // Disable drag start (prevents dragging text/images)
    const handleDragStart = (e: Event) => {
      e.preventDefault();
    };

    // Disable copy/cut/paste
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };
    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
    };
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // Disable key shortcuts (F12, Ctrl+C, Ctrl+V, Ctrl+U, Ctrl+P, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }

      // Ctrl or Cmd combination keys
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        
        // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A
        if (key === 'c' || key === 'v' || key === 'x' || key === 'a') {
          e.preventDefault();
          return false;
        }

        // Ctrl+U (View Source), Ctrl+S (Save), Ctrl+P (Print)
        if (key === 'u' || key === 's' || key === 'p') {
          e.preventDefault();
          return false;
        }

        // Ctrl+Shift+I / J / C (DevTools)
        if (e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
          e.preventDefault();
          return false;
        }
      }
    };

    // Bind event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      // Unbind event listeners
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 5. Anti-F12 / DevTools Trap (Debugger loop & console mute)
  useEffect(() => {
    // Mute console
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};

    // Clear console periodically
    const clearConsole = () => {
      try {
        console.clear();
      } catch (e) {}
    };
    const consoleInterval = setInterval(clearConsole, 300);

    // Debugger trap to freeze DevTools if open
    const trapDebugger = () => {
      try {
        (function() {
          return false;
        })
        .constructor("debugger")();
      } catch (err) {}
    };
    
    // Run debugger trap
    const debuggerInterval = setInterval(trapDebugger, 500);

    return () => {
      clearInterval(consoleInterval);
      clearInterval(debuggerInterval);
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      console.info = originalInfo;
    };
  }, []);

  // Formatter for countdown
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Answer selectors
  const handleSelectTracNghiem = (qId: string, choiceKey: string) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: choiceKey
    }));
  };

  const handleSelectDungSai = (qId: string, optionKey: string, value: 'Đ' | 'S') => {
    setAnswers(prev => {
      const prevAns = prev[qId] || {};
      return {
        ...prev,
        [qId]: {
          ...prevAns,
          [optionKey]: value
        }
      };
    });
  };

  const handleTextChange = (qId: string, text: string) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: text
    }));
  };

  const handleSelectNoiCau = (qId: string, leftKey: string, rightKey: string) => {
    setAnswers(prev => {
      const prevAns = prev[qId] || {};
      if (!rightKey) {
        const nextAns = { ...prevAns };
        delete nextAns[leftKey];
        return { ...prev, [qId]: nextAns };
      }
      return {
        ...prev,
        [qId]: {
          ...prevAns,
          [leftKey]: rightKey
        }
      };
    });
  };

  // Submit operations
  const submitExamPayload = async (manual = true) => {
    if (!examId || !user) return;
    setSubmitting(true);

    try {
      // Package payload: [{ question_id: "...", selected_answer: ... }]
      const payload = questions.map(q => {
        const selected = answers[q.id];
        return {
          question_id: q.id,
          selected_answer: selected !== undefined ? selected : null
        };
      });

      // Invoke DB RPC
      const { data: attemptId, error: submitErr } = await supabase.rpc(
        'submit_and_score_exam',
        {
          p_exam_id: examId,
          p_student_id: user.id,
          p_answers: payload
        }
      );

      if (submitErr) throw submitErr;

      // Clean up LocalStorage variables
      localStorage.removeItem(`exam_time_left_${examId}_${user.id}`);
      localStorage.removeItem(`exam_answers_${examId}_${user.id}`);

      // Fetch attempt details to display score
      let score = 0;
      let correctAnswersCount = 0;
      let totalQuestionsCount = questions.length;

      if (attemptId) {
        const { data: attemptData, error: fetchErr } = await supabase
          .from('exam_attempts')
          .select('score, correct_answers_count, total_questions_count')
          .eq('id', attemptId)
          .single();

        if (!fetchErr && attemptData) {
          score = attemptData.score;
          correctAnswersCount = attemptData.correct_answers_count;
          totalQuestionsCount = attemptData.total_questions_count;
        }
      }

      // Calculate time spent
      const totalDurationSeconds = duration * 60;
      const timeSpentSeconds = Math.max(0, totalDurationSeconds - timeLeft);
      const minutesSpent = Math.floor(timeSpentSeconds / 60);
      const secondsSpent = timeSpentSeconds % 60;
      const timeSpentStr = `${minutesSpent} phút ${secondsSpent} giây`;

      setResultData({
        score,
        correctAnswersCount,
        totalQuestionsCount,
        timeSpentStr,
        isManual: manual
      });
      setShowResultModal(true);

    } catch (err: any) {
      console.error('Lỗi khi nộp bài thi:', err);
      alert('Gặp lỗi khi nộp bài thi: ' + (err.message || 'Lỗi kết nối mạng. Hãy thử bấm lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = () => {
    const unansweredCount = questions.length - Object.keys(answers).filter(k => answers[k] !== undefined).length;
    let msg = 'Bạn có chắc chắn muốn nộp bài thi này không?';
    if (unansweredCount > 0) {
      msg = `Bạn vẫn còn ${unansweredCount} câu chưa trả lời. Bạn có chắc chắn muốn nộp bài sớm không?`;
    }
    if (!window.confirm(msg)) return;
    submitExamPayload(true);
  };

  const handleAutoSubmit = () => {
    submitExamPayload(false);
  };

  const handleGoBack = () => {
    if (window.confirm('Bạn có chắc chắn muốn rời khỏi trang? Bài thi đang làm dở sẽ vẫn được ghi nhận thời gian chạy ngầm!')) {
      navigate('/');
    }
  };

  const getWatermarkSvg = () => {
    const studentName = profile?.full_name || 'Học sinh';
    const studentEmail = user?.email || '';
    const dateStr = new Date().toLocaleDateString('vi-VN');
    const appUrl = window.location.host;
    
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="450" height="350">
        <text 
          x="50%" 
          y="50%" 
          font-family="system-ui, -apple-system, sans-serif" 
          font-size="11" 
          font-weight="bold"
          fill="rgba(15, 23, 42, 0.08)" 
          text-anchor="middle" 
          transform="rotate(-25 225 175)"
        >
          <tspan x="50%" dy="-8">${studentName} (${studentEmail})</tspan>
          <tspan x="50%" dy="18">Bản quyền thuộc về ${appUrl} - ${dateStr}</tspan>
        </text>
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm text-slate-400">Đang khởi tạo bài thi trực tuyến...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-sans p-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-lg font-bold">Không thể làm bài thi</h2>
        <p className="text-sm text-slate-500 text-center max-w-md mt-1 mb-6">{error}</p>
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại trang chính</span>
        </button>
      </div>
    );
  }

  if (showResultModal && resultData) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 font-sans relative">
        {/* Anti-copy / Anti-screenshot Watermark Overlay */}
        <div 
          className="fixed inset-0 pointer-events-none z-[9999]"
          style={{
            backgroundImage: `url("${getWatermarkSvg()}")`,
            backgroundRepeat: 'repeat',
          }}
        />
        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 max-w-md w-full text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Decorative background blurs */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
          
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 mb-6">
            {resultData.score >= 8.0 ? (
              <Trophy className="w-10 h-10 text-amber-300 animate-bounce" />
            ) : (
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            )}
          </div>

          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Hoàn thành bài thi!</h2>
          <p className="text-xs text-slate-500 mt-1 mb-6 max-w-xs mx-auto leading-relaxed">
            Bài làm của bạn đã được ghi nhận và chấm điểm tự động thành công trên hệ thống.
          </p>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">Điểm số đạt được:</span>
              <span className="text-lg font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">
                {resultData.score.toFixed(2)}
              </span>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">Số câu trả lời đúng:</span>
              <strong className="text-slate-800 text-sm">
                {resultData.correctAnswersCount} / {resultData.totalQuestionsCount}
              </strong>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">Tỷ lệ chính xác:</span>
              <strong className="text-slate-800 text-sm">
                {resultData.totalQuestionsCount > 0 
                  ? Math.round((resultData.correctAnswersCount / resultData.totalQuestionsCount) * 100) 
                  : 0}%
              </strong>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">Thời gian làm bài:</span>
              <strong className="text-slate-800 text-sm">{resultData.timeSpentStr}</strong>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-semibold">Hình thức nộp:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                resultData.isManual 
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                  : 'bg-amber-50 text-amber-600 border border-amber-100'
              }`}>
                {resultData.isManual ? 'Nộp thủ công' : 'Nộp tự động'}
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 cursor-pointer"
          >
            Quay lại Trang chủ
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none relative">
      {/* Anti-copy / Anti-screenshot Watermark Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{
          backgroundImage: `url("${getWatermarkSvg()}")`,
          backgroundRepeat: 'repeat',
        }}
      />
      
      {/* Top Header */}
      <header className="bg-slate-900 text-white border-b border-slate-850 h-16 shrink-0 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleGoBack}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-md leading-tight">{examTitle}</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Thời gian đếm ngược • Chế độ chống F5</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-850 border border-slate-800 text-amber-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-black font-mono tracking-wider">{formatTime(timeLeft)}</span>
          </div>

          <button
            onClick={handleManualSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckSquare className="w-3.5 h-3.5" />
            )}
            <span>Nộp bài</span>
          </button>
        </div>
      </header>

      {/* Main Body Split Screen */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side: Question Board */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Index card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                  Câu hỏi {currentIdx + 1} / {questions.length}
                </span>
                
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                  {currentQuestion.type === 'trac_nghiem' ? 'Trắc nghiệm' : currentQuestion.type === 'dung_sai' ? 'Đúng/Sai' : currentQuestion.type === 'tra_loi_ngan' ? 'Trả lời ngắn' : 'Nối câu'}
                </span>
              </div>

              {/* Question Text */}
              {/<[a-z][\s\S]*>/i.test(currentQuestion.content) ? (
                <div 
                  className="text-sm sm:text-base font-semibold text-slate-800 leading-relaxed html-question-content [&_img]:max-w-full [&_img]:h-auto [&_table]:border-collapse [&_table]:my-2 [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:p-2" 
                  dangerouslySetInnerHTML={{ __html: currentQuestion.content }} 
                />
              ) : (
                <p className="text-sm sm:text-base font-semibold text-slate-800 leading-relaxed whitespace-pre-line my-0">
                  {currentQuestion.content}
                </p>
              )}
            </div>

            {/* Answer Options Selector */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Nhập/Chọn câu trả lời của bạn:</p>

              {/* 1. Multiple Choice */}
              {currentQuestion.type === 'trac_nghiem' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {(currentQuestion.shuffledOptions || []).map((opt) => {
                    const isSelected = answers[currentQuestion.id] === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => handleSelectTracNghiem(currentQuestion.id, opt.key)}
                        className={`flex items-start text-left gap-3 p-4 border rounded-2xl text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/30 text-indigo-900 font-semibold shadow-xs ring-1 ring-indigo-500'
                            : 'border-slate-200 bg-white hover:border-slate-350 text-slate-700 hover:bg-slate-50/50'
                        }`}
                      >
                        <span className={`font-extrabold tracking-wider shrink-0 px-2 py-0.5 rounded-md text-[10px] border transition-colors ${
                          isSelected 
                            ? 'bg-indigo-600 border-indigo-650 text-white' 
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}>
                          {opt.key}
                        </span>
                        <span className="flex-1">
                          {/<[a-z][\s\S]*>/i.test(opt.text) ? (
                            <span dangerouslySetInnerHTML={{ __html: opt.text }} />
                          ) : (
                            opt.text
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 2. True/False */}
              {currentQuestion.type === 'dung_sai' && (
                <div className="space-y-3">
                  {(currentQuestion.metadata?.options || []).map((opt: any) => {
                    const studentVal = answers[currentQuestion.id]?.[opt.key]; // 'Đ' or 'S' or undefined
                    return (
                      <div key={opt.key} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border border-slate-200 bg-white rounded-2xl gap-3">
                        <div className="flex items-start gap-2.5">
                          <span className="font-extrabold tracking-wider shrink-0 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md text-[10px] text-slate-500">
                            {opt.key}
                          </span>
                          <span className="text-slate-700 text-xs sm:text-sm">
                            {/<[a-z][\s\S]*>/i.test(opt.text) ? (
                              <span dangerouslySetInnerHTML={{ __html: opt.text }} />
                            ) : (
                              opt.text
                            )}
                          </span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleSelectDungSai(currentQuestion.id, opt.key, 'Đ')}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                              studentVal === 'Đ'
                                ? 'bg-indigo-600 border-indigo-650 text-white shadow-xs'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                            }`}
                          >
                            Đúng
                          </button>
                          <button
                            onClick={() => handleSelectDungSai(currentQuestion.id, opt.key, 'S')}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                              studentVal === 'S'
                                ? 'bg-amber-600 border-amber-650 text-white shadow-xs'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-650'
                            }`}
                          >
                            Sai
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. Short Answer */}
              {currentQuestion.type === 'tra_loi_ngan' && (
                <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-2xs">
                  <textarea
                    rows={3}
                    placeholder="Điền đáp án của câu hỏi tại đây..."
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleTextChange(currentQuestion.id, e.target.value)}
                    className="w-full p-3 border border-slate-250 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white placeholder:text-slate-400"
                  />
                </div>
              )}

              {/* 4. Matching */}
              {currentQuestion.type === 'noi_cau' && (
                <div className="space-y-4">
                  {/* Visual options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white border border-slate-200 rounded-2xl">
                    <div className="space-y-2">
                      <p className="font-extrabold text-slate-450 uppercase text-[9px] tracking-wider border-b border-slate-100 pb-1">Vế trái (L)</p>
                      <div className="space-y-1 text-xs">
                        {(currentQuestion.metadata?.left_options || []).map((l: any) => (
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
                    <div className="space-y-2">
                      <p className="font-extrabold text-slate-450 uppercase text-[9px] tracking-wider border-b border-slate-100 pb-1">Vế phải (R)</p>
                      <div className="space-y-1 text-xs">
                        {(currentQuestion.metadata?.right_options || []).map((r: any) => (
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

                  {/* Matching Dropdowns */}
                  <div className="space-y-2 text-xs">
                    <p className="font-bold text-slate-500">Kết nối các cặp vế tương ứng:</p>
                    {(currentQuestion.metadata?.left_options || []).map((l: any) => {
                      const selectedRightVal = answers[currentQuestion.id]?.[l.key] || '';
                      return (
                        <div key={l.key} className="flex items-center gap-3 bg-white p-2.5 border border-slate-200 rounded-xl">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{l.key}</span>
                          <span className="text-slate-400">ghép nối với:</span>
                          <select
                            value={selectedRightVal}
                            onChange={(e) => handleSelectNoiCau(currentQuestion.id, l.key, e.target.value)}
                            className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none bg-white cursor-pointer"
                          >
                            <option value="">-- Chọn vế phải (R) --</option>
                            {(currentQuestion.metadata?.right_options || []).map((r: any) => (
                              <option key={r.key} value={r.key}>Vế {r.key}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Previous/Next Navigation Controls */}
          <div className="flex items-center justify-between border-t border-slate-200/80 pt-5 mt-8 shrink-0">
            <button
              onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Câu trước</span>
            </button>

            <button
              onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIdx === questions.length - 1}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Câu tiếp theo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Side: Question Navigation & Timer */}
        <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-4 sm:p-5 flex flex-col justify-between shrink-0 overflow-y-auto max-h-[40vh] md:max-h-none">
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">Lưới câu hỏi đề thi</h3>
              
              {/* Question Navigation Grid */}
              <div className="grid grid-cols-5 gap-2.5">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIdx;
                  const isAnswered = answers[q.id] !== undefined;

                  let cellStyle = 'border-slate-200 hover:bg-slate-50 text-slate-600 hover:border-slate-350';
                  if (isAnswered) cellStyle = 'bg-indigo-600 border-indigo-650 text-white hover:bg-indigo-700';
                  if (isCurrent) cellStyle = 'ring-2 ring-indigo-500 border-indigo-500 font-extrabold text-indigo-750 bg-indigo-50';
                  if (isCurrent && isAnswered) cellStyle = 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-700 text-white font-extrabold';

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(idx)}
                      className={`h-9 w-full flex items-center justify-center border rounded-xl text-xs font-bold transition-all cursor-pointer ${cellStyle}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Completion indicator */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs text-slate-550">
              <div className="flex justify-between items-center">
                <span>Số câu đã làm:</span>
                <strong className="text-slate-800">{Object.keys(answers).length} / {questions.length}</strong>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={handleManualSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-1.5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-md"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>Nộp bài & kết thúc</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
