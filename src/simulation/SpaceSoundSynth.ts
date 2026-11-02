export class SpaceSoundSynth {
  ctx: AudioContext | null = null;
  isPlaying = false;
  volume = 0.35;
  master: GainNode | null = null;
  droneFilter: BiquadFilterNode | null = null;
  osc1: OscillatorNode | null = null;
  osc2: OscillatorNode | null = null;

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(this.ctx.destination);
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 160;
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sine';
    this.osc1.frequency.value = 38;
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.value = 57;
    this.osc1.connect(this.droneFilter);
    this.osc2.connect(this.droneFilter);
    this.droneFilter.connect(this.master);
    this.osc1.start();
    this.osc2.start();
  }

  toggle(volume = 0.35) {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    this.volume = volume;
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      if (this.isPlaying) {
        this.master.gain.setTargetAtTime(0.0001, now, 0.2);
        this.isPlaying = false;
      } else {
        this.master.gain.setTargetAtTime(volume, now, 0.5);
        this.isPlaying = true;
      }
    }
    return this.isPlaying;
  }

  setVolume(vol: number) {
    this.volume = vol;
    if (this.master && this.isPlaying && this.ctx) {
      this.master.gain.setTargetAtTime(Math.max(0.0001, vol), this.ctx.currentTime, 0.08);
    }
  }

  dispose() {
    if (this.ctx) this.ctx.close();
    this.ctx = null;
  }
}
