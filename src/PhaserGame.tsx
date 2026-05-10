import Phaser from "phaser";
import { useEffect, useRef } from "react";
import {
  BuildingsLayer,
  type Layer,
  LibertyLayer,
  LibertyRocksLayer,
  RiverLayer,
  ShootingStarLayer,
  StarryNightLayer,
  VirtualCRT,
} from "./crt";
import { palette } from "./palette";

const RIVER_SCROLL_SPEED = 3.2;
const BUILDINGS_SCROLL_SPEED = 2.6;
const STAR_SCROLL_SPEED = 1.2;
const MANUAL_SCROLL_BOOST = 50.0;
const LIBERTY_PARALLAX = 0.75;

const CRT_STARS_KEY = "crt-stars";
const CRT_BUILDINGS_KEY = "crt-buildings";
const CRT_SHOOTING_STAR_KEY = "crt-shooting-star";
const CRT_FG_KEY = "crt-fg";
const CRT_LIBERTY_ROCKS_KEY = "crt-liberty-rocks";
const CRT_LIBERTY_KEY = "crt-liberty";

type CrtPass = {
  readonly key: string;
  readonly depth: number;
  readonly layer: Layer;
  readonly crt: VirtualCRT;
  fractional: () => number;
  image: Phaser.GameObjects.Image;
  texture: Phaser.Textures.CanvasTexture;
};

class CRTScene extends Phaser.Scene {
  private passes!: CrtPass[];
  private layers!: [StarryNightLayer, BuildingsLayer, RiverLayer];
  private shootingStarLayer!: ShootingStarLayer;
  private libertyRocksLayer!: LibertyRocksLayer;
  private libertyLayer!: LibertyLayer;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  private cameraX = 0;

  constructor() {
    super("crt");
  }

  create(): void {
    const stars = new StarryNightLayer();
    const buildings = new BuildingsLayer();
    const river = new RiverLayer();
    const shootingStar = new ShootingStarLayer();
    const libertyRocks = new LibertyRocksLayer();
    const liberty = new LibertyLayer();

    stars.scrollSpeed = STAR_SCROLL_SPEED;
    buildings.scrollSpeed = BUILDINGS_SCROLL_SPEED;
    river.scrollSpeed = RIVER_SCROLL_SPEED;

    this.layers = [stars, buildings, river];
    this.shootingStarLayer = shootingStar;
    this.libertyRocksLayer = libertyRocks;
    this.libertyLayer = liberty;

    const crtStars = new VirtualCRT();
    const crtBuildings = new VirtualCRT();
    const crtShootingStar = new VirtualCRT();
    const crtFg = new VirtualCRT();
    const crtLibertyRocks = new VirtualCRT();
    const crtLiberty = new VirtualCRT();

    const specs: Array<{
      key: string;
      depth: number;
      layer: Layer;
      crt: VirtualCRT;
      fractional: () => number;
    }> = [
      { key: CRT_STARS_KEY, depth: 0, layer: stars, crt: crtStars, fractional: () => stars.fractionalScroll },
      {
        key: CRT_SHOOTING_STAR_KEY,
        depth: 0.5,
        layer: shootingStar,
        crt: crtShootingStar,
        fractional: () => 0,
      },
      {
        key: CRT_BUILDINGS_KEY,
        depth: 1,
        layer: buildings,
        crt: crtBuildings,
        fractional: () => buildings.fractionalScroll,
      },
      { key: CRT_FG_KEY, depth: 2, layer: river, crt: crtFg, fractional: () => river.fractionalScroll },
      {
        key: CRT_LIBERTY_ROCKS_KEY,
        depth: 2.5,
        layer: libertyRocks,
        crt: crtLibertyRocks,
        fractional: () => 0,
      },
      { key: CRT_LIBERTY_KEY, depth: 3, layer: liberty, crt: crtLiberty, fractional: () => 0 },
    ];

    this.passes = specs.map((s) => {
      const texture = this.textures.addCanvas(s.key, s.crt.canvas);
      if (!texture) {
        throw new Error(`CRTScene: failed to register canvas "${s.key}"`);
      }
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      const image = this.add.image(0, 0, s.key).setOrigin(0, 0).setDepth(s.depth);
      return { ...s, texture, image };
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.handleResize(this.scale.gameSize);

    const kb = this.input.keyboard;
    if (!kb) {
      throw new Error("CRTScene: keyboard input is required");
    }
    this.cursors = kb.createCursorKeys();
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const sy = gameSize.height / VirtualCRT.HEIGHT;
    // Sub-pixel scroll uses negative x; without extra width the right edge stops short of
    // the viewport and palette blue flashes next to the river (esp. bottom-right).
    const pxPerCrtX = gameSize.width / VirtualCRT.WIDTH;
    const sx = (gameSize.width + pxPerCrtX) / VirtualCRT.WIDTH;
    for (const p of this.passes) {
      p.image.setScale(sx, sy);
    }
  }

  override update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;

    for (const layer of this.layers) {
      layer.scrollX += layer.scrollSpeed * dt;
    }

    const panLeft = this.cursors.left.isDown || this.keyA.isDown || this.keyS.isDown;
    const panRight = this.cursors.right.isDown || this.keyD.isDown || this.keyW.isDown;
    const panInput = Number(panRight) - Number(panLeft);

    const oldCameraX = this.cameraX;
    this.cameraX = Math.max(0, oldCameraX + panInput * MANUAL_SCROLL_BOOST * dt);
    const actualDelta = this.cameraX - oldCameraX;

    for (const layer of this.layers) {
      layer.scrollX += actualDelta * (layer.scrollSpeed / RIVER_SCROLL_SPEED);
    }

    this.shootingStarLayer.update(dt);

    const libertyTotal = this.cameraX * LIBERTY_PARALLAX;
    const libertyInt = Math.floor(libertyTotal);
    const libertyFrac = libertyTotal - libertyInt;
    this.libertyLayer.offsetX = -libertyInt;
    this.libertyRocksLayer.offsetX = -libertyInt;

    for (const p of this.passes) {
      p.crt.clear();
      p.layer.renderTo(p.crt);
      p.crt.present();
      // Phaser: refresh uploads canvas → GPU; one per layer per frame is the intended cost.
      p.texture.refresh();
    }

    const px = this.scale.gameSize.width / VirtualCRT.WIDTH;
    const libertyParallaxPx = -libertyFrac * px;
    for (const p of this.passes) {
      const useLibertyParallax = p.key === CRT_LIBERTY_KEY || p.key === CRT_LIBERTY_ROCKS_KEY;
      p.image.x = useLibertyParallax ? libertyParallaxPx : -p.fractional() * px;
    }
  }
}

function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: palette.background,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: "100%",
      height: "100%",
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: CRTScene,
  });
}

export function PhaserGame() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return;
    }

    const game = createGame(el);

    return () => {
      game.destroy(true);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
}
