// 3D漢字タワー - メインゲームコントローラー & 学年別学習エンジン
class Game {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.state = 'TITLE'; // TITLE, PLAYING, QUIZ, RESULT, GAMEOVER, VICTORY, PAUSE, ZUKAN
    this.selectedGrade = 1; // 1〜6 (学年), 0 (全学年100層モード)
    this.maxFloorsForMode = 30; // 学年モードなら30層、全学年なら100層

    this.quizEngine = new window.KanjiQuizEngine(window.KANJI_DATABASE);
    this.audio = new window.AudioManager();

    this.activeQuiz = null;
    this.quizAnswerLocked = false;
    this.combo = 0;
    this.totalKanjiCleared = 0;
    this.masteredKanjiSet = new Set();

    // Three.js 初期化
    this.initThree();

    // マネージャー初期化
    this.tower = new window.TowerManager(this.scene);
    this.enemies = new window.EnemyManager(this.scene, this.tower);
    this.player = new window.Player(this.scene, this.tower, this.audio);

    this.camTargetPos = new THREE.Vector3();
    this.camLookAtPos = new THREE.Vector3();

    this.loadSaveData();
    this.initUI();
    this.setupEventListeners();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x88c4ec);
    this.scene.fog = new THREE.FogExp2(0xcde8f6, 0.007);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    this.dirLight.position.set(30, 90, 50);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.scene.add(this.dirLight);

    this.playerLight = new THREE.PointLight(0xffd166, 1.4, 28);
    this.scene.add(this.playerLight);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initUI() {
    this.uiTitle = document.getElementById('title-screen');
    this.uiHud = document.getElementById('hud');
    this.uiQuiz = document.getElementById('quiz-modal');
    this.uiGameOver = document.getElementById('gameover-screen');
    this.uiVictory = document.getElementById('victory-screen');
    this.uiPause = document.getElementById('pause-screen');
    this.uiHelp = document.getElementById('help-modal');
    this.uiZukan = document.getElementById('zukan-modal');

    this.hudHp = document.getElementById('hud-hp');
    this.hudHpText = document.getElementById('hud-hp-text');
    this.hudFloor = document.getElementById('hud-floor');
    this.hudGrade = document.getElementById('hud-grade');
    this.hudScore = document.getElementById('hud-score');
    this.hudCombo = document.getElementById('hud-combo');
  }

  setupEventListeners() {
    // クリック・タッチで確実にフォーカスを当てる
    window.addEventListener('click', () => {
      window.focus();
    });

    // キーボード操作
    window.addEventListener('keydown', (e) => {
      const code = e.code || '';
      const key = (e.key || '').toLowerCase();

      // ミュート切替
      if (code === 'KeyM' || key === 'm') {
        const isMuted = this.audio.toggleMute();
        this.showToast(isMuted ? '🔇 音声OFF' : '🔊 音声ON');
        return;
      }

      // ヘルプ
      if (code === 'KeyH' || key === 'h') {
        this.toggleHelp();
        return;
      }

      // 漢字図鑑手帳
      if (code === 'KeyZ' || key === 'z') {
        this.toggleZukan();
        return;
      }

      // デバッグワープ
      if (this.state === 'PLAYING') {
        if (code === 'KeyN' || key === 'n') {
          this.warpToFloor(this.player.currentFloor + 1);
          return;
        } else if (code === 'KeyB' || key === 'b') {
          this.warpToFloor(Math.max(1, this.player.currentFloor - 1));
          return;
        }
      }

      // ステート別処理
      switch (this.state) {
        case 'TITLE':
          if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6'].includes(code)) {
            const g = parseInt(e.key, 10);
            this.selectGradeAndStart(g);
          } else if (code === 'Digit7' || code === 'Numpad7' || code === 'KeyA') {
            this.selectGradeAndStart(0); // 全学年100層
          } else if (code === 'Enter' || code === 'Space') {
            this.selectGradeAndStart(this.selectedGrade || 1);
          } else if (code === 'KeyC' || key === 'c') {
            this.continueGame();
          }
          break;

        case 'PLAYING':
          if (code === 'Escape' || code === 'KeyP' || key === 'p') {
            this.pauseGame();
          }
          break;

        case 'PAUSE':
          if (code === 'Escape' || code === 'KeyP' || code === 'Enter' || key === 'p') {
            this.resumeGame();
          }
          break;

        case 'QUIZ':
          if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].includes(code)) {
            const digit = parseInt(e.key, 10);
            if (digit >= 1 && digit <= 4) {
              this.answerQuiz(digit - 1);
            }
          }
          break;

        case 'RESULT':
          if (code === 'Enter' || code === 'Space' || key === ' ') {
            this.proceedAfterQuiz();
          }
          break;

        case 'GAMEOVER':
          if (code === 'KeyR' || code === 'Enter' || key === 'r') {
            this.restartFromCheckpoint();
          }
          break;

        case 'VICTORY':
          if (code === 'Enter' || code === 'KeyR' || key === 'r') {
            this.returnToTitle();
          }
          break;

        case 'ZUKAN':
          if (code === 'KeyZ' || code === 'Escape' || code === 'Enter' || key === 'z') {
            this.toggleZukan();
          }
          break;
      }
    });

    // 画面ボタンクリックイベント
    document.querySelectorAll('.grade-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const grade = parseInt(btn.dataset.grade, 10);
        this.selectGradeAndStart(grade);
      });
    });

    const contBtn = document.getElementById('btn-continue-info');
    if (contBtn) {
      contBtn.addEventListener('click', () => this.continueGame());
    }

    // 画面下部のバーチャルタッチボタン（クリック・タッチで直接移動）
    this.bindTouchButton('btn-touch-left', (down) => { this.player.keys.left = down; });
    this.bindTouchButton('btn-touch-right', (down) => { this.player.keys.right = down; });
    this.bindTouchButton('btn-touch-jump', (down) => {
      if (down && this.player.isGrounded) this.player.jump();
      this.player.keys.up = down;
    });
    this.bindTouchButton('btn-touch-dash', (down) => { this.player.keys.dash = down; });
  }

  bindTouchButton(id, callback) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = (e) => { e.preventDefault(); callback(true); window.focus(); };
    const end = (e) => { e.preventDefault(); callback(false); };
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
  }

  // 学年選択してゲーム開始
  selectGradeAndStart(grade) {
    this.selectedGrade = grade;
    this.maxFloorsForMode = grade === 0 ? 100 : 30; // 学年別なら30層、全学年なら100層
    this.state = 'PLAYING';

    this.uiTitle.classList.add('hidden');
    this.uiHud.classList.remove('hidden');
    this.audio.startBGM();

    const gradeText = grade === 0 ? '全学年マスター（100層）' : `小学${grade}年生（全漢字特化モード）`;
    this.showToast(`🎯 【${gradeText}】 スタート！`);

    this.player.resetToFloor(1);
    this.updateHUD();
    window.focus();
  }

  continueGame() {
    this.state = 'PLAYING';
    this.uiTitle.classList.add('hidden');
    this.uiHud.classList.remove('hidden');
    this.audio.startBGM();
    this.player.resetToFloor(this.savedHighestFloor || 1);
    this.updateHUD();
    window.focus();
  }

  pauseGame() {
    this.state = 'PAUSE';
    this.uiPause.classList.remove('hidden');
  }

  resumeGame() {
    this.state = 'PLAYING';
    this.uiPause.classList.add('hidden');
    window.focus();
  }

  toggleHelp() {
    this.uiHelp.classList.toggle('hidden');
  }

  toggleZukan() {
    if (this.uiZukan.classList.contains('hidden')) {
      this.renderZukan();
      this.uiZukan.classList.remove('hidden');
      this.prevZukanState = this.state;
      this.state = 'ZUKAN';
    } else {
      this.uiZukan.classList.add('hidden');
      this.state = this.prevZukanState || 'PLAYING';
      window.focus();
    }
  }

  // 漢字図鑑の描画
  renderZukan() {
    const list = document.getElementById('zukan-grid');
    if (!list) return;
    list.innerHTML = '';

    const mastered = Array.from(this.masteredKanjiSet);
    document.getElementById('zukan-count').textContent = `習得済み漢字: ${mastered.length} / 1026 字`;

    if (mastered.length === 0) {
      list.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 40px;">まだ習得した漢字がありません。塔の試練をクリアして漢字を集めよう！</div>`;
      return;
    }

    mastered.forEach(kanjiChar => {
      const item = this.quizEngine.charMap[kanjiChar];
      if (!item) return;

      const card = document.createElement('div');
      card.className = 'zukan-card';
      const onStr = item.on.join('、') || 'なし';
      const kunStr = item.kun.join('、') || 'なし';
      const compStr = item.compounds && item.compounds.length > 0 ? item.compounds[0][0] : '';

      card.innerHTML = `
        <div class="zk-kanji">${item.k}</div>
        <div class="zk-info">
          <div class="zk-badge">小${item.g}年・${item.s}画</div>
          <div class="zk-reading">音: ${onStr}</div>
          <div class="zk-reading">訓: ${kunStr}</div>
          <div class="zk-comp">${compStr ? `例: ${compStr}` : `部首: ${item.radName}`}</div>
        </div>
      `;
      list.appendChild(card);
    });
  }

  warpToFloor(floor) {
    if (floor < 1 || floor > this.maxFloorsForMode) return;
    this.player.resetToFloor(floor);
    this.updateEnvironmentByFloor(floor);
    this.showToast(`第 ${floor} 層へワープ！`);
    this.updateHUD();
  }

  // クイズ開始
  triggerQuiz(gate) {
    if (gate.cleared) return;
    this.state = 'QUIZ';
    window.isQuizActive = true;
    this.activeGate = gate;
    this.quizAnswerLocked = false;

    // クイズ生成（選択学年または全学年進行）
    this.activeQuiz = this.quizEngine.generateQuiz(gate.floor, this.selectedGrade);

    document.getElementById('quiz-floor-badge').textContent = `第 ${gate.floor} 層の試練（小学${this.activeQuiz.grade}年配当）`;
    document.getElementById('quiz-kanji-big').textContent = this.activeQuiz.kanji;
    document.getElementById('quiz-type-badge').textContent = this.activeQuiz.type;
    document.getElementById('quiz-question').innerHTML = this.activeQuiz.question;
    document.getElementById('quiz-feedback').classList.add('hidden');

    const choicesContainer = document.getElementById('quiz-choices');
    choicesContainer.innerHTML = '';

    this.activeQuiz.choices.forEach((choice, index) => {
      const btn = document.createElement('div');
      btn.className = 'choice-btn';
      btn.innerHTML = `<span class="key-badge">${index + 1}</span> <span class="choice-text">${choice}</span>`;
      btn.addEventListener('click', () => {
        this.answerQuiz(index);
      });
      choicesContainer.appendChild(btn);
    });

    this.uiQuiz.classList.remove('hidden');
    window.focus();
  }

  answerQuiz(choiceIndex) {
    if (this.quizAnswerLocked) return;
    this.quizAnswerLocked = true;

    const isCorrect = choiceIndex === this.activeQuiz.correctIndex;
    const feedbackBox = document.getElementById('quiz-feedback');
    const feedbackTitle = document.getElementById('feedback-title');
    const feedbackDetail = document.getElementById('feedback-detail');
    const buttons = document.querySelectorAll('.choice-btn');

    buttons.forEach((btn, idx) => {
      if (idx === this.activeQuiz.correctIndex) {
        btn.classList.add('correct');
      } else if (idx === choiceIndex) {
        btn.classList.add('wrong');
      }
    });

    if (isCorrect) {
      this.combo++;
      this.totalKanjiCleared++;
      this.masteredKanjiSet.add(this.activeQuiz.kanji);

      const scoreGain = 600 + this.combo * 150;
      this.player.score += scoreGain;
      this.player.heal(35);
      this.audio.playCorrect();

      // コンボ筆文字ランク演出
      let rankText = '【良】';
      if (this.combo >= 8) rankText = '【神】神速正解！';
      else if (this.combo >= 5) rankText = '【極】免許皆伝！';
      else if (this.combo >= 3) rankText = '【秀】見事なり！';

      feedbackTitle.innerHTML = `<span class="text-correct">✨ 正解！ ${rankText} (Combo x${this.combo})</span>`;
      feedbackDetail.innerHTML = `${this.activeQuiz.detail}<br><br><span class="press-enter-guide">【Enter】キーで次の階へ大跳躍！</span>`;

      this.tower.openGate(this.activeGate.floor);
      this.activeGate.cleared = true;
      this.saveProgress();
    } else {
      this.combo = 0;
      this.player.takeDamage(15);
      this.audio.playWrong();

      feedbackTitle.innerHTML = `<span class="text-wrong">⚠️ おしい！不正解…</span>`;
      feedbackDetail.innerHTML = `正解は【${this.activeQuiz.correctIndex + 1}: ${this.activeQuiz.choices[this.activeQuiz.correctIndex]}】でした。<br>${this.activeQuiz.detail}<br><br><span class="press-enter-guide">【Enter】キーで再挑戦！</span>`;
    }

    feedbackBox.classList.remove('hidden');
    this.state = 'RESULT';
    this.updateHUD();
  }

  proceedAfterQuiz() {
    this.uiQuiz.classList.add('hidden');
    window.isQuizActive = false;

    if (this.activeGate.cleared) {
      if (this.activeGate.floor >= this.maxFloorsForMode) {
        this.triggerVictory();
        return;
      }

      this.state = 'PLAYING';
      this.audio.playGateOpen();
      setTimeout(() => {
        this.player.superJump();
      }, 150);
    } else {
      this.state = 'PLAYING';
      if (this.player.hp <= 0) {
        this.triggerGameOver();
      }
    }
    window.focus();
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    window.isQuizActive = false;
    this.uiQuiz.classList.add('hidden');
    this.uiGameOver.classList.remove('hidden');
    document.getElementById('go-floor').textContent = `到達階数: 第 ${this.player.currentFloor} 層`;
    document.getElementById('go-score').textContent = `最終スコア: ${this.player.score}`;
  }

  restartFromCheckpoint() {
    this.uiGameOver.classList.add('hidden');
    this.player.hp = 100;
    this.player.resetToFloor(this.player.currentFloor);
    this.state = 'PLAYING';
    this.updateHUD();
    window.focus();
  }

  returnToTitle() {
    this.uiVictory.classList.add('hidden');
    this.uiHud.classList.add('hidden');
    this.uiTitle.classList.remove('hidden');
    this.state = 'TITLE';
  }

  triggerVictory() {
    this.state = 'VICTORY';
    window.isQuizActive = false;
    this.uiVictory.classList.remove('hidden');

    const gradeText = this.selectedGrade === 0 ? '全学年マスター100層制覇！' : `小学${this.selectedGrade}年生の漢字完全制覇！`;
    document.getElementById('vic-title').textContent = gradeText;
    document.getElementById('vic-score').textContent = `最高スコア: ${this.player.score} 点`;
    document.getElementById('vic-kanji').textContent = `習得漢字数: ${this.masteredKanjiSet.size} 字`;
  }

  updateEnvironmentByFloor(floor) {
    const themeIdx = Math.min(Math.floor((floor - 1) / 20), 5);
    const theme = this.tower.themeColors[themeIdx];

    this.scene.background.setHex(theme.top);
    this.scene.fog.color.setHex(theme.fog);
    this.dirLight.color.setHex(theme.light);
    this.audio.setThemeByFloor(floor);
  }

  updateHUD() {
    const hpRatio = Math.max(0, this.player.hp / this.player.maxHp);
    this.hudHp.style.width = `${hpRatio * 100}%`;
    this.hudHpText.textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;

    if (hpRatio < 0.25) {
      this.hudHp.style.background = 'linear-gradient(90deg, #d90429, #ef233c)';
    } else {
      this.hudHp.style.background = 'linear-gradient(90deg, #06d6a0, #2ec4b6)';
    }

    this.hudFloor.textContent = `第 ${this.player.currentFloor} 層 / ${this.maxFloorsForMode}`;
    const grade = this.selectedGrade === 0 ? this.quizEngine.getGradeForFloor(this.player.currentFloor) : this.selectedGrade;
    this.hudGrade.textContent = `小学${grade}年配当`;
    this.hudScore.textContent = `${this.player.score}`;

    if (this.combo > 1) {
      this.hudCombo.textContent = `${this.combo} 連続正解!`;
      this.hudCombo.classList.remove('hidden');
    } else {
      this.hudCombo.classList.add('hidden');
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.08);

    if (this.state === 'PLAYING') {
      this.player.update(delta, this.enemies);
      this.enemies.update(delta, this.player.y);
      this.tower.update(delta, this.player.y, this.player.currentFloor);
      this.updateEnvironmentByFloor(this.player.currentFloor);

      if (this.player.hp <= 0) {
        this.triggerGameOver();
      }

      for (const gate of this.tower.gates) {
        if (!gate.cleared && Math.abs(gate.pos.y - this.player.y) < 2.5) {
          const px = Math.sin(this.player.angle) * this.player.radius;
          const pz = Math.cos(this.player.angle) * this.player.radius;
          const dist = Math.hypot(gate.pos.x - px, gate.pos.z - pz);
          if (dist < 2.5) {
            this.triggerQuiz(gate);
            break;
          }
        }
      }

      this.updateHUD();
    }

    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(delta) {
    const px = Math.sin(this.player.angle) * this.player.radius;
    const pz = Math.cos(this.player.angle) * this.player.radius;
    const py = this.player.y;

    this.playerLight.position.set(px, py + 1.5, pz);

    if (this.state === 'QUIZ' || this.state === 'RESULT') {
      const camAngle = this.player.angle - 0.25;
      const camRadius = this.player.radius + 6.0;
      const targetCamX = Math.sin(camAngle) * camRadius;
      const targetCamZ = Math.cos(camAngle) * camRadius;
      const targetCamY = py + 2.5;

      this.camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.1);
      this.camera.lookAt(px, py + 1.5, pz);
      return;
    }

    const camAngle = this.player.angle - 0.35;
    const camRadius = this.player.radius + 7.5;
    const targetCamX = Math.sin(camAngle) * camRadius;
    const targetCamZ = Math.cos(camAngle) * camRadius;
    const targetCamY = py + 4.2;

    this.camTargetPos.set(targetCamX, targetCamY, targetCamZ);
    this.camera.position.lerp(this.camTargetPos, 0.15);

    this.camLookAtPos.set(px, py + 1.8, pz);
    this.camera.lookAt(this.camLookAtPos);
  }

  showToast(text) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2400);
  }

  saveProgress() {
    try {
      const data = {
        highestFloor: Math.max(this.savedHighestFloor || 1, this.player.currentFloor),
        score: this.player.score,
        mastered: Array.from(this.masteredKanjiSet)
      };
      localStorage.setItem('kanji_tower_save_v2', JSON.stringify(data));
      this.savedHighestFloor = data.highestFloor;
    } catch (e) {}
  }

  loadSaveData() {
    try {
      const raw = localStorage.getItem('kanji_tower_save_v2');
      if (raw) {
        const data = JSON.parse(raw);
        this.savedHighestFloor = data.highestFloor || 1;
        if (Array.isArray(data.mastered)) {
          data.mastered.forEach(k => this.masteredKanjiSet.add(k));
        }
        const contBtn = document.getElementById('btn-continue-info');
        if (contBtn && this.savedHighestFloor > 1) {
          contBtn.textContent = `【C】つづきから（第 ${this.savedHighestFloor} 層〜）`;
          contBtn.classList.remove('hidden');
        }
      }
    } catch (e) {}
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
