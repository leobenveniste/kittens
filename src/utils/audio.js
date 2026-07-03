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
 * Genera un maullido sintético realista ("miau") usando síntesis sustractiva y formántica.
 * Utiliza un oscilador de triángulo, un armónico de sierra, un LFO para vibrato
 * y un filtro pasa-banda resonante para simular la vocalización de la boca.
 */
export function playMeow() {
  try {
    initAudio();
    if (!audioCtx) return;

    const t = audioCtx.currentTime;
    const duration = 0.48; // Duración corta y adorable de 480ms

    // 1. Osciladores
    const osc1 = audioCtx.createOscillator(); // Tono fundamental
    const osc2 = audioCtx.createOscillator(); // Brillo/Armónicos
    osc1.type = 'triangle';
    osc2.type = 'sawtooth';

    // 2. Ganancia individual para mezclar los osciladores
    const gain1 = audioCtx.createGain();
    const gain2 = audioCtx.createGain();
    gain1.gain.value = 0.45;
    gain2.gain.value = 0.07; // Pincelada de armónicos para el carácter "aullado"

    // 3. Vibrato (LFO de 7.5 Hz) para darle un matiz orgánico y tierno
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.frequency.value = 7.5;
    lfoGain.gain.value = 15; // Desafinación sutil (15 Hz)
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    // 4. Filtro de Formantes (Pasa-banda resonante con Q=3.8 para morphing vocal)
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3.8; 
    
    // Barrido del filtro para recrear el sonido "M-ee-ow"
    filter.frequency.setValueAtTime(650, t); // Inicial: Boca casi cerrada "M"
    filter.frequency.exponentialRampToValueAtTime(1950, t + 0.15); // Pico: Boca abierta "ee"
    filter.frequency.exponentialRampToValueAtTime(750, t + duration); // Final: Boca cerrándose "ow"

    // 5. Barrido de tono del maullido (sube levemente y cae al final)
    const baseFreq = 540; // Tono inicial medio-alto (lindo gatito)
    osc1.frequency.setValueAtTime(baseFreq, t);
    osc1.frequency.exponentialRampToValueAtTime(690, t + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(490, t + duration);

    osc2.frequency.setValueAtTime(baseFreq * 2, t);
    osc2.frequency.exponentialRampToValueAtTime(690 * 2, t + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(490 * 2, t + duration);

    // 6. Envolvente de volumen (Gain principal)
    const mainGain = audioCtx.createGain();
    mainGain.gain.setValueAtTime(0.001, t);
    mainGain.gain.linearRampToValueAtTime(0.38, t + 0.05); // Ataque rápido (50ms)
    mainGain.gain.setValueAtTime(0.38, t + 0.16);          // Breve meseta
    mainGain.gain.exponentialRampToValueAtTime(0.001, t + duration); // Caída suave

    // 7. Conexiones
    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(filter);
    gain2.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(audioCtx.destination);

    // 8. Reproducción
    lfo.start(t);
    osc1.start(t);
    osc2.start(t);
    
    lfo.stop(t + duration);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
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

