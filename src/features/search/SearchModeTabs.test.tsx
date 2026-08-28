import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchModeTabs } from './SearchModeTabs';

describe('SearchModeTabs', () => {
  it('공고 검색에 필요한 세 모드만 노출한다', () => {
    render(<SearchModeTabs mode="keyword" onModeChange={vi.fn()} />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '키워드 검색',
      '품목 검색',
      '발주기관 검색',
    ]);
    for (const removed of ['낙찰자 조회', '담당자 조회', '업로드 분석']) {
      expect(screen.queryByRole('tab', { name: removed })).not.toBeInTheDocument();
    }
  });

  it('선택된 모드 하나만 활성화하고 전환을 전달한다', () => {
    const onModeChange = vi.fn();
    render(<SearchModeTabs mode="keyword" onModeChange={onModeChange} />);

    expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: '품목 검색' }));
    expect(onModeChange).toHaveBeenCalledWith('item');
  });
});
