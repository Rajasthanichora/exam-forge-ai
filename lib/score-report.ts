/**
 * Generate a self-contained HTML score report for test results.
 */
import { TestResult } from './types';

function getGrade(pct: number): { grade: string; color: string; msg: string } {
  if (pct >= 90) return { grade: 'A+', color: '#10B981', msg: 'Outstanding!' };
  if (pct >= 80) return { grade: 'A', color: '#10B981', msg: 'Excellent!' };
  if (pct >= 70) return { grade: 'B', color: '#6366F1', msg: 'Good Job!' };
  if (pct >= 60) return { grade: 'C', color: '#F59E0B', msg: 'Keep Practicing!' };
  if (pct >= 50) return { grade: 'D', color: '#F59E0B', msg: 'Needs Improvement' };
  return { grade: 'F', color: '#F43F5E', msg: 'Try Again!' };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateScoreReport(result: TestResult): string {
  const pct = Math.round((result.score / result.totalQuestions) * 100);
  const grade = getGrade(pct);
  const incorrect = result.totalQuestions - result.score;
  const dateStr = new Date(result.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const timeStr = result.timeTaken
    ? Math.floor(result.timeTaken / 60) + 'm ' + (result.timeTaken % 60) + 's'
    : 'N/A';

  const topicMap: Record<string, { correct: number; total: number }> = {};
  result.questions.forEach((q) => {
    const t = q.topic || 'General';
    if (!topicMap[t]) topicMap[t] = { correct: 0, total: 0 };
    topicMap[t].total++;
    if (result.answers[q.id] === q.correctAnswer) topicMap[t].correct++;
  });

  const topicHtml = Object.entries(topicMap)
    .map(([topic, data]) => {
      const tp = Math.round((data.correct / data.total) * 100);
      return '<div class="topic-row"><span class="topic-name">'
        + escapeHtml(topic)
        + '</span><div class="topic-bar-bg"><div class="topic-bar" style="width:'
        + tp + '%"></div></div><span class="topic-pct">'
        + data.correct + '/' + data.total + ' (' + tp + '%)</span></div>';
    })
    .join('\n');

  const questionsHtml = result.questions
    .map((q, idx) => {
      const userAns = result.answers[q.id];
      const isCorrect = userAns === q.correctAnswer;
      const uLetter = userAns !== undefined ? String.fromCharCode(65 + userAns) : '-';
      const uText =
        userAns !== undefined && q.options[userAns]
          ? escapeHtml(q.options[userAns])
          : 'No answer';
      const cLetter = String.fromCharCode(65 + q.correctAnswer);
      const cText = escapeHtml(q.options[q.correctAnswer]);

      const optsHtml = q.options
        .map((opt, oi) => {
          const letter = String.fromCharCode(65 + oi);
          let cls = 'option';
          if (oi === q.correctAnswer) cls += ' option-correct';
          if (oi === userAns && oi !== q.correctAnswer) cls += ' option-wrong';
          const check =
            oi === q.correctAnswer ? '<span class="check-mark">&#10003;</span>' : '';
          const cross =
            oi === userAns && oi !== q.correctAnswer
              ? '<span class="cross-mark">&#10007;</span>'
              : '';
          return '<div class="' + cls + '"><span class="opt-letter">' + letter + '</span><span class="opt-text">' + escapeHtml(opt) + '</span>' + check + cross + '</div>';
        })
        .join('\n');

      const expl = q.explanation
        ? '<div class="explanation"><div class="exp-label">&#128161; EXPLANATION</div><div class="exp-text">' + escapeHtml(q.explanation) + '</div></div>'
        : '';

      return '<div class="question-card ' + (isCorrect ? 'correct' : 'incorrect') + '">'
        + '<div class="q-header"><span class="q-num ' + (isCorrect ? 'q-num-correct' : 'q-num-incorrect') + '">' + (idx + 1) + '</span><span class="q-status">' + (isCorrect ? '&#10003; Correct' : '&#10007; Incorrect') + '</span></div>'
        + '<div class="q-text">' + escapeHtml(q.question) + '</div>'
        + '<div class="q-options">' + optsHtml + '</div>'
        + '<div class="q-answers"><div class="answer-row ' + (isCorrect ? '' : 'wrong') + '"><strong>Your answer:</strong> ' + uLetter + '. ' + uText + '</div>'
        + (!isCorrect ? '<div class="answer-row correct-row"><strong>Correct:</strong> ' + cLetter + '. ' + cText + '</div>' : '') + '</div>'
        + expl + '</div>';
    })
    .join('\n');

  const css = [
    'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#F8FAFC;color:#0F172A;padding:20px;margin:0}',
    '.container{max-width:800px;margin:0 auto}',
    '.header{text-align:center;padding:32px 20px;background:linear-gradient(135deg,#EEF2FF,#E0E7FF);border-radius:16px;margin-bottom:20px}',
    '.header h1{font-size:24px;font-weight:800;color:#1E293B;margin-bottom:4px}',
    '.subtitle{font-size:13px;color:#64748B}',
    '.score-banner{background:white;border-radius:16px;border:1px solid #E2E8F0;padding:24px;text-align:center;margin-bottom:20px}',
    '.score-pct{font-size:48px;font-weight:900}',
    '.score-grade{font-size:32px;font-weight:800}',
    '.score-msg{font-size:16px;margin-top:4px}',
    '.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}',
    '.stat-card{background:white;border-radius:12px;border:1px solid #E2E8F0;padding:16px;text-align:center}',
    '.stat-value{font-size:24px;font-weight:900}',
    '.stat-label{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748B;margin-top:4px}',
    '.topic-section{background:white;border-radius:16px;border:1px solid #E2E8F0;padding:20px;margin-bottom:20px}',
    '.topic-section h2{font-size:16px;font-weight:700;margin-bottom:16px}',
    '.topic-row{display:flex;align-items:center;gap:12px;padding:8px 0}',
    '.topic-name{flex:1;font-size:13px;font-weight:600}',
    '.topic-bar-bg{flex:2;height:8px;background:#F1F5F9;border-radius:4px;overflow:hidden}',
    '.topic-bar{height:100%;background:#6366F1;border-radius:4px}',
    '.topic-pct{font-size:12px;font-weight:600;color:#64748B;min-width:80px;text-align:right}',
    '.question-card{background:white;border-radius:12px;border:1px solid #E2E8F0;padding:16px;margin-bottom:12px}',
    '.q-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
    '.q-num{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:white}',
    '.q-num-correct{background:#10B981}',
    '.q-num-incorrect{background:#F43F5E}',
    '.q-status{font-size:11px;font-weight:700}',
    '.q-text{font-size:15px;font-weight:600;line-height:22px;margin-bottom:12px}',
    '.q-options{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}',
    '.option{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;border:1px solid #E2E8F0}',
    '.option-correct{background:#ECFDF5;border-color:#10B981}',
    '.option-wrong{background:#FFF1F2;border-color:#F43F5E}',
    '.opt-letter{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:#F1F5F9}',
    '.option-correct .opt-letter{background:#10B981;color:white}',
    '.option-wrong .opt-letter{background:#F43F5E;color:white}',
    '.opt-text{flex:1;font-size:13px}',
    '.check-mark{color:#10B981;font-weight:bold}',
    '.cross-mark{color:#F43F5E;font-weight:bold}',
    '.q-answers{padding:8px 12px;background:#F8FAFC;border-radius:8px;margin-bottom:8px}',
    '.answer-row{font-size:12px}',
    '.wrong{color:#F43F5E}',
    '.correct-row{color:#10B981}',
    '.explanation{background:#EEF2FF;border:1px solid #C7D2FE;border-radius:8px;padding:12px}',
    '.exp-label{font-size:10px;font-weight:700;letter-spacing:1px;color:#6366F1;margin-bottom:4px}',
    '.exp-text{font-size:13px;color:#334155;line-height:20px}',
    '.footer{text-align:center;padding:20px;font-size:11px;color:#94A3B8}',
  ].join('');

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n<title>Score Report - '
    + escapeHtml(result.name)
    + '</title>\n<style>' + css + '</style>\n</head>\n<body>\n<div class="container">'
    + '<div class="header"><h1>&#129514; ' + escapeHtml(result.name) + '</h1><div class="subtitle">' + dateStr + ' &#183; ' + result.totalQuestions + ' Questions</div></div>'
    + '<div class="score-banner"><div class="score-pct" style="color:' + grade.color + '">' + pct + '%</div><div class="score-grade" style="color:' + grade.color + '">' + grade.grade + '</div><div class="score-msg" style="color:' + grade.color + '">' + grade.msg + '</div></div>'
    + '<div class="stats-grid">'
    + '<div class="stat-card"><div class="stat-value">' + result.totalQuestions + '</div><div class="stat-label">Total Questions</div></div>'
    + '<div class="stat-card"><div class="stat-value" style="color:#10B981">' + result.score + '</div><div class="stat-label" style="color:#10B981">Correct</div></div>'
    + '<div class="stat-card"><div class="stat-value" style="color:#F43F5E">' + incorrect + '</div><div class="stat-label" style="color:#F43F5E">Incorrect</div></div>'
    + '<div class="stat-card"><div class="stat-value">' + timeStr + '</div><div class="stat-label">Time Taken</div></div>'
    + '</div>'
    + '<div class="topic-section"><h2>&#128202; Topic Performance</h2>' + topicHtml + '</div>'
    + '<div class="questions-section"><h2>&#128203; Question Review</h2>' + questionsHtml + '</div>'
    + '<div class="footer"><p>Generated by <strong>ExamForge AI</strong> &#183; ' + new Date().toLocaleDateString() + '</p></div>'
    + '</div>\n</body>\n</html>';
}