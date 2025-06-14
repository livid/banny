import {
    shootBoomerang,
    updateBoomerangs,
    onBoomerangHitMonster,
} from "../logic/boomerang.js";
import { shootBigBoom, onBigBoomHitMonster } from "../logic/bigBoom.js";
import {
    shootBullet,
    onBulletHitMonster,
    cleanupBullets,
} from "../logic/bullet.js";
import {
    initFlamethrower,
    updateFlamethrower,
    cleanupFlamethrower,
} from "../logic/flamethrower.js";
import { PowerUpManager, updateRegeneration } from "../logic/powerUp.js";

export class Start extends Phaser.Scene {
    constructor() {
        super("Start");
        this.score = 0;
        this.lastShotTime = 0;
        this.fireRate = 500; // Default, will be overridden by character data
        this.currentSpawnDelay = 500; // Start with 0.5 second delay
        this.health = 100; // Player health - will be overridden by character data
        this.maxHealth = 100; // Max health - will be overridden by character data
        this.gameOver = false;
        this.victory = false;
        this.selectedCharacter = null; // Will store selected character data
        this.enterKey = null; // For game over input
        // Experience and level system
        this.experience = 0;
        this.level = 1;
        // Boomerang properties
        this.lastBoomerangTime = 0;
        this.boomerangCooldown = 5000; // 5 seconds
        this.boomerangCount = 0; // Number of boomerangs to fire at once (0-8)
        // Big Boom properties
        this.lastBigBoomTime = 0;
        this.bigBoomCooldown = 5000; // 5 seconds

        // Power-up tracking
        this.bigBoomCount = 0; // Number of big booms to fire at once (0-5)
        this.bulletScale = 1.0; // Bullet size scale (1.0 - 4.0)
        this.bulletSizeUpgradeCount = 0; // Track number of bullet size upgrades
        this.regenerationRate = 0; // Health regeneration per second (0-2)
        this.lastRegenerationTime = 0; // Track last regeneration tick

        // Power-up manager
        this.powerUpManager = new PowerUpManager(this);

        // Damage system
        this.baseBulletDamage = 10; // Base damage for bullets

        // Session timer
        this.sessionStartTime = null;
        this.sessionTimer = null;
        this.sessionDuration = 0; // in seconds

        // Map selection
        this.selectedMap = null; // Will store selected map data
        this.currentMapLayers = []; // Track created layers for collision setup

        // Sandstorm effect
        this.sandstormEmitter = null;
        this.sandstormTimer = null;
        this.sandstormIntensity = 0.5; // 0.0 to 1.0
        this.sandstormDirection = 0; // angle in degrees

        // Scene transition management
        this.sceneTransitioning = false; // Flag to prevent updates during scene transitions

        // Gamepad support
        this.gamepad = null;

        // Damage cooldown system
        this.lastDamageTime = 0;
        this.damageCooldown = 1000; // Default attack cooldown in milliseconds
    }

    // Centralized safety utility methods
    isGameActive() {
        return (
            this.scene?.isActive() &&
            this.scene?.isVisible() &&
            !this.gameOver &&
            !this.victory &&
            !this.sceneTransitioning
        );
    }

    isGroupValid(group) {
        return group?.scene === this && group?.world === this.physics.world;
    }

    isSpriteValid(sprite) {
        return (
            sprite?.active &&
            sprite?.body &&
            !sprite.body.destroyed &&
            typeof sprite.x === "number" &&
            typeof sprite.y === "number"
        );
    }

    safeGroupForEach(group, callback) {
        if (!this.isGroupValid(group)) return;

        try {
            const children = group.getChildren();
            if (Array.isArray(children)) {
                children.forEach((child) => {
                    if (this.isSpriteValid(child)) {
                        callback(child);
                    }
                });
            }
        } catch (error) {
            console.warn(`Error processing group children:`, error);
        }
    }

    playSoundSafe(sound) {
        if (sound?.play && this.sound?.context?.state === "running") {
            sound.play();
        }
    }

    createSandstormEffect() {
        // Only create sandstorm for desert map
        if (!this.selectedMap || this.selectedMap.name !== "Desert") {
            return;
        }

        // Create particle emitter for sandstorm that covers the entire map
        this.sandstormEmitter = this.add.particles(0, 0, "sand-particle", {
            // Position and area - cover entire world bounds
            x: { min: -500, max: this.physics.world.bounds.width + 500 },
            y: { min: -300, max: this.physics.world.bounds.height + 300 },

            // Movement
            speedX: { min: 50, max: 150 },
            speedY: { min: -20, max: 20 },

            // Visual properties
            scale: { start: 0.5, end: 1.5 },
            alpha: { start: 0.3, end: 0.1 },
            tint: [0xd2b48c, 0xf4a460, 0xdeb887, 0xd2691e], // Various sand colors

            // Lifetime
            lifespan: { min: 3000, max: 6000 },

            // Emission
            frequency: 30,
            quantity: 3,
        });

        // Set initial depth to be behind UI but in front of map
        this.sandstormEmitter.setDepth(100);

        // Start the timer to change sandstorm properties every 10 seconds
        this.sandstormTimer = this.time.addEvent({
            delay: 10000, // 10 seconds
            callback: this.updateSandstormProperties,
            callbackScope: this,
            loop: true,
        });

        // Set initial properties
        this.updateSandstormProperties();
    }

    updateSandstormProperties() {
        if (
            !this.sandstormEmitter ||
            !this.selectedMap ||
            this.selectedMap.name !== "Desert"
        ) {
            return;
        }

        // Randomly change intensity (0.2 to 1.0)
        this.sandstormIntensity = Phaser.Math.FloatBetween(0.2, 1.0);

        // Randomly change direction (-45 to 45 degrees from horizontal)
        this.sandstormDirection = Phaser.Math.Between(-45, 45);

        // Convert direction to velocity components
        const speed = this.sandstormIntensity * 200; // Base speed multiplied by intensity
        const angleInRadians = Phaser.Math.DegToRad(this.sandstormDirection);
        const speedX = Math.cos(angleInRadians) * speed;
        const speedY = Math.sin(angleInRadians) * speed;

        // Destroy old emitter and create new one with updated properties
        if (this.sandstormEmitter) {
            this.sandstormEmitter.destroy();
        }

        this.sandstormEmitter = this.add.particles(0, 0, "sand-particle", {
            // Position and area - cover entire world bounds
            x: { min: -500, max: this.physics.world.bounds.width + 500 },
            y: { min: -300, max: this.physics.world.bounds.height + 300 },

            // Movement with updated values
            speedX: { min: speedX * 0.5, max: speedX * 1.5 },
            speedY: { min: speedY - 20, max: speedY + 20 },

            // Visual properties
            scale: { start: 0.5, end: 1.5 },
            alpha: {
                start: 0.2 + this.sandstormIntensity * 0.3,
                end: 0.05 + this.sandstormIntensity * 0.15,
            },
            tint: [0xd2b48c, 0xf4a460, 0xdeb887, 0xd2691e], // Various sand colors

            // Lifetime
            lifespan: { min: 3000, max: 6000 },

            // Emission with updated values
            frequency: Math.max(15, 60 - this.sandstormIntensity * 30),
            quantity: Math.ceil(2 + this.sandstormIntensity * 4),
        });

        // Set initial depth to be behind UI but in front of map
        this.sandstormEmitter.setDepth(100);

        console.log(
            `Sandstorm updated - Intensity: ${this.sandstormIntensity.toFixed(
                2
            )}, Direction: ${this.sandstormDirection}°`
        );
    }

