import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { QuizData } from '../types';

interface QuizConfigProps {
  data: QuizData;
  onStart: (config: { questionCount: number; isRandom: boolean; timeLimit: number; isExamMode: boolean }) => void;
  onCancel: () => void;
  onLoadBatch: (index: number) => void;
  onLoadMore: () => void;
  currentBatchIndex: number;
}

export const QuizConfig: React.FC<QuizConfigProps> = ({ data, onStart, onCancel, onLoadBatch, onLoadMore, currentBatchIndex }) => {
  const totalQuestions = data.questions.length;
  const maxAllowed = totalQuestions;

  const [questionCount, setQuestionCount] = useState(maxAllowed);
  const [timeLimit, setTimeLimit] = useState(maxAllowed); // Minutes
  const [isRandom, setIsRandom] = useState(false);
  const [isExamMode, setIsExamMode] = useState(false); // Default to Practice mode

  // Update question count when data changes
  useEffect(() => {
    setQuestionCount(totalQuestions);
    setTimeLimit(totalQuestions);
  }, [totalQuestions]);

  const handleQuestionCountChange = (val: number) => {
    setQuestionCount(val);
    setTimeLimit(val);
  };

  const handleStart = () => {
    onStart({ 
      questionCount, 
      isRandom,
      timeLimit: timeLimit * 60, // Convert to seconds
      isExamMode
    });
  };

  const batchOptions = [];
  for (let i = 0; i < 20; i++) {
    const start = i * 50 + 1;
    const end = (i + 1) * 50;
    batchOptions.push({ value: i, label: `Phần ${i + 1} (Câu ${start} - ${end})` });
  }

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
      <div className="p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Cấu hình bài thi</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Đề tài: <span className="font-medium text-slate-700 dark:text-slate-300">{data.title}</span>
          </p>
          <p className="text-sm mt-2 text-slate-600 dark:text-slate-400">
             Đang có sẵn: <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalQuestions}</span> câu hỏi
          </p>
        </div>

        <div className="space-y-6">
          {/* Batch Selector & Load More */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
            <label className="block text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2">
              Quản lý dữ liệu câu hỏi
            </label>
            <div className="space-y-3">
               <div>
                  <div className="text-xs text-indigo-700 dark:text-indigo-300 mb-1">Chuyển nhanh đến phần:</div>
                  <select 
                    value={currentBatchIndex}
                    onChange={(e) => onLoadBatch(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-sm"
                  >
                    {batchOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
               </div>
               
               <div className="text-center text-xs text-indigo-400 dark:text-indigo-500 font-medium">- HOẶC -</div>
               
               <Button onClick={onLoadMore} variant="outline" className="w-full border-dashed bg-white dark:bg-slate-800">
                 <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                 </svg>
                 Tải thêm 50 câu tiếp theo
               </Button>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-6"></div>

          {/* Exam Mode Toggle */}
          <div>
             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
               Loại hình kiểm tra
             </label>
             <div className="grid grid-cols-2 gap-4">
               <button
                 onClick={() => setIsExamMode(false)}
                 className={`p-4 rounded-xl border-2 text-left transition-all ${
                   !isExamMode 
                     ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-600' 
                     : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                 }`}
               >
                 <div className={`font-semibold mb-1 ${!isExamMode ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>Luyện tập</div>
                 <div className="text-xs text-slate-500 dark:text-slate-400">Biết đáp án ngay khi chọn</div>
               </button>

               <button
                 onClick={() => setIsExamMode(true)}
                 className={`p-4 rounded-xl border-2 text-left transition-all ${
                   isExamMode 
                     ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-600' 
                     : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                 }`}
               >
                 <div className={`font-semibold mb-1 ${isExamMode ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>Kiểm tra</div>
                 <div className="text-xs text-slate-500 dark:text-slate-400">Nộp bài mới biết điểm</div>
               </button>
             </div>
          </div>

          {/* Question Count Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Số lượng câu hỏi (Tối đa: {maxAllowed})
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max={maxAllowed}
                value={questionCount}
                onChange={(e) => handleQuestionCountChange(parseInt(e.target.value))}
                disabled={maxAllowed === 0}
                className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500 disabled:opacity-50"
              />
              <div className="w-16">
                <input
                  type="number"
                  min="1"
                  max={maxAllowed}
                  value={questionCount}
                  onChange={(e) => {
                    const val = Math.min(Math.max(1, parseInt(e.target.value) || 1), maxAllowed);
                    handleQuestionCountChange(val);
                  }}
                  disabled={maxAllowed === 0}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-center font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Time Limit Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Thời gian làm bài (phút)
            </label>
            <div className="flex items-center gap-4">
               <input
                type="number"
                min="1"
                value={timeLimit}
                onChange={(e) => setTimeLimit(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
               />
               <span className="text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">phút</span>
            </div>
          </div>

          {/* Shuffle Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Thứ tự câu hỏi
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setIsRandom(false)}
                className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
                  !isRandom 
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!isRandom ? 'border-indigo-600' : 'border-slate-400'}`}>
                    { !isRandom && <div className="w-2 h-2 rounded-full bg-indigo-600"></div> }
                </div>
                <span className="text-sm font-medium">Theo thứ tự</span>
              </button>

              <button
                onClick={() => setIsRandom(true)}
                className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
                  isRandom 
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isRandom ? 'border-indigo-600' : 'border-slate-400'}`}>
                    { isRandom && <div className="w-2 h-2 rounded-full bg-indigo-600"></div> }
                </div>
                <span className="text-sm font-medium">Ngẫu nhiên</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Chọn file khác
        </Button>
        <Button onClick={handleStart} disabled={maxAllowed === 0}>
          Bắt đầu làm bài
        </Button>
      </div>
    </div>
  );
};