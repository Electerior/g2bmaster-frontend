/*
 * 통합 검색 결과의 상세 서랍.
 *
 * 목록은 본문을 300자만 들고 있다(응답 크기 때문에). 서랍을 열 때 상세를 따로 받아
 * 본문 전문·품목 전체·첨부 목록을 채운다.
 *
 * `features/notices/drawer/*` 와 합치지 않은 이유: 그쪽 서랍은 팬아웃 검색 행(원본 G2B
 * 필드명 그대로인 snake/camel 혼합)을 받고 AI 요약·가격표·법령 검토까지 붙는다.
 * 이 화면의 행은 색인의 22개 컬럼뿐이라 모양이 아예 다르다.
 */
import { Drawer, DrawerHeader, DrawerMeta, type MetaRow } from '@/components/overlay/Drawer';
import { TypeBadge } from '@/components/badges/Badge';
import { fmtDisplayDatetime, fmtMoney } from '@/domain/format';
import { useNoticeIndexDetail, type NoticeIndexItem } from '@/api/searchNotices';
import { StageBadge } from './cells';
import { regionLabel } from './labels';
import './searchIndex.css';

interface Props {
  /** 열려 있는 공고. null 이면 서랍이 닫힌다. */
  selected: NoticeIndexItem | null;
  onClose: () => void;
}

export function IndexNoticeDrawer({ selected, onClose }: Props) {
  // 목록 행을 먼저 보여주고, 상세가 도착하면 본문·품목이 채워진다. 로딩 동안 빈 서랍을
  // 띄우지 않는 것이 목적이다 — 이미 아는 값(공고명·기관·금액)은 즉시 보여줄 수 있다.
  const detail = useNoticeIndexDetail(selected?.id ?? null);
  const item = detail.data ?? selected;

  if (!item) return null;

  const institution =
    item.noticeInstitutionName ??
    item.demandInstitutionName ??
    item.noticeInstitutionCode ??
    item.demandInstitutionCode;

  const price = item.priceDetail;
  const rows: MetaRow[] = [
    { label: '공고번호', value: `${item.id}${item.noticeOrder ? ` (${item.noticeOrder}차)` : ''}` },
    { label: '발주기관', value: institution ?? '—' },
    { label: '지역', value: regionLabel(item.region) },
    { label: '공고일', value: fmtDisplayDatetime(item.createdDate ?? '') || '—' },
    {
      label: '마감일',
      value: item.closeDate
        ? `${fmtDisplayDatetime(item.closeDate)}${item.dday === null ? '' : ` (D${item.dday >= 0 ? '-' : '+'}${Math.abs(item.dday)})`}`
        : '—',
    },
    { label: '담당자', value: [item.officerName, item.officerContact].filter(Boolean).join(' · ') || '—' },
  ];

  if (price?.estimatedPrice) {
    rows.push({ label: '추정가격', value: `${fmtMoney(price.estimatedPrice)}원` });
  }
  if (price?.assignedBudget) {
    rows.push({ label: '배정예산', value: `${fmtMoney(price.assignedBudget)}원` });
  }
  if (price?.unitPrice) {
    rows.push({
      label: '단가',
      value: `${fmtMoney(price.unitPrice)}원${price.quantity ? ` × ${price.quantity}${price.unit ?? ''}` : ''}`,
    });
  }
  if (item.lowestBidRate !== null) {
    rows.push({ label: '낙찰하한율', value: `${item.lowestBidRate}%` });
  }
  if (item.detailProductCode) {
    rows.push({ label: '세부품명번호', value: item.detailProductCode });
  }
  // 사전규격등록번호는 생애주기를 잇는 끈이다 — 사전규격 행에서는 자기 번호와 같다.
  if (item.beforeSpecRgstNo && item.beforeSpecRgstNo !== item.id) {
    rows.push({ label: '사전규격등록번호', value: item.beforeSpecRgstNo });
  }

  return (
    <Drawer open onClose={onClose} label={item.noticeName}>
      <DrawerHeader
        badge={
          <span>
            <StageBadge category={item.category} state={item.state} />{' '}
            <TypeBadge value={item.businessDivision} />
          </span>
        }
        onClose={onClose}
      />

      <div className="index-drawer-body">
        <h2 className="index-drawer-title">{item.noticeName}</h2>

        <DrawerMeta rows={rows} />

        {item.productList?.length ? (
          <>
            <h3 className="panel-title">물품목록 ({item.productList.length})</h3>
            <ul className="index-product-list">
              {item.productList.map((product, index) => (
                <li key={`${product.code}-${product.seq}-${index}`}>
                  {product.name}
                  {product.code ? <span className="muted"> ({product.code})</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {item.attachmentUrls?.length ? (
          <>
            <h3 className="panel-title">첨부파일 ({item.attachmentUrls.length})</h3>
            <ul className="index-attachments">
              {item.attachmentUrls.map((file) => (
                <li key={file.url}>
                  {/* 나라장터 원본 링크라 새 창으로 연다. noreferrer 는 외부 링크의 기본값. */}
                  <a href={file.url} target="_blank" rel="noreferrer">
                    {file.name}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {item.aiSummary ? (
          <>
            <h3 className="panel-title">AI 요약</h3>
            <p className="index-notice-body">{item.aiSummary}</p>
          </>
        ) : null}

        {item.noticeBody ? (
          <>
            <h3 className="panel-title">공고 본문</h3>
            <p className="index-notice-body">{item.noticeBody}</p>
          </>
        ) : null}

        {item.sourceUrl ? (
          <p style={{ marginTop: 16 }}>
            <a className="bid-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
              나라장터에서 원본 공고 보기 →
            </a>
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}
