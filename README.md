# URL+ — Reactive, Object‑Backed URLs

[![npm version][npm-version-src]][npm-version-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][npm-version-href]

**URL+** extends the web’s native `URL` and `URLSearchParams` primitives with **reactivity**, **bidirectional state convergence**, and **first‑class object models** for both paths and query parameters.

---

## Install

```bash
npm i @webqit/url-plus
```

```js
import { URLPlus, URLSearchParamsPlus, Observer } from '@webqit/url-plus';
```

## CDN Include

```html
<script src="https://unpkg.com/@webqit/url-plus/dist/main.js"></script>
<script>
    const { URLPlus, URLSearchParamsPlus, Observer } = window.webqit;
</script>
```

---

## Overview

URL+ builds directly on the semantics of the platform `URL` and `URLSearchParams` APIs. `URLPlus` and `URLSearchParamsPlus` are a drop-in replacement each:

```js
const url = new URLPlus('https://example.com/level1/level2/level3?foo=bar');

console.log(url.pathname);                  // '/level1/level2/level3'
console.log(url.search);                    // '?foo=bar'
console.log(url.searchParams.get('foo'));   // 'bar'
```

URL+ offers additional capabilities on top of this baseline.

At a high level:

* **`URLSearchParamsPlus`** provides a *single, structured source of truth* for query parameters, with deterministic synchronization between an object tree, traversal APIs, and serialized query strings.
* **`URLPlus`** is a *reactive coordinator* over the full URL state, ensuring that mutations to paths, queries, and serialized forms all converge on the same underlying model and remain observable.

### 1. Path Object Model

```js
console.log(url.segments); // ['level1', 'level2', 'level3']
```

`segments` is the authoritative representation of the URL's path.

### 2. POSIX-Style Derived Paths

```js
console.log(url.dirname);  // '/level1/level2'
console.log(url.basename); // 'level3'
```

These fields are derived views over the same underlying path.

### 3. Query Object Model

```js
console.log(url.query);     // { foo: 'bar' }
```

`query` is the authoritative representation of the URL's query string.

### 4. Observability

Every part of the URL state is observable.

```js
Observer.observe(url, 'href', (mutation) => {
    console.log(mutation.value);
});

url.pathname = '/level1/level2/level3/level4';
// console → 'https://example.com/level1/level2/level3/level4?foo=bar'
```

Observability can be fine‑grained and deep:

```js
Observer.observe(url.query, 'foo', (mutation) => {
    console.log(mutation.value);
});

url.searchParams.set('foo', 'baz');
// console → 'baz'
```

### 5. Immutability

URL+ can be constructed into an immutable (read‑only) mode:

```js
const url = new URLPlus(
    'https://example.com/level1/level2?foo=bar',
    undefined,
    { immutable: true }
);

console.log(url.immutable); // true

url.pathname = '/new/path';   // throws
url.query.baz = 'b';          // throws
url.segments.push('level4');  // throws
```

In immutable mode, the instance behaves as a stable *value* while still supporting reads and serialization.

---

## URLSearchParamsPlus

`URLSearchParamsPlus` extends the standard `URLSearchParams` interface with:

* a persistent, structured object tree
* deterministic synchronization between object mutations and serialization
* full observability across all mutation paths
* an optional *structural mode* that exposes the object model to traversal APIs

Internally, parameters are **always** represented as structured data.

### Construction

```js
new URLSearchParamsPlus(init?, options?)
```

* `init` may be a query string, iterable, plain object, or another params instance
* `options` controls compatibility mode and serialization behavior

```js
// Strings
const params1 = new URLSearchParamsPlus('a=1&b=2');
// Iterables
const params2 = new URLSearchParamsPlus([['a', 1], ['b', 2]]);
// Object
const params3 = new URLSearchParamsPlus({ a: 1, b: 2 });

// Other params
const params4 = new URLSearchParamsPlus(new URLSearchParams('a=1&b=2'));
const params5 = new URLSearchParamsPlus(new URLSearchParamsPlus('a=1&b=2'));
```

```js
console.log(params instanceof URLSearchParams); // true
```

### The Internal Object Tree

Each instance maintains a live object tree representing the semantic structure of the query string:

```js
const query = params.json();
```

```js
const params = new URLSearchParamsPlus('a=1&b=2');
const query = params.json();

console.log(query); // { a: 1, b: 2 }
```

The object tree is the authoritative source of truth for the query string.

The returned object is **by reference** and fully mutable.

### Mutating the Tree

Being the authoritative source of truth, all mutations to tree are immediately reflected in the serialized query string:

```js
query.c = 3;
params.toString(); // 'a=1&b=2&c=3'

delete query.a;
params.toString(); // 'b=2&c=3'
```

All instance‑level mutation APIs converge on the same tree:

