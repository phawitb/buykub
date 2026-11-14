import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ calls: [] as unknown[][], result: {data:null as unknown,error:null as unknown}, cacheOptions: [] as unknown[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...args:unknown[])=>unknown, keys: unknown, options: unknown) => {mock.cacheOptions.push({keys,options}); return fn;} }));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({from(table:string) {
 mock.calls.push(['from',table]);
 const q = { select(columns:string) { mock.calls.push(['select',columns]); return q; }, eq(...args:unknown[]) {mock.calls.push(['eq',...args]);return q;}, order(...args:unknown[]) {mock.calls.push(['order',...args]);return Promise.resolve(mock.result);}, maybeSingle: () => Promise.resolve(mock.result) }; return q;
} }) }));
import { getPublicShop, getPublicProduct, getPublicProducts } from './catalog';
describe('public catalog cache boundaries', () => {
 beforeEach(() => { mock.calls=[]; mock.result={data:null,error:null}; });
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
 it('uses bounded shared caching tagged for seller invalidation', () => {
  expect(mock.cacheOptions.length).toBe(3);
  for(const entry of mock.cacheOptions) expect(entry).toMatchObject({options:{revalidate:60,tags:['public-catalog-v1']}});
 });
});
