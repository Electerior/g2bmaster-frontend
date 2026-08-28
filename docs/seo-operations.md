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

---

## 이 저장소에서 처리한 것 (참고)

코드로 고칠 수 있어서 이미 처리한 것들. 여기 적는 이유는 위 목록과 헷갈리지 않기 위해서다.

- `public/sitemap.xml` — 이 도메인의 실제 주소 8개로 교체. 제외 기준은 파일 주석에.
- `public/robots.txt` — `Sitemap` 지시자를 이 도메인으로. 내부 화면을 일부러 막지 않는
  이유도 주석에. (다만 1절 때문에 라이브에 반영되지 않을 수 있다.)
- `public/llms.txt` — 신규. 이전에는 200 과 함께 빈 셸이 나갔다.
- `src/test/publicSeoAssets.test.ts` — 사이트맵의 모든 `<loc>` 이 `ROUTES` 에 실제로 있는
  경로인지, 호스트가 이 도메인인지, 제외하기로 한 화면이 다시 들어오지 않았는지를 잠근다.
