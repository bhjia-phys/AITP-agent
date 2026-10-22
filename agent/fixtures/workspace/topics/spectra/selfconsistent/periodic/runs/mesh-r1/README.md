# Mesh comparison, round 1

Submitted to cluster-a on 2026-08-01 with `sbatch mesh.sh` as job 4417021 (array 0-3). Observed on
2026-08-03 14:20: tasks 0 and 1 completed, tasks 2 and 3 pending. Paused by the researcher on 2026-08-14;
job 4417021_[2-3] was cancelled with `scancel` before it ran.

| Mesh | Expected | Retained | Read back | Accepted |
| --- | --- | --- | --- | --- |
| 4x4x4 | 1 | 1 | 1 | 1 |
| 6x6x6 | 1 | 1 | 1 | 0 |
| 8x8x8 | 1 | 0 | 0 | 0 |
| 10x10x10 | 1 | 0 | 0 | 0 |

Receipts: [submission receipt](receipt-submit.json), [campaign summary](campaign-complete.json).
