'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Clock, Award, BookOpen, CheckCircle, XCircle } from 'lucide-react';

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
      const types = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assessments/types`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());

      const results = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assessments/results/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());

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
      }).then(r => r.json());

      setCurrentAssessment(res);
      setTimeLeft(res.config.duration_minutes);
      setAnswers({});
      setShowTypes(false);
      setShowQuiz(true);
      setSubmitting(false);
    } catch (err: any) {
      alert(err.message || '创建测评失败');
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
      }).then(r => r.json());

      setResult(res);
      setShowQuiz(false);
      setShowResult(true);
    } catch (err: any) {
      alert(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (showResult && result) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="bg-gradient-to-br from-blue-50 to-purple-50">
          <CardHeader>
            <CardTitle className="text-2xl text-center">测评完成</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-6xl font-bold text-blue-600 mb-2">
                {result.score}%
              </div>
              <div className="text-xl text-gray-700">
                掌握程度：<span className="font-semibold text-purple-600">{result.mastery_level}</span>
              </div>
              {result.passed ? (
                <div className="flex items-center justify-center gap-2 mt-4 text-green-600">
                  <CheckCircle className="w-6 h-6" />
                  <span>通过测评</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mt-4 text-red-600">
                  <XCircle className="w-6 h-6" />
                  <span>未通过，建议复习</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{result.correct_count}</div>
                <div className="text-sm text-gray-500">正确</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{result.total_questions - result.correct_count}</div>
                <div className="text-sm text-gray-500">错误</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{result.time_spent}分钟</div>
                <div className="text-sm text-gray-500">用时</div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700">
                <Award className="w-5 h-5" />
                <span>获得 {result.earned_points} 积分奖励</span>
              </div>
            </div>

            {result.recommendations?.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">学习建议</h3>
                {result.recommendations.map((rec: any, i: number) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    {rec.title}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => {
                setShowResult(false);
                setShowTypes(true);
                setResult(null);
              }}>
                再测一次
              </Button>
              <Link href={`/classrooms/${courseId}`}>
                <Button>返回课程</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showQuiz && currentAssessment) {
    return (
      <div className="container max-w-3xl py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{currentAssessment.config.name}</h1>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-5 h-5" />
            <span>{timeLeft} 分钟</span>
          </div>
        </div>

        <Progress
          value={Object.keys(answers).length / currentAssessment.questions.length * 100}
          className="mb-6"
        />

        <div className="space-y-6">
          {currentAssessment.questions.map((q, i) => (
            <Card key={q.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {q.difficulty}
                  </span>
                  <span className="text-sm text-gray-500">{q.points}分</span>
                </div>
                <CardTitle className="text-lg">
                  {i + 1}. {q.content}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={answers[q.id] || ''}
                  onValueChange={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                >
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center space-x-2 py-2">
                      <RadioGroupItem value={String.fromCharCode(65 + oi)} id={`${q.id}-${oi}`} />
                      <Label htmlFor={`${q.id}-${oi}`} className="cursor-pointer">
                        {String.fromCharCode(65 + oi)}. {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between mt-8">
          <Button variant="outline" onClick={() => {
            setShowQuiz(false);
            setShowTypes(true);
            setCurrentAssessment(null);
          }}>
            取消测评
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < currentAssessment.questions.length || submitting}
          >
            {submitting ? '提交中...' : '提交答案'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="w-6 h-6" />
        <h1 className="text-2xl font-bold">学习效果测评</h1>
      </div>

      <p className="text-gray-600 mb-8">
        完成课程后进行测评，量化知识掌握程度，获得积分奖励
      </p>

      <div className="grid gap-4">
        {assessments.map((type) => (
          <Card key={type.id} className="hover:shadow-lg transition cursor-pointer"
            onClick={() => startAssessment(type.id)}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{type.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>⏱ {type.duration_minutes}分钟</span>
                    <span>📝 {type.questions_count}题</span>
                    <span className="capitalize">{type.difficulty}</span>
                  </div>
                </div>
                <Button disabled={submitting}>
                  {submitting ? '创建中...' : '开始测评'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Link href={`/classrooms/${courseId}`}>
        <Button variant="outline" className="mt-8">返回课程</Button>
      </Link>
    </div>
  );
}