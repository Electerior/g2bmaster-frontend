/*
 * 들러리 매트릭스 — 원본 #collusion-modal(app.js:2640~2720).
 *
 * 입찰 결과 표에 지금 떠 있는 공고들의 **개찰 참여업체 명단을 가로질러** 같은 업체 짝이
 * 얼마나 자주 함께 나타나고 승패를 얼마나 고르게 나눠 갖는지 본다. 한 공고만 봐서는 절대
 * 안 보이는 패턴이라, 표 화면에 붙어 있어야 뜻이 있는 기능이다.
 *
 * ## 왜 DataTable 을 안 쓰는가
 * DataTable 은 sort/onSort 를 필수 프롭으로 받고 --table-min-width 하한(1580px)을 깔고
 * 다닌다. 900px 모달 안에서는 그 하한이 곧 가로 스크롤이고, ColumnDef 에는 셀별 정렬이나
 * colSpan 을 표현할 방법이 없다(빈 상태 한 줄을 그릴 수가 없다). 서랍의 개찰 표가 쓰는
 * .opening-table 계열을 그대로 쓴다 — 같은 성격의 표이므로 모양도 같은 편이 낫다.
 *
 * ## 왜 서버 계산을 그대로 쓰는가
 * alterScore(교대율) · suspicionScore(의심점수) · isMonotonicallyIncreasing(단조증가)은
 * 전부 백엔드가 계산해 준다. 원본은 프론트에서 다시 셌는데, 그러면 같은 수식이 두 벌
 * 생겨 한쪽만 고쳐지는 날 화면과 API 가 다른 말을 하게 된다. 여기서는 받아서 그리기만 한다.
 *
 * ## 빈 화면은 여전히 정상이지만 **더 이상 기본값이 아니다** (2026-08-29 정정)
 * 한동안 이 자리에는 "상류가 응답하지 않아 모든 공고가 participants: [] 로 온다"고 적혀
 * 있었다. 그 원인은 폐기된 오퍼레이션(ao/OpengResultInfoService — NO_OPENAPI_SERVICE_ERROR)
 * 이었고, 백엔드가 as/ScsbidInfoService/getOpengResultListInfoOpengCompt 로 갈아 끼우면서
 * 해소됐다(G2bEndpoints.java:33-36 이 스스로 그 사실을 지목한다).
 *
 * **"원래 비는 게 정상"이라는 옛 서술을 믿고 실제 결함을 넘기지 마라.** 개찰 참여업체 정렬이
 * 실격 업체를 1위 위로 올리던 결함이 정확히 그렇게 한동안 가려져 있었다(rows.ts rankOf).
 *
 * 그래도 개찰 전·비공개 건은 여전히 비므로 **빈 상태를 정확히 그리는 것은 기능의 절반**이다 —
 * 상단 요약 줄이 '분석 N건 중 개찰결과 확인 M건'으로 M 을 드러내므로, 사용자는 "담합이 없다"와
 * "데이터가 없다"를 구분할 수 있다.
 */
import { useEffect } from 'react';
import { useCollusionAnalysis, type CollusionAnalysisResponse } from '@/api/analysis';
import { RiskBadge } from '@/components/badges/Badge';
import { Spinner } from '@/components/feedback/Spinner';
import { Modal } from '@/components/overlay/Modal';
import { pick } from '../drawer/metaValues';
import { fmtBidRate, ordinalOf, type ScannedRow } from '../rows';

/** 서버가 한 번에 처리하는 상한. 원본과 같다(app.js:2655 의 slice(0,20)). */
const MAX_BIDS = 20;

interface CollusionModalProps {
  open: boolean;
  onClose: () => void;
  /** 지금 표에 떠 있는 행. 앞에서부터 최대 20건만 분석한다. */
  rows: readonly ScannedRow[];
}

