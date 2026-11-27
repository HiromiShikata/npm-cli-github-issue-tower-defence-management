import { installMermaidFrameStyleBridge } from './mermaidFrameStyleBridge';

describe('installMermaidFrameStyleBridge', () => {
  let sheets: string[];
  let uninstall: () => void;

  beforeEach(() => {
    sheets = [];
    uninstall = installMermaidFrameStyleBridge((css) => {
      sheets.push(css);
    });
  });

  afterEach(() => {
    uninstall();
  });

  it('moves a style element appended to the page into a stylesheet instead of inserting it', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const style = document.createElement('style');
    style.textContent = '#d1 .actor{fill:red}';
    host.appendChild(style);
    expect(sheets).toEqual(['#d1 .actor{fill:red}']);
    expect(host.querySelector('style')).toBeNull();
    host.remove();
  });

  it('moves a style element inserted before a reference node into a stylesheet', () => {
    const host = document.createElement('div');
    const reference = document.createElement('span');
    host.appendChild(reference);
    const style = document.createElement('style');
    style.textContent = '.a{}';
    host.insertBefore(style, reference);
    expect(sheets).toEqual(['.a{}']);
    expect(host.querySelector('style')).toBeNull();
  });

  it('keeps ordinary elements and passes them through unchanged', () => {
    const host = document.createElement('div');
    const child = document.createElement('p');
    host.appendChild(child);
    expect(host.firstElementChild).toBe(child);
    expect(sheets).toEqual([]);
  });

  it('moves style elements in markup assigned through innerHTML and keeps the other nodes', () => {
    const host = document.createElement('div');
    host.innerHTML = '<style>.b{}</style><p style="color: red">text</p>';
    expect(sheets).toEqual(['.b{}']);
    expect(host.querySelector('style')).toBeNull();
    const paragraph = host.querySelector<HTMLElement>('p');
    expect(paragraph?.textContent).toBe('text');
    expect(paragraph?.style.color).toBe('red');
  });

  it('keeps template markup in the template content when assigned through innerHTML', () => {
    const template = document.createElement('template');
    template.innerHTML = '<style>.t{}</style><span>kept</span>';
    expect(sheets).toEqual([]);
    expect(template.content.querySelector('span')?.textContent).toBe('kept');
  });

  it('restores the original methods when uninstalled', () => {
    uninstall();
    const host = document.createElement('div');
    const style = document.createElement('style');
    host.appendChild(style);
    expect(host.querySelector('style')).toBe(style);
    uninstall = () => undefined;
  });
});
