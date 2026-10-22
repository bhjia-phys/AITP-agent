---
name: compare-spectra
description: Compare two spectra computed with matched inputs. Use when deciding whether a code change altered a spectrum beyond its numerical tolerance.
---

# Compare spectra

1. Fix the inputs, the grid and the tolerance before running either calculation.
2. Run both calculations with the same inputs, and record the code versions.
3. Compare peak positions and weights, and report each difference against the tolerance.

Limits: the comparison does not establish which spectrum is physically right.
