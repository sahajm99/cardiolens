/**
 * Fetch a JSON aggregate from `public/data/`.
 *
 * The path goes through BASE_URL so the same code works at `/` in dev and at
 * `/cardiolens/` on GitHub Pages. The files are content-stable between
 * pipeline runs, so `force-cache` keeps a re-render from hitting the network.
 */
export async function loadJson<T>(name: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}`, {
    cache: "force-cache",
  });
  if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
  return (await res.json()) as T;
}
