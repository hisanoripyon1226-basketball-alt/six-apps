// 3D漢字タワー - プレイヤー操作・超快感アクション物理
class Player {
  constructor(scene, towerManager, audioManager) {
    this.scene = scene;
    this.tower = towerManager;
    this.audio = audioManager;

    this.hp = 100;
    this.maxHp = 100;
    this.score = 0;
    this.currentFloor = 1;
    this.highestFloor = 1;
    this.combo = 0;

    // 物理パラメータ
    this.angle = 0;
    this.radius = this.tower.towerRadius + 3.2;
    this.y = 8.5;
    this.vy = 0;
    this.vAngle = 0;
    this.isGrounded = true;
    this.facingAngle = 0;

    this.invincibleTimer = 0;
    this.respawning = false;

    // キー入力状態
    this.keys = {
      left: false,
      right: false,
      up: false,
      down: false,
      dash: false
    };

    this.mesh = this.createCharacterMesh();
    this.scene.add(this.mesh);

    this.setupKeyboardListeners();
    this.resetToFloor(1);
  }

  // 3Dキャラクターメッシュ（和風忍び・修行者）
  createCharacterMesh() {
    const group = new THREE.Group();

    // 胴体
    const bodyGeo = new THREE.CylinderGeometry(0.38, 0.48, 0.85, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.5 });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 0.7;
    this.bodyMesh.castShadow = true;
    group.add(this.bodyMesh);

