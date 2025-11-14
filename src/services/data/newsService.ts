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

const DATA_URL = new URL('news_full_mcq3_type9_entities_novectors.jsonl', import.meta.env.BASE_URL).toString();

let cachedRecords: NewsRecord[] | null = null;

function parseJsonl(text: string): NewsRecord[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as NewsRecord);
}

export async function fetchNewsRecords(): Promise<NewsRecord[]> {
  if (cachedRecords) {
    return cachedRecords;
  }

  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`ニュースデータの取得に失敗しました: ${response.status}`);
  }

  const text = await response.text();
  const records = parseJsonl(text);
  cachedRecords = records;
  return records;
}