/**
 * 표본이 없을 때만 null 이고 0 은 유효값이다 — truthy 로 판정하면 0% 가 '-' 로 사라진다.
 *
 * 소수 **1자리**인 이유는 백엔드가 거기까지만 계산하기 때문이다
 * (`CollusionAnalysis.java:235-236` 의 `.setScale(1, HALF_UP)`). 3자리로 그리면 뒤 두 자리가
 * 언제나 `0` 으로 고정돼, 있지도 않은 정밀도를 주장하는 표기가 된다.
 */
function fmtAvgRate(value: number | null): string {
  return value != null ? `${value.toFixed(1)}%` : '-';
}

function EmptyRow({ span, children }: { span: number; children: string }) {
  return (
    <tr>
      <td colSpan={span} className="mid collusion-empty">
        {children}
      </td>
    </tr>
  );
}

function PairSection({ pairs }: { pairs: CollusionAnalysisResponse['pairs'] }) {
  const sorted = [...pairs].sort((a, b) => b.suspicionScore - a.suspicionScore);
  return (
    <section className="collusion-section">
      <h4>페어별 공동출현</h4>
      <div className="opening-table-wrap">
        <table className="opening-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>업체 A</th>
              <th style={{ textAlign: 'left' }}>업체 B</th>
              <th className="num">공동출현</th>
              <th className="mid">낙찰분포</th>
              <th className="num">교대율</th>
              <th className="mid">위험도</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length ? (
              sorted.map((pair) => (
                <tr key={`${pair.a}|${pair.b}`}>
                  <td>{pair.a}</td>
                  <td>{pair.b}</td>
                  <td className="num">{pair.total}회</td>
                  <td className="mid">
                    {pair.aWins}승 / {pair.bWins}승
                  </td>
                  {/*
                    이미 0~100 정수 백분율이다(CollusionAnalysis.java:227 이 ×100 을 마쳤다).
                    여기서 다시 곱하면 완전 교대(100)가 10000% 로 뜬다 — 오류가 나지 않아
                    화면은 멀쩡해 보이고, 담합 정황을 읽는 핵심 지표만 조용히 못 쓰게 된다.
                  */}
                  <td className="num">{Math.round(pair.alterScore)}%</td>
                  <td className="mid">
                    <RiskBadge score={pair.suspicionScore} />
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow span={6}>함께 나타난 업체 짝이 없습니다.</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompanySection({ companies }: { companies: CollusionAnalysisResponse['companies'] }) {
  const sorted = [...companies].sort((a, b) => b.appearances - a.appearances);
  return (
    <section className="collusion-section">
      <h4>업체별 투찰 패턴</h4>
      <div className="opening-table-wrap">
        <table className="opening-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>업체명</th>
              <th className="num">출현</th>
              <th className="num">낙찰</th>
              <th className="num">2위</th>
              <th className="num">평균 투찰율</th>
              <th className="mid">추이</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length ? (
              sorted.map((company) => (
                <tr key={company.name}>
                  <td>{company.name}</td>
                  <td className="num">{company.appearances}회</td>
                  <td className="num">{company.wins}회</td>
                  <td className="num">{company.runnerUp}회</td>
                  <td className="num">{fmtAvgRate(company.avgRate)}</td>
                  <td className="mid">
                    {company.isMonotonicallyIncreasing ? (
                      <span
                        className="collusion-monotonic"
                        title="투찰율이 3회 이상 내려가지 않고 이어졌습니다."
                      >
                        ⚠️ 단조증가
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow span={6}>투찰 이력을 모을 업체가 없습니다.</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CaseSection({ pairs }: { pairs: CollusionAnalysisResponse['pairs'] }) {
  /*
   * 공고별 1·2위는 페어 안에 들어 있다. 같은 공고가 여러 페어에 겹쳐 나오므로
   * 공고번호로 접는다 — 원본도 같은 목록을 한 번만 그린다.
   */
  const seen = new Set<string>();
  const cases = pairs
    .flatMap((pair) => pair.cases)
    .filter((c) => {
      if (seen.has(c.bidNtceNo)) return false;
      seen.add(c.bidNtceNo);
      return true;
    });

  return (
    <section className="collusion-section">
      <h4>공고별 1 · 2위</h4>
      <div className="opening-table-wrap">
        <table className="opening-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>공고명</th>
              <th style={{ textAlign: 'left' }}>1위</th>
              <th className="num">투찰율</th>
              <th style={{ textAlign: 'left' }}>2위</th>
              <th className="num">투찰율</th>
              <th className="mid">개찰일</th>
            </tr>
          </thead>
          <tbody>
            {cases.length ? (
              cases.map((c) => (
                <tr key={c.bidNtceNo}>
                  <td>{c.bidNtceNm || c.bidNtceNo}</td>
                  <td>{c.winner || '-'}</td>
                  {/* 투찰율은 문자열("80")로 올 수 있다 — api/analysis.ts 주석 참고. */}
                  <td className="num">{fmtBidRate(c.winBidprcRt)}</td>
                  <td>{c.runnerUp || '-'}</td>
                  <td className="num">{fmtBidRate(c.runBidprcRt)}</td>
                  <td className="mid">{c.opengDate || '-'}</td>
                </tr>
              ))
            ) : (
              <EmptyRow span={6}>1 · 2위를 짝지을 개찰 결과가 없습니다.</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CollusionModal({ open, onClose, rows }: CollusionModalProps) {
  const mutation = useCollusionAnalysis();
  const { mutate, reset } = mutation;

  /*
   * 열릴 때 한 번만 부른다. 표 조건이 바뀌면 사용자가 다시 열 것이고, 그때 아래 reset 이
   * 이전 결과를 지우므로 옛 매트릭스가 잠깐 비치는 일이 없다 — useMutation 은 닫아도
   * data 를 들고 있어서 이 정리가 없으면 새 조건의 로딩 위로 옛 표가 한 프레임 스친다.
   */
  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    mutate({
      bids: rows.slice(0, MAX_BIDS).map((row) => ({
        bidNtceNo: String(row.bidNtceNo ?? ''),
        // 입찰 결과 행에는 bidNtceSqNo 가 없고 bidNtceOrd 로 온다 — rows.ts ordinalOf.
        bidNtceSqNo: ordinalOf(row),
        bidNtceNm: String(row.bidNtceNm ?? ''),
        // 개찰일시도 opengDt 가 아니라 rlOpengDt 다. 원본 매핑을 그대로 베끼면 조용히 빈다.
        opengDate: String(row.rlOpengDt ?? ''),
        _type: pick(row._type, row.bsnsDivNm) || '물품',
      })),
    });
    // rows 는 매 렌더 새 배열이라 의존성에 넣으면 무한 재호출이 된다. 여는 순간의 표를 쓴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mutate, reset]);

  const data = mutation.data;
  const analyzed = Math.min(rows.length, MAX_BIDS);
  const withOpening = data?.bids.filter((b) => b.participants.length > 0).length ?? 0;

  return (
    <Modal open={open} onClose={onClose} title="들러리 매트릭스" wide>
      {mutation.isPending ? (
        <div className="meta">
          {/*
            20건 팬아웃이라 상류가 느린 날에는 분 단위로 걸린다(analysis.ts COLLUSION_TIMEOUT_MS).
            얼마나 기다려야 하는지 적어 두지 않으면 사용자는 멈춘 것으로 읽고 창을 닫는다.
          */}
          <Spinner small /> 개찰 결과를 모으는 중... (최대 {analyzed}건 · 수 분 걸릴 수 있습니다)
        </div>
      ) : mutation.error ? (
        <div className="meta" style={{ color: 'var(--error)' }}>
          분석 실패: {mutation.error.message}
        </div>
      ) : data ? (
        <>
          <p className="collusion-summary">
            분석 {analyzed}건 중 개찰결과 확인 <strong>{withOpening}건</strong> — 나라장터
            비공개 건은 제외됩니다.
          </p>
          <PairSection pairs={data.pairs} />
          <CompanySection companies={data.companies} />
          <CaseSection pairs={data.pairs} />
        </>
      ) : null}
    </Modal>
  );
}
