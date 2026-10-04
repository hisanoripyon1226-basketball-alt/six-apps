// 3D漢字タワー - 敵AI・トラップ・アイテム管理モジュール
class EnemyManager {
  constructor(scene, towerManager) {
    this.scene = scene;
    this.towerManager = towerManager;
    this.enemies = [];
    this.items = [];
    this.initEnemiesAndItems();
  }

  initEnemiesAndItems() {
    // 階層ごとに敵やアイテムを配置
    for (let floor = 3; floor <= 100; floor++) {
      // 敵の出現頻度：階層が上がるほど多彩に
      const plats = this.towerManager.platforms.filter(p => p.floor === floor && p.step > 0 && p.step < 3);

      if (plats.length > 0 && floor % 2 === 0) {
        // 足場1または2にスミまるを配置
        const targetPlat = plats[0];
        this.createSlimeEnemy(targetPlat, floor);
      }

      // 浮遊する鬼火（20階以降、奇数階など）
      if (floor >= 20 && floor % 3 === 0) {
        this.createWispEnemy(floor);
      }

      // 勾玉コインや回復ハートアイテムの配置
      if (plats.length > 1 && floor % 3 === 1) {
        this.createItem(plats[1], floor % 5 === 0 ? 'HEAL' : 'COIN');
      }
    }
  }

