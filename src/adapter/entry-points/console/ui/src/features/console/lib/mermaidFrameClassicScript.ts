export const toClassicMermaidFrameHtml = (html: string): string =>
  html.replace(/<script\b([^>]*)>/g, (tag: string, attributes: string) => {
    if (!/\stype="module"/.test(attributes)) {
      return tag;
    }
    const classicAttributes = attributes
      .replace(/\stype="module"/, '')
      .replace(/\scrossorigin(="[^"]*")?/, '');
    return `<script${classicAttributes}>`;
  });
