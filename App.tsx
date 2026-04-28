import React, { useState, useEffect } from 'react';
import { UploadSection } from './components/UploadSection';
import { QuizPlayer } from './components/QuizPlayer';
import { QuizResults } from './components/QuizResults';
import { QuizConfig } from './components/QuizConfig';
import { QuizHistory } from './components/QuizHistory';
import { SavedQuizzes } from './components/SavedQuizzes';
import { processFileToQuiz } from './services/geminiService';
import { AppState, QuizData, UserAnswers, UserExplanations, Question, QuizHistoryItem, SavedQuiz, Folder, BATCH_SIZE } from './types';
import { auth, loginWithGoogle, logout, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, orderBy, onSnapshot, limit, updateDoc, setDoc, deleteField } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

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
  const [userExplanations, setUserExplanations] = useState<UserExplanations>({});
  const [bookmarks, setBookmarks] = useState<number[]>([]); // Array of Question IDs
  const [timeSpent, setTimeSpent] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileContext, setFileContext] = useState<FileContext | null>(null);
  
  // History state
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  // Resume state
  const [savedAnswers, setSavedAnswers] = useState<UserAnswers>({});
  const [savedTimeLeft, setSavedTimeLeft] = useState<number | null>(null);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [currentSavedQuizId, setCurrentSavedQuizId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Current batch tracking
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0); // 0 = 1-50, 1 = 51-100...

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Font size state
  const [fontSize, setFontSize] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('font-size') || 'medium';
    }
    return 'medium';
  });
