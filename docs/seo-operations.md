# SEO 운영 — 코드로 고칠 수 없는 것들

이 문서는 `g2b-masters.electerior.co.kr` 의 검색 노출에 영향을 주면서 **이 저장소를 고쳐서는
바뀌지 않는** 항목을 모아 둔 것이다. 근거는 2026-08-27 감사
(`g2b-masters.electerior.co.kr-audit/findings/`, `ACTION-PLAN.md`)다.

이런 문서가 따로 필요한 이유는 하나다. 이 항목들은 **PR 을 머지해도 라이브가 그대로**여서,
모르는 사람이 보면 배포가 실패한 것처럼 보인다. 실제로는 Cloudflare 엣지나 대시보드 설정이
오리진 위에 얹혀 있는 것이고, 고칠 곳은 코드가 아니라 대시보드다.

---

## 1. Cloudflare 가 `/robots.txt` 를 덮어쓰고 있다

**가장 먼저 알아야 할 사실이다.** `public/robots.txt` 를 고쳐 배포해도 라이브
`/robots.txt` 는 바뀌지 않는다. Cloudflare 의 관리형 AI 크롤러 차단(AI Crawl Control /
"Block AI bots")이 켜져 있으면 엣지가 자기 robots.txt 를 **합성해서 대신 응답**하고,
오리진의 파일은 요청에 닿지도 않는다.

감사 시점의 라이브 응답에는 저장소 어디에도 없는 다음 내용이 들어 있었다:

```
Amazonbot · Applebot-Extended · Bytespider · CCBot · ClaudeBot
CloudflareBrowserRenderingCrawler · Google-Extended · GPTBot · meta-externalagent
```

```
User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /
```

`Content-Signal` 은 이 저장소가 쓴 적이 없는 지시자다. 이것이 보이면 엣지가 응답을
만들고 있다는 신호로 봐도 된다.

### 확인 방법

```bash
# 1) 라이브가 무엇을 내려주는지
curl -s https://g2b-masters.electerior.co.kr/robots.txt

# 2) 저장소 파일과 다른지
diff <(curl -s https://g2b-masters.electerior.co.kr/robots.txt) public/robots.txt

# 3) 엣지가 만든 응답인지 (cf-cache-status / 오리진에 없는 지시자 유무)
curl -sI https://g2b-masters.electerior.co.kr/robots.txt
curl -s  https://g2b-masters.electerior.co.kr/robots.txt | grep -i 'Content-Signal'
```

`Content-Signal` 이 잡히거나 `diff` 가 오리진에 없는 User-agent 블록을 보여 주면, 그때부터는
저장소를 고쳐 봐야 소용이 없다.

### 어디를 봐야 하나

Cloudflare 대시보드 → 해당 존(`electerior.co.kr`) → **Security → Bots → AI Crawl Control**
(계정에 따라 **AI Audit**, 또는 Security 개요의 "Block AI bots" 토글로 보인다).
여기서 켠 차단이 robots.txt 합성의 출처다.

- 오리진의 robots.txt 를 그대로 내보내고 싶다면 이 기능을 끈다. 단, 끄면 아래 2절의
  `ai-train=no` 도 같이 사라진다는 것을 알고 끄는 것이어야 한다.
- 유지하되 일부 크롤러만 풀고 싶다면 같은 화면에서 크롤러별로 허용/차단을 바꾼다.
  이 경우 오리진의 `public/robots.txt` 는 **여전히 서빙되지 않는다** — 저장소 파일은
  "우리가 의도한 정책"의 기록으로만 남고, 실효는 대시보드가 갖는다.

두 파일이 갈라져 있다는 사실 자체를 잊지 않는 것이 요점이다. `public/robots.txt` 상단에도
같은 경고를 주석으로 남겼다.

> **참고:** `/sitemap.xml` 과 `/llms.txt` 는 이 합성 대상이 아니다. 정적 파일 그대로
> 나가므로 저장소를 고치면 배포로 반영된다.

---

## 2. AI 크롤러 정책 — 학습과 검색·인용은 다른 문제다

**이것은 기술 결정이 아니라 사업 판단이다. 결정이 나기 전까지 코드로 강행하지 않는다.**
이 브랜치도 robots.txt 에 AI 크롤러 관련 지시자를 넣지 않았다. 어차피 1절 때문에 효력도
없거니와, 결정되지 않은 정책을 파일에 박아 두면 나중에 그게 결정인 줄 알게 된다.

정리해야 할 구분은 하나다.

