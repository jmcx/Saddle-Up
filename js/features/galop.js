// galop feature: "Mon Galop 1", a trainer for the first French riding exam. A top-bar button opens it from anywhere, and
// in the club house you can sit at the table to revise. The trainer itself (./galop/app.js) loads on first open; nothing
// runs per frame (the club-house seat is just one more spot for the shared 8 Hz interaction scan).
export function init(SU) {
  let loading = null;
  const open = () => {
    loading ??= import('./galop/app.js');
    loading.then(m => m.openTrainer(SU)).catch(e => { loading = null; console.error('[galop] trainer failed to load', e); SU.toast('Oups, le Galop 1 ne s’ouvre pas', 'bad'); });
  };
  SU.ui.topButton('Galop 1', 'Mon Galop 1 : réviser et s’entraîner', open);
  SU.interact.add({ id: 'galop-seat', label: 'S’asseoir et réviser le Galop 1', icon: '📖', pos: () => SU.world.places.clubhouse?.seat ?? null, radius: 2.2, modes: ['free'], action: open });
  SU.features.galop = { open };
}
