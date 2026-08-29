/*
 * 공고 통합 검색 표의 셀 렌더러.
 *
 * 기존 `components/table/Cell.tsx` 와 나눠 둔 이유는 취향이 아니라 **필드 의미가 다르기**
 * 때문이다. 같은 이름의 것이 서로 다른 값을 담는다:
 *   - `dday`  : 기존은 'YYYYMMDDHHmm' 문자열을 파싱해 계산한다. 색인은 서버가 센 **일수**다.
 *   - 날짜    : 기존은 구분자 없는 G2B 문자열, 색인은 ISO-8601.
 *   - 금액    : 기존은 콤마 섞인 문자열, 색인은 숫자.
 * 한 switch 에 밀어 넣으면 이 차이가 조용히 뭉개지고, 그때 화면은 오류 없이 그냥 틀린 값을
 * 보여 준다. 포맷 어휘(CellFmt)만 공유하고 해석은 각자 한다.
 */
import type { ReactNode } from 'react';
import type { NoticeIndexItem } from '@/api/search';
import { TypeBadge } from '@/components/badges/Badge';
import { useNotReady } from '@/components/feedback/notReadyContext';
import type { ColumnDef } from '@/domain/columns';
import { fmtDisplayDatetime, fmtMoney } from '@/domain/format';
import {
  amountKindLabel,
  ddayLabel,
  ddayTone,
  institutionPair,
  regionLabel,
} from './indexRows';
import { SaveNoticeButton } from './SaveNoticeButton';

const EMPTY = <span className="cell-empty">-</span>;

/** 단계 배지 색. 생애주기 순서대로 파랑 → 보라 → 초록 → 회색. */
const CATEGORY_TONE: Readonly<Record<string, string>> = {
  계획: 'stage-plan',
  사전규격: 'stage-spec',
  입찰: 'stage-open',
  마감: 'stage-closed',
};

export interface IndexCellActions {
  /** 공고명 클릭 — 상세 서랍. */
  openDetail: (item: NoticeIndexItem) => void;
  /** 사전규격 → 그 규격에서 나온 입찰공고로 조건을 좁힌다. */
  crossToSpec: (beforeSpecRgstNo: string) => void;
  /**
   * 공고 → 그 공고의 낙찰 결과로 건너뛴다.
   *
   * crossToSpec 과 달리 **화면을 옮긴다.** 낙찰정보는 색인이 아니라 팬아웃 API 라
   * 같은 표에서 조건만 좁힐 수가 없다.
   */
  crossToResult: (notice: { bidNtceNo: string; bidType: string; noticeName: string }) => void;
}

interface IndexCellProps {
  item: NoticeIndexItem;
  column: ColumnDef;
  actions: IndexCellActions;
  /** 이번 목록 질의가 첨부 본문을 실제 검색했는가. */
  attachmentSearchApplied?: boolean;
}

