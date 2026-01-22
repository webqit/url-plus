import { expect } from 'chai';
import { URLPlus, URLSearchParamsPlus } from '../src/index.js';
import { Observer } from '@webqit/observer';

const encodeSearch = (s) => {
    if (s.startsWith('?')) return `?${encodeSearch(s.slice(1))}`;
    return s.split(/=/g).map((s) => s.split('&').map((s) => encodeURIComponent(s)).join('&')).join('=');
};

describe('URLPlus – construction', () => {

    it('constructs from absolute URL', () => {
        const url = new URLPlus('https://example.com/foo?x=1#y');

        expect(url.protocol).to.eq('https:');
        expect(url.hostname).to.eq('example.com');
        expect(url.pathname).to.eq('/foo');
        expect(url.search).to.eq('?x=1');
        expect(url.hash).to.eq('#y');
    });

    it('constructs from relative URL with base', () => {
        const url = new URLPlus('/a/b?c=1', 'https://example.com');

        expect(url.href).to.eq('https://example.com/a/b?c=1');
    });

    it('toString() and toJSON() return href', () => {
        const url = new URLPlus('https://x.test/a?b=1');

        expect(String(url)).to.eq(url.href);
        expect(JSON.stringify(url)).to.eq(`"${url.href}"`);
    });

});

describe('URLPlus – query synchronization', () => {

    it('parses query into structured object', () => {
        const url = new URLPlus('https://x.test/?a=1&b[c]=2');

        expect(url.query).to.eql({
            a: '1',
            b: { c: '2' }
        });
    });

    it('updates search when query is replaced', () => {
        const url = new URLPlus('https://x.test/');

        url.query = { a: 1, b: { c: 2 } };

        // In compatMode
        // direct query mutations to "query" doesn't reflect in "search"
        expect(url.search).to.eq('');
        expect(url.href).to.eq(`https://x.test/`);
    });

    it('updates query when search is replaced', () => {
        const url = new URLPlus('https://x.test/');

        url.search = '?x=1&y[z]=2';

        expect(url.query).to.eql({
            x: '1',
            y: { z: '2' }
        });
    });

    it('clears search when query is empty', () => {
        const url = new URLPlus('https://x.test/?a=1');

        url.query = {};

        expect(url.search).to.eq('');
        expect(url.href).to.eq('https://x.test/');
    });

});

describe('URLPlus – live searchParams behavior', () => {

    it('mutating searchParams updates search and href', () => {
        const url = new URLPlus('https://x.test/');

        url.searchParams.set('a[b]', 1);

        expect(url.query).to.eql({ a: { b: 1 } });
        expect(url.search).to.eq(encodeSearch('?a[b]=1'));
    });

    it('append creates arrays', () => {
        const url = new URLPlus('https://x.test/?a=1', undefined, { compatMode: false });

        url.searchParams.append('a', 2);

        expect(url.query).to.eql({ a: [1, 2] });
        // arrays serialize with explicit numeric indices
        expect(url.search).to.eq(encodeSearch('?a[0]=1&a[1]=2'));
    });

    it('delete removes keys', () => {
        const url = new URLPlus('https://x.test/?a[b]=1&a[c]=2');

        url.searchParams.delete('a[b]');

        expect(url.query).to.eql({ a: { c: '2' } });
        expect(url.search).to.eq(encodeSearch('?a[c]=2'));
    });

});

describe('URLPlus – pathname and dirname', () => {

    it('computes dirname', () => {
        const url = new URLPlus('https://x.test/a/b/c');

        expect(url.dirname).to.eq('/a/b');
    });

    it('updates pathname correctly', () => {
        const url = new URLPlus('https://x.test/a');

        url.pathname = '/x/y';

        expect(url.href).to.eq('https://x.test/x/y');
    });

});

