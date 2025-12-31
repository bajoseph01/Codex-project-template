import * as THREE from "three";
import GUI from "lil-gui";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { PLAYER_MODEL_URL, OBSTACLE_MODEL_URL } from "./assetPaths";
import { LANES, clampLaneIndex, type LaneIndex } from "./lane";
import { damp } from "./math";
import { disposeObject3D } from "./dispose";

export type GameState = "loading" | "ready" | "running" | "dead";

type GameConfig = {
  gameSpeed: number;
  gravity: number;
  viewHeight: number;
  cameraYOffset: number;
  cameraLookY: number;
  cameraLead: number;
  playerScale: number;
  obstacleScale: number;
  playerYaw: number;
  obstacleYaw: number;
  bgHeight: number;
  bgYOffset: number;
  bgLead: number;
  bgSpeed: number;
  bgRepeatX: number;
};

type CharacterActions = {
  run?: THREE.AnimationAction;
  jump?: THREE.AnimationAction;
  death?: THREE.AnimationAction;
  idle?: THREE.AnimationAction;
};

type ParallaxLayer = {
  mesh: THREE.Mesh;
  texture: THREE.Texture;
  speed: number;
};

type GameOptions = {
  onStateChange?: (state: GameState) => void;
};

export class Game {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  private readonly clock = new THREE.Clock();
  private readonly onStateChange?: (state: GameState) => void;

  private rafId: number | null = null;
  private onResizeBound = this.onResize.bind(this);
  private onKeyDownBound = this.onKeyDown.bind(this);

  private state: GameState = "loading";

  private readonly config: GameConfig = {
    gameSpeed: 18,
    gravity: 42.6,
    viewHeight: 23.8,
    cameraYOffset: 2,
    cameraLookY: -2,
    cameraLead: 19.3,
    playerScale: 1.6,
    obstacleScale: 0.6,
    playerYaw: 1.438407,
    obstacleYaw: -1.49159,
    bgHeight: 30,
    bgYOffset: 6,
    bgLead: 0,
    bgSpeed: 1,
    bgRepeatX: 2,
  };

  private readonly gui = new GUI({ title: "Debug" });
  private readonly bgGui = new GUI({ title: "Background" });

  private playerRoot: THREE.Object3D | null = null;
  private playerMixer: THREE.AnimationMixer | null = null;
  private playerActions: CharacterActions = {};

  private currentLane: LaneIndex = 1;
  private targetLane: LaneIndex = 1;

  private playerY = 0;
  private playerYVel = 0;
  private grounded = true;

  private obstaclePrototype: THREE.Object3D | null = null;
  private obstacles: THREE.Object3D[] = [];

  private readonly floorSegments: THREE.Mesh[] = [];
  private readonly floorSegmentLength = 28;

  private readonly playerX = -8;
  private cameraFollowX = 0;

  private floorGeometry: THREE.PlaneGeometry | null = null;
  private floorMaterial: THREE.MeshStandardMaterial | null = null;
  private floorTexture: THREE.Texture | null = null;

  private readonly parallaxGroup = new THREE.Group();
  private readonly parallaxGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly parallaxLayers: ParallaxLayer[] = [];

  constructor(container: HTMLElement, options: GameOptions = {}) {
    this.container = container;
    this.onStateChange = options.onStateChange;
    this.bgGui.domElement.style.left = "10px";
    this.bgGui.domElement.style.right = "auto";

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(1, 1, false);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0b1020);
    this.scene.fog = new THREE.Fog(0x0b1020, 25, 90);

    // Side-scroller camera: look along Z so X is horizontal and Y is vertical.
    this.camera.position.set(0, 7, 24);
    this.camera.lookAt(0, 3, 0);

    this.setupLights();
    this.setupFloor();
    this.setupParallax();
    this.setupDebug();

    window.addEventListener("resize", this.onResizeBound);
    window.addEventListener("keydown", this.onKeyDownBound);