    // 帯
    const obiGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.16, 8);
    const obiMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.4 });
    const obi = new THREE.Mesh(obiGeo, obiMat);
    obi.position.y = 0.7;
    group.add(obi);

    // 頭部
    const headGeo = new THREE.SphereGeometry(0.38, 12, 10);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffdfba, roughness: 0.6 });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = 1.4;
    this.headMesh.castShadow = true;
    group.add(this.headMesh);

    // ハチマキ
    const bandGeo = new THREE.CylinderGeometry(0.40, 0.40, 0.12, 12);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xd90429 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 1.45;
    group.add(band);

    // なびくリボン
    const ribbonGeo = new THREE.BoxGeometry(0.14, 0.45, 0.05);
    this.ribbonMesh = new THREE.Mesh(ribbonGeo, bandMat);
    this.ribbonMesh.position.set(0, 1.4, -0.42);
    this.ribbonMesh.rotation.x = 0.4;
    group.add(this.ribbonMesh);

    // 目
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.04, 0.04);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.13, 1.42, 0.35);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.13, 1.42, 0.35);
    group.add(leftEye, rightEye);

    // 両足
    const legGeo = new THREE.CylinderGeometry(0.13, 0.1, 0.5, 6);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1b1b24 });
    this.leftLeg = new THREE.Mesh(legGeo, legMat);
    this.leftLeg.position.set(-0.2, 0.25, 0);
    this.rightLeg = new THREE.Mesh(legGeo, legMat);
    this.rightLeg.position.set(0.2, 0.25, 0);
    group.add(this.leftLeg, this.rightLeg);

    // 両手
    const armGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.5, 6);
    this.leftArm = new THREE.Mesh(armGeo, bodyMat);
    this.leftArm.position.set(-0.5, 0.75, 0);
    this.rightArm = new THREE.Mesh(armGeo, bodyMat);
    this.rightArm.position.set(0.5, 0.75, 0);
    group.add(this.leftArm, this.rightArm);

    return group;
  }

  // キーボードイベントの完全登録（あらゆるブラウザ・OSで確実に反応）
  setupKeyboardListeners() {
    const handleKey = (e, isDown) => {
      if (window.isQuizActive) return;

      const code = e.code || '';
      const key = (e.key || '').toLowerCase();

      if (code === 'ArrowLeft' || code === 'KeyA' || key === 'a' || key === 'arrowleft') {
        this.keys.left = isDown;
      } else if (code === 'ArrowRight' || code === 'KeyD' || key === 'd' || key === 'arrowright') {
        this.keys.right = isDown;
      } else if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space' || key === 'w' || key === ' ' || key === 'arrowup') {
        if (isDown && !this.keys.up && this.isGrounded) {
          this.jump();
        }
        this.keys.up = isDown;
        if (code === 'Space' || key === ' ') e.preventDefault();
      } else if (code === 'ArrowDown' || code === 'KeyS' || key === 's' || key === 'arrowdown') {
        this.keys.down = isDown;
        if (isDown && !this.isGrounded && this.vy > -15) {
          this.vy = -20; // 急降下ヒップドロップ
        }
      } else if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') {
        this.keys.dash = isDown;
      }
    };

    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));
    document.addEventListener('keydown', (e) => handleKey(e, true));
    document.addEventListener('keyup', (e) => handleKey(e, false));
  }

  jump(power = 13.5) {
    this.vy = power;
    this.isGrounded = false;
    this.audio.playJump();
  }

  superJump() {
    this.vy = 26.0;
    this.isGrounded = false;
    this.audio.playSuperJump();
  }

  resetToFloor(floor) {
    this.currentFloor = Math.max(1, Math.min(floor, this.tower.maxFloors));
    this.highestFloor = Math.max(this.highestFloor, this.currentFloor);
    const spawn = this.tower.getFloorSpawnPoint(this.currentFloor);

    this.angle = Math.atan2(spawn.x, spawn.z);
    this.radius = Math.hypot(spawn.x, spawn.z);
    this.y = spawn.y + 0.1;
    this.vy = 0;
    this.vAngle = 0;
    this.isGrounded = true;
    this.respawning = false;

    this.updateMeshPosition();
  }

  takeDamage(amount = 15, knockbackDir = 0) {
    if (this.invincibleTimer > 0) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invincibleTimer = 1.5;
    this.combo = 0;
    this.audio.playHit();

    if (knockbackDir !== 0) {
      this.vAngle = knockbackDir * 0.06;
      this.vy = 6;
    }

    return true;
  }

  heal(amount = 30) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.audio.playHeal();
  }

  // 物理更新＆衝突判定ループ
  update(delta, enemyManager) {
    if (this.respawning) return;
    const dt = Math.min(delta, 0.08);

    // 1. 水平移動速度の即時ダイレクト計算
    const baseSpeed = 0.038;
    const moveSpeed = this.keys.dash ? baseSpeed * 1.6 : baseSpeed;

    let targetVAngle = 0;
    if (this.keys.right) {
      targetVAngle = moveSpeed;
      this.facingAngle = this.angle + Math.PI / 2;
    } else if (this.keys.left) {
      targetVAngle = -moveSpeed;
      this.facingAngle = this.angle - Math.PI / 2;
    }

    // スムーズ加速＆制動
    this.vAngle = THREE.MathUtils.lerp(this.vAngle, targetVAngle, 0.35);
    this.angle += this.vAngle;

    // 2. 垂直方向（重力）
    const gravity = -34.0;
    this.vy += gravity * dt;
    this.y += this.vy * dt;

    // 3. 座標計算
    const px = Math.sin(this.angle) * this.radius;
    const pz = Math.cos(this.angle) * this.radius;
    const playerFeetY = this.y;

    // 4. 足場（Platform）との衝突判定
    let foundGround = false;
    const nearbyPlats = this.tower.platforms.filter(
      p => Math.abs(p.basePos.y - this.y) < 6.5 && p.mesh.visible
    );

    for (const plat of nearbyPlats) {
      const b = plat.bounds;

      if (px >= b.xMin && px <= b.xMax && pz >= b.zMin && pz <= b.zMax) {
        const platTop = plat.mesh.position.y + 0.4;

        // 接地判定
        if (this.vy <= 0 && playerFeetY >= platTop - 0.7 && playerFeetY <= platTop + 0.8) {
          this.y = platTop;
          this.vy = 0;
          this.isGrounded = true;
          foundGround = true;
          this.currentFloor = plat.floor;
          this.highestFloor = Math.max(this.highestFloor, this.currentFloor);

          this.tower.onPlayerStep(plat);

          if (plat.isSpring) {
            this.superJump();
          }

          if (plat.hasSpike && plat.spikeActive) {
            this.takeDamage(15, this.vAngle > 0 ? -1 : 1);
          }
          break;
        }
      }
    }

    if (!foundGround && this.isGrounded && this.vy <= 0) {
      this.isGrounded = false;
    }

    // 5. 落下判定（安全復帰）
    const currentFloorBaseY = this.currentFloor * this.tower.floorHeight;
    if (this.y < currentFloorBaseY - 10) {
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
        if (dist < 1.3) {
          // 上から踏みつけた判定
          if (this.vy < 0 && playerFeetY > enemy.group.position.y + 0.2) {
            enemyManager.killEnemy(enemy);
            this.jump(11.0);
            this.audio.playDefeat();
            this.score += 200;
            break;
          } else {
            const dir = (this.angle - enemy.plat?.baseAngle) > 0 ? 1 : -1;
            this.takeDamage(15, dir);
          }
        }
      }

      // アイテム回収
      for (const item of enemyManager.items) {
        if (item.collected) continue;
        if (Math.abs(item.group.position.y - this.y) > 3) continue;

        const dist = Math.hypot(item.group.position.x - px, item.group.position.z - pz);
        if (dist < 1.4) {
          if (item.type === 'HEAL') {
            this.heal(30);
          } else {
            this.score += 150;
            this.audio.playCoin();
          }
          enemyManager.collectItem(item);
        }
      }
    }

    // 7. 無敵時間の更新＆点滅演出
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      this.mesh.visible = Math.floor(performance.now() / 70) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }

    // 8. メッシュとアニメーション
    this.updateMeshPosition();
    this.animateCharacter(dt);
  }

  updateMeshPosition() {
    const px = Math.sin(this.angle) * this.radius;
    const pz = Math.cos(this.angle) * this.radius;
    this.mesh.position.set(px, this.y, pz);

    if (Math.abs(this.vAngle) > 0.001) {
      this.mesh.rotation.y = this.facingAngle;
    } else {
      this.mesh.rotation.y = this.angle + Math.PI / 2;
    }
  }

  animateCharacter(dt) {
    const isMoving = Math.abs(this.vAngle) > 0.002;
    const animSpeed = this.keys.dash ? 22 : 14;
    const time = performance.now() * 0.001 * animSpeed;

    if (this.isGrounded && isMoving) {
      this.leftLeg.rotation.x = Math.sin(time) * 0.75;
      this.rightLeg.rotation.x = -Math.sin(time) * 0.75;
      this.leftArm.rotation.x = -Math.sin(time) * 0.65;
      this.rightArm.rotation.x = Math.sin(time) * 0.65;
      this.bodyMesh.position.y = 0.7 + Math.abs(Math.sin(time * 2)) * 0.08;
      this.ribbonMesh.rotation.x = 0.4 + Math.sin(time) * 0.25;
    } else if (!this.isGrounded) {
      this.leftLeg.rotation.x = -0.4;
      this.rightLeg.rotation.x = 0.5;
      this.leftArm.rotation.x = -1.2;
      this.rightArm.rotation.x = -1.2;
      this.bodyMesh.position.y = 0.7;
    } else {
      const idleTime = performance.now() * 0.002;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.bodyMesh.position.y = 0.7 + Math.sin(idleTime) * 0.02;
      this.headMesh.position.y = 1.4 + Math.sin(idleTime) * 0.02;
    }
  }
}

window.Player = Player;