    init() {
        // Reset game state when scene starts
        this.score = 0;
        // Don't reset health here - it will be set properly in initializeGame() based on character data
        this.gameOver = false;
        this.victory = false;
        this.sceneTransitioning = false; // Reset transition flag
        this.currentSpawnDelay = 500;
        this.lastShotTime = 0;
        this.lastBoomerangTime = 0;
        this.lastBigBoomTime = 0;
        this.lastRegenerationTime = 0;
        this.experience = 0;
        this.level = 1;
        this.boomerangCount = 0;
        this.bigBoomCount = 0;
        this.bulletScale = 1.0;
        // Don't reset regenerationRate here - it will be set properly from character data

        // Reset session timer
        this.sessionStartTime = Date.now();
        this.sessionDuration = 0;
        if (this.sessionTimer) {
            this.sessionTimer.destroy();
            this.sessionTimer = null;
        }

        // Reset map selection for new game
        this.selectedMap = null;
        this.currentMapLayers = [];
        this.rarityLoggedOnce = false;

        // Reset sandstorm effect
        if (this.sandstormEmitter) {
            this.sandstormEmitter.destroy();
            this.sandstormEmitter = null;
        }
        if (this.sandstormTimer) {
            this.sandstormTimer.destroy();
            this.sandstormTimer = null;
        }
        this.sandstormIntensity = 0.5;
        this.sandstormDirection = 0;

        // Reset gamepad state
        this.gamepad = null;

        // Reset power-up manager state
        this.powerUpManager.cleanupInputStates();
    }

    preload() {
        // Load maps configuration
        this.load.json("maps-data", "assets/maps/maps.json");

        // Load monsters configuration
        this.load.json("monsters-data", "assets/maps/monsters.json");

        // Load characters data
        this.load.json("characters-data", "assets/characters/characters.json");

        // Load difficulty configuration
        this.load.json("difficulty-data", "assets/meta/difficulty.json");

        // Note: Monster sprites will be loaded dynamically based on selected map

        // Load effects
        this.load.spritesheet(
            "blue-explosion",
            "assets/effects/blue-explosion.png",
            { frameWidth: 32, frameHeight: 32 }
        );
        this.load.image("sand-particle", "assets/effects/sand-particle.png");

        // Load boomerang
        this.load.image("boomerang", "assets/super/boomerang.png");

        // Load big boom
        this.load.spritesheet("big-boom", "assets/super/white-boom.png", {
            frameWidth: 32,
            frameHeight: 32,
        });

        // Load sound effects
        this.load.audio("laser", "assets/sfx/laser-1.wav");
        this.load.audio("hurt", "assets/sfx/hurt-1.wav");
        this.load.audio("male-hurt", "assets/sfx/male-hurt-1.wav");
        this.load.audio("flamethrower", "assets/sfx/flamethrower.mp3");
        this.load.audio("burn", "assets/sfx/burn.mp3");

        // Load background music
        this.load.audio(
            "background-music",
            "assets/music/twilight-of-the-dead.mp3"
        );
    }

    create() {
        // Load map assets first, then character images
        this.loadMapAssets();
    }

    loadMapAssets() {
        // Randomly select a map from enabled maps only
        const mapsData = this.cache.json.get("maps-data");
        const enabledMapNames = Object.keys(mapsData).filter(
            (mapName) => mapsData[mapName].enabled === true
        );

        console.log("Available maps:", Object.keys(mapsData));
        console.log("Enabled maps:", enabledMapNames);

        if (enabledMapNames.length === 0) {
            console.error(
                "No enabled maps found! Using first available map as fallback."
            );
            const allMapNames = Object.keys(mapsData);
            this.selectedMap = mapsData[allMapNames[0]];
        } else {
            const randomMapName = Phaser.Utils.Array.GetRandom(enabledMapNames);
            this.selectedMap = mapsData[randomMapName];
        }

        console.log("Selected map:", this.selectedMap.name);

        // Load map tilesets and JSON
        const tilesToLoad = [];

        // Load tilesets
        this.selectedMap.tilesets.forEach((tileset) => {
            if (!this.textures.exists(tileset.key)) {
                tilesToLoad.push({
                    key: tileset.key,
                    path: `assets/maps/${tileset.file}`,
                });
            }
        });

        // Load monsters for this map
        const monstersToLoad = [];
        if (this.selectedMap.monsters) {
            const monstersData = this.cache.json.get("monsters-data");
            this.selectedMap.monsters.forEach((monsterName) => {
                const monster = monstersData[monsterName];
                if (monster) {
                    // Load walking texture
                    if (!this.textures.exists(monster.animationKey)) {
                        monstersToLoad.push({
                            key: monster.animationKey,
                            path: `assets/monsters/${monster.file}`,
                            monsterData: monster,
                        });
                    }
                    // Load jumping texture
                    if (
                        monster.jumpKey &&
                        monster.jumpFile &&
                        !this.textures.exists(monster.jumpKey)
                    ) {
                        monstersToLoad.push({
                            key: monster.jumpKey,
                            path: `assets/monsters/${monster.jumpFile}`,
                            monsterData: monster,
                            frameWidth:
                                monster.jumpFrameWidth || monster.frameWidth,
                            frameHeight:
                                monster.jumpFrameHeight || monster.frameHeight,
                        });
                    }
                    // Load attack texture
                    if (
                        monster.attackKey &&
                        monster.attackFile &&
                        !this.textures.exists(monster.attackKey)
                    ) {
                        monstersToLoad.push({
                            key: monster.attackKey,
                            path: `assets/monsters/${monster.attackFile}`,
                            monsterData: monster,
                            frameWidth:
                                monster.attackFrameWidth || monster.frameWidth,
                            frameHeight:
                                monster.attackFrameHeight ||
                                monster.frameHeight,
                        });
                    }
                }
            });
        }

        // Load tilemap JSON
        if (!this.cache.tilemap.exists(this.selectedMap.tiledJson.key)) {
            this.load.tilemapTiledJSON(
                this.selectedMap.tiledJson.key,
                `assets/maps/${this.selectedMap.tiledJson.file}`
            );
        }

        // Load character images dynamically if not already loaded
        const charactersData = this.cache.json.get("characters-data");
        const imagesToLoad = [];

        charactersData.forEach((character) => {
            const imageKey = character.image.replace(".png", "");
            if (!this.textures.exists(imageKey)) {
                imagesToLoad.push({
                    key: imageKey,
                    path: `assets/characters/${character.image}`,
                });
            }
        });

        // Combine all assets to load (including monsters)
        const allAssetsToLoad = [
            ...tilesToLoad,
            ...monstersToLoad,
            ...imagesToLoad,
        ];

        // If there are assets to load, load them before continuing
        if (
            allAssetsToLoad.length > 0 ||
            !this.cache.tilemap.exists(this.selectedMap.tiledJson.key)
        ) {
            let loadedCount = 0;
            const totalToLoad =
                allAssetsToLoad.length +
                (this.cache.tilemap.exists(this.selectedMap.tiledJson.key)
                    ? 0
                    : 1);

            // Load assets (tilesets and character images)
            allAssetsToLoad.forEach((asset) => {
                if (asset.monsterData) {
                    // Load monster as spritesheet with specific frame dimensions
                    const frameWidth =
                        asset.frameWidth || asset.monsterData.frameWidth;
                    const frameHeight =
                        asset.frameHeight || asset.monsterData.frameHeight;

                    this.load.spritesheet(asset.key, asset.path, {
                        frameWidth: frameWidth,
                        frameHeight: frameHeight,
                    });
                    this.load.on(
                        `filecomplete-spritesheet-${asset.key}`,
                        () => {
                            loadedCount++;
                            if (loadedCount === totalToLoad) {
                                this.initializeGame();
                            }
                        }
                    );
                } else {
                    // Load regular image
                    this.load.image(asset.key, asset.path);
                    this.load.on(`filecomplete-image-${asset.key}`, () => {
                        loadedCount++;
                        if (loadedCount === totalToLoad) {
                            this.initializeGame();
                        }
                    });
                }
            });

            // Load tilemap JSON if needed
            if (!this.cache.tilemap.exists(this.selectedMap.tiledJson.key)) {
                this.load.on(
                    `filecomplete-tilemapJSON-${this.selectedMap.tiledJson.key}`,
                    () => {
                        loadedCount++;
                        if (loadedCount === totalToLoad) {
                            this.initializeGame();
                        }
                    }
                );
            }

            this.load.start();
        } else {
            // All assets already loaded, proceed immediately
            this.initializeGame();
        }
    }

