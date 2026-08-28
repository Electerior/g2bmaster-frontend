/*
 * 입찰 공고 상세 서랍 — 원본 openBidModal(app.js:4186) + runAnalysis(5310) +
 * fetchOpeningResults(4683).
 *
 * 원본은 서랍 DOM 하나를 세 렌더 함수가 나눠 썼다. 그래서 "지금 열려 있는 것이 공고인가
 * 발주계획인가"를 currentBidItem 이 null 인지로 구분했고, 개찰 조회 버튼은 그 전역이
 * 비어 있으면 조용히 아무 일도 하지 않았다. 변종을 컴포넌트로 나누면 그 분기가 사라진다 —
 * 개찰 조회는 이 컴포넌트에만 있으므로 대상이 없을 수가 없다.
 */
import { useQuery } from '@tanstack/react-query';
import { isAiEnabled, summarizeNotice, type BidAnnounceItem } from '@/api';
import { TypeBadge } from '@/components/badges/Badge';
import { Drawer, DrawerHeader, DrawerMeta } from '@/components/overlay/Drawer';
import { loadCompanyProfile } from '@/domain/storage';
import { collectFileEntries, firstPageUrl } from '../rows';
import { OpeningPanel } from './OpeningPanel';
import {
  buildMetaRows,
  datetimeText,
  dateText,
  ddayValue,
  emailLink,
  moneyText,
  pick,
  telLink,
} from './metaValues';
import { AiFallbackNote, ParsedFiles, SummaryBody, SummaryState } from './summaryParts';

interface BidNoticeDrawerProps {
  item: BidAnnounceItem;
  onClose: () => void;
}

export function BidNoticeDrawer({ item, onClose }: BidNoticeDrawerProps) {
  // 단일 공고 요약(POST /api/notice-summary)은 빌드타임 플래그가 켜졌을 때만 호출한다.
  // 로컬·운영에서 백엔드 AI 설정과 명시적으로 맞추기 위한 스위치다.
  const aiEnabled = isAiEnabled();

  // 서랍을 열면 곧바로 분석이 돌아간다(원본 openBidModal 끝의 runAnalysis()).
  // useQuery 로 두면 같은 공고를 다시 열었을 때 캐시가 살아 있어 두 번 부르지 않는다.
  const summary = useQuery({
    queryKey: ['notice-summary', 'bid-notice', item.bidNtceNo ?? '', item.bidNtceSqNo ?? item.bidNtceOrd ?? ''],
    enabled: aiEnabled,
    queryFn: () => {
      const fileEntries = collectFileEntries(item);
      // 표준공고서는 파일 URL 패턴에 안 걸리는 경우가 있어 따로 붙인다(원본 app.js:5320).
      const stdUrl = String(item.stdNtceDocUrl ?? '');
      if (stdUrl && !fileEntries.some((f) => f.url === stdUrl)) {
        fileEntries.push({ url: stdUrl, name: '표준공고서' });
      }
      return summarizeNotice({
        entityType: 'bid_notice',
        bidNtceNo: String(item.bidNtceNo ?? ''),
        bidNtceSqNo: String(item.bidNtceSqNo ?? item.bidNtceOrd ?? '000'),
        bidNtceNm: String(item.bidNtceNm ?? ''),
        ntceInsttNm: String(item.ntceInsttNm ?? ''),
        presmptPrce: (item.presmptPrce ?? '') as string | number,
        cntrctCnclsMthdNm: String(item.cntrctCnclsMthdNm ?? ''),
        dtilPrdctClsfcNoNm: String(item.dtilPrdctClsfcNoNm ?? ''),
        _type: String(item._type ?? ''),
        companyProfile: loadCompanyProfile(),
        fileEntries,
        rawFields: item,
      });
    },
    // 요약은 LLM 호출이라 비싸다. 같은 공고를 오가는 동안은 다시 부르지 않는다.
    staleTime: Infinity,
  });

  const rows = buildMetaRows([
    ['품목번호', pick(item.prdctClsfcNo, item.dtilPrdctClsfcNo)],
    ['품목명', pick(item.prdctClsfcNoNm, item.dtilPrdctClsfcNoNm)],
    ['공고번호', pick(item.bidNtceNo)],
    ['공고기관', pick(item.ntceInsttNm)],
    ['수요기관', pick(item.dminsttNm)],
    ['추정가격', moneyText(item.presmptPrce)],
    ['계약방법', pick(item.cntrctCnclsMthdNm)],
    ['낙찰방법', pick(item.sucsfbidMthdNm)],
    ['제한/자격', pick(item._requirementSummary)],
    ['품목분류', pick(item.dtilPrdctClsfcNoNm)],
    ['공고일', dateText(item.bidNtceDt)],
    ['마감일시', datetimeText(item.bidClseDt)],
    ['D-DAY', ddayValue(item.bidClseDt)],
    ['담당자', pick(item.ntceInsttOfclNm)],
    ['전화', telLink(item.ntceInsttOfclTelNo)],
    ['이메일', emailLink(item.ntceInsttOfclEmailAdrs)],
  ]);

  const g2bUrl = firstPageUrl(item, ['bidNtceUrl', 'bidNtceDtlUrl']);
  const data = summary.data;

  return (
    <Drawer open onClose={onClose} label={String(item.bidNtceNm ?? '공고 상세')}>
      <DrawerHeader
        badge={<TypeBadge value={String(item._type ?? '공고')} />}
        onClose={onClose}
      />
      <h2 className="drawer-title">{String(item.bidNtceNm ?? '공고 상세')}</h2>

      {/* 본문 전체를 하나의 스크롤 흐름으로 — 메타·AI분석·개찰이 각자 잘리지 않게. */}
      <div className="drawer-body">
        <DrawerMeta rows={rows} />

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

        <OpeningPanel item={item} />
      </div>

      {g2bUrl ? (
        <div className="drawer-footer">
          <a
            className="btn-g2b-link"
            href={g2bUrl}
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
