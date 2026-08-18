/*
 * 공고 하나의 가격 분석 — `POST /api/deal-analysis` 를 그대로 그린다.
 *
 * 앞선 판은 사무용 PC 7대 구성을 박아 둔 fixture 였다. 화면 구조를 잡는 데는 제 역할을 했지만
 * 어느 공고를 열어도 같은 숫자가 떠서, 984,941,000원짜리 전산모사 시스템 공고에도 대당
 * 1,354,340원이 적혀 있었다. 조달 판단에 쓰이는 화면에서 그것보다 나쁜 상태는 없다.
 *
 * **자동으로 부르지 않는다 — 저장분은 자동으로 꺼낸다.** deep 분석은 규격서 첨부를
 * 내려받아 파싱하고, LLM 으로 부품을 뽑고, 부품마다 다나와를 긁는다. 그래서 사람이 누를 때만
 * 돌리되, 패널이 열릴 때 {@code cacheOnly} 로 저장된 결과가 있는지 먼저 물어보고 있으면 즉시
 * 보여준다 — 첫 탭이어도 공고를 훑는 동안 새 분석 비용은 나가지 않는다.
 *
 * **모르는 것은 비워 둔다.** 원가를 못 구하면 0 을 채우지 않고 서버가 준 안내(note)를 그대로
 * 보여 준다. 0 은 '공짜'로 읽히고, 마진 100% 가 되어 이 화면에서 가장 좋은 딜처럼 보인다.
 */
import { useEffect, useState } from 'react';
import { useDealAnalysis, type DealAnalysisResponse } from '@/api/analysis';
import type { NoticeIndexItem } from '@/api/search';
import { fmtDisplayDatetime, fmtMoney } from '@/domain/format';
import { amountKindLabel } from '../indexRows';
import './priceAnalysis.css';

/**
 * 부가세율. 목록의 마진율 열과 **같은 기준**이어야 한다(백엔드 `V20260814132535`).
 *
 * 한 공고에 대해 목록과 상세가 다른 마진율을 적으면 어느 쪽이 맞는지 사용자가 가릴 수 없다.
 * 대표 금액은 부가세 별도, 원가는 부가세 포함이라 분모를 실추정가로 맞춘다.
 */
const VAT = 1.1;

/**
 * 이 패널이 켜는 분석 갈래.
 *
 * <b>시가(market)와 개찰(opening)을 끈다 — 이 화면이 그 값을 쓰지 않기 때문이다.</b> 마진은
 * 목록의 마진율 열과 같은 기준(실추정가)으로 내고, 개찰 참여업체는 다른 화면의 몫이다. 둘 다
 * 바깥 조회(나라장터)라 켜 두면 응답만 늦어지고 화면에는 아무것도 더해지지 않는다.
 *
 * 규격서(spec)와 부품 단가(parts)는 켠 채로 둔다 — 그 둘이 이 패널 자체다.
 *
 * ⚠ 이걸 꺼도 <b>빠르지는 않다.</b> 실측에서 응답 지연을 지배한 것은 시가가 아니라 첨부
 * 다운로드·파싱이었다(첨부 3개짜리 공고는 7분에도 끝나지 않았고, 그때 AI 서비스 로그에는
 * 요청이 도착조차 하지 않았다 — 시간은 전부 그 앞단에서 쓰였다). 첨부 하나짜리 공고는 같은
 * 조건에서 규격서 6,524자를 정상적으로 파싱해 돌아왔다. 그래서 화면의 대기 문구는 '몇 분'을
 * 말한다 — 여기서 '곧 끝난다'고 적으면 사용자는 화면이 멈춘 것으로 읽는다.
 */
const ANALYSIS_SCOPE = { market: false, opening: false } as const;

interface PriceAnalysisPanelProps {
  item: NoticeIndexItem;
}