    initializeGame() {
        // Set initial spawn delay from difficulty configuration
        const difficultyData = this.cache.json.get("difficulty-data");
        this.currentSpawnDelay = difficultyData.spawnDelay.maxDelay;

        // Get selected character data
        this.selectedCharacter = this.registry.get("selectedCharacter");
        if (this.selectedCharacter) {
            this.fireRate = this.selectedCharacter.fireRate;
            this.boomerangCount = this.selectedCharacter.boomerang || 0;
            this.bigBoomCount = this.selectedCharacter.bigBoom || 0;
            this.maxHealth = this.selectedCharacter.health || 100;
            this.regenerationRate = this.selectedCharacter.regen || 0;
            this.attackType = this.selectedCharacter.attackType || "bullet";
            this.health = this.maxHealth; // Set current health to max health
        } else {
            // Fallback to first character from data if none selected
            const charactersData = this.cache.json.get("characters-data");
            this.selectedCharacter = charactersData[0] || {
                name: "vonhagel.eth",
                image: "42161-4000000009-transparent.png",
                fireRate: 500,
                boomerang: 0,
                bigBoom: 0,
                health: 100,
                regen: 0,
                attackType: "bullet",
                nft_id: "42161-4000000009",
            };
            this.fireRate = this.selectedCharacter.fireRate;
            this.boomerangCount = this.selectedCharacter.boomerang || 0;
            this.bigBoomCount = this.selectedCharacter.bigBoom || 0;
            this.maxHealth = this.selectedCharacter.health || 100;
            this.regenerationRate = this.selectedCharacter.regen || 0;
            this.attackType = this.selectedCharacter.attackType || "bullet";
            this.health = this.maxHealth; // Set current health to max health
        }

        // Set up the map dynamically
        const map = this.make.tilemap({
            key: this.selectedMap.tiledJson.key,
            tileWidth: this.selectedMap.tilesetSize.width,
            tileHeight: this.selectedMap.tilesetSize.height,
        });

        // Add tilesets
        const tilesets = [];
        this.selectedMap.tilesets.forEach((tilesetData) => {
            const tileset = map.addTilesetImage(
                tilesetData.name,
                tilesetData.key
            );
            tilesets.push(tileset);
        });

        // Create layers and track them for collision setup
        this.currentMapLayers = [];
        this.selectedMap.layers.forEach((layerData) => {
            const layer = map.createLayer(layerData.name, tilesets, 0, 0);
            if (layer) {
                this.currentMapLayers.push({
                    layer: layer,
                    collision: layerData.collision,
                });

                // Set collision if specified
                if (layerData.collision) {
                    layer.setCollisionByProperty({ collides: true });
                }
            }
        });

        // Set collision on tiles that have the 'collides' property set to true in Tiled
        // collisionLayer.setCollisionByProperty({ collides: true });

        // add player to center of the screen
        this.cameras.main.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels
        );
        this.physics.world.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels
        );
        this.cameras.main.setZoom(1);

        // Use selected character sprite or default to first character
        const characterSprite = this.selectedCharacter
            ? this.selectedCharacter.image.replace(".png", "")
            : "42161-4000000009-transparent";
        this.player = this.physics.add.sprite(640, 360, characterSprite);
        this.player.setCollideWorldBounds(true);
        this.player.setScale(0.3);

        // Adjust player collision bounds to 50% of sprite size
        const playerWidth = this.player.width * 0.35;
        const playerHeight = this.player.height * 0.8;
        this.player.body.setSize(playerWidth, playerHeight);

        // Improved camera follow settings to reduce flicker
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setRoundPixels(true); // Prevent subpixel rendering
        this.cameras.main.setDeadzone(16, 16); // Add deadzone to prevent micro-movements

        // Create sandstorm effect for desert map
        this.createSandstormEffect();

        // Add score display
        this.scoreText = this.add.text(16, 16, "Score: 0", {
            fontSize: "32px",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 2,
        });
        this.scoreText.setScrollFactor(0); // Keep UI fixed to camera

        // Add character info display
        if (this.selectedCharacter) {
            this.characterInfoText = this.add.text(
                16,
                56,
                this.getCharacterInfoText(),
                {
                    fontSize: "16px",
                    fill: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 1,
                }
            );
            this.characterInfoText.setScrollFactor(0);
        }

        // Start session timer that updates every second
        this.sessionTimer = this.time.addEvent({
            delay: 1000,
            callback: this.updateSessionTimer,
            callbackScope: this,
            loop: true,
        });

        // Add health bar
        this.createHealthBar();

        // Update health bar to show correct values for the selected character
        this.updateHealthBar();

        // Add experience bar
        this.createExperienceBar();

        this.cursors = this.input.keyboard.createCursorKeys();

        // Initialize WASD keys for alternative movement controls
        this.wasdKeys = this.input.keyboard.addKeys("W,S,A,D");

        // Set up gamepad input (check if gamepad plugin is available)
        if (this.input.gamepad) {
            this.input.gamepad.start();
            this.input.gamepad.on("connected", (pad) => {
                console.log("Gamepad connected to Start scene:", pad.id);
                this.gamepad = pad;
            });
            this.input.gamepad.on("disconnected", (pad) => {
                console.log("Gamepad disconnected from Start scene:", pad.id);
                if (this.gamepad === pad) {
                    this.gamepad = null;
                }
            });

            // Check if gamepad is already connected
            if (this.input.gamepad.total > 0) {
                this.gamepad = this.input.gamepad.getPad(0);
                console.log(
                    "Gamepad already connected in Start scene:",
                    this.gamepad?.id
                );
            }
        } else {
            console.warn("Gamepad plugin not available in Start scene");
        }

        // Add bullet group
        this.bullets = this.physics.add.group();

        // Add boomerang group
        this.boomerangs = this.physics.add.group();

        // Add Big Boom group
        this.bigBooms = this.physics.add.group();

        // Initialize flamethrower
        initFlamethrower(this);

        // Create monster group (moved before collision setup)
        this.monsters = this.physics.add.group();

        // Create animations
        this.anims.create({
            key: "explosion",
            frames: this.anims.generateFrameNumbers("blue-explosion", {
                start: 0,
                end: 3,
            }),
            frameRate: 10,
            repeat: 0,
        });

        // Add Big Boom animation
        this.anims.create({
            key: "big-boom",
            frames: this.anims.generateFrameNumbers("big-boom", {
                start: 0,
                end: 15,
            }),
            frameRate: 24,
            repeat: 0,
        });

        // Create monster animations dynamically based on selected map
        if (this.selectedMap && this.selectedMap.monsters) {
            const monstersData = this.cache.json.get("monsters-data");
            this.selectedMap.monsters.forEach((monsterName) => {
                const monster = monstersData[monsterName];
                if (monster) {
                    // Create walking animation
                    this.anims.create({
                        key: monster.animationKey,
                        frames: this.anims.generateFrameNumbers(
                            monster.animationKey,
                            {
                                start: monster.animationStart,
                                end: monster.animationEnd,
                            }
                        ),
                        frameRate: monster.animationFrameRate || 8,
                        repeat: -1,
                    });

                    // Create jumping animation if jump assets exist
                    if (monster.jumpKey && monster.jumpFile) {
                        this.anims.create({
                            key: monster.jumpKey,
                            frames: this.anims.generateFrameNumbers(
                                monster.jumpKey,
                                {
                                    start: monster.jumpAnimationStart || 0,
                                    end: monster.jumpAnimationEnd || 4,
                                }
                            ),
                            frameRate: monster.jumpAnimationFrameRate || 5,
                            repeat: 0, // Play once
                        });
                    }

                    // Create attack animation if attack assets exist
                    if (monster.attackKey && monster.attackFile) {
                        const attackAnimKey = monster.attackKey;
                        this.anims.create({
                            key: attackAnimKey,
                            frames: this.anims.generateFrameNumbers(
                                monster.attackKey,
                                {
                                    start: monster.attackAnimationStart || 0,
                                    end: monster.attackAnimationEnd || 4,
                                }
                            ),
                            frameRate: monster.attackAnimationFrameRate || 5,
                            repeat: 0, // Play once
                        });
                        console.log(
                            `Created attack animation: ${attackAnimKey} for ${monster.name}`
                        );
                    }
                }
            });
        }

        // Setup bullet-monster collision (moved after groups are created)
        this.physics.add.overlap(
            this.bullets,
            this.monsters,
            this.onBulletHitMonster,
            null,
            this
        );

        // Setup boomerang-monster collision
        this.physics.add.overlap(
            this.boomerangs,
            this.monsters,
            this.onBoomerangHitMonster,
            null,
            this
        );

        // Setup Big Boom-monster collision
        this.physics.add.overlap(
            this.bigBooms,
            this.monsters,
            this.onBigBoomHitMonster,
            null,
            this
        );

        // Setup player-monster collision
        this.physics.add.overlap(
            this.player,
            this.monsters,
            this.onPlayerHitMonster,
            null,
            this
        );

        // Setup collisions with map layers that have collision enabled
        this.currentMapLayers.forEach((mapLayer) => {
            if (mapLayer.collision) {
                this.physics.add.collider(this.player, mapLayer.layer);
                this.physics.add.collider(this.monsters, mapLayer.layer);
            }
        });

        // Setup input handlers
        this.enterKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.ENTER
        );
        this.enterKey.on("down", () => {
            if (this.gameOver) {
                console.log(
                    "Game over detected, switching to character selection..."
                );

                // Add a small delay to ensure proper cleanup
                this.time.delayedCall(100, () => {
                    this.scene.start("CharacterSelection");
                });
            }
        });

        // Create sound effects
        this.laserSound = this.sound.add("laser", { volume: 0.05 });
        this.hurtSound = this.sound.add("hurt", { volume: 0.75 });
        this.maleHurtSound = this.sound.add("male-hurt", { volume: 0.5 });
        this.flamethrowerSound = this.sound.add("flamethrower", {
            volume: 0.3,
            loop: true,
        });
        this.burnSound = this.sound.add("burn", { volume: 0.8 });

        // Add background music - use global registry to prevent overlaps
        let globalBackgroundMusic = this.registry.get("backgroundMusic");

        if (!globalBackgroundMusic || !globalBackgroundMusic.isPlaying) {
            // Stop any existing background music first
            if (globalBackgroundMusic) {
                globalBackgroundMusic.stop();
                globalBackgroundMusic.destroy();
            }

            this.backgroundMusic = this.sound.add("background-music", {
                volume: 0.05,
                loop: true,
            });
            this.backgroundMusic.play();

            // Store in global registry
            this.registry.set("backgroundMusic", this.backgroundMusic);
        } else {
            // Use existing background music
            this.backgroundMusic = globalBackgroundMusic;
        }

        // Start spawning monsters
        this.spawnTimer = this.time.addEvent({
            delay: this.currentSpawnDelay,
            callback: this.spawnMonster,
            callbackScope: this,
            loop: true,
        });

        // Start session timer
        this.sessionStartTime = this.time.now;
        this.sessionTimer = this.time.addEvent({
            delay: 1000, // 1 second
            callback: this.updateSessionTime,
            callbackScope: this,
            loop: true,
        });
    }

    formatSessionTime() {
        const minutes = Math.floor(this.sessionDuration / 60);
        const seconds = this.sessionDuration % 60;
        return `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
    }

    getCharacterInfoText() {
        if (!this.selectedCharacter) return "";
        const regenText =
            this.regenerationRate > 0
                ? `\nRegen: ${this.regenerationRate.toFixed(1)}/s`
                : "";
        return `Character: ${this.selectedCharacter.name}\nHealth: ${
            this.health
        }/${this.maxHealth}\nSession: ${this.formatSessionTime()}\nLevel: ${
            this.level
        }\nFire Rate: ${this.fireRate}ms${regenText}\nMap: ${
            this.selectedMap ? this.selectedMap.name : "Loading..."
        }`;
    }

    updateSessionTimer() {
        if (!this.gameOver) {
            this.sessionDuration++;
            if (this.characterInfoText) {
                this.characterInfoText.setText(this.getCharacterInfoText());
            }
        }
    }

    createHealthBar() {
        const barWidth = 200;
        const barHeight = 20;
        const x = this.cameras.main.width - barWidth - 16;
        const y = 16;

        // Health bar background (black border)
        this.healthBarBg = this.add.rectangle(
            x,
            y,
            barWidth + 4,
            barHeight + 4,
            0x000000
        );
        this.healthBarBg.setOrigin(0, 0);
        this.healthBarBg.setScrollFactor(0);
        this.healthBarBg.setDepth(1000);

        // Health bar fill (yellow)
        this.healthBar = this.add.rectangle(
            x + 2,
            y + 2,
            barWidth,
            barHeight,
            0xffff00
        );
        this.healthBar.setOrigin(0, 0);
        this.healthBar.setScrollFactor(0);
        this.healthBar.setDepth(1001);

        // Health text
        this.healthText = this.add.text(
            x + barWidth / 2,
            y + barHeight / 2,
            `${this.health.toFixed(2)}/${this.maxHealth.toFixed(2)}`,
            {
                fontSize: "14px",
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 2,
            }
        );
        this.healthText.setOrigin(0.5, 0.5);
        this.healthText.setScrollFactor(0);
        this.healthText.setDepth(1002);
    }

    updateHealthBar() {
        const healthPercent = this.health / this.maxHealth;
        const barWidth = 200;
        this.healthBar.width = barWidth * healthPercent;
        this.healthText.setText(
            `${this.health.toFixed(2)}/${this.maxHealth.toFixed(2)}`
        );
    }

    // Calculate experience required for a given level
    getExperienceRequiredForLevel(level) {
        if (level <= 1) return 0;
        // Level 2 needs 100, Level 3 needs 240, and so on with a gradual curve
        // Formula: base * level^1.4 to create a not-too-steep curve
        const base = 100;
        return Math.floor(base * Math.pow(level - 1, 1.4));
    }

    // Get total experience required to reach a level
    getTotalExperienceForLevel(level) {
        let total = 0;
        for (let i = 2; i <= level; i++) {
            total += this.getExperienceRequiredForLevel(i);
        }
        return total;
    }

    // Get current level based on experience
    getLevelFromExperience(experience) {
        let level = 1;
        let totalExp = 0;

        while (true) {
            const expForNextLevel = this.getExperienceRequiredForLevel(
                level + 1
            );
            if (totalExp + expForNextLevel > experience) {
                break;
            }
            totalExp += expForNextLevel;
            level++;
        }

        return level;
    }

    createExperienceBar() {
        const barWidth = 200;
        const barHeight = 20;
        const x = this.cameras.main.width - barWidth - 16;
        const y = 44; // Position under health bar

        // Experience bar background (black border)
        this.expBarBg = this.add.rectangle(
            x,
            y,
            barWidth + 4,
            barHeight + 4,
            0x000000
        );
        this.expBarBg.setOrigin(0, 0);
        this.expBarBg.setScrollFactor(0);
        this.expBarBg.setDepth(1000);

        // Experience bar fill (blue)
        this.expBar = this.add.rectangle(
            x + 2,
            y + 2,
            barWidth,
            barHeight,
            0x0080ff
        );
        this.expBar.setOrigin(0, 0);
        this.expBar.setScrollFactor(0);
        this.expBar.setDepth(1001);
        this.expBar.width = 0; // Start empty

        // Experience text (inside the bar)
        this.expText = this.add.text(
            x + barWidth / 2,
            y + barHeight / 2,
            "0/100",
            {
                fontSize: "12px",
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 1,
            }
        );
        this.expText.setOrigin(0.5, 0.5);
        this.expText.setScrollFactor(0);
        this.expText.setDepth(1002);
    }

    updateExperienceBar() {
        const currentLevel = this.getLevelFromExperience(this.experience);
        const totalExpForCurrentLevel =
            this.getTotalExperienceForLevel(currentLevel);
        const expForNextLevel = this.getExperienceRequiredForLevel(
            currentLevel + 1
        );
        const currentLevelProgress = this.experience - totalExpForCurrentLevel;

        // Update level if it changed
        if (currentLevel !== this.level) {
            this.level = currentLevel;
            // Update character info text to show new level
            if (this.selectedCharacter && this.characterInfoText) {
                this.characterInfoText.setText(this.getCharacterInfoText());
            }

            // Show power-up selection dialog on level up
            this.powerUpManager.showDialog();
        }

        const progressPercent =
            expForNextLevel > 0 ? currentLevelProgress / expForNextLevel : 1;
        const barWidth = 200;

        this.expBar.width = barWidth * progressPercent;

        if (expForNextLevel > 0) {
            this.expText.setText(`${currentLevelProgress}/${expForNextLevel}`);
        } else {
            this.expText.setText("MAX");
        }
    }

    addExperience(amount) {
        this.experience += amount;
        this.updateExperienceBar();
    }

    onPlayerHitMonster(player, monster) {
        if (this.gameOver) return;

        const currentTime = this.time.now;

        // Initialize monster's last damage time if not set
        if (!monster.lastPlayerDamageTime) {
            monster.lastPlayerDamageTime = 0;
        }

        // Get damage cooldown from monster data, fallback to default
        const monsterDamageCooldown =
            monster.monsterData?.damageCooldown || this.damageCooldown;

        // Check if this specific monster's damage cooldown is still active
        if (
            currentTime - monster.lastPlayerDamageTime <
            monsterDamageCooldown
        ) {
            return;
        }

        // Get damage from monster data, fallback to 25 if not defined
        const monsterDamage = monster.monsterData?.attackDamage || 25;

        this.playSoundSafe(this.maleHurtSound);

        this.health = Math.max(0, this.health - monsterDamage);
        this.updateHealthBar();

        if (this.characterInfoText) {
            this.characterInfoText.setText(this.getCharacterInfoText());
        }

        // Update this monster's last damage time to start its cooldown
        monster.lastPlayerDamageTime = currentTime;

        // Show damage number on player
        this.showDamageNumber(this.player.x, this.player.y - 30, monsterDamage);

        // Don't destroy monster - it continues to exist and can damage again after cooldown

        if (this.health <= 0) {
            this.triggerGameOver();
        }
    }

    shutdown() {
        // Clean up when leaving the scene
        if (this.spawnTimer) {
            this.spawnTimer.destroy();
        }

        // Clean up session timer
        if (this.sessionTimer) {
            this.sessionTimer.destroy();
            this.sessionTimer = null;
        }

        // Clean up sandstorm effect
        if (this.sandstormEmitter) {
            this.sandstormEmitter.destroy();
            this.sandstormEmitter = null;
        }
        if (this.sandstormTimer) {
            this.sandstormTimer.destroy();
            this.sandstormTimer = null;
        }

        // Only stop background music if we're leaving the game completely
        // For character selection, keep music playing
        const globalBackgroundMusic = this.registry.get("backgroundMusic");
        if (globalBackgroundMusic && globalBackgroundMusic.isPlaying) {
            // Keep music playing for character selection
            console.log("Keeping background music playing");
        }

        // Clean up gamepad state
        this.gamepad = null;

        // Clean up power-up dialog gamepad state
        if (this.powerUpGamepadTimer) {
            this.powerUpGamepadTimer.destroy();
            this.powerUpGamepadTimer = null;
        }
        this.selectedPowerUpIndex = 0;
        this.availablePowerUpsData = [];
        this.currentHeldGamepadDirection = null;
        this.previousButtonStates = {};

        // Clean up power-up dialog keyboard state
        if (this.powerUpKeyTimer) {
            this.powerUpKeyTimer.destroy();
            this.powerUpKeyTimer = null;
        }
        this.currentHeldPowerUpKey = null;

        // Clean up enter key only when shutting down
        if (this.enterKey) {
            this.enterKey.removeAllListeners();
            this.enterKey = null;
        }

        // Clean up flamethrower resources
        cleanupFlamethrower(this);

        console.log("Start scene shutdown");
    }

    triggerGameOver() {
        this.gameOver = true;

        // Stop flamethrower sound if playing
        if (
            this.isFlamethrowerSoundPlaying &&
            this.flamethrowerSound?.isPlaying
        ) {
            this.flamethrowerSound.stop();
            this.isFlamethrowerSoundPlaying = false;
        }

        // Stop session timer
        if (this.sessionTimer) {
            this.sessionTimer.destroy();
            this.sessionTimer = null;
        }

        // Stop spawning monsters
        this.spawnTimer?.destroy();

        // Stop player movement
        if (this.isSpriteValid(this.player)) {
            this.player.setVelocity(0, 0);
        }

        // Stop all monsters
        this.safeGroupForEach(this.monsters, (monster) => {
            monster.setVelocity(0, 0);
        });

        // Show game over text
        this.gameOverText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            "GAME OVER\nPress ENTER or B/Start button to select character",
            {
                fontSize: "42px",
                fill: "#ff0000",
                stroke: "#000000",
                strokeThickness: 3,
                align: "center",
            }
        );
        this.gameOverText.setOrigin(0.5, 0.5);
        this.gameOverText.setScrollFactor(0);
    }

    triggerVictory() {
        this.victory = true;

        // Stop flamethrower sound if playing
        if (
            this.isFlamethrowerSoundPlaying &&
            this.flamethrowerSound?.isPlaying
        ) {
            this.flamethrowerSound.stop();
            this.isFlamethrowerSoundPlaying = false;
        }

        // Stop session timer
        if (this.sessionTimer) {
            this.sessionTimer.destroy();
            this.sessionTimer = null;
        }

        // Stop spawning monsters
        this.spawnTimer?.destroy();

        // Stop player movement
        if (this.isSpriteValid(this.player)) {
            this.player.setVelocity(0, 0);
        }

        // Stop all monsters
        this.safeGroupForEach(this.monsters, (monster) => {
            monster.setVelocity(0, 0);
        });

        // Show victory text
        this.victoryText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            "STAGE CLEARED\nPress ENTER or B/Start button to continue",
            {
                fontSize: "42px",
                fill: "#00ff00",
                stroke: "#000000",
                strokeThickness: 3,
                align: "center",
            }
        );
        this.victoryText.setOrigin(0.5, 0.5);
        this.victoryText.setScrollFactor(0);
    }

    restartGame() {
        // Reset game state
        this.score = 0;
        // Reset health and maxHealth based on selected character
        this.maxHealth = this.selectedCharacter
            ? this.selectedCharacter.health || 100
            : 100;
        this.health = this.maxHealth;
        this.gameOver = false;
        this.victory = false;

        // Get initial spawn delay from difficulty configuration
        const difficultyData = this.cache.json.get("difficulty-data");
        this.currentSpawnDelay = difficultyData.spawnDelay.maxDelay;

        this.lastShotTime = 0;
        this.lastBoomerangTime = 0;
        this.lastBigBoomTime = 0;
        this.lastRegenerationTime = 0;
        this.experience = 0;
        this.level = 1;

        // Reset power-ups
        this.fireRate = this.selectedCharacter
            ? this.selectedCharacter.fireRate
            : 500;
        this.boomerangCount = this.selectedCharacter
            ? this.selectedCharacter.boomerang || 0
            : 0;
        this.bigBoomCount = this.selectedCharacter
            ? this.selectedCharacter.bigBoom || 0
            : 0;
        this.bulletScale = 1.0;
        this.bulletSizeUpgradeCount = 0;
        this.regenerationRate = this.selectedCharacter
            ? this.selectedCharacter.regen || 0
            : 0;

        // Reset damage
        this.baseBulletDamage = 10;

        // Update UI
        this.scoreText.setText("Score: 0");
        this.updateHealthBar();
        this.updateExperienceBar();

        // Remove game over text
        if (this.gameOverText) {
            this.gameOverText.destroy();
        }

        // Remove victory text
        if (this.victoryText) {
            this.victoryText.destroy();
        }

        // Clean up monster health bars before clearing monsters
        this.safeGroupForEach(this.monsters, (monster) => {
            this.destroyMonsterHealthBar(monster);
        });

        // Clear all monsters and bullets
        this.monsters.clear(true, true);
        this.bullets.clear(true, true);
        this.boomerangs.clear(true, true);
        this.bigBooms.clear(true, true);

        // Reset player position
        this.player.setPosition(640, 360);
        this.player.setVelocity(0, 0);

        // Restart monster spawning
        this.spawnTimer = this.time.addEvent({
            delay: this.currentSpawnDelay,
            callback: this.spawnMonster,
            callbackScope: this,
            loop: true,
        });
    }

    spawnMonster() {
        if (
            !this.isGameActive() ||
            this.powerUpManager.showingDialog ||
            !this.isGroupValid(this.monsters)
        )
            return;

        // Get random position at the edge of the visible area
        const edge = Phaser.Math.Between(0, 3);
        let x, y;
        const buffer = 50; // Spawn slightly outside the camera view

        const camera = this.cameras.main;
        const camBounds = {
            left: camera.scrollX - buffer,
            right: camera.scrollX + camera.width + buffer,
            top: camera.scrollY - buffer,
            bottom: camera.scrollY + camera.height + buffer,
        };

        switch (edge) {
            case 0: // Top
                x = Phaser.Math.Between(camBounds.left, camBounds.right);
                y = camBounds.top;
                break;
            case 1: // Right
                x = camBounds.right;
                y = Phaser.Math.Between(camBounds.top, camBounds.bottom);
                break;
            case 2: // Bottom
                x = Phaser.Math.Between(camBounds.left, camBounds.right);
                y = camBounds.bottom;
                break;
            case 3: // Left
                x = camBounds.left;
                y = Phaser.Math.Between(camBounds.top, camBounds.bottom);
                break;
        }

        try {
            // Select a random monster from the current map based on rarity
            if (
                !this.selectedMap ||
                !this.selectedMap.monsters ||
                this.selectedMap.monsters.length === 0
            ) {
                console.warn("No monsters defined for selected map");
                return;
            }

            const monstersData = this.cache.json.get("monsters-data");
            const randomMonsterName = this.selectMonsterByRarity(
                this.selectedMap.monsters,
                monstersData
            );
            const randomMonster = monstersData[randomMonsterName];

            if (!randomMonster) {
                console.warn(
                    `Monster ${randomMonsterName} not found in monsters data`
                );
                return;
            }

            const monster = this.monsters.create(
                x,
                y,
                randomMonster.animationKey
            );

            if (monster) {
                monster.play(randomMonster.animationKey);
                monster.setCollideWorldBounds(true);
                monster.setScale(randomMonster.scale || 2);

                // Set monster health and max health from monster data
                monster.maxHealth = randomMonster.health || 100;
                monster.currentHealth = monster.maxHealth;
                monster.monsterData = randomMonster; // Store reference to monster data

                // Initialize stuck detection properties
                monster.lastPosition = { x: monster.x, y: monster.y };
                monster.stuckTimer = 0;
                monster.isJumping = false;
                monster.jumpStartTime = 0;

                // Initialize attack properties
                monster.isAttacking = false;
                monster.lastAttackTime = 0;
                monster.attackCooldown =
                    randomMonster.attackAnimationDuration || 1000;

                // Adjust monster collision bounds based on monster data
                const monsterWidth =
                    monster.width * (randomMonster.collisionWidthScale || 0.5);
                const monsterHeight =
                    monster.height *
                    (randomMonster.collisionHeightScale || 0.8);
                const monsterOffsetX = randomMonster.collisionOffsetX || 0;
                const monsterOffsetY = randomMonster.collisionOffsetY || 0;

                monster.body.setSize(monsterWidth, monsterHeight);
                monster.body.setOffset(monsterOffsetX, monsterOffsetY);
            }
        } catch (error) {
            console.warn("Error creating monster:", error);
        }
    }

    selectMonsterByRarity(availableMonsterNames, monstersData) {
        // Create weighted list based on rarity values
        const weightedMonsters = [];

        // Log rarity information for debugging (only once)
        if (!this.rarityLoggedOnce) {
            console.log("Monster rarity distribution:");
            availableMonsterNames.forEach((monsterName) => {
                const monster = monstersData[monsterName];
                if (monster && monster.rarity) {
                    console.log(`  ${monsterName}: ${monster.rarity}% chance`);
                }
            });
            this.rarityLoggedOnce = true;
        }

        availableMonsterNames.forEach((monsterName) => {
            const monster = monstersData[monsterName];
            if (monster && monster.rarity) {
                // Add monster to weighted list based on its rarity
                for (let i = 0; i < monster.rarity; i++) {
                    weightedMonsters.push(monsterName);
                }
            }
        });

        // If no monsters have rarity values, fall back to uniform random selection
        if (weightedMonsters.length === 0) {
            console.warn(
                "No monsters found with rarity values, using uniform random selection"
            );
            return Phaser.Utils.Array.GetRandom(availableMonsterNames);
        }

        // Select randomly from the weighted list
        const selectedMonster = Phaser.Utils.Array.GetRandom(weightedMonsters);
        return selectedMonster;
    }

    createMonsterHealthBar(monster) {
        if (monster.healthBar || monster.healthBarBg) return; // Already has health bar

        const barWidth = 40;
        const barHeight = 6;
        const x = monster.x - barWidth / 2;
        const y = monster.y - monster.height / 2 - 15;

        // Health bar background (red)
        monster.healthBarBg = this.add.rectangle(
            x,
            y,
            barWidth,
            barHeight,
            0x660000
        );
        monster.healthBarBg.setOrigin(0, 0);
        monster.healthBarBg.setDepth(999);

        // Health bar fill (green)
        monster.healthBar = this.add.rectangle(
            x,
            y,
            barWidth,
            barHeight,
            0x00ff00
        );
        monster.healthBar.setOrigin(0, 0);
        monster.healthBar.setDepth(1000);
    }

    updateMonsterHealthBar(monster) {
        if (!monster.healthBar || !monster.healthBarBg) return;

        const healthPercent = monster.currentHealth / monster.maxHealth;
        const barWidth = 40;

        // Update health bar width and color
        monster.healthBar.width = barWidth * healthPercent;

        // Change color based on health percentage
        if (healthPercent > 0.6) {
            monster.healthBar.setFillStyle(0x00ff00); // Green
        } else if (healthPercent > 0.3) {
            monster.healthBar.setFillStyle(0xffff00); // Yellow
        } else {
            monster.healthBar.setFillStyle(0xff0000); // Red
        }

        // Update position to follow monster
        const x = monster.x - barWidth / 2;
        const y = monster.y - monster.height / 2 - 15;

        monster.healthBarBg.setPosition(x, y);
        monster.healthBar.setPosition(x, y);
    }

    destroyMonsterHealthBar(monster) {
        if (monster.healthBar) {
            monster.healthBar.destroy();
            monster.healthBar = null;
        }
        if (monster.healthBarBg) {
            monster.healthBarBg.destroy();
            monster.healthBarBg = null;
        }
    }

    findNearestMonster() {
        if (
            !this.isGroupValid(this.monsters) ||
            !this.isSpriteValid(this.player)
        )
            return null;

        let nearestMonster = null;
        let shortestDistance = Infinity;

        this.safeGroupForEach(this.monsters, (monster) => {
            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                monster.x,
                monster.y
            );
            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestMonster = monster;
            }
        });

        return nearestMonster;
    }

    shootBullet() {
        shootBullet(this);
    }
    shootBoomerang() {
        shootBoomerang(this);
    }

    shootBigBoom() {
        shootBigBoom(this);
    }

    updateBoomerangs() {
        updateBoomerangs(this);
    }

    calculateSpawnDelay() {
        // Get difficulty configuration from loaded JSON
        const difficultyData = this.cache.json.get("difficulty-data");
        const spawnConfig = difficultyData.spawnDelay;

        const minDelay = spawnConfig.minDelay;
        const maxDelay = spawnConfig.maxDelay;
        const scoreThreshold = spawnConfig.scoreThreshold;

        const progress = Math.min(this.score / scoreThreshold, 1);
        return Math.max(minDelay, maxDelay - (maxDelay - minDelay) * progress);
    }

    onBulletHitMonster(bullet, monster) {
        onBulletHitMonster(bullet, monster, this);
    }

    onBoomerangHitMonster(boomerang, monster) {
        onBoomerangHitMonster(boomerang, monster, this);
    }

    onBigBoomHitMonster(bigBoom, monster) {
        onBigBoomHitMonster(bigBoom, monster, this);
    }

    createExplosion(x, y) {
        const explosion = this.add.sprite(x, y, "blue-explosion");
        explosion.play("explosion");
        explosion.once("animationcomplete", () => {
            explosion.destroy();
        });
    }

    showDamageNumber(x, y, damage) {
        // Choose color based on damage amount
        let color = "#ffffff"; // Default white
        if (damage >= 50) {
            color = "#ff0000"; // Red for high damage
        } else if (damage >= 20) {
            color = "#ffaa00"; // Orange for medium damage
        } else {
            color = "#ffff00"; // Yellow for low damage
        }

        const damageText = this.add.text(x, y, damage.toString(), {
            fontSize: "18px",
            fill: color,
            stroke: "#000000",
            strokeThickness: 3,
            fontStyle: "bold",
        });
        damageText.setOrigin(0.5, 0.5);
        damageText.setDepth(1000); // Ensure it appears above other objects

        // Animate the damage number
        this.tweens.add({
            targets: damageText,
            y: y - 40,
            alpha: 0,
            scale: 1.5,
            duration: 600,
            ease: "Power2",
            onComplete: () => {
                damageText.destroy();
            },
        });
    }

    updateScore(monster = null) {
        this.score += 1;
        this.scoreText.setText("Score: " + this.score);

        // Check for victory condition
        if (this.selectedMap && this.score >= this.selectedMap.victory) {
            this.triggerVictory();
            return;
        }

        // Use monster's experience value if available, otherwise fall back to default
        const experienceGain =
            monster && monster.monsterData && monster.monsterData.experience
                ? monster.monsterData.experience
                : 10;
        this.addExperience(experienceGain);

        this.currentSpawnDelay = this.calculateSpawnDelay();
        this.spawnTimer.delay = this.currentSpawnDelay;
    }

    cleanupBullets() {
        cleanupBullets(this);
    }

    update() {
        // Handle game over state first (before isGameActive check)
        if (this.gameOver) {
            // Handle keyboard input
            if (
                this.enterKey &&
                Phaser.Input.Keyboard.JustDown(this.enterKey)
            ) {
                this.sceneTransitioning = true;
                this.scene.start("CharacterSelection");
            }

            // Handle gamepad input (button 0 = B button, button 9 = Start button)
            if (this.gamepad && this.gamepad.buttons) {
                const button0 = this.gamepad.buttons[0];
                const button9 = this.gamepad.buttons[9];

                // Manual justDown detection for button 0 (B button)
                const button0WasPressed = this.previousButtonStates[0] || false;
                const button0IsPressed = button0 && button0.pressed;
                const button0JustPressed =
                    button0IsPressed && !button0WasPressed;

                // Manual justDown detection for button 9 (Start button)
                const button9WasPressed = this.previousButtonStates[9] || false;
                const button9IsPressed = button9 && button9.pressed;
                const button9JustPressed =
                    button9IsPressed && !button9WasPressed;

                // Update previous states
                this.previousButtonStates[0] = button0IsPressed;
                this.previousButtonStates[9] = button9IsPressed;

                // Check for button presses
                if (button0JustPressed || button9JustPressed) {
                    this.sceneTransitioning = true;
                    this.scene.start("CharacterSelection");
                    return;
                }
            }
            return;
        }

        // Handle victory state
        if (this.victory) {
            // Handle keyboard input
            if (
                this.enterKey &&
                Phaser.Input.Keyboard.JustDown(this.enterKey)
            ) {
                this.sceneTransitioning = true;
                this.scene.start("Victory", { selectedMap: this.selectedMap });
            }

            // Handle gamepad input (button 0 = B button, button 9 = Start button)
            if (this.gamepad && this.gamepad.buttons) {
                const button0 = this.gamepad.buttons[0];
                const button9 = this.gamepad.buttons[9];

                // Manual justDown detection for button 0 (B button)
                const button0WasPressed = this.previousButtonStates[0] || false;
                const button0IsPressed = button0 && button0.pressed;
                const button0JustPressed =
                    button0IsPressed && !button0WasPressed;

                // Manual justDown detection for button 9 (Start button)
                const button9WasPressed = this.previousButtonStates[9] || false;
                const button9IsPressed = button9 && button9.pressed;
                const button9JustPressed =
                    button9IsPressed && !button9WasPressed;

                // Update previous states
                this.previousButtonStates[0] = button0IsPressed;
                this.previousButtonStates[9] = button9IsPressed;

                // Check for button presses
                if (button0JustPressed || button9JustPressed) {
                    this.sceneTransitioning = true;
                    this.scene.start("Victory", {
                        selectedMap: this.selectedMap,
                    });
                    return;
                }
            }
            return;
        }

        // Now check if game is active for normal gameplay
        if (!this.isGameActive()) return;

        // Handle power-up dialog input when dialog is showing
        if (this.powerUpManager.showingDialog) {
            this.powerUpManager.handleGamepadNavigation();
            this.powerUpManager.handleKeyNavigation();
            return;
        }

        // Validate player and controls for normal gameplay
        if (!this.isSpriteValid(this.player) || !this.cursors) return;

        // Handle regeneration
        updateRegeneration(this);

        this.cleanupBullets();
        this.updateBoomerangs();
        this.shootBoomerang();
        this.shootBigBoom();

        // Handle different attack types
        if (
            this.selectedCharacter &&
            this.selectedCharacter.attackType === "flamethrower"
        ) {
            updateFlamethrower(this);
        } else {
            // Default to bullet attack
            this.shootBullet();
        }

        this.updatePlayerMovement();
        this.updateMonsterMovement();
    }

    updatePlayerMovement() {
        if (!this.isSpriteValid(this.player) || !this.cursors) return;

        // Don't allow movement in victory or game over states
        if (this.victory || this.gameOver) return;

        const speed = 200;
        const deadzone = 0.3; // Deadzone for analog stick

        // Initialize movement vector
        const movement = new Phaser.Math.Vector2(0, 0);

        // Keyboard movement - check for held keys using isDown property
        // Horizontal movement
        if (this.cursors.left.isDown || this.wasdKeys?.A?.isDown) {
            movement.x -= 1;
            this.player.flipX = true;
        }
        if (this.cursors.right.isDown || this.wasdKeys?.D?.isDown) {
            movement.x += 1;
            this.player.flipX = false;
        }

        // Vertical movement
        if (this.cursors.up.isDown || this.wasdKeys?.W?.isDown) {
            movement.y -= 1;
        }
        if (this.cursors.down.isDown || this.wasdKeys?.S?.isDown) {
            movement.y += 1;
        }

        // Gamepad movement (only if no keyboard input to avoid conflicts)
        if (this.gamepad && movement.length() === 0) {
            // D-pad input
            if (this.gamepad.left) {
                movement.x -= 1;
                this.player.flipX = true;
            }
            if (this.gamepad.right) {
                movement.x += 1;
                this.player.flipX = false;
            }
            if (this.gamepad.up) {
                movement.y -= 1;
            }
            if (this.gamepad.down) {
                movement.y += 1;
            }

            // Left analog stick (if no D-pad input)
            if (this.gamepad.leftStick && movement.length() === 0) {
                const stickX = this.gamepad.leftStick.x;
                const stickY = this.gamepad.leftStick.y;

                // Apply deadzone
                if (Math.abs(stickX) > deadzone) {
                    movement.x = stickX;
                    this.player.flipX = stickX < 0;
                }
                if (Math.abs(stickY) > deadzone) {
                    movement.y = stickY;
                }
            }
        }

        // Normalize diagonal movement to maintain consistent speed
        if (movement.length() > 1) {
            movement.normalize();
        }

        // Apply movement using velocity for proper collision handling
        if (movement.length() > 0) {
            // Scale movement by speed - Phaser's physics system handles frame rate independence
            movement.scale(speed);

            // Use physics velocity for proper collision handling
            this.player.setVelocity(movement.x, movement.y);
        } else {
            // Stop any existing velocity when not moving
            this.player.setVelocity(0, 0);
        }
    }

    updateMonsterMovement() {
        if (
            !this.isGroupValid(this.monsters) ||
            !this.isSpriteValid(this.player)
        )
            return;

        this.safeGroupForEach(this.monsters, (monster) => {
            if (!monster.setVelocity || !monster.body?.world) return;

            const currentTime = this.time.now;

            // Handle jumping state
            if (monster.isJumping) {
                const jumpDuration = 1000; // 1000ms jump duration
                if (currentTime - monster.jumpStartTime >= jumpDuration) {
                    // Jump is complete, return to walking
                    monster.isJumping = false;
                    monster.stuckTimer = 0; // Reset stuck timer
                    monster.lastPosition = { x: monster.x, y: monster.y };

                    // Re-enable collision detection
                    monster.body.checkCollision.none = false;
                    monster.body.checkCollision.up = true;
                    monster.body.checkCollision.down = true;
                    monster.body.checkCollision.left = true;
                    monster.body.checkCollision.right = true;

                    // Return to walking animation
                    if (
                        monster.monsterData &&
                        monster.monsterData.animationKey
                    ) {
                        monster.play(monster.monsterData.animationKey, true);
                    }
                }
                // During jump, continue with current velocity (don't update movement)
                this.updateMonsterHealthBar(monster);
                return;
            } // Handle attack state
            if (monster.isAttacking) {
                const attackDuration = monster.attackCooldown || 1000;
                if (currentTime - monster.lastAttackTime >= attackDuration) {
                    // Attack is complete, return to walking
                    monster.isAttacking = false;
                    console.log(
                        `Monster ${monster.monsterData.name} finished attacking, returning to walk`
                    );

                    // Return to walking animation
                    if (
                        monster.monsterData &&
                        monster.monsterData.animationKey
                    ) {
                        monster.play(monster.monsterData.animationKey, true);
                    }
                } else {
                    console.log(
                        `Monster ${
                            monster.monsterData.name
                        } still attacking, time left: ${(
                            attackDuration -
                            (currentTime - monster.lastAttackTime)
                        ).toFixed(0)}ms`
                    );
                }
                // During attack, don't update movement (monster stays in place)
                this.updateMonsterHealthBar(monster);
                return;
            }

            // Check if monster is stuck (hasn't moved much in the last second)
            const distanceMoved = Phaser.Math.Distance.Between(
                monster.x,
                monster.y,
                monster.lastPosition.x,
                monster.lastPosition.y
            );

            const stuckThreshold = 20; // pixels
            const stuckTimeThreshold = 1000; // 1 second

            if (distanceMoved < stuckThreshold) {
                monster.stuckTimer += this.game.loop.delta;

                // If stuck for too long, perform jump
                if (monster.stuckTimer >= stuckTimeThreshold) {
                    this.performMonsterJump(monster);
                    return;
                }
            } else {
                // Monster is moving, reset stuck timer and update position
                monster.stuckTimer = 0;
                monster.lastPosition = { x: monster.x, y: monster.y };
            }

            // Check distance to player for attack
            const distanceToPlayer = Phaser.Math.Distance.Between(
                monster.x,
                monster.y,
                this.player.x,
                this.player.y
            );

            // Attack if within 2 times the monster's width and attack is available
            const attackRange =
                monster.width *
                    monster.scaleX *
                    monster.monsterData.attackRangeMultiplier || 1.2;
            if (
                distanceToPlayer <= attackRange &&
                monster.monsterData &&
                monster.monsterData.attackKey &&
                currentTime - monster.lastAttackTime >= monster.attackCooldown
            ) {
                console.log(
                    `Monster ${
                        monster.monsterData.name
                    } within attack range! Distance: ${distanceToPlayer.toFixed(
                        1
                    )}, Range: ${attackRange.toFixed(1)}`
                );
                this.performMonsterAttack(monster);
                return;
            }

            const angle = Phaser.Math.Angle.Between(
                monster.x,
                monster.y,
                this.player.x,
                this.player.y
            );
            const velocity = new Phaser.Math.Vector2();

            // Use monster's individual speed from monster data, fallback to 100 if not defined
            const monsterSpeed =
                monster.monsterData && monster.monsterData.speed
                    ? monster.monsterData.speed
                    : 100;
            velocity.setToPolar(angle, monsterSpeed);

            monster.setVelocity(velocity.x, velocity.y);
            monster.flipX = velocity.x < 0;

            // Update health bar position
            this.updateMonsterHealthBar(monster);
        });
    }

    performMonsterJump(monster) {
        if (!monster.monsterData || monster.isJumping) return;

        // Set jumping state
        monster.isJumping = true;
        monster.jumpStartTime = this.time.now;

        // Disable collision detection during jump
        monster.body.checkCollision.none = true;

        // Play jump animation if available
        if (monster.monsterData.jumpKey) {
            const jumpAnimationKey = monster.monsterData.jumpKey;
            if (this.anims.exists(jumpAnimationKey)) {
                monster.play(jumpAnimationKey, true);
            }
        }

        // Calculate jump direction (towards player)
        const angle = Phaser.Math.Angle.Between(
            monster.x,
            monster.y,
            this.player.x,
            this.player.y
        );

        // Jump distance is 1.25x their width
        const jumpDistance = monster.width * monster.scaleX * 1.25;

        // Calculate the target position (jump towards player)
        const targetX = monster.x + Math.cos(angle) * jumpDistance;
        const targetY = monster.y + Math.sin(angle) * jumpDistance;

        // Calculate velocity needed to reach target in jump duration
        const jumpDuration = 1000; // 1000ms jump duration
        const jumpVelocityX = (targetX - monster.x) / (jumpDuration / 1000);
        const jumpVelocityY = (targetY - monster.y) / (jumpDuration / 1000);

        // Apply jump velocity towards player
        monster.setVelocity(jumpVelocityX, jumpVelocityY);
        monster.flipX = jumpVelocityX < 0;

        console.log(
            `Monster ${monster.monsterData.name} is jumping! Distance: ${jumpDistance}`
        );
    }

    performMonsterAttack(monster) {
        if (!monster.monsterData || monster.isAttacking || monster.isJumping)
            return;

        // Set attacking state
        monster.isAttacking = true;
        monster.lastAttackTime = this.time.now;

        // Stop monster movement during attack
        monster.setVelocity(0, 0);

        // Stop current animation and play attack animation if available
        if (monster.monsterData.attackKey) {
            const attackAnimationKey = monster.monsterData.attackKey;
            console.log(
                `Trying to play attack animation: ${attackAnimationKey}`
            );
            console.log(
                `Animation exists: ${this.anims.exists(attackAnimationKey)}`
            );
            if (this.anims.exists(attackAnimationKey)) {
                // Stop current animation first to prevent override
                monster.stop();
                monster.play(attackAnimationKey, true);
                console.log(
                    `Attack animation ${attackAnimationKey} started playing`
                );
            } else {
                console.warn(
                    `Attack animation ${attackAnimationKey} does not exist!`
                );
            }
        } else {
            console.warn(
                `Monster ${monster.monsterData.name} has no attackKey`
            );
        }

        console.log(
            `Monster ${
                monster.monsterData.name
            } is attacking! Distance to player: ${Phaser.Math.Distance.Between(
                monster.x,
                monster.y,
                this.player.x,
                this.player.y
            ).toFixed(1)}`
        );
    }

    selectMonsterByRarity(availableMonsterNames, monstersData) {
        // Create weighted list based on rarity values
        const weightedMonsters = [];

        availableMonsterNames.forEach((monsterName) => {
            const monster = monstersData[monsterName];
            if (monster && monster.rarity) {
                // Add monster to weighted list based on its rarity
                for (let i = 0; i < monster.rarity; i++) {
                    weightedMonsters.push(monsterName);
                }
            }
        });

        // If no monsters have rarity values, fall back to uniform random selection
        if (weightedMonsters.length === 0) {
            console.warn(
                "No monsters found with rarity values, using uniform random selection"
            );
            return Phaser.Utils.Array.GetRandom(availableMonsterNames);
        }

        // Select randomly from the weighted list
        return Phaser.Utils.Array.GetRandom(weightedMonsters);
    }

    calculateDistanceBasedDamage(baseDamage, monster) {
        // Calculate distance between player and monster
        const distance = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            monster.x,
            monster.y
        );

        // Define a reasonable max distance for damage calculation (e.g., screen width)
        const maxDistance = 800; // Adjust this value based on your game's scale

        // Normalize distance to 0-1 range (0 = very close, 1 = max distance)
        const normalizedDistance = Math.min(distance / maxDistance, 1);

        // Calculate damage multiplier: 1.2 (close) to 0.8 (far)
        // When normalizedDistance = 0 (close), multiplier = 1.2
        // When normalizedDistance = 1 (far), multiplier = 0.8
        const damageMultiplier = 1.2 - normalizedDistance * 0.4;

        // Apply multiplier to base damage and round to integer
        return Math.round(baseDamage * damageMultiplier);
    }
}
