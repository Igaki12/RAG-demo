import { useEffect, useMemo, useState } from 'react';
import { Wrap, WrapItem, Button, Stack, HStack, Text } from '@chakra-ui/react';

export type DateMultiSelectorProps = {
  availableDates: string[];
  selectedDates: string[];
  onChange: (nextDates: string[]) => void;
};

function DateMultiSelector({ availableDates, selectedDates, onChange }: DateMultiSelectorProps) {
  const [pendingDates, setPendingDates] = useState<string[]>(selectedDates);

  useEffect(() => {
    setPendingDates(selectedDates);
  }, [selectedDates]);

  const handleToggle = (date: string) => {
    setPendingDates((prev) => {
      if (prev.includes(date)) {
        return prev.filter((d) => d !== date);
      }
      return [...prev, date];
    });
  };

  const handleApply = () => {
    onChange([...pendingDates]);
  };

  const handleReset = () => {
    setPendingDates(selectedDates);
  };

  const hasPendingChanges = useMemo(() => {
    if (pendingDates.length !== selectedDates.length) {
      return true;
    }
    const selectedSet = new Set(selectedDates);
    return pendingDates.some((date) => !selectedSet.has(date));
  }, [pendingDates, selectedDates]);

  return (
    <Stack spacing={3}>
      <Wrap spacing={2}>
        {availableDates.map((date) => {
          const isPending = pendingDates.includes(date);
          return (
            <WrapItem key={date}>
              <Button
                size="sm"
                variant={isPending ? 'solid' : 'outline'}
                colorScheme={isPending ? 'blue' : 'gray'}
                onClick={() => handleToggle(date)}
              >
                {date}
              </Button>
            </WrapItem>
          );
        })}
      </Wrap>
      <HStack spacing={3} flexWrap="wrap">
        <Button size="sm" colorScheme="blue" onClick={handleApply} isDisabled={!hasPendingChanges}>
          フィルターを適用
        </Button>
        <Button size="sm" variant="ghost" onClick={handleReset} isDisabled={!hasPendingChanges}>
          元に戻す
        </Button>
        <Text fontSize="sm" color="gray.500">
          日付を選択してから「フィルターを適用」を押してください。
        </Text>
      </HStack>
    </Stack>
  );
}

export default DateMultiSelector;
