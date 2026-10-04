// 3D漢字タワー - 塔＆ステージ構築モジュール (超安定アスレチック版)
class TowerManager {
  constructor(scene) {
    this.scene = scene;
    this.platforms = [];
    this.gates = [];
    this.gimmicks = [];
    this.particles = null;
    this.towerHeight = 850;
    this.towerRadius = 14;
    this.floorHeight = 7.5;
    this.maxFloors = 100;
    this.towerMesh = null;
    this.themeColors = [
      { top: 0x88c4ec, bottom: 0xe0f7fa, fog: 0xcde8f6, light: 0xffffff, pColor: 0xffb7c5 }, // 1-20F 昼桜
      { top: 0xe65100, bottom: 0xffcc80, fog: 0xffb74d, light: 0xffd54f, pColor: 0xd84315 }, // 21-40F 夕紅葉
      { top: 0x0d1b2a, bottom: 0x1b263b, fog: 0x1b263b, light: 0x8ecae6, pColor: 0x64dfdf }, // 41-60F 宵闇蛍
      { top: 0x240046, bottom: 0x3c096c, fog: 0x5a189a, light: 0x9d4edd, pColor: 0x7b2cbf }, // 61-80F 雷鳴嵐
      { top: 0xdfe7fd, bottom: 0xa3b18a, fog: 0xd8e2dc, light: 0xfefae0, pColor: 0xffffff }, // 81-99F 霊峰雪
      { top: 0xffd700, bottom: 0xffa500, fog: 0xffe066, light: 0xfffae0, pColor: 0xffd700 }  // 100F 黄金宮
    ];

    this.initTowerStructure();
    this.initAllFloors();
    this.initWeatherParticles();
  }

