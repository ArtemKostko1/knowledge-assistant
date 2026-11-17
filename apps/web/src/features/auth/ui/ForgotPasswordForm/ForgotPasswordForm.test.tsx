import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import {
  ForgotPasswordForm,
  recoveryRequestMessage,
} from './ForgotPasswordForm';

const mocks = vi.hoisted(() => ({ reset: vi.fn() }));
vi.mock('../../../../lib/supabase/browser', () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: mocks.reset } }),
}));
beforeAll(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
);
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

function setup() {
  render(
    <MantineProvider>
      <ForgotPasswordForm />
    </MantineProvider>,
  );
}
it('validates email without calling Supabase', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Send recovery email' }));
  expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  expect(mocks.reset).not.toHaveBeenCalled();
});
it.each(['success', 'unknown-user', 'transport-error'])(
  'uses the same message for %s',
  async (scenario) => {
    if (scenario === 'transport-error')
      mocks.reset.mockRejectedValue(new Error('secret-marker'));
    else
      mocks.reset.mockResolvedValue({
        error: scenario === 'success' ? null : { message: 'secret-marker' },
      });
    setup();
    fireEvent.change(screen.getByLabelText(/^Email/), {
      target: { value: 'synthetic@example.test' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Send recovery email' }),
    );
    expect(await screen.findByText(recoveryRequestMessage)).toBeTruthy();
    expect(mocks.reset).toHaveBeenCalledWith('synthetic@example.test', {
      redirectTo: `${window.location.origin}/auth/recovery`,
    });
    expect(screen.queryByText('secret-marker')).toBeNull();
  },
);
