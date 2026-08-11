# QuickKit architecture

QuickKit is a local-first browser application. A typed tool registry is the source of truth for routes, navigation, search, categories, favorites, and privacy metadata. Tool routes share one visual workspace while keeping their input state inside the mounted component.

```text
UI event
  -> worker-client request facade
    -> Web Worker operation
      -> pure transformation
    <- typed result + timing
  <- rendered output
```

JSON formatting, structural JSON diffing, JSON-to-TypeScript inference, text diffing, and CSV parsing run in a shared module worker. The UI never posts tool content to a server. Sensitive state is not placed into URLs, product storage, service-worker caches, or analytics.

The application shell and route chunks are cacheable for offline use. The service worker accepts only same-origin GET requests and caches application assets; it never sees textarea content because that content is not part of a request.
