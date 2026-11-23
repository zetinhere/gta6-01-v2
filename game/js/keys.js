// Santa Brisa Rush — input: keyboard, mouse aim and touch buttons.
// WASD move and drive, E enter/exit a car, F punch, SPACE handbrake,
// mouse aim + click shoot, P pause, M mute, N next taxi job, ENTER confirm.

export function makeInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    handbrake: false,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    touch: false,
    pressed: {},
  };
}

export function bindInput(G, canvas) {
  const input = G.input;
  const down = (e) => {
    if (e.repeat) return;
    input.pressed[e.code] = true;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': input.up = true; break;
      case 'KeyS': case 'ArrowDown': input.down = true; break;
      case 'KeyA': case 'ArrowLeft': input.left = true; break;
      case 'KeyD': case 'ArrowRight': input.right = true; break;
      case 'Space': input.handbrake = true; break;
      default: break;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    G.audio.unlock();
  };
  const up = (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': input.up = false; break;
      case 'KeyS': case 'ArrowDown': input.down = false; break;
      case 'KeyA': case 'ArrowLeft': input.left = false; break;
      case 'KeyD': case 'ArrowRight': input.right = false; break;
      case 'Space': input.handbrake = false; break;
      default: break;
    }
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    G.audio.unlock();
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });

  window.addEventListener('touchstart', () => { input.touch = true; }, { once: true });
}

export function consumePress(G, code) {
  if (G.input.pressed[code]) {
    G.input.pressed[code] = false;
    return true;
  }
  return false;
}

export function clearPresses(G) {
  G.input.pressed = {};
}
