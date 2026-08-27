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
echo "완료. 확인:"
echo "  curl -sk https://127.0.0.1:8001/ -o /dev/null -w '%{http_code}\n'"
echo "  브라우저: https://g2b-masters.electerior.co.kr:8001"
