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

## 3. 코드로 고칠 수 없는 것 — Cloudflare 대시보드

세 항목은 설정 파일이 아무리 옳아도 엣지에서 덮인다. 사람이 대시보드에서 해야 한다.

| 항목 | 위치 | 지금 | 해야 할 값 |
|---|---|---|---|
| Always Use HTTPS | SSL/TLS → Edge Certificates | Off | **On** |
| Browser Cache TTL | Caching → Configuration | 4 hours | **Respect Existing Headers** |
| 오리진 포트 | DNS/Origin 설정 | 확인 필요 | 아래 4절 |

**Always Use HTTPS.** 감사 #4 가 본 200 은 오리진의 80 이 낸 응답이 아니다.
방문자의 평문 요청은 Cloudflare 가 먼저 받고, Cloudflare 는 자기 규칙에 따라
오리진에 붙는다. 라이브 vhost 에도 이미 `listen 80` → 301 이 있었는데도 200 이
나온 이유가 그것이다. 설정 파일의 80 블록은 오리진을 직접 찌르는 경로를 막는
이중 방어이고, 사용자에게 보이는 수정은 이 스위치다.

**Browser Cache TTL.** `/assets/` 는 파일명에 콘텐츠 해시가 박히므로
`max-age=31536000, immutable` 이 정확한 값인데, 현재 Cloudflare 가 이것을
4시간으로 덮어쓰고 있다. 설정 파일의 값은 그동안 아무 효과가 없다.

---

## 4. ⚠ 배포 전 확인 — 이 파일과 라이브가 갈라져 있다 (감사 #8)

2026-08-27 기준 `sites-enabled/g2b-masters` 에 실제로 걸려 있는 것은 저장소 파일이
아니라 certbot 이 만든 별개의 vhost 다.

```
listen 192.168.219.52:443 ssl;          # 저장소 파일은 8001
location / { proxy_pass http://192.168.219.52:5173; }   # 정적 파일이 아니라 Vite dev 서버
```

두 가지가 여기서 설명된다.

- **감사 #2·#8 의 실제 원인.** dev 서버는 모든 경로에 `index.html` 을 돌려준다.
  그래서 `/swagger-ui/index.html` 이 SPA 셸을 반환했고(#8), 존재하지 않는 모든
  경로가 200 이었다(#2). 저장소 파일의 `try_files` 는 라이브에서 한 번도 실행된
  적이 없다.
- **배포 위험.** `deploy.sh` 는 `sites-enabled/g2b-masters` 를 지우고 저장소 파일을
  건다. Cloudflare 의 오리진 포트가 443 이라면 그 순간 443 에서 받는 vhost 가
  사라져 **사이트가 통째로 내려간다.**

→ 배포 전에 Cloudflare 오리진 포트를 확인하고, 443 이면 `listen` 을 그쪽에 맞춰라.
추측으로 바꾸지 않고 남겨 두었다.

---

## 5. 아직 안 한 것

- **감사 #6 (패싯 파라미터).** `/notices?from=…&to=…&mode=item&cat=…` 의 조합은
  사실상 무한하고 전부 200 이며 self-canonical 이 없다. nginx 에서 막을 문제가
  아니다 — 라우트별 canonical 이 `origin + pathname` 으로 나오게 하는 것이
  올바른 수정이고(ACTION-PLAN 1.6), 그건 프론트 작업이다. 서버측 301 로 파라미터를
  잘라내면 사용자가 공유한 검색 조건이 사라지므로 하면 안 된다.
- **CSP 강제 전환.** 위 1절.
- **CSP 위반 수집 엔드포인트.** 위 1절.
