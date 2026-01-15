import React from 'react';
import { QuizHistoryItem } from '../types';
import { Button } from './Button';

interface QuizHistoryProps {
  history: QuizHistoryItem[];
  onView: (item: QuizHistoryItem) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export const QuizHistory: React.FC<QuizHistoryProps> = ({ history, onView, onDelete, onBack }) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}p ${s}s`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Lịch sử bài thi</h2>
        <Button onClick={onBack} variant="secondary">
          Quay lại
        </Button>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-lg">Chưa có bài thi nào được lưu.</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Hãy làm một bài kiểm tra để xem lịch sử tại đây.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {history.sort((a, b) => b.timestamp - a.timestamp).map((item) => (
            <div 
              key={item.id}
              className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                    item.score >= 8 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : item.score >= 5
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {item.score.toFixed(1)} điểm
                  </span>
                  <span className="text-slate-400 text-xs flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {formatDate(item.timestamp)}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-lg line-clamp-1">{item.title}</h3>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Đúng: <b>{item.correctCount}/{item.totalQuestions}</b></span>
                  <span>Thời gian: {formatTime(item.timeSpent)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                <Button onClick={() => onView(item)} variant="outline" className="flex-1 md:flex-none text-sm py-2">
                  Xem lại
                </Button>
                <button 
                  onClick={() => onDelete(item.id)}
                  className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Xóa kết quả này"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};