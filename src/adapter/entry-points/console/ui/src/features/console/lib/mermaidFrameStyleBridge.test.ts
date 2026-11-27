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

  it('moves a style element swapped in with replaceChild into a stylesheet and removes the replaced node', () => {
    const host = document.createElement('div');
    const old = document.createElement('span');
    host.appendChild(old);
    const style = document.createElement('style');
    style.textContent = '.r{}';
    const returned = host.replaceChild(style, old);
    expect(returned).toBe(old);
    expect(sheets).toEqual(['.r{}']);
    expect(host.contains(old)).toBe(false);
    expect(host.querySelector('style')).toBeNull();
  });

  it('keeps an ordinary node swapped in with replaceChild in place', () => {
    const host = document.createElement('div');
    const old = document.createElement('span');
    host.appendChild(old);
    const replacement = document.createElement('em');
    host.replaceChild(replacement, old);
    expect(host.firstElementChild).toBe(replacement);
    expect(sheets).toEqual([]);
  });

  it('assigns text to a style element through innerHTML without making a stylesheet from the markup', () => {
    const style = document.createElement('style');
    style.innerHTML = '.s{}';
    expect(style.textContent).toBe('.s{}');
    expect(sheets).toEqual([]);
  });

  it('never runs script elements assigned through innerHTML', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    (window as unknown as { bridgeRan?: boolean }).bridgeRan = undefined;
    host.innerHTML = '<script>window.bridgeRan = true;</script><p>kept</p>';
    expect(
      (window as unknown as { bridgeRan?: boolean }).bridgeRan,
    ).toBeUndefined();
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('p')?.textContent).toBe('kept');
    host.remove();
  });

  it('clears the element when null is assigned through innerHTML, as the native setter does', () => {
    const host = document.createElement('div');
    host.innerHTML = '<p>old</p>';
    host.innerHTML = null as unknown as string;
    expect(host.childNodes.length).toBe(0);
    expect(host.textContent).toBe('');
  });

  it('moves a style element inside a fragment appended to the page into a stylesheet', () => {
    const host = document.createElement('div');
    const fragment = document.createDocumentFragment();
    const style = document.createElement('style');
    style.textContent = '.f{}';
    const paragraph = document.createElement('p');
    fragment.append(style, paragraph);
    host.appendChild(fragment);
    expect(sheets).toEqual(['.f{}']);
    expect(host.querySelector('style')).toBeNull();
    expect(host.querySelector('p')).toBe(paragraph);
  });

  it('throws the native error for a reference node that is not a child, and inserts nothing', () => {
    const host = document.createElement('div');
    const stranger = document.createElement('span');
    const style = document.createElement('style');
    style.textContent = '.x{}';
    expect(() => host.insertBefore(style, stranger)).toThrow();
    expect(sheets).toEqual([]);
  });

  it('moves an attached style element out of its old place into a stylesheet', () => {
    const oldHost = document.createElement('div');
    const style = document.createElement('style');
    style.textContent = '.m{}';
    oldHost.append(style);
    expect(oldHost.contains(style)).toBe(true);
    const newHost = document.createElement('div');
    newHost.appendChild(style);
    expect(sheets).toEqual(['.m{}']);
    expect(oldHost.contains(style)).toBe(false);
    expect(newHost.querySelector('style')).toBeNull();
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
