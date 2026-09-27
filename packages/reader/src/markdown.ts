import MarkdownIt from 'markdown-it';

/**
 * Chapter Markdown → HTML with the same element classes the website's ReaderPage gives
 * its ReactMarkdown components, so both readers paginate the same DOM shape.
 */
const CLASSES: Record<string, string> = {
  h1: 'text-3xl font-bold text-center mt-8 mb-6',
  h2: 'text-2xl font-bold text-center mt-8 mb-4',
  h3: 'text-xl font-semibold text-center mt-6 mb-3',
  h4: 'text-lg font-semibold mt-4 mb-2',
  p: 'mb-4',
  blockquote: 'border-l-2 border-current/30 pl-4 my-4 italic opacity-80',
  hr: 'my-8 border-current/20',
  ul: 'list-disc pl-6 mb-4',
  ol: 'list-decimal pl-6 mb-4',
  li: 'mb-1',
};

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

function addClass(tokenType: string, tag: string) {
  const original = md.renderer.rules[tokenType];
  md.renderer.rules[tokenType] = (tokens, idx, options, env, self) => {
    const cls = CLASSES[tag];
    if (cls) tokens[idx].attrJoin('class', cls);
    return original ? original(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
  };
}

for (const [rule, tag] of Object.entries({
  paragraph_open: 'p', blockquote_open: 'blockquote', hr: 'hr', bullet_list_open: 'ul', ordered_list_open: 'ol', list_item_open: 'li',
})) {
  addClass(rule, tag);
}
const headingOpen = md.renderer.rules.heading_open;
md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const cls = CLASSES[tokens[idx].tag];
  if (cls) tokens[idx].attrJoin('class', cls);
  return headingOpen ? headingOpen(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
};

export function renderChapterHtml(markdown: string): string {
  return md.render(markdown || '');
}
