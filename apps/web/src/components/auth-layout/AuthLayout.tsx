import type { ReactNode } from 'react';
import classes from './AuthLayout.module.css';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className={classes.root}>
      <div className={classes.content}>{children}</div>
    </main>
  );
}
