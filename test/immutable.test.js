import { expect } from 'chai';
import { URLPlus } from '../src/URLPlus.js';

describe('URLPlus – immutable mode', () => {

    describe('basic immutability contract', () => {

        it('exposes immutable flag', () => {
            const url = new URLPlus('https://example.com/a/b?x=1', undefined, { immutable: true });
            expect(url.immutable).to.equal(true);
        });

        it('allows read access to all properties', () => {
            const url = new URLPlus('https://example.com/a/b?x=1#hash', undefined, { immutable: true });

            expect(url.protocol).to.equal('https:');
            expect(url.pathname).to.equal('/a/b');
            expect(url.dirname).to.equal('/a');
            expect(url.basename).to.equal('b');
            expect(url.query).to.deep.equal({ x: '1' });
            expect(url.hash).to.equal('#hash');
        });

    });

    describe('segments immutability', () => {

        it('prevents direct structural mutation', () => {
            const url = new URLPlus('https://example.com/a/b', undefined, { immutable: true });

            expect(() => {
                url.segments.push('c');
            }).to.throw();
        });

        it('prevents index assignment', () => {
            const url = new URLPlus('https://example.com/a/b', undefined, { immutable: true });

            expect(() => {
                url.segments[0] = 'x';
            }).to.throw();
        });

        it('prevents length mutation', () => {
            const url = new URLPlus('https://example.com/a/b', undefined, { immutable: true });

            expect(() => {
                url.segments.length = 0;
            }).to.throw();
        });

        it('prevents replacement via setter', () => {
            const url = new URLPlus('https://example.com/a/b', undefined, { immutable: true });

            expect(() => {
                url.segments = ['x', 'y'];
            }).to.throw('immutable');
        });

        it('prevents pathname mutation', () => {
            const url = new URLPlus('https://example.com/a/b', undefined, { immutable: true });

            expect(() => {
                url.pathname = '/x/y';
            }).to.throw('immutable');
        });

        it('prevents dirname mutation', () => {
            const url = new URLPlus('https://example.com/a/b', undefined, { immutable: true });

            expect(() => {
                url.dirname = '/x';
            }).to.throw('immutable');
        });

        it('prevents basename mutation', () => {
            const url = new URLPlus('https://example.com/a/b', undefined, { immutable: true });

            expect(() => {
                url.basename = 'c';
            }).to.throw('immutable');
        });

    });

    describe('query immutability (deep)', () => {

        it('prevents top-level mutation', () => {
            const url = new URLPlus('https://example.com/?a=1', undefined, { immutable: true });

            expect(() => {
                url.query.a = 2;
            }).to.throw();
        });

        it('prevents adding new keys', () => {
            const url = new URLPlus('https://example.com/?a=1', undefined, { immutable: true });

            expect(() => {
                url.query.b = 2;
            }).to.throw();
        });

        it('prevents deleting keys', () => {
            const url = new URLPlus('https://example.com/?a=1', undefined, { immutable: true });

            expect(() => {
                delete url.query.a;
            }).to.throw();
        });

        it('prevents deep mutation', () => {
            const url = new URLPlus(
                'https://example.com/?a[x]=1',
                undefined,
                { immutable: true }
            );

            expect(() => {
                url.query.a.x = 2;
            }).to.throw();
        });

        it('prevents array mutation in query', () => {
            const url = new URLPlus(
                'https://example.com/?a[]=1&a[]=2',
                undefined,
                { immutable: true }
            );

            expect(() => {
                url.query.a.push(3);
            }).to.throw();
        });

        it('prevents replacing query via setter', () => {
            const url = new URLPlus('https://example.com/?a=1', undefined, { immutable: true });

            expect(() => {
                url.query = { b: 2 };
            }).to.throw('immutable');
        });

    });

    describe('searchParams behavior under immutability', () => {

        it('allows read-only searchParams access', () => {
            const url = new URLPlus('https://example.com/?b=2&a=1', undefined, { immutable: true });
            expect(url.searchParams.get('a')).to.equal('1');
        });

        it('still sorts searchParams', () => {
            const url = new URLPlus(
                'https://example.com/?b=2&a=1',
                undefined,
                { immutable: true }
            );

            const sorted = url.searchParams.stringify({ sorted: true });
            expect(sorted).to.equal('a=1&b=2');
        });

        it('prevents mutating searchParams', () => {
            const url = new URLPlus('https://example.com/?a=1', undefined, { immutable: true });

            expect(() => {
                url.searchParams.set('a', '2');
            }).to.throw('immutable');
        });

    });

    describe('other mutators are blocked', () => {

        it('prevents protocol mutation', () => {
            const url = new URLPlus('https://example.com/', undefined, { immutable: true });

            expect(() => {
                url.protocol = 'http:';
            }).to.throw('immutable');
        });

        it('prevents hash mutation', () => {
            const url = new URLPlus('https://example.com/#a', undefined, { immutable: true });

            expect(() => {
                url.hash = '#b';
            }).to.throw('immutable');
        });

        it('prevents href replacement', () => {
            const url = new URLPlus('https://example.com/', undefined, { immutable: true });

            expect(() => {
                url.href = 'https://example.org/';
            }).to.throw('immutable');
        });

    });

});
