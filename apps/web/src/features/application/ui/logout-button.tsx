'use client';

import { useActionState } from 'react';
import { Alert, Button, Stack } from '@mantine/core';
import { logout } from '../actions/logout';

export function LogoutButton() {
  const [state, action, pending] = useActionState(logout, { error: null });
  return (
    <form action={action}>
      <Stack>
        <Button type="submit" loading={pending}>
          Logout
        </Button>
        {state.error && (
          <Alert role="alert" color="red">
            {state.error}
          </Alert>
        )}
      </Stack>
    </form>
  );
}
