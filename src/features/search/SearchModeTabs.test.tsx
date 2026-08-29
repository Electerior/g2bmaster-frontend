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

  it('쓸 수 없는 모드는 지우지 않고 비활성으로 남긴다', () => {
    /*
     * 입찰 결과에서 품목 검색은 '준비 중'이 아니라 성립하지 않는 조합이다 — 낙찰정보 행에
     * 품목 필드가 없어 낱말을 넣으면 구조적으로 0건이다. 탭을 지우면 사용자는 그런 검색
     * 방식이 있었다는 사실 자체를 모르므로, 남기되 눌리지 않게 한다.
     */
    render(
      <SearchModeTabs mode="keyword" onModeChange={vi.fn()} availableModes={['keyword', 'instt']} />,
    );

    expect(screen.getByRole('tab', { name: '품목 검색' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: '키워드 검색' })).toBeEnabled();
  });

  it('쓸 수 없는 모드가 URL 에 남아 있으면 활성 탭은 키워드로 그린다', () => {
    // 탭을 넘어와도 mode 는 보존된다(searchForTab). 실제 조회는 키워드로 나가므로
    // 활성 표시도 키워드여야 화면과 결과가 같은 말을 한다.
    render(
      <SearchModeTabs mode="item" onModeChange={vi.fn()} availableModes={['keyword', 'instt']} />,
    );

    expect(screen.getByRole('tab', { name: '키워드 검색' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: '품목 검색' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('선택된 모드 하나만 활성화하고 전환을 전달한다', () => {
    const onModeChange = vi.fn();
    render(<SearchModeTabs mode="keyword" onModeChange={onModeChange} />);

    expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: '품목 검색' }));
    expect(onModeChange).toHaveBeenCalledWith('item');
  });
});
