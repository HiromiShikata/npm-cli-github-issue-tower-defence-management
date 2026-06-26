const path = require('node:path');

const consoleUiRoot = path.join(
  __dirname,
  'src',
  'adapter',
  'entry-points',
  'console',
  'ui',
);

module.exports = {
  collectCoverage: true,
  coverageDirectory: 'reports/coverage',
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'reports/jest-junit' }],
    [
      './node_modules/jest-html-reporter',
      { outputPath: 'reports/jest-html-reporter/index.html' },
    ],
  ],
  projects: [
    {
      displayName: 'backend',
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/jest.setup.js'],
      transform: {
        '^.+\\.ts?$': 'ts-jest',
        '^.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true } }],
      },
      transformIgnorePatterns: ['<rootDir>/node_modules/(?!(ky)/)'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/bin/',
        '/dist/',
        '/src/adapter/entry-points/console/ui/',
      ],
    },
    {
      displayName: 'console-ui',
      rootDir: consoleUiRoot,
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      transform: {
        '^.+\\.(ts|tsx)$': [
          'ts-jest',
          {
            tsconfig: {
              jsx: 'react-jsx',
              esModuleInterop: true,
              module: 'CommonJS',
              moduleResolution: 'Node',
              verbatimModuleSyntax: false,
              types: ['jest', 'node', '@testing-library/jest-dom'],
            },
          },
        ],
        '^.+\\.js$': [
          'ts-jest',
          {
            tsconfig: {
              allowJs: true,
              esModuleInterop: true,
              module: 'CommonJS',
              moduleResolution: 'Node',
              verbatimModuleSyntax: false,
            },
          },
        ],
      },
      transformIgnorePatterns: [
        '/node_modules/(?!(marked|marked-emoji|gemoji)/)',
      ],
      moduleNameMapper: {
        '\\.(css|less|scss)$': '<rootDir>/jest.styleMock.js',
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
    },
  ],
};
