/*
 * 통합 검색 화면 렌더 테스트.
 *
 * 이 화면에서 조용히 틀리기 쉬운 것들을 고정한다:
 *  - 지역이 빈 문자열인 공고를 '전국'으로 읽어 주는가 (빈칸이면 데이터 누락으로 오해한다)
 *  - 마감일시가 없는 계획 단계에 D-DAY 를 지어내지 않는가
 *  - 기관명이 없을 때(dm_institution 미적재) 코드라도 보여주는가
 *  - 조건이 URL 로 올라가는가 (조건이 곧 주소라는 앱 전체의 규약)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoticeSearchScreen } from '@/routes/NoticeSearchScreen';
import * as apiClient from '@/lib/apiClient';
import type { NoticeIndexItem } from '@/api/searchNotices';

function item(overrides: Partial<NoticeIndexItem> = {}): NoticeIndexItem {
  return {
    id: 'R26BK01610168',
    noticeOrder: '000',
    noticeName: '실험실용 공급기기 구매',
    category: '입찰',
    state: null,
    businessDivision: '물품',
    region: '경기도',
    demandInstitutionCode: 'B553968',
    demandInstitutionName: '한국어촌어항공단',
    noticeInstitutionCode: 'B553968',
    noticeInstitutionName: '한국어촌어항공단',
    beforeSpecRgstNo: null,
    productList: [{ seq: '1', code: '4110412701', name: '실험실용공급기기' }],
    detailProductCode: '4110412701',
    lowestBidRate: 88,
    priceDetail: { estimatedPrice: 27200000, assignedBudget: 29920000 },
    createdDate: '2026-07-01T07:25:26',
    closeDate: '2026-07-07T10:00:00',
    updatedAt: '2026-07-01T08:00:00',
    officerName: '강혜인',
    officerContact: '02-6098-0736',
    aiSummary: null,
    attachmentUrls: null,
    sourceUrl: 'https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=R26BK01610168',
    bodyPreview: '실험실용 공급기기 구매',
    dday: 6,
    estimatedPrice: 27200000,
    ...overrides,
  };
}

/** 현재 URL 을 화면에 노출해 조건이 주소로 올라갔는지 확인한다. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

/** 행은 {@link stubApi} 가 공급한다 — 여기서는 화면만 띄운다. */
function renderScreen(initialEntry = '/search') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/search"
            element={
              <>
                <NoticeSearchScreen />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** get() 을 URL 로 갈라 목록·패싯·현황을 각각 돌려준다. */
function stubApi(items: NoticeIndexItem[]) {
  return vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
    if (url.includes('/facets')) {
      return {
        category: [{ value: '입찰', count: items.length }],
        division: [{ value: '물품', count: items.length }],
        region: [{ value: '경기도', count: 1 }],
        state: [],
      } as never;
    }
    if (url.includes('/status')) {
      return {
        sources: [],
        summary: [{ category: '입찰', count: items.length, last_indexed_at: '2026-07-05T09:00:00' }],
        knownSources: [],
      } as never;
    }
    return { items, totalCount: items.length, pageNo: 1, numOfRows: 20 } as never;
  });
}

