/*
 * 입찰 결과 화면 — "핵심 열만 표에, 나머지는 서랍으로" 라는 규칙이 실제 렌더에서 지켜지는지.
 *
 * 셋 다 타입도 린트도 통과하면서 화면에서만 틀리는 종류라 컴파일러가 잡아 주지 않는다:
 *   1) 컬럼을 하나 되돌리면 표가 다시 패널보다 넓어져 가로 스크롤이 생긴다.
 *   2) 공고번호를 공고명 아래가 아니라 별도 컬럼으로 되돌려도 화면은 멀쩡해 보인다.
 *   3) 서랍 변종을 'notice' 로 되돌리면 결과 행의 절반이 빈 격자로 열린다 — 오류는 안 난다.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BidResultItem } from '@/api';

const get = vi.fn();
const post = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  get: (url: string) => get(url),
  post: (url: string, body: unknown) => post(url, body),
  del: vi.fn(),
  apiClient: {},
  ApiError: class ApiError extends Error {},
}));

const { NoticeTableScreen } = await import('./NoticeTableScreen');

/** 실제 /api/bid-result 응답 한 건을 그대로 옮긴 것(참여 4개사 건). */
const WON: BidResultItem = {
  bidNtceNo: 'R26BK01629628',
  bidNtceOrd: '000',
  // 재입찰이 아니면 '000' 으로 온다 — 서랍이 이 줄을 그리지 않아야 한다.
  rbidNo: '000',
  bidNtceNm: '2027학년도 인천체육고등학교 신입생 교복(동복·하복) 학교주관 구매 공고',
  dminsttNm: '인천광역시교육청 인천체육고등학교',
  bidwinnrNm: '에프에스아일랜드학생복',
  bidwinnrBizno: '1310421971',
  bidwinnrCeoNm: '윤창원',
  bidwinnrTelNo: '032-283-8440',
  bidwinnrAdrs: '인천광역시 남동구 백범로 384 (간석동)',
  sucsfbidAmt: '298000',
  sucsfbidRate: '95.609',
  prtcptCnum: '4',
  rlOpengDt: '2026-08-11 11:00:00',
  fnlSucsfDate: '2026-08-11',
  rgstDt: '2026-08-11 11:13:00',
  _type: '물품',
  _sourceLabel: '나라장터',
  _noticeStatus: '공고',
};

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/notices/bid-result']}>
        <NoticeTableScreen kind="bid-result" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 머리글 글자만. 정렬 아이콘(⇅▲▼)이 섞여 있어 그대로 비교하면 매번 깨진다. */
function headerLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.data-table thead th')].map((th) =>
    (th.textContent ?? '').replace(/[⇅▲▼]/g, '').trim(),
  );
}

/** 공고명을 눌러 서랍을 연다 — 표에서 상세로 가는 유일한 통로다. */
async function openDrawer() {
  const link = await screen.findByRole('button', { name: WON.bidNtceNm });
  fireEvent.click(link);
  return screen.getByRole('dialog');
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockResolvedValue({ items: [WON], totalCount: 1, pageNo: 1, numOfRows: 20 });
});

describe('입찰 결과 표', () => {
  it('핵심 일곱 열만 둔다 — 나머지는 서랍으로 갔다', async () => {
    const { container } = renderScreen();
    await screen.findByRole('button', { name: WON.bidNtceNm });
    expect(headerLabels(container)).toEqual([
      '구분',
      '공고명 · 공고번호',
      '수요기관',
      '낙찰업체',
      '낙찰금액',
      '낙찰률',
      '개찰일시',
    ]);
  });

  it('표 폭 하한을 레거시 4탭(1580px)이 아니라 compact 로 잡는다', async () => {
    const { container } = renderScreen();
    await screen.findByRole('button', { name: WON.bidNtceNm });
    // 이 클래스가 빠지면 컬럼을 줄여도 표가 1580px 로 벌어져 가로 스크롤이 그대로 남는다.
    expect(container.querySelector('.data-table')).toHaveClass('compact');
  });

  it('공고번호는 별도 컬럼이 아니라 공고명 아래 한 줄로 붙는다', async () => {
    const { container } = renderScreen();
    await screen.findByRole('button', { name: WON.bidNtceNm });
    const cell = container.querySelector('.notice-name-cell');
    expect(cell).not.toBeNull();
    expect(within(cell as HTMLElement).getByText('R26BK01629628')).toBeInTheDocument();
  });
});

