import { computeListContinuation } from './listContinuation';

describe('computeListContinuation', () => {
  it.each([
    {
      description:
        'continues a plain unordered list item with the same marker when Enter is pressed at the end of its text',
      value: '- first item',
      selectionStart: '- first item'.length,
      selectionEnd: '- first item'.length,
      expected: {
        handled: true,
        value: '- first item\n- ',
        cursorPosition: '- first item\n- '.length,
      },
    },
    {
      description:
        'continues an ordered list item using the "." separator and increments the number by one',
      value: '3. third item',
      selectionStart: '3. third item'.length,
      selectionEnd: '3. third item'.length,
      expected: {
        handled: true,
        value: '3. third item\n4. ',
        cursorPosition: '3. third item\n4. '.length,
      },
    },
    {
      description:
        'continues an ordered list item using the ")" separator and increments the number by one',
      value: '3) third item',
      selectionStart: '3) third item'.length,
      selectionEnd: '3) third item'.length,
      expected: {
        handled: true,
        value: '3) third item\n4) ',
        cursorPosition: '3) third item\n4) '.length,
      },
    },
    {
      description:
        'continues an unchecked task-list item with a new unchecked task-list item',
      value: '- [ ] a task',
      selectionStart: '- [ ] a task'.length,
      selectionEnd: '- [ ] a task'.length,
      expected: {
        handled: true,
        value: '- [ ] a task\n- [ ] ',
        cursorPosition: '- [ ] a task\n- [ ] '.length,
      },
    },
    {
      description:
        'continues a lowercase-checked task-list item with a new item that is always unchecked',
      value: '- [x] done item',
      selectionStart: '- [x] done item'.length,
      selectionEnd: '- [x] done item'.length,
      expected: {
        handled: true,
        value: '- [x] done item\n- [ ] ',
        cursorPosition: '- [x] done item\n- [ ] '.length,
      },
    },
    {
      description:
        'continues an uppercase-checked task-list item with a new item that is always unchecked',
      value: '- [X] done item',
      selectionStart: '- [X] done item'.length,
      selectionEnd: '- [X] done item'.length,
      expected: {
        handled: true,
        value: '- [X] done item\n- [ ] ',
        cursorPosition: '- [X] done item\n- [ ] '.length,
      },
    },
    {
      description:
        'exits an unordered list by replacing an empty marker-only line with a markerless empty line',
      value: '- ',
      selectionStart: '- '.length,
      selectionEnd: '- '.length,
      expected: { handled: true, value: '', cursorPosition: 0 },
    },
    {
      description:
        'exits an ordered list by replacing an empty marker-only line with a markerless empty line',
      value: '3. ',
      selectionStart: '3. '.length,
      selectionEnd: '3. '.length,
      expected: { handled: true, value: '', cursorPosition: 0 },
    },
    {
      description:
        'exits a task list by replacing an empty marker-only line with a markerless empty line',
      value: '- [ ] ',
      selectionStart: '- [ ] '.length,
      selectionEnd: '- [ ] '.length,
      expected: { handled: true, value: '', cursorPosition: 0 },
    },
    {
      description:
        'splits a list item mid-line, leaving text before the cursor on the original line and moving the rest to the new marker line',
      value: '- first item second part',
      selectionStart: '- first item '.length,
      selectionEnd: '- first item '.length,
      expected: {
        handled: true,
        value: '- first item \n- second part',
        cursorPosition: '- first item \n- '.length,
      },
    },
    {
      description:
        'duplicates the two-space indentation on the new line of a nested list item',
      value: '  - nested item',
      selectionStart: '  - nested item'.length,
      selectionEnd: '  - nested item'.length,
      expected: {
        handled: true,
        value: '  - nested item\n  - ',
        cursorPosition: '  - nested item\n  - '.length,
      },
    },
    {
      description:
        'inserts the renumbered continuation line between the split line and the next line, leaving the following lines unchanged',
      value: '1. a\n2. b\n3. c',
      selectionStart: '1. a'.length,
      selectionEnd: '1. a'.length,
      expected: {
        handled: true,
        value: '1. a\n2. \n2. b\n3. c',
        cursorPosition: '1. a\n2. '.length,
      },
    },
    {
      description:
        'inserts an ordinary newline when the line has no recognizable list marker at all',
      value: 'plain text',
      selectionStart: 'plain text'.length,
      selectionEnd: 'plain text'.length,
      expected: { handled: false },
    },
    {
      description:
        'inserts an ordinary newline when the cursor sits before the end of the marker prefix',
      value: '- first item',
      selectionStart: '-'.length,
      selectionEnd: '-'.length,
      expected: { handled: false },
    },
    {
      description:
        'deletes a non-collapsed selection first, then continues the list from the resulting collapsed cursor position',
      value: '- first item',
      selectionStart: '- first item'.indexOf('item'),
      selectionEnd: '- first item'.length,
      expected: {
        handled: true,
        value: '- first \n- ',
        cursorPosition: '- first \n- '.length,
      },
    },
    {
      description:
        'inserts an ordinary newline when two spaces follow the unordered marker instead of exactly one',
      value: '-  first item',
      selectionStart: '-  first item'.length,
      selectionEnd: '-  first item'.length,
      expected: { handled: false },
    },
  ])('$description', ({ value, selectionStart, selectionEnd, expected }) => {
    expect(computeListContinuation(value, selectionStart, selectionEnd)).toEqual(
      expected,
    );
  });

  it.each([
    {
      description:
        'FR-001: recognizes an unordered marker followed by exactly one space',
      value: '- x',
      selectionStart: '- x'.length,
      selectionEnd: '- x'.length,
      expected: {
        handled: true,
        value: '- x\n- ',
        cursorPosition: '- x\n- '.length,
      },
    },
    {
      description:
        'FR-001: does not recognize an unordered marker followed by zero spaces',
      value: '-item',
      selectionStart: '-item'.length,
      selectionEnd: '-item'.length,
      expected: { handled: false },
    },
    {
      description:
        'FR-001: does not recognize an unordered marker followed by two spaces',
      value: '-  item',
      selectionStart: '-  item'.length,
      selectionEnd: '-  item'.length,
      expected: { handled: false },
    },
    {
      description:
        'FR-001: recognizes an ordered "." marker followed by exactly one space',
      value: '1. x',
      selectionStart: '1. x'.length,
      selectionEnd: '1. x'.length,
      expected: {
        handled: true,
        value: '1. x\n2. ',
        cursorPosition: '1. x\n2. '.length,
      },
    },
    {
      description:
        'FR-001: does not recognize an ordered "." marker followed by zero spaces',
      value: '1.item',
      selectionStart: '1.item'.length,
      selectionEnd: '1.item'.length,
      expected: { handled: false },
    },
    {
      description:
        'FR-001: does not recognize an ordered "." marker followed by two spaces',
      value: '1.  item',
      selectionStart: '1.  item'.length,
      selectionEnd: '1.  item'.length,
      expected: { handled: false },
    },
    {
      description:
        'FR-001: recognizes an ordered ")" marker followed by exactly one space',
      value: '1) x',
      selectionStart: '1) x'.length,
      selectionEnd: '1) x'.length,
      expected: {
        handled: true,
        value: '1) x\n2) ',
        cursorPosition: '1) x\n2) '.length,
      },
    },
    {
      description:
        'FR-001: does not recognize an ordered ")" marker followed by zero spaces',
      value: '1)item',
      selectionStart: '1)item'.length,
      selectionEnd: '1)item'.length,
      expected: { handled: false },
    },
    {
      description:
        'FR-001: does not recognize an ordered ")" marker followed by two spaces',
      value: '1)  item',
      selectionStart: '1)  item'.length,
      selectionEnd: '1)  item'.length,
      expected: { handled: false },
    },
    {
      description:
        'FR-001: recognizes a task-list marker with exactly one space before the checkbox',
      value: '- [ ] x',
      selectionStart: '- [ ] x'.length,
      selectionEnd: '- [ ] x'.length,
      expected: {
        handled: true,
        value: '- [ ] x\n- [ ] ',
        cursorPosition: '- [ ] x\n- [ ] '.length,
      },
    },
    {
      description:
        'FR-001: does not recognize a task-list marker with zero spaces before the checkbox',
      value: '-[ ] item',
      selectionStart: '-[ ] item'.length,
      selectionEnd: '-[ ] item'.length,
      expected: { handled: false },
    },
    {
      description:
        'FR-001: does not recognize a task-list marker with two spaces before the checkbox',
      value: '-  [ ] item',
      selectionStart: '-  [ ] item'.length,
      selectionEnd: '-  [ ] item'.length,
      expected: { handled: false },
    },
  ])('$description', ({ value, selectionStart, selectionEnd, expected }) => {
    expect(computeListContinuation(value, selectionStart, selectionEnd)).toEqual(
      expected,
    );
  });

  it.each([
    {
      description: 'carries over the "*" unordered marker character to the new line',
      value: '* item',
      selectionStart: '* item'.length,
      selectionEnd: '* item'.length,
      expected: {
        handled: true,
        value: '* item\n* ',
        cursorPosition: '* item\n* '.length,
      },
    },
    {
      description: 'carries over the "+" unordered marker character to the new line',
      value: '+ item',
      selectionStart: '+ item'.length,
      selectionEnd: '+ item'.length,
      expected: {
        handled: true,
        value: '+ item\n+ ',
        cursorPosition: '+ item\n+ '.length,
      },
    },
  ])('$description', ({ value, selectionStart, selectionEnd, expected }) => {
    expect(computeListContinuation(value, selectionStart, selectionEnd)).toEqual(
      expected,
    );
  });

  it('treats a line matching the task-list form as task-list, never as plain unordered, even though its start also matches the unordered form', () => {
    const value = '- [ ] priority item';
    const result = computeListContinuation(value, value.length, value.length);
    expect(result).toEqual({
      handled: true,
      value: '- [ ] priority item\n- [ ] ',
      cursorPosition: '- [ ] priority item\n- [ ] '.length,
    });
  });
});
