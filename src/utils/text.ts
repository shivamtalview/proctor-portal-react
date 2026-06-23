import type { ReactNode } from 'react';

const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu;

export function stripEmojis(text: string): string {
  return text.replace(emojiPattern, '').replace(/\s{2,}/g, ' ').trim();
}

export function stripEmojisFromNode(node: ReactNode): ReactNode {
  if (typeof node === 'string') {
    return stripEmojis(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => stripEmojisFromNode(child));
  }

  return node;
}
