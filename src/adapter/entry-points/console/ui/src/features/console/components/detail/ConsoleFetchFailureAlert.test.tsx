import { render } from '@testing-library/react';
import { ConsoleFetchFailureAlert } from './ConsoleFetchFailureAlert';

describe('ConsoleFetchFailureAlert', () => {
  it('renders nothing when no read failed', () => {
    const { container, queryByRole } = render(
      <ConsoleFetchFailureAlert failures={[]} />,
    );
    expect(queryByRole('alert')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps several failed sections inside one alert', () => {
    const { getAllByRole, getByRole } = render(
      <ConsoleFetchFailureAlert
        failures={[
          { section: 'item state', message: 'API rate limit already exceeded' },
          {
            section: 'description',
            message: 'API rate limit already exceeded',
          },
          { section: 'comments', message: 'API rate limit already exceeded' },
        ]}
      />,
    );
    expect(getAllByRole('alert')).toHaveLength(1);
    expect(getAllByRole('listitem')).toHaveLength(3);
    expect(getByRole('alert')).toHaveTextContent(
      'Failed to load item state: API rate limit already exceeded',
    );
    expect(getByRole('alert')).toHaveTextContent(
      'Failed to load description: API rate limit already exceeded',
    );
    expect(getByRole('alert')).toHaveTextContent(
      'Failed to load comments: API rate limit already exceeded',
    );
  });
});
