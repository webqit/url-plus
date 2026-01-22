import { _isString, _isNumeric, _isObject, _isTypeObject } from '@webqit/util/js/index.js';
import { Observer } from '@webqit/observer';

export class URLSearchParamsPlus extends URLSearchParams {

    #tree = {};

    #compatMode;
    get compatMode() { return this.#compatMode; }
    #compatModeKeys = new Set;
    #prettyPrint;

    #sorted = false;

    constructor(init = {}, { compatMode = true, prettyPrint = false } = {}) {
        super();
        this.#compatMode = compatMode;
        this.#prettyPrint = prettyPrint;

        let tree;
        if (init instanceof URLSearchParamsPlus) {
            tree = structuredClone(init.json());
            if (compatMode) {
                this.#compatModeKeys = new Set(init.keys());
            }
        } else if (init instanceof URLSearchParams
            || init instanceof FormData) {
            tree = Object.fromEntries(init);
            if (compatMode) {
                this.#compatModeKeys = new Set(init.keys());
            }
        } else if (_isString(init)) {
            init = decodeURIComponent(init.replace(/^\?/, ''));
            tree = this.constructor.parse(init, compatMode ? false : true);
            if (compatMode) {
                this.#compatModeKeys = new Set(
                    init.split('&').map((q) => q.split('=')[0])
                );
            }
        } else if (Array.isArray(init)) {
            tree = this.constructor.fromEntries(init);
            if (compatMode) {
                this.#compatModeKeys = new Set(init.map(([k]) => k));
            }
        } else if (_isObject(init)) {
            tree = init;
            if (compatMode) {
                this.constructor.reduceValue(init, '', (v, path, next) => {
                    if (next) return next;
                    if (/\[\d+\]$/.test(path)) {
                        // Remove the trailing sqaure brackets
                        [, path] = /^(.*)\[\d+\]$/.exec(path);
                    }
                    this.#compatModeKeys.add(path);
                });
            }
        } else {
            tree = {};
        }

        this._resetJson(tree);
    }

