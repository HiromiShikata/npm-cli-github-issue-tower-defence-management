import DOMPurify from 'dompurify';
import mermaid from 'mermaid';
import { MERMAID_FENCE_SELECTOR } from './markdown';

let mermaidInitialized = false;
let mermaidSequence = 0;

const initializeMermaidOnce = (): void => {
  if (mermaidInitialized) {
    return;
  }
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
  mermaidInitialized = true;
};

const sanitizeSvg = (svg: string): string =>
  DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['foreignObject'],
  });

export const renderMermaidToSafeSvg = async (
  source: string,
): Promise<string> => {
  initializeMermaidOnce();
  mermaidSequence += 1;
  const id = `console-mermaid-${mermaidSequence}`;
  const { svg } = await mermaid.render(id, source);
  return sanitizeSvg(svg);
};

export const renderMermaidFencesIn = async (
  container: HTMLElement,
): Promise<void> => {
  const blocks = container.querySelectorAll<HTMLElement>(
    MERMAID_FENCE_SELECTOR,
  );
  for (const block of Array.from(blocks)) {
    const host = block.closest('pre') ?? block;
    const source = block.textContent ?? '';
    if (source.trim() === '') {
      continue;
    }
    const safeSvg = await renderMermaidToSafeSvg(source);
    const wrapper = document.createElement('div');
    wrapper.className = 'console-mermaid-rendered';
    wrapper.innerHTML = safeSvg;
    host.replaceWith(wrapper);
  }
};
