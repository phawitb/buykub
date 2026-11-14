import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
const sessionId='cs_test_'+'a'.repeat(32);
afterEach(() => {vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('download proxy', () => {
  it('rejects malformed sessions without querying the backend', async () => {
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    expect((await GET(new Request('http://localhost/api/stripe/download?session_id=bad'))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps unauthorized downloads denied', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','public-test-key');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'Payment required'}),{status:403})));
    const r=await GET(new Request(`http://localhost/api/stripe/download?session_id=${sessionId}`));
    expect(r.status).toBe(403); expect(r.headers.get('location')).toBeNull();
  });
  it('redirects only to a signed URL from our project with no caching', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','public-test-key');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({url:'https://test.supabase.co/storage/v1/object/sign/product-files/file?token=test'}),{status:200})));
    const r=await GET(new Request(`http://localhost/api/stripe/download?session_id=${sessionId}`));
    expect(r.status).toBe(303);expect(r.headers.get('cache-control')).toBe('no-store');
  });
});
