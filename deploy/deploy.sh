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

  # 옛 주소가 301 인가 + 목적지가 맞는가
  curl -sk https://127.0.0.1:8001/search -H 'Host: g2b-masters.electerior.co.kr' -o /dev/null -w '%{http_code} %{redirect_url}\n'

  # 보안 헤더가 네 자리 전부에서 나가는가 (add_header 비상속 — docs/nginx-edge.md 2절)
  for p in /notices /index.html /assets/ /api/search/notices/status; do
    echo "== $p"
    curl -skI "https://127.0.0.1:8001$p" -H 'Host: g2b-masters.electerior.co.kr' \
      | grep -icE 'strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy'
  done

  브라우저: https://g2b-masters.electerior.co.kr:8001
CHECKS
