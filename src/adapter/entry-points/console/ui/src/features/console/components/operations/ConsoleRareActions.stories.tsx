import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ConsoleRareActions } from './ConsoleRareActions';

const dependedIssueUrl =
  'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/845';

type CanvasQueries = ReturnType<typeof within>;

const toggleRareActions = async (canvas: CanvasQueries): Promise<void> => {
  await userEvent.click(canvas.getByTitle('Rare actions'));
};

const typeDependedIssueUrl = async (canvas: CanvasQueries): Promise<void> => {
  await userEvent.type(
    canvas.getByPlaceholderText('Depended issue URL'),
    dependedIssueUrl,
  );
};

const pressSetDependedIssue = async (canvas: CanvasQueries): Promise<void> => {
  await userEvent.click(
    canvas.getByRole('button', { name: 'Set Depended Issue' }),
  );
};

const meta: Meta<typeof ConsoleRareActions> = {
  title: 'Console/ConsoleRareActions',
  component: ConsoleRareActions,
};

export default meta;

type Story = StoryObj<typeof ConsoleRareActions>;

export const WithDependedIssueUrl: Story = {
  args: {
    onSetDependedIssueUrl: async () => {},
  },
};

export const Disabled: Story = {
  args: {
    onSetDependedIssueUrl: null,
  },
};

export const FieldShown: Story = {
  args: {
    onSetDependedIssueUrl: async () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toggleRareActions(canvas);
    await expect(
      canvas.getByPlaceholderText('Depended issue URL'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Set Depended Issue' }),
    ).toBeInTheDocument();
  },
};

export const FieldReopenedWithTextKept: Story = {
  args: {
    onSetDependedIssueUrl: async () => {
      throw new Error('HTTP 500');
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toggleRareActions(canvas);
    await typeDependedIssueUrl(canvas);
    await pressSetDependedIssue(canvas);
    await expect(await canvas.findByText('HTTP 500')).toBeInTheDocument();

    await toggleRareActions(canvas);
    await expect(
      canvas.queryByPlaceholderText('Depended issue URL'),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText('HTTP 500')).not.toBeInTheDocument();

    await toggleRareActions(canvas);
    await expect(canvas.getByPlaceholderText('Depended issue URL')).toHaveValue(
      dependedIssueUrl,
    );
  },
};

export const SubmitButtonEmpty: Story = {
  args: {
    onSetDependedIssueUrl: async () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toggleRareActions(canvas);
    await expect(
      canvas.getByRole('button', { name: 'Set Depended Issue' }),
    ).toBeDisabled();
  },
};

export const SubmitButtonWithUrl: Story = {
  args: {
    onSetDependedIssueUrl: async () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toggleRareActions(canvas);
    await typeDependedIssueUrl(canvas);
    await expect(
      canvas.getByRole('button', { name: 'Set Depended Issue' }),
    ).toBeEnabled();
  },
};

export const SubmitButtonRunning: Story = {
  args: {
    onSetDependedIssueUrl: () => new Promise<void>(() => {}),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toggleRareActions(canvas);
    await typeDependedIssueUrl(canvas);
    await pressSetDependedIssue(canvas);
    await expect(
      await canvas.findByRole('button', { name: '...' }),
    ).toBeDisabled();
  },
};

export const ErrorFromErrorInstance: Story = {
  args: {
    onSetDependedIssueUrl: async () => {
      throw new Error('HTTP 500');
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toggleRareActions(canvas);
    await typeDependedIssueUrl(canvas);
    await pressSetDependedIssue(canvas);
    await expect(await canvas.findByText('HTTP 500')).toBeInTheDocument();
  },
};

export const ErrorFromNonErrorValue: Story = {
  args: {
    onSetDependedIssueUrl: () => Promise.reject('HTTP 500'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toggleRareActions(canvas);
    await typeDependedIssueUrl(canvas);
    await pressSetDependedIssue(canvas);
    await expect(
      await canvas.findByText('Failed to set depended issue URL'),
    ).toBeInTheDocument();
  },
};

export const DisabledToggleClicked: Story = {
  args: {
    onSetDependedIssueUrl: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await toggleRareActions(canvas);
    await expect(
      canvas.queryByPlaceholderText('Depended issue URL'),
    ).not.toBeInTheDocument();
  },
};
