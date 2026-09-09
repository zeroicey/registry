import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { AttributeDef } from '@/types/attribute';
import { FilterChips, FilterDialog } from './user-filter-bar';

const DEFS: AttributeDef[] = [
  {
    id: 1,
    key: 'dept',
    label: '部门',
    type: 'select',
    config: { options: ['研发', '市场'] },
    collectionId: null,
    createdAt: '2026-08-15T00:00:00Z',
    updatedAt: '2026-08-15T00:00:00Z',
  },
];

describe('FilterDialog', () => {
  it('offers the special national-id filter and emits hasCode on confirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <FilterDialog
        open
        onOpenChange={onOpenChange}
        defs={DEFS}
        existingKeys={[]}
        onConfirm={onConfirm}
      />,
    );

    // Expand the condition picker and choose the special 身份证号 entry.
    await user.click(screen.getByText('选择条件'));
    const hasCodeOption = await screen.findByRole('option', { name: '身份证号' });
    await user.click(hasCodeOption);

    // Value control offers 有身份证号 / 没身份证号 — pick 有.
    await user.click(screen.getByText('选择'));
    expect(await screen.findByRole('option', { name: '有身份证号' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: '有身份证号' }));
    await user.click(screen.getByRole('button', { name: /确定/ }));

    expect(onConfirm).toHaveBeenCalledWith({ key: 'hasCode', value: 'true' });
  });
});

describe('FilterChips', () => {
  it('renders a hasCode chip as 身份证号 · 无 and removes it', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <FilterChips
        defs={DEFS}
        filters={[{ key: 'hasCode', value: 'false' }]}
        onRemove={onRemove}
        onClearAll={vi.fn()}
      />,
    );

    expect(screen.getByText('身份证号')).toBeInTheDocument();
    expect(screen.getByText('无')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /移除 身份证号 筛选/ }));
    expect(onRemove).toHaveBeenCalledWith('hasCode');
  });
});
