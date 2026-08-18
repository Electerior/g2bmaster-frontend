import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoticeIndexItem } from '@/api/search';
import { IndexNoticeDrawer } from './IndexNoticeDrawer';

const mocks = vi.hoisted(() => ({
  useNoticeDetail: vi.fn(),
  analyzeDeal: vi.fn(),
}));

vi.mock('@/api/search', () => ({
  useNoticeDetail: mocks.useNoticeDetail,
}));

vi.mock('@/lib/apiClient', () => ({
  post: mocks.analyzeDeal,
  get: vi.fn(),
  apiClient: {},
  ApiError: class ApiError extends Error {},
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
  amount: 45_000_000,
  amountKind: 'estimatedPrice',
};

/** 원가까지 나온 분석. 실추정가 49,500,000 − 원가 35,000,000 → 마진 29.3% */
const ANALYZED = {
  bidNtceNo: NOTICE.id,
  facts: { quantity: 7, quantitySource: 'spec-units' },
  deal: { hasCost: true, cost: 35_000_000, unitCost: 5_000_000, unitCostSource: 'estimated' },
  estimatedUnitCost: {
    matched: true,
    allPriced: true,
    breakdown: [
      { category: 'CPU', option: 'Ultra 5', product: 'Intel Core Ultra 5 225', qty: 1, low: 305_990, source: 'danawa' },
      { category: '메모리', option: 'DDR5 32GB', product: null, qty: 2, low: null, source: 'danawa' },
    ],
  },
};

function renderDrawer(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mocks.useNoticeDetail.mockReset();
  mocks.analyzeDeal.mockReset();
  mocks.useNoticeDetail.mockReturnValue({ data: undefined, isPending: false, error: null });
});

describe('IndexNoticeDrawer 가격 분석 탭', () => {
  it('가격 분석을 기본 화면으로 열고 공고 정보는 탭으로 전환한다', () => {
    renderDrawer(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: String(NOTICE.noticeName) });
    const overviewTab = within(dialog).getByRole('tab', { name: '공고 정보' });
    const priceTab = within(dialog).getByRole('tab', { name: /가격 분석/ });

    expect(priceTab).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).queryByText('공고 내용')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '가격 분석 실행' })).toBeInTheDocument();

    fireEvent.click(overviewTab);
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByText('공고 내용')).toBeInTheDocument();
  });

  it('방향키로 탭을 이동하고 기존 상세 조회 훅에는 같은 공고 ID를 유지한다', () => {
    renderDrawer(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    const priceTab = screen.getByRole('tab', { name: /가격 분석/ });
    const overviewTab = screen.getByRole('tab', { name: '공고 정보' });
    priceTab.focus();

    fireEvent.keyDown(priceTab, { key: 'ArrowRight' });

    expect(overviewTab).toHaveFocus();
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('공고 내용')).toBeInTheDocument();
    expect(mocks.useNoticeDetail).toHaveBeenCalledWith(NOTICE.id);
  });

  /*
   * 이 탭이 서랍의 첫 화면이라, 자동으로 돌면 공고를 훑어보기만 해도 매번 규격서 다운로드와
   * LLM 부품 추출과 다나와 조회가 나간다. 사람이 누를 때만 도는 것이 이 화면의 계약이다.
   */
  it('열기만 해서는 분석을 부르지 않는다', () => {
    renderDrawer(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);
    expect(mocks.analyzeDeal).not.toHaveBeenCalled();
  });

  /*
   * 딜 분석의 규격서 선택기는 `attachmentUrls` 만 읽는다. 같은 저장소의 요약 계열이 쓰는
   * 평평한 필드(atchFileUrl1…)로 보내면 첨부가 통째로 무시되는데, 화면에는 오류 없이
   * "규격서를 찾지 못했다"만 뜬다 — 아무도 눈치채지 못하는 종류의 실패라 키를 고정한다.
   */
  it('첨부를 attachmentUrls 키로 넘긴다 — 규격서를 여는 유일한 통로다', async () => {
    mocks.analyzeDeal.mockResolvedValue(ANALYZED);
    const withFile = {
      ...NOTICE,
      attachmentUrls: [{ name: '규격서.hwpx', url: 'https://example.test/spec.hwpx' }],
    };
    renderDrawer(<IndexNoticeDrawer seed={withFile} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '가격 분석 실행' }));

    await waitFor(() => expect(mocks.analyzeDeal).toHaveBeenCalledWith(
      '/api/deal-analysis',
      expect.objectContaining({
        item: expect.objectContaining({
          attachmentUrls: [{ name: '규격서.hwpx', url: 'https://example.test/spec.hwpx' }],
        }),
      }),
      // 깊은 분석은 마감을 실어 보낸다(analysis.ts 의 deepQueue) — 인자 수까지 맞아야 한다.
      expect.objectContaining({ timeout: expect.any(Number) }),
    ));
  });

  it('실행하면 열린 공고의 번호로 분석을 부른다 — 고정 데이터가 아니다', async () => {
    mocks.analyzeDeal.mockResolvedValue(ANALYZED);
    renderDrawer(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '가격 분석 실행' }));

    await waitFor(() => expect(mocks.analyzeDeal).toHaveBeenCalledWith(
      '/api/deal-analysis',
      expect.objectContaining({ item: expect.objectContaining({ bidNtceNo: NOTICE.id }) }),
      expect.objectContaining({ timeout: expect.any(Number) }),
    ));
    // 마진은 목록의 마진율 열과 같은 기준(실추정가)이어야 한다 — 한 공고에 두 숫자가 나오면 안 된다.
    expect(await screen.findByText(/실추정가 기준 · 29\.3%/)).toBeInTheDocument();
    expect(screen.getByText('14,500,000원')).toBeInTheDocument();
  });

  /*
   * 가격을 못 구한 부품을 0 으로 그리면 합계가 맞아 보이고 마진이 부풀려진다. '미확인'이라고
   * 적어야 합계가 낮게 잡혔다는 사실이 화면에 남는다.
   */
  it('가격을 못 구한 부품은 0 이 아니라 미확인이다', async () => {
    mocks.analyzeDeal.mockResolvedValue(ANALYZED);
    renderDrawer(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '가격 분석 실행' }));

    const row = await screen.findByRole('row', { name: /메모리/ });
    expect(within(row).getByText('미확인')).toBeInTheDocument();
    expect(within(row).queryByText('0원')).not.toBeInTheDocument();
  });

  /*
   * 원가를 못 구했을 때 0 을 채우면 마진 100% 가 되어 이 화면에서 가장 좋은 딜처럼 보인다.
   * 서버가 이유를 알고 있으므로 그 문장을 그대로 옮긴다.
   */
  it('원가를 못 구하면 서버가 준 안내를 그대로 보여준다', async () => {
    mocks.analyzeDeal.mockResolvedValue({
      bidNtceNo: NOTICE.id,
      deal: { hasCost: false },
      estimatedUnitCost: null,
      note: '규격서에서 부품 단가를 추정하지 못했습니다. 단가를 직접 입력하면 원가·손익이 계산됩니다.',
    });
    renderDrawer(<IndexNoticeDrawer seed={NOTICE} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '가격 분석 실행' }));

    expect(await screen.findByText(/부품 단가를 추정하지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByText('산출 불가')).toBeInTheDocument();
    expect(screen.queryByText('품목별 원가')).not.toBeInTheDocument();
  });
});
