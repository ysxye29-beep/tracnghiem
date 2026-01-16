import React, { useState, useEffect } from 'react';
import { UploadSection } from './components/UploadSection';
import { QuizPlayer } from './components/QuizPlayer';
import { QuizResults } from './components/QuizResults';
import { QuizConfig } from './components/QuizConfig';
import { QuizHistory } from './components/QuizHistory';
import { processFileToQuiz } from './services/geminiService';
import { AppState, QuizData, UserAnswers, Question, QuizHistoryItem } from './types';

// Store file context to allow re-fetching different batches
interface FileContext {
  base64: string;
  mimeType: string;
  fileName: string;
}

const STORAGE_KEY = 'quiz_gen_progress';
const HISTORY_KEY = 'quiz_gen_history';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [fullQuizData, setFullQuizData] = useState<QuizData | null>(null);
  const [activeQuizData, setActiveQuizData] = useState<QuizData | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [bookmarks, setBookmarks] = useState<number[]>([]); // Array of Question IDs
  const [timeSpent, setTimeSpent] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileContext, setFileContext] = useState<FileContext | null>(null);
  
  // History state
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);

  // Resume state
  const [savedAnswers, setSavedAnswers] = useState<UserAnswers>({});
  const [savedTimeLeft, setSavedTimeLeft] = useState<number | null>(null);

  // Current batch tracking
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0); // 0 = 1-50, 1 = 51-100...
  const BATCH_SIZE = 50;

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Load progress and history from local storage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // Basic validation
        if (parsed.activeQuizData && parsed.appState === AppState.QUIZ) {
          setActiveQuizData(parsed.activeQuizData);
          setSavedAnswers(parsed.answers || {});
          setSavedTimeLeft(parsed.timeLeft);
          setBookmarks(parsed.bookmarks || []);
          setFullQuizData(parsed.fullQuizData || null);
          setFileContext(parsed.fileContext || null); 
          setCurrentBatchIndex(parsed.batchIndex || 0);
          setUserAnswers(parsed.answers || {}); // Also set current user answers for immediate resume
          setAppState(AppState.QUIZ);
        }
      }

      // Load History
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load saved progress", e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const toggleBookmark = (questionId: number) => {
    setBookmarks(prev => {
      const newBookmarks = prev.includes(questionId) 
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId];
      
      // Update storage if we are in quiz mode
      if (appState === AppState.QUIZ) {
         handleSaveProgress(userAnswers, savedTimeLeft || 0, undefined, newBookmarks);
      }
      return newBookmarks;
    });
  };

  const loadQuizBatch = async (ctx: FileContext, batchIndex: number, append: boolean = false) => {
    setAppState(AppState.PROCESSING);
    setErrorMsg(null);
    
    const startQ = batchIndex * BATCH_SIZE + 1;
    const endQ = (batchIndex + 1) * BATCH_SIZE;

    try {
      const data = await processFileToQuiz(ctx.base64, ctx.mimeType, ctx.fileName, startQ, endQ);
      
      if (append && fullQuizData) {
        // Merge questions, deduplicate by ID just in case
        const mergedQuestions = [...fullQuizData.questions, ...data.questions];
        const uniqueQuestions = Array.from(new Map(mergedQuestions.map(q => [q.id, q])).values());
        // Sort by ID to ensure order
        uniqueQuestions.sort((a, b) => a.id - b.id);

        setFullQuizData({
          ...fullQuizData,
          questions: uniqueQuestions
        });
      } else {
        setFullQuizData(data);
      }
      
      setCurrentBatchIndex(batchIndex);
      setAppState(AppState.CONFIG);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process the batch.");
      setAppState(AppState.CONFIG); // Go back to config even on error so user can choose another batch
    }
  };

  // Explicitly clears session data
  const handleDiscardSession = () => {
    setFullQuizData(null);
    setActiveQuizData(null);
    setUserAnswers({});
    setTimeSpent(0);
    setBookmarks([]);
    setErrorMsg(null);
    setFileContext(null);
    setSavedAnswers({});
    setSavedTimeLeft(null);
    localStorage.removeItem(STORAGE_KEY);
    setAppState(AppState.UPLOAD);
  };

  const handleFileSelect = async (file: File) => {
    // Before loading new file, clear old session data
    handleDiscardSession();
    
    setAppState(AppState.PROCESSING);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64String = e.target?.result as string;
        const base64Data = base64String.split(',')[1];
        
        let mimeType = file.type;
        if (!mimeType) {
           if (file.name.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
           else if (file.name.endsWith('.md')) mimeType = 'text/markdown';
        }

        const ctx = { base64: base64Data, mimeType, fileName: file.name };
        setFileContext(ctx);
        
        // Initial load: Batch 0 (Questions 1-50)
        await loadQuizBatch(ctx, 0);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setErrorMsg("Error reading file.");
      setAppState(AppState.UPLOAD);
    }
  };

  const handleTextSubmit = async (text: string) => {
    handleDiscardSession();
    setAppState(AppState.PROCESSING);
    
    try {
      // Safe UTF-8 to Base64 encoding for Vietnamese characters
      const base64Data = window.btoa(unescape(encodeURIComponent(text)));
      
      const ctx = {
        base64: base64Data,
        mimeType: 'text/plain',
        fileName: 'Van_ban_nhap_tay.txt'
      };
      setFileContext(ctx);
      
      await loadQuizBatch(ctx, 0);
    } catch (err: any) {
      setErrorMsg("Lỗi xử lý văn bản: " + err.message);
      setAppState(AppState.UPLOAD);
    }
  };

  const handleBatchChange = async (batchIndex: number) => {
    if (fileContext) {
      await loadQuizBatch(fileContext, batchIndex, false); // Replace
    }
  };

  const handleBatchAppend = async () => {
    if (fileContext) {
      const nextBatch = currentBatchIndex + 1;
      await loadQuizBatch(fileContext, nextBatch, true); // Append
    }
  };

  const handleStartQuiz = (config: { questionCount: number; isRandom: boolean; timeLimit: number; isExamMode: boolean }) => {
    if (!fullQuizData) return;

    let questions = [...fullQuizData.questions];

    if (config.isRandom) {
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
    }

    questions = questions.slice(0, config.questionCount);

    const newActiveData = {
      ...fullQuizData,
      questions: questions,
      timeLimit: config.timeLimit,
      isExamMode: config.isExamMode
    };

    setActiveQuizData(newActiveData);
    setUserAnswers({});
    setBookmarks([]); // Reset bookmarks on new quiz start
    setSavedAnswers({});
    setSavedTimeLeft(null); // Reset saved time
    setTimeSpent(0);
    setAppState(AppState.QUIZ);

    // Initial Save
    handleSaveProgress({}, config.timeLimit, newActiveData, []);
  };

  const handleRetryWrong = (wrongQuestions: Question[]) => {
    if (!activeQuizData) return;

    const reviewData: QuizData = {
      title: `${activeQuizData.title} (Ôn tập câu sai)`,
      questions: wrongQuestions,
      timeLimit: wrongQuestions.length * 60, // Default 1 min/question for review
      isExamMode: false // Always practice mode for retry
    };

    setActiveQuizData(reviewData);
    setUserAnswers({});
    setSavedAnswers({});
    setSavedTimeLeft(null);
    setTimeSpent(0);
    setAppState(AppState.QUIZ);

    // Initial Save for review session
    handleSaveProgress({}, reviewData.timeLimit!, reviewData);
  };

  const handleRetryBookmarked = (bookmarkedQuestions: Question[]) => {
    if (!activeQuizData) return;

    const reviewData: QuizData = {
      title: `${activeQuizData.title} (Ôn tập đã lưu)`,
      questions: bookmarkedQuestions,
      timeLimit: bookmarkedQuestions.length * 60,
      isExamMode: false
    };

    setActiveQuizData(reviewData);
    setUserAnswers({});
    setSavedAnswers({});
    setSavedTimeLeft(null);
    setTimeSpent(0);
    setAppState(AppState.QUIZ);

    handleSaveProgress({}, reviewData.timeLimit!, reviewData);
  };

  // Called by QuizPlayer to update storage
  const handleSaveProgress = (answers: UserAnswers, timeLeft: number, overrideData?: QuizData, currentBookmarks?: number[]) => {
    try {
      const dataToSave = {
        appState: AppState.QUIZ,
        activeQuizData: overrideData || activeQuizData,
        fullQuizData, // Save full data to allow reconfiguration if needed (might be large)
        answers,
        bookmarks: currentBookmarks || bookmarks,
        timeLeft,
        batchIndex: currentBatchIndex,
        timestamp: Date.now(),
        // Note: We avoid saving fileContext if it's too large to prevent QuotaExceededError,
        // but for text-based quizzes it might be okay.
        // fileContext: fileContext 
      };
      // Also update local state to keep in sync if we pause
      setUserAnswers(answers);
      setSavedTimeLeft(timeLeft);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn("Storage full, cannot save progress", e);
    }
  };

  const saveToHistory = (answers: UserAnswers, time: number, quizData: QuizData) => {
    try {
      let correct = 0;
      quizData.questions.forEach(q => {
         const uAns = answers[q.id] || [];
         const sortedUser = [...uAns].sort().join(',');
         const sortedCorrect = [...q.correctAnswers].sort().join(',');
         if (sortedUser === sortedCorrect) {
             correct++;
         }
      });
      const score = (correct / quizData.questions.length) * 10;

      const newItem: QuizHistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        title: quizData.title,
        score: score,
        totalQuestions: quizData.questions.length,
        correctCount: correct,
        timeSpent: time,
        quizData: quizData,
        userAnswers: answers
      };

      const newHistory = [newItem, ...history];
      setHistory(newHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.error("Failed to save history", e);
    }
  };

  const handleDeleteHistory = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  };

  const handleViewHistoryItem = (item: QuizHistoryItem) => {
    setActiveQuizData(item.quizData);
    setUserAnswers(item.userAnswers);
    setTimeSpent(item.timeSpent);
    // Note: We don't restore bookmarks here as they are user-specific at runtime, 
    // though we could add them to history item if needed. For now reset.
    setBookmarks([]); 
    setAppState(AppState.RESULTS);
  };

  const handleQuizFinish = (answers: UserAnswers, time: number) => {
    setUserAnswers(answers);
    setTimeSpent(time);
    setAppState(AppState.RESULTS);
    localStorage.removeItem(STORAGE_KEY); // Clear progress on finish

    if (activeQuizData) {
      saveToHistory(answers, time, activeQuizData);
    }
  };

  const handleRetry = () => {
    // Retry entire current set
    setUserAnswers({});
    setTimeSpent(0);
    setSavedAnswers({});
    setSavedTimeLeft(null);
    setAppState(AppState.QUIZ);
    // Don't save immediately, wait for Player to mount
  };

  const handleReconfigure = () => {
    // Reset session and go back to UPLOAD screen (main page) as requested
    handleDiscardSession();
  };

  const handleGoHome = () => {
    // Navigate to UPLOAD screen but KEEP state and storage for Resume functionality
    setAppState(AppState.UPLOAD);
  };

  const handleResumeSession = () => {
    // Check if we have active data, then resume
    if (activeQuizData) {
      // Ensure saved answers are loaded into state if not already
      // Note: userAnswers should already be updated by handleSaveProgress
      setAppState(AppState.QUIZ);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleGoHome}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">Q</div>
            <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">QuizGen AI</span>
          </div>
          
          <div className="flex items-center gap-4">
             {(appState === AppState.QUIZ || appState === AppState.RESULTS) && activeQuizData && (
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 hidden md:block max-w-md truncate">
                  {activeQuizData.title}
                </div>
             )}
             
             {/* Dark Mode Toggle */}
             <button 
               onClick={toggleDarkMode}
               className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
               aria-label="Toggle Dark Mode"
             >
               {darkMode ? (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                 </svg>
               ) : (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                 </svg>
               )}
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg flex items-center">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {errorMsg}
          </div>
        )}

        {appState === AppState.UPLOAD && (
          <div className="h-full flex flex-col justify-center pt-10">
            <UploadSection 
               onFileSelect={handleFileSelect}
               onTextSubmit={handleTextSubmit}
               isProcessing={false} 
               onOpenHistory={() => setAppState(AppState.HISTORY)}
               savedQuizTitle={activeQuizData?.title}
               onResume={handleResumeSession}
               onDiscard={handleDiscardSession}
            />
          </div>
        )}

        {appState === AppState.PROCESSING && (
           <div className="h-[60vh] flex flex-col items-center justify-center">
             <div className="w-16 h-16 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
             <h2 className="text-2xl font-semibold text-slate-800 dark:text-white mb-2">Đang phân tích dữ liệu...</h2>
             <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
               AI đang trích xuất câu hỏi từ {currentBatchIndex * BATCH_SIZE + 1} đến {(currentBatchIndex + 1) * BATCH_SIZE}...
             </p>
           </div>
        )}

        {appState === AppState.CONFIG && fullQuizData && (
          <div className="pt-10">
            <QuizConfig 
              data={fullQuizData}
              onStart={handleStartQuiz}
              onCancel={handleDiscardSession}
              onLoadBatch={handleBatchChange}
              onLoadMore={handleBatchAppend}
              currentBatchIndex={currentBatchIndex}
            />
          </div>
        )}

        {appState === AppState.QUIZ && activeQuizData && (
          <QuizPlayer 
            data={activeQuizData} 
            onFinish={handleQuizFinish}
            initialAnswers={userAnswers}
            initialTimeLeft={savedTimeLeft}
            onProgressUpdate={handleSaveProgress}
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
          />
        )}

        {appState === AppState.RESULTS && activeQuizData && (
          <QuizResults 
            data={activeQuizData} 
            userAnswers={userAnswers} 
            timeSpent={timeSpent}
            onRetry={handleRetry}
            onRetryWrong={handleRetryWrong}
            onRetryBookmarked={handleRetryBookmarked}
            onNewFile={handleReconfigure} 
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
          />
        )}

        {appState === AppState.HISTORY && (
          <QuizHistory 
            history={history}
            onView={handleViewHistoryItem}
            onDelete={handleDeleteHistory}
            onBack={() => setAppState(AppState.UPLOAD)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 mt-auto transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 dark:text-slate-400 text-sm">
          <p>© 2024 QuizGen AI. Powered by Google Gemini.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;