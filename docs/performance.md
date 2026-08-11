# Performance baseline

The initial implementation moves the heaviest deterministic operations into a module Web Worker and reports worker time for JSON formatting. CSV rendering is paged at 60 DOM rows while retaining the parsed dataset in memory. Text diff uses an exact LCS algorithm for moderate inputs and a bounded index comparison when the matrix would exceed one million cells.

Formal 1 MB, 5 MB, 20 MB JSON; 10K and 50K line diff; and 10K and 100K row CSV benchmarks remain a release-hardening milestone. Performance claims should not be published until those fixtures are measured on named hardware and browsers.
