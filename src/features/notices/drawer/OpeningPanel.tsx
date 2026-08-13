/*
 * 개찰 경쟁 현황 — 참여업체별 투찰금액. 원본 fetchBidOpeningResults(app.js:4683).
 *
 * 입찰 공고 서랍과 입찰 결과 서랍이 함께 쓴다. 원래는 BidNoticeDrawer 안의 지역 컴포넌트였는데,
 * 입찰 결과 표에서 상세를 서랍으로 옮기면서 같은 표가 두 곳에 필요해졌다. 각자 그리면
 * '낙찰' 판정(sucsfbidYn) 같은 규칙이 한쪽에서만 고쳐지는 종류의 어긋남이 생긴다.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchBidOpeningResults, type BidOpeningParticipant } from '@/api';
import { Spinner } from '@/components/feedback/Spinner';
import { pick } from './metaValues';

/**
 * 개찰을 조회하는 데 필요한 최소한의 모양.
 *
 * 구체 타입(BidAnnounceItem·BidResultItem) 대신 이 구조만 요구한다 — 둘은 필드 집합이
 * 절반쯤 다르고, 이 패널이 쓰는 것은 여기 적힌 넷뿐이다.
 */
export interface OpeningTarget {
  bidNtceNo?: string;
  /** 입찰 공고 계열의 차수. 입찰 결과 응답에는 이 이름이 없고 bidNtceOrd 로 온다. */
  bidNtceSqNo?: string;
  bidNtceOrd?: string;
  _type?: string;
  bsnsDivNm?: string;
}

function fmtBidAmount(value: unknown): string {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isNaN(n) || !n ? '-' : `${n.toLocaleString()}원`;
}

function fmtBidRate(value: unknown): string {
  const n = parseFloat(String(value ?? ''));
  return Number.isNaN(n) ? '-' : `${n.toFixed(3)}%`;
}

/** 차수. 두 계통이 이름을 달리 쓰므로 한 군데서 고른다 — 없으면 원본과 같은 '000'. */
function ordinalOf(item: OpeningTarget): string {
  return String(item.bidNtceSqNo ?? item.bidNtceOrd ?? '000');
}

interface OpeningPanelProps {
  item: OpeningTarget;
}

/**
 * 버튼을 눌러야 조회한다 — 원본과 같다.
 * 서랍을 열 때마다 자동으로 부르면 아직 개찰 전인 공고에서 매번 헛품을 판다.
 */
export function OpeningPanel({ item }: OpeningPanelProps) {
  const [requested, setRequested] = useState(false);
  const query = useQuery({
    queryKey: ['bid-opening', item.bidNtceNo ?? '', ordinalOf(item)],
    queryFn: () =>
      fetchBidOpeningResults({
        bidNtceNo: String(item.bidNtceNo ?? ''),
        bidNtceSqNo: ordinalOf(item),
        type: pick(item._type, item.bsnsDivNm) || '물품',
      }),
    enabled: requested,
  });

  const participants: BidOpeningParticipant[] = query.data?.participants ?? [];
  const sorted = [...participants].sort((a, b) => Number(a.rank ?? 99) - Number(b.rank ?? 99));

  return (
    <div className="drawer-section tight">
      <div className="drawer-section-label">
        개찰 경쟁 현황
        <button
          type="button"
          className="btn-opening-fetch"
          onClick={() => (requested ? void query.refetch() : setRequested(true))}
        >
          조회
        </button>
      </div>
      <div className="meta">
        {!requested ? (
          '버튼을 누르면 참여업체별 투찰금액을 조회합니다.'
        ) : query.isPending || query.isFetching ? (
          <>
            <Spinner small /> 조회 중...
          </>
        ) : query.error ? (
          <span style={{ color: 'var(--error)' }}>조회 실패: {query.error.message}</span>
        ) : !sorted.length ? (
          '개찰결과 미공개 또는 아직 집계 전입니다.'
        ) : (
          <>
            <div className="opening-table-wrap">
              <table className="opening-table">
                <thead>
                  <tr>
                    <th>순위</th>
                    <th style={{ textAlign: 'left' }}>업체명</th>
                    <th className="num">투찰금액</th>
                    <th className="num">투찰율</th>
                    <th>낙찰</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => {
                    const won = String(p.sucsfbidYn ?? '').toUpperCase() === 'Y';
                    return (
                      <tr key={`${p.bdrNm ?? ''}-${i}`} className={won ? 'win' : undefined}>
                        <td className="mid">{p.rank ?? '-'}</td>
                        <td>{p.bdrNm ?? '-'}</td>
                        <td className="num">{fmtBidAmount(p.bidAmt)}</td>
                        <td className="num">{fmtBidRate(p.bidprcRt)}</td>
                        <td className="mid">{won ? '✅ 낙찰' : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="opening-note">총 {participants.length}개사 참여</div>
          </>
        )}
      </div>
    </div>
  );
}
