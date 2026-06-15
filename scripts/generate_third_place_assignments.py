"""Regenerate the 495 FIFA Annex C third-place assignments."""

import json
from pathlib import Path
import re
from tempfile import TemporaryDirectory
from urllib.request import urlretrieve

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "web" / "src" / "lib" / "sim" / "thirdPlaceAssignments.json"
REGULATIONS_URL = (
    "https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/"
    "FWC2026_regulations_EN.pdf"
)


def main() -> None:
    with TemporaryDirectory() as temporary_directory:
        pdf_path = Path(temporary_directory) / "regulations.pdf"
        urlretrieve(REGULATIONS_URL, pdf_path)
        reader = PdfReader(pdf_path)
        rows: list[tuple[int, list[str]]] = []
        for page in reader.pages:
            for line in (page.extract_text() or "").splitlines():
                match = re.fullmatch(r"(\d+)\s+((?:3[A-L]\s*){8})", line.strip())
                if match:
                    rows.append((
                        int(match.group(1)),
                        re.findall(r"3([A-L])", match.group(2)),
                    ))

    assert len(rows) == 495
    assert [number for number, _ in rows] == list(range(1, 496))
    assignments = {"".join(sorted(groups)): groups for _, groups in rows}
    assert len(assignments) == 495
    OUTPUT.write_text(
        json.dumps(assignments, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
