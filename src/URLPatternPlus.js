import 'urlpattern-polyfill';

export class URLPatternPlus extends URLPattern {

    #inputUrl;

    constructor(init, baseURL = null) {
        if (typeof init === 'object' && init?.baseURL) {
            ({ baseURL, ...init } = init);
        }
        super(init, baseURL);

        this.#inputUrl = new URL(init, baseURL);
    }

    isPattern() {
        const hasUnescapedMeta = (str, metaChars) => {
            if (!str) return false;
            let esc = false;
            for (const ch of str) {
                if (esc) { esc = false; continue; }
                if (ch === '\\') { esc = true; continue; }
                if (metaChars.has(ch)) return true;
            }
            return false;
        };
        const META = {
            protocol: new Set(['*']),
            username: new Set(['*']),
            password: new Set(['*']),
            hostname: new Set(['*', '{']),
            port: new Set(['*', '{']),
            pathname: new Set(['*', ':', '{', '(']),
            search: new Set(['*', '{']),
            hash: new Set(['*', '{']),
        };
        const url = this.#inputUrl;
        return (
            hasUnescapedMeta(url.protocol, META.protocol) ||
            hasUnescapedMeta(url.username, META.username) ||
            hasUnescapedMeta(url.password, META.password) ||
            hasUnescapedMeta(url.hostname, META.hostname) ||
            hasUnescapedMeta(url.port, META.port) ||
            hasUnescapedMeta(url.pathname, META.pathname) ||
            hasUnescapedMeta(url.search, META.search) ||
            hasUnescapedMeta(url.hash, META.hash)
        );
    }

    exec(...args) {
        const result = super.exec(...args);
        if (!result) return;

        const named = {};

        for (const component of Object.values(result)) {
            if (component?.groups) {
                Object.assign(named, component.groups);
            }
        }

        const vars = { named };

        const render = (str) => {
            return str.replace(/\$(\$|[A-Z0-9_]+)/gi, (_, token) => {
                if (token === '$') return '$';
                return vars.named[token] ?? '';
            });
        };

        return {
            ...result,
            vars,
            render
        };
    }
}