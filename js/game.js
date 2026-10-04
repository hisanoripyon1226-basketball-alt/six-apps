// 3D漢字タワー - メインゲームコントローラー & 進行管理
class Game {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.state = 'TITLE'; // TITLE, PLAYING, QUIZ, RESULT, GAMEOVER, VICTORY, PAUSE
    this.quizEngine = new window.KanjiQuizEngine(window.KANJI_DATABASE);
    this.audio = new window.AudioManager();

    this.activeQuiz = null;
    this.quizAnswerLocked = false;
    this.combo = 0;
    this.totalKanjiCleared = 0;

    // Three.js 初期化
    this.initThree();

    // マネージャー初期化
    this.tower = new window.TowerManager(this.scene);
    this.enemies = new window.EnemyManager(this.scene, this.tower);
    this.player = new window.Player(this.scene, this.tower, this.audio);

    // カメラの目標位置
    this.camTargetPos = new THREE.Vector3();
    this.camLookAtPos = new THREE.Vector3();

    // セーブデータのロード
    this.loadSaveData();

    // UI要素の参照
    this.initUI();

    // イベントリスナー
    this.setupEventListeners();

    // ゲームループ開始
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x88c4ec);
    this.scene.fog = new THREE.FogExp2(0xcde8f6, 0.008);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
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

    // ライティング
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    this.dirLight.position.set(30, 80, 50);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 200;
    this.dirLight.shadow.camera.left = -30;
    this.dirLight.shadow.camera.right = 30;
    this.dirLight.shadow.camera.top = 30;
    this.dirLight.shadow.camera.bottom = -30;
    this.scene.add(this.dirLight);

    // プレイヤー追従ポイントライト（夜間や暗い階層用）
    this.playerLight = new THREE.PointLight(0xffd166, 1.2, 25);
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

    this.hudHp = document.getElementById('hud-hp');
    this.hudHpText = document.getElementById('hud-hp-text');
    this.hudFloor = document.getElementById('hud-floor');
    this.hudGrade = document.getElementById('hud-grade');
    this.hudScore = document.getElementById('hud-score');
    this.hudCombo = document.getElementById('hud-combo');
  }

  // キーボードイベント（メニュー、クイズ、ショートカット）
  setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      // 共通キー操作
      if (e.code === 'KeyM') {
        const isMuted = this.audio.toggleMute();
        this.showToast(isMuted ? '🔇 サウンドOFF' : '🔊 サウンドON');
        return;
      }

      if (e.code === 'KeyH') {
        this.toggleHelp();
        return;
      }

      // チート/テスト用キー（デバッグ・確認用）
      if (this.state === 'PLAYING') {
        if (e.code === 'KeyN') {
          // 次のフロアへワープ
          this.warpToFloor(this.player.currentFloor + 1);
          return;
        } else if (e.code === 'KeyB') {
          // 前のフロアへワープ
          this.warpToFloor(Math.max(1, this.player.currentFloor - 1));
          return;
        }
      }

      // ステートごとのキー処理
      switch (this.state) {
        case 'TITLE':
          if (e.code === 'Enter' || e.code === 'Space') {
            this.startGame();
          } else if (e.code === 'KeyC') {
            this.continueGame();
          }
          break;

        case 'PLAYING':
          if (e.code === 'Escape' || e.code === 'KeyP') {
            this.pauseGame();
          }
          break;

        case 'PAUSE':
          if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter') {
            this.resumeGame();
          }
          break;

        case 'QUIZ':
          if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].includes(e.code)) {
            const digit = parseInt(e.key, 10);
            if (digit >= 1 && digit <= 4) {
              this.answerQuiz(digit - 1);
            }
          }
          break;

        case 'RESULT':
          if (e.code === 'Enter' || e.code === 'Space') {
            this.proceedAfterQuiz();
          }
          break;

        case 'GAMEOVER':
          if (e.code === 'KeyR' || e.code === 'Enter') {
            this.restartFromCheckpoint();
          }
          break;

        case 'VICTORY':
          if (e.code === 'Enter' || e.code === 'KeyR') {
            this.restartGame();
          }
          break;
      }
    });
  }

  startGame() {
    this.state = 'PLAYING';
    this.uiTitle.classList.add('hidden');
    this.uiHud.classList.remove('hidden');
    this.audio.startBGM();
    this.player.resetToFloor(1);
    this.updateHUD();
  }

  continueGame() {
    this.state = 'PLAYING';
    this.uiTitle.classList.add('hidden');
    this.uiHud.classList.remove('hidden');
    this.audio.startBGM();
    this.player.resetToFloor(this.savedHighestFloor || 1);
    this.updateHUD();
  }

  pauseGame() {
    this.state = 'PAUSE';
    this.uiPause.classList.remove('hidden');
  }

  resumeGame() {
    this.state = 'PLAYING';
    this.uiPause.classList.add('hidden');
  }

  toggleHelp() {
    this.uiHelp.classList.toggle('hidden');
  }

  warpToFloor(floor) {
    if (floor < 1 || floor > 100) return;
    this.player.resetToFloor(floor);
    this.updateEnvironmentByFloor(floor);
    this.showToast(`第 ${floor} 層へワープ！`);
    this.updateHUD();
  }

  // クイズ出題の開始
  triggerQuiz(gate) {
    if (gate.cleared) return;
    this.state = 'QUIZ';
    window.isQuizActive = true;
    this.activeGate = gate;
    this.quizAnswerLocked = false;

    // クイズ生成
    this.activeQuiz = this.quizEngine.generateQuiz(gate.floor);

    // UI表示
    document.getElementById('quiz-floor-badge').textContent = `第 ${gate.floor} 層の試練（小学${this.activeQuiz.grade}年配当）`;
    document.getElementById('quiz-kanji-big').textContent = this.activeQuiz.kanji;
    document.getElementById('quiz-type-badge').textContent = this.activeQuiz.type;
    document.getElementById('quiz-question').textContent = this.activeQuiz.question;
    document.getElementById('quiz-feedback').classList.add('hidden');

    const choicesContainer = document.getElementById('quiz-choices');
    choicesContainer.innerHTML = '';

    this.activeQuiz.choices.forEach((choice, index) => {
      const btn = document.createElement('div');
      btn.className = 'choice-btn';
      btn.innerHTML = `<span class="key-badge">${index + 1}</span> <span class="choice-text">${choice}</span>`;
      choicesContainer.appendChild(btn);
    });

    this.uiQuiz.classList.remove('hidden');
  }

  // クイズ回答処理
  answerQuiz(choiceIndex) {
    if (this.quizAnswerLocked) return;
    this.quizAnswerLocked = true;

    const isCorrect = choiceIndex === this.activeQuiz.correctIndex;
    const feedbackBox = document.getElementById('quiz-feedback');
    const feedbackTitle = document.getElementById('feedback-title');
    const feedbackDetail = document.getElementById('feedback-detail');
    const buttons = document.querySelectorAll('.choice-btn');

    // 選択肢のハイライト
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
      const scoreGain = 500 + this.combo * 100;
      this.player.score += scoreGain;
      this.player.heal(30);
      this.audio.playCorrect();

      feedbackTitle.innerHTML = `<span class="text-correct">✨ 正解！見事なり！ (Combo x${this.combo})</span>`;
      feedbackDetail.innerHTML = `${this.activeQuiz.detail}<br><br><span class="press-enter-guide">【Enter】キーで次の階へ大跳躍！</span>`;

      // 鳥居ゲートを開放
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

  // クイズ後の進行
  proceedAfterQuiz() {
    this.uiQuiz.classList.add('hidden');
    window.isQuizActive = false;

    if (this.activeGate.cleared) {
      if (this.activeGate.floor >= 100) {
        // 100階クリア！全クリエンディング
        this.triggerVictory();
        return;
      }

      // 上昇気流（スーパージャンプ）で次の階層へドカンと飛び上がる！
      this.state = 'PLAYING';
      this.audio.playGateOpen();
      setTimeout(() => {
        this.player.superJump();
      }, 150);
    } else {
      // 不正解の場合は再トライ可能
      this.state = 'PLAYING';
      if (this.player.hp <= 0) {
        this.triggerGameOver();
      }
    }
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
  }

  restartGame() {
    this.uiVictory.classList.add('hidden');
    this.player.hp = 100;
    this.player.score = 0;
    this.player.resetToFloor(1);
    this.state = 'PLAYING';
    this.updateHUD();
  }

  triggerVictory() {
    this.state = 'VICTORY';
    window.isQuizActive = false;
    this.uiVictory.classList.remove('hidden');
    document.getElementById('vic-score').textContent = `最高スコア: ${this.player.score} 点`;
    document.getElementById('vic-kanji').textContent = `習得漢字数: ${this.totalKanjiCleared} 字`;
  }

  // 階層バイオームの環境ライティングと空の更新
  updateEnvironmentByFloor(floor) {
    const themeIdx = Math.min(Math.floor((floor - 1) / 20), 5);
    const theme = this.tower.themeColors[themeIdx];

    this.scene.background.setHex(theme.top);
    this.scene.fog.color.setHex(theme.fog);
    this.dirLight.color.setHex(theme.light);
    this.audio.setThemeByFloor(floor);
  }

  // HUD更新
  updateHUD() {
    const hpRatio = Math.max(0, this.player.hp / this.player.maxHp);
    this.hudHp.style.width = `${hpRatio * 100}%`;
    this.hudHpText.textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;

    if (hpRatio < 0.25) {
      this.hudHp.style.background = 'linear-gradient(90deg, #d90429, #ef233c)';
    } else {
      this.hudHp.style.background = 'linear-gradient(90deg, #06d6a0, #2ec4b6)';
    }

    this.hudFloor.textContent = `第 ${this.player.currentFloor} 層 / 100`;
    const grade = this.quizEngine.getGradeForFloor(this.player.currentFloor);
    this.hudGrade.textContent = `小学${grade}年生配当`;
    this.hudScore.textContent = `${this.player.score}`;

    if (this.combo > 1) {
      this.hudCombo.textContent = `${this.combo} 連続正解!`;
      this.hudCombo.classList.remove('hidden');
    } else {
      this.hudCombo.classList.add('hidden');
    }
  }

  // メインアニメーションループ
  animate() {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.08);

    if (this.state === 'PLAYING') {
      // プレイヤー更新
      this.player.update(delta, this.enemies);

      // 敵・アイテム更新
      this.enemies.update(delta, this.player.y);

      // タワー・足場・パーティクル更新
      this.tower.update(delta, this.player.y, this.player.currentFloor);

      // 環境の更新
      this.updateEnvironmentByFloor(this.player.currentFloor);

      // HP 0 判定
      if (this.player.hp <= 0) {
        this.triggerGameOver();
      }

      // 鳥居ゲート到達判定
      for (const gate of this.tower.gates) {
        if (!gate.cleared && Math.abs(gate.pos.y - this.player.y) < 2.5) {
          const px = Math.sin(this.player.angle) * this.player.radius;
          const pz = Math.cos(this.player.angle) * this.player.radius;
          const dist = Math.hypot(gate.pos.x - px, gate.pos.z - pz);
          if (dist < 2.2) {
            this.triggerQuiz(gate);
            break;
          }
        }
      }

      this.updateHUD();
    }

    // カメラの追従
    this.updateCamera(delta);

    // レンダリング
    this.renderer.render(this.scene, this.camera);
  }

  // ダイナミックカメラ制御（円筒スパイラル追従）
  updateCamera(delta) {
    const px = Math.sin(this.player.angle) * this.player.radius;
    const pz = Math.cos(this.player.angle) * this.player.radius;
    const py = this.player.y;

    this.playerLight.position.set(px, py + 1.5, pz);

    if (this.state === 'QUIZ' || this.state === 'RESULT') {
      // クイズ時は鳥居とプレイヤーを正面からドラマチックに映す
      const gate = this.activeGate;
      if (gate) {
        const camAngle = this.player.angle - 0.25;
        const camRadius = this.player.radius + 6.0;
        const targetCamX = Math.sin(camAngle) * camRadius;
        const targetCamZ = Math.cos(camAngle) * camRadius;
        const targetCamY = py + 2.5;

        this.camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.08);
        this.camera.lookAt(px, py + 1.5, pz);
        return;
      }
    }

    // 通常プレイ時の三人称追従カメラ
    // プレイヤーの少し後方・高めの位置
    const camAngle = this.player.angle - 0.35;
    const camRadius = this.player.radius + 7.5;
    const targetCamX = Math.sin(camAngle) * camRadius;
    const targetCamZ = Math.cos(camAngle) * camRadius;
    const targetCamY = py + 4.2;

    this.camTargetPos.set(targetCamX, targetCamY, targetCamZ);
    this.camera.position.lerp(this.camTargetPos, 0.12);

    // プレイヤーの少し上を見る
    this.camLookAtPos.set(px, py + 1.8, pz);
    this.camera.lookAt(this.camLookAtPos);
  }

  // トースト通知（簡易案内）
  showToast(text) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2200);
  }

  saveProgress() {
    try {
      const data = {
        highestFloor: Math.max(this.savedHighestFloor || 1, this.player.currentFloor),
        score: this.player.score,
        totalKanji: this.totalKanjiCleared
      };
      localStorage.setItem('kanji_tower_save', JSON.stringify(data));
      this.savedHighestFloor = data.highestFloor;
    } catch (e) {}
  }

  loadSaveData() {
    try {
      const raw = localStorage.getItem('kanji_tower_save');
      if (raw) {
        const data = JSON.parse(raw);
        this.savedHighestFloor = data.highestFloor || 1;
        this.totalKanjiCleared = data.totalKanji || 0;
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
