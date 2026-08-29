# 입찰 결과 — 프론트↔백엔드 연결 점검

`docs/bid-result-open-spec.md` 가 "무엇을 만들어야 하는가"의 기준선이라면, 이 문서는 **지금
만들어진 것이 백엔드와 실제로 맞물려 있는가**를 코드로 대조한 결과다. 두 저장소가 갈라져
있어서 한쪽만 보면 계약이 어긋난 것을 알 방법이 없다 — 백엔드가 새 파라미터를 열어도,
응답 필드의 단위를 바꿔도, 프론트에는 아무 신호도 오지 않는다.

- 점검일: 2026-08-29
- 대조 기준: 프론트 `b6292d7`(= `origin/main`) / 백엔드 `Electerior/g2bmaster-backend`
  `origin/main` `285600b`(PR #13 `fix/opening-results`, PR #14 `fix/bid-result-lookup` 포함)
- 방법: 양쪽 소스만 읽었다. 백엔드는 `git show`·`git grep origin/main` 만 썼고 워킹트리는
  건드리지 않았다. **라이브 응답은 검증하지 않았다** — 마지막 절 '확인 못 한 것' 참고.
- 경로 표기: 프론트는 이 저장소 기준 상대경로, 백엔드는
  `src/main/java/com/electerior/g2bmaster/` 이하 상대경로.

---

## 결론

- **연결 자체는 대체로 건강하다.** 파라미터 이름 15개 중 13개, 응답 필드(표 7컬럼·서랍 16필드·봉투 4키·개찰 참여업체 5키·담합 응답 전 필드)는 철자·타입·스케일이 코드 수준에서 일치한다. 계약이 깨져 화면이 죽는 곳은 없다.
- **그러나 눈에 보이는 값이 틀린 곳이 둘 있다.** 들러리 매트릭스의 '교대율'은 100배로(완전 교대 시 `10000%`) 표시되고, 개찰 경쟁 현황 표는 실격 업체를 낙찰 1위보다 **위**로 올린다. 둘 다 백엔드 PR #13 로 개찰 데이터가 실제로 채워지기 시작하면서 이제 막 화면에 드러나는 결함이다.
- **백엔드가 준비해 둔 기능 두 개에 프론트가 도달하지 못한다.** PR #14 가 넣은 `bidNtceNo` 단건조회를 '낙찰결과 →' 버튼이 쓰지 않아 대부분 빈 화면으로 끝나고, `corpNm`(낙찰업체 필터)은 프론트 어디서도 보내지 않는다.
- **'품목 검색' 탭은 이 화면에서 구조적으로 항상 0건**이다(낙찰정보 행에 품목 필드 자체가 없음). 안내 없이 '검색 결과 없음'만 뜬다.
- **회복탄력성은 상류가 정상일 때만 성립한다.** axios 60초가 사슬 전체에서 가장 짧은 상한이고, 타임아웃이 '백엔드에 연결하지 못했습니다'로 오진되며, 상류 인증 실패·쿼터 소진이 '개찰결과 미공개'와 구분되지 않는다.

---

## 엔드포인트별 연결 상태

| 엔드포인트 | 프론트 호출지점 | 백엔드 핸들러 | 상태 |
|---|---|---|---|
| `GET /api/bid-result` | `src/features/notices/useNoticeSearch.ts:53-57` → `src/api/notices.ts` (fetchBidResult) | `notice/NoticeController.java:115-141` → `BidResultService`/`BidResultLookup` | **주의** — 봉투·필드·페이징 정상. 단 `bidNtceNo` 단건조회 경로에 UI 진입점 없음(#3), `searchField=item` 은 항상 0건(#4), `corpNm` 미사용(#10) |
| `POST /api/bid-opening-results` | `src/features/notices/drawer/OpeningPanel.tsx:48-52` | `market/MarketIntelController.java:119-123` → `MarketIntelService.java:97-127` | **주의** — 요청 3키·응답 5키 전부 일치. 실격 업체 순위 공란 정렬 붕괴(#2) |
| `POST /api/collusion-analysis` | `src/features/notices/collusion/CollusionModal.tsx:218-226` | `market/MarketIntelController.java:751` → `MarketIntelService.java:426-441` → `analysis/CollusionAnalysis.java` | **주의** — 요청 5키·응답 전 필드 일치, 20건 상한도 양쪽 동일. 교대율 단위 불일치(#1), 60초 타임아웃 위험(#5) |
| `POST /api/company-history` | `src/api/analysis.ts:122-123`, `:259` — **호출부 0건** | `market/MarketIntelController.java:730` | **끊김(미배선)** — 백엔드는 살아 있으나 '낙찰자 조회' 모드가 이식되지 않음(`src/domain/searchModes.ts` 의 SEARCH_MODES = keyword/item/instt) |
| `POST /api/officer-search` | 확인 못 함 — 이번 점검에서 프론트 호출부를 직접 확인하지 않음 | `market/MarketIntelController.java:740` | **확인 못 함** |
| `POST/GET /api/export-jobs*` | `src/api/export.ts:61,67,74,89,93-94` (배럴 재수출 `src/api/index.ts:8`), 화면 호출부 0건 | **없음** — `git grep "export-jobs" origin/main -- 'src/main/java/*'` 0건 | **끊김(유령)** — 프론트만 선행 구현(#14) |
| `GET /healthz` | 프론트에서 호출하지 않음 | — | 해당 없음(배포 스크립트·LB 전용) |

---

## 문제 목록

### 높음

#### 1. 들러리 매트릭스 '교대율'이 100배로 표시된다

- **무엇이**: 백엔드가 이미 0~100 정수 백분율로 주는 값을 프론트가 한 번 더 ×100 한다.
- **어디서**
  - 프론트: `src/features/notices/collusion/CollusionModal.tsx:86` — `{(pair.alterScore * 100).toFixed(0)}%` / 타입 선언 `src/api/analysis.ts:208` (`alterScore: number`, 단위 주석 없음) / 픽스처 `src/features/notices/collusion/CollusionModal.test.tsx:115` 이 `alterScore: 1` 로 잘못된 0~1 가정을 새겨 둠
  - 백엔드: `analysis/CollusionAnalysis.java:227` — `(int) Math.round(alter * 100)`, 레코드 컴포넌트 `int alterScore`(:67), javadoc :57 "번갈아 이긴 정도(0~100)". 테스트 `CollusionAnalysisTest.java:93,103` 이 100/0 을 단언 — 단위는 백엔드 쪽에 계약으로 못박혀 있다.
- **사용자에게**: 입찰결과 표 → '들러리 매트릭스' → '페어별 공동출현' 표의 교대율 칸. 완전 교대(100) → `10000%`, 2승1패(67) → `6700%`. 값이 0인 짝만 우연히 맞다. 오류가 나지 않아 화면은 멀쩡해 보이고, 담합 정황을 읽는 핵심 지표가 통째로 신뢰를 잃는다.
- **고치는 법**: 프론트 한 줄. `CollusionModal.tsx:86` → `{Math.round(pair.alterScore)}%`. `analysis.ts:208` 에 "0~100 정수, 백엔드가 이미 백분율화(CollusionAnalysis.java:227)" 주석. 회귀 방지로 `CollusionModal.test.tsx:115` 픽스처를 `alterScore: 100` 으로 바꾸고 `expect(screen.getByText('100%'))` 추가. 백엔드를 0~1 로 되돌리는 것은 권하지 않는다(레코드가 `int` 라 0/1 로 뭉개지고 javadoc 계약이 흔들린다). 참고로 같은 응답의 `suspicionScore` 는 0~1 alter 기준이라 RiskBadge 임계 3.0/1.5(`src/components/.../Badge.tsx:192`)와 정확히 맞는다 — **어긋난 것은 alterScore 하나뿐**이다.

#### 2. 개찰 경쟁 현황에서 실격 업체가 낙찰 1위보다 위로 올라온다

- **무엇이**: 백엔드가 순위 없음을 `null` 이 아니라 **빈 문자열 `""`** 로 주는데 프론트 정렬이 `?? 99` 로만 막는다. `Number('') === 0` 이라 실격 행이 1위보다 앞선다.
- **어디서**
  - 프론트: `src/features/notices/drawer/OpeningPanel.tsx:57` — `[...participants].sort((a,b) => Number(a.rank ?? 99) - Number(b.rank ?? 99))`, 표시 `:100` `{p.rank ?? '-'}`
  - 백엔드: `market/MarketIntelService.java:166,168` — `out.put("rank", firstNonBlank(row, "opengRank", "rank"))`, `firstNonBlank` 는 후보가 모두 blank 면 `""` 반환(`:561-569`). javadoc `:160-161` 이 "실격 업체는 순위·금액·투찰률이 모두 비어 온다. 채우지 않는다" 고 의도를 명시.
- **사용자에게**: 서랍의 '개찰 경쟁 현황' 조회 결과에서 규격서평가부적격 등 실격 업체가 표 맨 위에 **순위 칸이 빈 채로** 줄지어 나오고, ✅ 낙찰 배지를 단 1위가 그 아래로 밀린다. 금액·투찰율도 '-' 라 첫 화면이 전부 빈 칸으로 보여 데이터가 깨진 것으로 읽히거나 맨 윗줄을 낙찰자로 오인한다. `NoticeDrawer`(입찰공고 서랍)도 같은 `OpeningPanel` 을 써 두 화면에서 동시에 나타난다. 적격심사 공사·용역은 실측 참여업체가 151·176·256개사(`MarketIntelService.java:44-47`)라 실격이 여럿인 경우가 흔하다.
- **가시성 주의**: 프론트 주석은 이 표가 "늘 빈 화면"이라고 적고 있으나(#15) 백엔드 PR #13 이후 실제로 채워진다 — **이제 막 드러나기 시작한 결함**이다.
- **고치는 법**: 백엔드 `CollusionAnalysis.rank()` 규칙(빈 값·비숫자 → 99)을 프론트로 옮긴다.
  ```ts
  const rankOf = (p: BidOpeningParticipant) => {
    const s = String(p.rank ?? '').trim();
    const n = Number(s);
    return s === '' || !Number.isFinite(n) || n <= 0 ? 99 : n;
  };
  ```
  `:57` 정렬 키를 `rankOf` 로 바꾸고, `:100` 표시를 `{String(p.rank ?? '').trim() || '-'}` 로. 이 헬퍼는 `rows.ts`(ordinalOf·fmtBidRate 옆)에 두면 담합 모달이 나중에 순위를 그릴 때 중복이 생기지 않는다. 백엔드 계약(빈 문자열 유지)은 그대로 두는 게 맞다 — 0 을 채우면 투찰률 추세와 담합 매트릭스가 있지도 않은 0원 투찰을 사실로 읽는다고 백엔드가 명시한다(`MarketIntelService.java:160-161`).

#### 3. '낙찰결과 →' 가 PR #14 의 `bidNtceNo` 단건조회를 쓰지 않고 공고명 AND 검색으로 우회한다

- **무엇이**: 백엔드는 `bidNtceNo` 로 낙찰건을 직접 찾아 줄 수 있는데(`NoticeController.java:118-126` → `BidResultLookup.java:72-115`), 프론트 크로스 이동은 공고명 전체를 AND 키워드 하나로만 넘긴다.
- **어디서**
  - 프론트: `src/features/notices/IndexCell.tsx:217-235`(특히 218-222 의 낡은 주석), `src/routes/NoticeSearchScreen.tsx:104-107`(crossToResult 가 공고번호를 안 넘김), `src/features/notices/crossSearch.ts:50,56`
  - 백엔드: `notice/NoticeController.java:118,120-126`, `notice/BidResultLookup.java:72-115`, `notice/BidResultService.java:79-80,95`, `notice/SearchCriteria.java:36,155-160`
- **0건이 되는 실제 원인 셋** (콤마 논거는 반대다 — `search/SearchQuery.java:31-39` parseTerms 가 `"A, B"` 를 두 항으로 쪼개면 매칭이 더 **느슨해진다**): ① `rgst_dt` 기준 7일 기본창, ② 그 창을 덮지 못한 로컬 색인, ③ 공고명 전체를 부분일치로 요구 — 색인 `noticeName` 과 낙찰정보 `bidNtceNm` 이 재공고 표기·공백·괄호로 한 글자만 달라도 0건.
- **사용자에게**: 공고검색 표에서 '낙찰결과 →' 를 누르면 대부분 '검색 결과가 없습니다' 빈 화면. 실제로는 낙찰이 확정돼 있고 번호로는 찾을 수 있는데도 화면은 "그런 낙찰 건이 없다"고 말한다. 조건줄에는 공고명 키워드 하나만 보여 원인을 알 방법이 없다.
- **고치는 법**: 프론트만 고치면 된다. 배선은 이미 완성돼 있다 — `src/features/search/useSearchCriteria.ts:207` 이 URL `ntceNo` 를 `crossBidNtceNo` 로 읽고, `buildQuery:341-343,365` 가 kind 무관하게 `query.bidNtceNo` 로 승격하며 키워드를 비우고, `crossSearch.ts:56` 도 `seed.bidNtceNo` 를 받을 준비가 돼 있다. 사실상 `NoticeSearchScreen.tsx:104-107` 의 seed 한 줄과 `IndexCell.tsx:218-222` 주석만 고치면 된다.
  **단, 무조건 `item.id` 를 싣지 말 것.** `NoticeIndexItem.id` 는 입찰공고 단계에서만 공고번호다(`src/api/search.ts:168-169` 주석: 계획은 조달요청번호, 사전규격은 사전규격등록번호). '낙찰결과 →' 버튼은 `src/domain/columns.ts:142` 에서 단계 구분 없이 모든 행에 그려지므로, category/단계(또는 `looksLikeNoticeNo`)로 걸러 입찰공고 행에서만 번호를 싣고 나머지는 지금의 공고명 검색을 폴백으로 둔다. `bidType` 을 함께 보내면 백엔드 상류 호출이 3회→1회로 준다(`NoticeController.java:121`).

#### 4. '품목 검색' 모드가 입찰결과 화면에서 구조적으로 항상 0건

- **무엇이**: `searchField=item` 은 백엔드에 정상 바인딩되지만, 낙찰정보 행에는 품목 필드가 아예 없다.
- **어디서**
  - 프론트: `src/App.tsx:37`, `src/features/search/SearchHeader.tsx:175`, `src/features/search/SearchModeTabs.tsx:15-19`, `src/features/search/useSearchCriteria.ts:372`
  - 백엔드: `notice/SearchCriteria.java:134-136`, `notice/BidResultService.java:95`, `notice/BidEnrichment.java:91-110`(bidItemHaystack)
- **정확한 조건**: AND 또는 OR 항이 하나라도 있을 때 0건이다. 낱말이 없거나 NOT 항만 있으면 `SearchQuery.java:51-60` 이 통과시켜 결과가 정상적으로 나온다. 즉 **'품목 탭 + 낱말 입력' = 항상 0건**. 현재 `GET /api/bid-result` 는 상류를 실시간으로 치지 않고 로컬 `bid_result` 색인만 읽는데(`BidResultRepository.findWindow`), 색인 행은 ScsbidInfoService 응답을 통째로 담은 것이라(`BidResultLookup.toRow:186-205`) 품목 필드가 없다 — 옛 라이브 경로에 있던 `dtilPrdctClsfcNoNm` 상류 질의(`docs/bid-result-open-spec.md:56,71`)가 사라져 오히려 더 확정적이다.
- **노출 경로가 하나 더 있다**: `src/routes/routePaths.ts:148-156` searchForTab 이 mode 를 의도적으로 보존하므로, 공고 검색에서 품목 모드로 검색하던 사용자가 '입찰 결과' 탭을 누르면 품목 탭을 따로 누르지 않아도 `mode=item` 이 따라와 그대로 0건이 된다.
- **사용자에게**: 상단 '품목 검색' 탭에서 아무 낱말이나 넣으면 항상 '검색 결과가 없습니다'. 같은 낱말을 '키워드 검색' 탭에서 넣으면 나온다. 오류도, "이 화면에서는 품목 검색을 쓸 수 없다"는 안내도 없어 데이터가 없다고 오해한다.
- **고치는 법**: 프론트에서 막는 것이 맞다. `kind === 'bid-result'` 일 때 `SearchModeTabs` 에서 '품목 검색' 탭을 감추거나 비활성(NotReady 안내)으로 두고, 방어적으로 `useSearchCriteria.ts:372` 의 `searchField='item'` 대입에도 kind 게이트를 건다(`activeOnly` 가 이미 `:348` 에서 같은 방식으로 bid-announce 로 제한돼 있다). 백엔드 `bidItemHaystack` 에 폴백을 넣는 것은 상류에 품목 필드 자체가 없어 실효가 없다.

---

### 중간

#### 5. 들러리 매트릭스(20건 팬아웃)가 axios 60초 안에 못 들어올 수 있다 — 프론트가 먼저 끊고 백엔드는 계속 쿼터를 태운다

- **어디서**
  - 프론트: `src/lib/apiClient.ts:29` (`timeout: 60_000`, 인스턴스 전역 — 코드베이스 전체에 per-call override 0건), `src/features/notices/collusion/CollusionModal.tsx:35,218-219` (MAX_BIDS=20)
  - 백엔드: `market/MarketIntelService.java:426,428` (limit 20, `MapLimit.map(slice, 4, …)`) → `:108-109` fetchPaged → `integration/g2b/G2bFetchService.java:129-141` (2페이지 이후 직렬) → `integration/g2b/G2bApiClient.java:96` `Semaphore(4, fair)`, `:94` 읽기 타임아웃, `:200-205` 재시도 3회 + `sleep(2000*attempt)`, `src/main/resources/application.yml:121-122` (20000ms / 3회)
- **현실적 트리거는 페이지 수가 아니라 상류 지연이다.** 페이지 크기가 999(`MarketIntelService.java:49`)라 실측 최대치(151·176·256개사)도 전부 1페이지에 들어온다 — 현실 팬아웃은 공고당 1콜 = 총 20콜이고, 게이트 4 → 5웨이브라 상류가 정상이면 5~15초로 끝난다. 반면 한 콜이 3회 모두 타임아웃하면 그 **콜 하나만으로** 66초(20+2+20+4+20)라 프론트 60초를 넘긴다. 20건 전부 그 상태면 5웨이브 × 66초 ≈ 330초.
- **사용자에게**: 모달 스피너가 60초 돌다가 `CollusionModal.tsx:243-245` 의 "**분석 실패: 백엔드에 연결하지 못했습니다.**" 로 끝난다. 백엔드는 멀쩡히 살아 상류를 계속 때리고 있는데 사용자와 로그에는 '백엔드 연결 실패'로 남는 오진이다(#6 참조).
- **쿼터 우려는 조건부다**: `G2bFetchService.java:40` 이 응답 캐시 TTL 6시간 + 진행 중 요청 병합을 하므로 끊긴 직후 다시 눌러도 추가 소모가 없고, 성공했던 콜은 캐시 히트다. 다만 실패한 콜은 `cache.remove(key, fresh)` 로 빠지므로 **상류가 계속 죽어 있는 구간에서만** 20건 × 3시도 = 60콜이 매번 다시 나간다.
- **고치는 법**: (a) 프론트 — `analyzeCollusion` 호출에만 `timeout` 을 크게(예: 180초) override 하고(post 의 config 인자) 모달에 '최대 수 분' 안내를 붙인다. (b) 백엔드 — collusionAnalysis 를 202 + 작업 ID 폴링으로 돌리거나 `MAX_COLLUSION_BIDS` 를 줄인다. 최소한 (a) 없이는 20건 계약이 프론트 상한과 모순이다.

#### 6. axios 타임아웃이 '백엔드에 연결하지 못했습니다.' 로 오진된다

- **어디서**: `src/lib/apiClient.ts:106-119` (`const status = error.response?.status ?? 0`) + `:89` (`if (status === 0) return '백엔드에 연결하지 못했습니다.'`). 백엔드 결함 아님 — 그 시각 백엔드는 `MarketIntelService.java:107-114` / `BidResultLookup.java:100-106` 에서 정상 동작 중이다.
- **사용자에게**: 들러리 모달 "분석 실패: 백엔드에 연결하지 못했습니다."(`CollusionModal.tsx:245`), 서랍 개찰 패널 "조회 실패: …"(`OpeningPanel.tsx:79`), 목록 상태바 "오류: …"(`NoticeTableScreen.tsx:295`).
- **도달성은 높다**: nginx `proxy_read_timeout 300s` > axios 60s 라 이 경로는 코너 케이스가 아니라 느린 요청의 정상 경로다.
- **성격 정정**: `apiClient.ts:101` 은 본문 없는 진짜 504 도 "백엔드에 연결하지 못했습니다 (HTTP 504)." 로 부르고 `apiClient.test.ts` 가 그것을 단언한다 — '응답을 쓸 수 없다'를 연결 실패로 묶는 것은 이 파일의 기존 설계 선택이다. 따라서 기능·데이터 결함이 아니라 **실패 원인 귀속이 틀린 진단 문구 품질 문제**다.
- **고치는 법**: 응답 인터셉터에서 status 를 0 으로 접기 전에 타임아웃을 먼저 가른다 — `if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return '요청이 60초 안에 끝나지 않았습니다. 조건을 좁혀 다시 시도해 주세요.'` 를 `errorMessageFrom` 앞에 두거나 code 인자를 추가한다.

#### 7. 서비스키 만료·쿼터 초과·상류 타임아웃이 '데이터 없음'과 구분되지 않는다

- **어디서**
  - 프론트: `src/features/notices/drawer/OpeningPanel.tsx:56` (`participants ?? []`) → `:80-81` "개찰결과 미공개 또는 아직 집계 전입니다.", 빈 목록 `src/routes/NoticeTableScreen.tsx:468` → `EmptyState.tsx:18` "검색 결과가 없습니다.", 들러리 `CollusionModal.tsx:250` "개찰결과 확인 M건"
  - 백엔드: `market/MarketIntelService.java:107-114` (`catch (RuntimeException ex) { log.warn(...); return List.of(); }`), `notice/BidResultLookup.java:100-106,113-114`. 대비되는 준비된 문구: `integration/g2b/G2bErrorTranslator.java:80-82`(503), `:92-93`("나라장터 API 인증에 실패했습니다. G2B_SERVICE_KEY 환경변수를 확인해 주세요."), `:95-99`(429 쿼터)
- **범위 한정 (중요)**: 저 503 문구가 **전역으로** 도달 불가능한 것은 아니다. `GlobalExceptionHandler.java:52-58` 이 `G2bException` 을 번역해 내보내고 `LivePreSpecSource.java:76-77` 은 전 오퍼레이션 실패 시 firstError 를 되던지므로, **사전규격 화면에서는 키 만료가 즉시 503 문구로 드러난다**. 도달 불가능한 것은 입찰결과 화면의 세 표면에 한해서다. 같은 이유로 "운영자가 며칠 놓친다"도 과장이다.
- **삼킴 자체는 의도된 설계**다(`MarketIntelService.java:34-35` "개찰결과 미공개는 오류가 아니다", `:94-95` "개찰 전 공고를 열어 본 사용자에게 500 을 보여 줄 수는 없다"). 남는 진짜 결함은 **"데이터 없음"의 원인**(개찰 전 vs 우리 키 만료/쿼터 소진)을 이 화면에서 구분할 수단이 없다는 것이다.
- **목록 영향도 한정적**: 창 검색은 상류를 안 부르므로 키가 만료된 날 목록이 통째로 비지는 않는다 — 이미 적재된 과거 행은 나오고 적재가 실패한 최근 구간만 빈다.
- **고치는 법**: 삼키되 흔적을 응답에 남긴다. `fetchOpeningResults` / `BidResultLookup.fetchUpstream` 이 예외를 잡을 때 봉투에 `_upstreamError: true`(+ 번역 문구)를 실어 200 으로 내려보내고, 프론트는 participants 가 비었을 때 그 플래그로 '개찰결과 미공개' 와 '나라장터 조회 실패' 를 가른다. 최소한 인증 실패(`isAuthError`)만이라도 삼키지 말고 503 으로 올리면 준비된 문구가 살아난다.

---

### 낮음

#### 8. 프론트가 `sortKey` 를 무조건 실어 백엔드 BM25 관련도 정렬이 도달 불가능한 코드가 된다

- **어디서**: `src/routes/NoticeTableScreen.tsx:152-154`(buildQuery 결과를 무조건 덮어씀), `src/domain/columns.ts:266-274`(`defaultSortForKind` → rlOpengDt/desc) / `notice/NoticeController.java:130-141`(특히 `:136` "sortKey 가 비었을 때만 BM25")
- **성격**: 조용한 유실이 아니라 **문서화된 원본 결함의 이식**이다. `docs/bid-result-open-spec.md:281-282` (§9 '따라 옮기지 말아야 할 것' 6번)이 "BM25 재랭킹은 사실상 죽은 코드다 — 프론트가 모든 경로에서 sortKey='rlOpengDt' 를 세팅한다" 고 이미 적어 두었다.
- **영향 범위는 좁다**: 반환 행은 이미 AND/OR/NOT 필터를 통과한 일치 항목이므로 문제는 일치 항목들 **사이의 순서**뿐이다. 빈칸도 누락도 오답도 없고, 끝난 입찰 화면에서 개찰일시 내림차순은 그 자체로 방어 가능한 기본값이다. (#3 의 크로스 이동 시나리오는 성립하지 않는다 — 공고명 통짜 부분일치 + `bidNtceNo` 중복 접기 때문에 결과가 한두 건이라 순서가 문제될 여지가 없다.)
- **고치는 법**: URL 에 sort 가 명시되지 않았고 키워드 조건이 있으면 sortKey/sortDir 을 생략하도록 `NoticeTableScreen.tsx:153-154` 를 조건부로 바꾼다(표 머리글 표시도 '관련도' 로 함께 조정). 반대로 현 동작을 의도로 굳힐 거라면 `NoticeController.java:113-114/134` 주석과 docs 를 "입찰결과는 BM25 를 쓰지 않는다" 로 고쳐 사문 코드를 정리한다.

#### 9. `simOr` / `simFile` 은 백엔드 `SearchCriteria` 에 없어 조용히 버려진다

- **어디서**: `src/features/search/useSearchCriteria.ts:375-376`, 타입 선언 `src/api/notices.ts:136-137` / `notice/SearchCriteria.java:20-33`(레코드 컴포넌트 13개에 없음), `notice/NoticeController.java:116-118`(@RequestParam 은 corpNm, bidNtceNo 둘뿐)
- **도달 경로는 URL 뿐**: `simFile` 은 토글 자체가 삭제됐고(`SearchHeader.tsx:110-121` 주석, `SearchHeader.test.tsx:48-54` 가 `?file=…&simFile=true` 로 들어와도 줄이 안 그려짐을 고정), `simOr` 토글은 `TagInput.tsx:241-246` 이 항상 `checked={false}` · readOnly 로 그린다.
- **실질적 결함은 문서 불일치다**: `docs/porting-status.md:152` 는 "simOr/simFile 임베딩 재정렬 없음 — 둘 다 아직 없다"고 적는데, `docs/api-contract.md:49` 는 같은 두 파라미터를 §1.3 공유 파라미터 표에 올려 두어 계약서만 보면 받는 것처럼 읽힌다.
- **부수 결함**: `useSearchCriteria.ts:375` 의 simOr 라인은 `useTerms` 를 보지 않는다. 공고번호 조회·발주기관 모드처럼 orTerms 가 질의에서 빠지는 경로에서도 `criteria.orTerms` 가 비어 있지 않으면 `simOr='true'` 가 붙는다 — 지금은 무해하지만 백엔드가 이 파라미터를 받게 되면 조건 없는 재정렬이 켜진다.
- **사용자에게**: `?simOr=true` 가 붙은 옛 공유 링크로 들어오면 유사도 확장 없이 정확일치로만 나오는데 조건이 무시됐다는 표시가 없다.
- **고치는 법**: `useSearchCriteria.ts:375-376` 의 대입에 준비 플래그 게이트(`ATTACHMENT_SCAN_READY` 같은)를 걸어 '보내지 않는다'를 코드로 명시하고, 백엔드에 유사도 계약이 생기면 `SearchCriteria` 컴포넌트 추가와 함께 되살린다. `api-contract.md:49` 도 미구현으로 표시한다.

#### 10. 백엔드가 지원하는 낙찰업체 필터(`corpNm`)를 프론트가 어디서도 보내지 않는다

- **어디서**: `src/api/notices.ts:130`(선언만; src 전체 grep 대입 0건 — `analysis.ts:77,101` 은 company-history 전용) / `notice/NoticeController.java:117,128`, `notice/BidResultService.java:63,104,137-146`
- **사용자에게**: '특정 업체가 최근에 뭘 낙찰받았나' 를 이 화면에서 좁힐 방법이 없다. 낙찰업체명을 키워드 칸에 넣으면 **사실상 항상 0건**이다 — `BidEnrichment.java:75-83` 의 bidSearchHaystack 은 bidNtceNm·ntceInsttNm·dminsttNm·품목분류군·_contractSummary·_requirementSummary 만 합치고 업체명 필드(sucsfbidCorpNm/bidwinnrNm)를 전혀 포함하지 않는다.
- **퇴행이 아니라 기준선 그대로**: `docs/bid-result-open-spec.md:54` 가 이미 corpNm 을 "UI 에서 도달하지 못하는 사문 파라미터"로 기록했다. 원본에서 실제 경로는 검색방식 '낙찰자 조회' 모드 → `POST /api/company-history`(spec §7.2, 227-238행)였는데, **그 모드도 이식되지 않았다** — `src/domain/searchModes.ts` 의 SEARCH_MODES 는 `['keyword','item','instt']` 뿐이고 `src/api/analysis.ts:122-123` `fetchCompanyHistory` / `:259` `useCompanyHistory` 는 호출부 0건이다. 더 큰 미이식 조각은 corpNm 이 아니라 '낙찰자 조회' 모드와 company-history 패널 쪽이다.
- **고치는 법**: 살리려면 `useSearchCriteria` 에 corpNm 조건(예: URL `corp`)을 추가하고 buildQuery 에서 값이 있을 때만 실으면 백엔드는 그대로 동작한다. 계획이 없다면 `notices.ts:130` 선언을 지워 사문 필드를 남기지 않는다.

#### 11. 백엔드 정렬 키에 화이트리스트가 없어 존재하지 않는 `sortKey` 가 오류 없이 흐른다

- **어디서**: `src/routes/NoticeTableScreen.tsx:126-132,153-154`(URL `sort`/`dir` 값을 그대로 전송), `src/components/table/DataTable.tsx`(`column.sortKey ?? column.key`), `src/routes/routePaths.ts:110-113` / `search/SearchQuery.java:104-140`(`sortItems`/comparator 가 `map.get(sortKey)` 만 함)
- **/bid-result 에서는 무정렬로 끝나지 않는다** — `NoticeController.java:136-141` 분기가 sortKey 가 비었을 때만 BM25 를 쓰므로, 쓰레기 키가 있으면 키워드 검색인데도 관련도 순서까지 함께 죽는다. 남는 순서는 `BidResultRepository.java:178-190` 의 `ORDER BY rgst_dt DESC`(Java `List.sort` 가 안정 정렬이라 보존).
- **재현 경로는 손으로 친 주소나 옛 링크뿐이다** — `crossSearch.ts:47-57` 이 perPage/and/ntceNo/type 로 화이트리스트하고, `routePaths.ts:121,150` 이 탭 이동에서 sort/dir 를 지우며, columns.ts 의 bid-result 7개 컬럼 키는 모두 실제 응답 필드다. 실사용 관측 가능성은 낮은 이론적 결함에 가깝다.
- **고치는 법**: 프론트에서 `criteria.sortKey` 를 `columnsFor(kind)` 의 키 집합으로 검증해 없으면 `defaultSortForKind` 로 스냅한다(`NoticeTableScreen.tsx:126-132`). 백엔드에도 `SearchQuery.sortItems` 진입부에 허용 키 검사나 최소한 로그를 둔다.

#### 12. 입찰결과 서랍의 '상태' 줄이 항상 '공고' 로 뜬다

- **어디서**: `src/features/notices/drawer/BidResultDrawer.tsx:67` (`['상태', pick(item._noticeStatus)]`) / `notice/BidEnrichment.java:140-141` (`firstNonBlank(item,"_noticeStatus","ntceKindNm","rgstTyNm")` → 비면 `"공고"`), 호출부 `notice/BidResultLookup.java:136,187`
- **근거**: 낙찰정보 오퍼레이션(`getScsbidListSttus{Thng,Servc,Cnstwk}[PPSSrch]`) 응답 20~21개 필드에 `ntceKindNm`·`rgstTyNm` 이 둘 다 없다(`docs/g2b-openapi/swagger/ScsbidInfoService.swagger.json`). 색인 적재(`toRow:185-187`)든 단건 조회(`enrich:134-137`)든 예외 없이 문자열 '공고' 다. 같은 이유로 `_contractSummary` 는 항상 `''`, `__sourceStage` 는 모든 행에서 'bid-announce' 이지만 이 둘은 화면이 읽지 않아 증상이 없다.
- **사용자에게**: 서랍 메타 격자 맨 아래 '상태' 가 언제나 '공고'. 낙찰 확정 건이든 재입찰 건이든 구분이 없어 "아직 공고 단계인가?" 로 오해하거나 상태가 갱신되지 않는다고 읽는다.
- **고치는 법**: `BidResultDrawer.tsx:67` 을 삭제하면 그 줄째 사라진다(같은 파일 `:66` 의 '출처'='나라장터' 는 실제 정보라 남길 만하다). 백엔드에서 고치려면 기본값 '공고' 부여를 입찰공고 경로에만 적용해야 하는데, 그러면 프론트가 undefined → `pick()` 이 `''` 를 돌려주므로 결과는 같다.

#### 13. nginx 설정의 `/api/` 업스트림 포트(8080)가 README·serve-static.mjs·백엔드 기본값과 어긋난다

- **어디서**: `deploy/nginx-g2b-masters.conf:407-409`(주석 '백엔드 (127.0.0.1:8080, Spring Boot)' + `proxy_pass http://127.0.0.1:8080`), `:431-432`(/healthz 동일) vs `serve-static.mjs:14-15`(`PORT ?? 8080`, `BACKEND ?? http://127.0.0.1:8082`), `README.md:58-74`("배포 호스트에서 8080 은 백엔드가 아니다") / `src/main/resources/application.yml:80`(`server.port = ${PORT:8080}` — 기본값이 터널 입구와 같은 포트라 배포 호스트에서는 반드시 다른 포트로 띄워야 한다)
- **nginx 파일이 스스로 모순된다**: 헤더 `:19-24` 가 이미 "Cloudflare → cloudflared 터널 → 127.0.0.1:8080 → serve-static.mjs" 라고 측정 결과를 적어 두었는데, 380 줄 아래 `:407` 이 같은 포트를 'Spring Boot' 라고 부른다. git blame 으로 원인이 확정된다 — `:409` proxy_pass 는 `32c00cf2`(2026-08-27), 이를 반증한 헤더는 `a715b375`(2026-08-28). 감사가 머리말만 갱신하고 업스트림을 남긴 표류다. (설치·reload 는 `deploy/deploy.sh:60-68`.)
- **사용자에게**: 엣지를 nginx 로 옮기는 순간 화면은 200 으로 뜨지만 모든 API 가 502 → 입찰결과 목록·개찰 조회·들러리 매트릭스가 전부 "백엔드에 연결하지 못했습니다 (HTTP 502)."(`apiClient.ts:101`)
- **고치는 법**: `:409`·`:432` 를 `127.0.0.1:8082` 로, `:407` 주석을 serve-static 실측에 맞게 정정. 포트가 환경마다 다르면 `upstream` 블록으로 모으고, `docs/nginx-edge.md` 이관 체크리스트 2번에 "listen 뿐 아니라 /api·/healthz 의 proxy_pass 업스트림도 함께 정한다" 를 추가한다.

---

### 정보 (동작 영향 없음, 정리 대상)

#### 14. 엑셀 내보내기 API 표면(`src/api/export.ts`)이 통째로 유령이다

`src/api/export.ts:17-43`(ExportJob·ExportJobDetail 20여 필드), `:61` POST `/api/export-jobs`, `:67` GET, `:74` retry, `:89` cancel, `:93-94` exportDownloadUrl — 백엔드 origin/main 에 대응 컨트롤러가 **없다**(`git grep "export-jobs" origin/main -- 'src/main/java/*'` 0건). 화면 호출부도 0건이지만 `src/api/index.ts:8` 의 `export * from './export'` 로 **API 배럴에는 올라가 있다**.

실수로 남은 고아 코드가 아니라 계약 문서를 충실히 구현한 선행 클라이언트다 — `docs/porting-status.md` 의 "엑셀 내보내기(`lib/export-workbook.js`)" 절이 export-workbook 과 export-job-service 를 **의도적 미이식**으로 명시하는 반면, `docs/api-contract.md:225-230` 은 export-jobs 6개 엔드포인트를 여전히 계약으로 기술한다. 진짜 불일치는 백엔드 문서 쪽에 있다.

**정정**: 배선했을 때 영문 메시지가 노출된다는 우려는 성립하지 않는다. `GlobalExceptionHandler.java:77-82` 의 포괄 `@ExceptionHandler(Exception.class)` 가 500 + `{"error":"서버 오류가 발생했습니다."}`(한국어)를 돌려주고, `common/ErrorResponse.java:12` 는 record(String error, String code, List<String> missing) 로 `message` 필드가 아예 없다. `application.yml:84` 의 `include-message: always` 는 /error 화이트라벨 경로에만 의미가 있는데 포괄 어드바이스가 먼저 가로챈다.

**고치는 법**: (a) 이식 계획이 없으면 `src/api/export.ts` 를 삭제하거나 파일 머리에 "백엔드 미이식 — 배선 금지" 를 명시하고 배럴에서 뺀다. (b) 이식할 계획이면 지금 프론트 타입이 사실상 유일한 계약 문서이므로 필드명·타입(특히 `etaSeconds`·`downloadUrl` 이 null 가능 → non_null 이면 키가 사라짐)을 그대로 맞춘다. 어느 쪽이든 `exportDownloadUrl` 이 apiClient 를 타지 않는 순수 문자열이라 baseURL·Authorization 이 붙지 않는 점을 먼저 손봐야 한다.

#### 15. `CollusionModal` 머리주석이 '상류 개찰결과가 응답하지 않아 늘 빈 화면'이라고 적어 두었으나 해소되었다

`src/features/notices/collusion/CollusionModal.tsx:19-24` 가 "지금은 대개 빈 화면이 나온다 — 그것이 정상 동작이다 … POST /api/bid-opening-results 가 모든 공고에서 participants: [] 를 준다" 고 현재형으로 단정한다. 그러나 백엔드 PR #13(머지 `9b95a6e` 안의 `78c020d`, `1f490b2`)이 폐기된 `ao/OpengResultInfoService` 를 `as/ScsbidInfoService/getOpengResultListInfoOpengCompt` 로 교체했다 — `integration/g2b/G2bEndpoints.java:33-36` javadoc 이 "그 서비스는 폐기됐고(NO_OPENAPI_SERVICE_ERROR, 사유코드 12) … 개찰결과만 조용히 늘 비어 있던 원인이 이것이었다" 고 스스로 지목한다. `:45`(상수), `:88`(대입), `:147-148`(접근자), `MarketIntelService.java:97-127`(fetchOpeningResults), `:137-146`(narrowToOrd), `:163-178`(normalizeParticipant)로 배선 완료.

**스테일 서술이 세 곳**이다 — `CollusionModal.tsx:19-24`, `docs/bid-result-open-spec.md:283-286`, `CollusionModal.test.tsx:9-10`("지금 상류 개찰결과가 응답하지 않아 이것이 사실상 기본 화면이다"). 함께 고쳐야 한다.

**확실성 한계**: 코드로 증명되는 것은 '살아 있는 오퍼레이션으로 교체되었고 응답 정규화가 화면 계약에 맞춰졌다'까지다. **실제로 상류가 값을 주는지는 소스만으로 검증할 수 없다 — 확인 못 함**(명세 §9.7 자신이 "코드가 있다는 것과 값이 온다는 것은 다르다"고 경고). 다만 이 항목의 요지는 '주석이 이미 해소된 원인을 현재형으로 단정한다'이므로 라이브 검증 없이도 성립한다.

**사용자 영향은 없다.** 위험은 개발자가 개찰/담합 이슈를 조사할 때 "원래 비는 게 정상" 주석을 믿고 #2 같은 실제 결함을 넘기는 것이다.

#### 16. 평균 투찰율을 소수 3자리로 그리지만 백엔드는 1자리까지만 계산한다

`src/features/notices/collusion/CollusionModal.tsx:46` `fmtAvgRate` → `${value.toFixed(3)}%`(호출부 `:127`) / `analysis/CollusionAnalysis.java:235-236` `.divide(..., 10, HALF_UP).setScale(1, HALF_UP)`. '업체별 투찰 패턴' 표의 평균 투찰율이 항상 `87.500%` 처럼 뒤 두 자리가 0 으로 고정된다. 값 자체는 정확하고 null 경로도 이미 방어돼 있다.

**정정**: "옆 칸은 진짜 3자리라 정밀도를 착각한다"는 근거가 없다 — `fmtBidRate`(`rows.ts:181-184`)는 같은 표가 아니라 모달의 별도 섹션 '공고별 1·2위'(`CollusionModal.tsx:188,190`)와 `OpeningPanel.tsx:103` 에서만 쓰이고, 그 칸이 받는 `winBidprcRt`/`runBidprcRt` 도 상류가 "80" 같은 값을 주는 경우가 흔해 `80.000%` 를 낸다. 두 숫자가 한 표에 나란히 놓이지 않는다. 순수 표기 다듬기 항목이다.

**고치는 법**: `:46` 을 `${value.toFixed(1)}%` 로 바꿔 백엔드 계약에 맞춘다. 0 을 유효값으로 지키는 `value != null` 판정은 그대로 둔다.

---

## 정상 확인된 것

**파라미터 (요청)**
- 직렬화 — `src/api/types.ts:99-106` `toSearchParams` 가 undefined/null/`''` 를 키째 제거하고, 백엔드 `SearchCriteria` 생성자(`:46-60`)도 null→`''` 정규화라 "빈 조건 = 필터 없음" 의미가 양쪽에서 같다.
- 이름 일치 — 프론트가 보내는 15개 중 simOr/simFile 을 뺀 13개가 백엔드 바인딩 이름과 정확히 같다. 구분 필터는 양쪽 다 `bidType` 이다(URL 파라미터만 `type`, `useSearchCriteria.ts:365` 가 변환). 사전 우려였던 `q`/`numOfRows`/`page` 오송신은 해당 없음.
- 날짜 — `src/domain/format.ts:10-12` `toG2bDate` 가 `YYYYMMDD` 로 보내고 `G2bDates.toG2bDt(:44-51)` 가 0000/2359 를 붙여 12자리로 만든다. 종료일 하루 누락 없음(23:59 보정 + `BidResultService` 의 +1분 배타 상한). 형식 오류는 500 이 아니라 400(`BidResultService.java:122-135`).
- `perPage='all'` — 프론트 `PER_PAGE_ALL`(`perPage.ts:14`)과 백엔드 `ALL_PER_PAGE` 가 같은 99999. `perPageValue()`(`SearchCriteria.java:111-129`)가 대소문자 무시로 매핑하며 이때만 500 클램프를 우회하고, `snapPerPage`(`perPage.ts:48-60`)가 선택지 밖 값을 100 으로 끌어내려 클램프에 걸리지 않는다.
- 빈 키워드 — `rgst_dt` 창(기본 7일) + `MAX_ROWS=20000` + 페이징으로 '무조건 전 구간 조회' 구멍 없음.
- `activeOnly` / fileScan — 프론트 kind 게이트(`useSearchCriteria.ts:348, 297·303-306`)로 이 화면에서 안 보내고, 백엔드도 bid-result 핸들러에서 읽지 않는다.
- 발주기관 모드 — `mode=instt` 면 키워드를 비우고 `insttNm` 만 보내며, 백엔드 `NoticeFetchSupport.institutionMatches` 가 `ntceInsttNm|dminsttNm` 을 본다. 낙찰정보 행에 `dminsttNm` 이 존재하므로 품목 모드와 달리 정상 동작.
- 인증 — `GET /api/bid-result` 에 `@RequireAppAuth` 없음(NoticeController 전체에 0건). `VITE_APP_API_KEY` 부재가 이 화면을 깨뜨리지 않고, 프론트도 키가 있을 때만 헤더를 붙인다(`apiClient.ts:38-43`).

**응답 (GET /api/bid-result)**
- 표 7컬럼(`domain/columns.ts:225-234`) 전부 실재 — `bidNtceNm`·`dminsttNm`·`bidwinnrNm`·`sucsfbidAmt`·`sucsfbidRate`·`rlOpengDt` 는 swagger item 필드, `_type` 은 `BidResultLookup.toRow:186` 이 물품/용역/공사로 박아 넣으며 `format.ts:134-139` TypeBadge 값 집합과 일치.
- 서랍이 읽는 16필드 전부 실재(`BidResultDrawer.tsx:49-68`). 상류에 `bidNtceSqNo` 가 없고 `bidNtceOrd` 만 있다는 사실과 `ordinalOf`(`rows.ts:163-173`)의 `bidNtceSqNo ?? bidNtceOrd ?? '000'` 순서가 정확히 맞물린다. `_sourceLabel` 은 `BidEnrichment.java:139` 가 '나라장터' 로 채움.
- 봉투 4키 + `_cached` 일치(`NoticeController.page():245-252`, `:124`/`:144` ↔ `src/api/types.ts:7-17`). **`meta` 키는 응답에 존재하지 않고** 프론트도 읽지 않는다. `sourceCounts`/`sourceErrors` 는 bid-result 에 없지만 프론트가 `kind === 'bid-announce'` 로 가드(`NoticeTableScreen.tsx:369,377`).
- `numOfRows` 계산이 어긋나지 않는다 — 'all' → 99999 로 풀려 `Math.ceil(totalCount / (numOfRows || 20))`(`:221`)가 1페이지로 떨어지고, 0 이 되는 경로도 `|| 20` 폴백이 받는다.
- 포매터가 형식 변화에 둔감 — `format.ts:29-42` 가 숫자 아닌 문자를 제거 후 자릿수로만 판단해 `2026-08-20 10:00:00` 이든 `202608201000` 이든 같은 결과. `Cell.tsx:63` 이 null/`''` 을 포맷 종류와 무관하게 '-' 로 조기 반환.
- 백엔드가 붙이지 않는 파생 필드(`_opportunity*`, `_specLockSummary`, `_simScore`, `_analysis`)를 프론트가 읽지 않는다 — bid-result 컬럼에 `opportunity` fmt 가 없어 `Cell.tsx:107-116` 분기에 도달하지 않는다. `rowKeyForItem`(`rows.ts:28-42`)이 훑는 타 화면용 후보도 `?? ''` 로 접히고 배열 인덱스가 유일성을 보장한다.

**응답 (POST 두 엔드포인트)**
- 개찰결과 요청 3키(`OpeningPanel.tsx:48-52`) ↔ `MarketIntelRequests.java:25` record 컴포넌트 정확히 일치. `type` 은 항상 non-blank, `bidNtceNo` 는 항상 String 이라 400 분기에 도달하지 않는다. 차수가 안 맞아도 전 차수를 돌려주므로 빈 배열로 떨어지지 않는다(`MarketIntelService.java:146`).
- 참여업체 5키 — PR #13 이 상류 원본명(`prcbdrNm`/`opengRank`/`bidprcAmt`/`bidprcrt`)을 화면 계약명(`bdrNm`/`rank`/`bidAmt`/`bidprcRt` — R 대문자·t 소문자)으로 옮긴 결과가 `notices.ts:248-255` 와 한 글자도 다르지 않다. 상류에 없는 `sucsfbidYn` 을 `rank=="1"` 로 합성(`:171-172`)하고 프론트가 `toUpperCase()==='Y'`(`:97`)로 받아 대소문자에도 안전.
- 담합 요청 5키 ↔ 백엔드 읽는 키 일치. 특히 **`opengDate` 는 백엔드가 스스로 만들지 않는 이름**(상류는 opengDt/rlOpengDt)인데 프론트가 `rlOpengDt` 를 그 이름으로 담아 보내 '공고별 1·2위' 표의 개찰일 칸이 정상적으로 채워진다(`CollusionModal.tsx:225`). 건수 상한도 양쪽 20(`CollusionModal.tsx:35,219` / `MarketIntelService.java:72,426`), `CollusionModal.test.tsx:82` 가 잠금.
- 담합 응답 pairs 7키 / cases 7키 / companies 8키가 record 컴포넌트와 전부 일치. **`isMonotonicallyIncreasing` 철자도 맞다** — 백엔드와 같은 Jackson 3(tools.jackson 3.1.4)로 동형 레코드를 실제 직렬화해 확인했고, 컴포넌트명이 그대로 나온다.
- 사전 우려였던 "non_null 로 `pairs`/`companies` 가 사라져 `.sort()` 가 터진다"는 **실현되지 않는다** — 백엔드가 `List.copyOf(...)` 로 항상 비-null 을 담고(`CollusionAnalysis.java:122`, `MarketIntelService.java:440-441`), NON_NULL 은 빈 배열을 지우지 않는다. `bids[].participants` 도 항상 List.
- `avgRate` 는 표본 없으면 키가 사라지지만 `fmtAvgRate` 의 느슨한 `value != null` 이 undefined 도 '-' 로 떨어뜨리고 0 은 유효값으로 살린다(`CollusionModal.test.tsx:84-101` 이 잠금).
- 실격 업체의 `bidAmt=''`·`bidprcRt=''` 는 각각 `Number('')=0 → '-'`(`OpeningPanel.tsx:31-32`), `parseFloat('')=NaN → '-'`(`rows.ts:183`)로 안전하게 떨어진다 — 같은 빈 문자열이 `rank` 에서만 사고를 낸다(#2).

**런타임·배포**
- `.env.production` 에 `VITE_API_BASE_URL` 이 없어도 끊기지 않는다 — `apiClient.ts:14` 가 `?? ''` 라 상대경로 `/api/...` 로 나가고, 현 라이브 엣지(cloudflared → 8080 → `serve-static.mjs:52-54` 가 `/api/`·`/healthz` 를 BACKEND=8082 로 프록시)에서 같은 오리진으로 도달한다. nginx CSP `connect-src 'self'`(:176), 백엔드 CORS 기본값(`application.yml:156`)과도 일관. 다만 별도 오리진으로 옮기면 빌드 env·CSP·`CORS_ALLOWED_ORIGINS` 세 곳을 함께 고쳐야 하고, `WebConfig.java:37` 이 `allowCredentials(true)` 라 `*` 를 넣으면 Spring 이 예외를 던진다.
- 입찰결과 3개 표면 모두 무인증 — `git grep RequireAppAuth origin/main` 전량 확인: NoticeController 0건, MarketIntelController 는 `:305`(deal-analysis/backfill) 한 줄뿐. `AppAuthInterceptor.java:29-31` 은 키가 비면 인증 자체를 끄고, 프론트 Bearer 형식도 `:53-58` 과 일치.
- 엣지 타임아웃은 병목이 아니다 — nginx `proxy_read_timeout 300s`(:417), `serve-static.mjs:39-42` 는 timeout 옵션 없음(무제한), `vite.config.ts:188-191` 도 미설정. 사슬에서 가장 짧은 것이 axios 60초다(#5·#6). 요청 본문도 무관 — 담합 요청 20건 × 5키는 `client_max_body_size 60m`·multipart 50MB 어느 쪽에도 걸리지 않는다.
- 오류 봉투 계약 일치 — 백엔드는 모든 갈래에서 `ErrorResponse(error, code, missing)` 를 내고 `message` 키를 만들지 않는데, 프론트 `errorMessageFrom` 이 `body.message → body.error` 순이라 항상 `error` 분기가 물린다(`apiClient.ts:85-86`, `:112-117`). 이 화면에 실제 도달 가능한 4xx 는 날짜 파싱 400(`BidResultService.java:130-133`)과 POST 바디 누락 400 이며 셋 다 한국어로 뜬다.
- `/healthz` 를 프론트가 부르지 않는다(`src/api/system.ts` 는 전부 `/api/system/*`).
- axios per-call `timeout` override 는 코드베이스 전체에 0건 — 60초는 예외 없는 전역 상한이다.

---

## 확인 못 한 것

1. **`POST /api/officer-search` 의 프론트 호출 여부** — 이번 점검에서 프론트 호출부를 직접 확인하지 않았다.
2. **상류가 실제로 개찰결과 값을 주는지** — 코드로는 '살아 있는 오퍼레이션으로 교체되었고 정규화가 화면 계약에 맞다'까지만 증명된다. 라이브 응답 검증은 하지 않았다(#15).
3. **운영 번들에 `VITE_APP_API_KEY` 가 실제로 들어가는지** — Vite 는 빌드 시 프로세스 환경변수도 `import.meta.env` 에 싣고 `deploy/deploy.sh:22` 는 빌드를 수행하지 않으므로(운영자 셸에서 `npm run build`), 저장소 파일만으로는 판정할 수 없다. 다만 입찰결과 3개 표면은 무인증이라 어느 쪽이든 영향이 없다.
4. **백엔드 워킹트리** — 읽지 않았고 수정하지 않았다. 모든 백엔드 근거는 `git show`/`git grep origin/main` 으로만 수집했다.