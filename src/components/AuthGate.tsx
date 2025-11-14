import { FormEvent, PropsWithChildren, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  useToast
} from '@chakra-ui/react';
import { useAuth } from '../features/auth/AuthContext';

function AuthGate({ children }: PropsWithChildren) {
  const { user, login, isAuthenticating, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const toast = useToast();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await login(email, password);
    } catch (err) {
      if (!(err instanceof Error)) {
        console.error(err);
      }
    }
  };

  const handlePlaceholderAction = (label: string) => {
    toast({
      title: `${label} は現在未対応です`,
      status: 'info',
      duration: 4000,
      isClosable: true
    });
  };

  if (user) {
    return <>{children}</>;
  }

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" px={4}>
      <Box as="form" onSubmit={handleSubmit} bg="white" borderRadius="lg" boxShadow="lg" p={8} maxW="md" w="full">
        <Stack spacing={6}>
          <Stack spacing={2} textAlign="center">
            <Heading size="lg">ニュース理解力デモへログイン</Heading>
            <Text color="gray.600">デモ用アカウントのメールアドレスとパスワードを入力してください。</Text>
          </Stack>
          <FormControl isRequired>
            <FormLabel>メールアドレス</FormLabel>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>パスワード</FormLabel>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </FormControl>
          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Stack direction={{ base: 'column', sm: 'row' }} spacing={3} justify="space-between">
            <Button variant="ghost" onClick={() => handlePlaceholderAction('メール確認')}>
              メール確認
            </Button>
            <Button variant="ghost" onClick={() => handlePlaceholderAction('パスワード再設定')}>
              パスワード再設定
            </Button>
            <Button colorScheme="blue" type="submit" isLoading={isAuthenticating}>
              ログイン
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

export default AuthGate;
