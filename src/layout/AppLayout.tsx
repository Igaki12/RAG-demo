import { ReactNode } from 'react';
import { Box, Container, Flex, Heading, SimpleGrid, Stack } from '@chakra-ui/react';

export type AppLayoutProps = {
  headerRight?: ReactNode;
  graphArea: ReactNode;
  quizPanel: ReactNode;
  filtersPanel: ReactNode;
  performancePanel: ReactNode;
  timelinePanel: ReactNode;
};

function AppLayout({ headerRight, graphArea, quizPanel, filtersPanel, performancePanel, timelinePanel }: AppLayoutProps) {
  return (
    <Box minH="100vh" bg="gray.100">
      <Container maxW="7xl" py={8}>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} flexDir={{ base: 'column', md: 'row' }} gap={4} mb={6}>
          <Heading size="lg">RAG Demo Network Explorer</Heading>
          {headerRight}
        </Flex>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} alignItems="flex-start">
          <Stack spacing={6}>
            {filtersPanel}
            {graphArea}
          </Stack>
          <Stack spacing={6}>
            {quizPanel}
            {performancePanel}
            {timelinePanel}
          </Stack>
        </SimpleGrid>
      </Container>
    </Box>
  );
}

export default AppLayout;
