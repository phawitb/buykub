import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExamPrepClassroom } from "../ExamPrepClassroom";

const id = "12345678-1234-4123-8123-123456789abc";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchMock = vi.fn();
const mount = vi.fn();
const destroy = vi.fn();

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset(); mount.mockReset(); destroy.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  let state = {};
  mount.mockImplementation((root: HTMLElement) => { root.textContent = "engine"; return { getState: () => state, setState: (next: object) => { state = next; }, destroy }; });
  window.ExamPrep = { mount };
  delete document.documentElement.dataset.theme;
});
afterEach(() => { vi.unstubAllGlobals(); delete window.ExamPrep; });

const routes = (pack: Response) => fetchMock.mockImplementation(async (url: string) =>
  url.endsWith("/pack") ? pack : json({ state: { updatedAt: 7, att: { M001: 1 } }, updated_at: "v1" }));

it("mounts the engine with the paid pack after pulling saved progress", async () => {
  routes(json({ format: "exam-prep", id: "nst30" }));
  render(<ExamPrepClassroom productId={id} name="NST" expiresAt="2026-12-21T00:00:00Z" owner={false} />);
  await waitFor(() => expect(mount).toHaveBeenCalled());
  const [root, pack, options] = mount.mock.calls[0];
  expect(root.textContent).toBe("engine");
  expect(pack).toEqual({ format: "exam-prep", id: "nst30" });
  expect(options.store.load()).toEqual({ updatedAt: 7, att: { M001: 1 } });
  expect(options.mascot).toBe("/exam-prep/mascot.png");
  expect(fetchMock).toHaveBeenCalledWith(`/api/courses/${id}/pack`, { cache: "no-store" });
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(screen.getByRole("status")).toHaveTextContent("บันทึกความคืบหน้าแล้ว");
  expect(screen.queryByText("แก้ไขคอร์ส")).not.toBeInTheDocument();
});

it("offers a retry when the pack cannot be loaded, without mounting", async () => {
  routes(json({ error: "x" }, 403));
  render(<ExamPrepClassroom productId={id} name="NST" expiresAt={null} owner />);
  expect(await screen.findByRole("alert")).toHaveTextContent("เปิดห้องเรียนไม่สำเร็จ");
  expect(mount).not.toHaveBeenCalled();
  expect(screen.getByText("แก้ไขคอร์ส")).toBeInTheDocument();
  routes(json({ format: "exam-prep" }));
  fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));
  await waitFor(() => expect(mount).toHaveBeenCalledTimes(1));
});

it("restores the page theme and destroys the engine on leave", async () => {
  document.documentElement.dataset.theme = "dark";
  routes(json({ format: "exam-prep" }));
  const view = render(<ExamPrepClassroom productId={id} name="NST" expiresAt={null} owner={false} />);
  await waitFor(() => expect(mount).toHaveBeenCalled());
  act(() => view.unmount());
  expect(destroy).toHaveBeenCalled();
  expect(document.documentElement.dataset.theme).toBe("dark");
});
