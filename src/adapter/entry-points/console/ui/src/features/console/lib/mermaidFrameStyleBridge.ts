export type StyleSheetSink = (cssText: string) => void;

const isStyleElement = (node: unknown): boolean =>
  node instanceof Element && node.nodeName.toUpperCase() === 'STYLE';

export const installMermaidFrameStyleBridge = (
  sink: StyleSheetSink,
): (() => void) => {
  const nodePrototype = Node.prototype;
  const elementPrototype = Element.prototype;
  const originalAppendChild = nodePrototype.appendChild;
  const originalInsertBefore = nodePrototype.insertBefore;
  const originalReplaceChild = nodePrototype.replaceChild;
  const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(
    elementPrototype,
    'innerHTML',
  );
  if (innerHtmlDescriptor?.set === undefined) {
    throw new Error('Element.innerHTML has no setter to bridge');
  }
  const originalInnerHtmlSet = innerHtmlDescriptor.set;

  const prepareFragment = (fragment: DocumentFragment): void => {
    fragment.querySelectorAll('script').forEach((script) => {
      script.remove();
    });
    fragment.querySelectorAll('style').forEach((style) => {
      sink(style.textContent ?? '');
      style.remove();
    });
  };

  const takeStyle = (node: Node): boolean => {
    if (node instanceof DocumentFragment) {
      prepareFragment(node);
      return false;
    }
    if (!isStyleElement(node)) {
      return false;
    }
    sink(node.textContent ?? '');
    return true;
  };

  nodePrototype.appendChild = function appendChildBridged<T extends Node>(
    this: Node,
    node: T,
  ): T {
    if (takeStyle(node)) {
      return node;
    }
    return originalAppendChild.call(this, node) as T;
  };
  nodePrototype.insertBefore = function insertBeforeBridged<T extends Node>(
    this: Node,
    node: T,
    reference: Node | null,
  ): T {
    if (takeStyle(node)) {
      return node;
    }
    return originalInsertBefore.call(this, node, reference) as T;
  };
  nodePrototype.replaceChild = function replaceChildBridged<T extends Node>(
    this: Node,
    node: Node,
    old: T,
  ): T {
    if (takeStyle(node)) {
      this.removeChild(old);
      return old;
    }
    return originalReplaceChild.call(this, node, old) as T;
  };
  Object.defineProperty(elementPrototype, 'innerHTML', {
    configurable: true,
    enumerable: innerHtmlDescriptor.enumerable,
    get: innerHtmlDescriptor.get,
    set(this: Element, value: string | null) {
      if (isStyleElement(this) || this.nodeName.toUpperCase() === 'TEMPLATE') {
        originalInnerHtmlSet.call(this, value);
        return;
      }
      const range = document.createRange();
      range.selectNodeContents(this);
      const fragment = range.createContextualFragment(value ?? '');
      prepareFragment(fragment);
      this.replaceChildren(fragment);
    },
  });

  return () => {
    nodePrototype.appendChild = originalAppendChild;
    nodePrototype.insertBefore = originalInsertBefore;
    nodePrototype.replaceChild = originalReplaceChild;
    Object.defineProperty(elementPrototype, 'innerHTML', innerHtmlDescriptor);
  };
};
