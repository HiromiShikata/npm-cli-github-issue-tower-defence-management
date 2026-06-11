import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewBar } from './ReviewBar';

describe('ReviewBar', () => {
  it('renders all 4 action buttons', () => {
    render(<ReviewBar onAction={vi.fn()} disabled={false} />);
    expect(screen.getByText('Unnecessary')).toBeDefined();
    expect(screen.getByText('Totally wrong')).toBeDefined();
    expect(screen.getByText('Reject')).toBeDefined();
    expect(screen.getByText('Approve')).toBeDefined();
  });

  it('calls onAction with CLOSE_UNNEEDED when Unnecessary clicked', async () => {
    const onAction = vi.fn();
    render(<ReviewBar onAction={onAction} disabled={false} />);
    await userEvent.click(screen.getByText('Unnecessary'));
    expect(onAction).toHaveBeenCalledWith('CLOSE_UNNEEDED');
  });

  it('calls onAction with CLOSE_WRONG when Totally wrong clicked', async () => {
    const onAction = vi.fn();
    render(<ReviewBar onAction={onAction} disabled={false} />);
    await userEvent.click(screen.getByText('Totally wrong'));
    expect(onAction).toHaveBeenCalledWith('CLOSE_WRONG');
  });

  it('calls onAction with REQUEST_CHANGES when Reject clicked', async () => {
    const onAction = vi.fn();
    render(<ReviewBar onAction={onAction} disabled={false} />);
    await userEvent.click(screen.getByText('Reject'));
    expect(onAction).toHaveBeenCalledWith('REQUEST_CHANGES');
  });

  it('calls onAction with APPROVE when Approve clicked', async () => {
    const onAction = vi.fn();
    render(<ReviewBar onAction={onAction} disabled={false} />);
    await userEvent.click(screen.getByText('Approve'));
    expect(onAction).toHaveBeenCalledWith('APPROVE');
  });

  it('disables all buttons when disabled is true', async () => {
    const onAction = vi.fn();
    render(<ReviewBar onAction={onAction} disabled={true} />);
    await userEvent.click(screen.getByText('Approve'));
    expect(onAction).not.toHaveBeenCalled();
  });
});
