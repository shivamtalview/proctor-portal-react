import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('has role="status" for accessibility', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has aria-label="Loading" for screen readers', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders with default md size', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toHaveClass('w-8', 'h-8');
  });

  it('renders with sm size', () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    expect(container.firstChild).toHaveClass('w-4', 'h-4');
  });

  it('renders with lg size', () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    expect(container.firstChild).toHaveClass('w-12', 'h-12');
  });

  it('applies additional className', () => {
    const { container } = render(<LoadingSpinner className="mt-4" />);
    expect(container.firstChild).toHaveClass('mt-4');
  });

  it('renders a single element', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.childElementCount).toBe(1);
  });

  it('has animate-spin class for animation', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toHaveClass('animate-spin');
  });

  it('has rounded-full class for circular shape', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toHaveClass('rounded-full');
  });
});
