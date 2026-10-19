# Illustrations in a plan

Add an illustration when it answers a reviewer's question faster than prose.
Most plans need one to three. Put each one in the section it explains, often
**Summary** or **Implementation steps**. An illustration shows what the
contracts already require and adds no requirement of its own.

| Kind | Use when | Write it as |
|---|---|---|
| Table | Several items share the same attributes: options, inputs and outputs, files and their roles | Markdown table |
| Diff-style example | A small before-and-after contrast in code, configuration, or output explains the change | fenced `diff` block |
| Pseudocode | The point is a calculation, decision rule, or sequence of checks | fenced `text` block |
| Call diagram | The change is about which functions call which | fenced `svg` block |
| Data-flow graph | Data or analysis steps depend on each other, especially where paths split or join | fenced `svg` block |
| Chart or sketch | A threshold, distribution, time course, or the expected shape of a result | fenced `svg` block |

## Diff-style examples

- Start each line with `-` (removed), `+` (added), or a space (unchanged).
  Keep only enough unchanged lines to show where the change sits.
- Unless the example is a literal patch, say above it that it is simplified.
  Keep the conditions, order, and failure behaviour that matter.

## Drawings

The plan overview shows an `svg` block as a picture, with the drawing's
`<title>` as its caption. Implementers read the same block as text, so keep it
short and tidy.

- Write one complete `<svg>` element with
  `xmlns="http://www.w3.org/2000/svg"` and a `viewBox`, such as
  `viewBox="0 0 640 240"`. Leave out `width` and `height`, so it scales.
- Start with a `<title>` that says what the drawing shows.
- Draw dark lines and text for a white background. Use colour only to
  separate a few groups, and name each colour in the title or a key. For a
  call diagram, show new parts in blue and changed parts in amber.
- Use plain shapes, lines, paths, and `<text>` with `font-family="sans-serif"`
  and a font size of 12 or more. The page shows no script, link, image,
  external file, or web font inside a drawing.
- Make text fit its box: allow about 8 px of width per character at size 13.
- Keep a drawing under about 60 elements. Put long explanations in the prose.
- Draw arrows with one `<marker>` in `<defs>` and `marker-end` on each line.

A chart of data says whether its values are real, and where they come from,
or illustrative. Never show invented values as results. Label every axis with
its quantity and units.

The overview command prints a `Warning:` for each drawing it cannot show. Fix
every warning before you give the person the overview address.

This call diagram shows the expected size and style:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 130" font-family="sans-serif" font-size="13">
  <title>fit_ddm() calls the new remove_outlier_trials() (blue) before build_model() (unchanged)</title>
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#333"/></marker></defs>
  <rect x="10" y="45" width="110" height="40" rx="6" fill="#f3f4f6" stroke="#333"/>
  <text x="65" y="70" text-anchor="middle">fit_ddm()</text>
  <rect x="180" y="10" width="210" height="40" rx="6" fill="#dbeafe" stroke="#1d4ed8"/>
  <text x="285" y="35" text-anchor="middle">remove_outlier_trials()</text>
  <rect x="180" y="80" width="210" height="40" rx="6" fill="#f3f4f6" stroke="#333"/>
  <text x="285" y="105" text-anchor="middle">build_model()</text>
  <path d="M120 58 178 32" stroke="#333" fill="none" marker-end="url(#arrow)"/>
  <path d="M120 72 178 98" stroke="#333" fill="none" marker-end="url(#arrow)"/>
  <text x="400" y="35" fill="#555">1. drop trials outside 0.15–3.0 s</text>
  <text x="400" y="105" fill="#555">2. fit the remaining trials</text>
</svg>
```