    this.onResize();
    void this.load();
  }

  dispose() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;

    window.removeEventListener("resize", this.onResizeBound);
    window.removeEventListener("keydown", this.onKeyDownBound);

    this.gui.destroy();
    this.bgGui.destroy();

    for (const seg of this.floorSegments) {
      this.scene.remove(seg);
    }
    this.floorSegments.length = 0;

    this.floorGeometry?.dispose();
    this.floorMaterial?.dispose();
    this.floorTexture?.dispose();
    this.floorGeometry = null;
    this.floorMaterial = null;
    this.floorTexture = null;

    for (const layer of this.parallaxLayers) {
      this.parallaxGroup.remove(layer.mesh);
      layer.mesh.geometry.dispose();
      (layer.mesh.material as THREE.Material).dispose();
      layer.texture.dispose();
    }
    this.parallaxLayers.length = 0;
    this.parallaxGeometry.dispose();

    for (const obs of this.obstacles) {
      this.scene.remove(obs);
      disposeObject3D(obs);
    }
    this.obstacles = [];

    if (this.playerRoot) {
      this.scene.remove(this.playerRoot);
      disposeObject3D(this.playerRoot);
      this.playerRoot = null;
    }

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(8, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 60;
    key.shadow.camera.left = -20;
    key.shadow.camera.right = 20;
    key.shadow.camera.top = 20;
    key.shadow.camera.bottom = -20;
    this.scene.add(key);
  }

  private setupFloor() {
    this.floorGeometry = new THREE.PlaneGeometry(this.floorSegmentLength, 18, 1, 1);
    this.floorGeometry.rotateX(-Math.PI / 2);

    this.floorTexture = this.createGroundTexture();
    this.floorTexture.wrapS = THREE.RepeatWrapping;
    this.floorTexture.wrapT = THREE.RepeatWrapping;
    this.floorTexture.repeat.set(2, 1);
    this.floorTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0,
      map: this.floorTexture,
    });

    const segmentCount = 6;
    for (let i = 0; i < segmentCount; i++) {
      const seg = new THREE.Mesh(this.floorGeometry, this.floorMaterial);
      seg.receiveShadow = true;
      seg.position.set(-20 + i * this.floorSegmentLength, 0, 0);
      this.floorSegments.push(seg);
      this.scene.add(seg);
    }
  }

  private createGroundTexture(): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.Texture();

    // Base asphalt tone.
    ctx.fillStyle = "#2a2f3a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle noise speckles.
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const alpha = Math.random() * 0.08;
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.fillRect(x, y, 1, 1);
    }

    // A slightly lighter running path stripe.
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, canvas.height * 0.42, canvas.width, canvas.height * 0.16);

    // Darker edge bands.
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.12);
    ctx.fillRect(0, canvas.height * 0.88, canvas.width, canvas.height * 0.12);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private setupParallax() {
    const layerDefs = [
      {
        file: "/backgrounds/city_upscaled/city-layer-6.jpeg",
        speed: 0.01,
        z: -80,
        opaque: true,
      },
      { file: "/backgrounds/city_upscaled/city-layer-0.jpeg", speed: 0.02, z: -70 },
      { file: "/backgrounds/city_upscaled/city-layer-1.jpeg", speed: 0.03, z: -65 },
      { file: "/backgrounds/city_upscaled/city-layer-2.jpeg", speed: 0.04, z: -60 },
      { file: "/backgrounds/city_upscaled/city-layer-3.jpeg", speed: 0.06, z: -55 },
      { file: "/backgrounds/city_upscaled/city-layer-4.jpeg", speed: 0.08, z: -50 },
      { file: "/backgrounds/city_upscaled/city-layer-5.jpeg", speed: 0.1, z: -45 },
    ];

    const loader = new THREE.TextureLoader();
    for (let i = 0; i < layerDefs.length; i++) {
      const def = layerDefs[i];
      loader.load(def.file, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(this.config.bgRepeatX, 1);
        texture.offset.set(0, 0);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: !def.opaque,
          depthWrite: false,
          depthTest: true,
        });

        const mesh = new THREE.Mesh(this.parallaxGeometry, material);
        mesh.position.set(0, 0, def.z);
        mesh.renderOrder = -100 + i;

        this.parallaxGroup.add(mesh);
        this.parallaxLayers.push({ mesh, texture, speed: def.speed });
        this.updateParallaxScale();
      });
    }

    this.scene.add(this.parallaxGroup);
  }

  private setupDebug() {
    this.gui.add(this.config, "gameSpeed", 0, 60, 0.1).name("Game Speed");
    this.gui.add(this.config, "gravity", 0, 80, 0.1).name("Gravity");
    this.gui
      .add(this.config, "viewHeight", 6, 30, 0.1)
      .name("View Height")
      .onChange(() => this.updateCameraFrustum());
    this.gui.add(this.config, "cameraYOffset", -5, 15, 0.1).name("Camera Y");
    this.gui.add(this.config, "cameraLookY", -5, 15, 0.1).name("Look Y");
    this.gui.add(this.config, "cameraLead", -10, 20, 0.1).name("Camera Lead");
    this.gui
      .add(this.config, "playerScale", 0.2, 3, 0.05)
      .name("Player Scale")
      .onChange(() => this.applyModelScale());
    this.gui
      .add(this.config, "obstacleScale", 0.2, 3, 0.05)
      .name("Obstacle Scale")
      .onChange(() => this.applyModelScale());
    this.gui
      .add(this.config, "playerYaw", -Math.PI, Math.PI, 0.01)
      .name("Player Yaw")
      .onChange(() => this.applyModelRotation());
    this.gui
      .add(this.config, "obstacleYaw", -Math.PI, Math.PI, 0.01)
      .name("Obstacle Yaw")
      .onChange(() => this.applyModelRotation());

    this.bgGui
      .add(this.config, "bgHeight", 10, 80, 0.1)
      .name("BG Height")
      .onChange(() => this.updateParallaxScale());
    this.bgGui
      .add(this.config, "bgYOffset", -20, 30, 0.1)
      .name("BG Y Offset");
    this.bgGui
      .add(this.config, "bgLead", -30, 30, 0.1)
      .name("BG X Offset");
    this.bgGui
      .add(this.config, "bgSpeed", 0, 3, 0.05)
      .name("BG Speed");
    this.bgGui
      .add(this.config, "bgRepeatX", 1, 8, 0.1)
      .name("BG Repeat X")
      .onChange(() => this.updateParallaxRepeat());
  }

  private async load() {
    const loader = new GLTFLoader();

    const [playerGltf, obstacleGltf] = await Promise.all([
      loader.loadAsync(PLAYER_MODEL_URL),
      loader.loadAsync(OBSTACLE_MODEL_URL),
    ]);

    // Player
    this.playerRoot = this.prepareModel(playerGltf.scene, { desiredHeight: 3 });
    this.playerRoot.position.set(this.playerX, 0, LANES[this.currentLane]);
    this.scene.add(this.playerRoot);

    this.playerMixer = new THREE.AnimationMixer(this.playerRoot);
    this.playerActions = this.buildCharacterActions(playerGltf.animations);
    if (this.playerActions.idle) this.playAction(this.playerActions.idle, { loop: true });

    // Obstacle prototype + pool
    this.obstaclePrototype = this.prepareModel(obstacleGltf.scene, { desiredHeight: 2.6 });

    this.obstacles = [];
    const obstacleCount = 7;
    for (let i = 0; i < obstacleCount; i++) {
      const clone = skeletonClone(this.obstaclePrototype);
      clone.userData.baseScale = this.obstaclePrototype.userData.baseScale;
      const lane = (i % 3) as LaneIndex;
      clone.position.set(18 + i * 16, 0, LANES[lane]);
      this.obstacles.push(clone);
      this.scene.add(clone);
    }

    this.applyModelScale();
    this.applyModelRotation();

    this.setState("ready");
    this.tick();
  }

  private prepareModel(
    modelScene: THREE.Object3D,
    opts: { desiredHeight: number },
  ): THREE.Group {
    const container = new THREE.Group();
    container.add(modelScene);
    container.userData.modelHeight = opts.desiredHeight;

    // Center the visible mesh on (0,0,0) and put it on the "ground" (y=0).
    const box = new THREE.Box3().setFromObject(modelScene);
    if (!Number.isFinite(box.min.x)) return container;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    // Move geometry so its center is at origin.
    modelScene.position.sub(center);

    // Then lift it so the lowest point sits at y=0.
    const minYAfterCenter = box.min.y - center.y;
    modelScene.position.y -= minYAfterCenter;

    // Auto-scale so different assets feel consistent on screen.
    const height = size.y;
    if (height > 0) {
      const scale = opts.desiredHeight / height;
      container.scale.setScalar(scale);
      container.userData.baseScale = scale;
    }

    container.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if ("isMesh" in mesh && mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return container;
  }

  private applyModelScale() {
    if (this.playerRoot) {
      const baseScale = (this.playerRoot.userData.baseScale as number | undefined) ?? 1;
      this.playerRoot.scale.setScalar(baseScale * this.config.playerScale);
    }

    if (this.obstaclePrototype) {
      const baseScale =
        (this.obstaclePrototype.userData.baseScale as number | undefined) ?? 1;
      this.obstaclePrototype.scale.setScalar(baseScale * this.config.obstacleScale);
    }

    for (const obs of this.obstacles) {
      const baseScale = (obs.userData.baseScale as number | undefined) ?? 1;
      obs.scale.setScalar(baseScale * this.config.obstacleScale);
    }
  }

  private applyModelRotation() {
    if (this.playerRoot) this.playerRoot.rotation.y = this.config.playerYaw;
    if (this.obstaclePrototype) this.obstaclePrototype.rotation.y = this.config.obstacleYaw;
    for (const obs of this.obstacles) obs.rotation.y = this.config.obstacleYaw;
  }

  private buildCharacterActions(clips: THREE.AnimationClip[]): CharacterActions {
    const actions: CharacterActions = {};
    if (!this.playerMixer || clips.length === 0) return actions;

    const byName = (needle: string) =>
      clips.find((c) => c.name.toLowerCase().includes(needle));

    const idleClip =
      byName("idle") ?? byName("standing") ?? byName("stand");
    const runClip = byName("run") ?? clips[0];
    const jumpClip = byName("jump") ?? clips[1] ?? clips[0];
    const deathClip = byName("death") ?? clips[2] ?? clips[0];

    if (idleClip) actions.idle = this.playerMixer.clipAction(idleClip);
    actions.run = this.playerMixer.clipAction(runClip);
    actions.jump = this.playerMixer.clipAction(jumpClip);
    actions.death = this.playerMixer.clipAction(deathClip);

    // Helpful learning output: see what clips exist for your model.
    // eslint-disable-next-line no-console
    console.log(
      "[player clips]",
      clips.map((c) => c.name),
    );

    return actions;
  }

  private playAction(
    action: THREE.AnimationAction | undefined,
    opts: { loop: boolean; once?: boolean } = { loop: true },
  ) {
    if (!action) return;
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);

    if (opts.loop) action.setLoop(THREE.LoopRepeat, Infinity);
    else action.setLoop(THREE.LoopOnce, 1);

    action.play();
  }

  private tick = () => {
    this.rafId = requestAnimationFrame(this.tick);
    const delta = this.clock.getDelta();
    this.update(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private update(delta: number) {
    if (this.state === "loading") return;

    this.updateCamera(delta);
    this.updateParallax(delta, this.state === "running");

    if (this.state === "dead") {
      if (this.playerMixer) this.playerMixer.update(delta);
      return;
    }

    if (this.state !== "running") return;

    if (this.playerMixer) this.playerMixer.update(delta);

    this.updatePlayer(delta);
    this.updateFloor(delta);
    this.updateObstacles(delta);
    this.checkCollisions();
  }

  private updateCamera(delta: number) {
    if (!this.playerRoot) return;

    const focusX = this.playerRoot.position.x + this.config.cameraLead;
    this.cameraFollowX = damp(this.cameraFollowX, focusX, 5, delta);

    this.camera.position.set(
      this.cameraFollowX,
      this.config.cameraYOffset,
      24,
    );
    this.camera.lookAt(this.cameraFollowX, this.config.cameraLookY, 0);
  }

  private updateParallax(delta: number, moving: boolean) {
    this.parallaxGroup.position.x = this.cameraFollowX + this.config.bgLead;
    this.parallaxGroup.position.y = this.config.bgYOffset;

    if (!moving) return;

    for (const layer of this.parallaxLayers) {
      layer.texture.offset.x +=
        delta * this.config.gameSpeed * this.config.bgSpeed * layer.speed * 0.01;
    }
  }

  private updatePlayer(delta: number) {
    if (!this.playerRoot) return;

    const targetZ = LANES[this.targetLane];
    this.playerRoot.position.x = this.playerX;
    this.playerRoot.position.z = damp(this.playerRoot.position.z, targetZ, 18, delta);

    const jumpFloorY = 0;
    if (!this.grounded) {
      this.playerYVel -= this.config.gravity * delta;
      this.playerY += this.playerYVel * delta;
      if (this.playerY <= jumpFloorY) {
        this.playerY = jumpFloorY;
        this.playerYVel = 0;
        this.grounded = true;
        if (this.playerActions.jump) this.playerActions.jump.stop();
        this.playAction(this.playerActions.run, { loop: true });
      }
      this.playerRoot.position.y = this.playerY;
    } else {
      this.playerRoot.position.y = jumpFloorY;
    }
  }

  private updateFloor(delta: number) {
    const dx = this.config.gameSpeed * delta;
    let mostAheadX = -Infinity;
    for (const seg of this.floorSegments) mostAheadX = Math.max(mostAheadX, seg.position.x);

    for (const seg of this.floorSegments) {
      seg.position.x -= dx;

      const behindThreshold = -30;
      if (seg.position.x < behindThreshold) {
        seg.position.x = mostAheadX + this.floorSegmentLength;
        mostAheadX = seg.position.x;
      }
    }
  }

  private updateObstacles(delta: number) {
    const dx = this.config.gameSpeed * delta;

    let mostAheadX = -Infinity;
    for (const obs of this.obstacles) mostAheadX = Math.max(mostAheadX, obs.position.x);

    for (const obs of this.obstacles) {
      obs.position.x -= dx;

      const behindThreshold = -26;
      if (obs.position.x < behindThreshold) {
        const lane = clampLaneIndex(Math.floor(Math.random() * 3));
        obs.position.set(mostAheadX + (16 + Math.random() * 18), 0, LANES[lane]);
        mostAheadX = obs.position.x;
      }
    }
  }

  private checkCollisions() {
    if (!this.playerRoot) return;

    const playerBox = new THREE.Box3().setFromObject(this.playerRoot);
    for (const obs of this.obstacles) {
      const obsBox = new THREE.Box3().setFromObject(obs);
      if (playerBox.intersectsBox(obsBox)) {
        this.die();
        return;
      }
    }
  }

  private die() {
    if (this.state !== "running") return;
    this.setState("dead");
    if (this.playerMixer) this.playerMixer.stopAllAction();
    this.playAction(this.playerActions.death, { loop: false });
  }

  private onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setSize(width, height, false);
    this.updateCameraFrustum();
  }

  private updateCameraFrustum() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;
    const viewWidth = this.config.viewHeight * aspect;

    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = this.config.viewHeight / 2;
    this.camera.bottom = -this.config.viewHeight / 2;
    this.camera.updateProjectionMatrix();

    this.updateParallaxScale();
  }

  private updateParallaxScale() {
    if (this.parallaxLayers.length === 0) return;

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;
    const viewWidth = this.config.bgHeight * aspect;

    for (const layer of this.parallaxLayers) {
      layer.mesh.scale.set(viewWidth, this.config.bgHeight, 1);
    }
  }

  private updateParallaxRepeat() {
    for (const layer of this.parallaxLayers) {
      layer.texture.repeat.set(this.config.bgRepeatX, 1);
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.code === "Enter" && this.state === "ready") {
      if (this.playerMixer) this.playerMixer.stopAllAction();
      this.playAction(this.playerActions.run, { loop: true });
      this.setState("running");
      this.clock.getDelta();
      return;
    }

    if (this.state !== "running") return;

    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      this.targetLane = clampLaneIndex(this.targetLane - 1);
    }

    if (e.code === "ArrowRight" || e.code === "KeyD") {
      this.targetLane = clampLaneIndex(this.targetLane + 1);
    }

    if (e.code === "Space") {
      if (!this.grounded) return;
      this.grounded = false;
      this.playerYVel = 14;
      if (this.playerActions.run) this.playerActions.run.stop();
      this.playAction(this.playerActions.jump, { loop: false });
    }
  }

  restart() {
    if (!this.playerRoot) return;

    this.currentLane = 1;
    this.targetLane = 1;
    this.playerY = 0;
    this.playerYVel = 0;
    this.grounded = true;
    this.playerRoot.position.set(this.playerX, 0, LANES[this.currentLane]);
    this.cameraFollowX = 0;

    // Reset floor segments to a clean strip.
    for (let i = 0; i < this.floorSegments.length; i++) {
      this.floorSegments[i].position.set(-20 + i * this.floorSegmentLength, 0, 0);
    }

    // Re-seed obstacles in front of the player.
    for (let i = 0; i < this.obstacles.length; i++) {
      const lane = (i % 3) as LaneIndex;
      this.obstacles[i].position.set(18 + i * 16, 0, LANES[lane]);
    }

    if (this.playerMixer) {
      this.playerMixer.stopAllAction();
      this.playAction(this.playerActions.run, { loop: true });
    }

    this.setState("running");
    this.clock.getDelta();
  }

  private setState(next: GameState) {
    this.state = next;
    this.onStateChange?.(next);
  }
}
