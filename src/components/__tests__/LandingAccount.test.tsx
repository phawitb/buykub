import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
const auth = vi.hoisted(() => ({ getUser: vi.fn(), onAuthStateChange: vi.fn(), unsubscribe: vi.fn(), listener: null as null | ((event: string, session: unknown) => void) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({auth}) }));
vi.mock('../ProfileMenu', () => ({ ProfileMenu: ({name}: {name:string}) => <span>{name}</span> }));
import { LandingAccount } from '../LandingAccount';
describe('landing account island', () => {
 beforeEach(() => { auth.getUser.mockReset(); auth.onAuthStateChange.mockImplementation((fn) => { auth.listener=fn; return {data:{subscription:{unsubscribe:auth.unsubscribe}}}; }); });
 it('renders a usable login link while account lookup is unresolved', () => {
  auth.getUser.mockReturnValue(new Promise(() => {}));
  render(<LandingAccount/>);
  expect(screen.getByRole('link',{name:'เข้าสู่ระบบ'})).toHaveAttribute('href','/login');
 });
 it('shows verified profile then clears it on sign out', async () => {
  auth.getUser.mockResolvedValue({data:{user:{email:'seller@example.com',user_metadata:{full_name:'Seller'}}}});
  render(<LandingAccount/>);
  expect(await screen.findByText('Seller')).toBeInTheDocument();
  act(() => auth.listener?.('SIGNED_OUT',null));
  await waitFor(() => expect(screen.queryByText('Seller')).not.toBeInTheDocument());
 });
 it('does not restore stale profile when lookup finishes after sign out', async () => {
  let resolve!: (x:unknown)=>void;
  auth.getUser.mockReturnValue(new Promise(r => {resolve=r;}));
  render(<LandingAccount/>);
  act(() => auth.listener?.('SIGNED_OUT',null));
  await act(async () => resolve({data:{user:{user_metadata:{full_name:'Old'}}}}));
  expect(screen.queryByText('Old')).not.toBeInTheDocument();
 });
});