describe('URLPlus.copy()', () => {

    it('creates a shallow serializable snapshot', () => {
        const url = new URLPlus('https://x.test/a?b=1#c');

        const copy = URLPlus.copy(url);

        expect(copy).to.eql({
            protocol: 'https:',
            username: '',
            password: '',
            host: 'x.test',
            hostname: 'x.test',
            port: '',
            origin: 'https://x.test',
            segments: ['a'],
            pathname: '/a',
            dirname: '/',
            basename: 'a',
            search: '?b=1',
            query: { b: '1' },
            hash: '#c',
            href: 'https://x.test/a?b=1#c'
        });
    });

    it('produces a detached snapshot', () => {
        const url = new URLPlus('https://x.test/a?b=1');

        const copy = URLPlus.copy(url);

        copy.query.b = 2;

        expect(url.query.b).to.equal('1');
    });

});

describe('URLPlus – errors', () => {

    it('throws when query is not an object', () => {
        const url = new URLPlus('https://x.test/');

        expect(() => {
            url.query = 'a=1';
        }).to.throw(/Query must be a JSON object/);
    });

});

describe('URLPlus – dispose()', () => {

    it('can be disposed without throwing', () => {
        const url = new URLPlus('https://x.test/?a=1');

        expect(() => url.dispose()).to.not.throw();
    });

});

describe('URLPlus – segments direct mutation', () => {

    it('mutating segments updates pathname, dirname, basename, and href', () => {
        const url = new URLPlus('https://x.test/a/b');

        url.segments.push('c');

        expect(url.pathname).to.equal('/a/b/c');
        expect(url.dirname).to.equal('/a/b');
        expect(url.basename).to.equal('c');
        expect(url.href).to.equal('https://x.test/a/b/c');
    });

    it('replacing segments array contents preserves reactivity', () => {
        const url = new URLPlus('https://x.test/a/b');

        url.segments.splice(0, 2, 'x', 'y');

        expect(url.pathname).to.equal('/x/y');
        expect(url.dirname).to.equal('/x');
        expect(url.basename).to.equal('y');
    });

    it('clearing segments collapses path to root', () => {
        const url = new URLPlus('https://x.test/a/b');

        url.segments.length = 0;

        expect(url.pathname).to.equal('/');
        expect(url.dirname).to.equal('');
        expect(url.basename).to.equal('');
        expect(url.href).to.equal('https://x.test/');
    });

});

describe('URLPlus – dirname setter', () => {

    it('replaces parent directories while preserving basename', () => {
        const url = new URLPlus('https://x.test/a/b/c');

        url.dirname = '/x/y';

        expect(url.pathname).to.equal('/x/y/c');
        expect(url.dirname).to.equal('/x/y');
        expect(url.basename).to.equal('c');
    });

    it('setting dirname to root preserves basename', () => {
        const url = new URLPlus('https://x.test/a');

        url.dirname = '/';

        expect(url.pathname).to.equal('/a');
        expect(url.dirname).to.equal('/');
        expect(url.basename).to.equal('a');
    });

    it('setting dirname on empty path is a no-op', () => {
        const url = new URLPlus('https://x.test/');

        url.dirname = '/x';

        expect(url.pathname).to.equal('/');
        expect(url.href).to.equal('https://x.test/');
    });

});

describe('URLPlus – basename setter', () => {

    it('updates only the terminal path segment', () => {
        const url = new URLPlus('https://x.test/a/b');

        url.basename = 'c';

        expect(url.pathname).to.equal('/a/c');
        expect(url.dirname).to.equal('/a');
    });

    it('throws if basename contains slash', () => {
        const url = new URLPlus('https://x.test/a');

        expect(() => {
            url.basename = 'x/y';
        }).to.throw(/must not contain a slash/);
    });

    it('setting basename on empty path is a no-op', () => {
        const url = new URLPlus('https://x.test/');

        url.basename = 'a';

        expect(url.pathname).to.equal('/');
        expect(url.basename).to.equal('');
    });

});
describe('URLPlus – segments setter', () => {

    it('replaces path using a new segments array', () => {
        const url = new URLPlus('https://x.test/a/b');

        url.segments = ['x', 'y', 'z'];

        expect(url.pathname).to.equal('/x/y/z');
        expect(url.dirname).to.equal('/x/y');
        expect(url.basename).to.equal('z');
    });

    it('throws if segments is not an array', () => {
        const url = new URLPlus('https://x.test/a');

        expect(() => {
            url.segments = 'a/b';
        }).to.throw(/Argument must be an array/);
    });

});