/**
 * 분석 요청에 싣는 공고 객체. 백엔드는 **나라장터 원본 필드명**을 읽는다.
 *
 * <b>첨부는 `attachmentUrls: [{name, url}]` 로 넘긴다</b> — 색인이 주는 모양 그대로다.
 * 딜 분석의 규격서 선택기(`MarketIntelController.parseSpecAttachment`)가 이 키만 읽기 때문이다.
 * 같은 저장소의 요약 계열은 나라장터 원본처럼 번호가 붙은 평평한 필드(`atchFileUrl1..10`)를
 * `FileEntryCollector` 로 훑는데, 그쪽 규칙을 여기에 적용하면 첨부가 통째로 무시된다. 실측으로
 * 확인했다: 평평한 필드로 보내면 `spec` 이 null 이고, 이 키로 보내면 HWPX 를 내려받아 6,524자를
 * 파싱한다. 어느 쪽이든 화면에는 오류가 뜨지 않고 "규격서를 찾지 못했다"만 남으므로,
 * 틀린 키를 쓰면 아무도 눈치채지 못한 채 분석이 늘 비어 있게 된다.
 */
function toAnalysisItem(item: NoticeIndexItem): Record<string, unknown> {
  return {
    bidNtceNo: item.id,
    bidNtceNm: item.noticeName,
    // 예산은 서버가 고른 대표 금액을 그대로 넘긴다 — 목록의 금액 칸이 그린 값과 같아야 한다.
    presmptPrce: item.amount ?? item.estimatedPrice ?? undefined,
    dtilPrdctClsfcNoNm: item.productList?.map((p) => p.name).filter(Boolean).join(', ') || undefined,
    // 공고번호만으로는 행이 특정되지 않는다(색인 PK 가 (id, source)).
    source: item.source ?? undefined,
    attachmentUrls: (item.attachmentUrls ?? []).filter((file) => file?.url),
  };
}

