(function () {

var style = function (el, styles) { return Object.keys(styles).forEach(function (k) { return el.style[k] = styles[k]; }); };

var image = function (src) { return new Promise(function (resolve, reject) {
  var img = new Image();
  img.src = src;
  img.onload = function () { return resolve(img); };
}); };

var colorImage = function (src, color) { return image(src).then(function (img) {
    var canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, 0, 0);
    return canvas;
  }); };


var context = new (window.AudioContext || window.webkitAudioContext);
var globalGain = context.createGain();
globalGain.connect(context.destination);

var gains = [];
var updateGlobalGain = function () {
  var totalGain = gains.reduce(function (a, b) { return a + b; }, 0);
  globalGain.gain.value = Math.min(1, 1/totalGain) || 1;
};
var gainsi = 0;
var getMixer = function () {
  var i = gainsi++;
  gains[i] = 0;
  return function (gain) {
    gains[i] = gain;
    updateGlobalGain();
  };
}

var NOTES = {
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
var NOTEBASE = 4;
var LOWNOTE = NOTES.C;
var NOTERANGE = NOTES.B - NOTES.C;

var parseNote = function (notestr) {
  if (!notestr) return ['C', 4];
  var match = notestr.match(/^(\w[b#]?)(\d*)$/);
  if (!match) return ['C', 4];
  return [match[1], parseInt(match[2]) || 4];
}

var keyboardise = function (el) {
  var width = el.getAttribute('width') || 64;
  var height = el.getAttribute('height') || 64;
  var ref = parseNote(el.getAttribute('note'));
  var notename = ref[0];
  var notebase = ref[1];
  var freq = NOTES[notename] * Math.pow(2, notebase - NOTEBASE);
  var notehue = (NOTES[notename]-LOWNOTE)/NOTERANGE*360;
  var color = "hsl(" + notehue + ", " + (notebase * 13) + "%, " + (70) + "%)";
  var altcolor = "hsl(" + notehue + ", " + (100) + "%, " + (50) + "%)";
  var base = el.getAttribute('base') || '';

  style(el, {
    position: 'relative',
    display: 'inline-block',
    width: (width + "px"),
    height: (height + "px")
  });

  colorImage(base + 'frame.png', color).then(function (canvas) {
    style(canvas, { width: '100%', height: '100%' });
    el.appendChild(canvas);
  });


  var anim = null;
  colorImage(base + 'spinner.png', altcolor).then(function (canvas) {
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

  var osc = context.createOscillator();
  osc.frequency.value = freq;
  osc.start();

  var halfosc = context.createOscillator();
  halfosc.frequency.value = freq/2;
  halfosc.start();

  var quartosc = context.createOscillator();
  quartosc.frequency.value = freq/4;
  quartosc.start();

  var gain = context.createGain();
  gain.gain.value = 0;

  var vibratoosc = context.createOscillator();
  vibratoosc.frequency.value = 1;
  vibratoosc.start();

  var vibratogain = context.createGain();
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

  var mixer = getMixer();

  var speed = 0;
  var oldspeed = speed;
  var MIN_DURATION = 100;
  var offset = 0;

  var updateSpeed = function (newspeed) {
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
    var scale = Math.log2(1 + speed);
    vibratogain.gain.value = scale * 0.1;
    gain.gain.value = scale * 0.233;
    mixer(scale);
  }

  var ACCEL = 0.05;
  var FRICTION = 0.02;
  var STOP = 0.001;

  var holding = false;
  var inside = false;
  var timer = null;

  var startTimer = function () {
    if (timer) return;
    timer = setInterval(function () {
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
  var stopTimer = function () {
    clearInterval(timer);
    timer = null;
  };

  el.addEventListener('click', function () { updateSpeed(speed + ACCEL * 10); startTimer() });
  el.addEventListener('mousedown', function () { holding = true; inside = true; startTimer(); })
  el.addEventListener('touchstart', function () { holding = true; inside = true; startTimer(); })
  window.addEventListener('mousedown', function () { holding = true; })
  window.addEventListener('mouseup', function () { holding = false; })
  window.addEventListener('touchend', function () { holding = false; })
  el.addEventListener('mouseleave', function () { inside = false; })
  el.addEventListener('mouseenter', function (ev) { inside = true; if (holding) startTimer(); })
};


Array.prototype.slice.apply(document.querySelectorAll('singing-key')).forEach(keyboardise);

})();
