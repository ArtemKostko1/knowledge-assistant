import 'server-only';

import type { AppUserProfile } from '@knowledge-assistant/contracts';
import { getVerifiedSession } from '../../auth/server/session';
import { requestApi } from '../../../lib/api/server';

export type ProfileResult =
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; profile: AppUserProfile };

function isProfile(value: unknown): value is AppUserProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.id === 'string' &&
    typeof profile.email === 'string' &&
    typeof profile.createdAt === 'string' &&
    !Number.isNaN(Date.parse(profile.createdAt)) &&
    typeof profile.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(profile.updatedAt))
  );
}

export async function loadApplicationProfile(): Promise<ProfileResult> {
  const session = await getVerifiedSession();
  if (session.kind !== 'authenticated') return session;
  const { accessToken: token, userId } = session;

  let stage: 'bootstrap' | 'profile' = 'bootstrap';
  try {
    // No body/query: the backend derives identity exclusively from the token.
    const bootstrap = await requestApi('/auth/bootstrap', token, 'POST');
    if (bootstrap.status === 401) return { kind: 'unauthenticated' };
    if (!bootstrap.ok)
      return {
        kind: 'error',
        message:
          bootstrap.status === 403
            ? 'Confirm your email before opening the application.'
            : 'Unable to initialize your profile. Please try again.',
      };

    stage = 'profile';
    const response = await requestApi('/auth/me', token, 'GET');
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (!response.ok)
      return {
        kind: 'error',
        message: 'Unable to load your profile. Please try again.',
      };
    const profile: unknown = await response.json();
    if (!isProfile(profile) || profile.id !== userId)
      return {
        kind: 'error',
        message: 'Unable to load your profile. Please try again.',
      };
    // Explicit projection prevents unexpected response fields reaching SSR props.
    return {
      kind: 'ready',
      profile: {
        id: profile.id,
        email: profile.email,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    };
  } catch {
    return {
      kind: 'error',
      message:
        stage === 'bootstrap'
          ? 'Unable to initialize your profile. Please try again.'
          : 'Unable to load your profile. Please try again.',
    };
  }
}
