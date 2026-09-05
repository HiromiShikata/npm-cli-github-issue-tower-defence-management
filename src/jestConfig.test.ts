import { readFileSync } from 'fs';
import { join } from 'path';

const readMaxWorkers = (): number => {
  const content = readFileSync(join(__dirname, '..', 'jest.config.js'), 'utf8');
  const match = content.match(/\bmaxWorkers\s*:\s*(\d+)/);
  if (match === null) {
    throw new Error('jest.config.js does not declare maxWorkers');
  }
  return Number(match[1]);
};

describe('jest config', () => {
  it('caps maxWorkers to 4 to prevent OOM under concurrent workspace preparations', () => {
    expect(readMaxWorkers()).toBe(4);
  });
});
