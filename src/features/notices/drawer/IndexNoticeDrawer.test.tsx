import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
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
  source: 'G2B',
  noticeName: '2026년 사무용 컴퓨터 구매',
  category: '입찰',
  businessDivision: '물품',
  noticeInstitutionName: '조달청',
  demandInstitutionName: '한국대학교',
  bodyPreview: '사무용 컴퓨터 7대 구매 공고 본문',
  estimatedPrice: 45_000_000,
  amount: 45_000_000,
  amountKind: 'estimatedPrice',
};

function renderDrawer(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mocks.useNoticeDetail.mockReset();
  mocks.useNoticeDetail.mockReturnValue({ data: undefined, isPending: false, error: null });
});

describe('IndexNoticeDrawer 공고 정보', () => {
  it('단일 탭 없이 공고 정보를 바로 열고 저장 액션을 유지한다', () => {
    renderDrawer(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: String(NOTICE.noticeName) });

    expect(within(dialog).queryByRole('tablist')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('tab')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: '핵심 일정' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: '공고 정보' })).toBeInTheDocument();
    expect(within(dialog).getByText('공고 내용')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '공고 저장' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '서랍 닫기' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /가격 분석/ })).not.toBeInTheDocument();
  });

  it('출처까지 포함한 복합 키로 상세를 조회한다', () => {
    renderDrawer(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    expect(mocks.useNoticeDetail).toHaveBeenCalledWith(NOTICE.id, NOTICE.source);
  });

  it('재배치해도 상세 정보와 첨부·원문 링크를 빠뜨리지 않는다', () => {
    mocks.useNoticeDetail.mockReturnValue({
      data: {
        ...NOTICE,
        region: '서울특별시',
        createdDate: '2026-08-26T09:00:00',
        closeDate: '2026-09-02T18:00:00',
        dday: 6,
        priceDetail: { assignedBudget: 50_000_000, estimatedPrice: 45_000_000 },
        productList: [
          { code: '43211507', name: '데스크톱컴퓨터' },
          { code: '43211503', name: '노트북컴퓨터' },
        ],
        officerName: '김담당',
        officerContact: '02-1234-5678',
        attachmentUrls: [{ name: '구매 규격서.pdf', url: 'https://example.test/spec.pdf' }],
        sourceUrl: 'https://example.test/notice',
      },
      isPending: false,
      error: null,
    });

    renderDrawer(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    const scheduleRegion = screen.getByRole('region', { name: '핵심 일정' });
    const overviewRegion = screen.getByRole('region', { name: '공고 정보' });
    const commercialRegion = screen.getByRole('region', { name: '품목 및 금액' });

    expect(scheduleRegion).toBeInTheDocument();
    expect(overviewRegion).toBeInTheDocument();
    expect(commercialRegion).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '담당 및 관리' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '공고 내용' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '첨부 1건' })).toBeInTheDocument();
    expect(screen.getByText('김담당')).toBeInTheDocument();
    expect(screen.getByText('45,000,000원')).toBeInTheDocument();
    expect(overviewRegion.querySelector('dl')).toBeInTheDocument();
    expect(within(overviewRegion).getByText('공고번호').tagName).toBe('DT');
    expect(within(overviewRegion).getByText(NOTICE.id).tagName).toBe('DD');
    expect(within(commercialRegion).getByRole('list', { name: '물품목록' })).toBeInTheDocument();
    expect(within(commercialRegion).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: '구매 규격서.pdf' })).toHaveAttribute(
      'href',
      'https://example.test/spec.pdf',
    );
    expect(screen.getByRole('link', { name: '나라장터에서 전체 보기 ↗' })).toHaveAttribute(
      'href',
      'https://example.test/notice',
    );
  });

  it('색인에 저장된 AI 요약은 공고 정보 안에서 그대로 보여 준다', () => {
    mocks.useNoticeDetail.mockReturnValue({
      data: { ...NOTICE, aiSummary: '공고의 핵심 요약입니다.' },
      isPending: false,
      error: null,
    });

    renderDrawer(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    expect(screen.getByText('AI 요약')).toBeInTheDocument();
    expect(screen.getByText('공고의 핵심 요약입니다.')).toBeInTheDocument();
  });

  it('상세 가격표가 비어도 목록의 대표 금액과 종류를 그대로 보여 준다', () => {
    mocks.useNoticeDetail.mockReturnValue({
      data: {
        ...NOTICE,
        estimatedPrice: null,
        priceDetail: undefined,
        amount: 32_000_000,
        amountKind: 'estimatedPrice',
      },
      isPending: false,
      error: null,
    });

    renderDrawer(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    const commercialRegion = screen.getByRole('region', { name: '품목 및 금액' });
    expect(within(commercialRegion).getByText('추정가격').tagName).toBe('DT');
    expect(within(commercialRegion).getByText('32,000,000원').tagName).toBe('DD');
  });
});
