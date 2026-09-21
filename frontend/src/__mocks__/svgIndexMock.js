/**
 * `@/assets/svg` in tests.
 *
 * The real module re-exports every icon through Vite's `?react` suffix, which
 * only Vite understands — Jest cannot even parse it, so any component that
 * imported an icon from it stopped every test file that rendered it. Each name
 * asked for here is an empty component instead; the tests are about behaviour,
 * not about the drawings.
 */
const Icon = () => null;

module.exports = new Proxy(
  { __esModule: true },
  {
    get: (target, name) => (name in target ? target[name] : Icon),
  },
);
