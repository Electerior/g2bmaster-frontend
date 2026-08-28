# g2bmaster-frontend

나라장터(G2B) 입찰정보 웹앱 — React 18 + TypeScript + Vite.

모놀리스 [`g2bmastersopen`](https://github.com/Electerior/g2bmastersopen) 를 세 저장소로
나눈 것 중 하나다.

| 저장소 | 역할 | 스택 |
|---|---|---|
| **`g2bmaster-frontend`** (이 저장소) | 화면 | React 18 + TypeScript + Vite |
| [`g2bmaster-backend`](https://github.com/Electerior/g2bmaster-backend) | API·적재·영속 | Spring Boot 4.1 + MySQL 8 |
| [`g2bmaster-AI`](https://github.com/Electerior/g2bmaster-AI) | 추론 | (기존 Python/LLM 스택 유지) |

원본은 빌드 단계가 없는 단일 페이지였다 — `public/index.html` 437줄과
`public/app.js` 5786줄이 전역 `state` 객체를 직접 변형하고 템플릿 리터럴로
`innerHTML` 을 찍는 구조. 이 저장소는 그것을 라우팅·타입·서버 상태 캐시가 있는
SPA 로 다시 세운 것이다.

---

## 실행

Node 20 이상이 필요하다. **백엔드가 먼저 떠 있어야 한다** — 이 저장소에는 서버가 없고
화면은 전부 `/api` 를 부른다 (`g2bmaster-backend` 의 README 참고).

```bash
npm install
```

```bash
npm run dev
```

`http://localhost:5173`. `/api` 요청은 vite 프록시가 백엔드(기본 `http://localhost:8080`)로
넘긴다 — 다른 주소면 `.env` 에 `VITE_PROXY_TARGET` 을 준다. 이 8080 은 **로컬 개발
기본값일 뿐이다** — 배포 호스트의 8080 은 [cloudflare 터널 입구](#8080-은-cloudflare-터널-입구다)다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (기본 포트 5173) |
| `npm run build` | 타입 검사 + 프로덕션 번들 (`dist/`) |
| `npm run preview` | 빌드한 결과를 그대로 띄워 확인 |
| `npm run typecheck` | 타입만 검사 |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

### 환경 변수

`.env.example` 참고.

| 변수 | 설명 |
|---|---|
| `VITE_API_BASE_URL` | 백엔드 절대 주소. 비우면 같은 오리진의 `/api` 를 호출한다 |
| `VITE_PROXY_TARGET` | dev 서버가 `/api` 를 넘길 곳 (기본 `http://localhost:8080`). 배포 호스트에서는 8080 이 터널 입구라 백엔드가 다른 포트에 있다 |

### 8080 은 cloudflare 터널 입구다

배포 호스트에서 **8080 은 백엔드가 아니다.** cloudflared 터널(`cloudflared.service`)이
8080 을 오리진으로 잡고 있어서 바깥에서 오는 요청이 전부 이 포트로 떨어진다.
그래서 8080 에는 `serve-static.mjs` 가 붙어 `dist/` 를 서빙하고, `/api` 와 `/healthz`
만 백엔드로 넘긴다 — 이 저장소에는 vite dev 서버 말고 이 정적 서버가 하나 더 있는 셈이다.

```bash
npm run build
BACKEND=http://127.0.0.1:8082 PORT=8080 node serve-static.mjs
```

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `8080` | 터널이 가리키는 포트. 바꿀 일이 없다 |
| `BACKEND` | `http://127.0.0.1:8082` | `/api` · `/healthz` 를 넘길 백엔드 |

백엔드 기본 포트도 8080 이라(`g2bmaster-backend` 의 `PORT:8080`) 기본값 그대로 띄우면
터널과 부딪힌다. 배포 호스트에서는 백엔드를 다른 포트로 올리고 `BACKEND` 로 가리킨다.

터널의 ingress 규칙은 Cloudflare 대시보드에 있다 — 호스트에는 토큰
(`/etc/cloudflared/token`)만 있어서 어떤 호스트명이 8080 에 매달렸는지는 여기서 안 보인다.

`/healthz` 가 `백엔드 연결 실패` 를 뱉으면 화면은 떠도 API 는 전부 죽은 상태다.
정적 서빙과 백엔드는 별개 프로세스라 화면이 200 인 것은 아무 보증이 못 된다 —
`BACKEND` 가 가리키는 포트에 백엔드가 실제로 떠 있는지부터 본다.

---

## 구조

```
src/
  routes/     화면 단위 컴포넌트
  components/ 표·배지·서랍·모달·드롭존·페이지네이션 등 공통 UI
  features/
    search/   검색 조건 훅 (URL 검색 파라미터가 단일 출처)
    export/   엑셀 내보내기 작업 폴링
    legal/    법령 검토·콜드메일 초안
  domain/     컬럼 정의, 셀 포매터, 순수 뷰모델 (프레임워크 비의존)
  api/        엔드포인트별 타입 붙은 클라이언트 + TanStack Query 훅
  lib/        axios 인스턴스
  styles/     디자인 토큰 + 전역 스타일
```

---

## 이식 현황

원본은 `app.js` 5786줄 + `style.css` 2988줄이다. 운영에 필요한 조회 UI만 남겼다.

| 화면 | 상태 |
|---|---|
| 검색 헤더 (공고 화면 공용) | ✅ 검색 모드 3종(키워드·품목·발주기관), 태그 입력 4종, 기간·빠른 선택, 즐겨찾기 |
| `/notices/*` 4종 (발주계획·사전규격·입찰공고·입찰결과) | ✅ 정렬·페이징·구분 필터. `POST /api/scan-attachments` 는 로컬 색인 조회로 이식됐지만, 통합 GET 검색에 전역 file-only 필터 계약이 아직 없어 `ATTACHMENT_SCAN_READY` 는 꺼 두었다. 준비 전 URL 조건이 결과 집합을 잘못 좁히지 않도록 하는 안전장치다 |
| 공고 상세 서랍 3종 | ✅ (문서 신호·법령 검토 영역은 분석 랩 단계로 미룸) |
| `/saved` | ✅ |
| `/system` | ❌ 자리 표시자 (백엔드 API 는 완성돼 있다) |
| 설정 모달 / 들러리 매트릭스 / 엑셀 작업 폴링 | ❌ (`Modal` 은 만들어 둠) |

`npm run typecheck`, `npm run lint`, `npm run build` 모두 통과하고,
실제 Spring 백엔드 + MySQL 에 붙여 화면이 뜨는 것까지 확인했다.

## 원본에서 달라진 점

이식하면서 의식적으로 바꾼 것들이다.

1. **탭·검색모드 → 라우트.** 화면 선택과 검색 조건을 URL 로 옮겼다. 현재 검색 모드는
   키워드·품목·발주기관 세 가지이며, 폐기한 낙찰자·담당자·업로드 분석 화면은 라우트에서도
   제거했다.

2. **`searchSeq` 경쟁 가드 삭제.** 원본은 비동기 렌더마다
   `requestSeq !== searchSeq || requestTab !== state.tab` 를 손으로 확인해 늦게 온
   응답을 버렸다. TanStack Query 의 쿼리 키가 같은 일을 하므로 통째로 없앴다.

3. **검색 조건의 단일 출처가 URL.** 즐겨찾기·공유·뒤로가기가 공짜로 따라온다.
   원본의 앱 내 뷰 히스토리 스택(각 10칸)도 브라우저 히스토리로 대체했다.

4. **`innerHTML` → JSX.** `escHtml()` 이 사라졌다. 서버 데이터를 문자열로 이어붙이던
   자리가 전부 JSX 가 되면서 손으로 관리하던 XSS 위험 한 부류가 없어졌다.
   첨부 문서에서 뽑은 마크다운은 `react-markdown` + `rehype-sanitize` 로 렌더한다
   (원본은 CDN 의 `marked` + `DOMPurify` 를 쓰고, CDN 로드 실패 시 조용히 평문으로 떨어졌다).

5. **CDN → npm.** `xlsx`, `pdfjs-dist`, 마크다운 렌더러를 번들에 넣었다.

6. **CORS.** 저장소가 갈리면서 프론트와 API 의 오리진이 달라졌다.
   백엔드가 `CORS_ALLOWED_ORIGINS` 로 이 오리진을 허용해야 한다.

---

## 유지한 것

- **한국어 UI 문구 전부.** 오류 메시지는 백엔드가 내려주는 한국어를 그대로 쓴다.
- **API 필드명.** 백엔드와의 계약이다 — `g2bmaster-backend/docs/api-contract.md` 참고.
- **디자인.** `style.css` 의 토큰과 레이아웃을 그대로 옮겼다.
- **localStorage 키.** `g2b_ui_state`, `g2b_presets`, `companyProfile`,
  `dealMinScore`, `dealActiveOnly`, `g2b-active-export-job` — 기존 사용자의 설정이 유지된다.
- **폴링 주기.** 내보내기 작업 1500ms(오류 시 3000ms 백오프), 작업 id 를
  localStorage 에 저장해 새로고침 후에도 이어받는 동작 포함.