describe('입찰 결과 서랍', () => {
  it('표에 없던 낙찰업체 상세를 보여준다', async () => {
    renderScreen();
    const drawer = await openDrawer();
    for (const value of [
      '1310421971', // 사업자번호
      '윤창원', // 대표자
      '032-283-8440', // 전화
      '인천광역시 남동구 백범로 384 (간석동)', // 주소
      '4개사', // 참여업체수 — 표에서 뺀 대신 여기 있다
    ]) {
      expect(within(drawer).getByText(value)).toBeInTheDocument();
    }
  });

  it('없음을 뜻하는 000 은 줄을 만들지 않는다', async () => {
    renderScreen();
    const drawer = await openDrawer();
    // 공고차수·재입찰번호가 둘 다 '000' 이면 그 두 줄은 아무 뜻도 없는 빈칸이 된다.
    expect(within(drawer).queryByText('공고차수')).not.toBeInTheDocument();
    expect(within(drawer).queryByText('재입찰번호')).not.toBeInTheDocument();
  });

  it('공고 서랍이 아니라 결과 서랍이 열린다', async () => {
    renderScreen();
    const drawer = await openDrawer();
    // 결과 행에는 첨부가 없다 — 공고 서랍이 열리면 AI 분석 칸이 함께 따라온다.
    expect(within(drawer).queryByText('✨ AI 분석')).not.toBeInTheDocument();
    expect(within(drawer).getByText(/개찰 경쟁 현황/)).toBeInTheDocument();
  });

  it('서랍을 여는 것만으로는 아무 API 도 더 부르지 않는다', async () => {
    renderScreen();
    await openDrawer();
    // 개찰 조회는 버튼을 눌러야 나간다 — 열 때마다 부르면 개찰 전 공고에서 매번 헛품이다.
    expect(post).not.toHaveBeenCalled();
  });
});

describe('공고번호로 왔는데 낙찰 결과가 없을 때', () => {
  /*
   * 이 자리까지 왔다는 것은 서버가 색인을 보고, 없어서 나라장터에도 한 번 물었는데 비었다는
   * 뜻이다. 그러면 남은 가능성은 "아직 낙찰 확정 전"뿐인데, 빈 표만 보여 주면 사용자는
   * 기능이 고장 났다고 읽는다 — 실제로 그 신고에서 시작된 화면이다.
   */
  it('빈 표 대신 개찰 결과를 자동으로 조회해 보여 준다', async () => {
    get.mockResolvedValue({ items: [], totalCount: 0, pageNo: 1, numOfRows: 20 });
    post.mockResolvedValue({
      bidNtceNo: 'R26BK01697446',
      bidNtceSqNo: '000',
      participants: [
        { bdrNm: '코어방재기술', rank: '1', bidAmt: '4213000', bidprcRt: '88.1', sucsfbidYn: 'Y' },
      ],
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/notices/bid-result?ntceNo=R26BK01697446&type=물품']}>
          <NoticeTableScreen kind="bid-result" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/낙찰 결과가 아직 없습니다/)).toBeTruthy();
    // 버튼을 한 번 더 누르게 하지 않는다 — 사용자는 이미 "이 공고 결과를 보여 달라"고 왔다.
    expect(await screen.findByText('코어방재기술')).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/api/bid-opening-results', expect.objectContaining({
      bidNtceNo: 'R26BK01697446',
    }));
  });
});
