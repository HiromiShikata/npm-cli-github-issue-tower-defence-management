export type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

declare global {
  interface Window {
    mermaid?: MermaidApi;
  }
}

export const MERMAID_SCRIPT_URL =
  'https://cdn.jsdelivr.net/npm/mermaid@10.9.6/dist/mermaid.min.js';

const MERMAID_INITIALIZE_CONFIG = {
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'dark',
  themeVariables: {
    background: '#0d1117',
    primaryColor: '#161b22',
    primaryTextColor: '#e6edf3',
    primaryBorderColor: '#30363d',
    lineColor: '#8b949e',
    fontSize: '14px',
  },
};

export type MermaidLoaderEnvironment = {
  createScript: () => HTMLScriptElement;
  appendScript: (script: HTMLScriptElement) => void;
  readMermaid: () => MermaidApi | undefined;
};

export const loadMermaidApi = (
  environment: MermaidLoaderEnvironment,
): Promise<MermaidApi> =>
  new Promise<MermaidApi>((resolve, reject) => {
    const script = environment.createScript();
    script.src = MERMAID_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const mermaid = environment.readMermaid();
      if (mermaid === undefined) {
        reject(new Error('mermaid failed to load'));
        return;
      }
      mermaid.initialize(MERMAID_INITIALIZE_CONFIG);
      resolve(mermaid);
    };
    script.onerror = () => reject(new Error('mermaid script failed to load'));
    environment.appendScript(script);
  });
