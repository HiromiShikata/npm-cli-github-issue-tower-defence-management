module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts?$': 'ts-jest',
    '^.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/(?!(ky)/)'],
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
  testPathIgnorePatterns: ['/node_modules/', '/bin/', '/dist/'],
};
