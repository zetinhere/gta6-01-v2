// input.js — keyboard, mouse and touch. Exposes a keys set, the mouse in
// canvas pixels, edge-triggered presses, and on-screen touch buttons.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouse = { x: 640, y: 360, down: false, clicked: false };
    this.touchActive = false;
    this.touch = { left: false, right: false, gas: false, brake: false, act: false, fire: false };
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 1280;
      this.mouse.y = ((e.clientY - r.top) / r.height) * 720;
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 1280;
      this.mouse.y = ((e.clientY - r.top) / r.height) * 720;
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    // Touch: tap the left half to steer, right side buttons for gas/brake.
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.touchActive = true;
      this._touch(e);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this._touch(e); }, { passive: false });
    canvas.addEventListener('touchend', () => {
      this.touch.left = this.touch.right = this.touch.gas = this.touch.brake = false;
    });
  }
  _touch(e) {
    const r = this.canvas.getBoundingClientRect();
    this.touch.left = this.touch.right = this.touch.gas = this.touch.brake = false;
    for (const t of e.touches) {
      const x = ((t.clientX - r.left) / r.width) * 1280;
      const y = ((t.clientY - r.top) / r.height) * 720;
      if (x < 320 && y > 480) this.touch.left = true;
      else if (x < 640 && y > 480) this.touch.right = true;
      else if (x > 960 && y > 480) this.touch.gas = true;
      else if (x > 640 && x <= 960 && y > 480) this.touch.brake = true;
      else { this.touch.act = true; this.mouse.clicked = true; this.mouse.x = x; this.mouse.y = y; }
    }
  }
  isDown(code) { return this.keys.has(code); }
  pressed(code) { return this.justPressed.has(code); }
  // Call once per frame after the game has read the presses.
  endFrame() {
    this.justPressed.clear();
    this.mouse.clicked = false;
    this.touch.act = false;
  }
}
