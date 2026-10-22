# Spectra research in a shared workspace

Two toy questions use the same demo library. Each keeps its own main note; a fix in the library can matter to
both.

## Map

| Research question | Main note | Main development locations |
| --- | --- | --- |
| Reliable self-consistent spectra and their numerical limits | [Self-consistent spectra](selfconsistent/research.md) | [Demo checkout](workspace/development/libdemo) |
| Continuation stability | [Continuation](continuation/research.md) | [Demo checkout](workspace/development/libdemo) |

<a id="standing-choices"></a>
## Standing choices

- Use the damped update by default.
- Use the shared conventions in [the conventions note](conventions.md) unless a main note states otherwise.

## Methods

- [Compare spectra](skills/compare-spectra/SKILL.md) compares two spectra computed with matched inputs.
