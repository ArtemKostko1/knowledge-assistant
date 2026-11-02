import { expect, test } from '@playwright/test';

test('HTTP API skeleton is reachable', async ({ request }) => {
  const response = await request.get('/health');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: 'ok' });
});
