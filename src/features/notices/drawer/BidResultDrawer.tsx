/*
 * 입찰 결과 상세 서랍.
 *
 * 예전에는 입찰 결과 표의 공고명을 누르면 **입찰 공고 서랍**(BidNoticeDrawer)이 열렸다.
 * 두 응답은 필드 집합이 절반쯤 다르다 — 공고 서랍이 그리는 품목번호·추정가격·계약방법·
 * 마감일시·담당자는 결과 응답에 아예 없어서 그 줄들이 통째로 사라졌고, 정작 결과에만 있는
 * 낙찰업체 사업자번호·대표자·연락처·주소는 어디에서도 볼 수 없었다. 게다가 결과 행에는
 * 첨부가 없는데도 AI 요약을 부르는 서랍이 열렸다.
 *
 * 그래서 결과 전용 서랍을 따로 둔다. 표에는 훑어보며 판단하는 값만 남기고(domain/columns
 * 'bid-result' 주석), 나머지는 전부 이리로 온다. 새로 부르는 API 는 없다 — 표가 이미 받아 둔
 * 행을 그대로 그리고, 참여업체별 투찰 내역만 기존 개찰 조회(OpeningPanel)를 재사용한다.
 */
import type { BidResultItem } from '@/api';
import { TypeBadge } from '@/components/badges/Badge';
import { Drawer, DrawerHeader, DrawerMeta } from '@/components/overlay/Drawer';
import { OpeningPanel } from './OpeningPanel';
import { buildMetaRows, dateText, datetimeText, moneyText, pick, telLink } from './metaValues';

/** 낙찰률. 서버가 '88' · '94.884' 처럼 이미 백분율 숫자로 준다(표의 'rate' 포맷과 같은 규칙). */
function rateText(value: unknown): string {
  const text = pick(value);
  return text ? `${text}%` : '';
}

/** 참여업체수. 숫자만 덩그러니 두면 금액과 헷갈려 단위를 붙인다. */
function participantText(value: unknown): string {
  const text = pick(value);
  return text ? `${text}개사` : '';
}

/**
 * 차수·재입찰번호처럼 "없음"이 '000' 으로 오는 자리.
 *
 * buildMetaRows 는 빈 값만 걸러내므로 '000' 은 살아남아, 대부분의 행에서 아무 뜻도 없는
 * 줄이 두 개 늘어난다. 여기서 미리 빈 문자열로 바꿔 그 줄째 버리게 한다.
 */
function meaningfulOrdinal(value: unknown): string {
  const text = pick(value);
  return !text || /^0+$/.test(text) ? '' : text;
}

interface BidResultDrawerProps {
  item: BidResultItem;
  onClose: () => void;
}

export function BidResultDrawer({ item, onClose }: BidResultDrawerProps) {
  const rows = buildMetaRows([
    ['공고번호', pick(item.bidNtceNo)],
    ['공고차수', meaningfulOrdinal(item.bidNtceOrd)],
    ['재입찰번호', meaningfulOrdinal(item.rbidNo)],
    ['수요기관', pick(item.dminsttNm), true],
    ['낙찰금액', moneyText(item.sucsfbidAmt)],
    ['낙찰률', rateText(item.sucsfbidRate)],
    ['참여업체수', participantText(item.prtcptCnum)],
    ['개찰일시', datetimeText(item.rlOpengDt)],
    ['낙찰확정일', dateText(item.fnlSucsfDate)],
    ['등록일시', datetimeText(item.rgstDt)],
    ['낙찰업체', pick(item.bidwinnrNm), true],
    ['사업자번호', pick(item.bidwinnrBizno)],
    ['대표자', pick(item.bidwinnrCeoNm)],
    ['전화', telLink(item.bidwinnrTelNo)],
    ['주소', pick(item.bidwinnrAdrs), true],
    ['확정 담당', pick(item.fnlSucsfCorpOfcl)],
    ['출처', pick(item._sourceLabel)],
    /*
     * '상태' 줄을 지웠다 — 이 화면에서는 **언제나 '공고'** 였다.
     *
     * `_noticeStatus` 는 백엔드가 `ntceKindNm`/`rgstTyNm` 중 하나를 고르고 둘 다 비면 '공고'
     * 를 채우는 필드인데(`BidEnrichment.java:140-141`), 낙찰정보 오퍼레이션
     * (`getScsbidListSttus{Thng,Servc,Cnstwk}`) 응답 20~21개 필드에 그 둘이 **없다**.
     * 색인 적재든 단건 조회든 예외 없이 '공고'다.
     *
     * 낙찰 확정 건이든 재입찰 건이든 구분이 없으니 "아직 공고 단계인가?" 로 읽히거나
     * 상태가 갱신되지 않는다고 오해하게 만든다. 바로 위 '출처'('나라장터')는 실제 정보라 남긴다.
     */
  ]);

  return (
    <Drawer open onClose={onClose} label={String(item.bidNtceNm ?? '입찰 결과 상세')}>
      <DrawerHeader badge={<TypeBadge value={String(item._type ?? '결과')} />} onClose={onClose} />
      <h2 className="drawer-title">{String(item.bidNtceNm ?? '입찰 결과 상세')}</h2>

      <div className="drawer-body">
        <DrawerMeta rows={rows} />
        {/* 낙찰가만으로는 경쟁이 얼마나 붙었는지 알 수 없다 — 투찰 내역이 그 자리를 채운다. */}
        <OpeningPanel item={item} />
      </div>
    </Drawer>
  );
}
