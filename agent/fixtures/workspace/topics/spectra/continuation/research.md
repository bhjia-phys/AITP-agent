<a id="top"></a>
# Continuation

Can a toy interpolant recover real-axis values from a few imaginary-axis samples? With noisy samples there is
sometimes no admissible interpolant at all; see [the obstruction][obstruction]. The static map used here is
the one studied in the [stability branch](../selfconsistent/stability/research.md), with the opposite sign
convention.

## Current work

- **Causal interpolation bound** — open diagnostic question · last consequential
  change date unrecorded. The next discriminator is whether the bound survives a
  refined grid. Before refining the grid, fix the tolerance in [the conventions](../conventions.md).
- **Rational fits** — dormant · 2026-05-02. Retained for comparison and not
  continued.

## The obstruction

<a id="obstruction-detail"></a>
For a spectral function $A(\omega) \ge 0$ the interpolant must be a Nevanlinna function,
$$
G(z) = \int \frac{A(\omega)}{z - \omega} \, d\omega ,
$$
and noisy inputs can leave no such interpolant.

中文注释：本节为合成测试文本，用于检验解析器对中文段落的容忍。

[obstruction]: #the-obstruction
