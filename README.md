# URL+ — Reactive URLs with Object‑Backed Query Parameters

[![npm version][npm-version-src]][npm-version-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][npm-version-href]

**URL+** extends the web’s `URL` and `URLSearchParams` primitives with reactivity and a real object model.

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

At its core, URL+ provides two things:

1. **Reactive URLs** — a `URL` with an object model and whose fields can be observed for changes
2. **Object‑backed query parameters** — `searchParams` with an object model and whose fields can be observed for changes

All of this builds directly on the native `URL` and `URLSearchParams` semantics.

For example, URL+ works like the native `URL` and `URLSearchParams` by default:

```js
const url = new URLPlus('https://example.com/level1/level2/level3?foo=bar');

console.log(url.pathname); // '/level1/level2/level3'
console.log(url.search); // '?foo=bar'
console.log(url.searchParams.get('foo')); // 'bar'
```

But it lets you do more:

```js
// A new ".segments" field
console.log(url.segments); // ['level1', 'level2', 'level3']
```

```js
// A new ".dirname" field
console.log(url.dirname); // '/level1/level2'
```

```js
// A new ".basename" field
console.log(url.basename); // 'level3'
```

```js
// A new ".query" field – an object model of url's query params
console.log(url.query); // { foo: 'bar' }
```

```js
// Observability
Observer.observe(url, 'href', (mutation) => {
    console.log(mutation.value);
});
url.pathname = '/level1/level2/level3/level4';
// console: 'https://example.com/level1/level2/level3/level4?foo=bar'

// -------

// Deep, fine-grained observability
Observer.observe(url.query, 'foo', (mutation) => {
    console.log(mutation.value);
});
url.searchParams.set('foo', 'baz');
// console: 'bar'
```

```js
// A new immutability mode
const url = new URLPlus('https://example.com/level1/level2?foo=bar', undefined, { immutable: true });

console.log(url.immutable); // true

url.pathname = '/new/path'; // throws
url.query.baz = 'b'; // throws
url.segments.push('level4'); // throws
```

URL+'s capabilities start with `URLSearchParamsPlus`.

---

## URLSearchParamsPlus

`URLSearchParamsPlus` extends the standard `URLSearchParams` interface with a persistent object model and deterministic synchronization between that object tree and the serialized query string.

Internally, parameters are always represented as structured data. This internal representation exists regardless of how the instance is configured or mutated.

### Construction

```js
new URLSearchParamsPlus(init?, options?)
```

* `init` may be a query string, iterable, plain object, or another params instance
+ `options` controls compatibility mode and serialization behavior

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

### The Internal Object Tree

Every `URLSearchParamsPlus` instance maintains a live object tree representing the semantic structure of the query.

This tree can be accessed via:

```js
const tree = params.json();
```

```js
const params = new URLSearchParamsPlus('a=1&b=2');
const tree = params.json();

console.log(tree); // { a: 1, b: 2 }
```

This tree is returned _by reference_ and is mutable.

### Mutating the Tree


This tree is the authoritative source of truth for the query string. Mutations to the tree are reflected in the query string:

```js
tree.c = 3;
params.toString(); // 'a=1&b=2&c=3'

delete tree.a;
params.toString(); // 'b=2&c=3'
```

The instance mutation APIs all converge on the tree:

```js
params.set('d', 4);
console.log(tree); // { b: 2, c: 3, d: 4 }
```

### Observing the Tree

The tree is fully observable across all modes of mutation:

```js
Observer.observe(tree, (mutations) => {
    console.log(mutations[0].key, mutations[0].value);
});

// Reactive mutation via instance API
params.set('e', 5); // Console: "e", 5

// Reactive mutation via the Observer API
Observer.set(tree, 'e', 6); // Console: "e", 6
```

### Addressing the Tree

URLSearchParamsPlus lets you address this model deeply using paths:

```js
const params = new URLSearchParamsPlus();
const tree = params.json();

params.set('a[b][c]', 1);
console.log(tree); // { a: { b: { c: 1 } } }

tree.a.b.c = 2;
console.log(params.toString()); // 'a%5Bb%5D%5Bc%5D=2'
console.log(params.stringify({ prettyPrint: true })); // 'a[b][c]=2'
```

```js
const params = new URLSearchParamsPlus('a[b][c]=1');
const tree = params.json();

console.log(tree); // { a: { b: { c: 1 } } }
```

By comparing, the `URLSearchParams` API does accept the bracket notation on key names but not with
any specific semantics attached. It's just a string.

`URLSearchParamsPlus` lets that address the underlying object model, while aligning with the
surface behavior of the `URLSearchParams` API:

_Traversal is by literal string identifiers, not by path_:

