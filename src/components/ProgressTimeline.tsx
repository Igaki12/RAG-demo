import { Box, Heading, Stack, Text } from '@chakra-ui/react';

export type ProgressTimelineProps = {
  timeline: Array<{ dateId: string; attempts: number }>;
};

function ProgressTimeline({ timeline }: ProgressTimelineProps) {
  return (
    <Stack spacing={3} bg="white" borderRadius="lg" boxShadow="lg" p={4}>
      <Heading size="sm">プレイ履歴</Heading>
      {timeline.length === 0 ? (
        <Text color="gray.500">まだプレイ履歴がありません。</Text>
      ) : (
        <Stack spacing={2}>
          {timeline.map((item) => (
            <Box key={item.dateId} display="flex" justifyContent="space-between">
              <Text fontWeight="medium">{item.dateId}</Text>
              <Text color="gray.600">{item.attempts} 問</Text>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default ProgressTimeline;
