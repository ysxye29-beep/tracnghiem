import React, { useMemo, useState } from 'react';
import { QuizData, UserAnswers, Question, Folder } from '../types';
import { Button } from './Button';
import { exportToWord } from '../services/exportService';

interface QuizResultsProps {
  data: QuizData;
  userAnswers: UserAnswers;
  timeSpent: number;
  onRetry: () => void;
  onRetryWrong: (questions: Question[]) => void;
  onRetryBookmarked: (questions: Question[]) => void;
  onNewFile: () => void;
  bookmarks: number[];
  onToggleBookmark: (id: number) => void;
  onSave?: (folderId?: string) => void;
  isLoggedIn?: boolean;
  folders?: Folder[];
  isSyncing?: boolean;
}

export const QuizResults: React.FC<QuizResultsProps> = ({ 
  data, 
  userAnswers, 
  timeSpent, 
  onRetry, 
  onRetryWrong, 
  onRetryBookmarked,
  onNewFile,
  bookmarks,
  onToggleBookmark,
  onSave,
  isLoggedIn,
  folders,
  isSyncing
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'correct' | 'incorrect' | 'bookmarked'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const stats = useMemo(() => {
    let correct = 0;
    let skipped = 0;
    data.questions.forEach(q => {
      const uAns = userAnswers[q.id] || [];
      if (uAns.length === 0) {
        skipped++;
      } else {
        // Compare arrays
        const sortedUser = [...uAns].sort().join(',');
        const sortedCorrect = [...q.correctAnswers].sort().join(',');
        if (sortedUser === sortedCorrect) {
            correct++;
        }
      }
    });
    const score = (correct / data.questions.length) * 10;
    return { correct, skipped, incorrect: data.questions.length - correct - skipped, score };
  }, [data, userAnswers]);

  const wrongQuestions = useMemo(() => {
    return data.questions.filter(q => {
      const uAns = userAnswers[q.id] || [];
      if (uAns.length === 0) return true;
      const sortedUser = [...uAns].sort().join(',');
      const sortedCorrect = [...q.correctAnswers].sort().join(',');
      return sortedUser !== sortedCorrect;
    });
  }, [data, userAnswers]);

  const bookmarkedQuestionsList = useMemo(() => {
    return data.questions.filter(q => bookmarks.includes(q.id));
  }, [data, bookmarks]);

  const filteredQuestions = data.questions.filter(q => {
    if (filterMode === 'bookmarked') return bookmarks.includes(q.id);
    
    const uAns = userAnswers[q.id] || [];
    const sortedUser = [...uAns].sort().join(',');
    const sortedCorrect = [...q.correctAnswers].sort().join(',');
    const isCorrect = sortedUser === sortedCorrect;

    if (filterMode === 'correct') return isCorrect;
    if (filterMode === 'incorrect') return !isCorrect;
    return true;
  });

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportWord = async () => {
    setIsExporting(true);
    try {
      await exportToWord(data, userAnswers, timeSpent, stats.score);
    } catch (e) {
      console.error("Export error", e);
      alert("Có lỗi khi tạo file Word. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Print-only Header */}
      <div className="hidden print-header">
        <h1 className="text-2xl font-bold text-black">KẾT QUẢ BÀI THI TRẮC NGHIỆM</h1>
        <p className="text-lg text-black mt-1 font-semibold">Đề tài: {data.title}</p>
        <div className="flex gap-4 mt-2 text-sm text-black border-b-2 border-black pb-4 mb-4">
          <span>Ngày: {new Date().toLocaleDateString('vi-VN')}</span>
          <span>Thời gian làm bài: {formatTime(timeSpent)}</span>
          <span className="font-bold">Điểm số: {stats.score.toFixed(1)}/10</span>
        </div>
      </div>

      <div className="text-center mb-10 no-print">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Kết quả bài làm</h2>
        <p className="text-slate-500 dark:text-slate-400">Đề thi: {data.title}</p>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Điểm số</div>
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{stats.score.toFixed(1)}</div>
          <div className="text-xs text-slate-400">Thang điểm 10</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Đúng</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-500">{stats.correct}</div>
          <div className="text-xs text-slate-400">/{data.questions.length} câu</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Sai/Bỏ qua</div>
          <div className="text-3xl font-bold text-red-500 dark:text-red-400">{stats.incorrect + stats.skipped}</div>
          <div className="text-xs text-slate-400">câu</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Thời gian</div>
          <div className="text-3xl font-bold text-slate-700 dark:text-slate-200">{formatTime(timeSpent)}</div>
          <div className="text-xs text-slate-400">hoàn thành</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap justify-center gap-4 mb-10 no-print">
        {wrongQuestions.length > 0 && (
          <Button 
            onClick={() => onRetryWrong(wrongQuestions)} 
            variant="danger"
            className="bg-orange-600 hover:bg-orange-700 text-white border-none shadow-orange-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Ôn lại {wrongQuestions.length} câu sai
          </Button>
        )}

        {bookmarkedQuestionsList.length > 0 && (
          <Button 
            onClick={() => onRetryBookmarked(bookmarkedQuestionsList)} 
            variant="outline"
            className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-400 dark:hover:bg-orange-900/20"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-8a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5-5 5H3z" />
            </svg>
            Ôn lại {bookmarkedQuestionsList.length} câu đã lưu
          </Button>
        )}
        
        <Button onClick={onRetry} variant="secondary">Làm lại tất cả</Button>
        <Button onClick={onNewFile} variant="secondary">Quay lại trang chính</Button>
        
        {isLoggedIn && onSave && (
          <Button 
            onClick={() => onSave()} 
            variant="outline"
            isLoading={isSyncing}
            className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Lưu tiến độ bài làm
          </Button>
        )}
        
        <div className="flex gap-2">
          <Button onClick={handleExportWord} isLoading={isExporting} className="bg-blue-600 hover:bg-blue-700 text-white border-none">
             <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
             </svg>
             Tải Word
          </Button>

          <Button onClick={handlePrint} className="bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            In / Lưu PDF
          </Button>
        </div>
      </div>

      {/* Review Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex gap-2 overflow-x-auto no-print">
          <button 
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filterMode === 'all' 
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Tất cả ({data.questions.length})
          </button>
          <button 
             onClick={() => setFilterMode('correct')}
             className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
               filterMode === 'correct' 
               ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
               : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
             }`}
          >
            Làm đúng ({stats.correct})
          </button>
          <button 
             onClick={() => setFilterMode('incorrect')}
             className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
               filterMode === 'incorrect' 
               ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
               : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
             }`}
          >
            Làm sai ({stats.incorrect + stats.skipped})
          </button>
          <button 
             onClick={() => setFilterMode('bookmarked')}
             className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
               filterMode === 'bookmarked' 
               ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' 
               : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
             }`}
          >
            <span>Đã lưu</span>
            <span className="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 text-xs px-1.5 py-0.5 rounded-full ml-1">
              {bookmarkedQuestionsList.length}
            </span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {filteredQuestions.map((q, idx) => {
            const userChoice = userAnswers[q.id] || [];
            const sortedUser = [...userChoice].sort().join(',');
            const sortedCorrect = [...q.correctAnswers].sort().join(',');
            const isCorrect = sortedUser === sortedCorrect;
            const isBookmarked = bookmarks.includes(q.id);
            
            return (
              <div key={q.id} className="p-6 question-break-avoid">
                <div className="flex gap-3 mb-3">
                   <span className={`
                     w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0 mt-0.5
                     ${isCorrect 
                       ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' 
                       : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                     }
                   `}>
                     {q.id}
                   </span>
                   <div className="flex-1">
                     <div className="flex justify-between items-start mb-4">
                        <p className="text-slate-900 dark:text-slate-100 font-medium pr-8">{q.text}</p>
                        <button 
                          onClick={() => onToggleBookmark(q.id)}
                          className={`shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 no-print ${isBookmarked ? 'text-orange-500' : 'text-slate-300'}`}
                        >
                           <svg className={`w-5 h-5 ${isBookmarked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-8a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5-5 5H3z" />
                           </svg>
                        </button>
                     </div>
                     
                     <div className="space-y-2">
                       {q.options.map(opt => {
                         let styleClass = "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300";
                         let icon = null;

                         const isSelected = userChoice.includes(opt.key);
                         const isCorrectOption = q.correctAnswers.includes(opt.key);

                         if (isCorrectOption) {
                           styleClass = "border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-bold-print";
                           if (isSelected) {
                               icon = <span className="text-green-600 dark:text-green-400 ml-auto font-bold flex items-center gap-1">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                 Bạn chọn đúng
                               </span>;
                           } else {
                               icon = <span className="text-green-600 dark:text-green-400 ml-auto font-bold flex items-center gap-1">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                 Đáp án đúng
                               </span>;
                           }
                         } else if (isSelected) {
                           styleClass = "border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 font-bold-print";
                           icon = <span className="text-red-600 dark:text-red-400 ml-auto font-bold flex items-center gap-1">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                             Bạn chọn sai
                           </span>;
                         }

                         return (
                           <div key={opt.key} className={`flex items-center p-3 rounded-lg border text-sm ${styleClass}`}>
                             <span className="font-bold mr-3 w-4">{opt.key}.</span>
                             <span>{opt.text}</span>
                             {icon}
                           </div>
                         );
                       })}
                     </div>

                     {(q.explanation || q.optionExplanations) && (
                       <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-800 explanation-print">
                         <span className="font-semibold block mb-1">💡 Giải thích:</span>
                         {q.explanation && <p className="mb-2">{q.explanation}</p>}
                         
                         {q.optionExplanations && (
                            <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-700/50">
                                {Object.entries(q.optionExplanations).map(([key, text]) => (
                                    <div key={key} className="flex items-start gap-1 mb-1">
                                        <span className="font-bold text-xs mt-0.5 w-4">{key}:</span>
                                        <span className="text-xs opacity-90">{text}</span>
                                    </div>
                                ))}
                            </div>
                         )}
                       </div>
                     )}
                   </div>
                </div>
              </div>
            );
          })}
          
          {filteredQuestions.length === 0 && (
             <div className="p-12 text-center text-slate-500 dark:text-slate-400">
               Không có câu hỏi nào trong mục này.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};