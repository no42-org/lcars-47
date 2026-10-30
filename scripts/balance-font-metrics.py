# Copyright 2026 Ronny Trommer <ronny@no42.org>
# SPDX-License-Identifier: LGPL-3.0-or-later
"""Balance Antonio's vertical metrics around its capitals, in place.

Upstream leaves 605 units above the capitals and 285 below, so they sit low in
any box. Safari ignores ascent-override, so the balance has to live in the file.
Run this on each file after updating the font; see src/tokens/fonts/README.md.

Needs fontTools and brotli: pip install fonttools brotli
"""

import sys

from fontTools.ttLib import TTFont

UNITS_PER_EM = 2048
CAP_HEIGHT = 1760
LINE_BOX = 2650
ASCENT = (LINE_BOX + CAP_HEIGHT) // 2
DESCENT = ASCENT - LINE_BOX
VERSION_NOTE = "; lcars-47 balanced metrics"
USE_TYPO_METRICS = 1 << 7


def load(path):
    font = TTFont(path, recalcTimestamp=False)
    os2, hhea = font["OS/2"], font["hhea"]
    actual = (font["head"].unitsPerEm, os2.sCapHeight)
    if actual != (UNITS_PER_EM, CAP_HEIGHT):
        sys.exit(f"{path}: expected em and cap height {UNITS_PER_EM, CAP_HEIGHT}, got {actual}")
    if hhea.ascent - hhea.descent != LINE_BOX:
        sys.exit(f"{path}: expected a {LINE_BOX}-unit line box")
    if not os2.fsSelection & USE_TYPO_METRICS:
        sys.exit(f"{path}: expected USE_TYPO_METRICS, or the typo fields go unread")
    if hhea.lineGap or os2.sTypoLineGap:
        sys.exit(f"{path}: expected no line gap, which would change line height")
    return font


def balance(font, path):
    os2, hhea = font["OS/2"], font["hhea"]
    hhea.ascent, hhea.descent = ASCENT, DESCENT
    os2.sTypoAscender, os2.sTypoDescender = ASCENT, DESCENT
    for record in font["name"].names:
        if record.nameID == 5 and VERSION_NOTE not in str(record):
            record.string = f"{record}{VERSION_NOTE}"
    font.save(path)


if __name__ == "__main__":
    # Check every file before writing any, so a failure cannot leave a mixed pair.
    fonts = [(load(path), path) for path in sys.argv[1:]]
    for font, path in fonts:
        balance(font, path)
