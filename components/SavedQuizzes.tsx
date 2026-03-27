import React, { useState } from 'react';
import { SavedQuiz, Folder } from '../types';
import { Button } from './Button';

interface SavedQuizzesProps {
  quizzes: SavedQuiz[];
  folders: Folder[];
  onLoad: (quiz: SavedQuiz) => void;
  onReview: (quiz: SavedQuiz) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveQuiz: (quizId: string, folderId: string | null) => void;
  isSyncing?: boolean;
}

export const SavedQuizzes: React.FC<SavedQuizzesProps> = ({ 
  quizzes, 
  folders, 
  onLoad, 
  onReview,
  onDelete, 
  onBack, 
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveQuiz,
  isSyncing 
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [movingQuizId, setMovingQuizId] = useState<string | null>(null);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const filteredQuizzes = quizzes.filter(q => q.folderId === currentFolderId);
  const currentFolder = folders.find(f => f.id === currentFolderId);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCurrentFolderId(null)}
            className={`text-2xl font-bold transition-colors ${!currentFolderId ? 'text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            Bài đã lưu
          </button>
          {currentFolderId && (
            <>
              <span className="text-slate-300 dark:text-slate-600 text-2xl">/</span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{currentFolder?.name}</h2>
            </>
          )}
          {isSyncing && (
            <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          )}
        </div>
        <div className="flex gap-2">
          {!isCreatingFolder ? (
            <Button onClick={() => setIsCreatingFolder(true)} variant="outline" className="text-xs py-1.5">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Thư mục mới
            </Button>
          ) : (
            <div className="flex gap-2 items-center bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
              <input 
                autoFocus
                type="text" 
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Tên thư mục..."
                className="px-2 py-1 text-sm bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white w-32"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
              <button onClick={handleCreateFolder} className="text-green-500 hover:text-green-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </button>
              <button onClick={() => setIsCreatingFolder(false)} className="text-slate-400 hover:text-slate-500 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          <Button onClick={onBack} variant="secondary">
            Quay lại
          </Button>
        </div>
      </div>

      {/* Folder List (only show at root) */}
      {!currentFolderId && folders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
          {folders.map(folder => (
            <div 
              key={folder.id}
              className="group relative bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all cursor-pointer shadow-sm hover:shadow-md"
              onClick={() => setCurrentFolderId(folder.id)}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">{folder.name}</h3>
                <span className="text-[10px] text-slate-400 mt-1">
                  {quizzes.filter(q => q.folderId === folder.id).length} bài thi
                </span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Xóa thư mục "${folder.name}"? Các bài thi bên trong sẽ không bị xóa.`)) {
                    onDeleteFolder(folder.id);
                  }
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quizzes Grid */}
      <div className="space-y-4">
        {currentFolderId && (
          <button 
            onClick={() => setCurrentFolderId(null)}
            className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:underline mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Quay lại tất cả bài thi
          </button>
        )}

        {filteredQuizzes.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-lg">Chưa có bài nào trong mục này.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredQuizzes.map((quiz) => (
              <div 
                key={quiz.id}
                className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between relative group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-6 4h6m2 5H7a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v7a2 2 0 01-2 2z" /></svg>
                      {formatDate(quiz.timestamp)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        {quiz.quizData.questions.length} câu
                      </span>
                    </div>
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg line-clamp-2 mb-4">{quiz.title}</h3>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-slate-50 dark:border-slate-700">
                  <Button onClick={() => onLoad(quiz)} className="flex-1 text-sm py-2">
                    Làm bài này
                  </Button>
                  
                  {quiz.userAnswers && Object.keys(quiz.userAnswers).length > 0 && (
                    <Button 
                      onClick={() => onReview(quiz)} 
                      variant="outline" 
                      className="flex-1 text-sm py-2 border-indigo-200 text-indigo-600 dark:border-indigo-900 dark:text-indigo-400"
                    >
                      Xem kết quả
                    </Button>
                  )}
                  
                  {/* Move to Folder Dropdown-like UI */}
                  <div className="relative">
                    <button 
                      onClick={() => setMovingQuizId(movingQuizId === quiz.id ? null : quiz.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      title="Di chuyển vào thư mục"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </button>
                    
                    {movingQuizId === quiz.id && (
                      <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fade-in-up">
                        <div className="p-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-700">Di chuyển tới</div>
                        <div className="max-h-48 overflow-y-auto">
                          <button 
                            onClick={() => {
                              onMoveQuiz(quiz.id, null);
                              setMovingQuizId(null);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${!quiz.folderId ? 'text-indigo-600 font-bold' : 'text-slate-600 dark:text-slate-300'}`}
                          >
                            Tất cả bài thi
                          </button>
                          {folders.map(f => (
                            <button 
                              key={f.id}
                              onClick={() => {
                                onMoveQuiz(quiz.id, f.id);
                                setMovingQuizId(null);
                              }}
                              className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${quiz.folderId === f.id ? 'text-indigo-600 font-bold' : 'text-slate-600 dark:text-slate-300'}`}
                            >
                              {f.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => onDelete(quiz.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Xóa bài này"
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
    </div>
  );
};
