// URL names only. Declaring a route here never makes it publicly accessible.
export const routes = {
  home: '/',
  app: '/app',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  updatePassword: '/update-password',
  authConfirm: '/auth/confirm',
  authRecovery: '/auth/recovery',
} as const;
