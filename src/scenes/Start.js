export class Start extends Phaser.Scene {

    constructor() {
        super('Start');
        this.score = 0;
        this.lastShotTime = 0;
        this.fireRate = 500; // Default, will be overridden by character data
        this.currentSpawnDelay = 500; // Start with 0.5 second delay
        this.health = 100; // Player health - will be overridden by character data
        this.maxHealth = 100; // Max health - will be overridden by character data
        this.gameOver = false;
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
        this.showingPowerUpDialog = false;
        
        // Session timer
        this.sessionStartTime = null;
        this.sessionTimer = null;
        this.sessionDuration = 0; // in seconds
        
        // Map selection
        this.selectedMap = null; // Will store selected map data
        this.currentMapLayers = []; // Track created layers for collision setup
        
        // Scene transition management
        this.sceneTransitioning = false; // Flag to prevent updates during scene transitions
    }

    // Centralized safety utility methods
    isGameActive() {
        return this.scene?.isActive() && this.scene?.isVisible() && !this.gameOver && !this.sceneTransitioning;
    }

    isGroupValid(group) {
        return group?.scene === this && group?.world === this.physics.world;
    }

    isSpriteValid(sprite) {
        return sprite?.active && sprite?.body && !sprite.body.destroyed && 
               typeof sprite.x === 'number' && typeof sprite.y === 'number';
    }

    safeGroupForEach(group, callback) {
        if (!this.isGroupValid(group)) return;
        
        try {
            const children = group.getChildren();
            if (Array.isArray(children)) {
                children.forEach(child => {
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
        if (sound?.play && this.sound?.context?.state === 'running') {
            sound.play();
        }
    }

    init() {
        // Reset game state when scene starts
        this.score = 0;
        // Don't reset health here - it will be set properly in initializeGame() based on character data
        this.gameOver = false;
        this.sceneTransitioning = false; // Reset transition flag
        this.currentSpawnDelay = 500;
        this.lastShotTime = 0;
        this.lastBoomerangTime = 0;
        this.lastBigBoomTime = 0;
        this.experience = 0;
        this.level = 1;
        this.boomerangCount = 0;
        this.bigBoomCount = 0;
        this.bulletScale = 1.0;
        this.showingPowerUpDialog = false;
        
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
    }

    preload() {
        // Load maps configuration
        this.load.json('maps-data', 'assets/maps/maps.json');
        
        // Load characters data 
        this.load.json('characters-data', 'assets/characters/characters.json');

        // Note: Monster sprites will be loaded dynamically based on selected map
        
        // Load effects
        this.load.spritesheet('blue-explosion', 'assets/effects/blue-explosion.png', { frameWidth: 32, frameHeight: 32 });
        
        // Load boomerang
        this.load.image('boomerang', 'assets/super/boomerang.png');

        // Load big boom
        this.load.spritesheet('big-boom', 'assets/super/white-boom.png', { frameWidth: 32, frameHeight: 32 });
        
        // Load sound effects
        this.load.audio('laser', 'assets/sfx/laser-1.wav');
        this.load.audio('hurt', 'assets/sfx/hurt-1.wav');
        this.load.audio('male-hurt', 'assets/sfx/male-hurt-1.wav');
        
        // Load background music
        this.load.audio('background-music', 'assets/music/twilight-of-the-dead.mp3');
    }

    create() {
        // Load map assets first, then character images
        this.loadMapAssets();
    }
    
    loadMapAssets() {
        // Randomly select a map
        const mapsData = this.cache.json.get('maps-data');
        const mapNames = Object.keys(mapsData);
        const randomMapName = Phaser.Utils.Array.GetRandom(mapNames);
        this.selectedMap = mapsData[randomMapName];
        
        console.log('Selected map:', this.selectedMap.name);
        
        // Load map tilesets and JSON
        const tilesToLoad = [];
        
        // Load tilesets
        this.selectedMap.tilesets.forEach(tileset => {
            if (!this.textures.exists(tileset.key)) {
                tilesToLoad.push({ key: tileset.key, path: `assets/maps/${tileset.file}` });
            }
        });
        
        // Load monsters for this map
        const monstersToLoad = [];
        if (this.selectedMap.monsters) {
            this.selectedMap.monsters.forEach(monster => {
                if (!this.textures.exists(monster.key)) {
                    monstersToLoad.push({ 
                        key: monster.key, 
                        path: `assets/monsters/${monster.file}`,
                        monsterData: monster
                    });
                }
            });
        }
        
        // Load tilemap JSON
        if (!this.cache.tilemap.exists(this.selectedMap.tiledJson.key)) {
            this.load.tilemapTiledJSON(this.selectedMap.tiledJson.key, `assets/maps/${this.selectedMap.tiledJson.file}`);
        }
        
        // Load character images dynamically if not already loaded
        const charactersData = this.cache.json.get('characters-data');
        const imagesToLoad = [];
        
        charactersData.forEach(character => {
            const imageKey = character.image.replace('.png', '');
            if (!this.textures.exists(imageKey)) {
                imagesToLoad.push({ key: imageKey, path: `assets/characters/${character.image}` });
            }
        });
        
        // Combine all assets to load (including monsters)
        const allAssetsToLoad = [...tilesToLoad, ...monstersToLoad, ...imagesToLoad];
        
        // If there are assets to load, load them before continuing
        if (allAssetsToLoad.length > 0 || !this.cache.tilemap.exists(this.selectedMap.tiledJson.key)) {
            let loadedCount = 0;
            const totalToLoad = allAssetsToLoad.length + (this.cache.tilemap.exists(this.selectedMap.tiledJson.key) ? 0 : 1);
            
            // Load assets (tilesets and character images)
            allAssetsToLoad.forEach(asset => {
                if (asset.monsterData) {
                    // Load monster as spritesheet
                    this.load.spritesheet(asset.key, asset.path, { 
                        frameWidth: asset.monsterData.frameWidth, 
                        frameHeight: asset.monsterData.frameHeight 
                    });
                    this.load.on(`filecomplete-spritesheet-${asset.key}`, () => {
                        loadedCount++;
                        if (loadedCount === totalToLoad) {
                            this.initializeGame();
                        }
                    });
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
                this.load.on(`filecomplete-tilemapJSON-${this.selectedMap.tiledJson.key}`, () => {
                    loadedCount++;
                    if (loadedCount === totalToLoad) {
                        this.initializeGame();
                    }
                });
            }
            
            this.load.start();
        } else {
            // All assets already loaded, proceed immediately
            this.initializeGame();
        }
    }
    
    initializeGame() {
        // Get selected character data
        this.selectedCharacter = this.registry.get('selectedCharacter');
        if (this.selectedCharacter) {
            this.fireRate = this.selectedCharacter.fireRate;
            this.boomerangCount = this.selectedCharacter.boomerang || 0;
            this.bigBoomCount = this.selectedCharacter.bigBoom || 0;
            this.maxHealth = this.selectedCharacter.health || 100;
            this.health = this.maxHealth; // Set current health to max health
        } else {
            // Fallback to first character from data if none selected
            const charactersData = this.cache.json.get('characters-data');
            this.selectedCharacter = charactersData[0] || {
                name: "vonhagel.eth",
                image: "42161-4000000009-transparent.png",
                fireRate: 500,
                boomerang: 0,
                bigBoom: 0,
                health: 100,
                nft_id: "42161-4000000009"
            };
            this.fireRate = this.selectedCharacter.fireRate;
            this.boomerangCount = this.selectedCharacter.boomerang || 0;
            this.bigBoomCount = this.selectedCharacter.bigBoom || 0;
            this.maxHealth = this.selectedCharacter.health || 100;
            this.health = this.maxHealth; // Set current health to max health
        }

        // Set up the map dynamically
        const map = this.make.tilemap({ 
            key: this.selectedMap.tiledJson.key, 
            tileWidth: this.selectedMap.tilesetSize.width, 
            tileHeight: this.selectedMap.tilesetSize.height 
        });
        
        // Add tilesets
        const tilesets = [];
        this.selectedMap.tilesets.forEach(tilesetData => {
            const tileset = map.addTilesetImage(tilesetData.name, tilesetData.key);
            tilesets.push(tileset);
        });
        
        // Create layers and track them for collision setup
        this.currentMapLayers = [];
        this.selectedMap.layers.forEach(layerData => {
            const layer = map.createLayer(layerData.name, tilesets, 0, 0);
            if (layer) {
                this.currentMapLayers.push({
                    layer: layer,
                    collision: layerData.collision
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
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setZoom(1);
        
        // Use selected character sprite or default to first character
        const characterSprite = this.selectedCharacter ? this.selectedCharacter.image.replace('.png', '') : '42161-4000000009-0x57a482ea32c7f75a9c0734206f5bd4f9bcb38e12';
        this.player = this.physics.add.sprite(640, 360, characterSprite);
        this.player.setCollideWorldBounds(true);
        this.player.setScale(0.3);
        
        // Adjust player collision bounds to 50% of sprite size
        const playerWidth = this.player.width * 0.35;
        const playerHeight = this.player.height * 0.8;
        this.player.body.setSize(playerWidth, playerHeight);
        
        this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

        // Add score display
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '32px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.scoreText.setScrollFactor(0); // Keep UI fixed to camera

        // Add character info display
        if (this.selectedCharacter) {
            this.characterInfoText = this.add.text(16, 56, this.getCharacterInfoText(), {
                fontSize: '16px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 1
            });
            this.characterInfoText.setScrollFactor(0);
        }

        // Start session timer that updates every second
        this.sessionTimer = this.time.addEvent({
            delay: 1000,
            callback: this.updateSessionTimer,
            callbackScope: this,
            loop: true
        });
        
        // Add health bar
        this.createHealthBar();
        
        // Update health bar to show correct values for the selected character
        this.updateHealthBar();

        // Add experience bar
        this.createExperienceBar();

        this.cursors = this.input.keyboard.createCursorKeys();

        // Add bullet group
        this.bullets = this.physics.add.group();
        
        // Add boomerang group
        this.boomerangs = this.physics.add.group();
        
        // Add Big Boom group
        this.bigBooms = this.physics.add.group();
        
        // Create monster group (moved before collision setup)
        this.imps = this.physics.add.group();
        
        // Create animations
        this.anims.create({
            key: 'explosion',
            frames: this.anims.generateFrameNumbers('blue-explosion', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: 0
        });

        // Add Big Boom animation
        this.anims.create({
            key: 'big-boom',
            frames: this.anims.generateFrameNumbers('big-boom', { start: 0, end: 15 }),
            frameRate: 24,
            repeat: 0
        });

        // Create monster animations dynamically based on selected map
        if (this.selectedMap && this.selectedMap.monsters) {
            this.selectedMap.monsters.forEach(monster => {
                this.anims.create({
                    key: monster.animationKey,
                    frames: this.anims.generateFrameNumbers(monster.key, { 
                        start: monster.animationStart, 
                        end: monster.animationEnd 
                    }),
                    frameRate: monster.animationFrameRate || 8,
                    repeat: -1
                });
            });
        }

        // Setup bullet-monster collision (moved after groups are created)
        this.physics.add.overlap(this.bullets, this.imps, this.onBulletHitImp, null, this);

        // Setup boomerang-monster collision
        this.physics.add.overlap(this.boomerangs, this.imps, this.onBoomerangHitImp, null, this);

        // Setup Big Boom-monster collision
        this.physics.add.overlap(this.bigBooms, this.imps, this.onBigBoomHitImp, null, this);

        // Setup player-monster collision
        this.physics.add.overlap(this.player, this.imps, this.onPlayerHitImp, null, this);

        // Setup collisions with map layers that have collision enabled
        this.currentMapLayers.forEach(mapLayer => {
            if (mapLayer.collision) {
                this.physics.add.collider(this.player, mapLayer.layer);
                this.physics.add.collider(this.imps, mapLayer.layer);
            }
        });

        // Setup input handlers
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.enterKey.on('down', () => {
            if (this.gameOver) {
                console.log('Game over detected, switching to character selection...');
                
                // Add a small delay to ensure proper cleanup
                this.time.delayedCall(100, () => {
                    this.scene.start('CharacterSelection');
                });
            }
        });

        // Create sound effects
        this.laserSound = this.sound.add('laser', { volume: 0.05 });
        this.hurtSound = this.sound.add('hurt', { volume: 0.75 });
        this.maleHurtSound = this.sound.add('male-hurt', { volume: 0.5 });

        // Add background music - use global registry to prevent overlaps
        let globalBackgroundMusic = this.registry.get('backgroundMusic');
        
        if (!globalBackgroundMusic || !globalBackgroundMusic.isPlaying) {
            // Stop any existing background music first
            if (globalBackgroundMusic) {
                globalBackgroundMusic.stop();
                globalBackgroundMusic.destroy();
            }
            
            this.backgroundMusic = this.sound.add('background-music', { 
                volume: 0.3, 
                loop: true 
            });
            this.backgroundMusic.play();
            
            // Store in global registry
            this.registry.set('backgroundMusic', this.backgroundMusic);
        } else {
            // Use existing background music
            this.backgroundMusic = globalBackgroundMusic;
        }

        // Start spawning monsters
        this.spawnTimer = this.time.addEvent({
            delay: this.currentSpawnDelay,
            callback: this.spawnImp,
            callbackScope: this,
            loop: true
        });

        // Start session timer
        this.sessionStartTime = this.time.now;
        this.sessionTimer = this.time.addEvent({
            delay: 1000, // 1 second
            callback: this.updateSessionTime,
            callbackScope: this,
            loop: true
        });
    }

    formatSessionTime() {
        const minutes = Math.floor(this.sessionDuration / 60);
        const seconds = this.sessionDuration % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    getCharacterInfoText() {
        if (!this.selectedCharacter) return '';
        return `Character: ${this.selectedCharacter.name}\nHealth: ${this.health}/${this.maxHealth}\nSession: ${this.formatSessionTime()}\nLevel: ${this.level}\nFire Rate: ${this.fireRate}ms\nMap: ${this.selectedMap ? this.selectedMap.name : 'Loading...'}`;
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
        this.healthBarBg = this.add.rectangle(x, y, barWidth + 4, barHeight + 4, 0x000000);
        this.healthBarBg.setOrigin(0, 0);
        this.healthBarBg.setScrollFactor(0);
        this.healthBarBg.setDepth(1000);

        // Health bar fill (yellow)
        this.healthBar = this.add.rectangle(x + 2, y + 2, barWidth, barHeight, 0xffff00);
        this.healthBar.setOrigin(0, 0);
        this.healthBar.setScrollFactor(0);
        this.healthBar.setDepth(1001);

        // Health text
        this.healthText = this.add.text(x + barWidth/2, y + barHeight/2, `${this.health}/${this.maxHealth}`, {
            fontSize: '14px',
            fill: '#000000'
        });
        this.healthText.setOrigin(0.5, 0.5);
        this.healthText.setScrollFactor(0);
        this.healthText.setDepth(1002);
    }

    updateHealthBar() {
        const healthPercent = this.health / this.maxHealth;
        const barWidth = 200;
        this.healthBar.width = barWidth * healthPercent;
        this.healthText.setText(`${this.health}/${this.maxHealth}`);
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
            const expForNextLevel = this.getExperienceRequiredForLevel(level + 1);
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
        this.expBarBg = this.add.rectangle(x, y, barWidth + 4, barHeight + 4, 0x000000);
        this.expBarBg.setOrigin(0, 0);
        this.expBarBg.setScrollFactor(0);
        this.expBarBg.setDepth(1000);

        // Experience bar fill (blue)
        this.expBar = this.add.rectangle(x + 2, y + 2, barWidth, barHeight, 0x0080ff);
        this.expBar.setOrigin(0, 0);
        this.expBar.setScrollFactor(0);
        this.expBar.setDepth(1001);
        this.expBar.width = 0; // Start empty

        // Experience text (inside the bar)
        this.expText = this.add.text(x + barWidth/2, y + barHeight/2, '0/100', {
            fontSize: '12px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 1
        });
        this.expText.setOrigin(0.5, 0.5);
        this.expText.setScrollFactor(0);
        this.expText.setDepth(1002);
    }

    updateExperienceBar() {
        const currentLevel = this.getLevelFromExperience(this.experience);
        const totalExpForCurrentLevel = this.getTotalExperienceForLevel(currentLevel);
        const expForNextLevel = this.getExperienceRequiredForLevel(currentLevel + 1);
        const currentLevelProgress = this.experience - totalExpForCurrentLevel;
        
        // Update level if it changed
        if (currentLevel !== this.level) {
            this.level = currentLevel;
            // Update character info text to show new level
            if (this.selectedCharacter && this.characterInfoText) {
                this.characterInfoText.setText(this.getCharacterInfoText());
            }
            
            // Show power-up selection dialog on level up
            this.showPowerUpDialog();
        }
        
        const progressPercent = expForNextLevel > 0 ? currentLevelProgress / expForNextLevel : 1;
        const barWidth = 200;
        
        this.expBar.width = barWidth * progressPercent;
        
        if (expForNextLevel > 0) {
            this.expText.setText(`${currentLevelProgress}/${expForNextLevel}`);
        } else {
            this.expText.setText('MAX');
        }
    }

    addExperience(amount) {
        this.experience += amount;
        this.updateExperienceBar();
    }

    showPowerUpDialog() {
        if (this.showingPowerUpDialog) return;
        
        // Don't show dialog if at max level (level 20)
        if (this.level >= 20) return;
        
        this.showingPowerUpDialog = true;
        this.physics.pause(); // Pause the game
        
        // Pause the spawn timer to prevent imps from spawning during power-up selection
        if (this.spawnTimer) {
            this.spawnTimer.paused = true;
        }
        
        // Create semi-transparent overlay
        this.powerUpOverlay = this.add.rectangle(
            this.cameras.main.centerX, 
            this.cameras.main.centerY, 
            this.cameras.main.width, 
            this.cameras.main.height, 
            0x000000, 
            0.7
        );
        this.powerUpOverlay.setScrollFactor(0);
        this.powerUpOverlay.setDepth(2000);
        
        // Create dialog box
        this.powerUpDialog = this.add.rectangle(
            this.cameras.main.centerX, 
            this.cameras.main.centerY, 
            400, 
            300, 
            0x333333
        );
        this.powerUpDialog.setScrollFactor(0);
        this.powerUpDialog.setDepth(2001);
        this.powerUpDialog.setStrokeStyle(4, 0xffffff);
        
        // Title
        this.powerUpTitle = this.add.text(
            this.cameras.main.centerX, 
            this.cameras.main.centerY - 120, 
            'LEVEL UP!\nChoose a Power-Up:', 
            {
                fontSize: '24px',
                fill: '#ffffff',
                align: 'center'
            }
        );
        this.powerUpTitle.setOrigin(0.5);
        this.powerUpTitle.setScrollFactor(0);
        this.powerUpTitle.setDepth(2002);
        
        // Power-up options
        const currentFireRateMs = this.fireRate;
        const newFireRateMs = Math.max(100, this.fireRate - 50);
        const boomerangCount = this.boomerangCount;
        const bigBoomCount = this.bigBoomCount;
        const bulletScale = this.bulletScale;
        
        // Collect all available power-up options
        const availablePowerUps = [];
        
        // Add attack speed option only if not at minimum (100ms)
        if (currentFireRateMs > 100) {
            availablePowerUps.push({
                title: 'Attack Speed +50ms',
                description: `Fire rate: ${currentFireRateMs}ms → ${newFireRateMs}ms`,
                type: 1
            });
        }
        
        // Add boomerang option only if not at max (8)
        if (boomerangCount < 8) {
            availablePowerUps.push({
                title: 'Extra Boomerang',
                description: `Boomerangs: ${boomerangCount} → ${Math.min(8, boomerangCount + 1)}`,
                type: 2
            });
        }
        
        // Add big boom option only if not at max (5) 
        if (bigBoomCount < 5) {
            availablePowerUps.push({
                title: 'Extra Big Boom',
                description: `Big Booms: ${bigBoomCount} → ${Math.min(5, bigBoomCount + 1)}`,
                type: 3
            });
        }
        
        // Add bullet size option only if not at max (4.0x scale)
        if (bulletScale < 4.0) {
            const newBulletScale = Math.min(4.0, bulletScale + 0.5);
            const nextUpgradeCount = this.bulletSizeUpgradeCount + 1;
            let description = `Bullet size: ${bulletScale.toFixed(2)}x → ${newBulletScale.toFixed(2)}x`;
            if (nextUpgradeCount > 3) {
                description += ` (Penetrates enemies!)`;
            }
            availablePowerUps.push({
                title: 'Bigger Bullets',
                description: description,
                type: 4
            });
        }
        
        // Randomly select up to 3 options from available power-ups
        const maxOptions = Math.min(3, availablePowerUps.length);
        const selectedPowerUps = Phaser.Utils.Array.Shuffle(availablePowerUps).slice(0, maxOptions);
        
        // Create power-up options with sequential numbering
        selectedPowerUps.forEach((powerUp, index) => {
            this.createPowerUpOption(index + 1, powerUp.title, powerUp.description, powerUp.type);
        });
    }
    
    createPowerUpOption(index, title, description, powerUpType) {
        const y = this.cameras.main.centerY - 40 + (index - 1) * 60;
        
        // Option background
        const optionBg = this.add.rectangle(
            this.cameras.main.centerX, 
            y, 
            350, 
            50, 
            0x555555
        );
        optionBg.setScrollFactor(0);
        optionBg.setDepth(2001);
        optionBg.setStrokeStyle(2, 0x888888);
        optionBg.setInteractive();
        
        // Option text
        const optionText = this.add.text(
            this.cameras.main.centerX, 
            y - 8, 
            `${index}. ${title}`, 
            {
                fontSize: '18px',
                fill: '#ffffff',
                fontStyle: 'bold'
            }
        );
        optionText.setOrigin(0.5);
        optionText.setScrollFactor(0);
        optionText.setDepth(2002);
        
        // Description text
        const descText = this.add.text(
            this.cameras.main.centerX, 
            y + 12, 
            description, 
            {
                fontSize: '12px',
                fill: '#cccccc'
            }
        );
        descText.setOrigin(0.5);
        descText.setScrollFactor(0);
        descText.setDepth(2002);
        
        // Store references for cleanup
        if (!this.powerUpElements) this.powerUpElements = [];
        if (!this.powerUpKeys) this.powerUpKeys = [];
        this.powerUpElements.push(optionBg, optionText, descText);
        
        // Add hover effects
        optionBg.on('pointerover', () => {
            optionBg.setFillStyle(0x666666);
        });
        
        optionBg.on('pointerout', () => {
            optionBg.setFillStyle(0x555555);
        });
        
        // Add click handler
        optionBg.on('pointerdown', () => {
            this.selectPowerUp(powerUpType);
        });
        
        // Add keyboard input and store reference for cleanup
        let keyCode;
        switch(index) {
            case 1:
                keyCode = Phaser.Input.Keyboard.KeyCodes.ONE;
                break;
            case 2:
                keyCode = Phaser.Input.Keyboard.KeyCodes.TWO;
                break;
            case 3:
                keyCode = Phaser.Input.Keyboard.KeyCodes.THREE;
                break;
            case 4:
                keyCode = Phaser.Input.Keyboard.KeyCodes.FOUR;
                break;
        }
        
        const key = this.input.keyboard.addKey(keyCode);
        key.on('down', () => {
            this.selectPowerUp(powerUpType);
        });
        this.powerUpKeys.push(key);
    }
    
    selectPowerUp(powerUpIndex) {
        switch(powerUpIndex) {
            case 1:
                // Attack Speed -50ms (minimum 100ms)
                this.fireRate = Math.max(100, this.fireRate - 50);
                break;
            case 2:
                // Extra Boomerang
                this.boomerangCount = Math.min(8, this.boomerangCount + 1);
                break;
            case 3:
                // Extra Big Boom
                this.bigBoomCount = Math.min(5, this.bigBoomCount + 1);
                break;
            case 4:
                // Bigger Bullets
                this.bulletScale = Math.min(4.0, this.bulletScale + 0.5);
                this.bulletSizeUpgradeCount++;
                break;
        }
        
        // Update character info text to reflect new stats
        if (this.selectedCharacter && this.characterInfoText) {
            this.characterInfoText.setText(this.getCharacterInfoText());
        }
        
        this.hidePowerUpDialog();
    }
    
    hidePowerUpDialog() {
        this.showingPowerUpDialog = false;
        this.physics.resume(); // Resume the game
        
        // Resume the spawn timer
        if (this.spawnTimer) {
            this.spawnTimer.paused = false;
        }
        
        // Clean up dialog elements
        if (this.powerUpOverlay) {
            this.powerUpOverlay.destroy();
            this.powerUpOverlay = null;
        }
        
        if (this.powerUpDialog) {
            this.powerUpDialog.destroy();
            this.powerUpDialog = null;
        }
        
        if (this.powerUpTitle) {
            this.powerUpTitle.destroy();
            this.powerUpTitle = null;
        }
        
        if (this.powerUpElements) {
            this.powerUpElements.forEach(element => element.destroy());
            this.powerUpElements = [];
        }
        
        // Remove only power-up specific keyboard listeners
        if (this.powerUpKeys) {
            this.powerUpKeys.forEach(key => {
                key.removeAllListeners();
                this.input.keyboard.removeKey(key);
            });
            this.powerUpKeys = [];
        }
    }

    onPlayerHitImp(player, imp) {
        if (this.gameOver) return;

        this.playSoundSafe(this.maleHurtSound);
        
        this.health = Math.max(0, this.health - 25);
        this.updateHealthBar();
        
        if (this.characterInfoText) {
            this.characterInfoText.setText(this.getCharacterInfoText());
        }

        imp.destroy();

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
        
        // Only stop background music if we're leaving the game completely
        // For character selection, keep music playing
        const globalBackgroundMusic = this.registry.get('backgroundMusic');
        if (globalBackgroundMusic && globalBackgroundMusic.isPlaying) {
            // Keep music playing for character selection
            console.log('Keeping background music playing');
        }
        
        // Clean up enter key only when shutting down
        if (this.enterKey) {
            this.enterKey.removeAllListeners();
            this.enterKey = null;
        }
        console.log('Start scene shutdown');
    }

    triggerGameOver() {
        this.gameOver = true;
        
        // Stop session timer
        if (this.sessionTimer) {
            this.sessionTimer.destroy();
            this.sessionTimer = null;
        }
        
        // Stop spawning imps
        this.spawnTimer?.destroy();
        
        // Stop player movement
        if (this.isSpriteValid(this.player)) {
            this.player.setVelocity(0, 0);
        }
        
        // Stop all imps
        this.safeGroupForEach(this.imps, (imp) => {
            imp.setVelocity(0, 0);
        });

        // Show game over text
        this.gameOverText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 
            'GAME OVER\nPress ENTER to select character', {
            fontSize: '48px',
            fill: '#ff0000',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        this.gameOverText.setOrigin(0.5, 0.5);
        this.gameOverText.setScrollFactor(0);
    }

    restartGame() {
        // Reset game state
        this.score = 0;
        // Reset health and maxHealth based on selected character
        this.maxHealth = this.selectedCharacter ? (this.selectedCharacter.health || 100) : 100;
        this.health = this.maxHealth;
        this.gameOver = false;
        this.currentSpawnDelay = 500;
        this.lastShotTime = 0;
        this.lastBoomerangTime = 0;
        this.lastBigBoomTime = 0;
        this.experience = 0;
        this.level = 1;
        
        // Reset power-ups
        this.fireRate = this.selectedCharacter ? this.selectedCharacter.fireRate : 500;
        this.boomerangCount = this.selectedCharacter ? (this.selectedCharacter.boomerang || 0) : 0;
        this.bigBoomCount = this.selectedCharacter ? (this.selectedCharacter.bigBoom || 0) : 0;
        this.bulletScale = 1.0;
        this.showingPowerUpDialog = false;

        // Update UI
        this.scoreText.setText('Score: 0');
        this.updateHealthBar();
        this.updateExperienceBar();

        // Remove game over text
        if (this.gameOverText) {
            this.gameOverText.destroy();
        }

        // Clear all imps and bullets
        this.imps.clear(true, true);
        this.bullets.clear(true, true);
        this.boomerangs.clear(true, true);
        this.bigBooms.clear(true, true);

        // Reset player position
        this.player.setPosition(640, 360);
        this.player.setVelocity(0, 0);

        // Restart imp spawning
        this.spawnTimer = this.time.addEvent({
            delay: this.currentSpawnDelay,
            callback: this.spawnImp,
            callbackScope: this,
            loop: true
        });
    }

    spawnImp() {
        if (!this.isGameActive() || this.showingPowerUpDialog || !this.isGroupValid(this.imps)) return;
        
        // Get random position at the edge of the visible area
        const edge = Phaser.Math.Between(0, 3);
        let x, y;
        const buffer = 50;  // Spawn slightly outside the camera view

        const camera = this.cameras.main;
        const camBounds = {
            left: camera.scrollX - buffer,
            right: camera.scrollX + camera.width + buffer,
            top: camera.scrollY - buffer,
            bottom: camera.scrollY + camera.height + buffer
        };

        switch(edge) {
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
            // Select a random monster from the current map
            if (!this.selectedMap || !this.selectedMap.monsters || this.selectedMap.monsters.length === 0) {
                console.warn('No monsters defined for selected map');
                return;
            }
            
            const randomMonster = Phaser.Utils.Array.GetRandom(this.selectedMap.monsters);
            const monster = this.imps.create(x, y, randomMonster.key);
            
            if (monster) {
                monster.play(randomMonster.animationKey);
                monster.setCollideWorldBounds(true);
                monster.setScale(randomMonster.scale || 2);
                
                // Adjust monster collision bounds based on monster data
                
                const monsterWidth = monster.width * (randomMonster.collisionWidthScale || 0.5);
                const monsterHeight = monster.height * (randomMonster.collisionHeightScale || 0.8);
                
                monster.body.setSize(monsterWidth, monsterHeight);
            }
        } catch (error) {
            console.warn('Error creating monster:', error);
        }
    }

    findNearestImp() {
        if (!this.isGroupValid(this.imps) || !this.isSpriteValid(this.player)) return null;
        
        let nearestMonster = null;
        let shortestDistance = Infinity;
        
        this.safeGroupForEach(this.imps, (monster) => {
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestMonster = monster;
            }
        });
        
        return nearestMonster;
    }

    shootBullet() {
        if (!this.isGameActive() || !this.isGroupValid(this.bullets) || !this.isSpriteValid(this.player)) return;
        
        const currentTime = this.time.now;
        if (currentTime - this.lastShotTime < this.fireRate) return;

        this.lastShotTime = currentTime;
        this.playSoundSafe(this.laserSound);

        try {
            const bullet = this.bullets.create(this.player.x, this.player.y, 'blue-explosion');
            if (!bullet) return;
            
            bullet.setFrame(0);
            bullet.setScale(this.bulletScale);
            
            // Add visual effect for penetrating bullets
            if (this.bulletSizeUpgradeCount > 3) {
                bullet.setTint(0x7fff00);
                bullet.setBlendMode(Phaser.BlendModes.ADD);
            }
            
            const nearestMonster = this.findNearestImp();
            const angle = nearestMonster ? 
                Phaser.Math.Angle.Between(this.player.x, this.player.y, nearestMonster.x, nearestMonster.y) :
                Phaser.Math.FloatBetween(0, Math.PI * 2);
            
            const velocity = new Phaser.Math.Vector2();
            velocity.setToPolar(angle, 300);
            bullet.setVelocity(velocity.x, velocity.y);
        } catch (error) {
            console.warn('Error creating bullet:', error);
        }
    }

    shootBoomerang() {
        if (!this.isGameActive() || this.boomerangCount <= 0 || !this.isGroupValid(this.boomerangs)) return;
        
        const currentTime = this.time.now;
        if (currentTime - this.lastBoomerangTime < this.boomerangCooldown) return;

        this.lastBoomerangTime = currentTime;

        try {
            for (let i = 0; i < this.boomerangCount; i++) {
                const boomerang = this.boomerangs.create(this.player.x, this.player.y, 'boomerang');
                if (!boomerang) continue;
                
                boomerang.setScale(4);
                
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                
                // Store boomerang properties
                Object.assign(boomerang, {
                    startX: this.player.x,
                    startY: this.player.y,
                    angle: angle,
                    travelDistance: 360,
                    distanceTraveled: 0,
                    returning: false,
                    speed: 500
                });
                
                const velocity = new Phaser.Math.Vector2();
                velocity.setToPolar(angle, boomerang.speed);
                boomerang.setVelocity(velocity.x, velocity.y);
            }
        } catch (error) {
            console.warn('Error creating boomerang:', error);
        }
    }

    shootBigBoom() {
        if (!this.isGameActive() || this.bigBoomCount <= 0 || !this.isGroupValid(this.bigBooms)) return;
        
        const currentTime = this.time.now;
        if (currentTime - this.lastBigBoomTime < this.bigBoomCooldown) return;

        this.lastBigBoomTime = currentTime;

        try {
            for (let i = 0; i < this.bigBoomCount; i++) {
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const distance = 300;
                
                const x = this.player.x + Math.cos(angle) * distance;
                const y = this.player.y + Math.sin(angle) * distance;

                const bigBoom = this.bigBooms.create(x, y, 'big-boom');
                if (!bigBoom) continue;
                
                bigBoom.setScale(8);
                bigBoom.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
                bigBoom.play('big-boom');
                bigBoom.body.setSize(32, 32);
                
                bigBoom.once('animationcomplete', () => {
                    if (bigBoom?.active) bigBoom.destroy();
                });
            }
        } catch (error) {
            console.warn('Error creating big boom:', error);
        }
    }

    updateBoomerangs() {
        if (!this.isGroupValid(this.boomerangs) || !this.isSpriteValid(this.player)) return;
        
        this.safeGroupForEach(this.boomerangs, (boomerang) => {
            boomerang.rotation += 0.3;
            
            const currentDistance = Phaser.Math.Distance.Between(
                boomerang.startX, boomerang.startY, 
                boomerang.x, boomerang.y
            );
            
            if (!boomerang.returning && currentDistance >= boomerang.travelDistance) {
                boomerang.returning = true;
            }
            
            if (boomerang.returning) {
                const angle = Phaser.Math.Angle.Between(
                    boomerang.x, boomerang.y, 
                    this.player.x, this.player.y
                );
                const velocity = new Phaser.Math.Vector2();
                velocity.setToPolar(angle, boomerang.speed);
                boomerang.setVelocity(velocity.x, velocity.y);
                
                const distanceToPlayer = Phaser.Math.Distance.Between(
                    boomerang.x, boomerang.y, 
                    this.player.x, this.player.y
                );
                
                if (distanceToPlayer < 30) {
                    boomerang.destroy();
                }
            }
        });
    }

    calculateSpawnDelay() {
        // Gradually reduce delay from 500ms to 50ms based on score
        // At score 0: 500ms, at score 500+: 10ms
        const minDelay = 10;
        const maxDelay = 500;
        const scoreThreshold = 500; // Score needed to reach minimum delay
        
        const progress = Math.min(this.score / scoreThreshold, 1);
        return Math.max(minDelay, maxDelay - (maxDelay - minDelay) * progress);
    }

    onBulletHitImp(bullet, monster) {
        this.playSoundSafe(this.hurtSound);
        this.createExplosion(monster.x, monster.y);
        
        // Only destroy bullet if it doesn't penetrate
        if (this.bulletSizeUpgradeCount <= 3) {
            bullet.destroy();
        }
        
        monster.destroy();
        this.updateScore();
    }

    onBoomerangHitImp(boomerang, monster) {
        this.playSoundSafe(this.hurtSound);
        this.createExplosion(monster.x, monster.y);
        monster.destroy();
        this.updateScore();
    }

    onBigBoomHitImp(bigBoom, monster) {
        this.playSoundSafe(this.hurtSound);
        this.createExplosion(monster.x, monster.y);
        monster.destroy();
        this.updateScore();
    }

    onPlayerHitImp(player, monster) {
        if (this.gameOver) return;

        this.playSoundSafe(this.maleHurtSound);
        
        this.health = Math.max(0, this.health - 25);
        this.updateHealthBar();
        
        if (this.characterInfoText) {
            this.characterInfoText.setText(this.getCharacterInfoText());
        }

        monster.destroy();

        if (this.health <= 0) {
            this.triggerGameOver();
        }
    }

    createExplosion(x, y) {
        const explosion = this.add.sprite(x, y, 'blue-explosion');
        explosion.play('explosion');
        explosion.once('animationcomplete', () => {
            explosion.destroy();
        });
    }

    updateScore() {
        this.score += 1;
        this.scoreText.setText('Score: ' + this.score);
        this.addExperience(10);
        
        this.currentSpawnDelay = this.calculateSpawnDelay();
        this.spawnTimer.delay = this.currentSpawnDelay;
    }

    cleanupBullets() {
        if (!this.isGroupValid(this.bullets)) return;
        
        const buffer = 100;
        const bounds = this.physics.world.bounds;
        
        this.safeGroupForEach(this.bullets, (bullet) => {
            if (bullet.x < -buffer || 
                bullet.x > bounds.width + buffer ||
                bullet.y < -buffer || 
                bullet.y > bounds.height + buffer) {
                bullet.destroy();
            }
        });
    }

    update() {
        if (!this.isGameActive() || this.showingPowerUpDialog) return;
        
        // Handle game over state
        if (this.gameOver) {
            if (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.sceneTransitioning = true;
                this.scene.start('CharacterSelection');
            }
            return;
        }
        
        if (!this.isSpriteValid(this.player) || !this.cursors) return;
        
        this.cleanupBullets();
        this.updateBoomerangs();
        this.shootBoomerang();
        this.shootBigBoom();
        this.shootBullet();
        
        this.updatePlayerMovement();
        this.updateImpMovement();
    }

    updatePlayerMovement() {
        if (!this.isSpriteValid(this.player) || !this.cursors) return;
        
        const speed = 200;
        let velocityX = 0;
        let velocityY = 0;
        
        if (this.cursors.left.isDown || this.input.keyboard.checkDown(this.input.keyboard.addKey('A'))) {
            velocityX = -speed;
            this.player.flipX = true;
        } else if (this.cursors.right.isDown || this.input.keyboard.checkDown(this.input.keyboard.addKey('D'))) {
            velocityX = speed;
            this.player.flipX = false;
        }
        
        if (this.cursors.up.isDown || this.input.keyboard.checkDown(this.input.keyboard.addKey('W'))) {
            velocityY = -speed;
        } else if (this.cursors.down.isDown || this.input.keyboard.checkDown(this.input.keyboard.addKey('S'))) {
            velocityY = speed;
        }
        
        this.player.setVelocity(velocityX, velocityY);
    }

    updateImpMovement() {
        if (!this.isGroupValid(this.imps) || !this.isSpriteValid(this.player)) return;
        
        this.safeGroupForEach(this.imps, (monster) => {
            if (!monster.setVelocity || !monster.body?.world) return;
            
            const angle = Phaser.Math.Angle.Between(monster.x, monster.y, this.player.x, this.player.y);
            const velocity = new Phaser.Math.Vector2();
            velocity.setToPolar(angle, 100);

            monster.setVelocity(velocity.x, velocity.y);
            monster.flipX = velocity.x < 0;
        });
    }
    
}
