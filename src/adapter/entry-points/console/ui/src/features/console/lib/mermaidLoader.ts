import DOMPurify from 'dompurify';

type MermaidModule = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

declare global {
  interface Window {
    mermaid?: MermaidModule;
  }
}

export const MERMAID_SCRIPT_URL =
  'https://cdn.jsdelivr.net/npm/mermaid@10.9.6/dist/mermaid.min.js';

let mermaidPromise: Promise<MermaidModule> | null = null;
let renderSequence = 0;

const initializeMermaid = (mermaid: MermaidModule): MermaidModule => {
  mermaid.initialize({
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
  });
  return mermaid;
};

const loadMermaid = (): Promise<MermaidModule> => {
  if (mermaidPromise !== null) {
    return mermaidPromise;
  }
  if (window.mermaid !== undefined) {
    mermaidPromise = Promise.resolve(initializeMermaid(window.mermaid));
    return mermaidPromise;
  }
  mermaidPromise = new Promise<MermaidModule>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MERMAID_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.mermaid === undefined) {
        reject(new Error('mermaid failed to load'));
        return;
      }
      resolve(initializeMermaid(window.mermaid));
    };
    script.onerror = () => reject(new Error('mermaid script failed to load'));
    document.head.appendChild(script);
  });
  return mermaidPromise;
};

export const renderMermaidToSvg = async (code: string): Promise<string> => {
  const mermaid = await loadMermaid();
  renderSequence += 1;
  const id = `console-mermaid-${renderSequence}`;
  const { svg } = await mermaid.render(id, code);
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['foreignObject'],
  });
};
