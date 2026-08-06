/*
 * 통합 검색 결과의 셀 조각들.
 *
 * 표와 서랍이 같은 것을 그리므로(단계 배지·지역) 한곳에 둔다 — 두 곳에 복사해 두면
 * '전국' 표기 같은 규칙이 한쪽에서만 바뀐다.
 */
import type { NoticeCategory, NoticeState } from '@/api/searchNotices';
import { isNationwide, regionLabel } from './labels';
// .dday-expired 는 badges.css 소유다 — 여기서 쓰므로 여기서도 명시적으로 들여온다.
import '@/components/badges/badges.css';
import './searchIndex.css';

export function RegionCell({ region }: { region: string }) {
  return (
    <span className={isNationwide(region) ? 'region-all' : undefined}>{regionLabel(region)}</span>
  );
}

/**
 * 단계 배지 + 상태.
 *
 * 상태(취소·재·다시·정정)는 넷 다 예외라 단계 옆에 따로 붙인다. 특히 '취소'는 이미 접힌
 * 발주라 목록에서 즉시 구분되어야 한다 — 모르고 검토하면 시간을 통째로 버린다.
 */
export function StageBadge({
  category,
  state,
}: {
  category: NoticeCategory;
  state: NoticeState | null;
}) {
  return (
    <>
      <span className={`stage-badge stage-${category}`}>{category}</span>
      {state ? <span className="state-badge">{state}</span> : null}
    </>
  );
}

/**
 * D-day.
 *
 * 서버가 날짜 단위로 계산해 보내 준다(시각이 아니라). 마감이 없는 계획 단계는 null 이라
 * 아무것도 그리지 않는다 — '0일'로 표시하면 오늘 마감인 것처럼 보인다.
 */
export function DdayCell({ dday }: { dday: number | null }) {
  if (dday === null) return null;
  if (dday < 0) return <span className="dday-expired">마감</span>;
  return <strong>{dday === 0 ? 'D-DAY' : `D-${dday}`}</strong>;
}
