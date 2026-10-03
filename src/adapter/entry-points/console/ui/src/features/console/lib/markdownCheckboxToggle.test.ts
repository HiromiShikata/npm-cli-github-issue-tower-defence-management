import { renderMarkdownToSafeHtml } from './markdown';
import { toggleMarkdownCheckboxAtIndex } from './markdownCheckboxToggle';

describe('toggleMarkdownCheckboxAtIndex', () => {
  it.each([
    {
      description: 'flips a single unchecked checkbox to checked',
      source: '- [ ] Buy milk',
      checkboxIndex: 0,
      expected: '- [x] Buy milk',
    },
    {
      description: 'flips a single checked checkbox to unchecked',
      source: '- [x] Buy milk',
      checkboxIndex: 0,
      expected: '- [ ] Buy milk',
    },
    {
      description: 'flips an uppercase [X] checked checkbox to unchecked',
      source: '- [X] Done already',
      checkboxIndex: 0,
      expected: '- [ ] Done already',
    },
    {
      description:
        'flips only the targeted checkbox among several mixed checked/unchecked items, leaving the rest unchanged',
      source: '- [ ] first\n- [x] second\n- [ ] third',
      checkboxIndex: 1,
      expected: '- [ ] first\n- [ ] second\n- [ ] third',
    },
    {
      description:
        'flips the first of several mixed checkboxes, leaving later ones unchanged',
      source: '- [ ] first\n- [x] second\n- [ ] third',
      checkboxIndex: 0,
      expected: '- [x] first\n- [x] second\n- [ ] third',
    },
    {
      description:
        'flips the last of several mixed checkboxes, leaving earlier ones unchanged',
      source: '- [ ] first\n- [x] second\n- [ ] third',
      checkboxIndex: 2,
      expected: '- [ ] first\n- [x] second\n- [x] third',
    },
    {
      description:
        'counts a nested (indented) checkbox in top-to-bottom document order and flips only that one',
      source: '- [ ] Parent\n  - [ ] Child one\n  - [x] Child two',
      checkboxIndex: 1,
      expected: '- [ ] Parent\n  - [x] Child one\n  - [x] Child two',
    },
    {
      description: 'leaves surrounding non-checkbox markdown content untouched',
      source:
        '# Heading\n\nSome paragraph text.\n\n- [ ] only item\n\nTrailing text.',
      checkboxIndex: 0,
      expected:
        '# Heading\n\nSome paragraph text.\n\n- [x] only item\n\nTrailing text.',
    },
  ])('$description', ({ source, checkboxIndex, expected }) => {
    expect(toggleMarkdownCheckboxAtIndex(source, checkboxIndex)).toBe(expected);
  });

  it('ignores a checkbox-shaped line inside a backtick-fenced code block: it is not counted and not toggled', () => {
    const source =
      '- [ ] Real one\n```\n- [ ] fake one\n```\n- [ ] Another real one';
    const result = toggleMarkdownCheckboxAtIndex(source, 1);
    expect(result).toBe(
      '- [ ] Real one\n```\n- [ ] fake one\n```\n- [x] Another real one',
    );
  });

  it('ignores a checkbox-shaped line inside a tilde-fenced code block: it is not counted and not toggled', () => {
    const source =
      '- [ ] Real one\n~~~\n- [ ] fake one\n~~~\n- [ ] Another real one';
    const result = toggleMarkdownCheckboxAtIndex(source, 1);
    expect(result).toBe(
      '- [ ] Real one\n~~~\n- [ ] fake one\n~~~\n- [x] Another real one',
    );
  });

  it('does not shift the index of a real checkbox that appears before a fenced code block containing a checkbox-shaped line', () => {
    const source = '- [ ] first real\n```\n- [ ] fake\n```';
    const result = toggleMarkdownCheckboxAtIndex(source, 0);
    expect(result).toBe('- [x] first real\n```\n- [ ] fake\n```');
  });

  it('throws an Error when checkboxIndex is out of range (too large) rather than returning the source unchanged', () => {
    const source = '- [ ] only one';
    expect(() => toggleMarkdownCheckboxAtIndex(source, 5)).toThrow(Error);
  });

  it('throws an Error when checkboxIndex is negative', () => {
    const source = '- [ ] only one';
    expect(() => toggleMarkdownCheckboxAtIndex(source, -1)).toThrow(Error);
  });

  it('throws an Error when the source has no checkboxes at all', () => {
    const source = 'Just a plain paragraph with no task list items.';
    expect(() => toggleMarkdownCheckboxAtIndex(source, 0)).toThrow(Error);
  });

  it('throws an Error when checkboxIndex targets a checkbox-shaped line that only exists inside a fenced code block', () => {
    const source = '```\n- [ ] fake only\n```';
    expect(() => toggleMarkdownCheckboxAtIndex(source, 0)).toThrow(Error);
  });

  it('derives the same checkbox index order as renderMarkdownToSafeHtml, including a fenced-code-block decoy, for every index', () => {
    const source = [
      '- [ ] Alpha',
      '- [x] Beta',
      '  - [ ] Nested',
      '```',
      '- [ ] not a real checkbox',
      '```',
      '- [x] Gamma',
    ].join('\n');

    const renderedCheckedStates = (markdown: string): boolean[] => {
      const container = document.createElement('div');
      container.innerHTML = renderMarkdownToSafeHtml(markdown);
      return Array.from(
        container.querySelectorAll<HTMLInputElement>(
          'input[type="checkbox"][data-checkbox-index]',
        ),
      )
        .sort(
          (a, b) =>
            Number(a.dataset.checkboxIndex) - Number(b.dataset.checkboxIndex),
        )
        .map((el) => el.checked);
    };

    const beforeStates = renderedCheckedStates(source);
    expect(beforeStates).toEqual([false, true, false, true]);

    beforeStates.forEach((checkedBefore, checkboxIndex) => {
      const toggled = toggleMarkdownCheckboxAtIndex(source, checkboxIndex);
      const afterStates = renderedCheckedStates(toggled);
      const expectedStates = beforeStates.map((checked, index) =>
        index === checkboxIndex ? !checkedBefore : checked,
      );
      expect(afterStates).toEqual(expectedStates);
    });
  });
});
