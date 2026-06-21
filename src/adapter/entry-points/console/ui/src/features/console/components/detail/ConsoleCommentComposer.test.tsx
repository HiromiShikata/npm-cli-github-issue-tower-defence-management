import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleComment } from '../../logic/types';
import { ConsoleCommentComposer } from './ConsoleCommentComposer';

jest.mock('../../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

const now = Date.parse('2026-06-19T12:00:00.000Z');

describe('ConsoleCommentComposer', () => {
  it('opens the form by default for an issue item', () => {
    const { getByPlaceholderText } = render(
      <ConsoleCommentComposer
        isPr={false}
        now={now}
        onSubmit={async (body) => ({
          author: 'HiromiShikata',
          body,
          createdAt: '2026-06-19T11:58:00.000Z',
        })}
      />,
    );
    expect(getByPlaceholderText('Leave a comment…')).toBeInTheDocument();
  });

  it('keeps the form closed by default for a pull request item', () => {
    const { queryByPlaceholderText, getByText } = render(
      <ConsoleCommentComposer
        isPr
        now={now}
        onSubmit={async (body) => ({
          author: 'HiromiShikata',
          body,
          createdAt: '2026-06-19T11:58:00.000Z',
        })}
      />,
    );
    expect(queryByPlaceholderText('Leave a comment…')).toBeNull();
    expect(getByText('💬 Add a comment')).toBeInTheDocument();
  });

  it('submits the comment and shows the posted comment', async () => {
    const onSubmit = jest.fn(
      async (body: string): Promise<ConsoleComment> => ({
        author: 'HiromiShikata',
        body,
        createdAt: '2026-06-19T11:58:00.000Z',
      }),
    );
    const { getByPlaceholderText, getByText } = render(
      <ConsoleCommentComposer isPr={false} now={now} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Looks good after the rebase.' },
    });
    fireEvent.click(getByText('Comment'));
    await waitFor(() => {
      expect(getByText('Looks good after the rebase.')).toBeInTheDocument();
    });
    expect(onSubmit).toHaveBeenCalledWith('Looks good after the rebase.');
  });

  it('shows a failure message when the submission rejects', async () => {
    const { getByPlaceholderText, getByText, findByRole } = render(
      <ConsoleCommentComposer
        isPr={false}
        now={now}
        onSubmit={async () => {
          throw new Error('HTTP 500');
        }}
      />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'This should fail to post.' },
    });
    fireEvent.click(getByText('Comment'));
    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('HTTP 500');
  });
});
