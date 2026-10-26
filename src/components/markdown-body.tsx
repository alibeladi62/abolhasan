import { renderMarkdown } from '@/lib/markdown';

/** بدنه مقاله: خروجی sanitizeشدهٔ رندرکنندهٔ markdown دست‌ساز */
export function MarkdownBody({ source }: { source: string }) {
  return <div className="article-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
