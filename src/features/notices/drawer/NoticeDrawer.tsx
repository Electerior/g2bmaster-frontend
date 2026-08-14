/*
 * 서랍 선택기 — 어떤 행을 눌렀는지에 따라 세 변종 중 하나를 마운트한다.
 *
 * 원본은 서랍 DOM 하나(#bid-drawer)를 openBidModal / renderPlanModalDetail / openSpecModal
 * 셋이 나눠 쓰면서 `currentBidItem` 전역으로 "지금 무엇이 열려 있는지"를 구분했다.
 * 여기서는 열린 것 자체가 타입을 들고 있으므로 그 전역이 필요 없다.
 */
import type { BidAnnounceItem, BidPlanItem, BidResultItem, PreSpecItem } from '@/api';
import { BidNoticeDrawer } from './BidNoticeDrawer';
import { BidResultDrawer } from './BidResultDrawer';
import { PlanDrawer } from './PlanDrawer';
import { PreSpecDrawer } from './PreSpecDrawer';

export type DrawerSelection =
  | { variant: 'notice'; item: BidAnnounceItem }
  /*
   * 입찰 결과는 공고와 필드 집합이 절반쯤 달라 같은 서랍을 쓸 수 없다 — 자세한 이유는
   * BidResultDrawer 머리말 참고.
   */
  | { variant: 'result'; item: BidResultItem }
  | { variant: 'plan'; item: BidPlanItem }
  | { variant: 'spec'; item: PreSpecItem };

interface NoticeDrawerProps {
  selection: DrawerSelection | null;
  onClose: () => void;
}

export function NoticeDrawer({ selection, onClose }: NoticeDrawerProps) {
  if (!selection) return null;
  switch (selection.variant) {
    case 'notice':
      return <BidNoticeDrawer item={selection.item} onClose={onClose} />;
    case 'result':
      return <BidResultDrawer item={selection.item} onClose={onClose} />;
    case 'plan':
      return <PlanDrawer item={selection.item} onClose={onClose} />;
    case 'spec':
      return <PreSpecDrawer item={selection.item} onClose={onClose} />;
  }
}
