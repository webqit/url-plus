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
            a: 1,
            b: { c: 2 }
        });
    });

    it('updates search when query is replaced', () => {
        const url = new URLPlus('https://x.test/');

        url.query = { a: 1, b: { c: 2 } };

        expect(url.search).to.eq(encodeSearch('?a=1&b[c]=2'));
        expect(url.href).to.eq(`https://x.test/${encodeSearch('?a=1&b[c]=2')}`);
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
        const url = new URLPlus('https://x.test/?a=1');

        url.searchParams.append('a', 2);

        expect(url.query).to.eql({ a: [1, 2] });
        // arrays serialize with explicit numeric indices
        expect(url.search).to.eq(encodeSearch('?a[0]=1&a[1]=2'));
    });

    it('delete removes keys', () => {
        const url = new URLPlus('https://x.test/?a[b]=1&a[c]=2');

        url.searchParams.delete('a[b]');

        expect(url.query).to.eql({ a: { c: 2 } });
        expect(url.search).to.eq(encodeSearch('?a[c]=2'));
    });

});

describe('URLPlus – pathname and ancestorPathname', () => {

    it('computes ancestorPathname', () => {
        const url = new URLPlus('https://x.test/a/b/c');

        expect(url.ancestorPathname).to.eq('/a/b');
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
            ancestorPathname: '/',
            protocol: 'https:',
            username: '',
            password: '',
            host: 'x.test',
            hostname: 'x.test',
            port: '',
            origin: 'https://x.test',
            pathname: '/a',
            search: '?b=1',
            query: { b: 1 },
            hash: '#c',
            href: 'https://x.test/a?b=1#c'
        });
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
            const url = new URLPlus('https://example.com/?a[b]=1');

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

    });

});
