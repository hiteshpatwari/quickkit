# Local storage and privacy audit

QuickKit writes only these browser storage keys:

| Key | Purpose | Content |
| --- | --- | --- |
| `quickkit.theme` | Theme preference | `system`, `light`, or `dark` |
| `quickkit.favorites` | Favorite tools | Tool identifiers only |
| `quickkit.settings` | Lightweight preferences | Editor size, indentation, recent-tools preference, reduced motion |

Tool input and output are not persisted. JWT content is never persisted. Core tool code contains no request that transmits tool content. The service worker caches only same-origin application GET responses.
