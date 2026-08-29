/*
 * 들러리 매트릭스 — 화면에서만 틀리는 네 가지에 대한 잠금 장치.
 *
 * 1) 요청 5필드. 입찰 결과 행은 차수를 bidNtceOrd 로, 개찰일을 rlOpengDt 로 준다.
 *    원본 매핑(bidNtceSqNo·opengDt)을 그대로 베끼면 타입은 통과하는데 서버가 받는 값이
 *    조용히 비고, 공고명·개찰일은 서버가 요청을 그대로 되돌려 주는 값이라 3번째 표가 빈다.
 * 2) avgRate 는 0 이 유효값이다. truthy 로 판정하면 '0.000%' 가 '-' 로 사라진다.
 * 3) winBidprcRt 는 숫자가 아니라 문자열("80")로 온다. .toFixed() 를 직접 부르면 터진다.
 * 4) 빈 응답에서 세 표 모두 빈 상태를 그려야 한다 — 지금 상류 개찰결과가 응답하지 않아
 *    이것이 사실상 기본 화면이다.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollusionAnalysisResponse } from '@/api/analysis';
import type { ScannedRow } from '../rows';

const post = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  get: vi.fn(),
  post: (url: string, body: unknown) => post(url, body),
  del: vi.fn(),
  apiClient: {},
  ApiError: class ApiError extends Error {},
}));

const { CollusionModal } = await import('./CollusionModal');

/** 입찰 결과 응답 행의 모양 그대로 — 차수는 bidNtceOrd, 개찰일은 rlOpengDt 다. */
const ROW: ScannedRow = {
  bidNtceNo: 'R26BK01629628',
  bidNtceOrd: '001',
  bidNtceNm: '교복 학교주관 구매',
  rlOpengDt: '2026-08-11 11:00:00',
  _type: '물품',
};

const EMPTY: CollusionAnalysisResponse = { bids: [], pairs: [], companies: [] };

function renderModal(rows: ScannedRow[] = [ROW]) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CollusionModal open onClose={() => {}} rows={rows} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  post.mockReset();
});

describe('들러리 매트릭스', () => {
  it('입찰 결과 행의 이름 차이를 흡수해 5필드를 보낸다', async () => {
    post.mockResolvedValue(EMPTY);
    renderModal();
    await screen.findByText(/개찰결과 확인/);

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/api/collusion-analysis');
    expect(body).toEqual({
      bids: [
        {
          bidNtceNo: 'R26BK01629628',
          // bidNtceSqNo 가 없으므로 bidNtceOrd 로 채워야 한다 — '000' 이면 회귀다.
          bidNtceSqNo: '001',
          bidNtceNm: '교복 학교주관 구매',
          opengDate: '2026-08-11 11:00:00',
          _type: '물품',
        },
      ],
    });
  });

  it('20건을 넘겨도 서버 상한만큼만 보낸다', async () => {
    post.mockResolvedValue(EMPTY);
    const rows = Array.from({ length: 25 }, (_, i) => ({ ...ROW, bidNtceNo: `R${i}` }));
    renderModal(rows);
    await screen.findByText(/개찰결과 확인/);
    expect(post.mock.calls[0][1].bids).toHaveLength(20);
  });

  it('평균 투찰율 0 을 값으로 그린다 — 0 이 사라지면 회귀다', async () => {
    post.mockResolvedValue({
      ...EMPTY,
      companies: [
        {
          name: '영점산업',
          wins: 0,
          runnerUp: 1,
          appearances: 2,
          avgRate: 0,
          rateHistory: [0, 0],
          isMonotonicallyIncreasing: false,
          cases: [],
        },
      ],
    } satisfies CollusionAnalysisResponse);
    renderModal();
    expect(await screen.findByText('0.000%')).toBeInTheDocument();
  });

  it('투찰율이 문자열로 와도 렌더가 터지지 않는다', async () => {
    post.mockResolvedValue({
      bids: [],
      companies: [],
      pairs: [
        {
          a: '가건설',
          b: '나건설',
          total: 4,
          aWins: 2,
          bWins: 2,
          alterScore: 1,
          suspicionScore: 4,
          cases: [
            {
              bidNtceNo: 'R1',
              bidNtceNm: '어느 공사',
              winner: '가건설',
              runnerUp: '나건설',
              winBidprcRt: '80',
              runBidprcRt: '81.5',
              opengDate: '2026-08-01',
            },
          ],
        },
      ],
    } satisfies CollusionAnalysisResponse);
    renderModal();
    expect(await screen.findByText('80.000%')).toBeInTheDocument();
    expect(screen.getByText('81.500%')).toBeInTheDocument();
    // 의심점수 4 는 임계값 3 이상이라 고위험이다. 색이 아니라 이모지가 구분자다.
    expect(screen.getByText(/🔴/)).toBeInTheDocument();
  });

  it('빈 응답에서 세 표가 모두 빈 상태를 그린다', async () => {
    post.mockResolvedValue(EMPTY);
    renderModal();
    expect(await screen.findByText('함께 나타난 업체 짝이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('투찰 이력을 모을 업체가 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('1 · 2위를 짝지을 개찰 결과가 없습니다.')).toBeInTheDocument();
    // 개찰결과를 하나도 못 받았다는 사실이 숫자로 드러나야 한다.
    expect(screen.getByText('0건')).toBeInTheDocument();
  });
});
