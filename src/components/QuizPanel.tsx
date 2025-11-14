import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Heading,
  List,
  ListItem,
  Stack,
  Text
} from '@chakra-ui/react';
import type { NodeQuestion } from '../lib/vis/transformers';

export type QuizPanelProps = {
  questions: NodeQuestion[];
};

type ShuffledChoice = {
  text: string;
  isCorrect: boolean;
};

function shuffleChoices(choices: ShuffledChoice[]): ShuffledChoice[] {
  return [...choices]
    .map((choice) => ({ choice, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((item) => item.choice);
}

function QuizPanel({ questions }: QuizPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const activeQuestion = questions[activeIndex];

  const shuffledChoices = useMemo(() => {
    if (!activeQuestion) {
      return [];
    }
    return shuffleChoices(
      activeQuestion.question.choices.map((choice, index) => ({
        text: choice,
        isCorrect: index === 0
      }))
    );
  }, [activeQuestion]);

  useEffect(() => {
    setSelectedIndex(null);
    setIsCorrect(null);
  }, [activeQuestion]);

  const handleSelect = (choice: ShuffledChoice, index: number) => {
    setSelectedIndex(index);
    setIsCorrect(choice.isCorrect);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % questions.length);
  };

  if (!activeQuestion) {
    return (
      <Box p={6} bg="white" borderRadius="lg" boxShadow="md">
        <Text color="gray.500">ノードを選択するとクイズが表示されます。</Text>
      </Box>
    );
  }

  const { question, record, questionId } = activeQuestion;

  return (
    <Stack spacing={4} bg="white" borderRadius="lg" boxShadow="lg" p={6}>
      <Stack direction="row" justify="space-between" align="baseline">
        <Heading size="md">クイズ</Heading>
        <Badge colorScheme="blue">{questionId}</Badge>
      </Stack>
      <Text fontWeight="medium">{question.question}</Text>
      <List spacing={3}>
        {shuffledChoices.map((choice, index) => (
          <ListItem key={choice.text}>
            <Button
              variant="outline"
              width="100%"
              justifyContent="flex-start"
              onClick={() => handleSelect(choice, index)}
              colorScheme={selectedIndex === index ? (choice.isCorrect ? 'green' : 'red') : 'gray'}
            >
              {choice.text}
            </Button>
          </ListItem>
        ))}
      </List>
      {isCorrect !== null && (
        <Alert status={isCorrect ? 'success' : 'error'} borderRadius="md">
          <AlertIcon />
          <AlertDescription>
            {isCorrect ? 'GOOD! 正解です。' : 'BAD... 残念、不正解です。'}
          </AlertDescription>
        </Alert>
      )}
      {(question.explanation || question.reasoning) && isCorrect !== null && (
        <Box bg="gray.50" borderRadius="md" p={4}>
          <Heading as="h3" size="sm" mb={2}>
            解説
          </Heading>
          <Text color="gray.700">{question.explanation ?? question.reasoning}</Text>
        </Box>
      )}
      <Stack spacing={1}>
        <Text fontSize="sm" color="gray.600">
          出典: {record.headline}
        </Text>
        <Text fontSize="sm" color="gray.600">
          日付: {record.date_id}
        </Text>
      </Stack>
      {questions.length > 1 && (
        <Button onClick={handleNext} colorScheme="blue" alignSelf="flex-end">
          次の問題へ
        </Button>
      )}
    </Stack>
  );
}

export default QuizPanel;
