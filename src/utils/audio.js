let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Genera un maullido sintético usando Web Audio API.
 * Modula osciladores de triángulo y diente de sierra, barriendo la frecuencia de baja a alta y luego cayendo.
 */
export function playMeow() {
  try {
    initAudio();
    if (!audioCtx) return;

    const t = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';

    const gain1 = audioCtx.createGain();
    const gain2 = audioCtx.createGain();
    gain1.gain.value = 0.8;
    gain2.gain.value = 0.15; // Armónico suave

    osc1.connect(gain1);
    osc2.connect(gain2);

    gain1.connect(filter);
    gain2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Filtro para dar calidez al tono
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(700, t + 0.45);

    // Modulación de frecuencia tipo "Miau"
    const baseFreq = 440; // La4
    osc1.frequency.setValueAtTime(baseFreq * 0.9, t);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.12);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.1, t + 0.45);

    osc2.frequency.setValueAtTime(baseFreq * 1.8, t);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 3.0, t + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, t + 0.45);

    // Envolvente de volumen
    gainNode.gain.setValueAtTime(0.001, t);
    gainNode.gain.linearRampToValueAtTime(0.35, t + 0.08); // ataque rápido (volumen aumentado a 0.35)
    gainNode.gain.setValueAtTime(0.35, t + 0.18);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.45); // caída

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.45);
    osc2.stop(t + 0.45);
  } catch (e) {
    console.warn("Audio Context failed to play meow:", e);
  }
}

/**
 * Sonido de click limpio para colocar marca/cruz.
 */
export function playClick() {
  try {
    initAudio();
    if (!audioCtx) return;

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.06);

    gainNode.gain.setValueAtTime(0.2, t); // volumen aumentado a 0.2
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.06);
  } catch (e) {
    console.warn("Audio Context failed to play click:", e);
  }
}

/**
 * Sonido grave sutil para indicar remoción.
 */
export function playRemove() {
  try {
    initAudio();
    if (!audioCtx) return;

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.08);

    gainNode.gain.setValueAtTime(0.2, t); // volumen aumentado a 0.2
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.08);
  } catch (e) {
    console.warn("Audio Context failed to play remove:", e);
  }
}

/**
 * Sonido arpegiado alegre de victoria.
 */
export function playWin() {
  try {
    initAudio();
    if (!audioCtx) return;

    const t = audioCtx.currentTime;
    // Arpegio de do mayor: Do4, Mi4, Sol4, Do5
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.1;
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gainNode.gain.setValueAtTime(0.001, noteTime);
      gainNode.gain.linearRampToValueAtTime(0.18, noteTime + 0.04); // volumen aumentado a 0.18
      gainNode.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.35);
    });
  } catch (e) {
    console.warn("Audio Context failed to play win:", e);
  }
}

/**
 * Sonido de error sutil cuando se intenta una acción bloqueada.
 */
export function playError() {
  try {
    initAudio();
    if (!audioCtx) return;

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);

    gainNode.gain.setValueAtTime(0.15, t); // volumen aumentado a 0.15
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.12);
  } catch (e) {
    console.warn("Audio Context failed to play error:", e);
  }
}

// Escuchador global de interacciones de usuario para reactivar el contexto de audio
if (typeof window !== 'undefined') {
  const resumeAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };
  window.addEventListener('click', resumeAudio);
  window.addEventListener('touchstart', resumeAudio);
}

