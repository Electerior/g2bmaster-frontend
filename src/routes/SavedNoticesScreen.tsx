/*
 * 저장 공고 — G2B API를 다시 부르지 않고 서버에 담아 둔 공고만 훑는다.
 *
 * AI 가격 계산과 편집 가격표는 폐기했다. 저장 당시의 공고 정보와 요약만 보여 준다.
 */
import { useDeleteSavedNotice, useSavedNotices, type SavedNoticeRow } from '@/api';
import { FieldSet } from '@/components/common/FieldSet';
import { PanelNotice } from '@/components/feedback/Spinner';
import { Markdown } from '@/components/markdown/Markdown';
import { StatusBar } from '@/components/table/StatusBar';
import { useSearchCriteria } from '@/features/search/useSearchCriteria';
import { useSeoMeta } from '@/seo/useSeoMeta';
import '@/components/common/fieldset.css';
import '@/features/saved/saved.css';

function comma(value: string | number | null | undefined): string {
  return value == null || value === '' ? '-' : Number(value).toLocaleString('en-US');
}

function amountText(value: string | number | null | undefined): string {
  return value == null ? '' : `${comma(value)}원`;
}

function savedAtText(value: string | null | undefined): string {
  return String(value ?? '')
    .slice(0, 16)
    .replace('T', ' ');
}

interface SavedCardProps {
  row: SavedNoticeRow;
  onDelete: (row: SavedNoticeRow) => void;
  deleting: boolean;
}

function SavedCard({ row, onDelete, deleting }: SavedCardProps) {
  return (
    <article className="saved-card">
      <div className="saved-card-head">
        <strong className="saved-card-title">{row.title || row.bid_ntce_no || '-'}</strong>
        <button
          type="button"
          className="saved-del-btn"
          title="저장 목록에서 지웁니다"
          disabled={deleting}
          onClick={() => onDelete(row)}
        >
          {deleting ? '삭제 중…' : '삭제'}
        </button>
      </div>

      <div className="ds-grid">
        <FieldSet
          primary={{ label: '발주기관', value: row.instt_nm }}
          secondary={{ label: '입찰마감', value: row.bid_clse_dt }}
        />
        <FieldSet
          primary={{ label: '공고 금액', value: amountText(row.amount) }}
          secondary={{ label: '공고번호', value: row.bid_ntce_no }}
        />
      </div>

      <div className="saved-summary">
        <Markdown>{String(row.summary_preview ?? '').slice(0, 300)}</Markdown>
      </div>

      <div className="saved-meta">저장 {savedAtText(row.updated_at)}</div>
    </article>
  );
}

export function SavedNoticesScreen() {
  const { criteria } = useSearchCriteria();
  const deleteMutation = useDeleteSavedNotice();

  // 사용자별 화면이라 색인에서 뺀다. 그 noindex 가 다음 라우트로 새지 않게 하는 책임은
  // useSeoMeta 에 있다 — seo/useSeoMeta.ts 의 applyRobots 주석 참고.
  useSeoMeta();

  const q = [...criteria.andTerms, ...criteria.orTerms, criteria.insttNm].filter(Boolean).join(' ');
  const saved = useSavedNotices({ q });
  const items = saved.data?.items ?? [];

  return (
    <section className="panel" aria-label="저장 공고">
      <StatusBar
        message={
          q
            ? `저장한 공고에서 "${q}"를 찾습니다 (API 조회 없음).`
            : '담아 둔 공고입니다 (API 조회 없음).'
        }
      />

      {saved.isPending ? (
        <PanelNotice>저장한 공고를 불러오는 중...</PanelNotice>
      ) : saved.error ? (
        <PanelNotice empty>저장 공고 조회 실패: {saved.error.message}</PanelNotice>
      ) : items.length === 0 ? (
        <PanelNotice empty>
          {q
            ? '조건에 맞는 저장 공고가 없습니다.'
            : '아직 담아 둔 공고가 없습니다 — 공고 검색에서 [저장]을 눌러 주세요.'}
        </PanelNotice>
      ) : (
        <>
          <div className="saved-count">
            저장 공고 {items.length}건{q ? ` · "${q}"` : ''}
          </div>
          <div className="saved-list">
            {items.map((row) => (
              <SavedCard
                key={`${row.bid_ntce_no}-${row.bid_ntce_ord}`}
                row={row}
                deleting={
                  deleteMutation.isPending &&
                  deleteMutation.variables?.bidNtceNo === row.bid_ntce_no
                }
                onDelete={(target) =>
                  deleteMutation.mutate({
                    bidNtceNo: target.bid_ntce_no,
                    ord: target.bid_ntce_ord ?? '',
                  })
                }
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
