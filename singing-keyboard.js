(() => {

const style = (el, styles) =>
  Object.keys(styles).forEach(k => el.style[k] = styles[k]);

const image = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.src = src;
  img.onload = () => resolve(img);
});

const colorImage = (src, color) =>
  image(src).then(img => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, 0, 0);
    return canvas;
  });


const context = new (window.AudioContext || window.webkitAudioContext);
const globalGain = context.createGain();
globalGain.connect(context.destination);

const gains = [];
const updateGlobalGain = () => {
  const totalGain = gains.reduce((a, b) => a + b, 0);
  globalGain.gain.value = Math.min(1, 1/totalGain) || 1;
};
let gainsi = 0;
const getMixer = () => {
  const i = gainsi++;
  gains[i] = 0;
  return (gain) => {
    gains[i] = gain;
    updateGlobalGain();
  };
}

const NOTES = {
  C: 261.63,
  'C#': 277.18,
  Db: 277.18,
  D: 293.66,
  'D#': 311.13,
  Eb: 311.13,
  E: 329.63,
  F: 349.23,
  'F#': 369.99,
  Gb: 369.99,
  G: 392.00,
  'G#': 415.30,
  A: 440.00,
  'A#': 466.16,
  Bb: 466.16,
  B: 493.88
}
const NOTEBASE = 4;
const LOWNOTE = NOTES.C;
const NOTERANGE = NOTES.B - NOTES.C;

const parseNote = (notestr) => {
  if (!notestr) return ['C', 4];
  const match = notestr.match(/^(\w[b#]?)(\d*)$/);
  if (!match) return ['C', 4];
  return [match[1], parseInt(match[2]) || 4];
}

const keyboardise = (el) => {
  const width = el.getAttribute('width') || 64;
  const height = el.getAttribute('height') || 64;
  const [notename, notebase] = parseNote(el.getAttribute('note'));
  const freq = NOTES[notename] * Math.pow(2, notebase - NOTEBASE);
  const notehue = (NOTES[notename]-LOWNOTE)/NOTERANGE*360;
  const color = `hsl(${notehue}, ${notebase * 13}%, ${70}%)`;
  const altcolor = `hsl(${notehue}, ${100}%, ${50}%)`;
  const base = el.getAttribute('base') || '';

  style(el, {
    position: 'relative',
    display: 'inline-block',
    width: `${width}px`,
    height: `${height}px`
  });

  colorImage(base + 'frame.png', color).then(canvas => {
    style(canvas, { width: '100%', height: '100%' });
    el.appendChild(canvas);
  });


  let anim = null;
  colorImage(base + 'spinner.png', altcolor).then(canvas => {
    style(canvas, {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%'
    });
    if (canvas.animate) {
      anim = canvas.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-360deg)' }],
        {
          duration: 100,
          iterations: Infinity
        }
      );
      anim.pause();
    }
    el.appendChild(canvas);
  });

  const osc = context.createOscillator();
  osc.frequency.value = freq;
  osc.start();

  const halfosc = context.createOscillator();
  halfosc.frequency.value = freq/2;
  halfosc.start();

  const quartosc = context.createOscillator();
  quartosc.frequency.value = freq/4;
  quartosc.start();

  const gain = context.createGain();
  gain.gain.value = 0;

  const vibratoosc = context.createOscillator();
  vibratoosc.frequency.value = 1;
  vibratoosc.start();

  const vibratogain = context.createGain();
  vibratogain.gain.value = 0;

  vibratoosc.connect(vibratogain);
  vibratogain.connect(gain.gain);

  vibratofreqgain = context.createGain();
  vibratofreqgain.gain.value = -2;

  vibratoosc.connect(vibratofreqgain);
  vibratofreqgain.connect(osc.frequency);

  osc.connect(gain);
  halfosc.connect(gain);
  quartosc.connect(gain);
  gain.connect(globalGain);

  const mixer = getMixer();

  let speed = 0;
  let oldspeed = speed;
  const MIN_DURATION = 100;
  let offset = 0;

  const updateSpeed = (newspeed) => {
    if (newspeed === 0) {
      anim && anim.pause();
    }
    else {
      anim && anim.play();
    }

    speed = Math.min(1, newspeed);

    if (anim) anim.playbackRate = newspeed;

    vibratogain.gain.value = 0.1;
    vibratoosc.frequency.value = 10 * speed;
    const scale = Math.log2(1 + speed);
    vibratogain.gain.value = scale * 0.1;
    gain.gain.value = scale * 0.233;
    mixer(scale);
  }

  const ACCEL = 0.05;
  const FRICTION = 0.02;
  const STOP = 0.001;

  let holding = false;
  let inside = false;
  let timer = null;

  const startTimer = () => {
    if (timer) return;
    timer = setInterval(() => {
      if (holding && inside) {
        updateSpeed(speed + ACCEL);
      }
      else {
        updateSpeed(speed * (1 - FRICTION));
        if (speed < STOP) {
          updateSpeed(0);
          stopTimer();
        }
      }
    }, 100);
  };
  const stopTimer = () => {
    clearInterval(timer);
    timer = null;
  };

  el.addEventListener('click', () => { updateSpeed(speed + ACCEL * 10); startTimer() });
  el.addEventListener('mousedown', () => { holding = true; inside = true; startTimer(); })
  el.addEventListener('touchstart', () => { holding = true; inside = true; startTimer(); })
  window.addEventListener('mousedown', () => { holding = true; })
  window.addEventListener('mouseup', () => { holding = false; })
  window.addEventListener('touchend', () => { holding = false; })
  el.addEventListener('mouseleave', () => { inside = false; })
  el.addEventListener('mouseenter', (ev) => { inside = true; if (holding) startTimer(); })
};


Array.prototype.slice.apply(document.querySelectorAll('singing-key')).forEach(keyboardise);

})();