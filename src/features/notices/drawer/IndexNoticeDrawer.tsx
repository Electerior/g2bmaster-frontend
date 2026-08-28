/*
 * 공고 통합 검색의 상세 서랍.
 *
 * 목록은 본문 미리보기 300자만 싣고 오므로 여기서 `GET /api/search/notices/{id}` 를 한 번 더
 * 부른다 — 목록 20건에 본문 전문을 실으면 응답이 수백 KB가 되기 때문이다.
 *
 * 기존 세 서랍(BidNotice · Plan · PreSpec)과 달리 AI 요약을 호출하지 않는다. 색인 행에는
 * 첨부 본문이 없고(`notice_body` 는 목록 응답의 서술형 필드를 이어 붙인 검색용 텍스트다),
 * `aiSummary` 칸은 적재기가 절대 덮어쓰지 않는 자리라 값이 있으면 그것을 그대로 보여준다.
 */
import type { NoticeIndexItem } from '@/api/search';
import { useNoticeDetail } from '@/api/search';
import { TypeBadge } from '@/components/badges/Badge';
import { Collapsible } from '@/components/common/Collapsible';
import { Spinner } from '@/components/feedback/Spinner';
import { Drawer, DrawerHeader, DrawerMeta } from '@/components/overlay/Drawer';
import { fmtDisplayDatetime, fmtMoney } from '@/domain/format';
import { buildMetaRows } from './metaValues';
import {
  ddayLabel,
  institutionPair,
  lowestBidRateText,
  regionLabel,
} from '../indexRows';
import { SaveNoticeButton } from '../SaveNoticeButton';
import './indexNoticeDrawer.css';

interface IndexNoticeDrawerProps {
  /** 목록 행. 상세가 도착하기 전까지 이 값으로 먼저 그린다 — 서랍이 빈 채로 뜨지 않도록. */
  seed: NoticeIndexItem;
  onClose: () => void;
}

function moneyRow(value: number | null | undefined): string {
  return value == null ? '' : fmtMoney(value);
}

function datetimeRow(value: string | null | undefined): string {
  return value ? fmtDisplayDatetime(String(value)) : '';
}