| | 무엇을 내주는가 | 우리에게 무엇인가 |
|---|---|---|
| **학습(train)** | 모델 가중치 안으로 코퍼스가 들어간다. 출처도 링크도 남지 않는다. | 되돌릴 수 없는 유출. 유료 B2B 데이터 제품이 막을 이유가 분명하다. |
| **검색·인용(retrieval)** | 질문이 들어온 순간 페이지를 가져가 답에 **출처와 함께** 인용한다. | 공짜 유통. 베타 테스터를 모으는 단계에서는 광고비 없는 노출이다. |

현재 설정은 이 둘을 구분하지 않고 한꺼번에 막고 있다.

### 권고

1. **`Content-Signal: ai-train=no` 는 유지한다.** 코퍼스를 지키는 쪽은 그대로 둔다.
   유료 조달 데이터 제품이 학습을 거부하는 것은 방어할 수 있는 입장이다.

2. **`CloudflareBrowserRenderingCrawler` 를 푸는 것이 가장 시급하다.**
   이 사이트는 JS 로만 그리는 SPA 라서, JS 를 실행하지 않는 수집기에게는 어느 주소든
   빈 `<div id="root">` 만 보인다. 이 렌더러는 **그 빈 셸을 실제 내용으로 풀어 주는 바로
   그 도구**인데 지금 막혀 있다. 즉 지금 정책은 "내용을 가져가지 마라"가 아니라
   "내용을 볼 수 있는 유일한 경로를 막아 두고, 볼 수 없는 것들만 들여보내는" 상태다.
   학습과도 무관하다 — 렌더링 결과를 학습에 넣는 물건이 아니다.

3. **`Google-Extended` 해제 후보.** 막아 두면 Gemini 그라운딩과 AI Overviews 인용에서
   빠진다. 일반 검색 색인에는 영향이 없다. 즉 이 항목은 "학습 거부"가 아니라
   "AI 검색 결과에 우리 이름이 나오는 것을 포기"에 가깝다.

4. **`ClaudeBot` 해제 후보.** 같은 논리. 검색·인용 경로다.

5. 풀더라도 범위를 좁힐 수 있다. AI 에이전트에게는 `/beta` 와 앞으로 생길 콘텐츠 페이지만
   `Allow` 하고 데이터 화면(`/notices`, `/notices/bid-result`)은 닫아 두는 방식이다.
   인용해 갈 만한 산문은 어차피 랜딩과 콘텐츠 쪽에 있고, 데이터 화면은 제품 그 자체다.

### 순서

`ACTION-PLAN 2.2` 의 `/beta` 프리렌더가 먼저다. 크롤러를 다 풀어 줘도 지금 가져갈 수 있는
것은 빈 셸이라, 프리렌더 없이 여는 것은 효과가 없다. **프리렌더 → 검색·인용 에이전트 해제**
순으로 간다. 반대로 하면 "열었는데 아무 일도 안 일어났다"는 결론만 남는다.

---

## 3. Always Use HTTPS: On

Cloudflare 대시보드 → **SSL/TLS → Edge Certificates → Always Use HTTPS: On**

지금은 평문 HTTP 가 리다이렉트 없이 200 을 낸다:

```
$ curl -D- http://g2b-masters.electerior.co.kr/notices
HTTP/1.1 200 OK
```

같은 콘텐츠가 `http://` 와 `https://` 두 주소로 존재하니 중복 URL 공간이 생기고, 다운그레이드
경로도 열려 있다. nginx 쪽에 `listen 80` 리다이렉트 블록도 없지만, 요청이 Cloudflare 를 먼저
지나므로 **엣지에서 켜는 쪽이 정답**이다. 오리진에서만 고치면 엣지가 이미 종단한 요청에는
적용되지 않는다.

같은 화면에서 HSTS 도 검토할 수 있다. 다만 HSTS 는 되돌리기가 어려우니
(`max-age` 가 만료될 때까지 브라우저가 기억한다) Always Use HTTPS 를 먼저 켜고 한동안
문제가 없는 것을 확인한 뒤에 켠다.

확인:

```bash
curl -sI http://g2b-masters.electerior.co.kr/notices | head -3   # 301 이 나와야 한다
```

---

## 4. Browser Cache TTL: Respect Existing Headers

Cloudflare 대시보드 → **Caching → Configuration → Browser Cache TTL** → `Respect Existing Headers`

