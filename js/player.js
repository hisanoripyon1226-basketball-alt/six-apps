// 3D漢字タワー - プレイヤー操作・物理・アニメーションモジュール
class Player {
  constructor(scene, towerManager, audioManager) {
    this.scene = scene;
    this.tower = towerManager;
    this.audio = audioManager;

    // プレイヤーのステータス
    this.hp = 100;
    this.maxHp = 100;
    this.score = 0;
    this.currentFloor = 1;
    this.highestFloor = 1;
    this.combo = 0;

    // 位置と物理パラメータ
    this.angle = 0; // 塔の周りの角度 (ラジアン)
    this.radius = this.tower.towerRadius + 3.0; // 塔からの半径
    this.y = 8.5; // 初期高度
    this.vy = 0;
    this.vAngle = 0; // 角速度
    this.isGrounded = false;
    this.isCrouching = false;
    this.isDashing = false;
    this.facingAngle = 0; // キャラクターの向き

    // 無敵タイマー
    this.invincibleTimer = 0;
    this.respawning = false;

    // キー入力状態
    this.keys = {
      left: false,
      right: false,
      up: false,
      down: false,
      dash: false,
      jumpPressed: false
    };

    this.mesh = this.createCharacterMesh();
    this.scene.add(this.mesh);

    this.setupKeyboardListeners();
    this.resetToFloor(1);
  }

