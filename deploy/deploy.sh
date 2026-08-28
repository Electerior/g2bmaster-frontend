#!/usr/bin/env bash
# g2b-masters 배포 — 프론트 빌드 복사 + nginx 사이트 설치/재기동
# 실행: bash <저장소>/deploy/deploy.sh   (sudo 를 내부에서 요구함)
set -euo pipefail

#
# 경로는 이 스크립트 위치에서 유도한다 — 절대경로를 박아 두지 않는다.
#
# 예전에는 이 파일과 nginx 설정이 /home/user/hanbin5/deploy/ 에 있었다. git 밖이라
# 저장소에는 사본조차 없었고, 배포된 설정이 언제 무엇으로 갈라졌는지 아무도 볼 수 없었다.
# 2026-08-27 SEO 감사 #8 이 그 결과를 잡아냈다: 저장소에 있다고 믿었던 설정과 실제
# 라이브 응답이 서로 달랐다. 설정을 저장소 안으로 들여오는 것이 그 지적에 대한 수정이고,
# 여기 경로가 저장소 사본을 가리키는 것이 그 수정의 마지막 조각이다.
#
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

FRONTEND_DIST="$REPO_ROOT/dist"
NGINX_SRC="$REPO_ROOT/deploy/nginx-g2b-masters.conf"
WEBROOT=/var/www/g2bmaster

command -v sudo >/dev/null || { echo "sudo 필요"; exit 1; }
[ -d "$FRONTEND_DIST" ] || { echo "프론트 빌드가 없다: $FRONTEND_DIST — 먼저 npm run build"; exit 1; }
[ -f "$NGINX_SRC" ] || { echo "설정 없음: $NGINX_SRC"; exit 1; }

# nginx 의 `error_page 404 /404.html` 이 이 파일을 꺼내 쓴다. 없으면 죽지는 않고
# nginx 기본 404 페이지가 나가는데, 그 페이지에는 noindex 가 없다 — 지금 고치고 있는
# 문제(감사 #2)가 절반만 고쳐진 상태가 된다. 배포는 막지 않고 눈에 띄게만 한다.
[ -f "$FRONTEND_DIST/404.html" ] || echo "⚠ $FRONTEND_DIST/404.html 이 없다 — public/404.html 이 빌드에 포함됐는지 확인할 것"

# nginx 의 `location = /beta` 가 이 파일을 먼저 찾는다. 없으면 그 다음 후보인 셸이
# 나가므로 /beta 는 200 을 유지하지만 본문이 빈다 — 화면은 JS 가 그리니 눈에 띄지 않고,
# 손해는 JS 를 실행하지 않는 수집기 쪽에서만 난다. 배포는 막지 않고 눈에 띄게만 한다.
[ -f "$FRONTEND_DIST/beta.html" ] || echo "⚠ $FRONTEND_DIST/beta.html 이 없다 — 프리렌더(scripts/prerender-beta.mjs)가 돌지 않은 빌드다. /beta 가 빈 셸로 나간다"

# ⚠ 이 스크립트가 라이브를 못 바꿀 수 있다.
#
# 2026-08-28 측정 기준, 공개 도메인의 응답을 내는 것은 nginx 가 아니라 8080 에 붙은
# serve-static.mjs 다(cloudflared 터널 입구). 그 상태에서는 아래 설치가 전부 성공해도
# 방문자가 보는 것은 한 글자도 바뀌지 않는다. 근거와 이관 순서는 docs/nginx-edge.md 4절.
if curl -sf -m 5 -o /dev/null http://127.0.0.1:8080/ 2>/dev/null; then
  echo "⚠ 8080 이 응답한다 — 터널이 그쪽을 보고 있으면 이 배포는 라이브에 반영되지 않는다."
  echo "  확인: diff <(curl -s https://g2b-masters.electerior.co.kr/beta) <(curl -s http://127.0.0.1:8080/beta)"
  echo "  차이가 없으면 엣지는 여전히 8080 이다 (docs/nginx-edge.md 4절)."
fi

