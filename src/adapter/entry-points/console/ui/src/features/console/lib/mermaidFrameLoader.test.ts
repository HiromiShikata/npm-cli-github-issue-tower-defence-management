import {
  loadMermaidApi,
  MERMAID_SCRIPT_URL,
  type MermaidApi,
} from './mermaidFrameLoader';

const buildEnvironment = (mermaid: MermaidApi | undefined) => {
  const appended: HTMLScriptElement[] = [];
  return {
    appended,
    environment: {
      createScript: () => document.createElement('script'),
      appendScript: (script: HTMLScriptElement) => {
        appended.push(script);
      },
      readMermaid: () => mermaid,
    },
  };
};

describe('loadMermaidApi', () => {
  it('loads the pinned script and initializes mermaid in strict mode once it loads', async () => {
    const initialize = jest.fn();
    const render = jest.fn();
    const { appended, environment } = buildEnvironment({
      initialize,
      render,
    });
    const loading = loadMermaidApi(environment);
    expect(appended).toHaveLength(1);
    expect(appended[0].src).toBe(MERMAID_SCRIPT_URL);
    appended[0].dispatchEvent(new Event('load'));
    const mermaid = await loading;
    expect(mermaid.render).toBe(render);
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: 'strict', startOnLoad: false }),
    );
  });

  it('rejects when the script loads but no mermaid api is present', async () => {
    const { appended, environment } = buildEnvironment(undefined);
    const loading = loadMermaidApi(environment);
    appended[0].dispatchEvent(new Event('load'));
    await expect(loading).rejects.toThrow('mermaid failed to load');
  });

  it('rejects when the script itself fails to load', async () => {
    const { appended, environment } = buildEnvironment(undefined);
    const loading = loadMermaidApi(environment);
    appended[0].dispatchEvent(new Event('error'));
    await expect(loading).rejects.toThrow('mermaid script failed to load');
  });
});
