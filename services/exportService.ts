import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType } from "docx";
import FileSaver from "file-saver";
import { QuizData, UserAnswers } from "../types";

export const exportToWord = async (data: QuizData, userAnswers: UserAnswers, timeSpent: number, score: number) => {
  const children = [];

  // 1. Header Information
  children.push(
    new Paragraph({
      text: "KẾT QUẢ BÀI THI TRẮC NGHIỆM",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      text: `Đề tài: ${data.title}`,
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `Ngày làm bài: ${new Date().toLocaleDateString('vi-VN')} - `, bold: false }),
        new TextRun({ text: `Thời gian: ${Math.floor(timeSpent / 60)} phút ${timeSpent % 60} giây`, bold: false }),
      ],
      spacing: { after: 300 }
    })
  );

  // 2. Score Table
  // Recalculate correctly for multi-select
  const correctCount = data.questions.filter(q => {
     const uAns = userAnswers[q.id] || [];
     const sortedUser = [...uAns].sort().join(',');
     const sortedCorrect = [...q.correctAnswers].sort().join(',');
     return sortedUser === sortedCorrect;
  }).length;
  
  children.push(
    new Paragraph({
      text: `Điểm số: ${score.toFixed(1)}/10 - Đúng: ${correctCount}/${data.questions.length} câu`,
      heading: HeadingLevel.HEADING_3,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );

  // 3. Questions Loop
  data.questions.forEach((q, index) => {
    const userChoice = userAnswers[q.id] || [];
    
    // Question Title
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Câu ${index + 1}: `, bold: true, size: 24 }), // 12pt
          new TextRun({ text: q.text, size: 24 })
        ],
        spacing: { before: 200, after: 100 }
      })
    );

    // Options
    q.options.forEach(opt => {
      let color = "000000"; // Black
      let isBold = false;
      let suffix = "";

      const isSelected = userChoice.includes(opt.key);
      const isCorrectOption = q.correctAnswers.includes(opt.key);

      if (isCorrectOption) {
        color = "008000"; // Green
        isBold = true;
        suffix = " (Đáp án đúng)";
      } 
      
      if (isSelected) {
        if (!isCorrectOption) {
           color = "FF0000"; // Red
           isBold = true;
           suffix = " (Bạn chọn sai)";
        } else {
           // User selected correctly, append info if needed or just keep green
           suffix = " (Bạn chọn đúng)";
        }
      }

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${opt.key}. ${opt.text}`, color: color, bold: isBold, size: 22 }),
            new TextRun({ text: suffix, color: color, italics: true, size: 20 })
          ],
          indent: { left: 720 }, // 0.5 inch
          spacing: { after: 50 }
        })
      );
    });

    // Explanation
    if (q.explanation || q.optionExplanations) {
      const explanationRuns = [
        new TextRun({ text: "Giải thích: ", bold: true, color: "1E3A8A", size: 20 }),
      ];

      if (q.explanation) {
         explanationRuns.push(new TextRun({ text: q.explanation + "\n", color: "1E3A8A", italics: true, size: 20 }));
      }

      if (q.optionExplanations) {
         // Add explicit line break if general explanation exists
         if (q.explanation) explanationRuns.push(new TextRun({ text: "\n", size: 10 })); 
         
         Object.entries(q.optionExplanations).forEach(([key, text]) => {
            explanationRuns.push(
              new TextRun({ text: `${key}: `, bold: true, color: "1E3A8A", size: 18 }),
              new TextRun({ text: `${text}\n`, color: "1E3A8A", size: 18 })
            );
         });
      }

      children.push(
        new Paragraph({
          children: explanationRuns,
          indent: { left: 720 },
          spacing: { before: 100, after: 300 },
          shading: { type: "solid", color: "EFF6FF", fill: "EFF6FF" } // Light blue bg
        })
      );
    } else {
        children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  
  // Handle file-saver import difference in ESM environments
  // @ts-ignore
  const saveAs = FileSaver.saveAs || FileSaver;
  saveAs(blob, `Ket-qua-${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`);
};