export function IndexCell({
  item,
  column,
  actions,
  attachmentSearchApplied = false,
}: IndexCellProps): ReactNode {
  const notReady = useNotReady();
  const raw = (item as unknown as Record<string, unknown>)[column.key];

  switch (column.fmt) {
    /*
     * 수주기회 점수는 팬아웃 파이프라인이 붙이던 값이라 색인 응답에는 아직 없다.
     * 자리를 지워 버리면 다음 웨이브에서 되살릴 곳을 잃으므로 칸은 남기고, 누르면 알린다.
     */
    case 'opportunity-pending':
      return (
        <button
          type="button"
          className="opp-pending not-ready-control"
          onClick={() => notReady.notify('수주기회 점수')}
          title="수주기회 점수는 백엔드에서 작업 중입니다"
        >
          준비 중
        </button>
      );

    case 'category-badge': {
      const value = String(item.category ?? '');
      if (!value) return EMPTY;
      return <span className={`stage-badge ${CATEGORY_TONE[value] ?? 'stage-open'}`}>{value}</span>;
    }

    // 상태는 넷 모두 예외 상태다. 정상 공고는 값이 없으므로 대부분의 칸이 비어 있는 것이 맞다.
    case 'state-badge': {
      const value = String(item.state ?? '');
      if (!value) return EMPTY;
      return (
        <span className={value === '취소' ? 'notice-status status-cancelled' : 'notice-status'}>
          {value}
        </span>
      );
    }

    case 'type-badge': {
      const value = String(item.businessDivision ?? '');
      return value ? <TypeBadge value={value} /> : EMPTY;
    }

    // 빈 지역은 '전국'이다 — 값이 없다고 '-' 로 그리면 필터 오작동으로 읽힌다.
    case 'region': {
      const label = regionLabel(item.region);
      return <span className={label === '전국' ? 'region-any' : undefined}>{label}</span>;
    }

    case 'institutions': {
      const { primary, demand } = institutionPair(item);
      if (!primary) return EMPTY;
      return (
        <div className="instt-pair">
          <span>{primary}</span>
          {demand ? <em title="수요기관">수요 {demand}</em> : null}
        </div>
      );
    }

    case 'notice-name': {
      const name = String(item.noticeName ?? '').trim();
      if (!name) return EMPTY;
      const no = String(item.id ?? '').trim();
      const matchedIn = item.matchedIn ?? [];
      const attachmentOnly =
        matchedIn.includes('attachment') && !matchedIn.includes('notice');
      const attachmentUnknown = attachmentSearchApplied && item.attachmentIndexed === false;
      return (
        <div className="notice-name-cell">
          <button type="button" className="bid-link" onClick={() => actions.openDetail(item)}>
            {name}
          </button>
          {attachmentOnly || attachmentUnknown ? (
            <span className="notice-match-flags">
              {attachmentOnly ? (
                <span
                  className="notice-match-flag attachment-only"
                  title="공고명·공고본문이 아니라 첨부 본문에서 검색어가 일치했습니다"
                >
                  첨부 일치
                </span>
              ) : null}
              {attachmentUnknown ? (
                <span
                  className="notice-match-flag attachment-unindexed"
                  title="첨부 본문이 아직 색인되지 않아 첨부에서의 일치 여부를 판단할 수 없습니다"
                >
                  첨부 미색인
                </span>
              ) : null}
            </span>
          ) : null}
          {/* 공고번호는 표에서 별도 컬럼을 빼는 대신 공고명 아래 옅게 붙인다(SVG 목업). */}
          {no ? <span className="notice-no">{no}</span> : null}
          {item.bodyPreview ? <p className="body-preview">{item.bodyPreview}</p> : null}
        </div>
      );
    }

    // 마감일시 + D-DAY 를 한 칸에. 계획 단계는 마감이 없어 '-' 하나로 깔끔히 떨어진다.
    case 'close-dday': {
      if (!item.closeDate) return EMPTY;
      const label = ddayLabel(item.dday);
      return (
        <div className="close-dday-cell">
          <span>{fmtDisplayDatetime(String(item.closeDate))}</span>
          {label != null ? (
            label === '마감' ? (
              <span className="dday-badge dday-expired">마감</span>
            ) : (
              <span
                className="dday-badge"
                style={{ color: ddayTone(item.dday as number), borderColor: ddayTone(item.dday as number) }}
              >
                {label}
              </span>
            )
          ) : null}
        </div>
      );
    }

    case 'dday-count': {
      const label = ddayLabel(item.dday);
      if (label == null) return EMPTY;
      if (label === '마감') return <span className="dday-expired">마감</span>;
      return (
        <span className="dday" style={{ color: ddayTone(item.dday as number) }}>
          {label}
        </span>
      );
    }

    /*
     * 계획 → 사전규격 → 입찰 을 잇는 칸. 사전규격 행에서는 이 값이 자기 id 와 같으므로
     * 눌러도 제자리다 — 그때는 버튼을 그리지 않는다.
     */
    case 'spec-cross': {
      const specNo = String(item.beforeSpecRgstNo ?? '').trim();
      if (!specNo || specNo === String(item.id)) return EMPTY;
      return (
        <button
          type="button"
          className="cross-tab-btn"
          onClick={() => actions.crossToSpec(specNo)}
          title={`사전규격 ${specNo} 로 이어진 공고 모아보기`}
        >
          규격 →
        </button>
      );
    }

    case 'result-cross': {
      /*
       * **공고번호로 넘긴다.** 원본은 공고명 전체를 AND 키워드로 넘겼는데(app.js:2045),
       * 그것은 `/api/bid-result` 가 공고번호를 조건으로 받지 않던 시절의 우회였다. 이제
       * 받는다 — 그리고 번호 조회는 날짜창도, 색인 커버리지도 보지 않는다(색인에 없으면
       * 서버가 나라장터에 한 번 물어 온다). 제목 매칭으로는 같은 이름의 다른 공고가 섞이고,
       * 색인이 그 구간을 덮지 못했으면 있는 결과도 못 찾았다.
       *
       * 구분(businessDivision)을 함께 넘기는 것은 서버의 상류 호출을 1회로 끝내기 위해서다.
       * 없으면 서버가 물품 → 용역 → 공사 순으로 최대 세 번 묻는다.
       *
       * 번호가 없는 행(있어선 안 되지만)은 예전처럼 이름으로 찾는다 — 화면에서 버튼이
       * 사라지는 것보다 낫다.
       */
      const name = String(item.noticeName ?? '').trim();
      const no = String(item.id ?? '').trim();
      if (!name && !no) return EMPTY;
      return (
        <button
          type="button"
          className="cross-tab-btn plain"
          onClick={() =>
            actions.crossToResult({
              bidNtceNo: no,
              bidType: String(item.businessDivision ?? ''),
              noticeName: name,
            })
          }
          title="이 공고의 낙찰 결과 보기"
        >
          낙찰결과 →
        </button>
      );
    }

    // ★ 저장 — 구현돼 있으나 부를 UI 가 없던 POST /api/saved-notices 를 행에서 바로 잇는다.
    case 'save-star':
      return <SaveNoticeButton item={item} variant="icon" />;

    case 'money':
      return raw == null || raw === '' ? (
        EMPTY
      ) : (
        <span className="amt">{fmtMoney(raw as number)}</span>
      );

    /*
     * 금액 + 그 금액의 종류.
     *
     * 한 칸에 성격이 다른 금액이 섞여 있다 — 나라장터 입찰은 추정가격, 사전규격은 배정예산,
     * 누리장터는 기준금액(투찰 상한), D2B 는 기초예비가격이다. 서버가 하나를 고르지 않으면
     * 금액 필터가 추정가격 가진 행만 남겨 전체의 28%를 조용히 버렸고(그것이 이 칸을 고친 이유다),
     * 고르기만 하고 종류를 숨기면 이번에는 비교할 수 없는 숫자를 나란히 세우게 된다.
     * 그래서 값과 종류를 함께 그린다.
     */
    case 'amount-kind': {
      /*
       * `amount` 를 아직 주지 않는 백엔드(이 컬럼을 만들기 전 버전)와 겹치는 동안에는
       * 추정가격만 알 수 있다. 그때 칸을 통째로 비우면 값이 사라진 것처럼 보이므로 아는 값을
       * 그리되, 종류를 모르니 라벨은 붙이지 않는다 — 없는 근거를 지어내지 않는다.
       */
      const value = (raw as number | null | undefined) ?? item.estimatedPrice;
      if (value == null) return EMPTY;
      const kind = amountKindLabel(item.amountKind);
      return (
        <span className="amt-pair">
          <span className="amt">{fmtMoney(value)}</span>
          {kind ? <em title={`이 금액은 ${kind}입니다`}>{kind}</em> : null}
        </span>
      );
    }

    case 'datetime':
      return raw ? fmtDisplayDatetime(String(raw)) : EMPTY;

    case 'tel': {
      const tel = String(raw ?? '').trim();
      if (!tel) return EMPTY;
      // 담당자 연락처에는 전화번호가 아닌 것(이메일·내선 안내)이 섞여 온다.
      if (tel.includes('@')) return <a href={`mailto:${tel}`}>{tel}</a>;
      return /^[0-9+\-()\s]+$/.test(tel) ? (
        <a href={`tel:${tel}`} style={{ whiteSpace: 'nowrap' }}>
          {tel}
        </a>
      ) : (
        tel
      );
    }

    default: {
      const text = raw == null ? '' : String(raw);
      return text === '' ? EMPTY : text;
    }
  }
}
