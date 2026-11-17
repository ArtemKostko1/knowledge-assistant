import { RecoveryForm } from '../../../features/auth/ui/RecoveryForm/RecoveryForm';

export default function UpdatePasswordPage() {
  // A login session alone never unlocks password recovery.
  return <RecoveryForm />;
}
