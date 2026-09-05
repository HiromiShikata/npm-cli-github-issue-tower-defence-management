import { fireEvent, render, screen } from '@testing-library/react';
import { ConsoleStorySelectActions } from './ConsoleStorySelectActions';

const storyOptions = [
  { id: 'story_1', name: 'regular / workflow improvement', color: 'BLUE' as const },
  { id: 'story_2', name: 'regular / high priority', color: 'RED' as const },
];

describe('ConsoleStorySelectActions', () => {
  it('renders null when storyOptions is empty', () => {
    const { container } = render(
      <ConsoleStorySelectActions
        storyOptions={[]}
        currentStoryName={null}
        onSetStory={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a select with story options', () => {
    render(
      <ConsoleStorySelectActions
        storyOptions={storyOptions}
        currentStoryName={null}
        onSetStory={jest.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Set story' })).toBeInTheDocument();
    expect(screen.getByText('regular / workflow improvement')).toBeInTheDocument();
    expect(screen.getByText('regular / high priority')).toBeInTheDocument();
  });

  it('pre-selects the current story by name', () => {
    render(
      <ConsoleStorySelectActions
        storyOptions={storyOptions}
        currentStoryName="regular / high priority"
        onSetStory={jest.fn()}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Set story' }) as HTMLSelectElement;
    expect(select.value).toBe('story_2');
  });

  it('calls onSetStory when a different option is chosen', () => {
    const onSetStory = jest.fn();
    render(
      <ConsoleStorySelectActions
        storyOptions={storyOptions}
        currentStoryName={null}
        onSetStory={onSetStory}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Set story' });
    fireEvent.change(select, { target: { value: 'story_1' } });
    expect(onSetStory).toHaveBeenCalledWith(storyOptions[0]);
  });

  it('does not call onSetStory when the same option is re-selected', () => {
    const onSetStory = jest.fn();
    render(
      <ConsoleStorySelectActions
        storyOptions={storyOptions}
        currentStoryName="regular / workflow improvement"
        onSetStory={onSetStory}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Set story' });
    fireEvent.change(select, { target: { value: 'story_1' } });
    expect(onSetStory).not.toHaveBeenCalled();
  });
});
