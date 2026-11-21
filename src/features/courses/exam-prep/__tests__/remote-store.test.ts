import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRemoteStore, SAVE_DELAY_MS } from "../remote-store";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn();
beforeEach(() => { localStorage.clear(); fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const bodyOf = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body);

it("answers loads synchronously from this device and debounces saves", async () => {
  const store = createRemoteStore("p", { accept: () => true });
  expect(store.load()).toBeNull();
  fetchMock.mockImplementation(async () => json({ updated_at: "v1" }));
  store.save({ updatedAt: 1 });
  store.save({ updatedAt: 2 });
  expect(store.load()).toEqual({ updatedAt: 2 });
  expect(store.status()).toBe("pending");
  await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(bodyOf(0)).toEqual({ state: { updatedAt: 2 }, base: null });
  expect(store.status()).toBe("saved");
  // The next save is based on the version the server just issued.
  store.save({ updatedAt: 3 });
  await store.flush();
  expect(bodyOf(1).base).toBe("v1");
});

it("survives a reload with unsent progress and sends it on the next pull", async () => {
  const closed = createRemoteStore("p", { accept: () => true });
  closed.save({ updatedAt: 5, att: { a: 1 } });
  closed.dispose(); // the tab closed before the debounce fired
  const again = createRemoteStore("p", { accept: () => true });
  expect(again.load()).toEqual({ updatedAt: 5, att: { a: 1 } });
  fetchMock.mockResolvedValueOnce(json({ state: { updatedAt: 1 }, updated_at: "old" })).mockResolvedValueOnce(json({ updated_at: "new" }));
  expect(await again.pull()).toBeNull(); // local is newer, so nothing to show
  await vi.runAllTimersAsync();
  expect(bodyOf(1)).toEqual({ state: { updatedAt: 5, att: { a: 1 } }, base: "old" });
});

it("takes a newer copy from another device", async () => {
  const store = createRemoteStore("p", { accept: () => true });
  store.save({ updatedAt: 1 });
  fetchMock.mockResolvedValueOnce(json({ state: { updatedAt: 9 }, updated_at: "v9" }, 409));
  await store.flush();
  expect(store.load()).toEqual({ updatedAt: 9 });
  expect(store.status()).toBe("saved");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("keeps this device's copy when the engine is busy and resends it on the server's version", async () => {
  const store = createRemoteStore("p", { accept: () => false });
  store.save({ updatedAt: 1 });
  fetchMock.mockResolvedValueOnce(json({ state: { updatedAt: 9 }, updated_at: "v9" }, 409)).mockResolvedValueOnce(json({ updated_at: "v10" }));
  await store.flush();
  expect(store.load()).toEqual({ updatedAt: 1 });
  expect(bodyOf(1)).toEqual({ state: { updatedAt: 1 }, base: "v9" });
  expect(store.status()).toBe("saved");
});

it("gives up after three conflicts and stays pending", async () => {
  const store = createRemoteStore("p", { accept: () => false });
  store.save({ updatedAt: 1 });
  fetchMock.mockImplementation(async () => json({ state: { updatedAt: 9 }, updated_at: "v9" }, 409));
  await store.flush();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(store.status()).toBe("pending");
});

it("reports offline and keeps progress on this device", async () => {
  const onStatus = vi.fn();
  const store = createRemoteStore("p", { accept: () => true, onStatus });
  store.save({ updatedAt: 1 });
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  await store.flush({ keepalive: true });
  expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
  expect(store.status()).toBe("offline");
  expect(onStatus).toHaveBeenLastCalledWith("offline");
  expect(createRemoteStore("p", { accept: () => true }).load()).toEqual({ updatedAt: 1 });
});

it("stops sending once disposed", async () => {
  const store = createRemoteStore("p", { accept: () => true });
  store.save({ updatedAt: 1 });
  store.dispose();
  await vi.runAllTimersAsync();
  expect(fetchMock).not.toHaveBeenCalled();
});
