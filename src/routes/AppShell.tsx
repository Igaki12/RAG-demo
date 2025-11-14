import { useEffect, useMemo, useState } from 'react';
import { Button, Center, Heading, Stack, Text, useDisclosure } from '@chakra-ui/react';
import AppLayout from '../layout/AppLayout';
import AuthGate from '../components/AuthGate';
import AuthStatusChip from '../components/AuthStatusChip';
import DateMultiSelector from '../components/DateMultiSelector';
import JsonlUploader from '../components/JsonlUploader';
import NetworkGraph from '../components/NetworkGraph';
import PerformanceSummary from '../components/PerformanceSummary';
import ProgressTimeline from '../components/ProgressTimeline';
import QuizPanel from '../components/QuizPanel';
import ArticleDetailModal from '../components/ArticleDetailModal';
import { AuthProvider } from '../features/auth/AuthContext';
import { buildGraphFromRecords } from '../lib/vis/transformers';
import type { GraphData, NodeQuestion } from '../lib/vis/transformers';
import type { NewsRecord } from '../services/data/newsService';

function AppContent() {
  const [records, setRecords] = useState<NewsRecord[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const disclosure = useDisclosure();

  useEffect(() => {
    setSelectedDates([]);
    setSelectedNodeId(null);
  }, [records]);

  const isDatasetReady = records.length > 0;

  const handleRecordsLoaded = (data: NewsRecord[]) => {
    setRecords(data);
  };

  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(records.map((record) => record.date_id)));
    return dates.sort((a, b) => b.localeCompare(a));
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (selectedDates.length === 0) {
      return records;
    }
    return records.filter((record) => selectedDates.includes(record.date_id));
  }, [records, selectedDates]);

  const graphData: GraphData = useMemo(() => buildGraphFromRecords(filteredRecords), [filteredRecords]);

  const nodeQuestions: NodeQuestion[] = useMemo(() => {
    if (!selectedNodeId) {
      return [];
    }
    return graphData.questionIndex[selectedNodeId] ?? [];
  }, [graphData.questionIndex, selectedNodeId]);

  const selectedRecord = nodeQuestions.length > 0 ? nodeQuestions[0].record : null;

  const timelineData = useMemo(() => {
    const grouped = filteredRecords.reduce<Record<string, { dateId: string; attempts: number }>>((acc, record) => {
      if (!acc[record.date_id]) {
        acc[record.date_id] = { dateId: record.date_id, attempts: 0 };
      }
      acc[record.date_id].attempts += record.questions.length;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.dateId.localeCompare(a.dateId));
  }, [filteredRecords]);

  useEffect(() => {
    if (!selectedRecord && disclosure.isOpen) {
      disclosure.onClose();
    }
  }, [selectedRecord, disclosure]);

  return (
    <>
      <AppLayout
        headerRight={<AuthStatusChip />}
        filtersPanel={
          <Stack spacing={4} bg="white" borderRadius="lg" boxShadow="lg" p={4}>
            {isDatasetReady ? null : <JsonlUploader onRecordsLoaded={handleRecordsLoaded} />}
            <Heading size="sm">対象日付</Heading>
            <DateMultiSelector availableDates={availableDates} selectedDates={selectedDates} onChange={setSelectedDates} />
            <Text fontSize="sm" color="gray.500">
              複数の日付を選択した後に「フィルターを適用」を押すと対象の記事とクイズが更新されます。
            </Text>
            <Button onClick={disclosure.onOpen} isDisabled={!selectedRecord} colorScheme="teal" alignSelf="flex-start">
              記事詳細を表示
            </Button>
          </Stack>
        }
        graphArea={
          isDatasetReady ? (
            <NetworkGraph
              nodes={graphData.nodes}
              edges={graphData.edges}
              selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNodeId}
            />
          ) : (
            <Center minH={{ base: '480px', md: '700px' }} bg="white" borderRadius="lg" boxShadow="lg" p={6}>
              <Stack spacing={3} align="center">
                <Heading size="md">データをアップロードしてください</Heading>
                <Text color="gray.500" textAlign="center">
                  JSONL ファイルを読み込むとネットワーク図が表示されます。
                </Text>
              </Stack>
            </Center>
          )
        }
        quizPanel={
          isDatasetReady ? (
            <QuizPanel questions={nodeQuestions} />
          ) : (
            <Stack spacing={3} bg="white" borderRadius="lg" boxShadow="lg" p={4}>
              <Heading size="sm">クイズ</Heading>
              <Text color="gray.500">データ読み込み前のため、クイズは表示されていません。</Text>
            </Stack>
          )
        }
        performancePanel={
          isDatasetReady ? (
            <PerformanceSummary totalAttempts={0} accuracy={0} coverage={0} rankingPercentile={0.5} playDays={0} />
          ) : (
            <Stack spacing={3} bg="white" borderRadius="lg" boxShadow="lg" p={4}>
              <Heading size="sm">成績サマリー</Heading>
              <Text color="gray.500">データを読み込むと指標が表示されます。</Text>
            </Stack>
          )
        }
        timelinePanel={
          isDatasetReady ? (
            <ProgressTimeline timeline={timelineData} />
          ) : (
            <Stack spacing={3} bg="white" borderRadius="lg" boxShadow="lg" p={4}>
              <Heading size="sm">プレイ履歴</Heading>
              <Text color="gray.500">まだデータが読み込まれていません。</Text>
            </Stack>
          )
        }
      />
      <ArticleDetailModal isOpen={disclosure.isOpen} onClose={disclosure.onClose} record={selectedRecord} />
    </>
  );
}

function AppShell() {
  return (
    <AuthProvider>
      <AuthGate>
        <AppContent />
      </AuthGate>
    </AuthProvider>
  );
}

export default AppShell;
