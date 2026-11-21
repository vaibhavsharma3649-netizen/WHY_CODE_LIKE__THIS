import re
from pathlib import Path


def srgb_to_lum(hex_str: str) -> float:
    hex_str = hex_str.strip().lstrip("#")
    if len(hex_str) == 3:
        hex_str = "".join([c * 2 for c in hex_str])
    r, g, b = [int(hex_str[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]

    def adj(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * adj(r) + 0.7152 * adj(g) + 0.0722 * adj(b)


def contrast_ratio(c1: str, c2: str) -> float:
    l1, l2 = srgb_to_lum(c1), srgb_to_lum(c2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def test_wcag_color_contrast():
    css_path = Path("frontend/src/styles.css")
    assert css_path.exists(), "frontend/src/styles.css not found"
    css = css_path.read_text(encoding="utf-8")

    # Extract CSS variable definitions
    muted_match = re.search(r"--muted:\s*(#[0-9a-fA-F]{3,6});", css)
    faint_match = re.search(r"--faint:\s*(#[0-9a-fA-F]{3,6});", css)
    bg_match = re.search(r"--bg:\s*(#[0-9a-fA-F]{3,6});", css)
    surface_match = re.search(r"--surface:\s*(#[0-9a-fA-F]{3,6});", css)

    assert muted_match and faint_match and bg_match and surface_match

    muted = muted_match.group(1)
    faint = faint_match.group(1)
    bg = bg_match.group(1)
    surface = surface_match.group(1)

    # WCAG 2 AA requires at least 4.5:1 for normal body text
    faint_on_bg = contrast_ratio(faint, bg)
    faint_on_surface = contrast_ratio(faint, surface)
    muted_on_bg = contrast_ratio(muted, bg)
    muted_on_surface = contrast_ratio(muted, surface)

    assert (
        faint_on_bg >= 4.5
    ), f"WCAG AA Failure: --faint ({faint}) on --bg ({bg}) ratio is {faint_on_bg:.2f}:1 (< 4.5:1)"
    assert (
        faint_on_surface >= 4.5
    ), f"WCAG AA Failure: --faint ({faint}) on --surface ({surface}) ratio is {faint_on_surface:.2f}:1 (< 4.5:1)"
    assert (
        muted_on_bg >= 4.5
    ), f"WCAG AA Failure: --muted ({muted}) on --bg ({bg}) ratio is {muted_on_bg:.2f}:1 (< 4.5:1)"
    assert (
        muted_on_surface >= 4.5
    ), f"WCAG AA Failure: --muted ({muted}) on --surface ({surface}) ratio is {muted_on_surface:.2f}:1 (< 4.5:1)"

    # Check .login-foot contrast on dark aside background (#16352c)
    login_foot_match = re.search(r"\.login-foot\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})", css)
    assert login_foot_match
    foot_color = login_foot_match.group(1)
    foot_ratio = contrast_ratio(foot_color, "#16352c")
    assert (
        foot_ratio >= 4.5
    ), f"WCAG AA Failure: .login-foot ({foot_color}) on dark aside ratio is {foot_ratio:.2f}:1 (< 4.5:1)"


def test_document_has_main_landmark():
    login_tsx = Path("frontend/src/pages/Login.tsx").read_text(encoding="utf-8")
    app_tsx = Path("frontend/src/App.tsx").read_text(encoding="utf-8")
    layout_tsx = Path("frontend/src/components/Layout.tsx").read_text(encoding="utf-8")

    # WCAG landmark-one-main requires a <main> landmark
    assert "<main" in login_tsx and "</main>" in login_tsx, "Login page must contain a <main> landmark"
    assert "<main" in app_tsx and "</main>" in app_tsx, "Splash view must contain a <main> landmark"
    assert "<main" in layout_tsx and "</main>" in layout_tsx, "Layout component must contain a <main> landmark"

