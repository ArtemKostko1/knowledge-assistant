import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import Home from './page';

beforeAll(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('Home', () => {
  it('shows the bootstrap screen', () => {
    render(
      <MantineProvider>
        <Home />
      </MantineProvider>,
    );
    expect(screen.getByText('Knowledge Assistant')).toBeTruthy();
  });
});
