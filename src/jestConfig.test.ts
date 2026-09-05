describe('jest config', () => {
  it('caps maxWorkers to 4 to prevent OOM under concurrent workspace preparations', () => {
    const config = require('../jest.config.js');
    expect(config.maxWorkers).toBe(4);
  });
});
