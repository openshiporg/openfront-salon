type ConsultationQuestion = {
  id?: unknown;
  required?: unknown;
};

/** The current portal renders consultation questions as textareas. */
export function consultationAnswerError(questions: unknown, answers: unknown): string | null {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return "Consultation answers must be an object keyed by question ID";
  }
  if (!Array.isArray(questions)) return "Consultation template questions are invalid";

  const answerMap = answers as Record<string, unknown>;
  const questionIds = new Set<string>();
  const normalizedQuestions: Array<{ id: string; required: boolean }> = [];

  for (const value of questions) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return "Consultation template questions are invalid";
    }
    const question = value as ConsultationQuestion;
    const id = String(question.id || "");
    if (!id || questionIds.has(id)) return "Consultation template questions are invalid";
    questionIds.add(id);
    normalizedQuestions.push({ id, required: Boolean(question.required) });
  }

  if (Object.keys(answerMap).some((id) => !questionIds.has(id))) {
    return "Answers contain a question not present in the signed template version";
  }

  for (const question of normalizedQuestions) {
    const hasAnswer = Object.prototype.hasOwnProperty.call(answerMap, question.id);
    if (!hasAnswer) {
      if (question.required) return `Required consultation answer is missing: ${question.id}`;
      continue;
    }

    const answer = answerMap[question.id];
    if (typeof answer !== "string") return `Consultation answer must be text: ${question.id}`;
    if (question.required && !answer.trim()) return `Required consultation answer is blank: ${question.id}`;
  }

  return null;
}
