import { Injectable, signal } from '@angular/core';

/**
 * Zvuci generisani preko WebAudio-a (bez fajlova): "klak" kružića i zveckanje kockica.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  readonly enabled = signal(true);
  private ctx?: AudioContext;
  private noise?: AudioBuffer;

  private audio(): AudioContext | null {
    if (!this.enabled()) return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const len = Math.floor(this.ctx.sampleRate * 0.2);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Kratak drveni "klak" - kružić pada na tablu. */
  clack(intensity = 1, delay = 0): void {
    const ctx = this.audio();
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime + delay;
    const pitch = 0.9 + Math.random() * 0.2;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2200 * pitch;
    band.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * intensity, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(band).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.1);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.35 * intensity, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(og).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /** Zveckanje kockica - niz brzih tihih udaraca. */
  rattle(duration = 0.7): void {
    if (!this.audio()) return;
    let t = 0;
    while (t < duration) {
      this.clack(0.25 + Math.random() * 0.35 * (1 - t / duration), t);
      t += 0.035 + Math.random() * 0.07;
    }
  }

  toggle(): void {
    this.enabled.update((v) => !v);
  }
}
