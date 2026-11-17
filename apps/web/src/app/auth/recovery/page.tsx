import { RecoveryForm } from '../../../features/auth/ui/RecoveryForm/RecoveryForm';
import { AuthLayout } from '../../../components/auth-layout/AuthLayout';
import { validRecoveryToken } from '../../../lib/supabase/recovery';

export const dynamic = 'force-dynamic';
export const metadata = {
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Rendering never contacts Auth or consumes the one-time token.
  return (
    <AuthLayout>
      <RecoveryForm
        token={
          validRecoveryToken(params.token_hash) ? params.token_hash : undefined
        }
      />
    </AuthLayout>
  );
}
