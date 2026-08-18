/*
 * 공고 통합 검색 화면 — 계약이 요구하는 표시 규칙이 실제 렌더에서 지켜지는지.
 *
 * apiClient 의 get 만 갈아 끼운다. axios 인스턴스를 통째로 흉내 내면 인터셉터(오류 봉투 →
 * ApiError)까지 흉내 내야 하는데, 그건 이 테스트가 확인하려는 것이 아니다.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoticeIndexItem } from '@/api/search';

const get = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  get: (url: string) => get(url),
  post: vi.fn(),
  del: vi.fn(),
  apiClient: {},
  ApiError: class ApiError extends Error {},
}));

const { NoticeSearchScreen } = await import('./NoticeSearchScreen');

/** 조달청 대행 + 지역 있음 + 마감 있음. */
const DELEGATED: NoticeIndexItem = {
  id: 'R26BK01638523',
  noticeName: '2026년 노트북 및 모니터 구매',
  category: '입찰',
  businessDivision: '물품',
  region: '강원특별자치도',
  noticeInstitutionName: '조달청 강원지방조달청',
  demandInstitutionName: '강원대학교',
  createdDate: '2026-08-01T10:00:00',
  closeDate: '2026-09-12T11:00:00',
  officerName: '김조달',
  officerContact: '033-249-1234',
  dday: 37,
  estimatedPrice: 45000000,
  amount: 45000000,
  amountKind: 'estimatedPrice',
  bodyPreview: '노트북컴퓨터 모니터 일반경쟁 적격심사',
  // 사람이 가격표를 저장해 원가가 확정된 공고. 실추정가 49,500,000 − 원가 35,000,000 → 29.29%
  marginRate: 29.29,
  marginCost: 35000000,
  marginBase: 49500000,
  marginSource: 'confirmed',
  marginUpdatedAt: '2026-08-14T13:40:00',
};

/**
 * 사전규격 — **추정가격 키가 아예 없다.** 원본이 배정예산만 주기 때문이고, 이 계통이 색인의
 * 12,000건이 넘는다(전체의 24%). 서버가 배정예산을 골라 `amount`/`amountKind` 로 내려준다.
 *
 * 이 행이 표에서 '-' 로 보이던 것이 금액 필터가 전체의 28%를 조용히 버리던 버그의 얼굴이다 —
 * 금액을 아는 공고인데 화면에는 금액이 없는 것처럼 보이고, 금액 조건을 걸면 통째로 사라졌다.
 */
const SPEC: NoticeIndexItem = {
  id: '20260801234-00',
  noticeName: '초등학교 급식기구 구매 사전규격',
  category: '사전규격',
  businessDivision: '물품',
  region: '부산광역시',
  noticeInstitutionName: '부산광역시교육청',
  createdDate: '2026-08-01T09:00:00',
  priceDetail: { assignedBudget: 29920000 },
  amount: 29920000,
  amountKind: 'assignedBudget',
  // 딜 분석이 추정한 원가가 예산을 넘은 역마진 건 — 이 열이 찾아내려는 행이다.
  marginRate: -21.6,
  marginCost: 40000000,
  marginBase: 32912000,
  marginSource: 'estimated',
  marginUpdatedAt: '2026-08-14T13:41:00',
};

/** 계획 단계 — 마감이 없어 dday·closeDate 필드가 아예 오지 않는다. 지역은 빈 문자열(전국). */
const PLAN: NoticeIndexItem = {
  id: '20260715001',
  noticeName: '스마트캠퍼스 통합관제 시스템 구축 발주계획',
  category: '계획',
  businessDivision: '용역',
  region: '',
  noticeInstitutionName: '한국전자통신연구원',
  demandInstitutionName: '한국전자통신연구원',
  createdDate: '2026-07-15T09:00:00',
  estimatedPrice: 1200000000,
  amount: 1200000000,
  amountKind: 'estimatedPrice',
};

