
import React, { Suspense } from 'react';
const BlockMath = React.lazy(() => import('react-katex').then(m => ({ default: m.BlockMath })));
const InlineMath = React.lazy(() => import('react-katex').then(m => ({ default: m.InlineMath })));
// CSS import remains static so fonts/styles are available when component loads
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
      parts.push(
        <Suspense fallback={<span key={key++}>[math]</span>}>
          <BlockMath key={key++}>{token.slice(2, -2)}</BlockMath>
        </Suspense>
      );
    } else if (token.startsWith('$')) {
      // Render inline math with minimal extra spacing
      parts.push(
        <Suspense fallback={<span key={key++}>[math]</span>}>
          <InlineMath key={key++}>{token.slice(1, -1)}</InlineMath>
        </Suspense>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex));
  }
  return <>{parts}</>;
}
