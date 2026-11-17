import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { LogoutButton } from './logout-button';

const mocks = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('../actions/logout', () => ({ logout: mocks.logout }));
beforeAll(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
);
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it('submits logout and exposes a safe failure for retry', async () => {
  mocks.logout.mockResolvedValue({
    error: 'Unable to sign out. Please try again.',
  });
  render(
    <MantineProvider>
      <LogoutButton />
    </MantineProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(mocks.logout).toHaveBeenCalledTimes(1);
});
