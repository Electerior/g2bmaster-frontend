import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentScanResponse, DecoratedRow } from '@/api';
import { useAttachmentScan } from './useAttachmentScan';

const mocks = vi.hoisted(() => ({ scanAttachments: vi.fn() }));

vi.mock('@/api', () => ({
  scanAttachments: mocks.scanAttachments,
}));

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function row(id: number, patch: DecoratedRow = {}): DecoratedRow {
  return { bidNtceNo: `R26BK${String(id).padStart(8, '0')}`, ...patch };
}

function response(patch: Partial<AttachmentScanResponse> = {}): AttachmentScanResponse {
  return {
    matches: [],
    exclusions: [],
    scanned: 0,
    cacheHits: 0,
    notIndexed: 0,
    notIndexedIds: [],
    warmQueued: 0,
    ...patch,
  };
}

function renderScan(items: DecoratedRow[], fileKeywords = ['제조사']) {
  return renderHook(
    () =>
      useAttachmentScan({
        kind: 'bid-announce',
        query: { pageNo: 0 },
        items,
        fileKeywords,
        excludeBlockingClauses: false,
        scanBlocking: false,
        enabled: true,
      }),
    { wrapper },
  );
}

beforeEach(() => {
  mocks.scanAttachments.mockReset();
});

describe('useAttachmentScan', () => {
  it('AI 게이트 없이 로컬 색인을 조회하고 source 또는 _source 를 요청에 싣는다', async () => {
    const items = [
      row(1, { source: 'G2B', _source: 'd2b' }),
      row(2, { _source: 'private-g2b' }),
    ];
    mocks.scanAttachments.mockResolvedValue(response({ scanned: 2, cacheHits: 2 }));

    const { result } = renderScan(items, []);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const body = mocks.scanAttachments.mock.calls[0][0];
    expect(body.scans.map((scan: { source?: string }) => scan.source)).toEqual([
      'G2B',
      'private-g2b',
    ]);
  });

  it('첨부 색인이 완전하면 파일 키워드에 실제로 매치된 행만 남긴다', async () => {
    const items = [row(1), row(2), row(3)];
    mocks.scanAttachments.mockImplementation(async (body: { scans: Array<{ id: string }> }) =>
      response({
        matches: [
          {
            id: body.scans[1].id,
            matchedKeywords: ['제조사'],
            excerpt: '제조사 확약서',
            documentTags: [],
          },
        ],
        scanned: 3,
        cacheHits: 3,
      }),
    );

    const { result } = renderScan(items);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.rows).toHaveLength(1);
    expect(result.current.data?.rows[0].bidNtceNo).toBe(items[1].bidNtceNo);
    expect(result.current.data?.matchCount).toBe(1);
  });

  it('청크별 notIndexed 를 합산하고 정확히 미색인 id만 거짓 음성으로 제거하지 않는다', async () => {
    const items = Array.from({ length: 51 }, (_, index) => row(index + 1));
    mocks.scanAttachments
      .mockImplementationOnce(async (body: { scans: Array<{ id: string }> }) =>
        response({
          matches: [
            {
              id: body.scans[0].id,
              matchedKeywords: ['제조사'],
              excerpt: '제조사 확약서',
              documentTags: [],
            },
          ],
          scanned: 50,
          cacheHits: 48,
          notIndexed: 2,
          notIndexedIds: [body.scans[1].id, body.scans[2].id],
        }),
      )
      .mockImplementationOnce(async (body: { scans: Array<{ id: string }> }) =>
        response({
          scanned: 1,
          notIndexed: 1,
          notIndexedIds: [body.scans[0].id],
        }),
      );

    const { result } = renderScan(items);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mocks.scanAttachments).toHaveBeenCalledTimes(2);
    expect(result.current.data?.notIndexed).toBe(3);
    // 첫 청크의 매치 1건 + 미색인 2건, 둘째 청크의 미색인 1건만 남는다.
    expect(result.current.data?.rows.map((item) => item.bidNtceNo)).toEqual([
      items[0].bidNtceNo,
      items[1].bidNtceNo,
      items[2].bidNtceNo,
      items[50].bidNtceNo,
    ]);
  });
});
