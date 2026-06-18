import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { consoleStoryOptionsFixture } from '../fixtures';
import { ConsoleStoryButtonGroup } from './ConsoleStoryButtonGroup';

describe('ConsoleStoryButtonGroup', () => {
  it('excludes the no-story option from the assignable buttons', () => {
    render(
      <ConsoleStoryButtonGroup
        storyOptions={consoleStoryOptionsFixture}
        onSetStory={() => undefined}
      />,
    );
    expect(screen.queryByText('No story')).toBeNull();
    expect(screen.getByText('TDPM Console port')).toBeInTheDocument();
  });

  it('invokes onSetStory with the chosen option', async () => {
    const onSetStory = jest.fn();
    render(
      <ConsoleStoryButtonGroup
        storyOptions={consoleStoryOptionsFixture}
        onSetStory={onSetStory}
      />,
    );
    await userEvent.click(screen.getByText('TDPM Console port'));
    expect(onSetStory).toHaveBeenCalledWith(consoleStoryOptionsFixture[1]);
  });

  it('renders nothing when only the no-story option is available', () => {
    const { container } = render(
      <ConsoleStoryButtonGroup
        storyOptions={[consoleStoryOptionsFixture[0]]}
        onSetStory={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
