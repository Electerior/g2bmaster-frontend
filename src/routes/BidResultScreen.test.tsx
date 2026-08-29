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

function renderScreen(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/notices/bid-result${search}`]}>
        <NoticeTableScreen kind="bid-result" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 마지막으로 나간 목록 조회의 쿼리스트링. */
function lastQuery(): URLSearchParams {
  const url = String(get.mock.calls.at(-1)?.[0] ?? '');
  return new URLSearchParams(url.slice(url.indexOf('?') + 1));
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

describe('입찰 결과 정렬', () => {
  /*
   * 백엔드는 sortKey 가 **비었을 때만** BM25 관련도 재랭킹을 탄다. 화면이 기본 정렬을
   * 무조건 실어 보내면 그 경로는 한 번도 실행되지 않는 사문 코드가 된다 —
   * docs/bid-result-open-spec.md §9-6 이 원본의 같은 결함을 기록해 두었고 이식본이 그대로
   * 물려받았던 자리다. 오류도 빈칸도 없이 '순서'만 틀리므로 눈으로는 잡히지 않는다.
   */
  it('키워드 검색이면 정렬을 생략해 서버 관련도에 맡긴다', async () => {
    renderScreen('?and=교복');
    await screen.findByRole('button', { name: WON.bidNtceNm });

    const params = lastQuery();
    expect(params.get('andTerms')).toBe('교복');
    expect(params.get('sortKey')).toBeNull();
    expect(params.get('sortDir')).toBeNull();
  });

  it('키워드가 없으면 화면 기본 정렬을 그대로 보낸다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: WON.bidNtceNm });
    expect(lastQuery().get('sortKey')).toBe('rlOpengDt');
  });

  it('사용자가 고른 정렬은 키워드가 있어도 우선한다', async () => {
    renderScreen('?and=교복&sort=sucsfbidAmt&dir=desc');
    await screen.findByRole('button', { name: WON.bidNtceNm });
    expect(lastQuery().get('sortKey')).toBe('sucsfbidAmt');
  });

  it('컬럼에 없는 정렬 키는 기본값으로 스냅한다 — 쓰레기 키는 관련도까지 함께 죽인다', async () => {
    // 백엔드 comparator 에 화이트리스트가 없어 없는 키도 오류 없이 흐른다. 손으로 친
    // 주소나 옛 링크로만 재현되지만, 막는 값이 한 줄이다.
    renderScreen('?sort=created&dir=desc');
    await screen.findByRole('button', { name: WON.bidNtceNm });
    expect(lastQuery().get('sortKey')).toBe('rlOpengDt');
  });

  it('관련도로 넘길 때는 어느 머리글도 정렬 중이라고 말하지 않는다', async () => {
    const { container } = renderScreen('?and=교복');
    await screen.findByRole('button', { name: WON.bidNtceNm });
    // 표는 '개찰일시 ▼' 라고 말하는데 서버는 관련도로 답하는 상태가 가장 나쁘다.
    expect(container.querySelector('.sort-icon.active')).toBeNull();
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

  it("낙찰정보에 없는 '상태' 줄을 그리지 않는다 — 언제나 '공고' 였다", async () => {
    /*
     * _noticeStatus 의 원천(ntceKindNm·rgstTyNm)이 낙찰정보 응답에 아예 없어 백엔드가
     * 기본값 '공고' 를 채운다. 낙찰 확정 건이든 재입찰 건이든 구분이 없어 "아직 공고
     * 단계인가?" 로 읽힌다. 픽스처는 실제 응답대로 '공고' 를 들고 있다.
     */
    renderScreen();
    const drawer = await openDrawer();
    expect(within(drawer).queryByText('상태')).not.toBeInTheDocument();
    // 바로 위 '출처' 는 실제 정보라 남는다.
    expect(within(drawer).getByText('출처')).toBeInTheDocument();
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

  it('서랍을 열면 개찰 결과를 바로 조회한다 — 버튼을 한 번 더 누르게 하지 않는다', async () => {
    /*
     * 예전에는 버튼을 눌러야 나갔고 근거는 "열 때마다 부르면 개찰 전 공고에서 매번
     * 헛품"이었다. 백엔드가 참여업체 명단을 bid_opening_result 에 저장하면서 그 전제가
     * 사라졌다 — 상류로 나가는 것은 공고당 한 번이고, 비어 온 것도 그 사실째 저장된다.
     */
    post.mockResolvedValue({
      bidNtceNo: WON.bidNtceNo,
      bidNtceSqNo: '000',
      participants: [
        { bdrNm: '에프에스아일랜드학생복', rank: '1', bidAmt: '298000', bidprcRt: '95.6', sucsfbidYn: 'Y' },
      ],
    });
    renderScreen();
    const drawer = await openDrawer();

    expect(await within(drawer).findByText('에프에스아일랜드학생복')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      '/api/bid-opening-results',
      expect.objectContaining({ bidNtceNo: WON.bidNtceNo }),
    );
  });

  it('참여업체가 많으면 상위 20개사만 그리고 나머지는 접는다', async () => {
    /*
     * 실측 분포: 중앙값 8개사인데 14%가 100개사를 넘고 최대 1,596개사다. 전부 그리면
     * 서랍이 무한 스크롤이 되고, 그 표는 목록이 아니라 덤프가 된다. 총원은 메타 격자와
     * '총 N개사 참여'에 남아 있으므로 접어도 정보가 사라지지 않는다.
     */
    post.mockResolvedValue({
      bidNtceNo: WON.bidNtceNo,
      bidNtceSqNo: '000',
      participants: Array.from({ length: 1596 }, (_, i) => ({
        bdrNm: `업체${i + 1}`,
        rank: String(i + 1),
        bidAmt: '173445000',
        bidprcRt: '90.4',
        sucsfbidYn: i === 0 ? 'Y' : 'N',
      })),
    });
    renderScreen();
    const drawer = await openDrawer();

    expect(await within(drawer).findByText('업체1')).toBeInTheDocument();
    expect(within(drawer).getByText('업체20')).toBeInTheDocument();
    expect(within(drawer).queryByText('업체21')).not.toBeInTheDocument();
    // 끊겼다는 사실과 남은 수가 보여야 한다 — 안 그러면 20개사가 전부라고 읽는다.
    expect(within(drawer).getByRole('button', { name: /나머지 1,576개사 더 보기/ })).toBeInTheDocument();
    expect(within(drawer).getByText(/총 1,596개사 참여/)).toBeInTheDocument();
    /*
     * 머리줄에도 적는다. '더 보기' 버튼은 20행 아래라 서랍을 연 첫 화면에서는 화면 밖이다
     * (실측 버튼 top 1032px / 뷰포트 972px). 그것만 두면 스크롤하기 전에 "20개사가 전부"로
     * 읽고 끝낸다 — 실제로 그 제보를 받아 이 줄을 넣었다.
     */
    expect(within(drawer).getByText(/상위 20개사 · 총 1,596개사/)).toBeInTheDocument();
  });

  it("'더 보기'를 누르면 전부 펼친다", async () => {
    post.mockResolvedValue({
      bidNtceNo: WON.bidNtceNo,
      bidNtceSqNo: '000',
      participants: Array.from({ length: 25 }, (_, i) => ({
        bdrNm: `업체${i + 1}`,
        rank: String(i + 1),
        bidAmt: '1000',
        bidprcRt: '90',
        sucsfbidYn: 'N',
      })),
    });
    renderScreen();
    const drawer = await openDrawer();

    fireEvent.click(await within(drawer).findByRole('button', { name: /나머지 5개사 더 보기/ }));
    expect(within(drawer).getByText('업체25')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: '접기' })).toBeInTheDocument();
  });

  it('20개사 이하면 접기 줄을 그리지 않는다 — 절반 이상이 이 경우다', async () => {
    post.mockResolvedValue({
      bidNtceNo: WON.bidNtceNo,
      bidNtceSqNo: '000',
      participants: Array.from({ length: 8 }, (_, i) => ({
        bdrNm: `업체${i + 1}`,
        rank: String(i + 1),
        bidAmt: '1000',
        bidprcRt: '90',
        sucsfbidYn: 'N',
      })),
    });
    renderScreen();
    const drawer = await openDrawer();

    expect(await within(drawer).findByText('업체8')).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: /더 보기/ })).not.toBeInTheDocument();
    // 잘리지 않았으면 머리줄 요약도 없어야 한다 — 늘 띄우면 잡음이다.
    expect(within(drawer).queryByText(/상위 .*개사 · 총/)).not.toBeInTheDocument();
  });

  it('공고번호가 없으면 조회하지 않는다 — 빈 번호로 나가면 서버가 400 을 낸다', async () => {
    get.mockResolvedValue({
      items: [{ ...WON, bidNtceNo: '' }],
      totalCount: 1,
      pageNo: 1,
      numOfRows: 20,
    });
    renderScreen();
    const link = await screen.findByRole('button', { name: WON.bidNtceNm });
    fireEvent.click(link);

    expect(await screen.findByText(/공고번호가 없어/)).toBeInTheDocument();
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
