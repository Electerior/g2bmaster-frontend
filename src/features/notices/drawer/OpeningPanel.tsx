/*
 * 개찰 경쟁 현황 — 참여업체별 투찰금액. 원본 fetchBidOpeningResults(app.js:4683).
 *
 * 입찰 공고 서랍과 입찰 결과 서랍이 함께 쓴다. 원래는 BidNoticeDrawer 안의 지역 컴포넌트였는데,
 * 입찰 결과 표에서 상세를 서랍으로 옮기면서 같은 표가 두 곳에 필요해졌다. 각자 그리면
 * '낙찰' 판정(sucsfbidYn) 같은 규칙이 한쪽에서만 고쳐지는 종류의 어긋남이 생긴다.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchBidOpeningResults, type BidOpeningParticipant } from '@/api';
import { Spinner } from '@/components/feedback/Spinner';
import { fmtBidRate, ordinalOf, rankOf, rankText } from '../rows';
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

interface OpeningPanelProps {
  item: OpeningTarget;
}

/**
 * 서랍을 열면 **바로 조회한다.**
 *
 * ## 예전에는 버튼을 눌러야 했다 — 그 이유가 사라졌다
 * 원본을 따라 버튼 클릭을 요구했고, 근거는 "서랍을 열 때마다 자동으로 부르면 아직 개찰 전인
 * 공고에서 매번 헛품을 판다"였다. 그때는 참말이었다. 이 조회에는 저장 계층이 없어서 요청이
 * 곧 상류 호출이었고, 완충은 백엔드 프로세스 메모리 캐시 하나뿐이라 재기동하면 통째로
 * 날아갔다(인스턴스끼리 공유되지도 않았다).
 *
 * 백엔드가 참여업체 명단을 `bid_opening_result` 에 저장하면서 그 전제가 사라졌다. 이제
 * 상류로 나가는 것은 **공고당 한 번**이고, 개찰 전이라 비어 온 것도 그 사실째 저장돼 6시간
 * 동안은 다시 묻지 않는다. 즉 자동 조회의 비용이 "열 때마다 상류"에서 "공고당 한 번"으로
 * 내려갔다. 그 대가로 얻는 것은, 사용자가 알고 싶은 것을 한 번 덜 눌러서 본다는 것이다 —
 * 서랍을 연 사람은 이미 "이 공고를 보여 달라"고 말한 것이다.
 *
 * 버튼은 남긴다. 다만 이제 그것은 **다시 조회**다(개찰이 방금 끝난 건을 확인할 때).
 */
export function OpeningPanel({ item }: OpeningPanelProps) {
  const noticeNo = String(item.bidNtceNo ?? '').trim();
  const query = useQuery({
    queryKey: ['bid-opening', noticeNo, ordinalOf(item)],
    queryFn: () =>
      fetchBidOpeningResults({
        bidNtceNo: noticeNo,
        bidNtceSqNo: ordinalOf(item),
        type: pick(item._type, item.bsnsDivNm) || '물품',
      }),
    // 공고번호가 없으면 물어볼 것이 없다 — 빈 번호로 나가면 서버가 400 분기를 탄다.
    enabled: noticeNo !== '',
  });

  const participants: BidOpeningParticipant[] = query.data?.participants ?? [];
  // 정렬 규칙은 rows.ts 에 둔다 — 빈 문자열 순위를 여기서만 막으면 담합 모달이 나중에
  // 순위를 그릴 때 같은 함정을 다시 밟는다.
  const sorted = [...participants].sort((a, b) => rankOf(a) - rankOf(b));

  return (
    <div className="drawer-section tight">
      <div className="drawer-section-label">
        개찰 경쟁 현황
        <button
          type="button"
          className="btn-opening-fetch"
          onClick={() => void query.refetch()}
          disabled={!noticeNo || query.isFetching}
          title="개찰이 방금 끝난 건이면 다시 받아옵니다"
        >
          다시 조회
        </button>
      </div>
      <div className="meta">
        {!noticeNo ? (
          '공고번호가 없어 개찰 결과를 조회할 수 없습니다.'
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
                        <td className="mid">{rankText(p)}</td>
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
