import { _isObject, _isTypeObject } from '@webqit/util/js/index.js';
import { ListenerRegistry, Descriptor } from '@webqit/observer';
import { URLSearchParamsPlus } from './URLSearchParamsPlus.js';
import { Observer } from '@webqit/observer';

export class URLPlus extends URL {

    static from(init, baseUrl = undefined) {
        return new this(init, baseUrl);
    }

    static copy(urlObj) {
        const copy = Object.fromEntries(urlProperties.map((k) => [k, urlObj[k] || '']));
        if (!('dirname' in urlObj)) {
            delete copy.dirname;
        }
        if (!('basename' in urlObj)) {
            delete copy.basename;
        }
        if (!('segments' in urlObj)) {
            delete copy.segments;
        } else copy.segments = copy.segments.slice(0);
        if (!('query' in urlObj)) {
            delete copy.query;
        } else copy.query = structuredClone(copy.query);
        return copy;
    }

    #segments;
    #dirname = null;
    #basename = null;

    #searchParams;
    #query;

    #listenersRegistry;
    #prettyPrint;

    #internalUpdate = false;
    #gcCallbacks = [];

    #disposed = false;
    #immutable = false;

    constructor(init, baseUrl = undefined, { compatMode = true, immutable = false, prettyPrint = false } = {}) {
        super(init, baseUrl);

        this.#segments = super.pathname.split('/').filter((s) => s.trim());

        this.#searchParams = new URLSearchParamsPlus(super.search, {
            compatMode,
            prettyPrint,
        });
        this.#query = this.#searchParams.json();

        this.#gcCallbacks.push(Observer.observe(this.#segments, Observer.subtree(), () => this.#update('segments')));
        this.#gcCallbacks.push(Observer.observe(this.#query, Observer.subtree(), () => this.#update('query')));

        this.#listenersRegistry = ListenerRegistry.getInstance(this, true);

        this.#immutable = immutable;
        this.#prettyPrint = prettyPrint;

        if (immutable) {
            Object.freeze(this.#segments);
            (function deepFreeze(node) {
                if (!_isTypeObject(node)) return;
                Object.freeze(node);
                Object.values(node).forEach(deepFreeze);
            })(this.#query);
        }
    }

    #updateSegments(segments) {
        this.#internalUpdate = true;
        Observer.batch(this.#segments, () => {
            if (this.#segments.length > segments.length) {
                Observer.proxy(this.#segments).splice(segments.length);
            }
            segments.forEach((v, i) => {
                if (this.#segments[i] === v) return;
                Observer.set(this.#segments, i, v);
            });
        });
        this.#internalUpdate = false;
    }

    #update(changedKey, exec = null) {
        if (this.#immutable) {
            throw new TypeError('URLPlus instance is immutable');
        }
        if (this.#internalUpdate) return;
        if (this.#disposed) return exec?.();

        const related = RELATED_KEYS[changedKey] || [changedKey];

        const oldValues = {};
        for (const key of related) {
            oldValues[key] = key === 'query' ? structuredClone(this[key]) : (
                key === 'segments' ? this[key].slice(0) : this[key]
            );
        }

        if (exec) exec();

        const descriptors = related.map((key) => {
            return new Descriptor(this, {
                type: 'set',
                key,
                value: this[key],
                oldValue: oldValues[key],
                isUpdate: true,
                related: related.slice(),
                operation: 'set',
                detail: null,
            });
        });

        this.#listenersRegistry.emit(descriptors);
    }

    dispose() {
        this.#gcCallbacks.forEach((c) => c.abort());
        this.#disposed = true;
    }

    get disposed() { return this.#disposed; }

    get immutable() { return this.#immutable; }

    // ------- protocol

    set protocol(protocol) {
        this.#update('protocol', () => {
            super.protocol = protocol;
        });
    }

    get protocol() { return super.protocol; }

    // ------- username

    set username(username) {
        this.#update('username', () => {
            super.username = username;
        });
    }

    get username() { return super.username; }

    // ------- password

    set password(password) {
        this.#update('password', () => {
            super.password = password;
        });
    }

    get password() { return super.password; }

    // ------- hostname

    set hostname(hostname) {
        this.#update('hostname', () => {
            super.hostname = hostname;
        });
    }

    get hostname() { return super.hostname; }

    // ------- port

    set port(port) {
        this.#update('port', () => {
            super.port = port;
        });
    }

    get port() { return super.port; }

    // ------- host

    set host(host) {
        this.#update('host', () => {
            super.host = host;
        });
    }

    get host() { return super.host; }

    // ------- segments

    set segments(segments) {
        if (!Array.isArray(segments)) {
            throw new Error('Argument must be an array');
        }
        this.#update('segments', () => {
            this.#updateSegments(segments);
        });
    }

    get segments() { return this.#segments; }

    // ------- pathname

    set pathname(pathname) {
        if (typeof pathname !== 'string' && pathname !== null) {
            throw new Error('Argument must be a string or null');
        }
        this.#update('pathname', () => {
            const segments = (pathname || '').split('/').filter((s) => s.trim());
            this.#updateSegments(segments);
        });
    }

    get pathname() { return `/${this.#segments.join('/')}`; }

    // ------- dirname

    set dirname(dirname) {
        if (typeof dirname !== 'string' && dirname !== null) {
            throw new Error('Argument must be a string or null');
        }
        if (!this.#segments.length) return;

        this.#update('dirname', () => {
            const dSegments = (dirname || '').split('/').filter((s) => s.trim());
            const segments = dSegments.concat(this.#segments[this.#segments.length - 1]);
            this.#updateSegments(segments);
        });
    }

    get dirname() { return !this.#segments.length ? '' : `/${this.#segments.slice(0, -1).join('/')}`; }

    // ------- basename

    set basename(basename) {
        if (basename === null) return;
        if (typeof basename !== 'string') {
            throw new Error('Argument must be a string');
        }
        if (basename.includes('/')) {
            throw new Error('Argument must not contain a slash character');
        }
        if (!this.#segments.length || !basename.length) return;

        this.#update('basename', () => {
            Observer.set(this.#segments, this.#segments.length - 1, basename);
        });
    }

    get basename() { return !this.#segments.length ? '' : this.#segments[this.#segments.length - 1]; }

    // ------- searchParams

    get searchParams() { return this.#searchParams; }

    // ------- hash

    set hash(hash) {
        this.#update('hash', () => {
            super.hash = hash;
        });
    }

    get hash() { return super.hash; }

    // ------- href

    set href(href) {
        this.#update('href', () => {
            super.href = href;
            this.#internalUpdate = true;
            const segments = super.pathname.split('/').filter((s) => s.trim());
            this.#updateSegments(segments);
            this.#searchParams._resetJson(URLSearchParamsPlus.parse(super.search));
            this.#internalUpdate = false;
        });
    }

    get href() { return this.stringify(); }

    // ------- search

    set search(search) {
        this.#update('search', () => {
            super.search = search;
            this.#internalUpdate = true;
            this.#searchParams._resetJson(URLSearchParamsPlus.parse(super.search));
            this.#internalUpdate = false;
        });
    }

    get search() {
        const search = this.#searchParams.stringify({ prettyPrint: this.#prettyPrint });
        return search ? '?' + search : '';
    }

    // ------- query

    set query(query) {
        if (!_isObject(query)) {
            throw new Error('Query must be a JSON object');
        }
        this.#update('query', () => {
            this.#internalUpdate = true;
            this.#searchParams._resetJson(query);
            this.#internalUpdate = false;
        });
    }

    get query() { return this.#query; }

    // -------

    stringify({ prettyPrint = this.#prettyPrint } = {}) {
        const href = super.origin + this.pathname;
        const search = this.#searchParams.stringify({ prettyPrint });
        return href + (search ? '?' + search : '') + this.hash;
    }

    toString() { return this.stringify(); }

    toJSON() { return this.stringify(); }
}

const urlProperties = [
    'protocol',
    'username',
    'password',
    'host',
    'hostname',
    'port',
    'origin',
    'segments',
    'pathname',
    'dirname',
    'basename',
    'search',
    'query',
    'hash',
    'href',
];

const RELATED_KEYS = {
    protocol: ['protocol', 'host', 'origin', 'href'],
    username: ['username', 'href'],
    password: ['password', 'href'],
    hostname: ['hostname', 'host', 'origin', 'href'],
    port: ['port', 'host', 'origin', 'href'],
    host: ['host', 'hostname', 'port', 'origin', 'href'],
    segments: ['segments', 'pathname', 'dirname', 'basename', 'href'],
    pathname: ['pathname', 'segments', 'dirname', 'basename', 'href'],
    dirname: ['dirname', 'segments', 'pathname', 'basename', 'href'],
    basename: ['basename', 'segments', 'pathname', 'dirname', 'href'],
    search: ['search', 'query', 'href'],
    query: ['query', 'search', 'href'],
    hash: ['hash', 'href'],
    href: [
        'protocol', 'username', 'password',
        'hostname', 'port', 'host', 'origin',
        'segments', 'pathname', 'dirname', 'basename',
        'query', 'search',
        'hash', 'href'
    ],
};
