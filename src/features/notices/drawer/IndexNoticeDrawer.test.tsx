import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoticeIndexItem } from '@/api/search';
import { IndexNoticeDrawer } from './IndexNoticeDrawer';

const mocks = vi.hoisted(() => ({
  useNoticeDetail: vi.fn(),
}));

vi.mock('@/api/search', () => ({
  useNoticeDetail: mocks.useNoticeDetail,
}));

vi.mock('../SaveNoticeButton', () => ({
  SaveNoticeButton: () => <button type="button">공고 저장</button>,
}));

const NOTICE: NoticeIndexItem = {
  id: 'R26BK01638523',
  noticeName: '2026년 사무용 컴퓨터 구매',
  category: '입찰',
  businessDivision: '물품',
  noticeInstitutionName: '조달청',
  demandInstitutionName: '한국대학교',
  bodyPreview: '사무용 컴퓨터 7대 구매 공고 본문',
  estimatedPrice: 45_000_000,
};

beforeEach(() => {
  mocks.useNoticeDetail.mockReset();
  mocks.useNoticeDetail.mockReturnValue({
    data: undefined,
    isPending: false,
    error: null,
  });
});

describe('IndexNoticeDrawer 가격 분석 Mock 탭', () => {
  it('가격 분석을 기본 화면으로 열고 공고 정보는 탭으로 전환한다', () => {
    render(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: String(NOTICE.noticeName) });
    const overviewTab = within(dialog).getByRole('tab', { name: '공고 정보' });
    const priceTab = within(dialog).getByRole('tab', { name: /가격 분석/ });

    expect(priceTab).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).queryByText('공고 내용')).not.toBeInTheDocument();
    expect(within(dialog).getByText('API 연동 없음')).toBeInTheDocument();
    expect(within(dialog).getByText('품목별 원가')).toBeInTheDocument();
    expect(within(dialog).getByText('12,950,000원')).toBeInTheDocument();
    expect(within(dialog).getByText('3,154,200원')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('row', { name: /CPU Intel Core Ultra 5 225 정품/ }),
    ).toBeInTheDocument();

    fireEvent.click(overviewTab);
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByText('공고 내용')).toBeInTheDocument();
    expect(within(dialog).queryByText('API 연동 없음')).not.toBeInTheDocument();
  });

  it('방향키로 탭을 이동하고 기존 상세 조회 훅에는 같은 공고 ID를 유지한다', () => {
    render(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    const priceTab = screen.getByRole('tab', { name: /가격 분석/ });
    const overviewTab = screen.getByRole('tab', { name: '공고 정보' });
    priceTab.focus();

    fireEvent.keyDown(priceTab, { key: 'ArrowRight' });

    expect(overviewTab).toHaveFocus();
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('공고 내용')).toBeInTheDocument();
    expect(mocks.useNoticeDetail).toHaveBeenCalledWith(NOTICE.id);
  });
});
