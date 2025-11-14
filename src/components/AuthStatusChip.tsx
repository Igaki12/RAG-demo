import { Avatar, Button, HStack, Text } from '@chakra-ui/react';
import { useAuth } from '../features/auth/AuthContext';

function AuthStatusChip() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <HStack spacing={3} bg="whiteAlpha.900" px={3} py={2} borderRadius="full" boxShadow="sm">
      <Avatar name={user.displayName} size="sm" />
      <Text fontWeight="medium">{user.displayName}</Text>
      <Button size="sm" variant="outline" onClick={logout}>
        Logout
      </Button>
    </HStack>
  );
}

export default AuthStatusChip;
