# retrykit

Retry async functions with exponential backoff, jitter, abort support and a retry predicate.

## Usage

```js
import { retry } from "retrykit";

const data = await retry(() => fetchJson(url), {
  retries: 4,
  minDelay: 200,
  shouldRetry: (err) => err.status >= 500,
});
```

## Test

```bash
npm test
```

## License

MIT
