export type NewsQuestion = {
  question: string;
  choices: string[];
  explanation?: string;
  reasoning?: string;
};

export type NewsRecord = {
  date_id: string;
  headline: string;
  content: string;
  named_entities: string[];
  questions: NewsQuestion[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNewsQuestion(value: unknown): value is NewsQuestion {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.question === 'string' && isStringArray(candidate.choices) && candidate.choices.length > 0;
}

function isNewsRecord(value: unknown): value is NewsRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.date_id === 'string' &&
    typeof candidate.headline === 'string' &&
    typeof candidate.content === 'string' &&
    isStringArray(candidate.named_entities) &&
    Array.isArray(candidate.questions) &&
    candidate.questions.every(isNewsQuestion)
  );
}

export function parseNewsRecords(text: string): NewsRecord[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error('JSONLにレコードが含まれていません。');
  }

  const records = lines.map((line, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(`行 ${index + 1} のJSONを解析できませんでした。`);
    }

    if (!isNewsRecord(parsed)) {
      throw new Error(`行 ${index + 1} が想定フォーマットと一致しません。`);
    }

    return parsed;
  });

  return records;
}
