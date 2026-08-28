# 엣지(nginx) 설정 메모

`deploy/nginx-g2b-masters.conf` 를 왜 그렇게 써 두었는지, 그리고 코드에서 끝나지 않는
항목이 무엇인지 적는다. 2026-08-27 SEO 감사(`#2 soft 404`, `#4 HTTP 200`,
`#5 보안 헤더 없음`, `#6 패싯 파라미터`, `#8 설정 드리프트`)에 대한 대응이다.

설정 자체의 근거는 파일 안 주석에 있다. 여기에는 **파일만 봐서는 알 수 없는 것**
— 코드 밖에서 사람이 해야 하는 일과, 지금 일부러 미뤄 둔 일 — 을 모은다.

---

## 1. CSP 는 지금 Report-Only 다 — 언제, 어떻게 강제로 바꾸나

### 왜 바로 강제하지 않았나

CSP 를 잘못 걸면 앱이 죽는다. 그것도 "에러 화면"이 아니라 "글자가 이상하고 검색이
안 되는" 형태로 죽어서, 배포 직후에는 멀쩡해 보인다. 이 앱이 자기 출처 밖을 쓰는
곳이 최소 두 군데다.

| 무엇 | 어디 | 필요한 지시어 |
|---|---|---|
| Pretendard 웹폰트 CSS | `index.html:13-17`, `https://cdn.jsdelivr.net` | `style-src` |
| 그 CSS 가 다시 부르는 폰트 파일 | 같은 호스트 | `font-src` |
| `/api` 호출 | 같은 출처 | `connect-src 'self'` |

`style-src` 만 열고 `font-src` 를 잊으면 CSS 는 받아지는데 폰트 파일이 막혀서
글자가 시스템 폰트로 조용히 떨어진다 — 콘솔을 보지 않으면 "왜 좀 달라 보이지"로
끝난다. 이런 조합은 목록으로 예측할 수 있는 게 아니라 관측해야 한다.

여기에 더해 아직 확신할 수 없는 것들이 있다.

- `react-markdown` 이 그리는 본문(AI 요약·규격 검토 결과)에 이미지나 링크가 어떤
  형태로 들어오는지
- 인라인 `style=` 속성 (`img-src`/`style-src-attr` 영향)
- `<script type="application/ld+json">` 을 브라우저별로 `script-src` 위반으로
  보고하는지 (엔진마다 다르다)

### 절차

1. **관측.** 현재 정책을 Report-Only 로 며칠 굴린다.
   ⚠ `report-uri`/`report-to` 수집 엔드포인트가 아직 없다. 위반은 방문자 브라우저
   콘솔에만 남으므로, 지금 단계에서는 사람이 주요 화면을 직접 돌면서 확인해야 한다.
   최소 코스: `/beta` → `/notices`(검색 실행까지) → `/notices/bid-result` →
   `/analysis-lab`(파일 업로드) → `/price-db`.
2. **조정.** 콘솔에 뜨는 위반을 정책에 반영한다. 새 출처를 여는 것이 맞는지,
   아니면 그 출처를 쓰는 코드를 없애는 것이 맞는지 매번 따진다.
3. **강제.** 위반이 없어지면 헤더 이름에서 `-Report-Only` 를 뗀다. 설정 파일에
   네 벌이 있으므로(server 레벨 + `/assets/` + `= /index.html` + `/api/`,
   아래 2절) 전부 바꿔야 한다 — 하나라도 남으면 그 경로만 강제되지 않는다.

수집 엔드포인트를 붙일 생각이라면 그게 1번보다 먼저다. 사람이 도는 것으로는
실사용자 브라우저(구형 카카오톡 인앱 웹뷰 등)에서 나는 위반을 못 본다.

---

## 2. `add_header` 가 네 벌 반복되어 있는 이유

nginx 의 `add_header` 는 **상속되지 않는다.** 정확히는 "하위 블록에 `add_header` 가
하나라도 있으면 상위의 `add_header` 목록이 통째로 대체된다". 상속이 되다 마는 게
아니라 전부 사라진다.

이 설정에는 `Cache-Control` 때문에 `add_header` 를 쓰는 location 이 있으므로
(`/assets/`, `= /index.html`, 그리고 장래를 대비해 `/api/`), server 레벨에만 적으면
정확히 그 경로들에서 보안 헤더가 증발한다. 그리고 그 사실은 응답 헤더를 직접
찍어보기 전까지 아무 데서도 드러나지 않는다.