```js
const params1 = new URLSearchParams('a[b][]=1&a[b][]=2');
const params2 = new URLSearchParamsPlus('a[b][]=1&a[b][]=2');

// Keys are just strings that must match strictly
console.log(params1.get('a[b][]')); // '1'
console.log(params2.get('a[b][]')); // '1'

console.log(params1.getAll('a[b][]')); // ['1', '2']
console.log(params2.getAll('a[b][]')); // ['1', '2']

// ...not interpreted structurally
console.log(params1.get('a[b]')); // null
console.log(params2.get('a[b]')); // null

console.log(params1.get('a[b][0]')); // null
console.log(params2.get('a[b][0]')); // null

console.log(params1.getAll('a[b]')); // []
console.log(params2.getAll('a[b]')); // []
```

_Enumeration and stringification expose exact strings as set:_

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

But this alignment with the `URLSearchParams` API is only one of two modes with the `URLSearchParamsPlus` API – and the default. `URLSearchParamsPlus` lets you opt out of this
"compatibility" with `URLSearchParams` into full structural mode:

```js
const params = new URLSearchParamsPlus(null, { compatMode: false });
```

In this mode, URLSearchParamsPlus exposes its internal tree to its traversal APIs – not just its mutation APIs:

_Query keys are interpreted as paths into that tree:_

```js
const params2 = new URLSearchParamsPlus('a[b][]=1&a[b][]=2', { compatMode: false });

// Keys are interpreted structurally
console.log(params2.get('a[b][]')); // 1
console.log(params2.get('a[b][0]')); // 1
console.log(params2.get('a[b][1]')); // 2

// Traverse in and out the structure
console.log(params2.get('a[b]')); // [1, 2]
console.log(params2.get('a')); // URLSearchParamsPlus { b: [1, 2] }

// Traverse in and out programmatically
console.log(params2.get('a').get('b')); // [1, 2]

// Mutate by reference
console.log(params2.get('a').get('b').pop()); // 2
console.log(params2.get('a[b]')); // [1]
```

_Enumeration and stringification expose fully-qualified paths:_

```js
// Enumaration
console.log([...params2.keys()]); // ['a[b][0]', 'a[b][1]']
console.log([...params2.entries()]); // [['a[b][0]', 1], ['a[b][1]', 2]]

// Stringification
console.log(params2.toString()); // 'a%5Bb%5D%5B0%5D=1&a%5Bb%5D%5B1%5D=2'
console.log(params2.stringify({ prettyPrint: true })); // 'a[b][0]=1&a[b][1]=2'
```

### Observing the Tree Deeply

The tree can be observed to any depth:

```js
// Observe a key
Observer.observe(tree, 'a', (mutation) => {
    console.log(mutation.key, mutation.value);
});

// Observe 2-levels deep
Observer.observe(tree, Observer.path('a', 'b'), (mutation) => {
    console.log(mutation.path, mutation.key, mutation.value);
});

// Observe full depth
Observer.observe(tree, Observer.subtree(), (mutations) => {
    console.log(mutations.map((m) => m.path, m.key, m.value));
});

// Reactive mutation via instance API
params.set('a[b][c]', 5);

// Reactive mutation via the Observer API
Observer.set(tree.a.b, 'c', 6);
```

### Value Semantics

In structural mode, values retain their actual types in the tree.

For strings passed to the constuctor for hydration, numeric values are sensibly cast to numbers during parsing:

```js
const params = new URLSearchParamsPlus('a=39', { compatMode: false });

params.json().a; // 39
```

Programmatic sets preserve exact value types:

```js
params.set('x', 39);
params.set('y', '39');

params.json().x; // 39
params.json().y; // '39'
```

### The Default Mode vs Structural Mode Comparison

| Aspect | Default Mode (`compatMode: true`) | Structural Mode (`compatMode: false`) |
| --- | --- | --- |
| Key Interpretation | Literal strings | Structural paths |
| Traversal | By literal strings | By paths |
| Enumeration | By literal strings | By fully-qualified paths |
| Stringification | By literal strings | By fully-qualified paths |
| Value Semantics | Always strings | Actual types as set |

Default mode provides **exact `URLSearchParams` behavior**.

### Serialization Options

#### Bracket Encoding

By default, bracket characters are percent‑encoded to match native behavior.

```js
const params = new URLSearchParamsPlus('a[b][0]=1');

params.toString(); // a%5Bb%5D%5B0%5D=1
```

For readability, this can be disabled:

```js
const params = new URLSearchParamsPlus(null, { prettyPrint: true });
```

```js
params.toString(); // a[b][0]=1
params.stringify({ prettyPrint: false }); // a%5Bb%5D%5B0%5D=1
```

+ `toString()` always returns the canonical, spec-aligned representation.
+ `stringify()` allows formatting control.
+ The constructor lets you set a default for `prettyPrint`.

---

## URLPlus

`URLPlus` is a reactive extension of the standard `URL` interface.

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

### The Existing Update Model

Mutating one field updates the others:

```js
url.pathname = '/a/b/c';

console.log(url.href);              // 'https://example.com/a/b/c?x=1'
console.log(url.dirname);  // '/a/b'
```

