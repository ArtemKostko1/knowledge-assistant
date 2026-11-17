import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Alert, Container } from '@mantine/core';
import { getVerifiedSession } from '../../features/auth/server/session';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getVerifiedSession();
  if (session.kind === 'unauthenticated') redirect('/login');
  if (session.kind === 'error') {
    return (
      <Container py="xl">
        <Alert role="alert" color="red">
          {session.message}
        </Alert>
      </Container>
    );
  }
  return children;
}