  // プレイヤーの3Dキャラクターメッシュ（和風忍び・修行者）
  createCharacterMesh() {
    const group = new THREE.Group();

    // 体・胴体
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.8, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.5 });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 0.7;
    this.bodyMesh.castShadow = true;
    group.add(this.bodyMesh);

    // 帯
    const obiGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.15, 8);
    const obiMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.4 });
    const obi = new THREE.Mesh(obiGeo, obiMat);
    obi.position.y = 0.7;
    group.add(obi);

    // 頭部
    const headGeo = new THREE.SphereGeometry(0.35, 12, 10);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdfba, roughness: 0.6 });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = 1.35;
    this.headMesh.castShadow = true;
    group.add(this.headMesh);

    // 額当て（鉢金・ハチマキ）
    const bandGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.1, 12);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xd90429 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 1.4;
    group.add(band);

    // ハチマキのなびくリボン（後ろ）
    const ribbonGeo = new THREE.BoxGeometry(0.12, 0.4, 0.05);
    this.ribbonMesh = new THREE.Mesh(ribbonGeo, bandMat);
    this.ribbonMesh.position.set(0, 1.35, -0.38);
    this.ribbonMesh.rotation.x = 0.4;
    group.add(this.ribbonMesh);

    // 目
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.04, 0.04);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 1.38, 0.33);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 1.38, 0.33);
    group.add(leftEye, rightEye);

    // 両足
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.45, 6);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1b1b24 });
    this.leftLeg = new THREE.Mesh(legGeo, legMat);
    this.leftLeg.position.set(-0.18, 0.22, 0);
    this.rightLeg = new THREE.Mesh(legGeo, legMat);
    this.rightLeg.position.set(0.18, 0.22, 0);
    group.add(this.leftLeg, this.rightLeg);

    // 両手
    const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.45, 6);
    this.leftArm = new THREE.Mesh(armGeo, bodyMat);
    this.leftArm.position.set(-0.45, 0.7, 0);
    this.rightArm = new THREE.Mesh(armGeo, bodyMat);
    this.rightArm.position.set(0.45, 0.7, 0);
    group.add(this.leftArm, this.rightArm);

    return group;
  }

  // キーボードイベントの登録（キーボードのみの快適操作）
  setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      // クイズ中などは移動操作をブロック（UI側で判定）
      if (window.isQuizActive) return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.keys.left = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.keys.right = true;
          break;
        case 'ArrowUp':
        case 'KeyW':
        case 'Space':
          if (!this.keys.jumpPressed && this.isGrounded) {
            this.jump();
          }
          this.keys.up = true;
          this.keys.jumpPressed = true;
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.keys.down = true;
          // 空中で下を押すとヒップドロップ急降下
          if (!this.isGrounded && this.vy > -15) {
            this.vy = -18;
          }
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.dash = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.keys.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.keys.right = false;
          break;
        case 'ArrowUp':
        case 'KeyW':
        case 'Space':
          this.keys.up = false;
          this.keys.jumpPressed = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.keys.down = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.dash = false;
          break;
      }
    });
  }

  jump(power = 12.5) {
    this.vy = power;
    this.isGrounded = false;
    this.audio.playJump();
  }

  superJump() {
    this.vy = 24.0;
    this.isGrounded = false;
    this.audio.playSuperJump();
  }

  // 指定フロアの安全地点へワープ・リスポーン
  resetToFloor(floor) {
    this.currentFloor = Math.max(1, Math.min(floor, this.tower.maxFloors));
    this.highestFloor = Math.max(this.highestFloor, this.currentFloor);
    const spawn = this.tower.getFloorSpawnPoint(this.currentFloor);

    // 角度と高さを算出
    this.angle = Math.atan2(spawn.x, spawn.z);
    this.radius = Math.hypot(spawn.x, spawn.z);
    this.y = spawn.y + 1.0;
    this.vy = 0;
    this.vAngle = 0;
    this.isGrounded = true;
    this.respawning = false;

    this.updateMeshPosition();
  }

  // ダメージ処理
  takeDamage(amount = 15, knockbackDir = 0) {
    if (this.invincibleTimer > 0) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invincibleTimer = 1.5; // 1.5秒間無敵点滅
    this.combo = 0; // コンボリセット
    this.audio.playHit();

    // ノックバック
    if (knockbackDir !== 0) {
      this.vAngle = knockbackDir * 0.05;
      this.vy = 6;
    }

    return true;
  }

  // 回復処理
  heal(amount = 20) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.audio.playHeal();
  }

  // 物理更新＆衝突判定ループ
  update(delta, enemyManager) {
    if (this.respawning) return;

    const dt = Math.min(delta, 0.1);

    // 1. 水平移動入力（角度方向の加速）
    const speedMultiplier = this.keys.dash ? 1.65 : 1.0;
    const accel = 0.09 * speedMultiplier;
    const friction = 0.82;

    if (this.keys.right) {
      this.vAngle += accel * dt * 10;
      this.facingAngle = this.angle + Math.PI / 2;
    } else if (this.keys.left) {
      this.vAngle -= accel * dt * 10;
      this.facingAngle = this.angle - Math.PI / 2;
    }
    this.vAngle *= friction;
    this.angle += this.vAngle;

    // 2. 垂直方向（重力）
    const gravity = -32.0;
    this.vy += gravity * dt;
    this.y += this.vy * dt;

    // 3. 座標計算
    const px = Math.sin(this.angle) * this.radius;
    const pz = Math.cos(this.angle) * this.radius;
    const playerFeetY = this.y;

    // 4. 足場（Platform）との衝突判定
    this.isGrounded = false;

    // プレイヤーの近くにある足場だけ判定
    const nearbyPlats = this.tower.platforms.filter(
      p => Math.abs(p.basePos.y - this.y) < 6.0 && p.mesh.visible
    );

    for (const plat of nearbyPlats) {
      const b = plat.bounds;
      const margin = 1.3;

      // XZ平面での足場当たり判定
      if (px >= b.xMin - margin && px <= b.xMax + margin &&
          pz >= b.zMin - margin && pz <= b.zMax + margin) {

        const platTop = plat.mesh.position.y + 0.35;

        // 足場の上に落ちてきた場合に着地
        if (this.vy <= 0 && playerFeetY >= platTop - 0.5 && playerFeetY <= platTop + 0.8) {
          this.y = platTop;
          this.vy = 0;
          this.isGrounded = true;
          this.currentFloor = plat.floor;
          this.highestFloor = Math.max(this.highestFloor, this.currentFloor);

          // 足場ギミック発動
          this.tower.onPlayerStep(plat);

          // ジャンプ台
          if (plat.isSpring) {
            this.superJump();
          }

          // トゲのダメージ
          if (plat.hasSpike && plat.spikeActive) {
            this.takeDamage(15, this.vAngle > 0 ? -1 : 1);
          }
          break;
        }
      }
    }

    // 5. 落下判定（奈落に落ちた場合、セーフティ復帰）
    const currentFloorBaseY = this.currentFloor * this.tower.floorHeight;
    if (this.y < currentFloorBaseY - 14) {
      // 足場から落ちた！
      this.takeDamage(10);
      this.audio.playHit();
      this.resetToFloor(this.currentFloor);
      return;
    }

    // 6. 敵との衝突判定
    if (enemyManager) {
      for (const enemy of enemyManager.enemies) {
        if (!enemy.alive) continue;
        if (Math.abs(enemy.group.position.y - this.y) > 4) continue;

        const dist = Math.hypot(enemy.group.position.x - px, enemy.group.position.z - pz);
        if (dist < 1.1) {
          // 上から踏みつけた場合（足元が敵の頭上付近で落下中）
          if (this.vy < 0 && playerFeetY > enemy.group.position.y + 0.3) {
            enemyManager.killEnemy(enemy);
            this.jump(10.0); // ポヨンと再跳躍
            this.audio.playDefeat();
            this.score += 150;
            break;
          } else {
            // 横から当たってダメージ
            const dir = (this.angle - enemy.plat?.baseAngle) > 0 ? 1 : -1;
            this.takeDamage(15, dir);
          }
        }
      }

      // アイテム回収判定
      for (const item of enemyManager.items) {
        if (item.collected) continue;
        if (Math.abs(item.group.position.y - this.y) > 3) continue;

        const dist = Math.hypot(item.group.position.x - px, item.group.position.z - pz);
        if (dist < 1.2) {
          if (item.type === 'HEAL') {
            this.heal(25);
          } else {
            this.score += 100;
            this.audio.playCoin();
          }
          enemyManager.collectItem(item);
        }
      }
    }

    // 7. 無敵時間の更新＆点滅演出
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      this.mesh.visible = Math.floor(performance.now() / 80) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // 8. メッシュとアニメーションの更新
    this.updateMeshPosition();
    this.animateCharacter(dt);
  }

  // 3Dメッシュの位置・回転更新
  updateMeshPosition() {
    const px = Math.sin(this.angle) * this.radius;
    const pz = Math.cos(this.angle) * this.radius;
    this.mesh.position.set(px, this.y, pz);

    // キャラクターの向き（走る方向または接線方向）
    if (Math.abs(this.vAngle) > 0.001) {
      this.mesh.rotation.y = this.facingAngle;
    } else {
      this.mesh.rotation.y = this.angle + Math.PI / 2;
    }
  }

  // 手足のプロシージャルアニメーション（走る・ジャンプ）
  animateCharacter(dt) {
    const isMoving = Math.abs(this.vAngle) > 0.002;
    const animSpeed = this.keys.dash ? 18 : 12;
    const time = performance.now() * 0.001 * animSpeed;

    if (this.isGrounded && isMoving) {
      // 走るモーション（手足を前後に振る）
      this.leftLeg.rotation.x = Math.sin(time) * 0.7;
      this.rightLeg.rotation.x = -Math.sin(time) * 0.7;
      this.leftArm.rotation.x = -Math.sin(time) * 0.6;
      this.rightArm.rotation.x = Math.sin(time) * 0.6;
      this.bodyMesh.position.y = 0.7 + Math.abs(Math.sin(time * 2)) * 0.06;
      this.ribbonMesh.rotation.x = 0.4 + Math.sin(time) * 0.2;
    } else if (!this.isGrounded) {
      // ジャンプ空中モーション
      this.leftLeg.rotation.x = -0.4;
      this.rightLeg.rotation.x = 0.5;
      this.leftArm.rotation.x = -1.2;
      this.rightArm.rotation.x = -1.2;
      this.bodyMesh.position.y = 0.7;
    } else {
      // アイドル待機モーション（息づかい）
      const idleTime = performance.now() * 0.002;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.bodyMesh.position.y = 0.7 + Math.sin(idleTime) * 0.02;
      this.headMesh.position.y = 1.35 + Math.sin(idleTime) * 0.02;
    }
  }
}

window.Player = Player;
