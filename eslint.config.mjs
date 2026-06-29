import { readFileSync } from 'fs';
import tseslint from 'typescript-eslint';
import eslintJs from '@eslint/js';
import { importX } from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';

const gitignoreLines = readFileSync('.gitignore', 'utf8')
  .split('\n')
  .filter((line) => line.trim() && !line.trim().startsWith('#'));

export default tseslint.config(
  {
    ignores: [
      ...gitignoreLines,
      'src/adapter/entry-points/console/ui/**',
      'src/adapter/entry-points/console/ui-dist/**',
    ],
  },
  eslintJs.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    plugins: {
      'import-x': importX,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.json'],
      },
    },
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/domain',
              from: './src/adapter',
            },
            {
              target: './src/domain/entities',
              from: './src/domain/usecases',
            },
            {
              target: './src/adapter/repositories',
              from: './src/adapter/entry-points',
            },
          ],
        },
      ],
      'unused-imports/no-unused-imports': 'error',
    },
  },
);
