import { AuthForm } from '../../../features/auth/ui/AuthForm/AuthForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const notice =
    params.logout === 'success'
      ? 'You have been signed out.'
      : params.session === 'expired'
        ? 'Please sign in to continue.'
        : params.recovery === 'success'
          ? 'Your password has been updated. Sign in with your new password.'
          : params.confirmation === 'success'
            ? 'Your email has been confirmed. You can sign in.'
            : params.confirmation === 'invalid'
              ? 'This confirmation link is invalid or expired. Sign up again to request a new email.'
              : undefined;
  return <AuthForm mode="login" notice={notice} />;
}
