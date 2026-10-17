export function playSoftSound(kind: "pop" | "chime") {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;

  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const duration = kind === "chime" ? 0.42 : 0.14;
    const start = context.currentTime;
    oscillator.type = kind === "chime" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(kind === "chime" ? 740 : 520, start);
    oscillator.frequency.exponentialRampToValueAtTime(kind === "chime" ? 1174 : 300, start + duration * 0.7);
    gain.gain.setValueAtTime(kind === "chime" ? 0.055 : 0.035, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
    oscillator.onended = () => void context.close();
  } catch (error) {
    console.info("Audio playback is unavailable in this browser.", error);
  }
}