`include` 로 뽑는 대신 반복을 고른 이유는 `deploy.sh` 가 **단일 파일 설치**를 전제로
돌아가기 때문이다. 스니펫이 빠진 채 배포되면 `nginx -t` 가 실패해 reload 가 막힌다.
반복본이 갈라지는 위험은 `src/test/nginxRouteSync.test.ts` 가 막는다 — "자기
`add_header` 를 가진 모든 location 은 보안 헤더 다섯 종을 함께 갖는다"를 검사한다.

배포 후 확인:

```bash
for p in / /index.html /assets/ /api/search/notices/status; do
  echo "== $p"
  curl -sSI "https://g2b-masters.electerior.co.kr$p" \
    | grep -iE 'strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy|content-security'
done
```

---

## 3. 코드로 고칠 수 없는 것 — 어디에 적혀 있나

Cloudflare 대시보드에서 사람이 해야 하는 항목은 **`docs/seo-operations.md` 에 있다.**
여기에 옮겨 적지 않는다. 같은 항목이 두 문서에 있으면 한쪽만 고쳐지고, 그다음부터는
어느 쪽이 최신인지 아무도 모른다 — 이 브랜치가 고치고 있는 문제(설정과 실제가 조용히
갈라지는 것)를 문서로 되풀이하는 셈이다. 그쪽에는 담당자와 상태가 붙은 체크리스트도
있어서 운영이 실제로 따라갈 수 있는 형태다.

| 항목 | 이 설정과 무슨 상관인가 | 적힌 곳 |
|---|---|---|
| Always Use HTTPS: On | 아래 `listen 80` 블록만으로는 감사 #4 가 닫히지 않는다 | `docs/seo-operations.md` 3절 |
| Browser Cache TTL: Respect Existing Headers | `/assets/` 의 `max-age=31536000, immutable` 이 4시간으로 덮인다 | `docs/seo-operations.md` 4절 |
| robots.txt 를 엣지가 합성 | `try_files $uri` 가 파일을 내줘도 방문자에게 닿지 않는다 | `docs/seo-operations.md` 1절 |

이 문서가 맡는 것은 **nginx 쪽 사정**이다: CSP 를 언제 강제로 바꾸나(1절),
`add_header` 가 왜 네 벌인가(2절), 오리진을 어느 포트에 맞추나(4절),
`/beta` 프리렌더를 어떻게 내보내나(6절).

---

## 4. ⚠ 지금 이 설정은 라이브 경로에 있지 않다 (감사 #8)

2026-08-28 측정. 공개 도메인의 응답을 내는 것은 nginx 가 아니다.

```bash
$ curl -s  https://g2b-masters.electerior.co.kr/beta | wc -c            # 5110
$ curl -s  http://127.0.0.1:8080/beta | wc -c                          # 5110  (md5 동일)
$ curl -sk https://192.168.219.52/beta -H 'Host: g2b-masters…' | wc -c  # 6008  (다름)
```

라이브 응답과 바이트가 같은 쪽은 **8080** 이다. 8080 에는 `serve-static.mjs` 가 붙어 있고,
그 앞에 cloudflared 터널이 있다(README 의 "8080 은 cloudflare 터널 입구다"). nginx 는
`systemctl is-active nginx` 로 살아 있지만, certbot 이 만든 별개의 vhost 로
`192.168.219.52:443` 에서 Vite 개발 서버(5173)를 프록시하고 있을 뿐이고 바깥 요청은
거기 닿지 않는다.

즉 감사 #8 의 "저장소 설정과 라이브가 갈라져 있다"는 생각보다 한 칸 더 나간 상태다.
갈라진 정도가 아니라 **이 파일은 요청 경로에 없다.**

### 지금 엣지(`serve-static.mjs`)가 하지 않는 것

