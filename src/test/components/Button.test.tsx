import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@/components/ui/Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('defaults to type="button" to prevent form submission', () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('accepts type="submit"', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('accepts type="reset"', () => {
    render(<Button type="reset">Reset</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'reset');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies variant classes for danger', () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-danger');
  });

  it('applies variant classes for success', () => {
    render(<Button variant="success">Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-success');
  });

  it('applies variant classes for ghost', () => {
    render(<Button variant="ghost">Cancel</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-transparent');
  });

  it('applies size classes for sm', () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-xs');
  });

  it('applies size classes for lg', () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-base');
  });

  it('applies additional className', () => {
    render(<Button className="my-custom-class">Custom</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('my-custom-class');
  });

  it('applies aria-disabled when disabled', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('defaults to primary variant', () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-accent');
  });
});
