// 3D漢字タワー - Web Audio API サウンドシステム
// 外部音声ファイル一切不要！即時生成＆低遅延サウンド
class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.masterGain = null;
    this.currentTheme = 0; // 0: 昼, 1: 夕, 2: 夜, 3: 嵐, 4: 雪, 5: 頂上

    // 和風ペンタトニックスケール (宮調・陽音階・琉球等)
    this.scales = [
      [261.63, 293.66, 329.63, 392.00, 440.00, 523.25], // C D E G A C (若草の昼)
      [220.00, 261.63, 293.66, 349.23, 392.00, 440.00], // A C D F G A (茜雲の夕)
      [196.00, 220.00, 261.63, 293.66, 392.00, 440.00], // G A C D G A (宵闇・灯籠)
      [146.83, 174.61, 196.00, 220.00, 261.63, 293.66], // D F G A C D (雷鳴・浮遊岩)
      [293.66, 329.63, 369.99, 440.00, 493.88, 587.33], // D E F# A B D (白銀・霊峰)
      [261.63, 329.63, 392.00, 493.88, 523.25, 659.25], // 頂上・祝祭
    ];
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.3, this.ctx.currentTime);
    }
    return this.muted;
  }

  playTone(freq, type, duration, startVol = 0.3, endVol = 0.001) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(startVol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(endVol, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  // 効果音一覧
  playJump() {
    this.init();
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.16);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {}
  }

  playSuperJump() {
    this.init();
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.35);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  playHit() {
    this.init();
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {}
  }

  playDefeat() {
    this.init();
    if (this.muted || !this.ctx) return;
    // 敵を踏んだ音
    this.playTone(330, 'square', 0.08, 0.2);
    setTimeout(() => this.playTone(493, 'sine', 0.12, 0.25), 80);
  }

  playCoin() {
    this.init();
    if (this.muted || !this.ctx) return;
    this.playTone(987.77, 'sine', 0.08, 0.2);
    setTimeout(() => this.playTone(1318.51, 'sine', 0.14, 0.2), 60);
  }

  playHeal() {
    this.init();
    if (this.muted || !this.ctx) return;
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.18, 0.15), idx * 50);
    });
  }

  playCorrect() {
    this.init();
    if (this.muted || !this.ctx) return;
    // 和風チャイム（琴＋鈴風ファンファーレ）
    const chord = [523.25, 659.25, 783.99, 1046.50];
    chord.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.35, 0.2), idx * 60);
    });
  }

  playWrong() {
    this.init();
    if (this.muted || !this.ctx) return;
    this.playTone(180, 'sawtooth', 0.18, 0.25);
    setTimeout(() => this.playTone(140, 'sawtooth', 0.25, 0.25), 180);
  }

  playGateOpen() {
    this.init();
    if (this.muted || !this.ctx) return;
    const notes = [392, 523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.25, 0.18), idx * 45);
    });
  }

  setThemeByFloor(floor) {
    if (floor <= 20) this.currentTheme = 0;
    else if (floor <= 40) this.currentTheme = 1;
    else if (floor <= 60) this.currentTheme = 2;
    else if (floor <= 80) this.currentTheme = 3;
    else if (floor <= 99) this.currentTheme = 4;
    else this.currentTheme = 5;
  }

  // 和風プロシージャルBGM（静かで心地よい音）
  startBGM() {
    if (this.bgmPlaying) return;
    this.init();
    this.bgmPlaying = true;
    this.bgmStep = 0;

    const playNextNote = () => {
      if (!this.bgmPlaying) return;
      if (!this.muted && this.ctx) {
        const scale = this.scales[this.currentTheme] || this.scales[0];
        // 優しいアルペジオパターン
        const patterns = [0, 2, 4, 1, 3, 5, 2, 0];
        const noteIdx = patterns[this.bgmStep % patterns.length];
        const baseFreq = scale[noteIdx % scale.length];

        // 低音ベース音（4小節に1回）
        if (this.bgmStep % 4 === 0) {
          this.playTone(scale[0] / 2, 'triangle', 0.6, 0.15);
        }

        // メロディ音（琴風）
        if (Math.random() > 0.15) {
          const octave = Math.random() > 0.7 ? 2 : 1;
          this.playTone(baseFreq * octave, 'sine', 0.45, 0.08);
        }
      }

      this.bgmStep++;
      this.bgmTimer = setTimeout(playNextNote, 320); // 約94 BPM
    };

    playNextNote();
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

window.AudioManager = AudioManager;
