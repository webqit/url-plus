import { ListenerRegistry, Descriptor } from '@webqit/observer';
import { _isObject } from '@webqit/util/js/index.js';
import { URLSearchParamsPlus } from './URLSearchParamsPlus.js';
import { Path } from './Path.js';

export class URLPlus extends URL {

    static from(init, baseUrl = undefined) {
        return new this(init, baseUrl);
    }

    static copy(urlObj) {
        const copy = Object.fromEntries(urlProperties.map((k) => [k, urlObj[k] || '']));
        if (!('ancestorPathname' in urlObj)) {
            delete copy.ancestorPathname;
        }
        if (!('query' in urlObj)) {
            delete copy.query;
        }
        return copy;
    }

    // -------

    set protocol(val) {
        this.#update('protocol', () => {
            super.protocol = val;
        });
    }

    get protocol() { return super.protocol; }

    set username(val) {
        this.#update('username', () => {
            super.username = val;
        });
    }

    get username() { return super.username; }

    set password(val) {
        this.#update('password', () => {
            super.password = val;
        });
    }

    get password() { return super.password; }

    set hostname(val) {
        this.#update('hostname', () => {
            super.hostname = val;
        });
    }

    get hostname() { return super.hostname; }

    set port(val) {
        this.#update('port', () => {
            super.port = val;
        });
    }

    get port() { return super.port; }

    set host(val) {
        this.#update('host', () => {
            super.host = val;
        });
    }

    get host() { return super.host; }

    get ancestorPathname() {
        return Path.dirname(this.pathname);
    }

    set pathname(val) {
        this.#update('pathname', () => {
            super.pathname = val;
        });
    }

    get pathname() { return super.pathname; }

    #searchParams;
    get searchParams() { return this.#searchParams; }

    set hash(val) {
        this.#update('hash', () => {
            super.hash = val;
        });
    }

    get hash() { return super.hash; }

    // -------

    set href(val) {
        this.#update('href', () => {
            super.href = val;
            this.#searchParams._resetJson(URLSearchParamsPlus.parse(super.search));
        });
    }

    get href() {
        const [href] = super.href.split('?');
        return href + this.search + this.hash;
    }

    set search(val) {
        this.#update('search', () => {
            super.search = val;
            this.#searchParams._resetJson(URLSearchParamsPlus.parse(super.search));
        });
    }

    get search() {
        const search = this.#searchParams.toString();
        return search ? '?' + search : '';
    }

    set query(val) {
        if (!_isObject(val)) throw new Error('Query must be a JSON object');
        this.#update('query', () => {
            this.#searchParams._resetJson(val);
        });
    }

    get query() {
        return this.#searchParams.json();
    }

    // -------

    #listenersRegistry;

    constructor(init, baseUrl = undefined) {
        super(init, baseUrl);
        this.#searchParams = new URLSearchParamsPlus(super.search, () => {
            this.#update('query');
        });
        this.#listenersRegistry = ListenerRegistry.getInstance(this, true);
    }

    #update(changedKey, exec = null) {
        const related = RELATED_KEYS[changedKey] || [changedKey];

        const oldValues = {};
        for (const key of related) {
            oldValues[key] = this[key];
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
        this.#searchParams._changeCallbackGC?.abort();
    }

    toString() { return this.href; }

    toJSON() { return this.href; }
}

const urlProperties = [
    'ancestorPathname',
    'protocol',
    'username',
    'password',
    'host',
    'hostname',
    'port',
    'origin',
    'pathname',
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
    pathname: ['pathname', 'ancestorPathname', 'href'],
    search: ['search', 'query', 'href'],
    query: ['query', 'search', 'href'],
    hash: ['hash', 'href'],
    href: [
        'protocol', 'username', 'password',
        'hostname', 'port', 'host',
        'pathname', 'search', 'query',
        'hash', 'origin', 'ancestorPathname', 'href'
    ],
};
