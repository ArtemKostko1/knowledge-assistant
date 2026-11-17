import { redirect } from 'next/navigation';
import { Alert, Container } from '@mantine/core';
import { getVerifiedSession } from '../features/auth/server/session';
import { routes } from '../config/routes';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getVerifiedSession();
  if (session.kind === 'error')
    return (
      <Container py="xl">
        <Alert role="alert" color="red">
          {session.message}
        </Alert>
      </Container>
    );
  redirect(session.kind === 'authenticated' ? routes.app : routes.login);
}
