'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Anchor,
  Button,
  Container,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { createClient } from '../../../../lib/supabase/browser';

export function AuthForm({
  mode,
  notice,
}: {
  mode: 'login' | 'signup';
  notice?: string;
}) {
  const signup = mode === 'signup';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [message, setMessage] = useState('');
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const validation = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? undefined
        : 'Enter a valid email address.',
      password:
        password.length < (signup ? 8 : 1)
          ? signup
            ? 'Use at least 8 characters.'
            : 'Enter your password.'
          : undefined,
    };
    setErrors(validation);
    setMessage('');
    if (validation.email || validation.password) {
      setStatus('idle');
      return;
    }
    submitting.current = true;
    setStatus('loading');
    try {
      const client = createClient();
      const credentials = { email: email.trim(), password };
      const { data, error } = signup
        ? await client.auth.signUp({
            ...credentials,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/confirm`,
            },
          })
        : await client.auth.signInWithPassword(credentials);
      if (error) {
        setStatus('error');
        setMessage(
          error.code === 'email_not_confirmed'
            ? 'Confirm your email before signing in.'
            : error.status === 429
              ? 'Too many attempts. Please try again later.'
              : signup
                ? 'Unable to sign up. Please check your details and try again.'
                : 'Unable to sign in. Check your email and password.',
        );
      } else if (!signup && !data.session) {
        setStatus('error');
        setMessage('Unable to sign in. Please try again.');
      } else {
        setStatus('success');
        setPassword('');
        setMessage(
          signup
            ? 'Check your email to confirm your account before signing in.'
            : 'You are signed in. Opening the application.',
        );
        if (!signup) {
          router.replace('/app');
          router.refresh();
        }
      }
    } catch {
      setStatus('error');
      setMessage('Authentication is unavailable. Please try again later.');
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Container size="xs" py="xl">
      <Stack>
        <Title order={1}>{signup ? 'Create an account' : 'Sign in'}</Title>
        {notice && <Alert role="status">{notice}</Alert>}
        <form onSubmit={submit} noValidate>
          <Stack>
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              error={errors.email}
              disabled={status === 'loading'}
            />
            <PasswordInput
              label="Password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              error={errors.password}
              disabled={status === 'loading'}
            />
            <Button type="submit" loading={status === 'loading'}>
              {signup ? 'Sign up' : 'Sign in'}
            </Button>
          </Stack>
        </form>
        {message && (
          <Alert
            role={status === 'error' ? 'alert' : 'status'}
            color={status === 'error' ? 'red' : 'green'}
          >
            {message}
          </Alert>
        )}
        <Anchor component={Link} href={signup ? '/login' : '/signup'}>
          {signup ? 'Already have an account? Sign in' : 'Create an account'}
        </Anchor>
        {!signup && (
          <Anchor component={Link} href="/forgot-password">
            Forgot password?
          </Anchor>
        )}
      </Stack>
    </Container>
  );
}
