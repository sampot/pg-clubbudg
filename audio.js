const EFFECTS = {
  click: "./assets/audio/click.ogg",
  stamp: "./assets/audio/stamp.ogg",
  pop: "./assets/audio/pop.ogg",
};

export class CampusAudio {
  constructor() {
    this.enabled = true;
    this.started = false;
    this.music = new Audio("./assets/audio/campus-loop.ogg");
    this.music.loop = true;
    this.music.volume = 0.2;
    this.effects = Object.fromEntries(
      Object.entries(EFFECTS).map(([name, path]) => {
        const sound = new Audio(path);
        sound.volume = name === "stamp" ? 0.58 : 0.4;
        return [name, sound];
      }),
    );
  }

  async start() {
    this.started = true;
    if (!this.enabled) return;
    try {
      await this.music.play();
    } catch {
      // A later explicit interaction may retry playback.
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.music.pause();
    else if (this.started) void this.start();
  }

  play(name) {
    if (!this.enabled || !this.effects[name]) return;
    const sound = this.effects[name];
    sound.currentTime = 0;
    void sound.play().catch(() => {});
  }
}
