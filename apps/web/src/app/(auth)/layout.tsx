import type { ReactNode } from 'react';
import { AuthLayout } from '../../components/auth-layout/AuthLayout';

export default function PublicAuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthLayout>{children}</AuthLayout>;
}
