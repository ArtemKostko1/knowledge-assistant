import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import RecoveryPage from './page';
import UpdatePasswordPage from '../../(auth)/update-password/page';
import { updatePassword } from '../../../features/auth/actions/update-password';

const mocks = vi.hoisted(() => ({
  recover: vi.fn(),
  redirect: vi.fn(),
  verify: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('../../../lib/supabase/recovery', async (original) => ({
  ...(await original<typeof import('../../../lib/supabase/recovery')>()),
  recoverPassword: mocks.recover,
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { verifyOtp: mocks.verify } }),
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
const token = 'a'.repeat(64);

it('GET recovery only renders the form and never verifies the token', async () => {
  const page = await RecoveryPage({
    searchParams: Promise.resolve({
      token_hash: token,
      next: 'https://evil.test',
    }),
  });
  render(<MantineProvider>{page}</MantineProvider>);
  expect(screen.getByRole('button', { name: 'Update password' })).toBeTruthy();
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.recover).not.toHaveBeenCalled();
  expect(document.querySelector('a[href="https://evil.test"]')).toBeNull();
});
it('direct update-password access does not unlock recovery', () => {
  render(
    <MantineProvider>
      <UpdatePasswordPage />
    </MantineProvider>,
  );
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Update password' })).toBeNull();
});
it('redirects to a fixed token-free login URL only on success', async () => {
  mocks.recover.mockResolvedValue({ error: null });
  const form = new FormData();
  form.set('token_hash', token);
  form.set('password', 'synthetic-password');
  form.set('next', 'https://evil.test');
  await updatePassword({ error: null }, form);
  expect(mocks.recover).toHaveBeenCalledWith(token, 'synthetic-password');
  expect(mocks.redirect).toHaveBeenCalledWith('/login?recovery=success');
});
it('hides the consumed-token form after an update failure', async () => {
  mocks.recover.mockResolvedValue({
    error: 'Request a new link.',
    requestNewLink: true,
  });
  const page = await RecoveryPage({
    searchParams: Promise.resolve({ token_hash: token }),
  });
  render(<MantineProvider>{page}</MantineProvider>);
  fireEvent.change(screen.getByLabelText(/^New password/), {
    target: { value: 'synthetic-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  expect(await screen.findByText('Request a new link.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Update password' })).toBeNull();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
