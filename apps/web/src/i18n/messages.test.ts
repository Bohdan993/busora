import { describe, expect, it } from 'vitest';
import cs from '../../messages/cs.json';
import en from '../../messages/en.json';
import uk from '../../messages/uk.json';

// Every leaf path, with array lengths, e.g. "rulesPage.sections.tickets.items[4]"
function shapeOf(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return [
      `${path}[${value.length}]`,
      ...value.flatMap((item, i) => shapeOf(item, `${path}[${i}]`))
    ];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      shapeOf(child, path ? `${path}.${key}` : key)
    );
  }
  return [path];
}

describe('messages', () => {
  it.each([
    ['uk', uk],
    ['cs', cs]
  ])('%s has exactly the same keys as en', (_, messages) => {
    expect(shapeOf(messages).sort()).toEqual(shapeOf(en).sort());
  });

  it('has no empty strings', () => {
    for (const messages of [en, uk, cs]) {
      const empty = shapeOf(messages).filter((path) => {
        const value = path
          .split(/\.|\[(\d+)\]/)
          .filter(Boolean)
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown>)?.[key],
            messages
          );
        return value === '';
      });
      expect(empty).toEqual([]);
    }
  });
});
