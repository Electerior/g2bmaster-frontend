/*
 * AI 수주 데스크 — 조건을 통과한 공고를 12건씩 배치로 렌더하고, 동시성 3 워커 풀로
 * 딜 분석(시가 · 투찰 · 수익)을 붙인다.
 *
 * TODO(다음 웨이브): 점수 게이트 슬라이더 · 딜 카드 · 품목 단가 표 · 보고서 생성.
 */
import { ScreenPlaceholder } from './ScreenPlaceholder';

export function DealRadarScreen() {
  return (
    <ScreenPlaceholder
      title="AI 수주 데스크"
      description="공고 검색 결과를 점수로 거른 뒤 딜 분석을 붙입니다."
    />
  );
}
