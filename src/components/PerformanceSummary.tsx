import { SimpleGrid, Stat, StatLabel, StatNumber } from '@chakra-ui/react';

export type PerformanceSummaryProps = {
  totalAttempts: number;
  accuracy: number;
  coverage: number;
  rankingPercentile: number;
  playDays: number;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function PerformanceSummary({ totalAttempts, accuracy, coverage, rankingPercentile, playDays }: PerformanceSummaryProps) {
  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} bg="white" borderRadius="lg" boxShadow="lg" p={4}>
      <Stat>
        <StatLabel>総解答数</StatLabel>
        <StatNumber>{totalAttempts}</StatNumber>
      </Stat>
      <Stat>
        <StatLabel>正解率</StatLabel>
        <StatNumber>{formatPercent(accuracy)}</StatNumber>
      </Stat>
      <Stat>
        <StatLabel>網羅率</StatLabel>
        <StatNumber>{formatPercent(coverage)}</StatNumber>
      </Stat>
      <Stat>
        <StatLabel>上位割合</StatLabel>
        <StatNumber>{formatPercent(1 - rankingPercentile)}</StatNumber>
      </Stat>
      <Stat>
        <StatLabel>プレイ日数</StatLabel>
        <StatNumber>{playDays}</StatNumber>
      </Stat>
    </SimpleGrid>
  );
}

export default PerformanceSummary;
