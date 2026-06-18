const reporters = [
  'default',
  ['jest-junit', { outputDirectory: 'reports/jest-junit' }],
  [
    './node_modules/jest-html-reporter',
    { outputPath: 'reports/jest-html-reporter/index.html' },
  ],
];

const consoleUiRoot = '<rootDir>/src/adapter/entry-points/console/ui';

module.exports = {
  collectCoverage: true,
  coverageDirectory: 'reports/coverage',
  reporters,
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
        '<rootDir>/src/adapter/entry-points/console/ui/',
      ],
    },
    {
      displayName: 'console-ui',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: [`${consoleUiRoot}/jest.setup.ts`],
      roots: [consoleUiRoot],
      testMatch: [`${consoleUiRoot}/**/*.test.tsx`],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          { tsconfig: `${consoleUiRoot}/tsconfig.jest.json` },
        ],
      },
      moduleNameMapper: {
        '\\.css$': 'identity-obj-proxy',
        '^@/(.*)$': `${consoleUiRoot}/src/$1`,
      },
    },
  ],
};
