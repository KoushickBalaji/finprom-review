# Design QA

## Source and test state

- Visual source: `../design/references/finprom-review-queue-v1.png` (1486 x 1059).
- Implementation capture: `../design/qa/implementation-v2.png` (1487 x 1059).
- Comparison: `../design/qa/comparison-v2.png`, using the same desktop state and viewport with a one-pixel source-width normalisation.
- Primary state: review queue with the guaranteed-return investment ticket selected.

## Comparison history

### Pass 1

`comparison-v1.png` identified two P2 fidelity issues: the right-pane headings used a serif face that was not present in the source, and the queue pane was too narrow relative to the reference. Both were corrected by using the source's sans-serif typography and setting the desktop queue pane to 530 px.

### Pass 2

The combined source/implementation comparison found no remaining actionable P0, P1 or P2 differences. Spacing, pane proportions, navigation, ticket density, hierarchy, borders, semantic colours and icon treatment match the selected direction closely.

The result pane is intentionally somewhat taller than the design source because the implementation exposes exact FCA evidence, disclosure/substantiation states and safer wording needed for product correctness. Regulatory copy and citations intentionally differ from the illustrative mock where the mock was incomplete or inaccurate.

## Interaction and responsive checks

- Queue selection, sort and outcome filter work.
- New promotion accepts arbitrary copy and submission context.
- Re-analysis and context-mismatch warning work.
- History and Reference Library are clearly preview-only and provide feedback when selected.
- Audit trace expands and the suggested rewrite can be copied.
- Desktop, 1100 px and 760 px layouts have no horizontal overflow.
- No browser console errors or warnings were observed.
- The source contains no raster product assets requiring reconstruction; interface icons use the Phosphor icon library.

final result: passed

