import Phaser from "phaser";
import { useEffect, useRef } from "react";
import {
  BuildingsLayer,
  LibertyLayer,
  LibertyRocksLayer,
  RiverLayer,
  ShootingStarLayer,
  StarryNightLayer,
  VirtualCRT,
} from "./crt";
import { palette } from "./palette";

/** CRT pixels/sec — river (near plane). */
const RIVER_SCROLL_SPEED = 3.2;
/** Skyline drift: slightly slower than river (parallax from water). */
const BUILDINGS_SCROLL_SPEED = 2.6;
/** Stars are farther away, so they drift slower (parallax). */
const STAR_SCROLL_SPEED = 1.2;
/** ±px/sec added to *river* speed when panning; stars/buildings use the same multiplier so parallax holds. */
const MANUAL_SCROLL_BOOST = 50.0;
/** Statue + rocks slide opposite player travel at this fraction of camera motion (parallax). */
const LIBERTY_PARALLAX = 0.75;

const CRT_STARS_KEY = "crt-stars";
const CRT_BUILDINGS_KEY = "crt-buildings";
const CRT_SHOOTING_STAR_KEY = "crt-shooting-star";
const CRT_FG_KEY = "crt-fg";
const CRT_LIBERTY_ROCKS_KEY = "crt-liberty-rocks";
const CRT_LIBERTY_KEY = "crt-liberty";

class CRTScene extends Phaser.Scene {
  private crtStars!: VirtualCRT;
  private crtBuildings!: VirtualCRT;
  private crtShootingStar!: VirtualCRT;
  private crtFg!: VirtualCRT;
  private crtLibertyRocks!: VirtualCRT;
  private crtLiberty!: VirtualCRT;
  private starsLayer!: StarryNightLayer;
  private buildingsLayer!: BuildingsLayer;
  private riverLayer!: RiverLayer;
  private shootingStarLayer!: ShootingStarLayer;
  private libertyRocksLayer!: LibertyRocksLayer;
  private libertyLayer!: LibertyLayer;
  private layers!: [StarryNightLayer, BuildingsLayer, RiverLayer];
  private starsImage!: Phaser.GameObjects.Image;
  private buildingsImage!: Phaser.GameObjects.Image;
  private shootingStarImage!: Phaser.GameObjects.Image;
  private fgImage!: Phaser.GameObjects.Image;
  private libertyRocksImage!: Phaser.GameObjects.Image;
  private libertyImage!: Phaser.GameObjects.Image;
  private starsTexture!: Phaser.Textures.CanvasTexture;
  private buildingsTexture!: Phaser.Textures.CanvasTexture;
  private shootingStarTexture!: Phaser.Textures.CanvasTexture;
  private fgTexture!: Phaser.Textures.CanvasTexture;
  private libertyRocksTexture!: Phaser.Textures.CanvasTexture;
  private libertyTexture!: Phaser.Textures.CanvasTexture;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  /** Player distance past initial view (CRT px); clamped >= 0 so we never reverse past load state. */
  private cameraX = 0;

  constructor() {
    super("crt");
  }

