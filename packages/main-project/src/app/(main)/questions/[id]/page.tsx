'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { showError, showSuccess } from '@/lib/error-toast';

interface Question {
  id: string;
  title: string;
  content: string;
  bounty: number;
  bounty_status: string;
  user_nickname: string;
  view_count: number;
}

interface Answer {
  id: string;
  content: string;
  vote_count: number;
  is_accepted: boolean;
  user_nickname: string;
  created_at: string;
}

export default function QuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const questionId = params.id as string;

  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [answerContent, setAnswerContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [questionId]);

  async function loadData() {
    setLoading(true);
    try {
      const [qData, aData] = await Promise.all([
        apiClient.getQuestion(questionId),
        apiClient.getAnswers(questionId),
      ]);
      setQuestion(qData);
      setAnswers(aData.items || []);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (!answerContent.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.createAnswer({
        question_id: questionId,
        content: answerContent,
      });
      setAnswerContent('');
      showSuccess('回答已提交');
      loadData();
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function voteAnswer(answerId: string, vote: 1 | -1) {
    try {
      await apiClient.voteAnswer(answerId, vote);
      loadData();
    } catch (err) {
      showError(err);
    }
  }

  async function acceptAnswer(answerId: string) {
    try {
      await apiClient.acceptAnswer(answerId);
      showSuccess('答案已采纳');
      loadData();
    } catch (err) {
      showError(err);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  if (!question) {
    return <div className="min-h-screen flex items-center justify-center">问题不存在</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-bold text-gray-800">{question.title}</h1>
            {question.bounty > 0 && (
              <div className="text-orange-500 font-medium">
                悬赏 {question.bounty} 积分
              </div>
            )}
          </div>
          <p className="text-gray-600 mb-4">{question.content}</p>
          <div className="flex justify-between text-sm text-gray-400">
            <span>{question.user_nickname}</span>
            <span>👁 {question.view_count} 浏览</span>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-medium mb-4">回答 ({answers.length})</h2>
          {answers.length === 0 ? (
            <div className="text-center py-6 text-gray-500">暂无回答</div>
          ) : (
            <div className="space-y-4">
              {answers.map((a) => (
                <div
                  key={a.id}
                  className={`bg-white rounded-lg shadow p-4 ${
                    a.is_accepted ? 'border-2 border-green-500' : ''
                  }`}
                >
                  <p className="text-gray-600 mb-4">{a.content}</p>
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <button
                        onClick={() => voteAnswer(a.id, 1)}
                        className="px-2 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => voteAnswer(a.id, -1)}
                        className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                      >
                        👎
                      </button>
                      <span className="text-gray-500">{a.vote_count} 票</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {a.user_nickname} · {new Date(a.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {a.is_accepted && (
                    <div className="mt-2 text-green-500 text-sm">✓ 已采纳</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium mb-4">提交回答</h3>
          <textarea
            value={answerContent}
            onChange={(e) => setAnswerContent(e.target.value)}
            className="w-full h-32 border rounded p-3 resize-none"
            placeholder="写下你的回答..."
          />
          <button
            onClick={submitAnswer}
            disabled={submitting || !answerContent.trim()}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '提交回答'}
          </button>
        </div>
      </div>
    </div>
  );
}