/** 취소 공고 — 기본 목록에서는 빠지고 상태 '취소'를 고른 경우에만 나온다. */
const CANCELLED: NoticeIndexItem = {
  id: 'R26BK01600001',
  noticeName: '청사 냉난방기 교체공사',
  category: '마감',
  state: '취소',
  businessDivision: '공사',
  region: '경기도,인천광역시',
  noticeInstitutionName: '수원시청',
  demandInstitutionName: '수원시청',
  createdDate: '2026-06-20T11:00:00',
  closeDate: '2026-07-01T11:00:00',
  dday: -36,
  estimatedPrice: 88000000,
  amount: 88000000,
  amountKind: 'estimatedPrice',
};

/** 일반 마감 공고 — 취소 제외가 지난 공고까지 빼지 않는지와 D-DAY 표시에 쓴다. */
const CLOSED: NoticeIndexItem = {
  ...CANCELLED,
  id: 'R26BK01600002',
  noticeName: '청사 승강기 유지보수 용역',
  state: undefined,
};

// SPEC(사전규격)은 추정가격이 없고 배정예산만 있는 행이다 — 금액 칸이 amount 를 그리는지
// 확인하는 데 쓴다. 그 축과 취소 제외 축은 서로 무관하므로 한 목록에 함께 둔다.
const ITEMS = [DELEGATED, PLAN, CLOSED, CANCELLED, SPEC];

function respond(url: string) {
  if (url.startsWith('/api/search/notices/status')) {
    return Promise.resolve({
      summary: [{ category: '입찰', count: 604, last_indexed_at: '2026-08-06T09:20:00' }],
    });
  }
  if (url.startsWith('/api/search/notices/facets')) {
    /*
     * 서버의 패싯은 목록과 한 WHERE 를 쓴다 — 조건에 category 가 실려 오면 GROUP BY 는
     * 그 값 한 줄만 돌려준다. 그 성질을 흉내 내야 축별 재조회가 실제로 도는지 확인된다.
     */
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const pickedCategory = params.get('category');
    const pickedRegion = params.get('region');
    const excludedState = params.get('excludeState');
    return Promise.resolve({
      category: [
        { value: '입찰', count: 604 },
        { value: '계획', count: 312 },
        { value: '마감', count: 100 },
      ].filter((bucket) => !pickedCategory || bucket.value === pickedCategory),
      division: [{ value: '물품', count: 500 }],
      // 지역은 LIKE 라 고른 값을 '포함하는' 버킷만 남는다.
      region: [
        { value: '강원특별자치도', count: 12 },
        { value: '경기도,인천광역시', count: 5 },
      ].filter((bucket) => !pickedRegion || bucket.value.includes(pickedRegion)),
      state: excludedState ? [] : [{ value: '취소', count: 3 }],
    });
  }
  const params = new URLSearchParams(url.split('?')[1] ?? '');
  const state = params.get('state');
  const excludeState = params.get('excludeState');
  const items = state === '취소'
    ? ITEMS.filter((item) => item.state === '취소')
    : excludeState === '취소'
      ? ITEMS.filter((item) => item.state !== '취소')
      : ITEMS;
  return Promise.resolve({ items, totalCount: items.length, pageNo: 1, numOfRows: 20 });
}

