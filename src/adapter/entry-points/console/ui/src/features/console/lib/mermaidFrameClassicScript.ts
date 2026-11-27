export const toClassicMermaidFrameHtml = (html: string): string =>
  html.replace(/<script\b([^>]*)>/gi, (tag: string, attributes: string) => {
    if (!/\stype="module"/i.test(attributes)) {
      return tag;
    }
    const classicAttributes = attributes
      .replace(/\stype="module"/i, '')
      .replace(/\scrossorigin(="[^"]*")?/i, '');
    return `<script${classicAttributes}>`;
  });