지금은 Cloudflare 가 4시간으로 고정해서, 오리진이 보내는 `immutable` 30일 헤더를 덮어쓰고
있다. **오리진 쪽이 맞다.** Vite 빌드 산출물은 파일명에 콘텐츠 해시가 들어가므로
(`assets/index-CRKkmEkO.js`) 내용이 바뀌면 파일명이 바뀐다. 즉 같은 URL 이 다른 내용을
가리키는 일이 구조적으로 없고, 30일 캐시가 낡은 자산을 물릴 위험도 없다.

4시간으로 깎으면 재방문자가 아무 이유 없이 번들을 다시 받는다. `index.html` 은 해시가 없지만
그쪽은 원래 짧은 TTL 로 나가므로 이 변경의 영향을 받지 않는다.

확인:

```bash
curl -sI https://g2b-masters.electerior.co.kr/assets/<해시가 붙은 파일>.js | grep -i cache-control
# max-age=31536000, immutable 이 그대로 보여야 한다
```

---

## 5. Search Console 후속 조치

소유권 확인은 이미 살아 있다(`public/google9c899d4c05ca14dc.html`). 이 브랜치가 배포된 뒤에
할 일:

1. **새 사이트맵 제출.** Search Console → 색인 생성 → Sitemaps → `sitemap.xml` 제출.
   이전 사이트맵은 다른 도메인만 나열하고 있어서 처리되지 않았을 가능성이 높다.
   제출 후 "가져온 URL 8개"가 뜨는지 확인한다.

2. **soft-404 정리 확인.** 페이지 → "크롤링됨 - 현재 색인이 생성되지 않음" 과
   "발견됨 - 현재 색인이 생성되지 않음" 을 본다. 이 사이트는 모든 미지정 경로가 200 과
   함께 앱 셸을 돌려주고 있어서(ACTION-PLAN 1.2) soft-404 가 무제한으로 쌓인다.
   1.2 의 nginx 수정이 배포된 뒤 이 항목이 줄어드는지 몇 주에 걸쳐 지켜본다.
   **사이트맵 제출만으로는 줄지 않는다** — 원인이 다르다.

3. **`vercel.app` 통합 확인.** `index.html` 의 canonical 이 다른 브랜치에서 이 도메인으로
   바로잡힌 뒤, URL 검사 도구로 `/beta` 와 `/notices` 를 찍어 "사용자가 선언한 표준 URL" 과
   "Google이 선택한 표준 URL" 이 모두 이 도메인인지 확인한다. 둘이 갈라져 있으면 canonical
   수정이 아직 반영되지 않은 것이다.

4. `g2bmasters-open.vercel.app` 을 어떻게 할지 정한다(ACTION-PLAN 1.1). 살아 있는 동안은
   같은 브랜드의 경쟁 중복 사이트다. 이 저장소에서 할 수 있는 일이 아니다.

---

## 6. 실측 성능 — 이 감사에는 CWV 측정값이 **하나도 없다**

가장 오해받기 쉬운 항목이라 먼저 못 박는다. 감사 보고서의 Performance 절은 65/100 이라는
점수를 달고 있지만, 그 안의 **LCP·INP·CLS 는 어느 것도 측정된 값이 아니다.** 보고서 자신이
그렇게 적어 두었다 — CrUX/PSI 는 API 키가 없어 못 불렀고, 번들 렌더러는 초기화되지 않았고,
Playwright 는 설치돼 있지 않았다.