describe('URLPlus – href setter normalization', () => {

    it('replaces pathname, query, and hash consistently', () => {
        const url = new URLPlus('https://x.test/a?b=1#c', undefined, { compatMode: false });

        url.href = 'https://x.test/x/y?z=2#k';

        expect(url.pathname).to.equal('/x/y');
        expect(url.query).to.eql({ z: '2' });
        expect(url.hash).to.equal('#k');
        expect(url.href).to.equal('https://x.test/x/y?z=2#k');
    });

});

describe('URLPlus – searchParams.sort()', () => {

    it('sorts serialized search without mutating query structure', () => {
        const url = new URLPlus('https://x.test/?b=2&a=1');

        url.searchParams.sort();

        expect(url.search).to.equal('?a=1&b=2');
        expect(url.query).to.eql({ b: '2', a: '1' });
    });

});

// ----------------------------

describe('URLPlus – Observer integration', () => {

    describe('single-key observation (single descriptor)', () => {

        it('notifies href observer with a single descriptor', () => {
            const url = new URLPlus('https://example.com/a');

            Observer.observe(url, 'href', (desc) => {
                expect(desc.key).to.equal('href');
                expect(desc.oldValue).to.equal('https://example.com/a');
                expect(desc.value).to.equal('https://example.com/b');
            });

            url.href = 'https://example.com/b';
        });

        it('notifies href when pathname changes', () => {
            const url = new URLPlus('https://example.com/a');

            Observer.observe(url, 'href', (desc) => {
                expect(desc.key).to.equal('href');
                expect(desc.value).to.equal('https://example.com/b');
            });

            url.pathname = '/b';
        });

    });

    describe('observe all keys (batch descriptors)', () => {

        it('emits related mutations as a batch', () => {
            const url = new URLPlus('https://example.com/a');

            Observer.observe(url, (descs) => {
                expect(descs).to.be.an('array');

                const keys = descs.map(d => d.key);

                expect(keys).to.include('hostname');
                expect(keys).to.include('host');
                expect(keys).to.include('origin');
                expect(keys).to.include('href');
            });

            url.hostname = 'example.org';
        });

    });

    describe('query subtree mutation', () => {

        it('emits query/search/href batch when subtree mutates', () => {
            const url = new URLPlus('https://example.com/?a[b]=1', undefined, { prettyPrint: true });

            Observer.observe(url, (descs) => {
                expect(descs).to.be.an('array');

                const keys = descs.map(d => d.key);

                expect(keys).to.include('query');
                expect(keys).to.include('search');
                expect(keys).to.include('href');

                expect(url.query).to.deep.equal({ a: { b: 2 } });
                expect(url.search).to.equal('?a[b]=2');
                expect(url.href).to.equal('https://example.com/?a[b]=2');
            });

            Observer.set(url.query.a, 'b', 2);
        });

    });

    describe('query replacement', () => {

        it('notifies query observer with a single descriptor', () => {
            const url = new URLPlus('https://example.com/');

            Observer.observe(url, 'query', (desc) => {
                expect(desc.key).to.equal('query');
                expect(desc.oldValue).to.deep.equal({});
                expect(desc.value).to.deep.equal({ a: 1 });
            });

            url.query = { a: 1 };
        });

    });

    describe('batch causality and consistency', () => {

        it('batch reflects final derived state after subtree mutation', () => {
            const url = new URLPlus('https://example.com/?a=1');

            Observer.observe(url, (descs) => {
                const keys = descs.map(d => d.key);

                expect(keys).to.include('query');
                expect(keys).to.include('search');
                expect(keys).to.include('href');

                const hrefDesc = descs.find(d => d.key === 'href');
                expect(hrefDesc.value).to.equal('https://example.com/?a=2');
            });

            Observer.set(url.query, 'a', 2);
        });

        it('stops observer notifications after dispose', () => {
            const url = new URLPlus('https://x.test/a');

            let called = false;

            Observer.observe(url, () => {
                called = true;
            });

            url.dispose();
            url.pathname = '/b';

            expect(called).to.equal(false);
        });

    });

});
