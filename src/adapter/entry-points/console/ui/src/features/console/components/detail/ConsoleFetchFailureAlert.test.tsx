import { render } from '@testing-library/react';
import { ConsoleFetchFailureAlert } from './ConsoleFetchFailureAlert';

const rateLimit = 'API rate limit already exceeded';

describe('ConsoleFetchFailureAlert', () => {
  it('renders nothing when no read failed', () => {
    const { container, queryByRole } = render(
      <ConsoleFetchFailureAlert failures={[]} />,
    );
    expect(queryByRole('alert')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('states one section on its own when only that read failed', () => {
    const { getByRole } = render(
      <ConsoleFetchFailureAlert
        failures={[{ section: 'comments', message: rateLimit }]}
      />,
    );
    expect(getByRole('alert')).toHaveTextContent(
      `Failed to load comments: ${rateLimit}`,
    );
  });

  it('names every section of one shared cause on a single line', () => {
    const { getAllByRole, getByRole } = render(
      <ConsoleFetchFailureAlert
        failures={[
          { section: 'item state', message: rateLimit },
          { section: 'description', message: rateLimit },
          { section: 'comments', message: rateLimit },
        ]}
      />,
    );
    expect(getAllByRole('alert')).toHaveLength(1);
    expect(getByRole('alert').querySelectorAll('p')).toHaveLength(1);
    expect(getByRole('alert')).toHaveTextContent(
      `Failed to load item state, description and comments: ${rateLimit}`,
    );
  });

  it('keeps distinct causes on their own lines inside the one alert', () => {
    const { getAllByRole, getByRole } = render(
      <ConsoleFetchFailureAlert
        failures={[
          { section: 'item state', message: rateLimit },
          { section: 'description', message: 'HTTP 500' },
          { section: 'comments', message: rateLimit },
        ]}
      />,
    );
    expect(getAllByRole('alert')).toHaveLength(1);
    const lines = Array.from(getByRole('alert').querySelectorAll('p')).map(
      (line) => line.textContent,
    );
    expect(lines).toEqual([
      `Failed to load item state and comments: ${rateLimit}`,
      'Failed to load description: HTTP 500',
    ]);
  });
});