```js
params.set('d', 4);
console.log(query); // { b: 2, c: 3, d: 4 }
```

### Observing the Tree

The tree is observable regardless of how mutations are performed:

```js
Observer.observe(query, (mutations) => {
    console.log(mutations[0].key, mutations[0].value);
});

// Mutation via instance API
params.set('e', 5);      // console → e 5

// Mutation via Observer API
Observer.set(query, 'e', 6); // console → e 6
```

### Addressing the Tree

At mutation, bracket notation is interpreted as a path into the object tree:

```js
const params = new URLSearchParamsPlus();
const query = params.json();

params.set('a[b][c]', 1);
console.log(query); // { a: { b: { c: 1 } } }

query.a.b.c = 2;
console.log(params.toString());                         // 'a%5Bb%5D%5Bc%5D=2'
console.log(params.stringify({ prettyPrint: true }));   // 'a[b][c]=2'
```

```js
const params = new URLSearchParamsPlus('a[b][c]=1');
const query = params.json();

console.log(query); // { a: { b: { c: 1 } } }
```

This contrasts with native `URLSearchParams`, where any bracket notation in keys have no special semantics attached.

### Compatibility Mode (Default)

By default, instances are created with `compatMode: true`. It makes `URLSearchParamsPlus` work as a drop-in replacement for `URLSearchParams`.

In this mode, traversal APIs behave *exactly* like `URLSearchParams`:

* keys are literal strings
* traversal does not interpret structure

```js
const params1 = new URLSearchParams('a[b][]=1&a[b][]=2');
const params2 = new URLSearchParamsPlus('a[b][]=1&a[b][]=2');

console.log(params1.get('a[b][]')); // '1'
console.log(params2.get('a[b][]')); // '1'

console.log(params1.getAll('a[b][]')); // ['1', '2']
console.log(params2.getAll('a[b][]')); // ['1', '2']

console.log(params2.get('a[b]')); // null
console.log(params2.get('a[b][0]')); // null

console.log(params1.get('a[b][0]')); // null
console.log(params2.get('a[b][0]')); // null

console.log(params1.getAll('a[b]')); // []
console.log(params2.getAll('a[b]')); // []
```

Enumeration and stringification preserve the literal keys exactly as set:

```js
// Enumaration
console.log([...params1.keys()]); // ['a[b][]', 'a[b][]']
console.log([...params2.keys()]); // ['a[b][]', 'a[b][]']

console.log([...params1.entries()]); // [['a[b][]', '1'], ['a[b][]', '2']]
console.log([...params2.entries()]); // [['a[b][]', '1'], ['a[b][]', '2']]

// Stringification
console.log(params1.toString()); // 'a%5Bb%5D%5B%5D=1&a%5Bb%5D%5B%5D=2'
console.log(params2.toString()); // 'a%5Bb%5D%5B%5D=1&a%5Bb%5D%5B%5D=2'

console.log(params2.stringify({ prettyPrint: true })); // 'a[b][]=1&a[b][]=2'
```

### Structural Mode (Opt-In)

Structural mode is where the full power of `URLSearchParamsPlus` lives. Opt-in is via: `compatMode: false`.

In this mode, the instance exposes the object tree directly to its traversal APIs – instead of just its mutation APIs:

```js
const params = new URLSearchParamsPlus(
    'a[b][]=1&a[b][]=2',
    { compatMode: false }
);

// Keys are interpreted structurally
console.log(params.get('a[b][]')); // 1
console.log(params.get('a[b][0]')); // 1
console.log(params.get('a[b][1]')); // 2

// Traverse in and out the structure
console.log(params.get('a[b]')); // [1, 2]
console.log(params.get('a')); // URLSearchParamsPlus { b: [1, 2] }

// Traverse in and out programmatically
console.log(params.get('a').get('b')); // [1, 2]

// Mutate by reference
console.log(params.get('a').get('b').pop()); // 2
console.log(params.get('a[b]')); // [1]
```

Enumeration and stringification expose fully‑qualified paths:

```js
// Enumaration
console.log([...params.keys()]); // ['a[b][0]', 'a[b][1]']
console.log([...params.entries()]); // [['a[b][0]', 1], ['a[b][1]', 2]]

// Stringification
console.log(params.toString()); // 'a%5Bb%5D%5B0%5D=1&a%5Bb%5D%5B1%5D=2'
console.log(params.stringify({ prettyPrint: true })); // 'a[b][0]=1&a[b][1]=2'
```

### Value Semantics

In structural mode, values retain their actual types.

For strings passed to the constuctor for hydration, numeric values are sensibly cast to numbers during parsing:

```js
const params = new URLSearchParamsPlus('a=39', { compatMode: false });

params.json().a; // 39
```

Programmatic mutations preserve exact types:

