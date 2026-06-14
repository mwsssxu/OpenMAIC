'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Clock, Sparkles, CheckCircle2, XCircle, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { showError, showSuccess } from '@/lib/error-toast';

interface Question {
  id: string;
  type: string;
  content: string;
  options: string[];
  difficulty: string;
  points: number;
}

interface Assessment {
  assessment_id: string;
  course_id: string;
  assessment_type: string;
  config: {
    name: string;
    duration_minutes: number;
    questions_count: number;
  };
  questions: Question[];
  duration_minutes: number;
  expires_at: string;
  status: string;
  time_remaining: number;
}

interface QuestionResult {
  question_id: string;
  content: string;
  type: string;
  options?: any;
  user_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
  points: number;
  difficulty?: string;
}

interface AssessmentResult {
  assessment_id: string;
  score: number;
  mastery_level: string;
  passed: boolean;
  correct_count: number;
  total_questions: number;
  time_spent: number;
  recommendations: any[];
  earned_points: number;
  question_results?: QuestionResult[];
}

/** 选项解析：兼容 dict {A:"x"} 和 array ["x"] */
function parseOptions(options: any): Array<[string, string]> {
  if (!options) return [];
  if (typeof options === 'object' && !Array.isArray(options)) {
    return Object.entries(options).map(([k, v]) => [String(k), String(v ?? '')]);
  }
  if (Array.isArray(options)) {
    return options.map((v: any, i: number) => [String.fromCharCode(65 + i), String(v ?? '')]);
  }
  return [];
}

function pickedToKey(entries: Array<[string, string]>, picked: string | null | undefined): string | null {
  if (picked == null) return null;
  if (entries.some(([k]) => k === picked)) return picked;
  const hit = entries.find(([, label]) => label === picked);
  return hit ? hit[0] : picked;
}

