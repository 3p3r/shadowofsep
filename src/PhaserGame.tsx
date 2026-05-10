import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { BuildingsLayer, RiverLayer, StarryNightLayer, VirtualCRT } from "./crt";
import { palette } from "./palette";

/** CRT pixels/sec — river (near plane). */
const RIVER_SCROLL_SPEED = 16;
/** Skyline drift: slightly slower than river (parallax from water). */
const BUILDINGS_SCROLL_SPEED = 13;
/** Stars are farther away, so they drift slower (parallax). */
const STAR_SCROLL_SPEED = 6;
/** ±px/sec added to *river* speed when panning; stars/buildings use the same multiplier so parallax holds. */
const MANUAL_SCROLL_BOOST = 52;

const CRT_STARS_KEY = "crt-stars";
const CRT_BUILDINGS_KEY = "crt-buildings";
const CRT_FG_KEY = "crt-fg";

class CRTScene extends Phaser.Scene {
  private crtStars!: VirtualCRT;
  private crtBuildings!: VirtualCRT;
  private crtFg!: VirtualCRT;
  private starsLayer!: StarryNightLayer;
  private buildingsLayer!: BuildingsLayer;
  private riverLayer!: RiverLayer;
  private layers!: [StarryNightLayer, BuildingsLayer, RiverLayer];
  private starsImage!: Phaser.GameObjects.Image;
  private buildingsImage!: Phaser.GameObjects.Image;
  private fgImage!: Phaser.GameObjects.Image;
  private starsTexture!: Phaser.Textures.CanvasTexture;
  private buildingsTexture!: Phaser.Textures.CanvasTexture;
  private fgTexture!: Phaser.Textures.CanvasTexture;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  constructor() {
    super("crt");
  }

  create(): void {
    this.crtStars = new VirtualCRT();
    this.crtBuildings = new VirtualCRT();
    this.crtFg = new VirtualCRT();

    const stars = new StarryNightLayer();
    const buildings = new BuildingsLayer();
    const river = new RiverLayer();

    stars.scrollSpeed = STAR_SCROLL_SPEED;
    buildings.scrollSpeed = BUILDINGS_SCROLL_SPEED;
    river.scrollSpeed = RIVER_SCROLL_SPEED;

    this.starsLayer = stars;
    this.buildingsLayer = buildings;
    this.riverLayer = river;
    this.layers = [stars, buildings, river];

    const bindLinear = (tex: Phaser.Textures.CanvasTexture) => {
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    };

    const starsTex = this.textures.addCanvas(CRT_STARS_KEY, this.crtStars.canvas);
    const buildingsTex = this.textures.addCanvas(CRT_BUILDINGS_KEY, this.crtBuildings.canvas);
    const fgTex = this.textures.addCanvas(CRT_FG_KEY, this.crtFg.canvas);
    if (!starsTex || !buildingsTex || !fgTex) {
      throw new Error("CRTScene: failed to register CRT canvases");
    }
    this.starsTexture = starsTex;
    this.buildingsTexture = buildingsTex;
    this.fgTexture = fgTex;
    bindLinear(this.starsTexture);
    bindLinear(this.buildingsTexture);
    bindLinear(this.fgTexture);

    this.starsImage = this.add.image(0, 0, CRT_STARS_KEY).setOrigin(0, 0).setDepth(0);
    this.buildingsImage = this.add.image(0, 0, CRT_BUILDINGS_KEY).setOrigin(0, 0).setDepth(1);
    this.fgImage = this.add.image(0, 0, CRT_FG_KEY).setOrigin(0, 0).setDepth(2);

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
    this.fgImage.setScale(sx, sy);
  }

  override update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;

    const panLeft = this.cursors.left.isDown || this.keyA.isDown || this.keyS.isDown;
    const panRight = this.cursors.right.isDown || this.keyD.isDown || this.keyW.isDown;

    let speedMultiplier = 1;
    if (panLeft && !panRight) {
      speedMultiplier = (RIVER_SCROLL_SPEED - MANUAL_SCROLL_BOOST) / RIVER_SCROLL_SPEED;
    } else if (panRight && !panLeft) {
      speedMultiplier = (RIVER_SCROLL_SPEED + MANUAL_SCROLL_BOOST) / RIVER_SCROLL_SPEED;
    }

    for (const layer of this.layers) {
      layer.scrollX += layer.scrollSpeed * speedMultiplier * dt;
    }

    this.crtStars.clear();
    this.starsLayer.renderTo(this.crtStars);
    this.crtStars.present();
    this.starsTexture.refresh();

    this.crtBuildings.clear();
    this.buildingsLayer.renderTo(this.crtBuildings);
    this.crtBuildings.present();
    this.buildingsTexture.refresh();

    this.crtFg.clear();
    this.riverLayer.renderTo(this.crtFg);
    this.crtFg.present();
    this.fgTexture.refresh();

    const px = this.scale.gameSize.width / VirtualCRT.WIDTH;
    this.starsImage.x = -this.starsLayer.fractionalScroll * px;
    this.buildingsImage.x = -this.buildingsLayer.fractionalScroll * px;
    this.fgImage.x = -this.riverLayer.fractionalScroll * px;
  }
}

function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: palette.background,
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
