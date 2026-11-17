import { redirect } from 'next/navigation';
import { Alert, Anchor, Container, Stack, Text, Title } from '@mantine/core';
import { loadApplicationProfile } from '../../../features/application/server/profile';
import { LogoutButton } from '../../../features/application/ui/logout-button';

export const dynamic = 'force-dynamic';

export default async function ApplicationPage() {
  const result = await loadApplicationProfile();
  if (result.kind === 'unauthenticated') redirect('/login?session=expired');
  return (
    <Container size="sm" py="xl">
      <Stack>
        <Title order={1}>Knowledge Assistant</Title>
        {result.kind === 'error' ? (
          <>
            <Alert role="alert" color="red">
              {result.message}
            </Alert>
            <Anchor href="/app">Try again</Anchor>
          </>
        ) : (
          <>
            <Text>Signed in as {result.profile.email}</Text>
            <Text>User ID: {result.profile.id}</Text>
            <Text>Product features are not available yet.</Text>
          </>
        )}
        <LogoutButton />
      </Stack>
    </Container>
  );
}
