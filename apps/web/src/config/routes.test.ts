import { expect, it } from 'vitest';
import { routes } from './routes';

it('names existing URLs without changing paths or adding an access policy', () => {
  expect(routes).toEqual({
    home: '/',
    app: '/app',
    login: '/login',
    signup: '/signup',
    forgotPassword: '/forgot-password',
    updatePassword: '/update-password',
    authConfirm: '/auth/confirm',
    authRecovery: '/auth/recovery',
  });
});
