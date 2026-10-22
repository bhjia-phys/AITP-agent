# Fixture workspace

A synthetic research workspace for the agent's tests. Every text is invented; the shapes follow the forms
found in real notes. `config.fixture.json` uses paths relative to this directory; tests copy the workspace to
a temporary directory and make the paths absolute. The `libdemo` checkout becomes a git repository at test
time. `knowledge/library/arxiv/2101.00001v2/paper.pdf` has printed pages 25–27 on PDF pages 1–3.

Expected results that tests assert are listed in `expected.json`.
