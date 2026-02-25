import { TextElement, TextLine, TextLineWithWords, TextWord } from "../types";

// ─── Lines ────────────────────────────────────────────────────────────────────

/**
 * Group text elements into visual lines.
 *
 * Elements whose Y values fall within `tolerance` points of each other are
 * considered the same line.  Within each line, elements are sorted left-to-right
 * by X.  Empty-string elements are discarded; whitespace-only elements (spaces)
 * are kept so that word gaps are preserved when joining.
 *
 * @param elements  - flat list of TextElements from a page
 * @param tolerance - max Y delta to treat two elements as the same line (default 2)
 */
export function groupIntoLines(elements: TextElement[], tolerance = 2): TextLine[] {
  const visible = elements.filter((el) => el.text !== "");

  const buckets = new Map<number, TextElement[]>();
  for (const el of visible) {
    const key = Math.round(el.y / tolerance) * tolerance;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(el);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([y, els]) => {
      const sorted = [...els].sort((a, b) => a.x - b.x);
      return {
        y,
        text: sorted.map((e) => e.text).join("").trim(),
        elements: sorted,
      };
    })
    .filter((line) => line.text !== "");
}

// ─── Words ────────────────────────────────────────────────────────────────────

/**
 * Build a TextWord from a non-empty group of elements (already sorted by X).
 */
function buildWord(els: TextElement[]): TextWord {
  const first = els[0];
  const last  = els[els.length - 1];
  return {
    text:         els.map((e) => e.text).join(""),
    x:            first.x,
    y:            first.y,
    width:        last.x + last.width - first.x,
    height:       Math.max(...els.map((e) => e.height)),
    fontSize:     first.fontSize,
    fontRealName: first.fontRealName,
    fontFamily:   first.fontFamily,
    fontStyle:    first.fontStyle,
    fontWeight:   first.fontWeight,
    color:        first.color,
    elements:     els,
  };
}

/**
 * Group text elements into words by detecting inter-character gaps.
 *
 * A new word starts when:
 *   - the current element is a whitespace-only element (explicit space), OR
 *   - the X gap between consecutive elements exceeds `fontSize × gapFactor`
 *
 * Whitespace elements are used as separators but are NOT included in the
 * resulting words, so the output contains only printable content.
 *
 * Works on elements that share the same visual line (i.e. the output of
 * `groupIntoLines`), but can also be called on any sorted element list.
 *
 * @param elements  - TextElements sorted left-to-right (same line)
 * @param gapFactor - gap threshold as a fraction of fontSize (default 0.4)
 */
export function groupIntoWords(elements: TextElement[], gapFactor = 0.4): TextWord[] {
  const els = [...elements]
    .filter((el) => el.text !== "")
    .sort((a, b) => a.x - b.x);

  if (els.length === 0) return [];

  const words: TextWord[] = [];
  let group: TextElement[] = [];

  for (let i = 0; i < els.length; i++) {
    const curr    = els[i];
    const isSpace = curr.text.trim() === "";

    if (group.length === 0) {
      if (!isSpace) group.push(curr);
      continue;
    }

    if (isSpace) {
      // Decide: letter-spacing (merge) or word boundary (split)?
      //
      // Heuristic: if the element before AND after this space are both
      // single-character elements, this is decorative letter-spacing — keep
      // the group together.  Otherwise it is a real word break.
      const prev = group[group.length - 1];
      const next = els[i + 1];
      const isLetterSpacing =
        prev.text.length === 1 && next != null && next.text.trim().length === 1;

      if (isLetterSpacing) {
        // Include the space in the group so X layout is preserved;
        // buildWord will strip spaces from the final text string.
        group.push(curr);
      } else {
        const content = group.filter((e) => e.text.trim() !== "");
        if (content.length > 0) words.push(buildWord(content));
        group = [];
      }
      continue;
    }

    // Non-space element: check X gap against the last non-space in the group
    const prev     = group[group.length - 1];
    const gap      = curr.x - (prev.x + prev.width);
    const largeGap = gap > prev.fontSize * gapFactor;

    if (largeGap) {
      const content = group.filter((e) => e.text.trim() !== "");
      if (content.length > 0) words.push(buildWord(content));
      group = [curr];
    } else {
      group.push(curr);
    }
  }

  const content = group.filter((e) => e.text.trim() !== "");
  if (content.length > 0) words.push(buildWord(content));

  return words;
}

/**
 * Convenience: extract all words from a flat list of TextElements in a single call.
 * Equivalent to `groupIntoLines(elements).flatMap(l => groupIntoWords(l.elements))`.
 * Words are returned in reading order (top-to-bottom, left-to-right).
 *
 * @param elements  - flat list of TextElements from a page
 * @param lineTolerance - Y tolerance for line grouping (default 2)
 * @param gapFactor     - word gap threshold as a fraction of fontSize (default 0.4)
 */
export function extractWords(
  elements: TextElement[],
  lineTolerance = 2,
  gapFactor = 0.4
): TextWord[] {
  return groupIntoLines(elements, lineTolerance).flatMap((line) =>
    groupIntoWords(line.elements, gapFactor)
  );
}

/**
 * Full structured text extraction: returns lines with their words already grouped.
 * Use this to get a ready-to-serialize JSON hierarchy:
 *   line.text  — full line string
 *   line.words — words with position, size, font, color, and raw elements
 *
 * @param elements      - flat list of TextElements from a page
 * @param lineTolerance - Y tolerance for line grouping (default 2)
 * @param gapFactor     - word gap threshold as fraction of fontSize (default 0.4)
 */
export function extractTextStructure(
  elements: TextElement[],
  lineTolerance = 2,
  gapFactor = 0.4
): TextLineWithWords[] {
  return groupIntoLines(elements, lineTolerance).map((line) => ({
    ...line,
    words: groupIntoWords(line.elements, gapFactor),
  }));
}

// ─── Legacy helper ────────────────────────────────────────────────────────────

/**
 * Concatenate text elements in a line into a single string (legacy helper).
 */
export function lineToString(line: TextElement[]): string {
  return line
    .sort((a, b) => a.x - b.x)
    .map((el) => el.text)
    .join("")
    .trim();
}
