import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleFetchFailureAlert } from './ConsoleFetchFailureAlert';

const meta: Meta<typeof ConsoleFetchFailureAlert> = {
  title: 'Console/ConsoleFetchFailureAlert',
  component: ConsoleFetchFailureAlert,
};

export default meta;

type Story = StoryObj<typeof ConsoleFetchFailureAlert>;

export const NoFailure: Story = {
  args: { failures: [] },
};

export const SingleFailure: Story = {
  args: {
    failures: [
      { section: 'comments', message: 'API rate limit already exceeded' },
    ],
  },
};

export const SharedCauseAcrossSections: Story = {
  args: {
    failures: [
      { section: 'item state', message: 'API rate limit already exceeded' },
      { section: 'description', message: 'API rate limit already exceeded' },
      { section: 'comments', message: 'API rate limit already exceeded' },
    ],
  },
};
