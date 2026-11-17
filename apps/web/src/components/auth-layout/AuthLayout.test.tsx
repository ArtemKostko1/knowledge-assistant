import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { AuthLayout } from './AuthLayout';
import PublicAuthLayout from '../../app/(auth)/layout';
import LoginPage from '../../app/(auth)/login/page';
import SignupPage from '../../app/(auth)/signup/page';
import ForgotPasswordPage from '../../app/(auth)/forgot-password/page';
import UpdatePasswordPage from '../../app/(auth)/update-password/page';

vi.mock('server-only', () => ({}));

afterEach(cleanup);
it('provides one semantic, reusable auth shell', () => {
  render(
    <AuthLayout>
      <span>auth-form-content</span>
    </AuthLayout>,
  );
  expect(
    screen.getByRole('main').contains(screen.getByText('auth-form-content')),
  ).toBe(true);
});
it('wraps every page in the auth group with the shared layout', () => {
  const tree = PublicAuthLayout({ children: 'auth-content' });
  expect(tree.type).toBe(AuthLayout);
  expect(tree.props.children).toBe('auth-content');
});
it('uses viewport minimum height, fluid width and padding without fixed-height clipping', () => {
  const css = readFileSync(
    'src/components/auth-layout/AuthLayout.module.css',
    'utf8',
  );
  expect(css).toContain('min-height: 100dvh');
  expect(css).toContain('width: 100%');
  expect(css).toContain('max-width: 28rem');
  expect(css).toContain('padding: clamp(');
  expect(css).toContain('align-items: center');
  expect(css).toContain('justify-content: center');
  expect(css).not.toContain('overflow: hidden');
});
it('keeps the relocated auth pages connected to their forms', async () => {
  expect(
    (await LoginPage({ searchParams: Promise.resolve({}) })).props.mode,
  ).toBe('login');
  expect(SignupPage().props.mode).toBe('signup');
  expect(ForgotPasswordPage().type.name).toBe('ForgotPasswordForm');
  expect(UpdatePasswordPage().type.name).toBe('RecoveryForm');
});