| 이 설정이 하는 일 | 8080 의 정적 서버 |
|---|---|
| 모르는 경로에 진짜 404 | `catch { file = index.html }` — 전부 200 + 셸 (감사 #2) |
| 보안 헤더 6종 | 없음 (감사 #5) |
| `/beta` 를 프리렌더 문서로 | SPA 폴백이라 빈 셸 |
| 옛 주소 서버측 301 | 없음 |
| `/assets/` 1년 immutable | `max-age=3600` 고정 |

`serve-static.mjs` 는 이 브랜치 소유가 아니라 손대지 않았다. 위 표는 "엣지를 옮기지
않으면 이 브랜치의 어떤 항목도 라이브에서 관측되지 않는다"는 사실의 목록이다.

### 그래서 순서가 있다

1. **엣지를 정한다.** 터널 ingress 를 nginx 가 듣는 포트로 돌릴 것인가, 8080 앞에
   nginx 를 세울 것인가, 아니면 당분간 `serve-static.mjs` 로 갈 것인가. 이 결정은
   Cloudflare 대시보드(터널 ingress)와 호스트 양쪽을 건드리므로 사람이 해야 한다.
2. **정해지면 `listen` 을 거기에 맞춘다.** 지금 이 파일은 8001, certbot vhost 는 443,
   터널은 8080 이다. 셋 중 무엇에 맞출지는 1번에 딸린 문제라 추측으로 바꾸지 않았다.
3. **그다음에 `deploy.sh`.** 맞추지 않은 채 돌리면 `sites-enabled/g2b-masters` 가
   지워지고 8001 만 남는다. 지금은 그 vhost 가 공개 트래픽을 받고 있지 않아 사이트가
   통째로 내려가지는 않지만, certbot 이 쓰던 vhost 가 사라지는 것은 그것대로 문제다.

3번을 건너뛰고 1번만 해도 되는 경우가 하나 있다: `serve-static.mjs` 로 계속 가되 그쪽에
같은 규칙(진짜 404 · 보안 헤더 · `/beta` · 옛 주소 301)을 옮겨 심는 것. 그때 이 파일은
"무엇을 심어야 하는지"의 명세로 남는다 — 규칙마다 왜 그런지가 주석에 있고
`src/test/nginxRouteSync.test.ts` 가 라우트 목록을 계속 잠가 준다.

---

## 5. 옛 주소 301 — 쿼리스트링이 있으면 왜 301 을 걸지 않나

`LEGACY_NOTICE_ROUTES` 넷(`/search`, `/notices/bid-plan`, `/notices/pre-spec`,
`/notices/bid-announce`)은 **쿼리스트링이 없을 때만** nginx 가 301 을 낸다.
있으면 셸을 200 으로 내보내고 `LegacyNoticeRedirect` 가 마저 처리한다.

### 이유

`LegacyNoticeRedirect` 는 단순 리다이렉트가 아니라 파라미터 이름을 변환한다.

| 옛 이름 | 지금 이름 |
|---|---|
| `q` | `and` |
| `category` | `cat` |
| `division` | `type` |
| `insttNm` | `instt` |
| `minAmount` | `min` |
| `maxAmount` | `max` |

옛 `/search` 화면은 삭제된 `useIndexCriteria` 의 어휘를 썼고, 지금 `/notices` 는
`useSearchCriteria` 의 어휘를 쓴다. nginx 가 먼저 301 을 내면 브라우저는 `/notices`
로 바로 착지하고 그 컴포넌트는 **마운트되지 않는다.** 착지한 화면은 `q`·`category`
라는 이름을 모르므로 조건이 조용히 사라진다 — 오류도 경고도 없이 "검색이 초기
상태로 열린" 것처럼 보인다.

**쿼리스트링을 보존해서 넘겨도 똑같다.** 값이 없어지는 게 문제가 아니라 변환할
주체가 사라지는 게 문제다. 이건 301 이라는 수단의 본질적 한계다.

### 검토했다가 버린 대안

**변환을 nginx 로 옮긴다.** 이름 여섯 쌍에 더해 `activeOnly` 의 조건부 로직
('마감' 단계에서는 심지 않는다)까지 옮겨야 한다. 그렇게 복제한 규칙은
`LEGACY_PARAM_ALIASES` 가 바뀌는 순간 조용히 갈라진다 — 설정과 코드가 갈라져서
아무도 모르는 상태, 즉 이 파일이 저장소로 들어온 이유 그 자체를 다시 만든다.

**`/notices` 가 옛 이름도 읽게 한다.** 지금 화면의 어휘에 죽은 어휘를 영구히
섞는 것이고, 옛 링크가 사라져도 걷어낼 수 없게 된다. `LegacyNoticeRedirect` 를
한 파일로 격리해 둔 설계 의도와 반대다.

### 그래서 역할을 쪼갰다

| 요청 | 처리 | 얻는 것 |
|---|---|---|
| `/search` (쿼리 없음) | nginx 301 → `/notices?active=true` | 링크 자산 통합. 크롤러가 보는 형태가 정확히 이것이다 |
| `/search?q=조명&from=…` | 셸 200 → 클라이언트가 변환 | 사람이 공유한 검색 조건이 살아남는다 |

쿼리가 붙은 주소는 어차피 색인시키고 싶지 않은 패싯 공간이다(감사 #6). 링크
자산은 맨 주소에 붙어 있고, 그건 301 로 합쳐진다.

### 301 목적지를 클라이언트와 문자 단위로 맞춘 이유

| 경로 | 301 목적지 |
|---|---|
| `/search` | `/notices?active=true` |
| `/notices/bid-plan` | `/notices?cat=%EA%B3%84%ED%9A%8D&active=true` |
| `/notices/pre-spec` | `/notices?cat=%EC%82%AC%EC%A0%84%EA%B7%9C%EA%B2%A9&active=true` |
| `/notices/bid-announce` | `/notices?active=true` |

서버와 클라이언트가 서로 다른 곳에 착지시키면 같은 옛 주소가 경로에 따라 다른
결과 집합을 내고, 그 차이는 어디에도 표시되지 않는다. 셋을 맞췄다.

- **단계.** `/search` 와 `/notices/bid-announce` 에는 걸지 않는다. `routePaths.ts`
  가 의도를 적어 두었다 — '입찰'로 고정하면 '마감'으로 분류된 같은 공고가 빠져
  예전 탭보다 좁은 결과가 나온다. `/search` 는 애초에 전 단계 화면이다.
- **`active=true`.** 옛 주소는 둘 다 "파라미터 없음 = 진행 중만"이었는데 지금
  화면의 기본값은 "마감 포함"이다. 심어 주지 않으면 같은 링크가 예전보다 넓은
  결과를 낸다.
- **조회 기간.** 심지 않는다. 착지한 `/notices` 에서 검색창의 효과가 최근 30일을
  심는다 — 경유지(`isTransitRoute`)가 아니므로 그 효과가 정상적으로 돈다.

---

## 6. `/beta` 는 프리렌더된 정적 문서로 나간다 (ACTION-PLAN 2.2)

`npm run build` 의 마지막 단계가 `dist/beta.html` 을 만든다(`scripts/prerender-beta.mjs`,
근거와 구조는 `docs/beta-prerender.md`). 그 파일이 방문자에게 닿게 하는 조각이 여기 있다.

```nginx
location = /beta {
    try_files /beta.html /index.html =404;
}
```

이 블록이 없으면 `/beta` 요청은 `beta` 라는 파일도 `beta/` 라는 디렉터리도 없으므로
`location /` 의 `try_files` 를 전부 지나 `@spa` 로 떨어지고, 거기서 빈 셸이 200 으로
나간다. **프리렌더 PR 이 머지돼도 라이브에서 아무 일이 일어나지 않는 이유가 이것이다.**

### 왜 `try_files $uri $uri.html $uri/ @spa` 가 아닌가

`docs/beta-prerender.md` 는 `location /` 에 `$uri.html` 한 조각을 더하자고 제안한다.
한 줄이라 매력적이지만, 그 한 줄은 `dist` 에 있는 **모든** `.html` 에 주소를 하나씩 더
열어 준다. 지금 기준으로 셋이다.

| 새로 열리는 주소 | 무엇이 나가나 | 왜 곤란한가 |
|---|---|---|
| `/index` | `dist/index.html` | 셸이 `/` 와 두 주소에서 200 — 중복 콘텐츠 |
| `/404` | `dist/404.html` | 방금 없앤 soft 404 를 주소 하나로 되살린다 |
| `/google9c899d4c05ca14dc` | Search Console 소유확인 파일 | 같은 내용의 두 번째 주소 |

`/404` 는 특히 어긋난다. `location = /404.html { internal; }` 로 직접 열지 못하게 막아
두었는데, `internal` 은 `.html` 이 붙은 쪽만 막는다.

셋을 막으려면 `location = /index { return 301 /; }` 같은 exact match 를 셋 더 두어야
한다. 그런데 그 목록은 `public/` 에 `.html` 이 하나 늘 때마다 사람이 따라가야 하는
사본이다 — 이 파일이 저장소로 들어온 이유(조용히 갈라지는 사본)를 작은 규모로 다시
만드는 것이다. 프리렌더된 주소를 한 줄씩 명시하면 "열리는 주소"와 "적어 둔 주소"가
같아지고, 프리렌더 페이지가 늘면 줄이 는다.

마지막의 `/index.html` 은 프리렌더가 돌지 않은 빌드를 위한 안전망이다. 그때 `/beta` 는
예전처럼 셸로 나가 화면 자체는 살아 있고 본문만 빈다.

### `/beta/` (끝 슬래시)

`@spa` 에서 슬래시 없는 주소로 301 한다. 없으면 `/beta` 는 프리렌더 문서(34,874 B),
`/beta/` 는 빈 셸(7,676 B)이 되어 **서로 다른 내용이 두 주소에서 200** 이다. 사이트맵도
`routePaths.ts` 도 canonical 도 전부 슬래시 없는 `/beta` 를 가리키지만, 크롤러가 어느
쪽을 먼저 잡을지는 정해져 있지 않다.

규칙은 `/beta` 전용으로 두지 않고 앱 라우트 전체에 걸었다. `/notices` 와 `/notices/` 도
같은 이유로 갈라져 있었고(둘 다 200 + 같은 셸), 한 줄로 함께 접힌다.

### 측정

저장소 설정을 스크래치 포트(18001)에 자체서명 인증서로 올리고, `origin/main` 빌드에
`public/404.html` 을 더한 webroot 로 찍었다. 치환한 것은 `listen`·인증서 경로·`root`·
로그 경로 넷뿐이고 나머지는 이 파일 그대로다.

| 주소 | 고치기 전 | 고친 뒤 |
|---|---|---|
| `/beta` | 200 · 7,676 B 셸 · "연 200조" 0회 | **200 · 34,874 B · 1회** |
| `/beta/` | 200 · 7,676 B 셸 | **301 → `/beta`** |
| `/notices/` | 200 · 7,676 B 셸 | **301 → `/notices`** |
| `/index` | 404 | 404 (그대로) |
| `/404` | 404 | 404 (그대로) |
| `/price-db` · `/analysis-lab` · `/trends/product` | 200 · 셸 | **404** (접힌 화면) |
| `/robots.txt` · `/llms.txt` · `/google…html` | 200 | 200 (그대로) |
| `/search` | 301 → `…:18001/notices?active=true` | **301 → `/notices?active=true`** |

마지막 줄이 덤으로 나온 수정이다. nginx 는 `return 301 /경로` 에 스킴·호스트·**포트**를
붙여 절대 URL 로 바꾼다. 라이브 포트 8001 은 Cloudflare 가 프록시하는 포트가 아니라서,
옛 주소 301 이 링크 자산을 합치기는커녕 엣지 밖으로 안내하게 된다. `absolute_redirect off;`
한 줄로 적어 둔 그대로 나간다.

### 조용히 깨지는 자리

`scripts/prerender-beta.mjs` 가 출력 이름을 바꾸면(예: `dist/beta/index.html`) nginx 는
아무 말 없이 셸을 내보낸다. 오류도 경고도 없고, 화면은 JS 가 그리니 사람 눈에는 똑같다.
손해는 JS 를 실행하지 않는 수집기 쪽에서만 나는데 그쪽은 아무 신호도 보내지 않는다.
그래서 `src/test/nginxRouteSync.test.ts` 가 스크립트가 쓰는 파일 이름과 nginx 가 찾는
이름을 대조하고, `deploy.sh` 가 배포 직후 본문 문자열을 확인한다.

---

## 7. 아직 안 한 것

- **감사 #6 (패싯 파라미터).** `/notices?from=…&to=…&mode=item&cat=…` 의 조합은
  사실상 무한하고 전부 200 이며 self-canonical 이 없다. nginx 에서 막을 문제가
  아니다 — 라우트별 canonical 이 `origin + pathname` 으로 나오게 하는 것이
  올바른 수정이고(ACTION-PLAN 1.6), 그건 프론트 작업이다. 서버측 301 로 파라미터를
  잘라내면 사용자가 공유한 검색 조건이 사라지므로 하면 안 된다.
- **CSP 강제 전환.** 위 1절.
- **CSP 위반 수집 엔드포인트.** 위 1절.
- **엣지 이관.** 4절. 이 설정이 요청 경로에 들어가기 전까지 여기 있는 모든 항목은
  라이브에서 관측되지 않는다. 이 브랜치에서 할 수 있는 일이 아니다 — 터널 ingress 는
  Cloudflare 대시보드에 있고, `serve-static.mjs` 는 다른 소유다.
- **`main` 의 빌드 (2026-08-28 기준).** `npm run build` 가 프리렌더 단계에서 죽는다.
  `src/features/beta/prerenderDocument.ts` 가 셸에 `hreflang` 링크가 정확히 하나 있기를
  요구하는데(PR #24), `index.html` 은 그것을 일부러 지웠다(PR #19). 두 PR 이 서로를
  모른 채 머지된 결과다. **지금은 `dist/beta.html` 이 아예 만들어지지 않는다** — 즉
  6절의 `location = /beta` 는 그 빌드가 고쳐진 뒤에야 의미가 있다. 여기서 고칠 파일이
  아니라 적어만 둔다. `deploy.sh` 가 `dist/beta.html` 없이 배포되는 것을 경고한다.
