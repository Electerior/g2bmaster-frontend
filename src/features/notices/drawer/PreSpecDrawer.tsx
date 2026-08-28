/*
 * 사전 규격 상세 서랍 — 원본 openSpecModal(app.js:4431) + runSpecAnalysis(4535).
 *
 * 발주 계획 서랍과 뼈대가 같지만 셋이 다르다: 배지 색(사전규격은 호박색), 메타 항목,
 * 그리고 규격서 링크(lnkUrl)를 첨부 목록에 손으로 밀어 넣는 것. 마지막 것이 요점이다 —
 * 사전 규격은 규격서가 lnkUrl 한 칸에만 있는 경우가 흔한데, 그 필드는 이름만 보면
 * "상세 페이지"라 collectFileEntries 가 걸러 낸다.
 */
import { useQuery } from '@tanstack/react-query';
import { isAiEnabled, summarizeNotice, type PreSpecItem } from '@/api';
import { Drawer, DrawerHeader, DrawerMeta } from '@/components/overlay/Drawer';
import { loadCompanyProfile } from '@/domain/storage';
import { collectFileEntries, firstPageUrl, firstProductDetail, isDownloadLikeUrl, PAGE_URL_KEYS } from '../rows';
import { RawFieldsBlock, SpecContentBlock } from './meta';
import { buildMetaRows, datetimeText, ddayValue, moneyText, pick } from './metaValues';
import { AiFallbackNote, ParsedFiles, SummaryBody, SummaryState } from './summaryParts';

interface PreSpecDrawerProps {
  item: PreSpecItem;
  onClose: () => void;
}

export function PreSpecDrawer({ item, onClose }: PreSpecDrawerProps) {
  // 품목번호·품명이 비어 있으면 물품 상세 목록의 첫 항목에서 채운다(원본 openSpecModal 앞머리).
  const detail = firstProductDetail(item.prdctDtlList);
  const itemCode = pick(item.prdctClsfcNo, item.dtilPrdctClsfcNo, detail?.code);
  const itemName = pick(item.prdctClsfcNoNm, item.dtilPrdctClsfcNoNm, detail?.name);

  // 계획·사전규격·입찰공고는 같은 단일 요약 표면을 쓴다.
  const aiEnabled = isAiEnabled();
  const summary = useQuery({
    queryKey: ['notice-summary', 'pre-spec', pick(item.bfSpecRgstNo, item.prdctClfcNo)],
    enabled: aiEnabled,
    queryFn: () => {
      const fileEntries = collectFileEntries(item);
      const lnkUrl = String(item.lnkUrl ?? '');
      if (isDownloadLikeUrl(lnkUrl) && !fileEntries.some((f) => f.url === lnkUrl)) {
        fileEntries.push({ url: lnkUrl, name: itemName || '규격서' });
      }
      return summarizeNotice({
        entityType: 'pre_spec',
        title: itemName,
        bfSpecRgstNo: pick(item.bfSpecRgstNo, item.prdctClfcNo),
        insttNm: pick(item.ntceInsttNm, item.orderInsttNm),
        itemName,
        amount: pick(item.asignBdgtAmt),
        cntrctMthdNm: pick(item.cntrctMthdNm),
        type: pick(item.bsnsDivNm) || '물품',
        companyProfile: loadCompanyProfile(),
        fileEntries,
        rawFields: item,
      });
    },
    staleTime: Infinity,
  });

  const title = itemName || '사전규격 상세';
  const rows = buildMetaRows([
    ['규격번호', pick(item.prdctClfcNo, item.bfSpecRgstNo)],
    ['품목번호', itemCode],
    ['품목명', itemName],
    ['업무구분', pick(item.bsnsDivNm)],
    ['발주기관', pick(item.ntceInsttNm, item.orderInsttNm)],
    ['수요기관', pick(item.rlDminsttNm, item.dminsttNm)],
    ['예산금액', moneyText(item.asignBdgtAmt)],
    ['접수일', datetimeText(pick(item.pstDt, item.rcptDt, item.rgstDt))],
    ['의견마감', datetimeText(item.opninRgstClseDt)],
    ['D-DAY', ddayValue(item.opninRgstClseDt)],
  ]);

  const linkUrl = firstPageUrl(item, PAGE_URL_KEYS);
  const data = summary.data;

  return (
    <Drawer open onClose={onClose} label={title}>
      <DrawerHeader
        badge={
          <span
            className="drawer-badge"
            style={{ background: 'var(--spec-badge-bg)', color: 'var(--spec-badge-fg)' }}
          >
            {pick(item.bsnsDivNm) || '사전규격'}
          </span>
        }
        onClose={onClose}
      />
      <h2 className="drawer-title">{title}</h2>
      <div className="drawer-body">
        <DrawerMeta rows={rows}>
          <SpecContentBlock
            productDetailList={item.prdctDtlList}
            rows={[
              ['규격 내용', item.specCntnts],
              ['용도', item.usgCntnts],
              ['수량 정보', item.qtyCntnts],
              ['물품 상세', item.prdctDtlList],
              ['비고', pick(item.rmrkCntnts, item.rmrk)],
            ]}
          />
          <RawFieldsBlock item={item} />
        </DrawerMeta>

        <div className="drawer-section">
          <div className="drawer-section-label">✨ AI 요약</div>
          <div className="drawer-summary">
            {!aiEnabled ? (
              <div className="summary-text muted">
                AI 요약이 비활성화되어 있습니다. VITE_AI_ENABLED=true로 켤 수 있습니다.
              </div>
            ) : (
              <SummaryState
                isPending={summary.isPending}
                error={summary.error}
                onRetry={() => void summary.refetch()}
                pendingText="AI 요약 중... 잠시만 기다려 주세요."
              >
                {data ? (
                  <>
                    <AiFallbackNote flags={data} />
                    {data.summary ? <SummaryBody summary={data.summary} /> : null}
                    <ParsedFiles parsedFiles={data.parsedFiles} />
                  </>
                ) : null}
              </SummaryState>
            )}
          </div>
        </div>
      </div>

      {linkUrl ? (
        <div className="drawer-footer">
          <a className="btn-g2b-link" href={linkUrl} target="_blank" rel="noopener noreferrer">
            나라장터에서 전체 보기 ↗
          </a>
        </div>
      ) : null}
    </Drawer>
  );
}
