/**
 * رندرکننده کوچک markdown دست‌ساز (بدون پکیج خارجی).
 * پشتیبانی: هدینگ ۱ تا ۴، پاراگراف، bold، italic، کد درون‌خطی، لیست مرتب/نامرتب،
 * لینک، تصویر، نقل‌قول (blockquote) و خط افقی.
 *
 * امنیت: هر متن پیش از درج در HTML escape می‌شود و تگ‌ها فقط توسط خودِ این فایل تولید
 * می‌شوند (whitelist ضمنی)؛ آدرس‌ها هم فقط طرح‌های مجاز می‌پذیرند.
 */

const SAFE_URL = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function safeUrl(raw: string) {
  const url = raw.trim();
  return SAFE_URL.test(url) ? url : '';
}

function inline(raw: string) {
  let text = escapeHtml(raw);

  // کد درون‌خطی
  text = text.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);

  // تصویر ![alt](src "عنوان")
  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]+)&quot;)?\)/g,
    (_m, alt: string, src: string, title?: string) => {
      const url = safeUrl(src);
      if (!url) return alt;
      const t = title ? ` title="${title}"` : '';
      return `<img src="${url}" alt="${alt}"${t} loading="lazy" />`;
    },
  );

  // لینک [متن](href)
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const url = safeUrl(href);
    if (!url) return label;
    const external = /^https?:\/\//i.test(url);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer nofollow"' : ' rel="noopener"';
    return `<a href="${url}"${attrs}>${label}</a>`;
  });

  // bold سپس italic
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  return text;
}

const ALLOWED_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'strong',
  'em',
  'code',
  'pre',
  'a',
  'img',
  'hr',
  'br',
]);

/**
 * لایه دوم دفاع: هر تگی که در whitelist نیست (مثلاً از ورودی خام HTML) خنثی می‌شود.
 * رندر بالا متن را escape می‌کند، پس این مرحله فقط احتیاط است.
 */
export function sanitizeHtml(html: string) {
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag: string) =>
    ALLOWED_TAGS.has(tag.toLowerCase()) ? match : escapeHtml(match),
  );
}

export function renderMarkdown(markdown: string): string {
  const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listType || !list.length) return;
    html.push(`<${listType}>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</${listType}>`);
    list = [];
    listType = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      html.push('<hr />');
      continue;
    }

    const quoted = /^>\s?(.*)$/.exec(trimmed);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
      continue;
    }

    const unordered = /^[-*+]\s+(.*)$/.exec(trimmed);
    const ordered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const want: 'ul' | 'ol' = unordered ? 'ul' : 'ol';
      if (listType && listType !== want) flushList();
      listType = want;
      list.push((unordered ?? ordered)![1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(trimmed);
  }

  flushAll();
  return sanitizeHtml(html.join('\n'));
}

/** خلاصه‌سازی متن markdown برای کارت‌ها و توضیح متا */
export function excerptFromMarkdown(markdown: string, max = 160) {
  const plain = (markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max).trim()}…` : plain;
}
