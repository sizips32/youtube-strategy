import { describe, it, expect } from 'vitest';
import { classifyEntityLayer } from './layerClassification';

describe('classifyEntityLayer', () => {
  it('prioritizes filePath for inbox', () => {
    expect(
      classifyEntityLayer({ id: '1', type: 'x', title: 't', filePath: '0_INBOX/foo.md' } as any)
    ).toBe('inbox');
  });

  it('falls back to type keywords', () => {
    expect(
      classifyEntityLayer({ id: '2', type: '📚 개념노트', title: 't' } as any)
    ).toBe('semantic');
  });
});