  create(): void {
    this.crtStars = new VirtualCRT();
    this.crtBuildings = new VirtualCRT();
    this.crtShootingStar = new VirtualCRT();
    this.crtFg = new VirtualCRT();
    this.crtLibertyRocks = new VirtualCRT();
    this.crtLiberty = new VirtualCRT();

    const stars = new StarryNightLayer();
    const buildings = new BuildingsLayer();
    const river = new RiverLayer();
    const shootingStar = new ShootingStarLayer();
    const libertyRocks = new LibertyRocksLayer();
    const liberty = new LibertyLayer();

    stars.scrollSpeed = STAR_SCROLL_SPEED;
    buildings.scrollSpeed = BUILDINGS_SCROLL_SPEED;
    river.scrollSpeed = RIVER_SCROLL_SPEED;

    this.starsLayer = stars;
    this.buildingsLayer = buildings;
    this.riverLayer = river;
    this.shootingStarLayer = shootingStar;
    this.libertyRocksLayer = libertyRocks;
    this.libertyLayer = liberty;
    this.layers = [stars, buildings, river];

    const bindNearest = (tex: Phaser.Textures.CanvasTexture) => {
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    };

    const starsTex = this.textures.addCanvas(CRT_STARS_KEY, this.crtStars.canvas);
    const buildingsTex = this.textures.addCanvas(CRT_BUILDINGS_KEY, this.crtBuildings.canvas);
    const shootingStarTex = this.textures.addCanvas(CRT_SHOOTING_STAR_KEY, this.crtShootingStar.canvas);
    const fgTex = this.textures.addCanvas(CRT_FG_KEY, this.crtFg.canvas);
    const libertyRocksTex = this.textures.addCanvas(CRT_LIBERTY_ROCKS_KEY, this.crtLibertyRocks.canvas);
    const libertyTex = this.textures.addCanvas(CRT_LIBERTY_KEY, this.crtLiberty.canvas);
    if (!starsTex || !buildingsTex || !shootingStarTex || !fgTex || !libertyRocksTex || !libertyTex) {
      throw new Error("CRTScene: failed to register CRT canvases");
    }
    this.starsTexture = starsTex;
    this.buildingsTexture = buildingsTex;
    this.shootingStarTexture = shootingStarTex;
    this.fgTexture = fgTex;
    this.libertyRocksTexture = libertyRocksTex;
    this.libertyTexture = libertyTex;
    bindNearest(this.starsTexture);
    bindNearest(this.buildingsTexture);
    bindNearest(this.shootingStarTexture);
    bindNearest(this.fgTexture);
    bindNearest(this.libertyRocksTexture);
    bindNearest(this.libertyTexture);

    this.starsImage = this.add.image(0, 0, CRT_STARS_KEY).setOrigin(0, 0).setDepth(0);
    this.shootingStarImage = this.add.image(0, 0, CRT_SHOOTING_STAR_KEY).setOrigin(0, 0).setDepth(0.5);
    this.buildingsImage = this.add.image(0, 0, CRT_BUILDINGS_KEY).setOrigin(0, 0).setDepth(1);
    this.fgImage = this.add.image(0, 0, CRT_FG_KEY).setOrigin(0, 0).setDepth(2);
    this.libertyRocksImage = this.add.image(0, 0, CRT_LIBERTY_ROCKS_KEY).setOrigin(0, 0).setDepth(2.5);
    this.libertyImage = this.add.image(0, 0, CRT_LIBERTY_KEY).setOrigin(0, 0).setDepth(3);

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
    this.starsImage.setScale(sx, sy);
    this.buildingsImage.setScale(sx, sy);
    this.shootingStarImage.setScale(sx, sy);
    this.fgImage.setScale(sx, sy);
    this.libertyRocksImage.setScale(sx, sy);
    this.libertyImage.setScale(sx, sy);
  }

  override update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;

    for (const layer of this.layers) {
      layer.scrollX += layer.scrollSpeed * dt;
    }

    const panLeft = this.cursors.left.isDown || this.keyA.isDown || this.keyS.isDown;
    const panRight = this.cursors.right.isDown || this.keyD.isDown || this.keyW.isDown;
    let panInput = 0;
    if (panRight && !panLeft) {
      panInput = 1;
    } else if (panLeft && !panRight) {
      panInput = -1;
    }

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

    this.crtStars.clear();
    this.starsLayer.renderTo(this.crtStars);
    this.crtStars.present();
    this.starsTexture.refresh();

    this.crtBuildings.clear();
    this.buildingsLayer.renderTo(this.crtBuildings);
    this.crtBuildings.present();
    this.buildingsTexture.refresh();

    this.crtShootingStar.clear();
    this.shootingStarLayer.renderTo(this.crtShootingStar);
    this.crtShootingStar.present();
    this.shootingStarTexture.refresh();

    this.crtFg.clear();
    this.riverLayer.renderTo(this.crtFg);
    this.crtFg.present();
    this.fgTexture.refresh();

    this.crtLibertyRocks.clear();
    this.libertyRocksLayer.renderTo(this.crtLibertyRocks);
    this.crtLibertyRocks.present();
    this.libertyRocksTexture.refresh();

    this.crtLiberty.clear();
    this.libertyLayer.renderTo(this.crtLiberty);
    this.crtLiberty.present();
    this.libertyTexture.refresh();

    const px = this.scale.gameSize.width / VirtualCRT.WIDTH;
    this.starsImage.x = -this.starsLayer.fractionalScroll * px;
    this.buildingsImage.x = -this.buildingsLayer.fractionalScroll * px;
    this.fgImage.x = -this.riverLayer.fractionalScroll * px;
    this.libertyImage.x = -libertyFrac * px;
    this.libertyRocksImage.x = -libertyFrac * px;
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