export function IndexNoticeDrawer({ seed, onClose }: IndexNoticeDrawerProps) {
  // 공고번호는 출처 사이에서 겹칠 수 있다. 상세 조회와 캐시 모두 복합키 `(id, source)` 를 쓴다.
  const detail = useNoticeDetail(seed.id, seed.source);
  // 상세가 오면 그것을 쓰고, 오는 동안에는 목록 행으로 버틴다.
  const item: NoticeIndexItem = detail.data ?? seed;

  const title = String(item.noticeName ?? '').trim() || '공고 상세';
  const { primary, demand } = institutionPair(item);
  const price = item.priceDetail ?? {};
  const products = item.productList ?? [];
  const attachments = (item.attachmentUrls ?? []).filter((a) => a && a.url);
  const dday = ddayLabel(item.dday);

  const rows = buildMetaRows([
    // 값이 긴 항목은 wide(세 번째 인자 true)로 두 칸을 차지하게 한다.
    ['공고번호', item.noticeOrder ? `${item.id} (${item.noticeOrder}차)` : String(item.id), true],
    ['단계', item.category ?? ''],
    ['상태', item.state ?? ''],
    ['공고기관', primary, true],
    // 조달청 대행 공고는 공고기관과 수요기관이 다르다. 다를 때만 줄이 생긴다.
    ['수요기관', demand, true],
    ['지역', regionLabel(item.region)],
    ['품명', products.length ? products.map((p) => p.name).filter(Boolean).join(', ') : '', true],
    ['세부품명번호', item.detailProductCode ?? ''],
    [
      '배정예산',
      moneyRow(
        price.assignedBudget ?? (item.amountKind === 'assignedBudget' ? item.amount : undefined),
      ),
    ],
    [
      '추정가격',
      moneyRow(
        price.estimatedPrice ??
          item.estimatedPrice ??
          (item.amountKind === 'estimatedPrice' ? item.amount : undefined),
      ),
    ],
    /*
     * 누리장터·D2B 의 금액. 개념이 달라 적재기가 별도 키에 담는 값들이라(기준금액은 투찰 상한,
     * 기초예비가격은 예가 산정 기준) 추정가격 줄에 섞지 않고 자기 이름으로 적는다.
     * 이 두 줄이 없으면 목록에는 금액이 보이는데 서랍을 열면 아무 금액도 없는 상태가 된다.
     */
    [
      '기준금액',
      moneyRow(
        price.referenceAmount ??
          (item.amountKind === 'referenceAmount' ? item.amount : undefined),
      ),
    ],
    [
      '기초예비가격',
      moneyRow(
        price.basicExpectedPrice ??
          (item.amountKind === 'basicExpectedPrice' ? item.amount : undefined),
      ),
    ],
    ['단가', moneyRow(price.unitPrice)],
    [
      '수량',
      price.quantity == null ? '' : `${price.quantity.toLocaleString()}${price.unit ?? ''}`,
    ],
    // 부가세 — 배정예산·추정가격과 함께 오는 가격 상세의 한 축(priceDetail.vat).
    ['부가세', moneyRow(price.vat)],
    // 백분율 그대로 온다(88.000 = 88%).
    ['낙찰하한율', lowestBidRateText(item.lowestBidRate)],
    ['공고일', datetimeRow(item.createdDate), true],
    ['마감일시', datetimeRow(item.closeDate), true],
    ['D-DAY', dday ?? ''],
    ['담당자', item.officerName ?? ''],
    ['연락처', item.officerContact ?? ''],
    ['사전규격', item.beforeSpecRgstNo && item.beforeSpecRgstNo !== item.id ? item.beforeSpecRgstNo : ''],
    ['색인 갱신', datetimeRow(item.updatedAt)],
  ]);

  const rowsByLabel = new Map(rows.map((row) => [row.label, row]));
  const groupedRows = (labels: readonly string[]) =>
    labels.flatMap((label) => {
      const row = rowsByLabel.get(label);
      return row ? [row] : [];
    });

  const metaGroups = [
    {
      id: 'schedule',
      label: '핵심 일정',
      rows: groupedRows(['단계', '지역', '마감일시', 'D-DAY']),
    },
    {
      id: 'overview',
      label: '공고 정보',
      rows: groupedRows([
        '공고번호',
        '상태',
        '공고기관',
        '수요기관',
        '공고일',
      ]),
    },
    {
      id: 'commercial',
      label: '품목 및 금액',
      rows: groupedRows([
        '품명',
        '세부품명번호',
        '배정예산',
        '추정가격',
        '기준금액',
        '기초예비가격',
        '단가',
        '수량',
        '부가세',
        '낙찰하한율',
      ]),
    },
    {
      id: 'management',
      label: '담당 및 관리',
      rows: groupedRows(['담당자', '연락처', '사전규격', '색인 갱신']),
    },
  ].filter((group) => group.rows.length > 0 || (group.id === 'commercial' && products.length > 1));

  const body = String(item.noticeBody ?? item.bodyPreview ?? '').trim();

  return (
    <Drawer open onClose={onClose} label={title} className="index-notice-drawer">
      <DrawerHeader
        badge={<TypeBadge value={String(item.businessDivision ?? item.category ?? '공고')} />}
        onClose={onClose}
      />

      <div className="index-notice-drawer-intro">
        <h2 className="drawer-title">{title}</h2>

        {/*
          저장 액션. ★ 저장은 구현돼 있으나 부를 UI 가 없던 POST /api/saved-notices 를 잇는
          자리다(계약 §G). 이 버튼의 데이터와 mutation 배선은 바꾸지 않고 제목 옆에 배치한다.
        */}
        <div className="drawer-actions">
          <SaveNoticeButton item={item} variant="button" />
        </div>
      </div>

      {/*
        패널 본문은 하나의 스크롤 흐름이다 — 예전엔 메타·본문·첨부가 각자 스크롤돼 공고 내용이
        좁은 칸에 갇혀 잘렸다. 헤더·저장·푸터만 고정하고 이 안을 통째로 스크롤한다.
      */}
      <div className="drawer-body">
        <div className="index-notice-meta-groups">
          {metaGroups.map((group) => (
            <section
              className={`index-notice-meta-group index-notice-meta-group--${group.id}`}
              aria-labelledby={`index-notice-${group.id}-heading`}
              key={group.id}
            >
              <h3 className="drawer-section-label" id={`index-notice-${group.id}-heading`}>
                {group.label}
              </h3>
              <DrawerMeta rows={group.rows} variant="summary-list">
                {/* 품목번호와 품명 짝이 여럿일 때만 중복 없는 목록을 덧붙인다. */}
                {group.id === 'commercial' && products.length > 1 ? (
                  <div className="meta-productlist">
                    <div className="meta-productlist-label">물품목록 {products.length}건</div>
                    <ul className="meta-product-items" aria-label="물품목록">
                      {products.map((product, i) => (
                        <li key={`${product.code ?? ''}-${i}`}>
                          <span className="meta-product-code">{product.code ?? '-'}</span>
                          <span className="meta-product-name">{product.name ?? '-'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </DrawerMeta>
            </section>
          ))}
        </div>

        <section className="drawer-section index-notice-content" aria-labelledby="notice-body-heading">
          <h3 className="drawer-section-label" id="notice-body-heading">
            공고 내용
          </h3>
          <div className="drawer-summary">
            {detail.isPending ? (
              <div className="summary-text muted">
                <Spinner small /> 본문을 불러오는 중입니다.
              </div>
            ) : detail.error ? (
              <>
                {/* 상세가 실패해도 목록에서 받은 미리보기는 남아 있다 — 그것까지 감추지 않는다. */}
                <div className="summary-error">{detail.error.message}</div>
                {body ? <pre className="notice-body">{body}</pre> : null}
              </>
            ) : body ? (
              <pre className="notice-body">{body}</pre>
            ) : (
              <div className="summary-text muted">본문이 색인되지 않은 공고입니다.</div>
            )}

            {item.aiSummary ? (
              <Collapsible summary="AI 요약" defaultOpen>
                <div className="summary-text">{item.aiSummary}</div>
              </Collapsible>
            ) : null}
          </div>
        </section>

        {attachments.length ? (
          <section
            className="drawer-section tight index-notice-attachments"
            aria-labelledby="notice-attachments-heading"
          >
            <h3 className="drawer-section-label" id="notice-attachments-heading">
              첨부 {attachments.length}건
            </h3>
            <ul className="attachment-list">
              {attachments.map((file, i) => (
                <li key={`${file.url}-${i}`}>
                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                    {file.name || file.url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {item.sourceUrl ? (
        <div className="drawer-footer">
          <a
            className="btn-g2b-link"
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            나라장터에서 전체 보기 ↗
          </a>
        </div>
      ) : null}
    </Drawer>
  );
}
