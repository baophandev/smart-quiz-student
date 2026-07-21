import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator, ArrowLeft, Info,
  Sparkles, RotateCcw, ArrowRight
} from 'lucide-react';

// ============================================================
// Bảng quy đổi V-SAT → THPT chính thức năm 2026 của Đại học Cần Thơ
// Quyết định Số: 2156/TB-ĐHCT-ĐT ngày 07/07/2026
// Công thức: y = c + ((x - a) / (b - a)) × (d - c)
// ============================================================

interface Breakpoint {
  a: number;
  b: number;
  c: number;
  d: number;
  rank: string;
}

interface SubjectData {
  name: string;
  code: string;
  breakpoints: Breakpoint[];
}

const subjects: SubjectData[] = [
  {
    name: 'Toán',
    code: 'toan',
    breakpoints: [
      { a: 0, b: 61, c: 0, d: 5.0, rank: '> 90%' },
      { a: 61, b: 71.5, c: 5.0, d: 5.75, rank: '90%' },
      { a: 71.5, b: 79, c: 5.75, d: 6.25, rank: '80%' },
      { a: 79, b: 86, c: 6.25, d: 6.75, rank: '70%' },
      { a: 86, b: 92.5, c: 6.75, d: 7.25, rank: '60%' },
      { a: 92.5, b: 98.5, c: 7.25, d: 7.5, rank: '50%' },
      { a: 98.5, b: 105.5, c: 7.5, d: 7.75, rank: '40%' },
      { a: 105.5, b: 113, c: 7.75, d: 8.25, rank: '30%' },
      { a: 113, b: 122.5, c: 8.25, d: 8.5, rank: '20%' },
      { a: 122.5, b: 129.5, c: 8.5, d: 9.0, rank: '10%' },
      { a: 129.5, b: 136.5, c: 9.0, d: 9.0, rank: '5%' },
      { a: 136.5, b: 140.5, c: 9.0, d: 9.5, rank: '2%' },
      { a: 140.5, b: 144, c: 9.5, d: 9.5, rank: '1%' },
      { a: 144, b: 150, c: 9.5, d: 10.0, rank: '0.5%' },
    ]
  },
  {
    name: 'Vật lí',
    code: 'vatly',
    breakpoints: [
      { a: 0, b: 61.5, c: 0, d: 3.75, rank: '> 90%' },
      { a: 61.5, b: 70, c: 3.75, d: 4.35, rank: '90%' },
      { a: 70, b: 76.5, c: 4.35, d: 5.0, rank: '80%' },
      { a: 76.5, b: 82, c: 5.0, d: 5.5, rank: '70%' },
      { a: 82, b: 87, c: 5.5, d: 6.0, rank: '60%' },
      { a: 87, b: 92, c: 6.0, d: 6.25, rank: '50%' },
      { a: 92, b: 97.5, c: 6.25, d: 6.75, rank: '40%' },
      { a: 97.5, b: 103.5, c: 6.75, d: 7.25, rank: '30%' },
      { a: 103.5, b: 112.5, c: 7.25, d: 8.0, rank: '20%' },
      { a: 112.5, b: 119, c: 8.0, d: 8.35, rank: '10%' },
      { a: 119, b: 126.5, c: 8.35, d: 8.75, rank: '5%' },
      { a: 126.5, b: 131, c: 8.75, d: 9.0, rank: '2%' },
      { a: 131, b: 135, c: 9.0, d: 9.25, rank: '1%' },
      { a: 135, b: 150, c: 9.25, d: 10.0, rank: '0.5%' },
    ]
  },
  {
    name: 'Hóa học',
    code: 'hoahoc',
    breakpoints: [
      { a: 0, b: 57, c: 0, d: 4.75, rank: '> 90%' },
      { a: 57, b: 66, c: 4.75, d: 5.5, rank: '90%' },
      { a: 66, b: 73, c: 5.5, d: 6.1, rank: '80%' },
      { a: 73, b: 80, c: 6.1, d: 6.6, rank: '70%' },
      { a: 80, b: 86, c: 6.6, d: 7.0, rank: '60%' },
      { a: 86, b: 92.5, c: 7.0, d: 7.35, rank: '50%' },
      { a: 92.5, b: 99, c: 7.35, d: 7.75, rank: '40%' },
      { a: 99, b: 107, c: 7.75, d: 8.0, rank: '30%' },
      { a: 107, b: 117, c: 8.0, d: 8.5, rank: '20%' },
      { a: 117, b: 125, c: 8.5, d: 8.75, rank: '10%' },
      { a: 125, b: 132, c: 8.75, d: 9.25, rank: '5%' },
      { a: 132, b: 136.5, c: 9.25, d: 9.25, rank: '2%' },
      { a: 136.5, b: 140, c: 9.25, d: 9.5, rank: '1%' },
      { a: 140, b: 150, c: 9.5, d: 10.0, rank: '0.5%' },
    ]
  },
  {
    name: 'Sinh học',
    code: 'sinhhoc',
    breakpoints: [
      { a: 0, b: 62, c: 0, d: 4.75, rank: '> 90%' },
      { a: 62, b: 71, c: 4.75, d: 5.35, rank: '90%' },
      { a: 71, b: 78, c: 5.35, d: 5.75, rank: '80%' },
      { a: 78, b: 84, c: 5.75, d: 6.1, rank: '70%' },
      { a: 84, b: 90.25, c: 6.1, d: 6.5, rank: '60%' },
      { a: 90.25, b: 96, c: 6.5, d: 6.85, rank: '50%' },
      { a: 96, b: 102, c: 6.85, d: 7.25, rank: '40%' },
      { a: 102, b: 109, c: 7.25, d: 7.75, rank: '30%' },
      { a: 109, b: 118.5, c: 7.75, d: 8.25, rank: '20%' },
      { a: 118.5, b: 125, c: 8.25, d: 8.75, rank: '10%' },
      { a: 125, b: 131, c: 8.75, d: 9.25, rank: '5%' },
      { a: 131, b: 135, c: 9.25, d: 9.5, rank: '2%' },
      { a: 135, b: 138, c: 9.5, d: 9.75, rank: '1%' },
      { a: 138, b: 150, c: 9.75, d: 10.0, rank: '0.5%' },
    ]
  },
  {
    name: 'Lịch sử',
    code: 'lichsu',
    breakpoints: [
      { a: 0, b: 75, c: 0, d: 5.75, rank: '> 90%' },
      { a: 75, b: 85, c: 5.75, d: 6.5, rank: '90%' },
      { a: 85, b: 91.5, c: 6.5, d: 7.0, rank: '80%' },
      { a: 91.5, b: 97.5, c: 7.0, d: 7.35, rank: '70%' },
      { a: 97.5, b: 103, c: 7.35, d: 7.75, rank: '60%' },
      { a: 103, b: 108, c: 7.75, d: 8.1, rank: '50%' },
      { a: 108, b: 113, c: 8.1, d: 8.5, rank: '40%' },
      { a: 113, b: 119, c: 8.5, d: 8.75, rank: '30%' },
      { a: 119, b: 126, c: 8.75, d: 9.25, rank: '20%' },
      { a: 126, b: 131, c: 9.25, d: 9.5, rank: '10%' },
      { a: 131, b: 136.5, c: 9.5, d: 9.75, rank: '5%' },
      { a: 136.5, b: 138, c: 9.75, d: 10.0, rank: '2%' },
      { a: 138, b: 141, c: 10.0, d: 10.0, rank: '1%' },
      { a: 141, b: 150, c: 10.0, d: 10.0, rank: '0.5%' },
    ]
  },
  {
    name: 'Địa lí',
    code: 'diali',
    breakpoints: [
      { a: 0, b: 68, c: 0, d: 4.6, rank: '> 90%' },
      { a: 68, b: 77.5, c: 4.6, d: 5.35, rank: '90%' },
      { a: 77.5, b: 84.5, c: 5.35, d: 5.75, rank: '80%' },
      { a: 84.5, b: 90.5, c: 5.75, d: 6.25, rank: '70%' },
      { a: 90.5, b: 95.5, c: 6.25, d: 6.5, rank: '60%' },
      { a: 95.5, b: 100.5, c: 6.5, d: 7.0, rank: '50%' },
      { a: 100.5, b: 105.5, c: 7.0, d: 7.25, rank: '40%' },
      { a: 105.5, b: 112, c: 7.25, d: 7.75, rank: '30%' },
      { a: 112, b: 119.5, c: 7.75, d: 8.25, rank: '20%' },
      { a: 119.5, b: 125, c: 8.25, d: 8.5, rank: '10%' },
      { a: 125, b: 130.5, c: 8.5, d: 8.75, rank: '5%' },
      { a: 130.5, b: 134, c: 8.75, d: 9.0, rank: '2%' },
      { a: 134, b: 135, c: 9.0, d: 9.5, rank: '1%' },
      { a: 135, b: 150, c: 9.5, d: 10.0, rank: '0.5%' },
    ]
  },
  {
    name: 'Tiếng Anh',
    code: 'tienganh',
    breakpoints: [
      { a: 0, b: 59.5, c: 0, d: 3.25, rank: '> 90%' },
      { a: 59.5, b: 70, c: 3.25, d: 3.75, rank: '90%' },
      { a: 70, b: 78.5, c: 3.75, d: 4.25, rank: '80%' },
      { a: 78.5, b: 86, c: 4.25, d: 4.75, rank: '70%' },
      { a: 86, b: 92.5, c: 4.75, d: 5.0, rank: '60%' },
      { a: 92.5, b: 99, c: 5.0, d: 5.5, rank: '50%' },
      { a: 99, b: 105.5, c: 5.5, d: 5.75, rank: '40%' },
      { a: 105.5, b: 112.9, c: 5.75, d: 6.5, rank: '30%' },
      { a: 112.9, b: 121.5, c: 6.5, d: 7.25, rank: '20%' },
      { a: 121.5, b: 129, c: 7.25, d: 7.75, rank: '10%' },
      { a: 129, b: 135, c: 7.75, d: 8.5, rank: '5%' },
      { a: 135, b: 138, c: 8.5, d: 8.75, rank: '2%' },
      { a: 138, b: 142, c: 8.75, d: 9.25, rank: '1%' },
      { a: 142, b: 150, c: 9.25, d: 10.0, rank: '0.5%' },
    ]
  },
  {
    name: 'Ngữ văn',
    code: 'nguvan',
    breakpoints: [
      { a: 0, b: 87, c: 0, d: 5.75, rank: '> 90%' },
      { a: 87, b: 93.5, c: 5.75, d: 6.25, rank: '90%' },
      { a: 93.5, b: 98.5, c: 6.25, d: 6.75, rank: '80%' },
      { a: 98.5, b: 102.5, c: 6.75, d: 7.0, rank: '70%' },
      { a: 102.5, b: 106, c: 7.0, d: 7.25, rank: '60%' },
      { a: 106, b: 109.5, c: 7.25, d: 7.5, rank: '50%' },
      { a: 109.5, b: 113, c: 7.5, d: 7.75, rank: '40%' },
      { a: 113, b: 116.5, c: 7.75, d: 8.0, rank: '30%' },
      { a: 116.5, b: 121.5, c: 8.0, d: 8.25, rank: '20%' },
      { a: 121.5, b: 125, c: 8.25, d: 8.5, rank: '10%' },
      { a: 125, b: 129, c: 8.5, d: 8.75, rank: '5%' },
      { a: 129, b: 131.5, c: 8.75, d: 9.0, rank: '2%' },
      { a: 131.5, b: 133.5, c: 9.0, d: 9.0, rank: '1%' },
      { a: 133.5, b: 150, c: 9.0, d: 10.0, rank: '0.5%' },
    ]
  }
];

