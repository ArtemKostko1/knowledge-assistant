'use client';

import { useActionState, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Alert,
  Anchor,
  Button,
  Container,
  PasswordInput,
  Stack,
  Title,
} from '@mantine/core';
import { updatePassword } from '../../actions/update-password';

export function RecoveryForm({ token }: { token?: string }) {
  const [state, action, pending] = useActionState(updatePassword, {
    error: null,
  });
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function validatePassword(value: string) {
    if (!value) return 'Enter your password.';
    if (value.length < 8) return 'Password must contain at least 8 characters.';
    return null;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    const error = validatePassword(password);
    setPasswordError(error);
    if (error) event.preventDefault();
  }

  return (
    <Container size="xs" py="xl">
      <Stack>
        <Title order={1}>Set a new password</Title>
        {!token ? (
          <Alert color="red" role="alert">
            This recovery link is invalid or expired. Request a new link.
          </Alert>
        ) : state.requestNewLink ? null : (
          <form action={action} onSubmit={submit} noValidate>
            <Stack>
              <input type="hidden" name="token_hash" value={token} />
              <PasswordInput
                label="New password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                disabled={pending}
                value={password}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setPassword(value);
                  setPasswordError((current) =>
                    current ? validatePassword(value) : null,
                  );
                }}
                error={passwordError}
                aria-invalid={passwordError ? true : undefined}
              />
              <Button type="submit" loading={pending}>
                Update password
              </Button>
            </Stack>
          </form>
        )}
        {state.error && (
          <Alert color="red" role="alert">
            {state.error}
          </Alert>
        )}
        <Anchor component={Link} href="/forgot-password">
          Request a new recovery link
        </Anchor>
        <Anchor component={Link} href="/login">
          Back to sign in
        </Anchor>
      </Stack>
    </Container>
  );
}