    _resetJson(tree, params = {}) {
        if (!_isObject(tree)) throw new Error('Argument must be a JSON object');

        const exitingKeys = Object.keys(this.#tree).filter((key) => !(key in tree));
        return Observer.batch(this.#tree, () => {
            if (exitingKeys.length) { Observer.deleteProperties(this.#tree, exitingKeys, params); }
            return Observer.set(this.#tree, tree, params);
        }, params);
    }

    /* ───────── Instance API ───────── */

    get(path) {
        const value = this.#get(path);
        if (this.#compatMode
            && Array.isArray(value)) return value[0];
        return value;
    }

    #get(path, all = false) {
        if (this.#compatMode
            && !this.#compatModeKeys.has(path)) {
            return null;
        }
        const value = this.constructor.get(this.#tree, path, all);
        if (value === undefined) return null;

        if (Array.isArray(value)) {
            if (this.#compatMode) {
                return value.map((v) => typeof v === 'number' ? v + '' : v);
            }
            return value.map(v =>
                _isObject(v) ? new URLSearchParamsPlus(v, { compatMode: this.#compatMode }) : v
            );
        }

        if (!this.#compatMode && _isObject(value)) {
            return new URLSearchParamsPlus(value, { compatMode: this.#compatMode });
        }

        if (this.#compatMode && typeof value === 'number') {
            return value + '';
        }

        return value;
    }

    getAll(path) {
        const value = this.#get(path, true);
        if (value === null) return [];
        return Array.isArray(value) ? value : [value];
    }

    set(path, value) {
        if (this.#compatMode) {
            this.#compatModeKeys.add(path);
        }
        this.constructor.set(this.#tree, path, value);
        return this;
    }

    append(path, value) {
        if (this.#compatMode) {
            this.#compatModeKeys.add(path);
        }
        this.constructor.set(this.#tree, path, value, true/* appendIfExists */);
        return this;
    }

    has(path) {
        if (this.#compatMode
            && !this.#compatModeKeys.has(path)) {
            return false;
        }
        return this.constructor.get(this.#tree, path) !== undefined;
    }

    delete(path) {
        if (this.#compatMode
            && !this.#compatModeKeys.has(path)) {
            return;
        }
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

    json() { return this.#tree; }

    stringify({ prettyPrint = this.#prettyPrint, sort = this.#sorted } = {}) {
        return this.constructor.stringify(this.#tree, {
            only: this.#compatMode && this.#compatModeKeys,
            sort,
            prettyPrint,
        });
    }

    toString() { return this.stringify(); }

    entries() {
        const out = [];
        this.constructor.reduceValue(this.#tree, '', (v, path, next) => {
            if (next) return next;
            if (this.#compatMode && !this.#compatModeKeys.has(path)) {
                if (/\[\d+\]$/.test(path)) {
                    // Try without the trailing sqaure brackets
                    [, path] = /^(.*)\[\d+\]$/.exec(path);
                    if (!this.#compatModeKeys.has(path)
                        && !this.#compatModeKeys.has(path = `${path}[]`)) return;
                } else return;
            }
            if (this.#compatMode && typeof v === 'number') {
                v = v + '';
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

    static parse(str, parseNums = false, delim = '&') {
        const tree = {};
        (str.startsWith('?') ? str.slice(1) : str)
            .split(delim)
            .filter(Boolean)
            .forEach(q => {
                const i = q.indexOf('=');
                const key = i === -1 ? q : q.slice(0, i);
                const val = i === -1 ? '' : q.slice(i + 1);
                this.set(tree, key, val, true/* appendIfExists */, parseNums);
            });
        return tree;
    }

    static fromEntries(entries) {
        const tree = {};
        for (const [k, v] of entries) {
            this.set(tree, k, v, true/* appendIfExists */);
        }
        return tree;
    }

    static stringify(tree, { sort = false, only = null, prettyPrint = false, delim = '&' } = {}) {
        const q = [];
        const keys = Object.keys(tree);
        if (sort) keys.sort();

        keys.forEach(k => {
            this.reduceValue(tree[k], k, (v, path, suggested) => {
                if (suggested) return sort ? [...suggested].sort() : suggested;
                if (only && !only.has(path)) {
                    if (/\[\d+\]$/.test(path)) {
                        // Try without the trailing sqaure brackets
                        [, path] = /^(.*)\[\d+\]$/.exec(path);
                        if (!only.has(path)
                            && !only.has(path = `${path}[]`)) return;
                    } else return;
                }
                if (!prettyPrint) {
                    path = encodeURIComponent(path);
                }
                q.push(path + '=' + encodeURIComponent(v));
            }, (prettyPrint ? true : false)/* encodeOffsets */);
        });

        return q.join(delim);
    }

    static get(tree, path, allowGetAll = false) {
        return this.reducePath(path, tree, (k, t, branch) => {
            if (branch) return branch;
            if (k === '') {
                if (allowGetAll) return t;
                return t?.[0];
            }
            return t?.[k];
        });
    }

    static set(tree, path, value, appendIfExists = false, parseNums = false) {
        this.reducePath(path, tree, (k, t, branch) => {
            let v = branch ?? value;
            if (parseNums && /^-?\d+(\.\d+)?$/.test(v + '')) {
                v = parseFloat(v);
            }
            if (k === '' && Array.isArray(t)) Observer.proxy(t).push(v);
            else if (appendIfExists && t?.[k]) {
                if (Array.isArray(t[k])) Observer.proxy(t[k]).push(v);
                else Observer.set(t, k, [t[k], v]);
            } else Observer.set(t, k, v);
            return v;
        });
    }

    static reduceValue(value, ctx, cb, encodeOffsets = false) {
        if (_isTypeObject(value)) {
            const keys = Object.keys(value);
            const next = cb(value, ctx, keys);
            if (Array.isArray(next)) {
                next.forEach(k => {
                    if (encodeOffsets) {
                        k = encodeURIComponent(k);
                    }
                    this.reduceValue(value[k], ctx ? `${ctx}[${k}]` : k, cb, encodeOffsets)
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
