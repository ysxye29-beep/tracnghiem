import { GoogleGenAI, Type, Schema } from "@google/genai";
import { QuizData, Question } from "../types";

const processFileToQuiz = async (
  base64Data: string, 
  mimeType: string, 
  fileName: string,
  startQuestion: number = 1,
  endQuestion: number = 50
): Promise<QuizData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Schema definition for the expected JSON structure
  const quizSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "A suitable title for the quiz derived from the document",
      },
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER, description: "The specific question number found in the document (e.g., 51, 52...)" },
            text: { type: Type.STRING, description: "The content of the question" },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING, description: "Option letter (A, B, C, D)" },
                  text: { type: Type.STRING, description: "The text of the option" }
                },
                required: ["key", "text"]
              }
            },
            correctAnswerRaw: { type: Type.STRING, description: "The letter(s) of the correct answer. If multiple, separate with commas (e.g., 'A, B')." },
            explanation: { type: Type.STRING, description: "General explanation of the correct answer." },
            optionExplanations: {
              type: Type.OBJECT,
              description: "Brief explanation for EACH option (why it is correct or why it is wrong). Keys must be A, B, C, D.",
              properties: {
                A: { type: Type.STRING },
                B: { type: Type.STRING },
                C: { type: Type.STRING },
                D: { type: Type.STRING }
              }
            }
          },
          required: ["id", "text", "options", "correctAnswerRaw"]
        }
      }
    },
    required: ["title", "questions"]
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: `Analyze this document ("${fileName}") and extract multiple-choice questions.
            
            TARGET RANGE: Extract questions specifically numbered from ${startQuestion} to ${endQuestion}.
            
            CRITICAL INSTRUCTIONS:
            1. Look for questions starting with numbers in the range ${startQuestion}-${endQuestion}.
            2. Ignore questions before ${startQuestion}.
            3. Stop extracting after question ${endQuestion}.
            4. If the document uses a different numbering format, try to map the ${startQuestion}-th question in the file to the ${endQuestion}-th question sequentially.
            5. If no questions are found in this range, return an empty questions array.

            For each question:
            - Extract the question text.
            - Extract options (A, B, C, D).
            - Identify or solve for the correct answer(s). 
            - IMPORTANT: If a question has multiple correct answers, list them all separated by commas (e.g. "A, C").
            - Provide a main explanation.
            - Provide specific reasons for each option (A, B, C, D) explaining why it is correct or incorrect.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: quizSchema,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    const rawData = JSON.parse(text);
    
    // Map raw data to application type
    const questions: Question[] = rawData.questions.map((q: any) => {
      // Parse "A, B" into ["A", "B"]
      let correctAnswers: string[] = [];
      if (q.correctAnswerRaw) {
        correctAnswers = q.correctAnswerRaw.split(',').map((s: string) => s.trim().toUpperCase());
      }
      
      // Clean up the object to match Question interface
      const { correctAnswerRaw, ...rest } = q;
      return {
        ...rest,
        correctAnswers
      };
    });

    if (questions.length === 0) {
      throw new Error(`Không tìm thấy câu hỏi nào trong khoảng từ câu ${startQuestion} đến ${endQuestion}.`);
    }

    return {
      title: rawData.title,
      questions,
      timeLimit: rawData.timeLimit,
      isExamMode: rawData.isExamMode
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to process the file.");
  }
};

export { processFileToQuiz };