```js
params.set('x', 39);
params.set('y', '39');

params.json().x; // 39
params.json().y; // '39'
```

### Mode Comparison

| Aspect             | Default Mode (`compatMode: true`) | Structural Mode (`compatMode: false`) |
| ------------------ | --------------------------------- | ------------------------------------- |
| Key interpretation | Literal strings                   | Structural paths                      |
| Traversal          | Literal                           | Path‑based                            |
| Enumeration        | Literal keys                      | Fully‑qualified paths                 |
| Stringification    | Literal                           | Fully‑qualified paths                 |
| Value semantics    | Strings                           | Preserved types                       |

### Serialization Options

By default, bracket characters are percent‑encoded as par native behavior:

```js
params.toString(); // 'a%5Bb%5D%5B0%5D=1'
```

Pretty printing can be enabled for readability:

```js
const params = new URLSearchParamsPlus(null, { prettyPrint: true });

params.toString(); // 'a[b][0]=1'
params.stringify({ prettyPrint: false }); // 'a%5Bb%5D%5B0%5D=1'
```

* `toString()` always returns the canonical representation
* `stringify()` allows formatting control
* constructor options define defaults

---

## URLPlus

`URLPlus` is a reactive extension of the standard `URL` interface. It coordinates multiple *views* over the same underlying URL state and guarantees bidirectional convergence between them.

### Construction

```js
new URLPlus(input, base?, options?)
```

+ `input` may be a string or another URL instance
+ `base` may be a string or another URL instance
+ `options` controls compatibility mode and serialization behavior

```js
const url = new URLPlus('https://example.com/a/b?x=1');
```

```js
url.protocol;               // 'https:'
url.username;               // ''
url.password;               // ''
url.hostname;               // 'example.com'
url.port;                   // ''
url.host;                   // 'example.com'
url.origin;                 // 'https://example.com'
url.segments;               // ['a', 'b']
url.pathname;               // '/a/b'
url.dirname;                // '/a'
url.basename;               // 'b'
url.searchParams;           // URLSearchParamsPlus { x: '1' }
url.query;                  // { x: '1' }
url.search;                 // '?x=1'
url.hash;                   // ''
url.href;                   // 'https://example.com/a/b?x=1'
```

```js
console.log(url instanceof URL); // true
```

### Field Convergence

As with native behaviour, mutating one field updates all related fields:

```js
url.pathname = '/a/b/c';

console.log(url.href);     // 'https://example.com/a/b/c?x=1'
console.log(url.dirname);  // '/a/b'
```

```js
url.href = 'https://example.com/x/y?x=2';

console.log(url.pathname);     // '/x/y'
console.log(url.dirname);      // '/x'
console.log(url.searchParams); // URLSearchParamsPlus { x: 2 }
console.log(url.query);        // { x: 2 }
```

### Path Object Model (`segments`)

URLPlus maintains its path as a live array, exposed as `segments`:

```js
url.segments; // ['a', 'b']
```

This array is the authoritative path for the instance. Mutations propagate to all derived fields:

```js
url.segments.push('c');

url.pathname; // '/a/b/c'
url.dirname;  // '/a/b'
url.basename; // 'c'
```

All path mutation pathways converge back on `segments`:

```js
url.dirname = '/a/a/a/b/b/b/c/c/c';

url.segments;  // ['a', 'a', 'a', 'b', 'b', 'b', 'c', 'c', 'c', 'd']
url.pathname; // '/a/a/a/b/b/b/c/c/c/d'
url.basename; // 'd'
url.href;     // 'https://example.com/a/a/a/b/b/b/c/c/c/d'
```

### Query Integration (`query`)

The instance's `searchParams` is backed by `URLSearchParamsPlus`:

```js
url.searchParams instanceof URLSearchParamsPlus; // true
```

The instance's `query` field is a direct reference to the underlying object model of `searchParams`:

```js
url.query === url.searchParams.json(); // true
```

```js
console.log(url.query); // { x: 1 }
```

This object is live.

Mutating it updates `searchParams`, and therefore, the URL:

```js
url.query.a = { b: [1, 2] };

console.log(url.search);            // '?a[b][0]=1&a[b][1]=2'
console.log(url.href);              // 'https://example.com/a/b?a[b][0]=1&a[b][1]=2'
```

As with `URLSearchParamsPlus`, operations over `searchParams` converge on the same underlying model:

```js
url.searchParams.append('a[b][]', 3);

console.log(url.query);             // { a: { b: [1, 2, 3] } }
```

Updates to `search` and `href` also converge on the same underlying model:

```js
url.search = '?a[b][0]=10';

console.log(url.query);             // { a: { b: [10] } }
```

```js
url.href = 'https://example.com/?x[y][z]=9';

console.log(url.query);             // { x: { y: { z: 9 } } }
```

