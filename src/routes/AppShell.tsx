import { useEffect, useMemo, useState } from 'react';
import { Button, Center, Heading, Spinner, Stack, Text, useDisclosure } from '@chakra-ui/react';
import AppLayout from '../layout/AppLayout';
import AuthGate from '../components/AuthGate';
import AuthStatusChip from '../components/AuthStatusChip';
import DateMultiSelector from '../components/DateMultiSelector';
import NetworkGraph from '../components/NetworkGraph';
import PerformanceSummary from '../components/PerformanceSummary';
import ProgressTimeline from '../components/ProgressTimeline';
import QuizPanel from '../components/QuizPanel';
import ArticleDetailModal from '../components/ArticleDetailModal';
import { AuthProvider } from '../features/auth/AuthContext';
import { buildGraphFromRecords } from '../lib/vis/transformers';
import type { GraphData, NodeQuestion } from '../lib/vis/transformers';
import { fetchNewsRecords, type NewsRecord } from '../services/data/newsService';

function AppContent() {
  const [records, setRecords] = useState<NewsRecord[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const disclosure = useDisclosure();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchNewsRecords();
        setRecords(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'データの取得中にエラーが発生しました。';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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

  const timelineData = useMemo(
    () =>
      filteredRecords.map((record) => ({
        dateId: record.date_id,
        attempts: record.questions.length
      })),
    [filteredRecords]
  );

  useEffect(() => {
    if (!selectedRecord && disclosure.isOpen) {
      disclosure.onClose();
    }
  }, [selectedRecord, disclosure]);

  if (isLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center minH="60vh">
        <Stack spacing={4} align="center">
          <Heading size="md">ロードエラー</Heading>
          <Text>{error}</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <>
      <AppLayout
        headerRight={<AuthStatusChip />}
        filtersPanel={
          <Stack spacing={4} bg="white" borderRadius="lg" boxShadow="lg" p={4}>
            <Heading size="sm">対象日付</Heading>
            <DateMultiSelector availableDates={availableDates} selectedDates={selectedDates} onChange={setSelectedDates} />
            <Text fontSize="sm" color="gray.500">
              日付を選択すると対象の記事とクイズがフィルタリングされます。
            </Text>
            <Button onClick={disclosure.onOpen} isDisabled={!selectedRecord} colorScheme="teal" alignSelf="flex-start">
              記事詳細を表示
            </Button>
          </Stack>
        }
        graphArea={
          <NetworkGraph
            nodes={graphData.nodes}
            edges={graphData.edges}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
          />
        }
        quizPanel={<QuizPanel questions={nodeQuestions} />}
        performancePanel={
          <PerformanceSummary totalAttempts={0} accuracy={0} coverage={0} rankingPercentile={0.5} playDays={0} />
        }
        timelinePanel={<ProgressTimeline timeline={timelineData} />}
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
