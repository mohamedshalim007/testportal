// server/src/utils/scoreUtils.js
const norm = (v) => String(v ?? "").trim().toLowerCase();

export function evaluateAnswers(questionRows, answerMap = {}) {
  let score = 0;
  let max = 0;
  const evaluated = [];

  for (const q of questionRows) {
    const qid = q.qid;
    const points = Number(q.points) || 1;
    const selected = answerMap[qid] ?? "";
    const isCorrect = selected !== "" && norm(selected) === norm(q.correct);

    max += points;
    if (isCorrect) score += points;

    evaluated.push({
      qid,
      question: q.word,
      question_type: q.question_type || "MCQ",
      optA: q.optA, optB: q.optB, optC: q.optC, optD: q.optD,
      correctAnswer: q.correct || "",
      userAnswer: selected,
      isCorrect,
      points,
      earned: isCorrect ? points : 0,
    });
  }

  const percentage = max > 0 ? Math.round((score / max) * 100) : 0;
  return { score, max, percentage, evaluated };
}
