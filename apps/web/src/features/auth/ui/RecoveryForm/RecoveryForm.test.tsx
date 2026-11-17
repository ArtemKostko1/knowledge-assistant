import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { RecoveryForm } from './RecoveryForm';

const mocks = vi.hoisted(() => ({ updatePassword: vi.fn() }));
vi.mock('../../actions/update-password', () => ({
  updatePassword: mocks.updatePassword,
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

function setup() {
  render(
    <MantineProvider>
      <RecoveryForm token={'a'.repeat(64)} />
    </MantineProvider>,
  );
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
}

it('bypasses native validation and displays an inline error for an empty password', () => {
  setup();
  const form = screen
    .getByRole('button', { name: 'Update password' })
    .closest('form')!;
  expect(form.noValidate).toBe(true);

  submit();

  expect(screen.getByText('Enter your password.')).toBeTruthy();
  const input = screen.getByLabelText(/^New password/);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(input.getAttribute('data-invalid')).toBe('true');
  const describedBy = input.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  expect(document.getElementById(describedBy!)?.textContent).toContain(
    'Enter your password.',
  );
  expect(mocks.updatePassword).not.toHaveBeenCalled();
});

it('displays the minimum-length error and does not submit an invalid password', () => {
  setup();
  fireEvent.change(screen.getByLabelText(/^New password/), {
    target: { value: 'short7!' },
  });

  submit();

  expect(
    screen.getByText('Password must contain at least 8 characters.'),
  ).toBeTruthy();
  expect(
    screen.getByLabelText(/^New password/).getAttribute('aria-invalid'),
  ).toBe('true');
  expect(
    screen.getByLabelText(/^New password/).getAttribute('data-invalid'),
  ).toBe('true');
  expect(mocks.updatePassword).not.toHaveBeenCalled();
});

it('clears the inline validation error when the password becomes valid', () => {
  setup();
  submit();
  expect(screen.getByText('Enter your password.')).toBeTruthy();

  fireEvent.change(screen.getByLabelText(/^New password/), {
    target: { value: 'valid-password' },
  });

  expect(screen.queryByText('Enter your password.')).toBeNull();
  expect(
    screen.getByLabelText(/^New password/).getAttribute('aria-invalid'),
  ).not.toBe('true');
});

it('submits a valid password through the existing Server Action', async () => {
  mocks.updatePassword.mockResolvedValue({ error: null });
  setup();
  fireEvent.change(screen.getByLabelText(/^New password/), {
    target: { value: 'valid-password' },
  });

  submit();

  await waitFor(() => expect(mocks.updatePassword).toHaveBeenCalledTimes(1));
  const [previousState, formData] = mocks.updatePassword.mock.calls[0]!;
  expect(previousState).toEqual({ error: null });
  expect(formData.get('token_hash')).toBe('a'.repeat(64));
  expect(formData.get('password')).toBe('valid-password');
});

it('preserves the password visibility toggle', () => {
  setup();
  const input = screen.getByLabelText(/^New password/);
  const toggle = screen.getByRole('button', {
    name: 'Toggle password visibility',
  });

  expect(input.getAttribute('type')).toBe('password');
  fireEvent.mouseDown(toggle);
  expect(input.getAttribute('type')).toBe('text');
  fireEvent.mouseDown(toggle);
  expect(input.getAttribute('type')).toBe('password');
});

it('preserves pending state while the Server Action is running', async () => {
  let resolve!: (value: { error: null }) => void;
  mocks.updatePassword.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  setup();
  fireEvent.change(screen.getByLabelText(/^New password/), {
    target: { value: 'valid-password' },
  });
  submit();

  expect(await screen.findByLabelText(/^New password/)).toHaveProperty(
    'disabled',
    true,
  );
  resolve({ error: null });
  await waitFor(() =>
    expect(screen.getByLabelText(/^New password/)).toHaveProperty(
      'disabled',
      false,
    ),
  );
});

it('preserves the safe Server Action error state', async () => {
  mocks.updatePassword.mockResolvedValue({ error: 'Request a new link.' });
  setup();
  fireEvent.change(screen.getByLabelText(/^New password/), {
    target: { value: 'valid-password' },
  });
  submit();

  expect(
    (await screen.findByRole('alert')).textContent?.includes(
      'Request a new link.',
    ),
  ).toBe(true);
});
