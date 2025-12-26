#!/usr/bin/env python3
"""Create a dated HANDOFF snapshot in /logs and refresh HANDOFF.md header."""

from __future__ import annotations
import datetime as dt
from pathlib import Path

TZ = "Africa/Johannesburg"

ROOT = Path(__file__).resolve().parents[1]
HANDOFF = ROOT / "HANDOFF.md"
LOGS = ROOT / "logs"

def main() -> None:
    now = dt.datetime.now()
    stamp = now.strftime("%Y-%m-%d_%H%M")
    LOGS.mkdir(exist_ok=True)
    snapshot = LOGS / f"HANDOFF_{stamp}.md"
    if HANDOFF.exists():
        snapshot.write_text(HANDOFF.read_text(encoding="utf-8"), encoding="utf-8")
    # Refresh the header date line (best-effort, keeps content)
    if HANDOFF.exists():
        lines = HANDOFF.read_text(encoding="utf-8").splitlines()
        if lines and lines[0].startswith("# HANDOFF"):
            lines[0] = f"# HANDOFF ({now.strftime('%Y-%m-%d')} — {TZ})"
            HANDOFF.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"Wrote snapshot: {snapshot}")

if __name__ == "__main__":
    main()
