import {
  Badge,
  Box,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalCloseButton,
  Stack,
  Text
} from '@chakra-ui/react';
import type { NewsRecord } from '../services/data/newsService';

export type ArticleDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  record: NewsRecord | null;
};

function ArticleDetailModal({ isOpen, onClose, record }: ArticleDetailModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside" motionPreset="scale" preserveScrollBarGap>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{record?.headline ?? '記事詳細'}</ModalHeader>
        <ModalCloseButton aria-label="閉じる" />
        <ModalBody>
          {record ? (
            <Stack spacing={4}>
              <Box>
                <Text fontSize="sm" color="gray.600">
                  日付: {record.date_id}
                </Text>
              </Box>
              <Box>
                <Text whiteSpace="pre-line">{record.content}</Text>
              </Box>
              <Box>
                <Text fontWeight="medium" mb={2}>
                  Named Entities
                </Text>
                <List display="flex" flexWrap="wrap" gap={2}>
                  {record.named_entities.map((entity) => (
                    <ListItem key={entity}>
                      <Badge colorScheme="purple">{entity}</Badge>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Stack>
          ) : (
            <Text color="gray.500">記事が選択されていません。</Text>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default ArticleDetailModal;
