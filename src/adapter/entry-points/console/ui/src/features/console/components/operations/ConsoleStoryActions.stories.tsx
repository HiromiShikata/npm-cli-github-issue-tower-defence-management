import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleColor, ConsoleFieldOption } from '../../logic/types';
import { consoleStoryOptionsFixture } from '../../testing/fixtures';
import { ConsoleStoryActions } from './ConsoleStoryActions';

const manyStoryNames: string[] = [
  'TDPM Console port',
  'Publish product documentation site',
  'Move to Okinawa',
  'regular / workflow improvement',
  'regular / regular payment invoice tax',
  'regular / WORKFLOW BLOCKER',
  'Console triage screen redesign',
  'Console detail panel performance',
  'Console keyboard shortcut support',
  'Console story color source refactor',
  'Console list pagination',
  'Console tab badge accuracy',
  'Console auto-advance on empty tab',
  'Console e2e Playwright coverage',
  'serveConsole per-project path support',
  'serveConsole authentication token rotation',
  'Project field mutation batching',
  'Issue cache freshness monitoring',
  'Preparation daemon restart resilience',
  'Reactivation trigger field cleanup',
  'Depended issue URL cross-project guard',
  'Auto status check rejection reporting',
  'Story prefix-match invariant validation',
  'Duplicate story issue cleanup tooling',
  'Quality gate criteria documentation',
  'CI failure handling automation',
  'Pull request handover review gate',
  'Workspace worktree isolation',
  'Local development investigation guide',
  'Figma design export integration',
  'Frontend web UI design policy audit',
  'Backend API design policy audit',
  'Email sender identity verification',
  'Schedule management calendar sync',
  'Resume update automation',
];

const manyAssignableStoriesFixture: ConsoleFieldOption[] = manyStoryNames.map(
  (name, index) => {
    const colors: ConsoleColor[] = [
      'GRAY',
      'BLUE',
      'GREEN',
      'YELLOW',
      'ORANGE',
      'RED',
      'PINK',
      'PURPLE',
    ];
    return {
      id: `many-story-${index}`,
      name,
      color: colors[index % colors.length],
    };
  },
);

const meta: Meta<typeof ConsoleStoryActions> = {
  title: 'Console/ConsoleStoryActions',
  component: ConsoleStoryActions,
  args: { onSetStory: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryActions>;

export const AssignableStories: Story = {
  args: { storyOptions: consoleStoryOptionsFixture },
};

export const ManyAssignableStories: Story = {
  args: { storyOptions: manyAssignableStoriesFixture },
};