// Bắt kết quả sau khi redirect về
useEffect(() => {
  import('firebase/auth').then(({ getRedirectResult }) => {
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        console.log("Logged in via redirect:", result.user);
      }
    }).catch((err) => {
      if (err.code !== 'auth/null-user') {
        setErrorMsg("Đăng nhập thất bại: " + err.message);
      }
    });
  });
}, []);
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.add(`font-size-${fontSize}`);
    localStorage.setItem('font-size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        // Fetch history from Firestore
        const historyRef = collection(db, 'users', currentUser.uid, 'history');
        const q = query(historyRef, orderBy('timestamp', 'desc'), limit(50));
        
        const unsubHistory = onSnapshot(q, (snapshot) => {
          const items: QuizHistoryItem[] = [];
          snapshot.forEach((doc) => {
            items.push({ ...doc.data(), id: doc.id } as QuizHistoryItem);
          });
          setHistory(items);
        }, (error) => {
          console.error("Error fetching history from Firestore:", error);
          setErrorMsg("Không thể tải lịch sử từ đám mây.");
        });

        // Fetch saved quizzes from Firestore
        const savedRef = collection(db, 'users', currentUser.uid, 'savedQuizzes');
        const qSaved = query(savedRef, orderBy('timestamp', 'desc'));
        const unsubSaved = onSnapshot(qSaved, (snapshot) => {
          const items: SavedQuiz[] = [];
          snapshot.forEach((doc) => {
            items.push({ ...doc.data(), id: doc.id } as SavedQuiz);
          });
          setSavedQuizzes(items);
        }, (error) => {
          console.error("Error fetching saved quizzes from Firestore:", error);
        });

        // Fetch folders from Firestore
        const foldersRef = collection(db, 'users', currentUser.uid, 'folders');
        const qFolders = query(foldersRef, orderBy('timestamp', 'desc'));
        const unsubFolders = onSnapshot(qFolders, (snapshot) => {
          const items: Folder[] = [];
          snapshot.forEach((doc) => {
            items.push({ ...doc.data(), id: doc.id } as Folder);
          });
          setFolders(items);
        }, (error) => {
          console.error("Error fetching folders from Firestore:", error);
        });

        return () => {
          unsubHistory();
          unsubSaved();
          unsubFolders();
        };
      } else {
        // If not logged in, load from local storage
        const savedHistory = localStorage.getItem(HISTORY_KEY);
        if (savedHistory) {
          setHistory(JSON.parse(savedHistory));
        } else {
          setHistory([]);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Load progress from local storage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.activeQuizData && parsed.appState === AppState.QUIZ) {
          setActiveQuizData(parsed.activeQuizData);
          setSavedAnswers(parsed.answers || {});
          setSavedTimeLeft(parsed.timeLeft);
          setBookmarks(parsed.bookmarks || []);
          setFullQuizData(parsed.fullQuizData || null);
          setFileContext(parsed.fileContext || null); 
          setCurrentBatchIndex(parsed.batchIndex || 0);
          setUserAnswers(parsed.answers || {});
          setAppState(AppState.QUIZ);
        }
      }
    } catch (e) {
      console.error("Failed to load saved progress", e);
    }
  }, []);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMsg("Đăng nhập thất bại: " + err.message);
    }
  };

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const sanitizeForFirestore = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(v => sanitizeForFirestore(v));
    } else if (obj !== null && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, sanitizeForFirestore(v)])
      );
    }
    return obj;
  };

  const handleLogout = async () => {
    try {
      await logout();
      handleDiscardSession();
      setSavedQuizzes([]);
      setFolders([]);
    } catch (err: any) {
      setErrorMsg("Đăng xuất thất bại: " + err.message);
    }
  };

  const handleSaveQuiz = async (folderId?: string) => {
    if (!fullQuizData || !user) {
      if (!user) setErrorMsg("Vui lòng đăng nhập để lưu bài.");
      return;
    }

    setIsSyncing(true);
    const path = `users/${user.uid}/savedQuizzes`;
    try {
      // Use existing ID if we loaded this quiz, otherwise create new
      const docRef = currentSavedQuizId 
        ? doc(db, 'users', user.uid, 'savedQuizzes', currentSavedQuizId)
        : doc(collection(db, 'users', user.uid, 'savedQuizzes'));
      
      const dataToSave: any = {
        id: docRef.id,
        title: fullQuizData.title,
        timestamp: Date.now(),
        quizData: fullQuizData,
        userId: user.uid,
        userAnswers: userAnswers || {},
        timeSpent: timeSpent || 0
      };

      if (folderId) {
        dataToSave.folderId = folderId;
      }

      // Ensure title is within Firestore rules limit (500 chars)
      if (dataToSave.title && dataToSave.title.length >= 500) {
        dataToSave.title = dataToSave.title.substring(0, 490) + "...";
      }

      await setDoc(docRef, sanitizeForFirestore(dataToSave), { merge: true });
      if (!currentSavedQuizId) setCurrentSavedQuizId(docRef.id);
      setErrorMsg(null); // Clear any previous error
    } catch (err: any) {
      console.error("Failed to save quiz", err);
      setErrorMsg(`Không thể lưu bài vào đám mây: ${err.message || 'Lỗi không xác định'}`);
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (e) {}
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMoveQuiz = async (quizId: string, folderId: string | null) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'savedQuizzes', quizId);
      // If folderId is null, we want to remove the field.
      // Firestore rules require folderId to be a string if it exists.
      if (folderId === null) {
        await updateDoc(docRef, { folderId: deleteField() });
      } else {
        await updateDoc(docRef, { folderId });
      }
    } catch (err) {
      console.error("Failed to move quiz", err);
      setErrorMsg("Không thể di chuyển bài thi.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!user) return;
    setIsSyncing(true);
    const path = `users/${user.uid}/folders`;
    try {
      const foldersRef = collection(db, 'users', user.uid, 'folders');
      const newDocRef = doc(foldersRef);
      await setDoc(newDocRef, {
        id: newDocRef.id,
        name: name.length >= 100 ? name.substring(0, 95) + "..." : name,
        userId: user.uid,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Failed to create folder", err);
      setErrorMsg("Không thể tạo thư mục.");
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (e) {}
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRenameFolder = async (id: string, newName: string) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'folders', id);
      await updateDoc(docRef, { name: newName.length >= 100 ? newName.substring(0, 95) + "..." : newName });
    } catch (err) {
      console.error("Failed to rename folder", err);
      setErrorMsg("Không thể đổi tên thư mục.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      // 1. Delete the folder
      const folderRef = doc(db, 'users', user.uid, 'folders', id);
      await deleteDoc(folderRef);

      // 2. Unset folderId for all quizzes in this folder
      const quizzesInFolder = savedQuizzes.filter(q => q.folderId === id);
      for (const quiz of quizzesInFolder) {
        const quizRef = doc(db, 'users', user.uid, 'savedQuizzes', quiz.id);
        await updateDoc(quizRef, { folderId: deleteField() });
      }
    } catch (err) {
      console.error("Failed to delete folder", err);
      setErrorMsg("Không thể xóa thư mục.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteSavedQuiz = async (id: string) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'savedQuizzes', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Failed to delete saved quiz", err);
      setErrorMsg("Không thể xóa bài đã lưu.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadSavedQuiz = (quiz: SavedQuiz) => {
    setFullQuizData(quiz.quizData);
    setCurrentSavedQuizId(quiz.id);
    if (quiz.userAnswers) setUserAnswers(quiz.userAnswers);
    if (quiz.timeSpent) setTimeSpent(quiz.timeSpent);
    setAppState(AppState.CONFIG);
  };

  const handleReviewSavedQuiz = (quiz: SavedQuiz) => {
    setFullQuizData(quiz.quizData);
    setActiveQuizData(quiz.quizData);
    setCurrentSavedQuizId(quiz.id);
    if (quiz.userAnswers) setUserAnswers(quiz.userAnswers);
    if (quiz.timeSpent) setTimeSpent(quiz.timeSpent);
    setAppState(AppState.RESULTS);
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);
  const toggleFontSize = () => {
    setFontSize(prev => {
      if (prev === 'small') return 'medium';
      if (prev === 'medium') return 'large';
      return 'small';
    });
  };

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
    setUserExplanations({});
    setTimeSpent(0);
    setBookmarks([]);
    setErrorMsg(null);
    setFileContext(null);
    setSavedAnswers({});
    setSavedTimeLeft(null);
    setCurrentSavedQuizId(null);
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

  const handleStartQuiz = (config: { questionCount: number; isRandom: boolean; timeLimit: number; isExamMode: boolean; isExplanationMode: boolean }) => {
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
      isExamMode: config.isExamMode,
      isExplanationMode: config.isExplanationMode
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

  const saveToHistory = async (answers: UserAnswers, time: number, quizData: QuizData) => {
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

      const newItem: Omit<QuizHistoryItem, 'id'> = {
        timestamp: Date.now(),
        title: quizData.title.length >= 500 ? quizData.title.substring(0, 490) + "..." : quizData.title,
        score: score,
        totalQuestions: quizData.questions.length,
        correctCount: correct,
        timeSpent: time,
        quizData: quizData,
        userAnswers: answers
      };

      if (user) {
        setIsSyncing(true);
        try {
          const historyRef = collection(db, 'users', user.uid, 'history');
          const newDocRef = doc(historyRef);
          await setDoc(newDocRef, sanitizeForFirestore({ ...newItem, id: newDocRef.id, userId: user.uid }));
        } catch (err) {
          console.error("Failed to save to Firestore", err);
          // Fallback to local storage if Firestore fails
          const localItem = { ...newItem, id: crypto.randomUUID() } as QuizHistoryItem;
          const newHistory = [localItem, ...history];
          setHistory(newHistory);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
        } finally {
          setIsSyncing(false);
        }
      } else {
        const localItem = { ...newItem, id: crypto.randomUUID() } as QuizHistoryItem;
        const newHistory = [localItem, ...history];
        setHistory(newHistory);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      }
    } catch (e) {
      console.error("Failed to save history", e);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (user) {
      setIsSyncing(true);
      try {
        const docRef = doc(db, 'users', user.uid, 'history', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.error("Failed to delete from Firestore", err);
        setErrorMsg("Không thể xóa bài làm từ đám mây.");
      } finally {
        setIsSyncing(false);
      }
    } else {
      const newHistory = history.filter(item => item.id !== id);
      setHistory(newHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    }
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

  const handleQuizFinish = (answers: UserAnswers, time: number, explanations?: UserExplanations) => {
    setUserAnswers(answers);
    setTimeSpent(time);
    if (explanations) {
      setUserExplanations(explanations);
    }
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
             {/* User Profile / Login */}
             {isAuthReady && (
               <div className="flex items-center gap-3">
                 {user ? (
                   <div className="flex items-center gap-3">
                     <div className="hidden sm:flex flex-col items-end">
                       <span className="text-sm font-semibold text-slate-900 dark:text-white leading-none">{user.displayName}</span>
                       <button 
                         onClick={handleLogout}
                         className="text-[10px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 font-medium uppercase tracking-wider"
                       >
                         Đăng xuất
                       </button>
                     </div>
                     {user.photoURL ? (
                       <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700" referrerPolicy="no-referrer" />
                     ) : (
                       <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                         {user.displayName?.charAt(0) || 'U'}
                       </div>
                     )}
                   </div>
                 ) : (
                   <button 
                     onClick={handleLogin}
                     className="flex items-center gap-2 py-1.5 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                   >
                     <svg className="w-4 h-4" viewBox="0 0 24 24">
                       <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                       <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                       <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                       <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                     </svg>
                     Đăng nhập
                   </button>
                 )}
               </div>
             )}

             {(appState === AppState.QUIZ || appState === AppState.RESULTS) && activeQuizData && (
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 hidden md:block max-w-md truncate">
                  {activeQuizData.title}
                </div>
             )}
             
             {/* Font Size Toggle */}
             <button 
               onClick={toggleFontSize}
               className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
               aria-label="Adjust Font Size"
               title="Chỉnh cỡ chữ"
             >
               <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 5v14M16 11h4M18 11v8" />
               </svg>
               <span className="text-[10px] font-bold uppercase">{fontSize === 'small' ? 'S' : fontSize === 'medium' ? 'M' : 'L'}</span>
             </button>

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
               onOpenSavedQuizzes={() => setAppState(AppState.SAVED_QUIZZES)}
               savedQuizTitle={activeQuizData?.title}
               onResume={handleResumeSession}
               onDiscard={handleDiscardSession}
               isLoggedIn={!!user}
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
              onSave={handleSaveQuiz}
              currentBatchIndex={currentBatchIndex}
              isLoggedIn={!!user}
              folders={folders}
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
            userExplanations={userExplanations}
            timeSpent={timeSpent}
            onRetry={handleRetry}
            onRetryWrong={handleRetryWrong}
            onRetryBookmarked={handleRetryBookmarked}
            onNewFile={handleReconfigure} 
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
            onSave={handleSaveQuiz}
            isLoggedIn={!!user}
            folders={folders}
            isSyncing={isSyncing}
          />
        )}

        {appState === AppState.HISTORY && (
          <QuizHistory 
            history={history}
            onView={handleViewHistoryItem}
            onDelete={handleDeleteHistory}
            onBack={() => setAppState(AppState.UPLOAD)}
            isSyncing={isSyncing}
            isLoggedIn={!!user}
          />
        )}

        {appState === AppState.SAVED_QUIZZES && (
          <SavedQuizzes 
            quizzes={savedQuizzes}
            folders={folders}
            onLoad={handleLoadSavedQuiz}
            onReview={handleReviewSavedQuiz}
            onDelete={handleDeleteSavedQuiz}
            onBack={() => setAppState(AppState.UPLOAD)}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveQuiz={handleMoveQuiz}
            isSyncing={isSyncing}
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
