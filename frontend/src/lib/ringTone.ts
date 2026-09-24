/**
 * A phone ring for an incoming group call, drawn with the Web Audio API so no
 * sound file is needed: two short tones, a pause, again, until stopped.
 *
 * A browser may keep it silent until the visitor has clicked somewhere on the
 * page; the ringing screen itself still shows.
 */
let context: AudioContext | null = null;
let timer: number | null = null;

const burst = () => {
  if (!context) return;
  const now = context.currentTime;
  for (const [offset, frequency] of [
    [0, 440],
    [0.45, 480],
  ] as const) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.4);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.42);
  }
};

export function startRingTone() {
  stopRingTone();
  try {
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) return;
    context = new AudioCtor();
    burst();
    timer = window.setInterval(burst, 2500);
  } catch {
    context = null;
  }
}

export function stopRingTone() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  if (context) void context.close().catch(() => undefined);
  context = null;
}