function renderScreen(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/notices${search}`]}>
        <NoticeSearchScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(respond);
});

describe('NoticeSearchScreen', () => {
  it('색인 검색 엔드포인트를 부른다 — 팬아웃 API 가 아니다', async () => {
    renderScreen();
    await screen.findByText('2026년 노트북 및 모니터 구매');
    const urls = get.mock.calls.map(([url]) => url as string);
    expect(urls.some((u) => u.startsWith('/api/search/notices?'))).toBe(true);
    expect(urls.some((u) => u.startsWith('/api/search/notices/facets?'))).toBe(true);
    expect(urls.some((u) => u.includes('/api/bid-announce'))).toBe(false);
  });

  it('지역이 빈 공고를 전국으로 적는다', async () => {
    renderScreen();
    await screen.findByText('스마트캠퍼스 통합관제 시스템 구축 발주계획');
    expect(screen.getByText('전국')).toBeInTheDocument();
  });

  it('공고기관과 수요기관이 다르면 둘 다 보여준다', async () => {
    renderScreen();
    await screen.findByText('조달청 강원지방조달청');
    expect(screen.getByText('수요 강원대학교')).toBeInTheDocument();
    // 같은 건은 수요기관 줄을 만들지 않는다.
    expect(screen.queryByText('수요 수원시청')).not.toBeInTheDocument();
  });

  it('D-DAY 를 서버가 센 일수로 그린다', async () => {
    const { container } = renderScreen();
    // D-DAY 는 별도 컬럼이 아니라 '마감일시' 셀 안의 배지다(표를 간결하게 줄였다).
    await screen.findByText('D-37');
    // 지난 것은 '마감'. '마감'은 단계 칩·단계 배지에도 나오는 말이라 D-DAY 배지로 좁혀 본다.
    expect(container.querySelector('.dday-badge.dday-expired')?.textContent).toBe('마감');
    // 마감이 없는 계획 단계는 값 자체가 없어 배지 없이 마감일시만(또는 '-') 남는다.
    expect(container.querySelectorAll('.dday-badge.dday-expired')).toHaveLength(1);
    // 남은 일수 배지(마감 아닌 것)도 정확히 하나.
    expect(
      container.querySelectorAll('.dday-badge:not(.dday-expired)'),
    ).toHaveLength(1);
  });

  /*
   * 금액 칸은 `estimatedPrice` 가 아니라 `amount` 를 그린다.
   *
   * 추정가격 키를 가진 공고는 나라장터 입찰·마감·계획뿐이다. 추정가격만 그리면 사전규격
   * 12,000여 건과 누리장터·D2B 가 **금액을 아는데도** '-' 로 보이고, 같은 이유로 금액 조건이
   * 그 행들을 통째로 버리던 것이 원래 버그였다. 화면과 필터가 같은 값을 봐야 설명이 성립한다.
   */
  it('추정가격이 없는 사전규격도 금액을 보여준다', async () => {
    renderScreen();
    await screen.findByText('초등학교 급식기구 구매 사전규격');
    expect(screen.getByText('29,920,000원')).toBeInTheDocument();
  });

  /*
   * 값만 주면 배정예산(예산이라 추정가격보다 크다)과 추정가격이 한 칸에서 같은 것처럼 보인다.
   * 비교할 수 없는 숫자를 나란히 세우는 셈이고, 화면만 보고는 알아챌 방법이 없다.
   */
  it('그 금액이 어느 금액인지 행마다 적는다', async () => {
    const { container } = renderScreen();
    await screen.findByText('초등학교 급식기구 구매 사전규격');

    const kinds = [...container.querySelectorAll('.amt-pair em')].map((el) => el.textContent);
    expect(kinds).toContain('배정예산');
    expect(kinds).toContain('추정가격');
    // 값과 종류는 같은 셀 안에 함께 있어야 한다 — 떨어져 있으면 어느 행의 설명인지 알 수 없다.
    const specAmount = screen.getByText('29,920,000원').closest('.amt-pair');
    expect(within(specAmount as HTMLElement).getByText('배정예산')).toBeInTheDocument();
  });

  /*
   * 금액 조건은 금액이 적힌 공고만 볼 수 있다 — 원본에 금액이 없는 2,180건은 조건을 거는 순간
   * 빠진다. 적지 않으면 "그 금액대 공고가 없다"와 구분되지 않는다(첨부 색인 범위를 화면에
   * 적는 것과 같은 이유다). 줄일 수 있는 손실이 아니므로 숨기지 않고 말한다.
   */
  it('금액 조건을 걸면 금액 미공개 공고가 빠진다고 알린다', async () => {
    renderScreen('?min=1000000');
    await screen.findByText('2026년 노트북 및 모니터 구매');
    expect(screen.getByText(/금액 미공개 공고 제외/)).toBeInTheDocument();
  });

  it('금액 조건이 없으면 그 안내를 띄우지 않는다', async () => {
    renderScreen();
    await screen.findByText('2026년 노트북 및 모니터 구매');
    expect(screen.queryByText(/금액 미공개 공고 제외/)).not.toBeInTheDocument();
  });

  it('기본 목록에서는 취소를 제외하고 취소 뱃지를 누르면 그 공고만 정상 행으로 보여준다', async () => {
    const { container } = renderScreen();
    await screen.findByText('청사 승강기 유지보수 용역');
    expect(screen.queryByText('청사 냉난방기 교체공사')).not.toBeInTheDocument();

    const initialListUrl = get.mock.calls
      .map(([url]) => url as string)
      .find((url) => url.startsWith('/api/search/notices?'))!;
    expect(new URLSearchParams(initialListUrl.split('?')[1]).get('excludeState')).toBe('취소');

    const stateFilter = await screen.findByLabelText('상태 필터');
    fireEvent.click(within(stateFilter).getByRole('button', { name: /취소/ }));

    await screen.findByText('청사 냉난방기 교체공사');
    await waitFor(() =>
      expect(screen.queryByText('청사 승강기 유지보수 용역')).not.toBeInTheDocument(),
    );
    expect(container.querySelectorAll('.cancelled-row')).toHaveLength(0);

    const listUrls = get.mock.calls
      .map(([url]) => url as string)
      .filter((url) => url.startsWith('/api/search/notices?'));
    const selectedParams = new URLSearchParams(listUrls.at(-1)!.split('?')[1]);
    expect(selectedParams.get('state')).toBe('취소');
    expect(selectedParams.get('excludeState')).toBeNull();
  });

  it('패싯 건수를 필터 칩에 붙인다', async () => {
    renderScreen();
    const stage = await screen.findByLabelText('단계 필터');
    // 패싯은 목록과 별개의 조회라 늦게 도착한다 — find 로 기다린다.
    expect(await within(stage).findByText('604')).toBeInTheDocument();
    expect(within(stage).getByText('312')).toBeInTheDocument();
    // 패싯에 없는 값도 지우지 않고 0 으로 남긴다.
    expect(within(stage).getByText('0')).toBeInTheDocument();
  });

  it('단계를 고르면 나머지 단계 건수가 0 으로 무너지지 않는다', async () => {
    // 칩에 건수를 붙인 목적이 "누르기 전에 안다"인데, 자기 축 필터를 실은 채 물으면
    // 고른 단계만 남아 나머지가 전부 0건이 된다 — 목적이 정확히 뒤집힌다.
    renderScreen('?cat=입찰');
    const stage = await screen.findByLabelText('단계 필터');
    expect(await within(stage).findByText('312')).toBeInTheDocument();
    expect(within(stage).getByText('100')).toBeInTheDocument();
    // '전체' 는 단계로 안 좁혔을 때의 건수 — 목록 건수(=입찰 건수)가 아니다.
    expect(within(stage).getByText('1,016')).toBeInTheDocument();

    // 축을 뺀 조회가 실제로 따로 나갔는지.
    const facetUrls = get.mock.calls
      .map(([url]) => url as string)
      .filter((u) => u.startsWith('/api/search/notices/facets'));
    expect(facetUrls.some((u) => !u.includes('category='))).toBe(true);
  });

  it('지역을 고르면 다른 지역이 드롭다운에서 사라지지 않는다', async () => {
    renderScreen('?region=강원특별자치도');
    await screen.findByLabelText('지역 필터');
    expect(await screen.findByRole('option', { name: /경기도,인천광역시/ })).toBeInTheDocument();
  });

  it('필터가 없어도 기본 패싯과 취소 진입 건수용 상태 패싯을 각각 부른다', async () => {
    renderScreen();
    await screen.findByText('2026년 노트북 및 모니터 구매');
    await waitFor(() => expect(screen.getByLabelText('단계 필터')).toBeInTheDocument());
    const facetUrls = get.mock.calls
      .map(([url]) => url as string)
      .filter((u) => u.startsWith('/api/search/notices/facets'));
    expect(new Set(facetUrls).size).toBe(2);
    expect(facetUrls.some((url) => url.includes('excludeState='))).toBe(true);
    expect(facetUrls.some((url) => !url.includes('excludeState='))).toBe(true);
  });

  it('URL 조건을 질의로 옮긴다 — 날짜는 YYYY-MM-DD 그대로', async () => {
    renderScreen('?and=노트북&cat=입찰&type=물품&from=2026-08-01&to=2026-08-31&active=true');
    await screen.findByText('2026년 노트북 및 모니터 구매');
    const listUrl = get.mock.calls
      .map(([url]) => url as string)
      .find((u) => u.startsWith('/api/search/notices?'))!;
    const params = new URLSearchParams(listUrl.split('?')[1]);
    expect(params.get('andTerms')).toBe('노트북');
    expect(params.get('category')).toBe('입찰');
    expect(params.get('division')).toBe('물품');
    expect(params.get('fromDate')).toBe('2026-08-01');
    expect(params.get('toDate')).toBe('2026-08-31');
    expect(params.get('activeOnly')).toBe('true');
    // 고르지 않은 정렬은 보내지 않는다 — 서버가 관련도/최신을 정한다.
    expect(params.get('sort')).toBeNull();
  });

  /*
   * 마진율 칸.
   *
   * 이 열의 값은 세 상태가 있고 화면에서 서로 달라야 한다: 확정 원가로 낸 마진, 추정 원가로
   * 낸 마진, 그리고 **원가를 아직 모름**. 셋을 같은 모양으로 그리면 분석하지 않은 공고가
   * '남는 게 없는 공고'로 보이고, 추정을 확정처럼 믿게 된다.
   */
  describe('마진율', () => {
    it('부호와 원가 출처를 함께 적는다', async () => {
      const { container } = renderScreen();
      await screen.findByText('2026년 노트북 및 모니터 구매');

      // 양수에도 부호를 붙인다 — 이 표에서 음수가 흔해 부호 없는 수와 나란히 두면 잘못 읽힌다.
      const confirmed = screen.getByText('+29.3%').closest('.margin-pair')!;
      expect(within(confirmed as HTMLElement).getByText('확정')).toBeInTheDocument();

      const estimated = screen.getByText('-21.6%').closest('.margin-pair')!;
      expect(within(estimated as HTMLElement).getByText('추정')).toBeInTheDocument();
      // 역마진만 색을 준다 — 이 열에서 눈에 걸려야 하는 행이다.
      expect(estimated).toHaveClass('margin-neg');
      expect(confirmed).not.toHaveClass('margin-neg');
      expect(container.querySelectorAll('.margin-neg')).toHaveLength(1);
    });

    it("원가를 모르는 공고는 '0%' 가 아니라 '미분석' 이다", async () => {
      renderScreen();
      await screen.findByText('스마트캠퍼스 통합관제 시스템 구축 발주계획');
      // PLAN·CLOSED 에는 마진 필드가 없다.
      expect(screen.getAllByText('미분석').length).toBeGreaterThan(0);
      expect(screen.queryByText('+0.0%')).not.toBeInTheDocument();
    });

    it('머리글을 누르면 마진순으로 다시 조회한다', async () => {
      renderScreen();
      await screen.findByText('2026년 노트북 및 모니터 구매');
      get.mockClear();

      fireEvent.click(screen.getByLabelText('마진율 정렬'));

      const listUrl = get.mock.calls
        .map(([url]) => url as string)
        .find((u) => u.startsWith('/api/search/notices?'))!;
      const params = new URLSearchParams(listUrl.split('?')[1]);
      expect(params.get('sort')).toBe('margin');
      // 마진은 '높은 순'부터 보는 것이 기본이다 — 낮은 순이 먼저 나오면 역마진만 보인다.
      expect(params.get('dir')).toBe('desc');
    });
  });

  /*
   * 정렬 선택기 — 표 머리글이 닿지 못하는 두 경우를 덮는다.
   * ① 관련도순은 대응하는 열이 없다. ② 좁은 화면에서는 열이 접힌다(공고일이 1180px 아래에서 숨는다).
   */
  describe('정렬 선택기', () => {
    it('고르지 않았을 때 실제로 걸린 정렬을 적는다 — 검색어가 없으면 공고일순', async () => {
      renderScreen();
      await screen.findByText('2026년 노트북 및 모니터 구매');
      expect(screen.getByRole('combobox', { name: /정렬/ })).toHaveValue('');
      expect(screen.getByRole('option', { name: '기본 — 공고일순' })).toBeInTheDocument();
    });

    it('검색어가 있으면 관련도순이라고 적는다 — 이 정렬에는 대응하는 열이 없다', async () => {
      renderScreen('?and=노트북');
      await screen.findByText('2026년 노트북 및 모니터 구매');
      expect(screen.getByRole('option', { name: '기본 — 관련도순' })).toBeInTheDocument();
    });

    it('열이 접혀도 그 정렬을 고를 수 있다 — 공고일은 좁은 화면에서 머리글이 사라진다', async () => {
      renderScreen();
      await screen.findByText('2026년 노트북 및 모니터 구매');
      get.mockClear();

      fireEvent.change(screen.getByRole('combobox', { name: /정렬/ }), {
        target: { value: 'created' },
      });

      const listUrl = get.mock.calls
        .map(([url]) => url as string)
        .find((u) => u.startsWith('/api/search/notices?'))!;
      expect(new URLSearchParams(listUrl.split('?')[1]).get('sort')).toBe('created');
    });

    it("'기본' 으로 되돌리면 sort 를 아예 보내지 않는다 — 서버의 조건부 기본값이 살아야 한다", async () => {
      renderScreen('?sort=close&dir=asc');
      await screen.findByText('2026년 노트북 및 모니터 구매');
      get.mockClear();

      fireEvent.change(screen.getByRole('combobox', { name: /정렬/ }), { target: { value: '' } });

      const listUrl = get.mock.calls
        .map(([url]) => url as string)
        .find((u) => u.startsWith('/api/search/notices?'))!;
      const params = new URLSearchParams(listUrl.split('?')[1]);
      expect(params.get('sort')).toBeNull();
      expect(params.get('dir')).toBeNull();
    });
  });

  it('정렬할 수 없는 컬럼은 머리글을 버튼으로 그리지 않는다', async () => {
    renderScreen();
    await screen.findByText('2026년 노트북 및 모니터 구매');
    // 공고명 컬럼은 공고번호를 함께 담으므로 라벨이 '공고명 · 공고번호'다(표를 간결하게 줄였다).
    expect(screen.getByLabelText('공고명 · 공고번호 정렬')).toBeInTheDocument();
    expect(screen.getByLabelText('마감일시 정렬')).toBeInTheDocument();
    // 화이트리스트 밖(단계·구분·지역 …)
    expect(screen.queryByLabelText('단계 정렬')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('지역 정렬')).not.toBeInTheDocument();
  });

  it('색인 기준 시각을 상태 줄에 적는다', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText(/색인 2026-08-06 09:20 기준/)).toBeInTheDocument());
  });
});