  // 中央の巨大な古塔（八角柱＋多層庇屋根）
  initTowerStructure() {
    const towerGeo = new THREE.CylinderGeometry(this.towerRadius, this.towerRadius + 2.5, this.towerHeight, 8, 40);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x2d3142,
      roughness: 0.85,
      metalness: 0.15,
      flatShading: true
    });
    this.towerMesh = new THREE.Mesh(towerGeo, towerMat);
    this.towerMesh.position.y = this.towerHeight / 2 - 10;
    this.towerMesh.receiveShadow = true;
    this.scene.add(this.towerMesh);

    // 塔の装飾リング（帯屋根）
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c24,
      roughness: 0.6,
      metalness: 0.2
    });
    for (let f = 5; f <= this.maxFloors; f += 5) {
      const ringGeo = new THREE.CylinderGeometry(this.towerRadius + 1.4, this.towerRadius + 0.8, 1.0, 8);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = f * this.floorHeight;
      this.scene.add(ring);
    }

    // 雲海
    const cloudGeo = new THREE.RingGeometry(this.towerRadius + 1, 140, 32);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const bottomCloud = new THREE.Mesh(cloudGeo, cloudMat);
    bottomCloud.rotation.x = -Math.PI / 2;
    bottomCloud.position.y = -2;
    this.scene.add(bottomCloud);

    // 頂上（100F）の黄金天守
    const roofGeo = new THREE.ConeGeometry(this.towerRadius + 5, 14, 8);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.2
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = this.maxFloors * this.floorHeight + 15;
    this.scene.add(roof);
  }

  // 100層すべての足場・ギミック・鳥居ゲートを安定配置
  initAllFloors() {
    for (let floor = 1; floor <= this.maxFloors; floor++) {
      const baseAngle = (floor - 1) * 1.35;
      const baseHeight = floor * this.floorHeight;
      const numPlats = floor === 100 ? 1 : 4;

      if (floor === 100) {
        // 頂上ステージ（広大な円形神殿）
        const topStageGeo = new THREE.CylinderGeometry(20, 20, 2.0, 32);
        const topStageMat = new THREE.MeshStandardMaterial({
          color: 0xf5f3e9,
          metalness: 0.4,
          roughness: 0.3
        });
        const topStage = new THREE.Mesh(topStageGeo, topStageMat);
        topStage.position.set(0, baseHeight, 0);
        topStage.receiveShadow = true;
        this.scene.add(topStage);

        this.platforms.push({
          mesh: topStage,
          type: 'TOP',
          floor: 100,
          basePos: new THREE.Vector3(0, baseHeight, 0),
          baseAngle: 0,
          radius: 0,
          isMoving: false,
          isCrumble: false,
          isSpring: false,
          hasSpike: false,
          bounds: { xMin: -20, xMax: 20, yMin: baseHeight - 0.5, yMax: baseHeight + 2.0, zMin: -20, zMax: 20 },
          isTop: true
        });

        this.createKanjiGate(0, baseHeight, -(this.towerRadius + 2.5), 0, floor, true);
        continue;
      }

      // 各階層の足場群（ゆったり幅広で走りやすい設計）
      for (let p = 0; p < numPlats; p++) {
        const angle = baseAngle + p * 0.32;
        const radius = this.towerRadius + 3.2;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const y = baseHeight + p * 1.5;

        // スタート足場(p=0)は幅広テラス
        const isStart = (p === 0);
        const width = isStart ? 6.8 : 5.4;
        const depth = 4.2;
        const platGeo = new THREE.BoxGeometry(width, 0.8, depth);

        let platType = 'NORMAL';
        let platColor = this.getPlatformColor(floor);

        let isMoving = false;
        let isCrumble = false;
        let isSpring = false;
        let hasSpike = false;

        if (p === 1 && floor >= 10 && floor % 3 === 0) {
          platType = 'MOVING';
          isMoving = true;
          platColor = 0x4cc9f0;
        } else if (p === 2 && floor >= 20 && floor % 4 === 0) {
          platType = 'CRUMBLE';
          isCrumble = true;
          platColor = 0xf72585;
        } else if (p === 2 && floor % 5 === 0) {
          platType = 'SPRING';
          isSpring = true;
          platColor = 0x7209b7;
        } else if (p === 1 && floor >= 25 && floor % 6 === 0) {
          hasSpike = true;
        }

        const mat = new THREE.MeshStandardMaterial({
          color: platColor,
          roughness: 0.65,
          metalness: 0.15
        });
        const platMesh = new THREE.Mesh(platGeo, mat);
        platMesh.position.set(x, y, z);
        platMesh.rotation.y = angle + Math.PI / 2;
        platMesh.receiveShadow = true;
        platMesh.castShadow = true;
        this.scene.add(platMesh);

        // ジャンプ台マーク
        if (isSpring) {
          const padGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.25, 16);
          const padMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffaa00, emissiveIntensity: 0.6 });
          const pad = new THREE.Mesh(padGeo, padMat);
          pad.position.y = 0.5;
          platMesh.add(pad);
        }

        // トゲ罠
        if (hasSpike) {
          const spikeGeo = new THREE.ConeGeometry(0.3, 0.8, 6);
          const spikeMat = new THREE.MeshStandardMaterial({ color: 0xd90429, metalness: 0.8 });
          const spikeMesh = new THREE.Group();
          for (let s = -1.2; s <= 1.2; s += 0.8) {
            const sp = new THREE.Mesh(spikeGeo, spikeMat);
            sp.position.set(s, 0.45, 0);
            spikeMesh.add(sp);
          }
          platMesh.add(spikeMesh);
        }

        const platObj = {
          mesh: platMesh,
          type: platType,
          floor,
          step: p,
          basePos: new THREE.Vector3(x, y, z),
          baseAngle: angle,
          radius,
          width,
          depth,
          isMoving,
          isCrumble,
          isSpring,
          hasSpike,
          crumbleTimer: 0,
          crumbleState: 'idle',
          spikeTimer: Math.random() * Math.PI,
          bounds: {
            xMin: x - width * 0.65, xMax: x + width * 0.65,
            yMin: y - 0.6, yMax: y + 0.8,
            zMin: z - depth * 0.65, zMax: z + depth * 0.65
          }
        };

        this.platforms.push(platObj);

        // 最後の足場に鳥居ゲート
        if (p === numPlats - 1) {
          this.createKanjiGate(x, y, z, angle, floor);
        }
      }
    }
  }

  // 漢字鳥居ゲートの生成
  createKanjiGate(x, y, z, angle, floor, isBoss = false) {
    const gateGroup = new THREE.Group();
    gateGroup.position.set(x, y + 0.4, z);
    gateGroup.rotation.y = angle + Math.PI / 2;

    const redMat = new THREE.MeshStandardMaterial({
      color: isBoss ? 0xffd700 : 0xd90429,
      metalness: isBoss ? 0.7 : 0.2,
      roughness: 0.3
    });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });

    // 柱2本
    const pillarGeo = new THREE.CylinderGeometry(0.22, 0.28, 4.8, 12);
    const pLeft = new THREE.Mesh(pillarGeo, redMat);
    pLeft.position.set(-1.8, 2.4, 0);
    const pRight = new THREE.Mesh(pillarGeo, redMat);
    pRight.position.set(1.8, 2.4, 0);
    gateGroup.add(pLeft, pRight);

    // 笠木
    const topBarGeo = new THREE.BoxGeometry(4.6, 0.4, 0.5);
    const topBar = new THREE.Mesh(topBarGeo, blackMat);
    topBar.position.set(0, 4.8, 0);
    gateGroup.add(topBar);

    // 貫
    const midBarGeo = new THREE.BoxGeometry(4.0, 0.3, 0.35);
    const midBar = new THREE.Mesh(midBarGeo, redMat);
    midBar.position.set(0, 4.0, 0);
    gateGroup.add(midBar);

    // 結界
    const shieldGeo = new THREE.PlaneGeometry(3.2, 4.2);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: isBoss ? 0xffea00 : 0x00f5d4,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(0, 2.3, 0);
    gateGroup.add(shield);

    // 漢字オーブ
    const orbGeo = new THREE.SphereGeometry(0.55, 16, 16);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: isBoss ? 0xffd700 : 0x00f5d4,
      emissiveIntensity: 0.8
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.set(0, 2.4, 0);
    gateGroup.add(orb);

    this.scene.add(gateGroup);

    this.gates.push({
      group: gateGroup,
      shield,
      orb,
      floor,
      pos: new THREE.Vector3(x, y, z),
      cleared: false,
      isOpen: false,
      isBoss
    });
  }

  getPlatformColor(floor) {
    if (floor <= 20) return 0x588157;
    if (floor <= 40) return 0xbc4749;
    if (floor <= 60) return 0x3d5a80;
    if (floor <= 80) return 0x6a040f;
    if (floor <= 99) return 0xa8dadc;
    return 0xffd700;
  }

  initWeatherParticles() {
    const particleCount = 400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = this.towerRadius + Math.random() * 15;
      positions[i * 3] = Math.sin(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = Math.cos(angle) * radius;

      velocities[i * 3] = (Math.random() - 0.5) * 0.05;
      velocities[i * 3 + 1] = -Math.random() * 0.06 - 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffb7c5,
      size: 0.6,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, material);
    this.particlesVelocities = velocities;
    this.scene.add(this.particles);
  }

  update(delta, playerY, floor) {
    const time = performance.now() * 0.001;

    for (const plat of this.platforms) {
      if (Math.abs(plat.basePos.y - playerY) > 25) continue;

      if (plat.isMoving) {
        const swing = Math.sin(time * 2.0 + plat.floor) * 0.22;
        const curAngle = plat.baseAngle + swing;
        const x = Math.sin(curAngle) * plat.radius;
        const z = Math.cos(curAngle) * plat.radius;
        plat.mesh.position.x = x;
        plat.mesh.position.z = z;
        plat.mesh.rotation.y = curAngle + Math.PI / 2;
        plat.bounds.xMin = x - plat.width * 0.65;
        plat.bounds.xMax = x + plat.width * 0.65;
        plat.bounds.zMin = z - plat.depth * 0.65;
        plat.bounds.zMax = z + plat.depth * 0.65;
      }

      if (plat.isCrumble) {
        if (plat.crumbleState === 'shaking') {
          plat.crumbleTimer -= delta;
          plat.mesh.position.x = plat.basePos.x + (Math.random() - 0.5) * 0.15;
          plat.mesh.position.z = plat.basePos.z + (Math.random() - 0.5) * 0.15;
          plat.mesh.material.color.setHex(0xff0055);

          if (plat.crumbleTimer <= 0) {
            plat.crumbleState = 'fallen';
            plat.mesh.visible = false;
            plat.crumbleTimer = 3.0;
          }
        } else if (plat.crumbleState === 'fallen') {
          plat.crumbleTimer -= delta;
          if (plat.crumbleTimer <= 0) {
            plat.crumbleState = 'idle';
            plat.mesh.visible = true;
            plat.mesh.position.copy(plat.basePos);
            plat.mesh.material.color.setHex(0xf72585);
          }
        }
      }

      if (plat.hasSpike && plat.mesh.children.length > 0) {
        const spikeGroup = plat.mesh.children[0];
        plat.spikeTimer += delta * 2.5;
        const spikeHeight = (Math.sin(plat.spikeTimer) + 1) * 0.5;
        spikeGroup.position.y = (spikeHeight - 1.0) * 0.6;
        plat.spikeActive = spikeHeight > 0.4;
      }
    }

    for (const gate of this.gates) {
      if (Math.abs(gate.pos.y - playerY) > 25) continue;
      gate.orb.position.y = 2.4 + Math.sin(time * 3 + gate.floor) * 0.2;
      gate.orb.rotation.y += delta * 1.5;
      if (gate.isOpen) {
        gate.shield.material.opacity = Math.max(0, gate.shield.material.opacity - delta * 2);
        gate.shield.visible = gate.shield.material.opacity > 0.05;
      }
    }

    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      const themeIdx = Math.min(Math.floor((floor - 1) / 20), 5);
      const theme = this.themeColors[themeIdx];
      this.particles.material.color.setHex(theme.pColor);

      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] += this.particlesVelocities[i * 3 + 1];
        positions[i * 3] += Math.sin(time + i) * 0.03;
        positions[i * 3 + 2] += Math.cos(time + i) * 0.03;

        if (positions[i * 3 + 1] < playerY - 10) {
          positions[i * 3 + 1] = playerY + 20;
          const a = Math.random() * Math.PI * 2;
          const r = this.towerRadius + Math.random() * 12;
          positions[i * 3] = Math.sin(a) * r;
          positions[i * 3 + 2] = Math.cos(a) * r;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }

  onPlayerStep(plat) {
    if (plat.isCrumble && plat.crumbleState === 'idle') {
      plat.crumbleState = 'shaking';
      plat.crumbleTimer = 1.2;
    }
  }

  openGate(floor) {
    const gate = this.gates.find(g => g.floor === floor);
    if (gate) {
      gate.isOpen = true;
      gate.cleared = true;
      gate.orb.material.emissive.setHex(0xffff00);
      gate.orb.material.emissiveIntensity = 1.5;
    }
  }

  getFloorSpawnPoint(floor) {
    const plat = this.platforms.find(p => p.floor === floor && p.step === 0);
    if (plat) {
      return new THREE.Vector3(plat.basePos.x, plat.basePos.y + 0.5, plat.basePos.z);
    }
    return new THREE.Vector3(0, floor * this.floorHeight + 1.0, -(this.towerRadius + 3.2));
  }
}

window.TowerManager = TowerManager;
