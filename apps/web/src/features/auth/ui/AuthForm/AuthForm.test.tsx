import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { AuthForm } from './AuthForm';

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('../../../../lib/supabase/browser', () => ({
  createClient: () => ({ auth }),
}));
beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

function setup(mode: 'login' | 'signup') {
  render(
    <MantineProvider>
      <AuthForm mode={mode} />
    </MantineProvider>,
  );
}
function fill() {
  fireEvent.change(screen.getByLabelText('Email', { exact: false }), {
    target: { value: 'synthetic@example.test' },
  });
  fireEvent.change(screen.getByLabelText(/^Password/), {
    target: { value: 'synthetic-password' },
  });
}
function submit(label: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
}

it.each(['login', 'signup'] as const)(
  'validates %s before calling Auth',
  (mode) => {
    setup(mode);
    submit(mode === 'login' ? 'Sign in' : 'Sign up');
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(
      screen.getByText(
        mode === 'signup'
          ? 'Use at least 8 characters.'
          : 'Enter your password.',
      ),
    ).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  },
);

it('signs in and navigates to the protected application', async () => {
  auth.signInWithPassword.mockResolvedValue({
    data: { session: {} },
    error: null,
  });
  setup('login');
  fill();
  submit('Sign in');
  expect(
    await screen.findByText('You are signed in. Opening the application.'),
  ).toBeTruthy();
  expect(auth.signInWithPassword).toHaveBeenCalledWith({
    email: 'synthetic@example.test',
    password: 'synthetic-password',
  });
  expect(router.replace).toHaveBeenCalledWith('/app');
  expect(router.refresh).toHaveBeenCalledTimes(1);
});

it('signs up and asks for email confirmation', async () => {
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  setup('signup');
  fill();
  submit('Sign up');
  expect(
    await screen.findByText(
      'Check your email to confirm your account before signing in.',
    ),
  ).toBeTruthy();
  expect(auth.signUp).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  expect(auth.signUp).toHaveBeenCalledWith({
    email: 'synthetic@example.test',
    password: 'synthetic-password',
    options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
  });
});

it.each(['login', 'signup'] as const)(
  'handles %s errors without exposing raw messages',
  async (mode) => {
    auth.signUp.mockResolvedValue({ error: { message: 'secret-marker' } });
    auth.signInWithPassword.mockResolvedValue({
      error: { message: 'secret-marker' },
    });
    setup(mode);
    fill();
    submit(mode === 'login' ? 'Sign in' : 'Sign up');
    await screen.findByRole('alert');
    expect(screen.queryByText('secret-marker')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  },
);

it('explains unconfirmed email errors', async () => {
  auth.signInWithPassword.mockResolvedValue({
    error: { code: 'email_not_confirmed' },
  });
  setup('login');
  fill();
  submit('Sign in');
  expect(
    await screen.findByText('Confirm your email before signing in.'),
  ).toBeTruthy();
});

it('handles transport errors', async () => {
  auth.signInWithPassword.mockRejectedValue(new Error('secret-marker'));
  setup('login');
  fill();
  submit('Sign in');
  expect(
    await screen.findByText(
      'Authentication is unavailable. Please try again later.',
    ),
  ).toBeTruthy();
});

it('prevents duplicate submissions while loading', async () => {
  let resolve!: (value: unknown) => void;
  auth.signInWithPassword.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  setup('login');
  fill();
  submit('Sign in');
  submit('Sign in');
  expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
  resolve({ data: { session: {} }, error: null });
  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
});

it.each(['login', 'signup'] as const)(
  'toggles password visibility on %s without submitting',
  (mode) => {
    setup(mode);
    const input = screen.getByLabelText(/^Password/);
    const toggle = screen.getByRole('button', {
      name: 'Toggle password visibility',
    });
    expect(input.getAttribute('type')).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.mouseDown(toggle);
    expect(input.getAttribute('type')).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.mouseDown(toggle);
    expect(input.getAttribute('type')).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  },
);