  // 墨妖怪「スミまる」の生成
  createSlimeEnemy(plat, floor) {
    const group = new THREE.Group();
    const slimeGeo = new THREE.SphereGeometry(0.65, 12, 10);
    slimeGeo.scale(1.2, 0.9, 1.0);

    const isHighGrade = floor >= 50;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isHighGrade ? 0x800e13 : 0x1d2d44, // 低層は墨色、高層は赤鬼
      roughness: 0.4,
      metalness: 0.1
    });
    const body = new THREE.Mesh(slimeGeo, bodyMat);
    body.position.y = 0.55;
    group.add(body);

    // 目玉（白＋黒目）
    const eyeWhiteGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyePupilGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    for (const side of [-1, 1]) {
      const eyeW = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
      eyeW.position.set(side * 0.28, 0.65, 0.55);
      const eyeP = new THREE.Mesh(eyePupilGeo, eyePupilMat);
      eyeP.position.set(side * 0.28, 0.65, 0.68);
      group.add(eyeW, eyeP);
    }

    // 小さな角
    const hornGeo = new THREE.ConeGeometry(0.12, 0.4, 6);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xf4a261 });
    const horn = new THREE.Mesh(hornGeo, hornMat);
    horn.position.set(0, 1.15, 0);
    group.add(horn);

    group.position.copy(plat.basePos);
    group.position.y += 0.4;
    this.scene.add(group);

    this.enemies.push({
      group,
      plat,
      type: 'SLIME',
      floor,
      dir: 1,
      speed: 1.2 + Math.min(floor * 0.02, 1.5),
      localX: 0,
      range: 1.6,
      alive: true
    });
  }

  // 浮遊鬼火「からす天狗・鬼火」
  createWispEnemy(floor) {
    const group = new THREE.Group();
    const wispGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const wispMat = new THREE.MeshStandardMaterial({
      color: 0x9d4edd,
      emissive: 0x7b2cbf,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.85
    });
    const wisp = new THREE.Mesh(wispGeo, wispMat);
    group.add(wisp);

    const baseAngle = (floor - 1) * 1.35 + 0.6;
    const r = this.towerManager.towerRadius + 2.8;
    const y = floor * this.towerManager.floorHeight + 2.5;

    group.position.set(Math.sin(baseAngle) * r, y, Math.cos(baseAngle) * r);
    this.scene.add(group);

    this.enemies.push({
      group,
      type: 'WISP',
      floor,
      baseY: y,
      baseAngle,
      radius: r,
      alive: true,
      timeOffset: Math.random() * 10
    });
  }

  // アイテム（勾玉・ハート）
  createItem(plat, type) {
    const group = new THREE.Group();
    if (type === 'HEAL') {
      // 薬草・ハート型
      const heartGeo = new THREE.SphereGeometry(0.35, 10, 10);
      const heartMat = new THREE.MeshStandardMaterial({
        color: 0x06d6a0,
        emissive: 0x06d6a0,
        emissiveIntensity: 0.6
      });
      const heart = new THREE.Mesh(heartGeo, heartMat);
      heart.scale.set(1.0, 1.2, 0.8);
      group.add(heart);
    } else {
      // 勾玉コイン
      const torusGeo = new THREE.TorusGeometry(0.35, 0.12, 8, 16);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffd166,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0xffaa00,
        emissiveIntensity: 0.4
      });
      const coin = new THREE.Mesh(torusGeo, goldMat);
      group.add(coin);
    }

    group.position.copy(plat.basePos);
    group.position.y += 1.2;
    this.scene.add(group);

    this.items.push({
      group,
      type,
      floor: plat.floor,
      baseY: group.position.y,
      collected: false
    });
  }

  update(delta, playerY) {
    const time = performance.now() * 0.001;

    // 敵の更新
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      // プレイヤーから遠い敵はスキップ
      if (Math.abs(enemy.group.position.y - playerY) > 25) continue;

      if (enemy.type === 'SLIME') {
        // 足場の接線方向に往復運動
        enemy.localX += enemy.dir * enemy.speed * delta;
        if (enemy.localX > enemy.range) {
          enemy.localX = enemy.range;
          enemy.dir = -1;
        } else if (enemy.localX < -enemy.range) {
          enemy.localX = -enemy.range;
          enemy.dir = 1;
        }

        // 足場の位置と回転を考慮して座標計算
        const tangX = Math.cos(enemy.plat.baseAngle) * enemy.localX;
        const tangZ = -Math.sin(enemy.plat.baseAngle) * enemy.localX;

        enemy.group.position.x = enemy.plat.mesh.position.x + tangX;
        enemy.group.position.z = platToWorldZ(enemy.plat, tangZ);
        enemy.group.position.y = enemy.plat.mesh.position.y + 0.4 + Math.abs(Math.sin(time * 6)) * 0.15; // ぽよぽよ跳ねる
      } else if (enemy.type === 'WISP') {
        // 上下にフワフワ＆円周を旋回
        const curAngle = enemy.baseAngle + Math.sin(time * 1.5 + enemy.timeOffset) * 0.25;
        enemy.group.position.x = Math.sin(curAngle) * enemy.radius;
        enemy.group.position.z = Math.cos(curAngle) * enemy.radius;
        enemy.group.position.y = enemy.baseY + Math.sin(time * 3 + enemy.timeOffset) * 1.2;
        enemy.group.rotation.y += delta * 3;
      }
    }

    // アイテムの回転＆浮遊
    for (const item of this.items) {
      if (item.collected) continue;
      if (Math.abs(item.group.position.y - playerY) > 25) continue;

      item.group.rotation.y += delta * 2.5;
      item.group.position.y = item.baseY + Math.sin(time * 3) * 0.2;
    }
  }

  // 敵の撃破
  killEnemy(enemy) {
    enemy.alive = false;
    // 縮小して消えるアニメーション
    const startScale = enemy.group.scale.x;
    let progress = 0;
    const shrink = () => {
      progress += 0.2;
      const s = THREE.MathUtils.lerp(startScale, 0.01, progress);
      enemy.group.scale.set(s, s, s);
      if (progress < 1) {
        requestAnimationFrame(shrink);
      } else {
        enemy.group.visible = false;
      }
    };
    shrink();
  }

  // アイテム回収
  collectItem(item) {
    item.collected = true;
    item.group.visible = false;
  }
}

function platToWorldZ(plat, tangZ) {
  return plat.mesh.position.z + tangZ;
}

window.EnemyManager = EnemyManager;
