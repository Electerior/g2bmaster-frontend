/*
 * 첨부문서 전수조사 — 원본 scanAttachments(app.js:3791).
 *
 * 파일 내 키워드 검색이나 '입찰 불가 조항 자동 제외' 가 켜져 있으면, 서버는 페이지 하나가
 * 아니라 **후보 전체**(pageNo=0)를 주고 화면이 그것을 50건씩 잘라 스캔 API 로 보낸다.
 * 현재 POST 는 파일을 다시 내려받지 않고 로컬 첨부 색인을 조회한다. 그래도 후보 배열과 SQL
 * `IN` 목록을 무한히 키우지 않도록 50건 경계를 유지한다.
 *
 * 스캔 결과는 두 가지다.
 *  - matches   : 키워드가 걸린 행 → 표 아래에 발췌 행이 붙는다
 *  - exclusions: 경쟁 제한 조항이 있는 행 → 체크가 켜져 있으면 목록에서 빼고,
 *                꺼져 있으면 '?' 표식으로 사유를 보여 준다(제외와 표시는 짝이다)
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { scanAttachments, type DecoratedRow, type NoticeSearchQuery } from '@/api';
import type { NoticeTableKind } from '@/domain/columns';
import { collectFileEntries, rowKeyForItem, type ScannedRow } from './rows';

const CHUNK_SIZE = 50;

export interface ScanProgress {
  done: number;
  total: number;
  /** '입찰 불가 조항' · '파일 키워드' 중 지금 돌고 있는 것. */
  tasks: string[];
}

export interface ScanOutcome {
  /** 화면에 보일 행(제외가 켜져 있으면 걸러진 뒤). */
  rows: ScannedRow[];
  matchCount: number;
  exclusionCount: number;
  /** '제조사 확약서 3건 · 타 업체 참여 금지 1건' 형태의 사유 집계. */
  reasonNote: string;
  scanned: number;
  total: number;
  cacheHits: number;
  /** 후보 중 첨부 본문 색인이 아직 끝나지 않아 일치 여부를 판단하지 못한 공고 수. */
  notIndexed: number;
}

interface UseAttachmentScanArgs {
  kind: NoticeTableKind;
  /** 목록 조회에 쓴 질의 — 같은 질의면 같은 후보 집합이므로 캐시 키로 쓴다. */
  query: NoticeSearchQuery;
  items: DecoratedRow[] | undefined;
  fileKeywords: string[];
  excludeBlockingClauses: boolean;
  /** 블로킹 판정을 서버에 요청할지. 체크가 꺼져 있어도 '?' 표시를 위해 받아 둔다. */
  scanBlocking: boolean;
  enabled: boolean;
}

