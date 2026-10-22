# Self-consistent spectra

Does the toy iterated map settle on one spectrum for each test case? So far it settles for two cases, and the
grid limits how sharply the fixed point is known ([stability branch](stability/research.md#current-work)).
The mesh comparison is paused by the researcher.

The account below gives the map, its fixed point and the controls; the branches own their evidence.

## Current work

- **Static map stability → [stability branch](stability/research.md#current-work)** —
  supplies two toy roots that pass the check and one candidate that does not
  yet; the candidate stays open until its tolerance is fixed.
- **Periodic spectra → [periodic validation](periodic/research.md#current-work)**
  — owns the paused comparison of the toy meshes and the condition for resuming
  it.
- **Mixing schedule** — active · 2026-09-30. The damped schedule converges for
  both small systems within 40 iterations; the undamped one oscillates. Next:
  compare the two schedules on the third system with the same tolerance, following
  the [mixing plan](plans/mixing-plan.md#phase-2-third-system).

## The map and its fixed point

The toy map is $F(x) = \tfrac12 (x + a/x)$, and a fixed point satisfies
$$
x^\ast = F(x^\ast) .
$$

## Decisions and retained alternatives

- The undamped schedule is retained as a control.

Earlier copies: [superseded draft](aitp-before/research.md), [provenance copy](provenance/snapshots/research.md).