function convertVsatToThpt(x: number, breakpoints: Breakpoint[]): { thptScore: number; bp: Breakpoint } | null {
  if (x === 0) return { thptScore: 0, bp: breakpoints[0] };
  for (const bp of breakpoints) {
    if (x > bp.a && x <= bp.b) {
      // Nếu c === d (đây là mốc điểm cố định)
      if (bp.c === bp.d) {
        return { thptScore: bp.c, bp };
      }
      const y = bp.c + ((x - bp.a) / (bp.b - bp.a)) * (bp.d - bp.c);
      return { thptScore: Math.round(y * 100) / 100, bp };
    }
  }
  return null;
}

// ============ Component ============

interface ConversionResult {
  vsatScore: number;
  thptScore: number;
  bp: Breakpoint;
  subjectName: string;
}

export default function ScoreConverter() {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState('toan');
  const [inputScore, setInputScore] = useState('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentSubject = subjects.find(s => s.code === selectedSubject)!;

  const handleConvert = () => {
    setError(null);
    setResult(null);

    const score = parseFloat(inputScore);
    if (isNaN(score)) {
      setError('Vui lòng nhập điểm V-SAT.');
      return;
    }
    if (score < 0 || score > 150) {
      setError('Điểm V-SAT phải nằm trong khoảng 0 – 150.');
      return;
    }

    const res = convertVsatToThpt(score, currentSubject.breakpoints);
    if (!res) {
      setError('Không thể quy đổi điểm này.');
      return;
    }

    setResult({
      vsatScore: score,
      thptScore: res.thptScore,
      bp: res.bp,
      subjectName: currentSubject.name,
    });
  };

  const handleReset = () => {
    setInputScore('');
    setResult(null);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConvert();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      {/* Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200/80 z-30">
        <div className="max-w-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 text-xs font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Quay lại</span>
            </button>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Calculator className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-800 tracking-tight block leading-none">Quy đổi điểm</span>
                <span className="text-[10px] text-indigo-600 font-bold tracking-wider uppercase block">V-SAT → THPT 2026</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 pt-8 space-y-6">

        {/* Hero */}
        <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white overflow-hidden p-6 shadow-xl">
          <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] rounded-full bg-indigo-600/25 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-[-20%] left-[10%] w-[200px] h-[200px] rounded-full bg-violet-600/20 blur-[80px] pointer-events-none" />
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Bảng điểm ĐH Cần Thơ 2026</span>
            </div>
            <h1 className="text-xl font-black tracking-tight">
              Quy đổi điểm <span className="bg-gradient-to-r from-indigo-400 to-violet-300 bg-clip-text text-transparent">V-SAT → THPT</span>
            </h1>
            <p className="text-slate-400 text-xs">
              Nhập điểm V-SAT theo từng môn thi để quy đổi chính xác theo quyết định chính thức năm 2026.
            </p>
          </div>
        </div>

        {/* Converter Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">

          {/* Subject Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Chọn môn thi</label>
            <div className="grid grid-cols-4 gap-2">
              {subjects.map(s => (
                <button
                  key={s.code}
                  onClick={() => { setSelectedSubject(s.code); setResult(null); setError(null); }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center ${
                    selectedSubject === s.code
                      ? 'bg-indigo-600 text-white border-transparent shadow-md shadow-indigo-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Score Input + Button */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Điểm V-SAT (0 – 150)</label>
            <div className="flex gap-3">
              <input
                type="number"
                step="0.01"
                min="0"
                max="150"
                value={inputScore}
                onChange={(e) => { setInputScore(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                placeholder="Ví dụ: 115"
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />
              <button
                onClick={handleConvert}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98] flex items-center gap-2 shrink-0"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Quy đổi</span>
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-3 border border-slate-200 hover:bg-slate-50 text-slate-400 rounded-xl transition-all cursor-pointer shrink-0"
                title="Xóa"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-2xl text-xs font-medium animate-[fadeIn_0.2s_ease-out]">
              <Info className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              <div className="relative rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 text-white p-6 overflow-hidden">
                <div className="absolute top-[-30%] right-[-10%] w-[200px] h-[200px] rounded-full bg-white/5 blur-[60px] pointer-events-none" />

                <div className="relative z-10">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mb-4">Kết quả — Môn {result.subjectName}</div>

                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                      <div className="text-[10px] text-indigo-300 font-medium mb-1 uppercase tracking-wider">V-SAT (x)</div>
                      <div className="text-3xl font-black">{result.vsatScore}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-indigo-300 shrink-0" />
                    <div className="text-center">
                      <div className="text-[10px] text-indigo-300 font-medium mb-1 uppercase tracking-wider">THPT (y)</div>
                      <div className="text-3xl font-black bg-gradient-to-r from-white to-indigo-100 bg-clip-text text-transparent">
                        {result.thptScore}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-indigo-200 bg-white/5 rounded-xl p-3 border border-white/10 font-mono leading-relaxed">
                    {result.bp.c === result.bp.d ? (
                      <span>y = {result.bp.c} (mốc điểm chuẩn)</span>
                    ) : (
                      <span>y = {result.bp.c} + (({result.vsatScore} − {result.bp.a}) / ({result.bp.b} − {result.bp.a})) × ({result.bp.d} − {result.bp.c}) = <strong className="text-white">{result.thptScore}</strong></span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Note info */}
        <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl">
          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
          <span>Quy đổi chính xác dựa theo Bảng quy đổi điểm V-SAT năm 2026 ban hành kèm theo Thông báo số 2156/TB-ĐHCT-ĐT ngày 07/07/2026 của Giám đốc Đại học Cần Thơ.</span>
        </div>

      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
