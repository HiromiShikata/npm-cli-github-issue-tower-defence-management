import { fireEvent, render } from '@testing-library/react';
import { ConsoleStoryActions } from './ConsoleStoryActions';

const options = [
  { id: '1', name: 'TDPM Console port', color: 'BLUE' as const },
  {
    id: '2',
    name: "regular / NO STORY; DON'T WORK ON THIS",
    color: 'RED' as const,
  },
  { id: '3', name: 'Move to Okinawa', color: 'PURPLE' as const },
];

describe('ConsoleStoryActions', () => {
  it('excludes no-story options', () => {
    const { getByText, queryByText } = render(
      <ConsoleStoryActions storyOptions={options} onSetStory={() => {}} />,
    );
    expect(getByText('TDPM Console port')).toBeInTheDocument();
    expect(getByText('Move to Okinawa')).toBeInTheDocument();
    expect(queryByText(/NO STORY/)).toBeNull();
  });

  it('reports the selected story option', () => {
    const onSetStory = jest.fn();
    const { getByText } = render(
      <ConsoleStoryActions storyOptions={options} onSetStory={onSetStory} />,
    );
    fireEvent.click(getByText('Move to Okinawa'));
    expect(onSetStory).toHaveBeenCalledWith(options[2]);
  });

  it('renders nothing when only no-story options exist', () => {
    const { container } = render(
      <ConsoleStoryActions storyOptions={[options[1]]} onSetStory={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