export function PriceAnalysisPanel({ item }: PriceAnalysisPanelProps) {
  const analysis = useDealAnalysis();
  const result = analysis.data;
  // cacheOnly 요청에서 저장분이 없으면 `_notCached` 만 온다 — 화면은 "분석 전"을 그린다.
  const hasResult = result != null && !result._notCached;
  // 사용자가 실제 분석(forceRefresh)을 돌리고 있는가 — cacheOnly 조회와 구분한다.
  const [running, setRunning] = useState(false);

  // 패널이 열릴 때 저장된 분석을 먼저 꺼내 본다. 있으면 즉시, 없으면 분석을 돌리지 않고
  // "분석 전" 화면을 유지한다 — 첫 탭이라도 자동으로 deep 분석이 돌지 않게 하는 지름길이다.
  useEffect(() => {
    analysis.reset();
    analysis.mutate(
      { item: toAnalysisItem(item), deep: true, include: ANALYSIS_SCOPE, cacheOnly: true },
      { onError: () => {} },
    );
    // item.id 가 바뀌면(다른 공고) 다시 꺼내 본다. analysis 는 훅이 매 렌더마다 주는 객체라
    // 의존성에 넣으면 루프가 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const budget = item.amount ?? item.estimatedPrice ?? null;
  const kind = amountKindLabel(item.amountKind);

  return (
    <div
      className="price-analysis drawer-body"
      role="tabpanel"
      id="notice-price-panel"
      aria-labelledby="notice-price-tab"
      tabIndex={0}
    >
      <div className="price-analysis-intro">
        <div>
          <div className="price-analysis-kicker">가격 분석</div>
          <p>
            저장된 분석이 있으면 바로 보여주고, 없으면 버튼으로 분석을 실행합니다. 처음 한 번은
            시간이 걸리고, 결과는 저장돼 다음부터 즉시 뜹니다.
          </p>
        </div>
        <button
          type="button"
          className="price-analysis-run"
          onClick={() => {
            setRunning(true);
            analysis.mutate(
              {
                item: toAnalysisItem(item),
                deep: true,
                include: ANALYSIS_SCOPE,
                // '다시 분석'은 저장분을 재사용하지 않는다 — 시세·로직이 바뀌었을 수 있다.
                forceRefresh: true,
              },
              { onSettled: () => setRunning(false) },
            );
          }}
          disabled={analysis.isPending}
        >
          {analysis.isPending ? (running ? '분석 중…' : '확인 중…') : hasResult ? '다시 분석' : '가격 분석 실행'}
        </button>
      </div>

      {!hasResult && !analysis.isPending && !analysis.isError ? (
        <IdleNotice budget={budget} kind={kind} />
      ) : null}

      {running ? (
        <p className="price-analysis-state" role="status">
          규격서를 열어 부품과 시세를 확인하고 있습니다. 첨부가 여러 개면 <strong>몇 분</strong>
          걸립니다 — 서랍을 닫아도 분석은 계속되고, 결과는 저장돼 다음에 바로 뜹니다.
        </p>
      ) : null}

      {analysis.isError ? (
        <p className="price-analysis-state price-analysis-error" role="alert">
          분석에 실패했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}

      {hasResult ? <AnalysisResult result={result} budget={budget} kind={kind} /> : null}
    </div>
  );
}

/** 아직 분석하지 않았을 때 — 공고 자체가 이미 아는 것만 적는다. 지어내지 않는다. */
function IdleNotice({ budget, kind }: { budget: number | null; kind: string | null }) {
  return (
    <dl className="price-analysis-summary" aria-label="공고가 이미 아는 값">
      <div>
        <dt>{kind ?? '금액'}</dt>
        <dd>{budget == null ? '미공개' : fmtMoney(budget)}</dd>
        <span>부가세 별도</span>
      </div>
      <div>
        <dt>실추정가</dt>
        <dd>{budget == null ? '-' : fmtMoney(Math.round(budget * VAT))}</dd>
        <span>= {kind ?? '금액'} × 1.1</span>
      </div>
      <div>
        <dt>매입원가</dt>
        <dd>-</dd>
        <span>분석 전</span>
      </div>
      <div>
        <dt>마진율</dt>
        <dd>-</dd>
        <span>분석 전</span>
      </div>
    </dl>
  );
}

function AnalysisResult({
  result,
  budget,
  kind,
}: {
  result: DealAnalysisResponse;
  budget: number | null;
  kind: string | null;
}) {
  const deal = result.deal;
  const cost = deal?.hasCost ? deal.cost : null;
  const quantity = result.facts?.quantity ?? deal?.quantity ?? null;
  const estimated = result.estimatedUnitCost;
  const rows = estimated?.matched ? estimated.breakdown : [];
  // 확정(accepted) 행만 mid×수량으로 더한 추론 합계 — 요약의 '대당 매입원가'와 같은 근거다.
  const inferredTotal = rows
    .filter((row) => row.acceptedForCost !== false && row.low != null)
    .reduce((sum, row) => sum + Math.round(((row.low as number) + (row.high ?? (row.low as number))) / 2) * row.qty, 0);

  // 마진은 목록의 마진율 열과 같은 식으로 낸다(실추정가 기준). 분모가 없거나 원가를 모르면
  // 계산하지 않는다 — 0 으로 채우면 '남는 게 없는 딜'로 읽힌다.
  const base = budget == null ? null : Math.round(budget * VAT);
  const profit = base != null && cost != null ? base - cost : null;
  const marginRate = base && profit != null ? (profit / base) * 100 : null;
  const costShare = base && cost != null ? (cost / base) * 100 : null;

  return (
    <>
      {result._fromCache ? (
        <p className="price-analysis-cache">
          저장된 분석 결과입니다
          {result._analyzedAt ? ` · ${fmtDisplayDatetime(result._analyzedAt)} 기준` : ''}. 시세는
          움직이므로 발주 직전에는 다시 분석하세요.
        </p>
      ) : null}

      <dl className="price-analysis-summary" aria-label="가격 분석 요약">
        <div>
          <dt>{kind ?? '금액'}</dt>
          <dd>{budget == null ? '미공개' : fmtMoney(budget)}</dd>
          <span>부가세 별도</span>
        </div>
        <div>
          <dt>수량</dt>
          <dd>{quantity == null ? '-' : `${quantity}`}</dd>
          <span>{quantitySourceLabel(result)}</span>
        </div>
        <div>
          <dt>대당 매입원가</dt>
          <dd>{deal?.unitCost == null ? '-' : fmtMoney(deal.unitCost)}</dd>
          <span>{costSourceLabel(deal?.unitCostSource)}</span>
        </div>
        <div>
          <dt>총 매입원가</dt>
          <dd>{cost == null ? '-' : fmtMoney(cost)}</dd>
          <span>VAT 포함</span>
        </div>
        <div className="price-analysis-summary-emphasis">
          <dt>예상 매출총이익</dt>
          <dd>{profit == null ? '산출 불가' : fmtMoney(profit)}</dd>
          <span>
            {marginRate == null
              ? '원가나 예산 중 하나를 모릅니다'
              : `실추정가 기준 · ${marginRate.toFixed(1)}%`}
          </span>
        </div>
      </dl>

      {costShare != null ? (
        <section className="price-analysis-section" aria-labelledby="price-structure-title">
          <div className="price-analysis-section-heading">
            <div>
              <h3 id="price-structure-title">가격 구조</h3>
              <p>실추정가에서 매입원가와 예상 이익이 차지하는 비중</p>
            </div>
            <strong>{marginRate?.toFixed(1)}% 마진</strong>
          </div>
          <div
            className="price-analysis-composition"
            role="img"
            aria-label={`매입원가 ${costShare.toFixed(1)}%, 예상 이익 ${(100 - costShare).toFixed(1)}%`}
          >
            {/* 역마진이면 원가가 100% 를 넘는다 — 막대를 100 에서 자르고 숫자로 사실을 적는다. */}
            <span className="price-analysis-cost-part" style={{ flexGrow: Math.min(costShare, 100) }}>
              원가 {costShare.toFixed(1)}%
            </span>
            {costShare < 100 ? (
              <span className="price-analysis-profit-part" style={{ flexGrow: 100 - costShare }}>
                이익 {(100 - costShare).toFixed(1)}%
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {rows.length ? (
        <section className="price-analysis-section" aria-labelledby="price-items-title">
          <div className="price-analysis-section-heading">
            <div>
              <h3 id="price-items-title">품목별 원가</h3>
              <p>규격서에서 뽑은 구성 · 1대 기준</p>
            </div>
            <span>{rows.length}개 품목</span>
          </div>
          <div className="price-analysis-table-wrap">
            <table className="price-analysis-table">
              <caption className="sr-only">품목별 원가 명세</caption>
              <thead>
                <tr>
                  <th scope="col">품목</th>
                  <th scope="col">구성</th>
                  <th scope="col">수량</th>
                  <th scope="col">단가</th>
                  <th scope="col">합계</th>
                  <th scope="col">가격 기준</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const rejected = row.acceptedForCost === false;
                  const mid =
                    row.low == null
                      ? null
                      : Math.round((row.low + (row.high ?? row.low)) / 2);
                  return (
                    <tr
                      key={`${row.category}-${row.option}-${index}`}
                      className={rejected ? 'price-analysis-rejected' : undefined}
                    >
                      <th scope="row">{row.role === 'base' ? '베어본' : row.category}</th>
                      <td>
                        {row.substitute ? (
                          <>
                            <span className="price-analysis-substitute">{row.product}</span>
                            <span className="price-analysis-requirement" title={row.matchReason}>
                              요구: {row.requirement ?? row.option}
                            </span>
                          </>
                        ) : row.source === 'itmaya' ? (
                          // ITMAYA 행의 product 는 베어본 모델코드("ESC4000-E11")라 option(옵션 설명명)을 보여준다.
                          row.option || row.product
                        ) : (
                          row.product || row.option
                        )}
                      </td>
                      <td className="price-analysis-number">{row.qty}</td>
                      {/* 단가는 mid(최저~최고 평균) 기준 — 합계가 추론 합계와 맞아떨어지게 한다. */}
                      <td
                        className="price-analysis-number"
                        title={
                          mid != null && row.low !== row.high
                            ? `최저 ${fmtMoney(row.low ?? 0)} ~ 최고 ${fmtMoney(row.high ?? 0)}`
                            : undefined
                        }
                      >
                        {rejected ? '제외' : mid == null ? '미확인' : fmtMoney(mid)}
                      </td>
                      <td className="price-analysis-number">
                        {rejected || mid == null ? '-' : fmtMoney(mid * row.qty)}
                      </td>
                      <td>
                        <span
                          className={
                            rejected || row.inferred
                              ? 'price-analysis-source negotiated'
                              : 'price-analysis-source'
                          }
                          title={row.substitute ? row.matchReason : undefined}
                        >
                          {rejected
                            ? row.source === 'llm-estimate'
                              ? '추정값(참고)'
                              : row.substitute
                                ? '대체 미승인'
                                : rejectReasonLabel(row.rejectReason)
                            : row.substitute
                              ? '유사 대체'
                              : row.inferred
                                ? '추론'
                                : (row.source ?? '시세')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.some((row) => row.low != null) ? (
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={3}>
                      추론 합계
                    </th>
                    <td className="price-analysis-number">1대 기준</td>
                    <td className="price-analysis-number">{fmtMoney(inferredTotal)}</td>
                    <td>
                      {rows.some((row) => row.acceptedForCost === false)
                        ? '제외 행 제외'
                        : '전 항목 반영'}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
          {estimated?.matched && estimated.allPriced === false ? (
            <p className="price-analysis-state">
              가격을 확인하지 못한 부품이 있어 합계가 실제보다 낮습니다.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 서버가 준 안내는 그대로 옮긴다 — 왜 원가가 없는지는 서버만 안다. */}
      {result.note ? (
        <aside className="price-analysis-caution" aria-label="분석 안내">
          <strong>원가를 구하지 못했습니다</strong>
          <p>{result.note}</p>
        </aside>
      ) : null}

      <aside className="price-analysis-caution" aria-label="산정 전 확인">
        <strong>산정 전 확인</strong>
        <p>
          배송비·설치비·A/S 충당금과 발주 시점의 가격 변동은 반영하지 않았습니다. 추정 원가는
          발주 전에 공급처로 재확인하세요.
        </p>
      </aside>
    </>
  );
}

/** 수량이 어디서 왔는지. 규격서에서 읽은 수량은 사람이 덮어쓸 수 있어야 하므로 출처를 밝힌다. */
function quantitySourceLabel(result: DealAnalysisResponse): string {
  const source = (result.facts as { quantitySource?: string } | undefined)?.quantitySource;
  if (source === 'user') return '직접 입력';
  if (source === 'notice') return '공고 기재';
  if (source === 'spec-units') return '규격서에서 읽음';
  return '확인 안 됨';
}

function costSourceLabel(source: 'user' | 'estimated' | null | undefined): string {
  if (source === 'user') return '직접 입력';
  if (source === 'estimated') return '규격서 추정';
  return '미상';
}

/** 백엔드가 행을 추론 합계에서 뺀 사유(rejectReason)를 한국어로. */
function rejectReasonLabel(reason?: string): string {
  switch (reason) {
    case 'unpriced':
      return '가격 미확인';
    case 'inferred-row':
      return '참고값 제외';
    case 'no-evidence':
      return '근거 없음';
    case 'duplicate-row':
      return '중복 제외';
    case 'bad-price':
      return '이상 가격';
    case 'qty-out-of-range':
      return '수량 이상';
    default:
      return reason ? `${reason} 제외` : '제외';
  }
}
