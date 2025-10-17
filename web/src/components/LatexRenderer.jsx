
import React from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

// Renders a string with $$...$$ as block math and $...$ as inline math
export default function LatexRenderer({ children }) {
  if (typeof children !== 'string') return <>{children}</>;

  // Regex to match $$...$$ (block) or $...$ (inline), non-greedy
  const regex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push(children.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('$$')) {
      parts.push(<BlockMath key={key++}>{token.slice(2, -2)}</BlockMath>);
    } else if (token.startsWith('$')) {
      // Add a small non-breaking space before and after inline math to prevent touching text
      parts.push(<React.Fragment key={key++}>{'\u00A0'}<InlineMath>{token.slice(1, -1)}</InlineMath>{'\u00A0'}</React.Fragment>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex));
  }
  return <>{parts}</>;
}
