#!/usr/bin/env python3
"""
라우트별 공유 카드(og:image)를 그린다.

    python3 scripts/og-cards.py            # public/og/ 아래에 다시 그린다
    python3 scripts/og-cards.py --check    # 그리지 않고 현재 파일이 최신인지만 본다

── 왜 스크립트를 저장소에 두나 ────────────────────────────────────────────────
카드에 박히는 문구는 전부 코드에서 온 것이다(아래 BETA 의 source 주석). 랜딩의 헤드라인이
바뀌는 날 카드도 함께 바뀌어야 하는데, PNG 만 커밋해 두면 그것을 다시 그릴 방법이 저장소
어디에도 없다 — 다음 사람은 포토샵을 열거나, 더 흔하게는 그냥 옛 문구를 단 카드를 남겨 둔다.
공유 카드는 화면에 안 보이므로 틀려도 아무도 모른다. 이 감사가 잡아낸 결함이 전부 그
종류였다(index.html 의 og:image 가 남의 도메인 404 를 가리킨 채 몇 달).

── 폰트 ──────────────────────────────────────────────────────────────────────
브랜드 폰트는 Pretendard 다(index.html 의 CDN 링크, tokens.css 의 --font-sans).
시스템에 설치돼 있지 않으므로 npm 배포본에서 받아 캐시에 둔다. 네트워크가 없으면
Noto Sans CJK KR 로 물러난다 — 자형이 달라지므로 그때는 경고를 찍고, 커밋할 카드는
Pretendard 로 그린 것이어야 한다.

한글이 두부(□□□)로 나가는 사고는 눈으로 보기 전에는 알 수 없고, 눈으로 봐도 작게 보면
놓친다. 그래서 assert_renderable() 이 글자 단위로 검사해 하나라도 빠지면 예외를 던진다.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "og"

# ── 규격 ──────────────────────────────────────────────────────────────────────
# 1200×630 은 OpenGraph 의 사실상 표준이고 기존 public/og-image.png 도 정확히 그 크기다.
# 카카오톡·페이스북·X 가 모두 이 비율에서 잘라내지 않는다.
WIDTH, HEIGHT = 1200, 630

# 잘림 여백. 미리보기 구현에 따라 가장자리가 조금씩 먹히므로 글자는 이 안쪽에만 둔다.
SAFE_X, SAFE_Y = 64, 40

# 200 KB 를 넘으면 카카오톡이 미리보기를 포기하는 사례가 보고돼 있다.
# 기존 카드가 64,819 B 이므로 같은 자릿수를 유지한다.
MAX_BYTES = 200_000

# ── 색 ────────────────────────────────────────────────────────────────────────
# 배경은 기존 public/og-image.png 의 실측값이자 index.html 의 theme-color 와 같은 값이다
# (rgb(31,86,167) = #1F56A7). 두 카드가 나란히 놓였을 때 남처럼 보이면 안 된다.
BG = (31, 86, 167)
WHITE = (255, 255, 255)
# 랜딩의 --gold / --gold 위 텍스트색. landing.css 의 .btn 이 이 조합이다.
GOLD = (255, 201, 60)
INK = (26, 20, 0)
# 흰색 78% 를 배경 위에 얹은 값. 기존 카드의 한글 부제가 쓰는 톤과 같은 자리다.
MUTED = (205, 218, 236)

FONT_CACHE = Path.home() / ".cache" / "g2bmaster-og-fonts"
PRETENDARD_URL = "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-{weight}.otf"
NOTO_FALLBACK = Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc")


def load_font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    """Pretendard 한 벌. 없으면 받아 두고, 못 받으면 Noto Sans CJK KR."""
    cached = FONT_CACHE / f"Pretendard-{weight}.otf"
    if not cached.exists():
        FONT_CACHE.mkdir(parents=True, exist_ok=True)
        try:
            with urllib.request.urlopen(PRETENDARD_URL.format(weight=weight), timeout=60) as response:
                cached.write_bytes(response.read())
        except Exception as error:  # noqa: BLE001 - 사유가 무엇이든 물러나는 동작은 같다
            print(f"  ! Pretendard-{weight} 를 받지 못했습니다({error}). Noto Sans CJK KR 로 그립니다.", file=sys.stderr)
            return ImageFont.truetype(str(NOTO_FALLBACK), size, index=1)
    return ImageFont.truetype(str(cached), size)


def assert_renderable(font: ImageFont.FreeTypeFont, text: str, where: str) -> None:
    """
    글자마다 실제로 글리프가 있는지 본다.

    폰트에 없는 글자는 .notdef 로 그려진다 — 네모 상자(두부)이거나, 폰트에 따라 아예 빈
    칸이다. 둘 다 U+FFFF(어떤 폰트에도 배정되지 않는 코드포인트)를 그린 결과와 같아지므로,
    그것과 대조하면 두 경우를 한꺼번에 잡는다. 공백은 원래 비어 있으므로 건너뛴다.
    """
    def stamp(char: str) -> bytes:
        canvas = Image.new("L", (192, 192), 0)
        ImageDraw.Draw(canvas).text((16, 16), char, font=font, fill=255)
        return canvas.tobytes()

    notdef = stamp("￿")
    for char in text:
        if char.isspace():
            continue
        if stamp(char) == notdef:
            raise SystemExit(f"[og-cards] {where}: 폰트에 '{char}'(U+{ord(char):04X}) 글리프가 없습니다. 두부로 나갑니다.")


@dataclass
class Run:
    """한 줄 안에서 서체·색이 같은 조각. 여러 개가 모여 한 줄이 된다."""

    text: str
    font: ImageFont.FreeTypeFont
    fill: tuple[int, int, int]
    tracking: float = 0.0


@dataclass
class Line:
    runs: list[Run]
    gap_above: int = 0
    # 골드 알약(눈에 띄는 라벨) 안에 넣을 것인지. landing.css 의 .btn 과 같은 처리다.
    pill: bool = False
    pad_x: int = 30
    pad_y: int = 15
    width: float = field(init=False, default=0.0)
    height: int = field(init=False, default=0)


def run_width(run: Run) -> float:
    """자간을 반영한 조각 폭. 마지막 글자 뒤의 자간은 세지 않는다."""
    advance = run.font.getlength(run.text)
    return advance + run.tracking * max(len(run.text) - 1, 0)


def draw_run(draw: ImageDraw.ImageDraw, x: float, baseline: int, run: Run) -> float:
    """
    자간을 주려면 글자를 하나씩 찍어야 한다 — PIL 에 letter-spacing 이 없다.
    반환값은 다음 조각이 시작할 x.
    """
    if run.tracking == 0:
        draw.text((x, baseline), run.text, font=run.font, fill=run.fill, anchor="ls")
        return x + run.font.getlength(run.text)
    for char in run.text:
        draw.text((x, baseline), char, font=run.font, fill=run.fill, anchor="ls")
        x += run.font.getlength(char) + run.tracking
    return x


def measure(lines: list[Line]) -> tuple[int, int]:
    """줄마다 폭·높이를 채우고, 스택 전체의 (최대 폭, 총 높이)를 돌려준다."""
    total = 0
    widest = 0.0
    for line in lines:
        line.width = sum(run_width(run) for run in line.runs)
        # 줄 높이는 폰트의 ascent+descent 로 잡는다. 글자에 따라 들쭉날쭉해지지 않는다.
        ascent, descent = max((run.font.getmetrics() for run in line.runs), key=lambda m: m[0] + m[1])
        line.height = ascent + descent
        if line.pill:
            line.width += line.pad_x * 2
            line.height += line.pad_y * 2
        total += line.gap_above + line.height
        widest = max(widest, line.width)
    return round(widest), total


def render(lines: list[Line], out_path: Path) -> None:
    """가운데 정렬 스택 하나를 캔버스 한가운데에 세운다."""
    widest, total = measure(lines)
    if widest > WIDTH - SAFE_X * 2:
        raise SystemExit(f"[og-cards] 가장 긴 줄이 {widest}px 로 안전 폭 {WIDTH - SAFE_X * 2}px 를 넘습니다.")
    if total > HEIGHT - SAFE_Y * 2:
        raise SystemExit(f"[og-cards] 스택 높이가 {total}px 로 안전 높이 {HEIGHT - SAFE_Y * 2}px 를 넘습니다.")

    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    y = (HEIGHT - total) // 2
    for line in lines:
        y += line.gap_above
        left = (WIDTH - line.width) / 2
        ascent = max(run.font.getmetrics()[0] for run in line.runs)

        if line.pill:
            draw.rounded_rectangle(
                (left, y, left + line.width, y + line.height),
                radius=line.height / 2,
                fill=GOLD,
            )
            x = left + line.pad_x
            baseline = y + line.pad_y + ascent
        else:
            x = left
            baseline = y + ascent

        for run in line.runs:
            x = draw_run(draw, x, baseline, run)
        y += line.height

    # 단색 배경 + 글자뿐이라 256색 팔레트로 줄여도 눈에 띄는 손실이 없고, 파일이 1/3 이 된다.
    image.convert("P", palette=Image.Palette.ADAPTIVE, colors=256).save(out_path, optimize=True)

    size = out_path.stat().st_size
    if size > MAX_BYTES:
        raise SystemExit(f"[og-cards] {out_path.name} 이 {size:,} B 로 한도 {MAX_BYTES:,} B 를 넘습니다.")


# ── /beta 카드 ────────────────────────────────────────────────────────────────
#
# 문구는 전부 코드에서 가져온 것이고, 어디서 왔는지를 줄마다 적어 둔다. 공유 카드의 문구를
# 지어내면 랜딩과 다른 약속을 하게 되고, 그 차이는 클릭한 뒤에야 드러난다.
#
#   'CLOSED BETA'                  Hero.tsx  .eyebrow em
#   '베타 테스터 모집'              routeMeta.ts [ROUTES.beta].title
#   headline 세 줄                  Hero.tsx  h1.hero-h 의 .ln 세 개(글자 그대로)
#   '낙찰 시까지' / '수수료 0원'    Hero.tsx  .fee0 / .fee0 b
#
# 세 번째 줄만 금색인 것은 landing.css 의 `h1.hero-h .hl{color:var(--gold)}` 를 그대로
# 옮긴 것이다. 랜딩에서 강조되는 줄이 카드에서도 강조된다.
BETA_ALT = (
    "G2B Masters 베타 테스터 모집 카드 — "
    "연 200조 입찰 시장, 공고를 찾는 데 더 이상 아침을 쓰지 마세요. 낙찰 시까지 수수료 0원."
)


def beta_card() -> list[Line]:
    brand = load_font("ExtraBold", 30)
    pill = load_font("Bold", 24)
    head = load_font("ExtraBold", 62)
    fee_light = load_font("Medium", 32)
    fee_bold = load_font("ExtraBold", 36)

    lines = [
        # 기존 카드가 'ELECTERIOR' 를 자간을 벌린 대문자로 이고 있는 것과 같은 자리·같은 처리다.
        Line([Run("G2B MASTERS", brand, WHITE, tracking=4.2)]),
        Line([Run("CLOSED BETA · 베타 테스터 모집", pill, INK, tracking=0.6)], gap_above=24, pill=True),
        Line([Run("연 200조 입찰 시장,", head, WHITE, tracking=-1.9)], gap_above=42),
        Line([Run("공고를 찾는 데", head, WHITE, tracking=-1.9)], gap_above=6),
        Line([Run("더 이상 아침을 쓰지 마세요", head, GOLD, tracking=-1.9)], gap_above=6),
        Line(
            [Run("낙찰 시까지 ", fee_light, MUTED), Run("수수료 0원", fee_bold, GOLD)],
            gap_above=48,
        ),
    ]
    for line in lines:
        for run in line.runs:
            assert_renderable(run.font, run.text, "/beta")
    return lines


CARDS = {"beta.png": beta_card}


def main() -> int:
    parser = argparse.ArgumentParser(description="라우트별 og:image 카드를 그린다")
    parser.add_argument("--check", action="store_true", help="파일을 고치지 않고 최신인지만 본다")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stale = []
    for name, builder in CARDS.items():
        target = OUT_DIR / name
        before = hashlib.sha256(target.read_bytes()).hexdigest() if target.exists() else None
        destination = target.with_suffix(".check.png") if args.check else target
        render(builder(), destination)
        after = hashlib.sha256(destination.read_bytes()).hexdigest()
        if args.check:
            destination.unlink()
            if before != after:
                stale.append(name)
        else:
            print(f"  {name}  {target.stat().st_size:,} B  {WIDTH}×{HEIGHT}")

    if stale:
        print(f"[og-cards] 다시 그려야 합니다: {', '.join(stale)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