All mutation paths converge on the same underlying state.

### POSIX-Style Derived Paths (`basename`, `dirname`)

In addition to `pathname`, URLPlus exposes two POSIX-style path accessors: `dirname` and `basename`.

These are derived views over the underlying `segments` array and behave consistently with familiar filesystem semantics.

```js
const url = new URLPlus('https://example.com/a/b/c');

url.pathname; // '/a/b/c'
url.dirname;  // '/a/b'
url.basename; // 'c'
```

#### `basename`

`basename` represents the final path segment – that is, the last entry in `segments`. If the original path is empty (or the root path: `/`), `basename` is an empty string.

Setting `basename` replaces that same segment. If the original path is empty (or the root path: `/`), setting `basename` is no-op.

#### `dirname`

`dirname` represents the parent path — all segments except the final one. It's essentially the result of `segments.slice(0, -1)`. If the original path is empty (or the root path: `/`), `dirname` is an empty string.

Setting `dirname` replaces the leading portion of the path, with existing `basename` preserved. If the original path is empty (or the root path: `/`), setting `dirname` is no-op.

### Observability

Each URL field can be observed via the `Observer` API:

```js
Observer.observe(url, 'href', mutation => {
    console.log('href →', mutation.value);
});

url.pathname = '/p/q';
// href → https://example.com/p/q?x=1
```

Observation works symmetrically:

```js
Observer.observe(url, 'pathname', mutation => {
    console.log('pathname →', mutation.value);
});

url.href = 'https://example.com/m/n?x=1';
// Console: pathname → /m/n
```

`query` and `segments` are observable down to the element level:

```js
Observer.observe(url.segments, mutations => {
    console.log(mutations[0].key, mutations[0].value);
});

url.href = 'https://example.com/m/n?x=1';
// console → 0 'm'
```

For both `query` and `segments`, direct mutations are observable when made reactively:

```js
Observer.set(url.query, 'a', 'bar');
```

```js
Observer.set(url.segments, 0, 'n');
Observer.proxy(url.segments).push('m');
Observer.proxy(url.segments).splice();
```

Because the entire URL is reactive, deep observers can track all changes:

```js
Observer.observe(url, Observer.subtree(), mutations => {
    console.log(mutations.map(m => [m.path, m.key, m.value]));
});
```

The above will react to changes to any part of the URL's state:

```js
url.searchParams.set('a[b][0]', 20);
url.search = '?a[b][1]=30';
url.href = 'https://example.com/?a[b][2]=40';
// Reactive array mutation via Observer.proxy()
Observer.proxy(url.query.a.b).push(4);
```

The instance can be disposed of its live bindings via `dispose()`:

```js
url.dispose();
url.disposed; // true
```

On disposal, further mutations are no longer annouced to observers.

### Immutability

URLPlus can be constructed into an immutable mode:

```js
const url = new URLPlus('https://example.com/a/b?x=1', null, {
    immutable: true
});
url.immutable; // true
```

In this mode, the instance becomes read-only and mutations are forbidden:

+ All mutating setters throw
+ `segments` is frozen
+ `query` is deeply frozen
+ `searchParams` mutation APIs are blocked

```js
// Forbids writes
url.segments.push('c'); // throws
url.query.x = 2;        // throws
url.searchParams.set('x', 2); // throws
url.pathname = '/x';    // throws
```

```js
// Supports reads
url.pathname; // '/a/b'
url.dirname;  // '/a'
url.query;    // { x: '1' }
```

```js
// Supports sorting
url.searchParams.stringify({ sort: true }); // 'x=1'
```

Essentially, the instance works as a stable _value_ across time.

### Mode Switch and Serialization Options

`URLPlus` options object can be used to configure the compatibility mode and serialization behavior of its search params.

```js
const url = new URLPlus('https://example.com?a[b]=1', null, {
    compatMode: true, // default
    immutable: false // default
    prettyPrint: false // default
});

console.log(url.searchParams.toString()); // a[b]=1
console.log(url.searchParams.stringify({ prettyPrint: false })); // a%5Bb%5D=1

console.log(url.stringify({ prettyPrint: false })); // https://example.com?a%5Bb%5D=1
```

## License

MIT

[npm-version-src]: https://img.shields.io/npm/v/@webqit/url-plus?style=flat&colorA=18181B&colorB=F0DB4F
[npm-version-href]: https://npmjs.com/package/@webqit/url-plus
[bundle-src]: https://img.shields.io/bundlephobia/minzip/@webqit/url-plus?style=flat&colorA=18181B&colorB=F0DB4F
[bundle-href]: https://bundlephobia.com/result?p=@webqit/url-plus
[license-src]: https://img.shields.io/github/license/webqit/url-plus.svg?style=flat&colorA=18181B&colorB=F0DB4F