```js
url.href = 'https://example.com/x/y?x=2';

console.log(url.pathname);          // '/x/y'
console.log(url.dirname);  // '/x'
console.log(url.searchParams);      // URLSearchParamsPlus { x: 2 }
console.log(url.query);             // { x: 2 }
console.log(url.search);            // '?x=2'
```

### ...With Observability

Each URL field can be observed via the `Observer` API.

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

Observers react to the resulting state in each case.

### ...With an Object Model

`URLPlus` maintains its pathname as a live array. It is exposed as `segmenets`:

```js
url.segmenets; // ['a', 'b', 'c']
```

This array is the authoritative path for URL. Mutating it reflects on `pathname`, `dirname`, `basename`, and `href`:

```js
url.segments.push('d');

url.pathname; // '/a/b/c/d'
url.dirname;  // '/a/b/c'
url.basename; // 'd'
url.href;     // 'https://example.com/a/b/c/d'
```

Conversely, every "path" mutation pathway – `pathname`, `dirname`, `basename`, and `href` – converges back on segments:

```js
url.dirname = '/a/a/a/b/b/b/c/c/c';

url.segments;  // ['a', 'a', 'a', 'b', 'b', 'b', 'c', 'c', 'c', 'd']
url.pathname; // '/a/a/a/b/b/b/c/c/c/d'
url.basename; // 'd'
url.href;     // 'https://example.com/a/a/a/b/b/b/c/c/c/d'
```

Segments is observable even at the element level:

```js
Observer.observe(url.segments, mutations => {
    console.log('segment →', mutations[0].key, mutations[0].value);
});

url.href = 'https://example.com/m/n?x=1';
// Console: segment → 0 'n'
```

Direct mutation to the array is observable when made reactively:

```js
Observer.set(url.segments, 0, 'n');
Observer.proxy(url.segments).push('m');
Observer.proxy(url.segments).splice();
```

### ...With POSIX-Style Path Accessors

In addition to `pathname`, URLPlus exposes two POSIX-style path accessors: `dirname` and `basename`.

These are derived views over the underlying `segments` array and behave consistently with familiar filesystem semantics.

```js
const url = new URLPlus('https://example.com/a/b/c');

url.pathname; // '/a/b/c'
url.dirname;  // '/a/b'
url.basename; // 'c'
```

#### `basename`

`basename` represents the final path segment – that is, the last entry in `segments`. If the path is empty, `basename` is an empty string.

Setting `basename` replaces that same segment. If the path is empty, setting `basename` is no-op.

#### `dirname`

`dirname` represents the parent path — all segments except the final one. It's essentially the result of `segments.slice(0, -1)`. If the path is empty, `dirname` is an empty string.

Setting `dirname` replaces the leading portion of the path, with existing `basename` preserved. If the path is empty, setting `dirname` is no-op.

### ...With an Immutable Mode

`URLPlus` can be constructed in immutable mode:

```js
const url = new URLPlus('https://example.com/a/b?x=1', null, {
    immutable: true
});
```

In this mode, the instance becomes read-only; all mutations are forbidden:

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
url.searchParams.stringify({ sorted: true }); // 'x=1'
```

Essentially, the instance behaves as stable _value_.

### Query Parameters

The Search Params (`.searchParams`) is backed by `URLSearchParamsPlus`:

```js
url.searchParams instanceof URLSearchParamsPlus; // true
```

The special `.query` field is a direct reference to the underlying object model of the search params:

```js
url.query === url.searchParams.json(); // true
```

```js
console.log(url.query); // { x: 1 }
```

This object is live.

Mutating it updates the Search Params, and therefore, the URL:

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

### Observing the Full Structure

Because the query object is part of the URL’s state, deep observers work across all mutation paths.

```js
Observer.observe(url, Observer.subtree(), mutations => {
    console.log(
        mutations.map((m) => [m.path, m.key, m.value])
    );
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

### Mode Switch and Serialization Options

`URLPlus` options object can be used to configure the compatibility mode and serialization behavior of its search params.

```js
const url = new URLPlus('https://example.com?a[b]=1', null, {
    compatMode: false,
    prettyPrint: true
});

console.log(url.searchParams.toString()); // a[b]=1
console.log(url.searchParams.stringify({ prettyPrint: false })); // a%5Bb%5D=1

console.log(url.stringify({ prettyPrint: false })); // https://example.com?a%5Bb%5D=1
```

---

## License

MIT

[npm-version-src]: https://img.shields.io/npm/v/@webqit/url-plus?style=flat&colorA=18181B&colorB=F0DB4F
[npm-version-href]: https://npmjs.com/package/@webqit/url-plus
[bundle-src]: https://img.shields.io/bundlephobia/minzip/@webqit/url-plus?style=flat&colorA=18181B&colorB=F0DB4F
[bundle-href]: https://bundlephobia.com/result?p=@webqit/url-plus
[license-src]: https://img.shields.io/github/license/webqit/url-plus.svg?style=flat&colorA=18181B&colorB=F0DB4F