describe('NoticeSearchScreen', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('공고를 목록으로 그린다', async () => {
    stubApi([item()]);
    renderScreen();

    expect(await screen.findByText('실험실용 공급기기 구매')).toBeInTheDocument();
    expect(screen.getByText('한국어촌어항공단')).toBeInTheDocument();
    expect(screen.getByText('D-6')).toBeInTheDocument();
  });

  /**
   * 서버는 지역을 좁혀도 '전국(빈 값)' 공고를 함께 돌려준다 — 참여할 수 있기 때문이다.
   * 그때 화면이 빈칸을 보여주면 사용자는 필터가 고장 난 줄 안다.
   */
  it('지역이 비어 있으면 전국으로 읽어 준다', async () => {
    stubApi([item({ region: '' })]);
    renderScreen();

    expect(await screen.findByText('전국')).toBeInTheDocument();
  });

  it('마감일시가 없는 계획 단계에는 D-DAY 를 만들지 않는다', async () => {
    const plan = item({
      id: 'R26DC00231563',
      category: '계획',
      noticeName: '하수처리시설 부품 구입',
      closeDate: null,
      dday: null,
    });
    stubApi([plan]);
    renderScreen();

    expect(await screen.findByText('하수처리시설 부품 구입')).toBeInTheDocument();
    // 'D-DAY' 는 컬럼 헤더라 늘 있다. 여기서 없어야 하는 것은 숫자가 붙은 셀 값이다.
    expect(screen.queryByText(/^D-\d/)).not.toBeInTheDocument();
    expect(screen.queryByText('D-DAY', { selector: 'strong' })).not.toBeInTheDocument();
    // '계획'은 단계 필터 칩에도 있다 — 행의 배지인 것을 클래스로 못박는다.
    expect(screen.getByText('계획', { selector: '.stage-badge' })).toBeInTheDocument();
  });

  /**
   * 조달청 대행 공고는 공고기관과 수요기관이 다르다. 공고기관만 쓰면 목록이 온통 '조달청'이
   * 되어 누가 실제로 사는지 알 수 없고, 수요기관만 쓰면 문의처를 잃는다.
   */
  it('공고기관과 수요기관이 다르면 둘 다 보여준다', async () => {
    const agency = item({
      noticeInstitutionName: '조달청 강원지방조달청',
      demandInstitutionName: '강원대학교',
    });
    stubApi([agency]);
    renderScreen();

    expect(await screen.findByText('조달청 강원지방조달청')).toBeInTheDocument();
    expect(screen.getByText('수요 강원대학교')).toBeInTheDocument();
  });

  it('공고기관과 수요기관이 같으면 한 번만 보여준다', async () => {
    stubApi([item()]);
    renderScreen();

    expect(await screen.findAllByText('한국어촌어항공단')).toHaveLength(1);
  });

  /** 사전규격은 기관코드가 없고 이름만 온다 — 코드 기준으로 그리면 통째로 빈칸이 된다. */
  it('코드가 없어도 기관명만으로 표시된다', async () => {
    const preSpec = item({
      category: '사전규격',
      noticeInstitutionCode: null,
      demandInstitutionCode: null,
      noticeInstitutionName: '국방과학연구소',
      demandInstitutionName: '국방과학연구소',
    });
    stubApi([preSpec]);
    renderScreen();

    expect(await screen.findByText('국방과학연구소')).toBeInTheDocument();
  });

  /** 이름을 아직 못 받은 행도 빈칸으로 두지 않는다 — 빈칸은 '기관 없음'으로 읽힌다. */
  it('기관명이 없으면 기관코드라도 보여준다', async () => {
    const nameless = item({ noticeInstitutionName: null, demandInstitutionName: null });
    stubApi([nameless]);
    renderScreen();

    expect(await screen.findByText('B553968')).toBeInTheDocument();
  });

  it('취소 공고는 상태 배지로 구분된다', async () => {
    const cancelled = item({ state: '취소' });
    stubApi([cancelled]);
    renderScreen();

    expect(await screen.findByText('취소')).toBeInTheDocument();
  });

  it('검색어를 확정하면 조건이 URL 로 올라간다', async () => {
    stubApi([item()]);
    renderScreen();
    await screen.findByText('실험실용 공급기기 구매');

    const input = screen.getByLabelText('검색어');
    await userEvent.type(input, '냉난방기{Enter}');

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toContain('q=%EB%83%89%EB%82%9C%EB%B0%A9%EA%B8%B0');
    });
  });

  /** 단계 칩은 이 화면의 1급 필터다 — 누르면 URL 의 category 가 바뀌어야 한다. */
  it('단계 칩을 누르면 category 조건이 URL 에 붙는다', async () => {
    stubApi([item()]);
    renderScreen();
    await screen.findByText('실험실용 공급기기 구매');

    await userEvent.click(screen.getByRole('button', { name: /^사전규격/ }));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toContain('category=');
    });
  });

  /*
   * '마감' 단계 × activeOnly 회귀 테스트.
   *
   * activeOnly('마감 전 공고만 보기')는 기본 ON 인데, 마감 단계 행은 정의상 마감일이 전부
   * 과거라 둘을 함께 쓰면 서버 조건 (close_date IS NULL OR close_date >= NOW()) 을 절대
   * 통과하지 못한다 — 마감 칩이 항상 0건이 되는 버그가 실제로 있었다.
   */
  it("'마감' 칩을 누르면 activeOnly 를 끄고 질의한다", async () => {
    const spy = stubApi([item()]);
    renderScreen();
    await screen.findByText('실험실용 공급기기 구매');

    await userEvent.click(screen.getByRole('button', { name: '마감' }));

    // 마감 조건이 붙은 요청(목록·패싯 모두)에 activeOnly 가 함께 나가면 안 된다.
    await waitFor(() => {
      const closed = spy.mock.calls
        .map(([url]) => decodeURIComponent(String(url)))
        .filter((url) => url.includes('category=마감'));
      expect(closed.length).toBeGreaterThan(0);
      for (const url of closed) expect(url).not.toContain('activeOnly');
    });

    // 체크박스는 꺼진 채 잠긴다 — 켤 수 있으면 같은 0건 함정이 그대로 남는다.
    const checkbox = screen.getByRole('checkbox', { name: '마감 전 공고만 보기' });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeDisabled();
  });

  it("'마감' 칩을 해제하면 activeOnly 가 기본값(켜짐)으로 돌아온다", async () => {
    stubApi([item()]);
    renderScreen();
    await screen.findByText('실험실용 공급기기 구매');

    await userEvent.click(screen.getByRole('button', { name: '마감' }));
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: '마감 전 공고만 보기' })).toBeDisabled();
    });

    // 같은 칩을 다시 누르면 '전체'로 돌아간다.
    await userEvent.click(screen.getByRole('button', { name: '마감' }));

    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox', { name: '마감 전 공고만 보기' });
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeEnabled();
    });
    // 기본값이므로 URL 에도 흔적이 남지 않아야 한다.
    expect(screen.getByTestId('location').textContent).not.toContain('activeOnly');
  });

  /** 공유 URL 로 바로 들어와도 같아야 한다 — 칩 클릭만 고치면 이 경로가 그대로 0건이다. */
  it('URL 로 category=마감 에 바로 들어와도 activeOnly 를 끈다', async () => {
    const spy = stubApi([item()]);
    renderScreen('/search?category=%EB%A7%88%EA%B0%90');
    await screen.findByText('실험실용 공급기기 구매');

    const closed = spy.mock.calls
      .map(([url]) => decodeURIComponent(String(url)))
      .filter((url) => url.includes('category=마감'));
    expect(closed.length).toBeGreaterThan(0);
    for (const url of closed) expect(url).not.toContain('activeOnly');
    expect(screen.getByRole('checkbox', { name: '마감 전 공고만 보기' })).not.toBeChecked();
  });

  it('결과가 없으면 안내 문구를 보여준다', async () => {
    stubApi([]);
    renderScreen();

    expect(await screen.findByText(/조건에 맞는 공고가 없습니다/)).toBeInTheDocument();
  });
});