export function useAttachmentScan({
  kind,
  query,
  items,
  fileKeywords,
  excludeBlockingClauses,
  scanBlocking,
  enabled,
}: UseAttachmentScanArgs) {
  // 진행률은 쿼리 결과가 아니라 "지금 몇 번째 묶음인지"라 state 로 따로 든다.
  const [progress, setProgress] = useState<ScanProgress | null>(null);

  const result = useQuery<ScanOutcome>({
    queryKey: [
      'attachment-scan',
      kind,
      query,
      fileKeywords.join(','),
      excludeBlockingClauses,
      scanBlocking,
    ],
    // 이 POST 는 이미 추출된 로컬 첨부 색인만 읽는다. LLM 을 호출하지 않으므로 AI 플래그와 무관하다.
    enabled: enabled && Array.isArray(items),
    // 같은 후보·키워드의 로컬 전문검색을 되풀이하지 않도록 결과를 유지한다.
    staleTime: Infinity,
    queryFn: async (): Promise<ScanOutcome> => {
      const source = items ?? [];
      const total = source.length;
      const tasks = [
        excludeBlockingClauses ? '입찰 불가 조항' : '',
        fileKeywords.length ? `파일 키워드 ${fileKeywords.join(', ')}` : '',
      ].filter(Boolean);

      // 행마다 스캔 요청과 응답을 짝지을 id 를 붙인다.
      const withIds: ScannedRow[] = source.map((item, index) => ({
        ...item,
        __rowId: rowKeyForItem(item, index, kind),
      }));

      const scans = withIds.map((item) => {
        const sourceName = String(item.source ?? item._source ?? '').trim();
        return {
          id: String(item.__rowId ?? ''),
          fileEntries: collectFileEntries(item),
          bidNtceNo: String(item.bidNtceNo ?? item.bfSpecRgstNo ?? item.prdctClfcNo ?? ''),
          bidNtceSqNo: String(item.bidNtceSqNo ?? item.bidNtceOrd ?? '000'),
          ...(sourceName ? { source: sourceName } : {}),
          _type: String(item._type ?? ''),
          _tab: kind,
          _version: String(item.chgDt ?? item.rgstDt ?? ''),
        };
      });

      const matches = new Map<string, { matchedKeywords: string[]; excerpt: string }>();
      const exclusions = new Map<string, { reasons: string[]; excerpt: string }>();
      // 미색인 행은 "불일치"가 아니라 아직 판단 불가다. 응답의 요청 row id 로 정확히 보존한다.
      const notIndexedIds = new Set<string>();
      let scanned = 0;
      let cacheHits = 0;
      let notIndexed = 0;

      for (let offset = 0; offset < scans.length; offset += CHUNK_SIZE) {
        const chunk = scans.slice(offset, offset + CHUNK_SIZE);
        setProgress({ done: Math.min(offset + chunk.length, total), total, tasks });
        const data = await scanAttachments({
          scans: chunk,
          fileKeywords,
          excludeBlockingClauses,
          scanBlocking,
          candidateCount: total,
          immediateLimit: chunk.length,
          warmLimit: chunk.length,
        });
        for (const match of data.matches ?? []) {
          matches.set(match.id, {
            matchedKeywords: match.matchedKeywords ?? [],
            excerpt: match.excerpt ?? '',
          });
        }
        for (const exclusion of data.exclusions ?? []) {
          exclusions.set(exclusion.id, {
            reasons: Array.isArray(exclusion.reasons) ? exclusion.reasons : [],
            excerpt: exclusion.excerpt ?? '',
          });
        }
        const chunkNotIndexed = Math.max(0, Number(data.notIndexed ?? 0));
        for (const id of data.notIndexedIds ?? []) notIndexedIds.add(String(id));
        scanned += Number(data.scanned ?? 0);
        cacheHits += Number(data.cacheHits ?? 0);
        notIndexed += chunkNotIndexed;
      }
      setProgress(null);

      const decorated: ScannedRow[] = withIds.map((item) => {
        const id = String(item.__rowId ?? '');
        const match = matches.get(id);
        const exclusion = exclusions.get(id);
        const next: ScannedRow = match
          ? { ...item, _fileExcerpt: match.excerpt, _matchedKeywords: match.matchedKeywords }
          : item;
        // 체크 해제 상태에서만 '?' 표식용 사유·발췌를 붙인다(체크 시엔 어차피 제외된다).
        if (exclusion && !excludeBlockingClauses) {
          return { ...next, _blocking: exclusion };
        }
        return next;
      });

      const rows = decorated.filter((item) => {
        const id = String(item.__rowId ?? '');
        if (excludeBlockingClauses && exclusions.has(id)) return false;
        if (!fileKeywords.length) return true;
        // 파일 키워드 검색은 일치 행만 남긴다. 단, 미색인 행은 거짓 음성을 막기 위해 유지한다.
        return matches.has(id) || notIndexedIds.has(id);
      });

      const reasonCounts = new Map<string, number>();
      for (const exclusion of exclusions.values()) {
        for (const reason of exclusion.reasons) {
          reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
        }
      }

      return {
        rows,
        matchCount: matches.size,
        exclusionCount: excludeBlockingClauses ? exclusions.size : 0,
        reasonNote: [...reasonCounts]
          .map(([reason, count]) => `${reason} ${count}건`)
          .join(' · '),
        scanned,
        total,
        cacheHits,
        notIndexed,
      };
    },
  });

  return { ...result, progress };
}
