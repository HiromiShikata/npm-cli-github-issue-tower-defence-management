import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { buildImageProxyUrl } from '../api/client';

type MarkdownRendererProps = {
  content: string;
  repo: string;
};

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];

const isVideoUrl = (src: string): boolean =>
  VIDEO_EXTENSIONS.some((ext) => src.toLowerCase().endsWith(ext));

const isPrivateGithubImage = (src: string): boolean =>
  src.startsWith('https://private-user-images.githubusercontent.com/');

export const MarkdownRenderer = ({ content }: { content: string }): React.JSX.Element => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeHighlight, rehypeRaw]}
    components={{
      img(props) {
        const src = props.src ?? '';
        if (isVideoUrl(src)) {
          const resolvedSrc = isPrivateGithubImage(src) ? buildImageProxyUrl(src) : src;
          return <video src={resolvedSrc} controls style={{ maxWidth: '100%' }} />;
        }
        const resolvedSrc = isPrivateGithubImage(src) ? buildImageProxyUrl(src) : src;
        return <img src={resolvedSrc} alt={props.alt ?? ''} style={{ maxWidth: '100%' }} />;
      },
      video(props) {
        return <video src={props.src} controls style={{ maxWidth: '100%' }} />;
      },
      a(props) {
        return (
          <a href={props.href} target="_blank" rel="noopener noreferrer">
            {props.children}
          </a>
        );
      },
    }}
  >
    {content}
  </ReactMarkdown>
);

export const MarkdownRendererWithRepo = ({ content }: MarkdownRendererProps): React.JSX.Element => (
  <MarkdownRenderer content={content} />
);
