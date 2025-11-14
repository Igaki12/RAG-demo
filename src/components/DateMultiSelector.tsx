import { Wrap, WrapItem, Button } from '@chakra-ui/react';

export type DateMultiSelectorProps = {
  availableDates: string[];
  selectedDates: string[];
  onChange: (nextDates: string[]) => void;
};

function DateMultiSelector({ availableDates, selectedDates, onChange }: DateMultiSelectorProps) {
  const handleToggle = (date: string) => {
    if (selectedDates.includes(date)) {
      onChange(selectedDates.filter((d) => d !== date));
    } else {
      onChange([...selectedDates, date]);
    }
  };

  return (
    <Wrap spacing={2}>
      {availableDates.map((date) => (
        <WrapItem key={date}>
          <Button
            size="sm"
            variant={selectedDates.includes(date) ? 'solid' : 'outline'}
            colorScheme={selectedDates.includes(date) ? 'blue' : 'gray'}
            onClick={() => handleToggle(date)}
          >
            {date}
          </Button>
        </WrapItem>
      ))}
    </Wrap>
  );
}

export default DateMultiSelector;