function QuestionResultCard({ qr, index }: { qr: QuestionResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const correct = qr.is_correct;
  const optionEntries = parseOptions(qr.options);
  const correctKey = pickedToKey(optionEntries, qr.correct_answer);
  const userKey = pickedToKey(optionEntries, qr.user_answer);
  const correctLabel = optionEntries.find(([k]) => k === correctKey)?.[1] ?? qr.correct_answer ?? '';

  const bgClass = correct
    ? 'bg-emerald-50 border-emerald-200'
    : 'bg-red-50 border-red-200';
  const accentClass = correct ? 'text-emerald-600' : 'text-red-600';

  return (
    <div
      className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${bgClass}`}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Header: index + content + status */}
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
          {index}
        </span>
        <p className={`flex-1 text-sm leading-relaxed text-gray-800 ${!expanded ? 'line-clamp-2' : ''}`}>
          {qr.content || '（题干缺失）'}
        </p>
        {correct ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 space-y-2 pl-10">
          {optionEntries.length > 0 ? (
            <div className="space-y-1.5">
              {optionEntries.map(([key, label]) => {
                const isCorrect = key === correctKey;
                const isWrongPick = !correct && userKey === key;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                      isCorrect
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-medium'
                        : isWrongPick
                        ? 'bg-red-50 border-red-300 text-red-700 line-through'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    <span className="font-semibold min-w-[20px]">{key}.</span>
                    <span className="flex-1">{label}</span>
                    {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {isWrongPick && <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                你的答案：<span className={accentClass + ' font-semibold'}>{qr.user_answer || '（未作答）'}</span>
              </p>
              {!correct && (
                <p className="text-sm text-gray-600">
                  正确答案：<span className="text-emerald-600 font-semibold">{correctLabel}</span>
                </p>
              )}
            </div>
          )}
          {qr.explanation && (
            <div className="bg-white rounded-lg p-3 border-l-4 border-blue-400">
              <p className="text-xs font-semibold text-blue-500 mb-1">解析</p>
              <p className="text-sm text-gray-700 leading-relaxed">{qr.explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* Expand hint */}
      <div className="flex items-center justify-center gap-1 mt-2 text-xs text-gray-400">
        {expanded ? '收起' : '展开详情'}
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </div>
    </div>
  );
}

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading, token } = useAuth();
  const courseId = params.id as string;

  const [assessments, setAssessments] = useState<any[]>([]);
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showTypes, setShowTypes] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && courseId) {
      loadAssessmentTypes();
    }
  }, [isAuthenticated, courseId]);

  useEffect(() => {
    if (showQuiz && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 60 * 1000);
      return () => clearInterval(timer);
    }
  }, [showQuiz, timeLeft]);

  async function loadAssessmentTypes() {
    try {
      const typesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assessments/types`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!typesRes.ok) { setLoading(false); return; }
      const types = await typesRes.json();

      const resultsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assessments/results/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resultsRes.ok) { setLoading(false); return; }
      const results = await resultsRes.json();

      setAssessments(types.types || []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  async function startAssessment(type: string) {
    try {
      setSubmitting(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assessments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ course_id: courseId, assessment_type: type })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errData } };
      }
      const data = await res.json();

      setCurrentAssessment(data);
      setTimeLeft(data.config.duration_minutes);
      setAnswers({});
      setShowTypes(false);
      setShowQuiz(true);
      setSubmitting(false);
    } catch (err: any) {
      showError(err);
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!currentAssessment || submitting) return;

    setSubmitting(true);
    try {
      const answerList = Object.entries(answers).map(([qId, ans]) => ({
        question_id: qId,
        answer: ans
      }));

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assessments/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          assessment_id: currentAssessment.assessment_id,
          answers: answerList
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errData } };
      }
      const data = await res.json();

      setResult(data);
      setShowQuiz(false);
      setShowResult(true);
    } catch (err: any) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="bg-white/90 backdrop-blur rounded-2xl p-8 shadow-xl">
          <div className="loading-spinner mx-auto mb-4"></div>
          <div className="text-gray-600 font-medium">加载测评数据...</div>
        </div>
      </div>
    );
  }

  if (showResult && result) {
    const masteryColors: Record<string, string> = {
      '精通': 'from-emerald-400 to-green-500',
      '熟练': 'from-blue-400 to-indigo-500',
      '掌握': 'from-purple-400 to-violet-500',
      '了解': 'from-yellow-400 to-orange-500',
      '需复习': 'from-red-400 to-rose-500',
    };

    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container max-w-2xl">
          {/* Result Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-8 text-white mb-6 animate-bounce-in">
            <div className="text-center">
              <div className="text-6xl font-bold mb-2 animate-scale-in">
                {result.score}%
              </div>
              <div className="text-xl opacity-90 mb-4">
                掌握程度：<span className="font-bold">{result.mastery_level}</span>
              </div>
              <div className="flex justify-center gap-4">
                {result.passed ? (
                  <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                    <span className="text-xl">✅</span>
                    <span>通过测评</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                    <span className="text-xl">📚</span>
                    <span>建议继续学习</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6 animate-slide-in">
            <div className="card p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">
                ✓
              </div>
              <div className="text-2xl font-bold text-green-600">{result.correct_count}</div>
              <div className="text-sm text-gray-500">正确</div>
            </div>
            <div className="card p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">
                ✗
              </div>
              <div className="text-2xl font-bold text-red-500">{result.total_questions - result.correct_count}</div>
              <div className="text-sm text-gray-500">错误</div>
            </div>
            <div className="card p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">
                ⏱️
              </div>
              <div className="text-2xl font-bold text-blue-600">{result.time_spent}</div>
              <div className="text-sm text-gray-500">分钟</div>
            </div>
          </div>

          {/* Rewards */}
          {result.earned_points > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-amber-50 rounded-2xl p-6 mb-6 animate-scale-in">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-3xl shadow-lg">
                  ⭐
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">获得积分奖励</h3>
                  <div className="text-3xl font-bold text-orange-500">{result.earned_points}</div>
                </div>
                <div className="ml-auto">
                  <Sparkles className="w-8 h-8 text-yellow-500 animate-pulse" />
                </div>
              </div>
            </div>
          )}

            {result.recommendations?.length > 0 && (
              <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6 mb-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="text-xl">💡</span> 学习建议
                </h3>
                {result.recommendations.map((rec: any, i: number) => (
                  <div key={i} className="p-4 bg-white rounded-lg mb-2 shadow-sm">
                    {rec.title}
                  </div>
                ))}
              </div>
            )}

            {/* 逐题回顾 */}
            {result.question_results && result.question_results.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-800">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  答题回顾
                </h3>
                <div className="space-y-3">
                  {result.question_results.map((qr, idx) => (
                    <QuestionResultCard key={qr.question_id} qr={qr} index={idx + 1} />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => {
                setShowResult(false);
                setShowTypes(true);
                setResult(null);
              }}>
                🔄 再测一次
              </Button>
              <Link href={`/classrooms/${courseId}`} className="flex-1">
                <Button className="w-full btn-primary">
                  📚 返回课程
                </Button>
              </Link>
            </div>

            {/* 错题复习引导 */}
            {result.question_results && result.question_results.some(qr => !qr.is_correct) && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">📌</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-orange-800 text-sm">
                      {result.question_results.filter(qr => !qr.is_correct).length} 道错题已进入错题本
                    </p>
                    <p className="text-xs text-orange-600 mt-0.5">移动端可随时复习，趁热打铁效果最好</p>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    );
  }

  if (showQuiz && currentAssessment) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white shadow-lg sticky top-0 z-50">
          <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                📝
              </div>
              <div>
                <h1 className="text-lg font-bold">{currentAssessment.config.name}</h1>
                <p className="text-xs text-white/70">学习测评</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 backdrop-blur">
              <Clock className="w-5 h-5" />
              <span className="font-semibold">{timeLeft} 分钟</span>
            </div>
          </div>
        </header>

        <div className="container max-w-3xl mx-auto px-4 py-8">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">答题进度</span>
              <span className="text-sm font-semibold text-indigo-600">
                {Object.keys(answers).length}/{currentAssessment.questions.length}
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${Object.keys(answers).length / currentAssessment.questions.length * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {currentAssessment.questions.map((q, i) => (
              <div key={q.id} className="card p-6 animate-slide-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="badge badge-primary">
                    {q.difficulty}
                  </span>
                  <span className="text-sm text-gray-500">{q.points}分</span>
                </div>
                <h3 className="font-semibold text-lg mb-4">
                  {i + 1}. {q.content}
                </h3>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      htmlFor={`${q.id}-${oi}`}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        answers[q.id] === String.fromCharCode(65 + oi)
                          ? 'bg-gradient-to-r from-indigo-100 to-purple-100 border-2 border-indigo-400'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={String.fromCharCode(65 + oi)}
                        checked={answers[q.id] === String.fromCharCode(65 + oi)}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="font-medium text-gray-700">
                        {String.fromCharCode(65 + oi)}.
                      </span>
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-between mt-8 gap-4">
            <Button variant="outline" className="flex-1" onClick={() => {
              setShowQuiz(false);
              setShowTypes(true);
              setCurrentAssessment(null);
            }}>
              ✕ 取消测评
            </Button>
            <Button
              className="btn-primary flex-1"
              onClick={handleSubmit}
              disabled={Object.keys(answers).length < currentAssessment.questions.length || submitting}
            >
              {submitting ? '⏳ 提交中...' : '✓ 提交答案'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Assessment types selection
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white shadow-lg">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <Link href={`/classrooms/${courseId}`} className="flex items-center gap-2 text-white/80 hover:text-white mb-2">
            ← 返回课程
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
              📝
            </div>
            学习效果测评
          </h1>
        </div>
      </header>

      <div className="container max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6 mb-8 animate-fade-in">
          <p className="text-gray-700 leading-relaxed">
            完成课程学习后，通过测评量化您的知识掌握程度。根据测评结果，您将获得相应的积分奖励，并获得个性化的学习建议。
          </p>
        </div>

        {/* Assessment Types */}
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="text-xl">🎯</span> 选择测评类型
        </h2>

        <div className="grid gap-4">
          {assessments.map((type, index) => (
            <div
              key={type.id}
              className="card p-6 cursor-pointer animate-slide-in"
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => !submitting && startAssessment(type.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center text-2xl">
                    📋
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{type.name}</h3>
                    <p className="text-sm text-gray-500">{type.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">⏱️ {type.duration_minutes}分钟</span>
                      <span className="flex items-center gap-1">📝 {type.questions_count}题</span>
                    </div>
                  </div>
                </div>
                <button className="btn-primary" disabled={submitting}>
                  {submitting ? '⏳' : '开始'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <Link href={`/classrooms/${courseId}`}>
          <Button variant="outline" className="mt-8 w-full">
            📚 返回课程学习
          </Button>
        </Link>
      </div>
    </div>
  );
}