echo "==> 1/5 프론트 빌드 복사 → $WEBROOT"
sudo mkdir -p "$WEBROOT"
sudo rm -rf "${WEBROOT}".old
sudo cp -a "$WEBROOT" "${WEBROOT}".old 2>/dev/null || true
sudo rm -rf "$WEBROOT"
sudo cp -a "$FRONTEND_DIST" "$WEBROOT"
sudo chown -R root:www-data "$WEBROOT"
sudo find "$WEBROOT" -type d -exec chmod 755 {} +
sudo find "$WEBROOT" -type f -exec chmod 644 {} +

echo "==> 2/5 기존 사이트 설정 백업·제거 (5173 dev 프록시 + 인증서 없는 설정)"
sudo cp -a /etc/nginx/sites-enabled/g2b-masters /etc/nginx/sites-available/g2b-masters.legacy.bak 2>/dev/null || true
sudo rm -f /etc/nginx/sites-enabled/g2b-masters

echo "==> 3/5 새 설정 설치"
sudo install -m 644 "$NGINX_SRC" /etc/nginx/sites-available/g2b-masters
sudo ln -sf /etc/nginx/sites-available/g2b-masters /etc/nginx/sites-enabled/g2b-masters

echo "==> 4/5 nginx -t"
sudo nginx -t

echo "==> 5/5 재기동"
sudo systemctl reload nginx || sudo systemctl restart nginx

echo
echo "완료. 확인 (기대값이 함께 적혀 있다 — 다르면 배포가 의도대로 안 간 것이다):"
cat <<'CHECKS'
  # 셸이 나가는가 (200)
  curl -sk https://127.0.0.1:8001/notices -H 'Host: g2b-masters.electerior.co.kr' -o /dev/null -w '%{http_code}\n'

  # 없는 경로가 진짜 404 인가 (404). 200 이면 감사 #2 가 그대로다.
  curl -sk https://127.0.0.1:8001/this-page-does-not-exist -H 'Host: g2b-masters.electerior.co.kr' -o /dev/null -w '%{http_code}\n'

  # Search Console 인증 파일이 살아 있는가 (200). 404 면 소유확인이 풀린다.
  curl -sk https://127.0.0.1:8001/google9c899d4c05ca14dc.html -H 'Host: g2b-masters.electerior.co.kr' -o /dev/null -w '%{http_code}\n'

  # 옛 주소가 301 인가 + 목적지가 맞는가. Location 에 포트가 붙으면 안 된다
  # (absolute_redirect off). :8001 이 보이면 Cloudflare 가 프록시하지 않는 주소로
  # 안내하는 것이라 301 이 링크 자산을 합치지 못한다.
  curl -skI https://127.0.0.1:8001/search -H 'Host: g2b-masters.electerior.co.kr' | grep -i '^location'

  # /beta 가 프리렌더 문서로 나가는가 (200, 리다이렉트 없음)
  curl -sk https://127.0.0.1:8001/beta -H 'Host: g2b-masters.electerior.co.kr' -o /dev/null -w '%{http_code} %{size_download}B\n'

  # 본문이 실제로 들어 있는가 (1 이상). 0 이면 셸이 나간 것이다 — dist/beta.html 이
  # 없거나, 프리렌더가 파일 이름을 바꿨거나, location = /beta 가 빠진 것이다.
  curl -sk https://127.0.0.1:8001/beta -H 'Host: g2b-masters.electerior.co.kr' | grep -c "연 200조"

  # 끝 슬래시가 슬래시 없는 주소로 접히는가 (301 Location: /beta)
  curl -skI https://127.0.0.1:8001/beta/ -H 'Host: g2b-masters.electerior.co.kr' | grep -iE '^(HTTP|location)'

  # 엣지까지 실제로 닿았는가 — 위가 다 맞아도 터널이 8080 을 보고 있으면 여기는 그대로다
  curl -sI https://g2b-masters.electerior.co.kr/beta | head -3
  curl -s  https://g2b-masters.electerior.co.kr/beta | grep -c "연 200조"

  # 보안 헤더가 네 자리 전부에서 나가는가 (add_header 비상속 — docs/nginx-edge.md 2절)
  for p in /notices /index.html /assets/ /api/search/notices/status; do
    echo "== $p"
    curl -skI "https://127.0.0.1:8001$p" -H 'Host: g2b-masters.electerior.co.kr' \
      | grep -icE 'strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy'
  done

  브라우저: https://g2b-masters.electerior.co.kr:8001
CHECKS
