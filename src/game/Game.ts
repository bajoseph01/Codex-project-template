import * as THREE from "three";
import GUI from "lil-gui";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { PLAYER_MODEL_URL, OBSTACLE_MODEL_URL } from "./assetPaths";
import { LANES, clampLaneIndex, type LaneIndex } from "./lane";
import { damp } from "./math";
import { disposeObject3D } from "./dispose";

type GameState = "loading" | "ready" | "running" | "dead";

type GameConfig = {
  gameSpeed: number;
  gravity: number;
  viewHeight: number;
  cameraYOffset: number;
  cameraLookY: number;
  cameraLead: number;
  modelScale: number;
  playerYaw: number;
  obstacleYaw: number;
};

type CharacterActions = {
  run?: THREE.AnimationAction;
  jump?: THREE.AnimationAction;
  death?: THREE.AnimationAction;
};

export class Game {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  private readonly clock = new THREE.Clock();

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
    modelScale: 0.5,
    playerYaw: 1.438407,
    obstacleYaw: -1.49159,
  };

  private readonly gui = new GUI({ title: "Debug" });

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

  constructor(container: HTMLElement) {
    this.container = container;

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

    // Side-scroller camera: look along Z so X is horizontal and Y is vertical.
    this.camera.position.set(0, 7, 24);
    this.camera.lookAt(0, 3, 0);

    this.setupLights();
    this.setupFloor();
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

    for (const seg of this.floorSegments) {
      this.scene.remove(seg);
      seg.geometry.dispose();
      (seg.material as THREE.Material).dispose();
    }

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
    const geom = new THREE.PlaneGeometry(this.floorSegmentLength, 18, 1, 1);
    geom.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x1d2a44,
      roughness: 1,
      metalness: 0,
    });

    const segmentCount = 6;
    for (let i = 0; i < segmentCount; i++) {
      const seg = new THREE.Mesh(geom, mat);
      seg.receiveShadow = true;
      seg.position.set(-20 + i * this.floorSegmentLength, 0, 0);
      this.floorSegments.push(seg);
      this.scene.add(seg);
    }
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
      .add(this.config, "modelScale", 0.2, 3, 0.05)
      .name("Model Scale")
      .onChange(() => this.applyModelScale());
    this.gui
      .add(this.config, "playerYaw", -Math.PI, Math.PI, 0.01)
      .name("Player Yaw")
      .onChange(() => this.applyModelRotation());
    this.gui
      .add(this.config, "obstacleYaw", -Math.PI, Math.PI, 0.01)
      .name("Obstacle Yaw")
      .onChange(() => this.applyModelRotation());
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
    this.playAction(this.playerActions.run, { loop: true });

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

    this.state = "ready";
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
    const scaleRoot = (obj: THREE.Object3D | null) => {
      if (!obj) return;
      const baseScale = (obj.userData.baseScale as number | undefined) ?? 1;
      obj.scale.setScalar(baseScale * this.config.modelScale);
    };

    scaleRoot(this.playerRoot);
    scaleRoot(this.obstaclePrototype);
    for (const obs of this.obstacles) scaleRoot(obs);
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

    const runClip = byName("run") ?? clips[0];
    const jumpClip = byName("jump") ?? clips[1] ?? clips[0];
    const deathClip = byName("death") ?? clips[2] ?? clips[0];

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
    this.state = "dead";
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
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.code === "Enter" && this.state === "ready") {
      this.state = "running";
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
      this.playAction(this.playerActions.jump, { loop: false });
    }
  }
}
