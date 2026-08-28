/*
 * 발주 계획 상세 서랍 — 원본 renderPlanModalDetail(app.js:4323) + runItemAnalysis(5243).
 *
 * (원본 openPlanModal 은 `return renderPlanModalDetail(item)` 뒤에 40여 줄의 죽은 코드를
 *  달고 있었다. 옛 렌더러가 통째로 남아 있던 것이라 이식하지 않는다.)
 */
import { useQuery } from '@tanstack/react-query';
import { isAiEnabled, summarizeNotice, type BidPlanItem } from '@/api';
import { Drawer, DrawerHeader, DrawerMeta } from '@/components/overlay/Drawer';
import { loadCompanyProfile } from '@/domain/storage';
import { collectFileEntries, firstPageUrl, PAGE_URL_KEYS } from '../rows';
import { RawFieldsBlock, SpecContentBlock } from './meta';
import { buildMetaRows, datetimeText, emailLink, moneyText, pick, telLink } from './metaValues';
import { AiFallbackNote, ParsedFiles, SummaryBody, SummaryState } from './summaryParts';

interface PlanDrawerProps {
  item: BidPlanItem;
  onClose: () => void;
}

export function PlanDrawer({ item, onClose }: PlanDrawerProps) {
  // 계획·사전규격·입찰공고는 같은 단일 요약 표면을 쓴다.
  const aiEnabled = isAiEnabled();
  const summary = useQuery({
    queryKey: ['notice-summary', 'bid-plan', pick(item.prcrmntReqNo, item.orderPlanUntyNo, item.bidNtceNo)],
    enabled: aiEnabled,
    queryFn: () =>
      summarizeNotice({
        // 원본 runItemAnalysis 의 entityType 판정 그대로 — 조달요청 > 사전규격 > 공고 순.
        entityType: item.prcrmntReqNo ? 'procurement_request' : item.bidNtceNo ? 'bid_notice' : '',
        prcrmntReqNo: String(item.prcrmntReqNo ?? ''),
        bidNtceNo: String(item.bidNtceNo ?? ''),
        bidNtceSqNo: String(item.bidNtceSqNo ?? item.bidNtceOrd ?? ''),
        title: pick(item.bizNm, item.prcrmntReqNm, item.prdctClsfcNoNm, item.bidNtceNm),
        insttNm: pick(item.orderInsttNm, item.dminsttNm, item.ntceInsttNm),
        itemName: pick(item.prdctClsfcNoNm, item.rprsntPrdctClsfcNoNm, item.dtilPrdctClsfcNoNm),
        amount: pick(item.sumOrderAmt, item.bdgtAmt, item.rprsntAmt, item.presmptPrce),
        cntrctMthdNm: pick(item.cntrctMthdNm, item.cntrctCnclsStleNm, item.cntrctCnclsMthdNm),
        type: pick(item.bsnsDivNm) || 'bid-plan',
        companyProfile: loadCompanyProfile(),
        fileEntries: collectFileEntries(item),
        rawFields: item,
      }),
    staleTime: Infinity,
  });

  const title = pick(item.bizNm, item.prcrmntReqNm, item.bidNtceNm) || '발주계획 상세';
  const qty = item.rprsntQty ? `${pick(item.rprsntQty)} ${pick(item.rprsntUnit)}`.trim() : '';
  const deadline = pick(
    item.rprsntDedtDate,
    item.dlvrTmlmtDt,
    item.rprsntDlvrDaynum ? `${pick(item.rprsntDlvrDaynum)}일` : '',
  );

  const rows = buildMetaRows([
    ['조달요청번호', pick(item.prcrmntReqNo)],
    ['발주계획번호', pick(item.orderPlanUntyNo)],
    ['연결공고번호', pick(item.bidNtceNo)],
    ['업무구분', pick(item.bsnsDivNm)],
    ['발주기관', pick(item.orderInsttNm, item.dminsttNm, item.ntceInsttNm)],
    ['수요기관', pick(item.dminsttNm, item.rlDminsttNm)],
    ['품목', pick(item.prdctClsfcNoNm, item.rprsntPrdctClsfcNoNm, item.dtilPrdctClsfcNoNm)],
    ['계약방법', pick(item.cntrctMthdNm, item.cntrctCnclsStleNm, item.cntrctCnclsMthdNm)],
    [
      '예산금액',
      moneyText(pick(item.sumOrderAmt, item.bdgtAmt, item.rprsntAmt, item.presmptPrce)),
    ],
    ['대표단가', moneyText(item.rprsntUprc)],
    ['수량', qty],
    ['납품장소', pick(item.rprsntDlvrPlce)],
    ['납품기한', deadline],
    ['발주시기', pick(item.orderMnth)],
    ['접수/공개일', datetimeText(pick(item.rcptDt, item.nticeDt, item.bidNtceDt))],
    ['입찰마감', datetimeText(item.bidClseDt)],
    ['담당자', pick(item.prcrmntReqOfclNm, item.ofclNm, item.ntceInsttOfclNm)],
    ['전화', telLink(pick(item.prcrmntReqOfclTelNo, item.ntceInsttOfclTelNo, item.ofclTelNo, item.telNo))],
    [
      '이메일',
      emailLink(
        pick(
          item.prcrmntReqOfclEmailAdrs,
          item.ntceInsttOfclEmailAdrs,
          item.ofclEmailAdrs,
          item.emailAdrs,
        ),
      ),
    ],
  ]);

  const linkUrl = firstPageUrl(item, PAGE_URL_KEYS);
  const data = summary.data;

  return (
    <Drawer open onClose={onClose} label={title}>
      <DrawerHeader
        badge={
          <span
            className="drawer-badge"
            style={{ background: 'var(--blue-soft)', color: 'var(--primary)' }}
          >
            {pick(item.bsnsDivNm) || '발주계획'}
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
              ['대표 규격', pick(item.rprsntSpecDtlsCntnts, item.specCntnts)],
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
