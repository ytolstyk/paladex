/**
 * The texture behind the whole window: material grain, a few hand-made marks and worn edges, all painted by
 * styles/backdrop.css from the active theme's tokens. It is only ever seen through the gaps between panels, and it
 * never moves: three static layers (each with two pseudo-element layers) that are rasterized once.
 */
export function Backdrop(): React.JSX.Element {
  return (
    <div className="backdrop" aria-hidden="true">
      <span className="backdrop__tex" />
      <span className="backdrop__marks" />
      <span className="backdrop__edge" />
    </div>
  )
}
