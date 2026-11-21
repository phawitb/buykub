import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ calls: [] as unknown[][], result: {data:null as unknown,error:null as unknown}, results: [] as Array<{data:unknown;error:unknown}>, cacheOptions: [] as unknown[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...args:unknown[])=>unknown, keys: unknown, options: unknown) => {mock.cacheOptions.push({keys,options}); return fn;} }));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({from(table:string) {
 mock.calls.push(['from',table]);
 const q = { select(columns:string) { mock.calls.push(['select',columns]); return q; }, eq(...args:unknown[]) {mock.calls.push(['eq',...args]);return q;}, order(...args:unknown[]) {mock.calls.push(['order',...args]);return q;}, maybeSingle: () => Promise.resolve(mock.result), then(resolve:(value:unknown)=>unknown, reject:(reason:unknown)=>unknown) { mock.calls.push(['run']); return Promise.resolve(mock.results.shift() ?? mock.result).then(resolve,reject); } }; return q;
} }) }));
import { getPublicShop, getPublicProduct, getPublicProducts } from './catalog';
describe('public catalog cache boundaries', () => {
 beforeEach(() => { mock.calls=[]; mock.result={data:null,error:null}; mock.results=[]; });
 it('filters unpublished shops and reads only public fields', async () => {
  await getPublicShop('test');
  expect(mock.calls).toContainEqual(['eq','slug','test']);
  expect(mock.calls).toContainEqual(['eq','published',true]);
  expect(mock.calls.find(c=>c[0]==='select')?.[1]).not.toMatch(/owner_id|bank|promptpay/);
 });
 it('scopes product reads to shop, slug and published status without download paths', async () => {
  await getPublicProduct('shop-1','course');
  expect(mock.calls).toContainEqual(['eq','shop_id','shop-1']);
  expect(mock.calls).toContainEqual(['eq','slug','course']);
  expect(mock.calls).toContainEqual(['eq','published',true]);
  expect(mock.calls.find(c=>c[0]==='select')?.[1]).not.toMatch(/file_path|buyer|content_html/);
 });
 it('throws database failures instead of caching an empty catalog', async () => {
  mock.result={data:null,error:{message:'offline'}};
  await expect(getPublicProducts('shop-1')).rejects.toEqual({message:'offline'});
 });
 it('lists products in the seller arrangement, never-arranged products last and oldest first', async () => {
  mock.result={data:[{id:'a'}],error:null};
  await expect(getPublicProducts('shop-1')).resolves.toEqual([{id:'a'}]);
  expect(mock.calls.filter(c=>c[0]==='order')).toEqual([
   ['order','position',{ascending:true,nullsFirst:false}],
   ['order','created_at',{ascending:true}],
  ]);
 });
 it('falls back to age order on a database without the arrangement column', async () => {
  mock.results=[{data:null,error:{code:'42703',message:'column products.position does not exist'}},{data:[{id:'b'}],error:null}];
  await expect(getPublicProducts('shop-1')).resolves.toEqual([{id:'b'}]);
  expect(mock.calls.filter(c=>c[0]==='run')).toHaveLength(2);
  expect(mock.calls.filter(c=>c[0]==='order').at(-1)).toEqual(['order','created_at',{ascending:true}]);
  expect(mock.calls.filter(c=>c[0]==='order')).toHaveLength(3);
 });
 it('uses bounded shared caching tagged for seller invalidation', () => {
  expect(mock.cacheOptions.length).toBe(3);
  for(const entry of mock.cacheOptions) expect(entry).toMatchObject({options:{revalidate:60,tags:['public-catalog-v1']}});
 });
});
