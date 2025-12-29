import { expect } from 'chai';
import { URLSearchParamsPlus } from '../src/URLSearchParamsPlus.js';

describe('constructor normalization', () => {

    it('accepts query string', () => {
        const p = new URLSearchParamsPlus('?a=1&b=2');
        expect(p.get('a')).to.equal(1);
        expect(p.get('b')).to.equal(2);
    });

    it('accepts entries array', () => {
        const p = new URLSearchParamsPlus([['a', 1], ['b', 2]]);
        expect(p.get('a')).to.equal(1);
        expect(p.get('b')).to.equal(2);
    });

    it('accepts plain object', () => {
        const p = new URLSearchParamsPlus({ a: 1, b: 2 });
        expect(p.get('a')).to.equal(1);
        expect(p.get('b')).to.equal(2);
    });

    it('accepts URLSearchParams', () => {
        const native = new URLSearchParams('a=1&b=2');
        const p = new URLSearchParamsPlus(native);
        expect(p.get('a')).to.equal(1);
        expect(p.get('b')).to.equal(2);
    });

    it('accepts URLSearchParamsPlus (re-rooted)', () => {
        const p1 = new URLSearchParamsPlus('a[b]=1');
        const p2 = new URLSearchParamsPlus(p1);

        p2.set('a[c]', 2);

        expect(p1.get('a[c]')).to.be.null; // no shared tree
        expect(p2.get('a[b]')).to.equal(1);
        expect(p2.get('a[c]')).to.equal(2);
    });

});

describe('path addressing', () => {

    it('supports deep object paths', () => {
        const p = new URLSearchParamsPlus();
        p.set('a[b][c]', 1);
        expect(p.get('a[b][c]')).to.equal(1);
    });

    it('supports array paths', () => {
        const p = new URLSearchParamsPlus();
        p.append('a[]', 1);
        p.append('a[]', 2);

        expect(p.getAll('a')).to.eql([1, 2]);
    });

    it('supports mixed object/array nesting', () => {
        const p = new URLSearchParamsPlus();
        p.append('a[b][]', 1);
        p.append('a[b][]', 2);

        const b = p.get('a[b]');
        expect(Array.isArray(b)).to.equal(true);
        expect(b.map(x => x)).to.eql([1, 2]);
    });

});

describe('get() wrapping semantics', () => {

    it('wraps object subtrees', () => {
        const p = new URLSearchParamsPlus('a[b]=1');
        const a = p.get('a');

        expect(a).to.be.instanceOf(URLSearchParamsPlus);
        expect(a.get('b')).to.equal(1);
    });

    it('wraps arrays of objects individually', () => {
        const p = new URLSearchParamsPlus();
        p.append('a[]', { x: 1 });
        p.append('a[]', { x: 2 });

        const arr = p.get('a');
        expect(Array.isArray(arr)).to.equal(true);
        expect(arr[0]).to.be.instanceOf(URLSearchParamsPlus);
        expect(arr[0].get('x')).to.equal(1);
    });

    it('returns primitives as-is', () => {
        const p = new URLSearchParamsPlus('a=1');
        expect(p.get('a')).to.equal(1);
    });

});

describe('mutation methods', () => {

    it('set overwrites existing value', () => {
        const p = new URLSearchParamsPlus('a=1');
        p.set('a', 2);
        expect(p.get('a')).to.equal(2);
    });

    it('append converts scalar to array', () => {
        const p = new URLSearchParamsPlus();
        p.append('a', 1);
        p.append('a', 2);
        expect(p.getAll('a')).to.eql([1, 2]);
    });

    it('delete removes key', () => {
        const p = new URLSearchParamsPlus('a=1&b=2');
        p.delete('a');
        expect(p.has('a')).to.equal(false);
        expect(p.get('a')).to.be.null;
    });

});

describe('iteration & size', () => {

    it('iterates like URLSearchParams', () => {
        const p = new URLSearchParamsPlus('a=1&b=2');
        expect([...p]).to.eql([
            ['a', 1],
            ['b', 2]
        ]);
    });

    it('keys(), values(), entries() work', () => {
        const p = new URLSearchParamsPlus('a=1&b=2');
        expect([...p.keys()]).to.eql(['a', 'b']);
        expect([...p.values()]).to.eql([1, 2]);
    });

    it('size reflects flattened entries', () => {
        const p = new URLSearchParamsPlus('a[b]=1&a[c]=2');
        expect(p.size).to.equal(2);
    });

});

describe('sorting semantics', () => {

    it('does not mutate internal order', () => {
        const p = new URLSearchParamsPlus('b=2&a=1');
        const before = p.toString();

        p.sort();
        const after = p.toString();

        expect(before).to.equal('b=2&a=1');
        expect(after).to.equal('a=1&b=2');
    });

});

describe('serialization & proxy safety', () => {

    it('json returns plain object', () => {
        const p = new URLSearchParamsPlus('a[b]=1');
        const json = p.json();

        expect(json).to.eql({ a: { b: 1 } });
        expect(Object.getPrototypeOf(json)).to.equal(Object.prototype);
    });

    it('mutating json output should affect instance', () => {
        const p = new URLSearchParamsPlus('a=1');
        const json = p.json();

        json.a = 2;
        expect(p.get('a')).to.equal(2);
    });

});
