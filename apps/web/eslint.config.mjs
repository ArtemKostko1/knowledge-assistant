import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import shared from '@knowledge-assistant/config-eslint';

const config = [...shared, ...nextVitals, ...nextTypescript];

config.push({
  files: ['**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              '@knowledge-assistant/backend',
              '@knowledge-assistant/backend/*',
            ],
            message: 'Server-only package.',
          },
          {
            group: [
              '@knowledge-assistant/database',
              '@knowledge-assistant/database/*',
            ],
            message: 'Server-only package.',
          },
          {
            group: ['@prisma/*', 'pg', 'pg-boss'],
            message: 'Database and queue packages are server-only.',
          },
        ],
      },
    ],
  },
});

export default config;