실제로 측정된 것은 네트워크 계층뿐이다: TTFB 181/270/325 ms, TLS 89 ms, HTTP/2 + h3,
브로틀리 3.1배. 나머지는 페이로드 분석에서 나온 **추론**이다("본문이 비어 있으니 LCP 는
번들이 실행된 뒤에야 시작할 수 있다").

### 왜 지금 다시 재야 하나

추론의 전제가 그 뒤로 두 번 바뀌었다.

| | 감사 시점 | 지금 |
|---|---|---|
| 진입 번들 | 608 KB 단일 청크 | 라우트 코드 스플릿 + 벤더 분리 (진입 약 71 KB) |
| `/beta` 의 HTML | 5,851 B / 본문 0 단어 | 프리렌더 35 KB / 본문 1,270 단어 |

`/beta` 는 이제 LCP 요소가 HTML 안에 있다. 추론으로는 "좋아졌을 것"이지만 그건 측정이
아니다. 특히 프리렌더는 **이어받기(hydration) 비용**을 새로 만들기 때문에 INP 쪽에서
손해를 볼 수도 있고, 그건 페이로드를 봐서는 알 수 없다.

### 어떻게 재나

1. **PageSpeed Insights** — 가장 손쉽다. 로그인도 키도 필요 없다.
   `https://pagespeed.web.dev/` 에 `https://g2b-masters.electerior.co.kr/beta` 와
   `/notices` 를 넣는다. 결과의 두 부분을 구분해서 읽어라:
   - **실사용자 데이터(CrUX)** — 없다고 나올 가능성이 높다. 트래픽이 임계치에 못 미치면
     구글이 필드 데이터를 만들지 않는다. "없음"은 나쁜 점수가 아니라 **아직 모른다**는 뜻이다.
   - **실험실 데이터(Lighthouse)** — 항상 나온다. 배포 전후 비교에 쓸 수 있는 건 이쪽이다.
     단 실행마다 흔들리므로 3회 돌려 중앙값을 본다.
2. **Search Console → 유용한 페이지 경험 / Core Web Vitals** — 필드 데이터가 쌓이면
   여기 뜬다. 트래픽이 붙기 전에는 비어 있는 것이 정상이다.
3. 자동화가 필요해지면 PSI API 키를 발급해 CI 에 붙인다. **지금은 이르다** — 비교할
   기준선이 없는 상태에서 숫자만 쌓으면 해석할 수 없다. 위 1번으로 배포 전후를 한 번
   찍어 기준선을 만드는 것이 먼저다.

### 재지 않아도 되는 것

이미지 최적화는 이 사이트에서 **해당 사항이 없다.** 감사가 헤드리스 브라우저로 아홉 개
주소를 실측한 결과 `<img>` 0 개, `<svg>` 0 개, CSS 배경이미지 0 개였다. 랜딩의 모든 시각
요소는 CSS 그라디언트다. alt 텍스트 부채도, 포맷 변환 대상도, 이미지 CLS 도 존재하지 않는다.
(감사 1차 보고서는 이 항목을 "측정 못 함"으로 두고 점수를 깎았다가, 2차에서 "해당 없음"으로
정정했다. `findings/images.md` 참고.)

---

## 7. 드리프트 감시 — 이 감사의 근본 원인이 정확히 그 종류다

감사가 34점을 준 이유는 기능이 부실해서가 아니었다. **다른 배포본의 `<head>` 를 복사해 오고
호스트를 재지정하지 않은 것 하나** 때문이었다. 화면에는 아무 증상이 없었고, 배포도 정상이었고,
외부 감사가 나올 때까지 아무도 몰랐다.

### 그리고 고치는 도중에 같은 일이 또 났다

이건 가정이 아니라 이 저장소에서 실제로 일어난 일이다. 감사 대응 PR 들을 머지하는 과정에서:

- PR #16 이 끈 프로덕션 소스맵이 **`true` 로 되살아났다.** PR #24 를 머지하며 `vite.config.ts`
  충돌을 한쪽으로 풀었기 때문이다. 배포됐다면 TypeScript 원문 2.9 MB 가 다시 공개된다 —
  감사가 1.5 로 지적한 바로 그 상태다.
- 같은 머지에서 `rollupOptions.output.manualChunks` 배선이 통째로 빠졌다. `vendorChunk`
  함수와 그 긴 설명 주석은 그대로 남아서, 파일을 읽은 사람은 벤더가 갈리고 있다고 믿게 된다.
  죽은 코드가 아니라 **거짓말하는 코드**였다.
- PR #19 가 셸에서 hreflang 줄을 지웠는데 PR #24 의 프리렌더가 그 줄을 "정확히 한 번"
  찾도록 돼 있어 **`npm run build` 가 아예 섰다.**

셋 다 테스트를 전부 통과했고 앱은 똑같이 돌았다. 앞의 둘은 `dist` 를 열어 봐야만 보인다.

### 그래서 두 겹으로 막는다

**(1) 저장소 안 — CI 가 막는다.** 지금 있는 잠금장치:

| 파일 | 무엇을 지키나 |
|---|---|
| `src/test/indexHtmlSeo.test.ts` | 셸 head 의 호스트, canonical 정확값, og:image 래스터 강제, JSON-LD 그래프 식별자, hreflang 이 **되살아나지 않을 것** |
| `src/test/publicSeoAssets.test.ts` | sitemap 의 모든 `<loc>` 이 실재 라우트일 것, 호스트, 제외하기로 한 화면이 다시 들어오지 않을 것 |
| `src/test/viteBuildConfig.test.ts` † | `sourcemap` 값, `manualChunks` 배선, `manifest` 선언 |
| `src/test/betaPrerender.test.tsx` | 프리렌더 결과의 head·본문·이어받기 무결성 |
| `src/seo/routeMeta.test.ts` · `useSeoMeta.test.tsx` · `routeWiring.test.tsx` † | 라우트별 메타가 실제 화면에서 세워질 것, 쿼리가 canonical 에 새지 않을 것 |
| `src/routes/routeHeadings.test.tsx` † | 라우트마다 h1 이 하나이고 브랜드명이 아닐 것 |
| `src/test/nginxRouteSync.test.ts` † | 라우트 표와 nginx 설정이 갈라지지 않을 것 |

† 표시는 **아직 main 에 없다** — 해당 PR 이 머지되면 사라진다. 이 표를 읽고 "이미 지켜지고
있다"고 넘기지 않도록 구분해 둔다. 표시가 남아 있는 줄은 지금 아무도 지키지 않는 규칙이다.

새 SEO 결정을 내릴 때마다 **그것을 지키는 시험을 같은 PR 에 넣는다.** 이 목록에 줄이 하나
늘지 않는 SEO PR 은 다음 머지에서 조용히 사라질 수 있다고 봐야 한다.

**(2) 저장소 밖 — CI 가 볼 수 없는 것.** 위 시험들은 전부 저장소 파일만 읽는다. 라이브
응답은 보지 못한다. Cloudflare 엣지가 robots.txt 를 합성하고(1절), 배포된 nginx 가 저장소
설정과 이미 갈라져 있는(감사 technical.md #8) 환경에서는 **저장소가 옳아도 라이브가 틀릴 수
있다.** 배포 뒤 한 번은 밖에서 찔러 봐야 한다.

```bash
HOST=g2b-masters.electerior.co.kr

# canonical 이 이 도메인인가 (감사 1순위 결함)
curl -s https://$HOST/notices | grep -o '<link rel="canonical"[^>]*>'

# 없는 주소가 진짜 404 를 내는가 (200 이면 1.2 가 라이브에 반영 안 된 것)
curl -o /dev/null -sw '%{http_code}\n' https://$HOST/this-page-does-not-exist-9f8a7

# 평문 HTTP 가 301 로 넘어가는가 (-L 을 붙이지 않아야 리다이렉트 자체가 보인다)
curl -o /dev/null -sw '%{http_code}\n' http://$HOST/notices

# 소스맵이 공개되고 있지 않은가 (404 여야 정상)
JS=$(curl -s https://$HOST/ | grep -o '/assets/index-[^"]*\.js' | head -1)
curl -o /dev/null -sw "$JS.map → %{http_code}\n" "https://$HOST$JS.map"

# /beta 가 프리렌더된 본문을 내는가 (0 이면 nginx 가 셸을 내주고 있다)
curl -s https://$HOST/beta | grep -c '연 200조'

# 보안 헤더가 붙어 있는가
curl -sI https://$HOST/ | grep -iE 'strict-transport|x-content-type|referrer-policy'

# 라이브 robots.txt 가 저장소 파일과 같은가 (다르면 엣지가 만들고 있다 — 1절)
diff <(curl -s https://$HOST/robots.txt) public/robots.txt
```

### 2026-08-28 실측 — 지금 라이브가 이렇다

위 명령을 그대로 돌린 결과다. **감사 대응 PR 이 여러 개 머지됐지만 라이브에 닿은 것은
아직 하나뿐**이라는 것이 한눈에 보인다. 머지와 배포는 다른 일이다.

| 점검 | 결과 | 판정 |
|---|---|---|
| canonical (`/notices`) | `https://g2b-masters.electerior.co.kr/` | ✅ 이 도메인. 감사 1순위 결함(1.1)은 **라이브에 반영됐다** |
| 없는 주소 | **200** | ❌ 여전히 소프트 404 (1.2 미배포) |
| 평문 HTTP | **200** | ❌ 리다이렉트 없음 (1.4 미적용) |
| 소스맵 `.map` | **200** | ❌ 여전히 공개 중 (1.5 미배포) |
| `/beta` 본문 | **0건** | ❌ 셸이 나가고 있다 (2.2 미배포, nginx `$uri.html` 필요) |
| 보안 헤더 3종 | **없음** | ❌ (1.4 미적용) |

canonical 만 통과한 것은 그것이 `index.html` 안에 있어서 **프론트 빌드를 올리는 것만으로
반영**되기 때문이다. 나머지는 전부 nginx 설정이나 Cloudflare 대시보드가 필요하다 — 즉
저장소를 아무리 고쳐도 그쪽을 건드리기 전까지는 이 표가 바뀌지 않는다. 이 문서가 존재하는
이유가 정확히 이것이다.

`/notices` 의 canonical 이 `/notices` 가 아니라 루트인 것은 정상이다. 라우트별 canonical 은
아직 머지되지 않았고(2.1), 지금은 정적 셸의 값 하나가 모든 주소에 나간다.

이 묶음은 `deploy/deploy.sh` 의 배포 후 점검과 겹친다. **겹치는 것이 의도다** — 배포하는
사람이 스크립트를 안 쓰고 손으로 올리는 날이 반드시 오기 때문이다.

---

## 8. 언제 다시 감사하나

감사 원문의 예상 점수는 34 → (1단계) 62 → (2단계) 75 → (3단계) 85 다. 그 숫자를 목표로
삼지는 마라 — 재감사의 목적은 점수가 아니라 **이번에 고친 것이 라이브에 실제로 반영됐는지,
그리고 새로 생긴 결함이 없는지** 확인하는 것이다.

재감사할 만한 시점은 셋이다.

1. **1·2단계 PR 이 전부 배포되고 Search Console 이 새 사이트맵을 처리한 뒤** — 보통 제출
   후 며칠. 이때 확인할 것은 순위가 아니라 **색인 자격**이다: URL 검사에서 "Google이 선택한
   표준 URL" 이 이 도메인인가.
2. **콘텐츠 페이지(3.1·3.2)가 올라간 뒤** — 이 도메인에 처음으로 산문이 생기는 시점이라,
   그 전까지의 Content/AI Search 점수는 잴 대상 자체가 없었다.
3. **Cloudflare 의 AI 크롤러 정책이 결정된 뒤**(2절) — 그 결정 전에는 AI Search 항목을 다시
   재도 같은 답이 나온다.

각 시점에서 위 6·7절의 명령을 먼저 돌려라. 라이브가 저장소와 다르면 감사를 다시 돌리는
것보다 그 차이를 먼저 없애는 것이 빠르다.

---

## 체크리스트

| 항목 | 어디서 | 누가 | 상태 |
|---|---|---|---|
| robots.txt 를 엣지가 덮어쓰는지 확인 | Cloudflare → Security → Bots → AI Crawl Control | 운영 | 미확인 |
| AI 학습 vs 검색·인용 정책 결정 | 사업 판단 | 대표 | 미결정 |
| `CloudflareBrowserRenderingCrawler` 해제 | 위와 같은 화면 | 운영 | 결정 대기 |
| Always Use HTTPS: On | Cloudflare → SSL/TLS → Edge Certificates | 운영 | 미적용 |
| Browser Cache TTL: Respect Existing Headers | Cloudflare → Caching → Configuration | 운영 | 미적용 |
| 새 sitemap.xml 제출 | Search Console → Sitemaps | 운영 | 배포 후 |
| soft-404 추이 확인 | Search Console → 페이지 | 운영 | 1.2 배포 후 |
| CWV 기준선 측정 (PSI 3회 중앙값) | pagespeed.web.dev — `/beta`·`/notices` | 개발 | 배포 후 |
| 배포 후 라이브 점검 7종 | 7절의 curl 묶음 | 배포자 | 매 배포 |
| 재감사 | 6·7절 점검이 통과한 뒤 | 개발 | 콘텐츠 배포 후 |

---

## 이 저장소에서 처리한 것 (참고)

코드로 고칠 수 있어서 이미 처리한 것들. 여기 적는 이유는 위 목록과 헷갈리지 않기 위해서다.

- `public/sitemap.xml` — 이 도메인의 실제 주소 8개로 교체. 제외 기준은 파일 주석에.
- `public/robots.txt` — `Sitemap` 지시자를 이 도메인으로. 내부 화면을 일부러 막지 않는
  이유도 주석에. (다만 1절 때문에 라이브에 반영되지 않을 수 있다.)
- `public/llms.txt` — 신규. 이전에는 200 과 함께 빈 셸이 나갔다.
- `src/test/publicSeoAssets.test.ts` — 사이트맵의 모든 `<loc>` 이 `ROUTES` 에 실제로 있는
  경로인지, 호스트가 이 도메인인지, 제외하기로 한 화면이 다시 들어오지 않았는지를 잠근다.
