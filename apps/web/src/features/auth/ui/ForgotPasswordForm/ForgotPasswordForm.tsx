'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Alert,
  Anchor,
  Button,
  Container,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { createClient } from '../../../../lib/supabase/browser';

export const recoveryRequestMessage =
  'If an account exists for this email, you will receive a password recovery link.';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setSent(false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError(undefined);
    busy.current = true;
    setPending(true);
    try {
      await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/recovery`,
      });
    } catch {
      // All Auth outcomes use the same message to avoid account enumeration.
    } finally {
      busy.current = false;
      setPending(false);
      setSent(true);
    }
  }
  return (
    <Container size="xs" py="xl">
      <Stack>
        <Title order={1}>Forgot password</Title>
        <form onSubmit={submit} noValidate>
          <Stack>
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              error={error}
              disabled={pending}
            />
            <Button type="submit" loading={pending}>
              Send recovery email
            </Button>
          </Stack>
        </form>
        {sent && <Alert role="status">{recoveryRequestMessage}</Alert>}
        <Anchor component={Link} href="/login">
          Back to sign in
        </Anchor>
      </Stack>
    </Container>
  );
}
