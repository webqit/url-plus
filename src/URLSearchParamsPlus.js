import { _isString, _isNumeric, _isObject, _isTypeObject } from '@webqit/util/js/index.js';
import { Observer } from '@webqit/observer';

export class URLSearchParamsPlus extends URLSearchParams {

    #tree;
    #sorted = false;
    #changeCallback;
    _changeCallbackGC;

    constructor(init = {}, changeCallback = null) {
        super();

        let tree;
        if (init instanceof URLSearchParamsPlus) {
            tree = structuredClone(init.json());
        } else if (init instanceof URLSearchParams
            || init instanceof FormData) {
            tree = Object.fromEntries(init);
        } else if (_isString(init)) {
            tree = this.constructor.parse(init);
        } else if (Array.isArray(init)) {
            tree = this.constructor.fromEntries(init);
        } else if (_isObject(init)) {
            tree = init;
        } else {
            tree = {};
        }

        this._changeCallback = changeCallback;
        this._resetJson(tree);
    }

    _resetJson(tree) {
        this.#tree = Observer.proxy(tree);
        if (this.#changeCallback) {
            this._changeCallbackGC?.abort();
            this._changeCallbackGC = Observer.observe(this.#tree, Observer.subtree(), this.#changeCallback);
        }
    }

    /* ───────── Instance API ───────── */

    get(path) {
        const value = this.constructor.get(this.#tree, path);
        if (value === undefined) return null;

        if (Array.isArray(value)) {
            return value.map(v =>
                _isObject(v) ? new URLSearchParamsPlus(v) : v
            );
        }

        if (_isObject(value)) {
            return new URLSearchParamsPlus(value);
        }

        if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
            return parseFloat(value);
        }

        return value;
    }

    set(path, value) {
        this.constructor.set(this.#tree, path, value);
        return this;
    }

    append(path, value) {
        if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
            value = parseFloat(value);
        }
        const existing = this.constructor.get(this.#tree, path);
        if (existing === undefined) {
            this.set(path, value);
        } else if (Array.isArray(existing)) {
            Observer.proxy(existing).push(value);
        } else {
            this.set(path, [existing, value]);
        }
        return this;
    }

    getAll(path) {
        const value = this.get(path);
        if (value === null) return [];
        return Array.isArray(value) ? value : [value];
    }

    has(path) {
        return this.constructor.get(this.#tree, path) !== undefined;
    }

    delete(path) {
        const parts = this.constructor.parsePath(path);
        const key = parts.pop();
        const parent = parts.length
            ? this.constructor.get(this.#tree, parts)
            : this.#tree;

        if (_isObject(parent)) {
            Observer.deleteProperty(parent, key);
        }
    }

    sort() {
        this.#sorted = true;
        return this;
    }

    json() {
        return Observer.unproxy(this.#tree);
    }

    toString() {
        return this.constructor.stringify(this.#tree, '&', this.#sorted);
    }

    entries() {
        const out = [];
        this.constructor.reduceValue(this.#tree, '', (v, path, next) => {
            if (next) return next;
            if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
                v = parseFloat(v);
            }
            out.push([path, v]);
        });
        return out[Symbol.iterator]();
    }

    keys() {
        return Array.from(this.entries(), ([k]) => k)[Symbol.iterator]();
    }

    values() {
        return Array.from(this.entries(), ([, v]) => v)[Symbol.iterator]();
    }

    forEach(cb, thisArg) {
        for (const [k, v] of this.entries()) {
            cb.call(thisArg, v, k, this);
        }
    }

    [Symbol.iterator]() {
        return this.entries();
    }

    get size() {
        let c = 0;
        this.forEach(() => c++);
        return c;
    }

    /* ───────── Static utilities ───────── */

    static parse(str, delim = '&') {
        const tree = {};
        (str.startsWith('?') ? str.slice(1) : str)
            .split(delim)
            .filter(Boolean)
            .forEach(q => {
                const i = q.indexOf('=');
                const key = i === -1 ? q : q.slice(0, i);
                const val = i === -1 ? '' : decodeURIComponent(q.slice(i + 1));
                this.set(tree, key, val);
            });
        return tree;
    }

    static fromEntries(entries) {
        const tree = {};
        for (const [k, v] of entries) {
            this.set(tree, k, v);
        }
        return tree;
    }

    static stringify(tree, delim = '&', sorted = false) {
        const q = [];
        const keys = Object.keys(tree);
        if (sorted) keys.sort();

        keys.forEach(k => {
            this.reduceValue(tree[k], k, (v, path, suggested) => {
                if (suggested) return sorted ? [...suggested].sort() : suggested;
                q.push(`${path}=${encodeURIComponent(v)}`);
            });
        });

        return q.join(delim);
    }

    static get(tree, path) {
        return this.reducePath(path, tree, (k, t, branch) => {
            if (branch) return branch;
            return t?.[k];
        });
    }

    static set(tree, path, value) {
        this.reducePath(path, tree, (k, t, branch) => {
            let v = branch ?? value;
            if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
                v = parseFloat(v);
            }
            if (k === '' && Array.isArray(t)) Observer.proxy(t).push(v);
            else Observer.set(t, k, v);
            return v;
        });
    }

    static reduceValue(value, ctx, cb) {
        if (_isTypeObject(value)) {
            const keys = Object.keys(value);
            const next = cb(value, ctx, keys);
            if (Array.isArray(next)) {
                next.forEach(k => {
                    this.reduceValue(value[k], ctx ? `${ctx}[${k}]` : k, cb)
                });
                return;
            }
        }
        cb(value, ctx);
    }

    static reducePath(path, ctx, cb) {
        const parts = this.parsePath(path);
        let t = ctx;

        for (let i = 0; i < parts.length; i++) {
            let k = parts[i];
            if (_isNumeric(k)) k = +k;

            if (i === parts.length - 1) return cb(k, t);

            if (!_isTypeObject(t)) return;
            if (!_isTypeObject(t[k])) {
                const next = parts[i + 1];
                t[k] = cb(k, t, _isNumeric(next) || next === '' ? [] : {});
            }
            t = t[k];
        }
    }

    static parsePath(path) {
        if (Array.isArray(path)) return path;
        if (!_isString(path)) return [];

        const out = [];
        path.replace(/\[([^\]]*)\]|([^[\]]+)/g, (_, b, p) => {
            out.push(b ?? p);
        });
        
        return out;
    }
}
