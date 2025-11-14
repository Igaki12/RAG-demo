import { ChangeEvent, useRef, useState } from 'react';
import { Alert, AlertIcon, FormControl, FormHelperText, FormLabel, Input, Stack, Text } from '@chakra-ui/react';
import { parseNewsRecords, type NewsRecord } from '../services/data/newsService';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_UPLOAD_MB = Math.round((MAX_UPLOAD_BYTES / (1024 * 1024)) * 10) / 10;

export type JsonlUploaderProps = {
  onRecordsLoaded: (records: NewsRecord[]) => void;
};

function JsonlUploader({ onRecordsLoaded }: JsonlUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.jsonl')) {
      setError('拡張子が .jsonl のファイルを選択してください。');
      resetInput();
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`ファイルサイズは最大 ${MAX_UPLOAD_MB}MB までです。`);
      resetInput();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const records = parseNewsRecords(text);
      onRecordsLoaded(records);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました。';
      setError(message);
    } finally {
      setLoading(false);
      resetInput();
    }
  };

  return (
    <Stack spacing={3} border="1px dashed" borderColor="gray.300" borderRadius="lg" p={4} bg="gray.50">
      <FormControl>
        <FormLabel fontWeight="bold">JSONLファイルをアップロード</FormLabel>
        <Input
          ref={inputRef}
          type="file"
          accept=".jsonl,application/json,text/plain"
          onChange={handleFileChange}
          isDisabled={isLoading}
          bg="white"
        />
        <FormHelperText>
          最大 {MAX_UPLOAD_MB}MB / 1 行 1 レコードの JSONL に対応しています。
        </FormHelperText>
      </FormControl>
      <Text fontSize="sm" color="gray.600">
        アップロード後、自動的にネットワーク図やクイズが更新されます。
      </Text>
      {error && (
        <Alert status="error" fontSize="sm">
          <AlertIcon />
          {error}
        </Alert>
      )}
    </Stack>
  );
}

export default JsonlUploader;
