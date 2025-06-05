export class Start extends Phaser.Scene {

    constructor() {
        super('Start');
        this.score = 0;
        this.lastShotTime = 0;
        this.fireRate = 500; // Default, will be overridden by character data
        this.currentSpawnDelay = 1000; // Start with 1 second delay
        this.health = 100; // Player health
        this.maxHealth = 100;
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
    }

    init() {
        // Reset game state when scene starts
        this.score = 0;
        this.health = this.maxHealth;
        this.gameOver = false;
        this.currentSpawnDelay = 1000;
        this.lastShotTime = 0;
        this.lastBoomerangTime = 0;
        this.lastBigBoomTime = 0;
        this.experience = 0;
        this.level = 1;
        this.boomerangCount = 0;
        this.bigBoomCount = 0;
        this.bulletScale = 1.0;
        this.showingPowerUpDialog = false;
    }

    preload() {
        // Load desert map
        this.load.image('desert-tiles', 'assets/maps/Desert Tileset.png');
        this.load.tilemapTiledJSON('desert-map', 'assets/maps/Desert.json');
        
        // Load characters data 
        this.load.json('characters-data', 'assets/characters/characters.json');

        // Load monster
        this.load.spritesheet('imp_red_walk', 'assets/monsters/imp_red_walk.png', { frameWidth: 50, frameHeight: 48 });
        
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
        // Load character images dynamically if not already loaded
        const charactersData = this.cache.json.get('characters-data');
        const imagesToLoad = [];
        
        charactersData.forEach(character => {
            const imageKey = character.image.replace('.png', '');
            if (!this.textures.exists(imageKey)) {
                imagesToLoad.push({ key: imageKey, path: `assets/characters/${character.image}` });
            }
        });
        
        // If there are images to load, load them before continuing
        if (imagesToLoad.length > 0) {
            let loadedCount = 0;
            imagesToLoad.forEach(image => {
                this.load.image(image.key, image.path);
                this.load.on(`filecomplete-image-${image.key}`, () => {
                    loadedCount++;
                    if (loadedCount === imagesToLoad.length) {
                        this.initializeGame();
                    }
                });
            });
            this.load.start();
        } else {
            // All images already loaded, proceed immediately
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
        } else {
            // Fallback to first character from data if none selected
            const charactersData = this.cache.json.get('characters-data');
            this.selectedCharacter = charactersData[0] || {
                name: "vonhagel.eth",
                image: "42161-4000000009-0x57a482ea32c7f75a9c0734206f5bd4f9bcb38e12.png",
                fireRate: 500,
                boomerang: 0,
                bigBoom: 0,
                nft_id: "42161-4000000009"
            };
            this.fireRate = this.selectedCharacter.fireRate;
            this.boomerangCount = this.selectedCharacter.boomerang || 0;
            this.bigBoomCount = this.selectedCharacter.bigBoom || 0;
        }

        const map = this.make.tilemap({ key: 'desert-map', tileWidth: 24, tileHeight: 24 });
        const tileset = map.addTilesetImage("Desert Tileset", 'desert-tiles');
        const groundLayer = map.createLayer('Ground', tileset, 0, 0);
        const collisionLayer = map.createLayer('Collision', tileset, 0, 0);
        const treesLayer = map.createLayer('Trees', tileset, 0, 0);
        
        // Set collision on tiles that have the 'collides' property set to true in Tiled
        collisionLayer.setCollisionByProperty({ collides: true });
               
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
            this.characterInfoText = this.add.text(16, 56, `Character: ${this.selectedCharacter.name}\nLevel: 1\nFire Rate: ${this.fireRate}ms`, {
                fontSize: '16px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 1
            });
            this.characterInfoText.setScrollFactor(0);
        }

        // Add health bar
        this.createHealthBar();

        // Add experience bar
        this.createExperienceBar();

        this.cursors = this.input.keyboard.createCursorKeys();

        // Add bullet group
        this.bullets = this.physics.add.group();
        
        // Add boomerang group
        this.boomerangs = this.physics.add.group();
        
        // Add Big Boom group
        this.bigBooms = this.physics.add.group();
        
        // Create imp group (moved before collision setup)
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

        // Add imp animation
        this.anims.create({
            key: 'imp_walk',
            frames: this.anims.generateFrameNumbers('imp_red_walk', { start: 0, end: 4 }),
            frameRate: 8,
            repeat: -1
        });

        // Setup bullet-imp collision (moved after groups are created)
        this.physics.add.overlap(this.bullets, this.imps, this.onBulletHitImp, null, this);

        // Setup boomerang-imp collision
        this.physics.add.overlap(this.boomerangs, this.imps, this.onBoomerangHitImp, null, this);

        // Setup Big Boom-imp collision
        this.physics.add.overlap(this.bigBooms, this.imps, this.onBigBoomHitImp, null, this);

        // Setup player-imp collision
        this.physics.add.overlap(this.player, this.imps, this.onPlayerHitImp, null, this);

        this.physics.add.collider(this.player, collisionLayer);
        
        this.physics.add.collider(this.imps, collisionLayer);

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

        // Start spawning imps
        this.spawnTimer = this.time.addEvent({
            delay: this.currentSpawnDelay,
            callback: this.spawnImp,
            callbackScope: this,
            loop: true
        });
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
        this.healthText = this.add.text(x + barWidth/2, y + barHeight/2, '100/100', {
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
                this.characterInfoText.setText(`Character: ${this.selectedCharacter.name}\nLevel: ${this.level}\nFire Rate: ${this.fireRate}ms`);
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
            this.characterInfoText.setText(`Character: ${this.selectedCharacter.name}\nLevel: ${this.level}\nFire Rate: ${this.fireRate}ms`);
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

        // Play male hurt sound
        this.maleHurtSound.play();

        // Damage player
        this.health = Math.max(0, this.health - 25);
        this.updateHealthBar();

        // Remove the imp that hit the player
        imp.destroy();

        // Check for game over
        if (this.health <= 0) {
            this.triggerGameOver();
        }
   }

    shutdown() {
        // Clean up when leaving the scene
        if (this.spawnTimer) {
            this.spawnTimer.destroy();
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
        console.log('Game over triggered, gameOver flag set to:', this.gameOver);
        
        // Stop spawning imps
        this.spawnTimer.destroy();
        
        // Stop player movement
        this.player.setVelocity(0, 0);
        
        // Stop all imps
        this.imps.getChildren().forEach(imp => {
            imp.setVelocity(0, 0);
        });

        // Show game over text
        this.gameOverText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'GAME OVER\nPress ENTER to select character', {
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
        this.health = this.maxHealth;
        this.gameOver = false;
        this.currentSpawnDelay = 1000;
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
        if (this.gameOver || this.showingPowerUpDialog) return;
        
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

        const imp = this.imps.create(x, y, 'imp_red_walk');
        imp.play('imp_walk');
        imp.setCollideWorldBounds(true);
        imp.setScale(2);
        
        // Adjust imp collision bounds to 50% of sprite size
        const impWidth = imp.width * 0.5;
        const impHeight = imp.height * 0.5;
        imp.body.setSize(impWidth, impHeight);
    }

    findNearestImp() {
        let nearestImp = null;
        let shortestDistance = Infinity;
        
        this.imps.getChildren().forEach(imp => {
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, imp.x, imp.y);
            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestImp = imp;
            }
        });
        
        return nearestImp;
    }

    shootBullet() {
        if (this.gameOver) return;
        
        const currentTime = this.time.now;
        if (currentTime - this.lastShotTime < this.fireRate) {
            return; // Still in cooldown
        }

        this.lastShotTime = currentTime;

        // Play laser sound
        this.laserSound.play();

        const bullet = this.bullets.create(this.player.x, this.player.y, 'blue-explosion');
        bullet.setFrame(0);  // Use first frame as bullet
        bullet.setScale(this.bulletScale); // Apply bullet scale power-up
        
        // Add visual effect for penetrating bullets
        if (this.bulletSizeUpgradeCount > 3) {
            bullet.setTint(0x7fff00); // Light green tint for penetrating bullets
            bullet.setBlendMode(Phaser.BlendModes.ADD); // Additive blend for glow effect
        }
        
        const nearestImp = this.findNearestImp();
        let angle;
        
        if (nearestImp) {
            // Shoot at nearest imp
            angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, nearestImp.x, nearestImp.y);
        } else {
            // Shoot in random direction
            angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        }
        
        const velocity = new Phaser.Math.Vector2();
        velocity.setToPolar(angle, 300);  // 300 is bullet speed
        
        bullet.setVelocity(velocity.x, velocity.y);
    }

    shootBoomerang() {
        if (this.gameOver) return;
        
        // Don't shoot if no boomerangs available
        if (this.boomerangCount <= 0) return;
        
        const currentTime = this.time.now;
        if (currentTime - this.lastBoomerangTime < this.boomerangCooldown) {
            return;
        }

        this.lastBoomerangTime = currentTime;

        // Fire multiple boomerangs
        for (let i = 0; i < this.boomerangCount; i++) {
            const boomerang = this.boomerangs.create(this.player.x, this.player.y, 'boomerang');
            boomerang.setScale(4);
            
            // Random direction for each boomerang
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            
            // Store boomerang properties
            boomerang.startX = this.player.x;
            boomerang.startY = this.player.y;
            boomerang.angle = angle;
            boomerang.travelDistance = 360;
            boomerang.distanceTraveled = 0;
            boomerang.returning = false;
            boomerang.speed = 500;
            
            // Set initial velocity
            const velocity = new Phaser.Math.Vector2();
            velocity.setToPolar(angle, boomerang.speed);
            boomerang.setVelocity(velocity.x, velocity.y);
        }
    }

    shootBigBoom() {
        if (this.gameOver) return;
        
        // Don't shoot if no big booms available
        if (this.bigBoomCount <= 0) return;
        
        const currentTime = this.time.now;
        if (currentTime - this.lastBigBoomTime < this.bigBoomCooldown) {
            return;
        }

        this.lastBigBoomTime = currentTime;

        // Fire multiple big booms based on power-up
        for (let i = 0; i < this.bigBoomCount; i++) {
            // Random angle around player
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = 300;
            
            // Calculate position around player
            const x = this.player.x + Math.cos(angle) * distance;
            const y = this.player.y + Math.sin(angle) * distance;

            const bigBoom = this.bigBooms.create(x, y, 'big-boom');
            bigBoom.setScale(8);
            
            // Set random rotation before playing animation
            bigBoom.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
            
            bigBoom.play('big-boom');
            
            // Set up collision radius (larger than visual for better gameplay)
            bigBoom.body.setSize(32, 32); // 32 * 4 scale = 128 base size
            
            // Remove after animation completes
            bigBoom.once('animationcomplete', () => {
                bigBoom.destroy();
            });
        }
    }

    updateBoomerangs() {
        this.boomerangs.getChildren().forEach(boomerang => {
            // Rotate the boomerang
            boomerang.rotation += 0.3;
            
            // Calculate distance from start position
            const currentDistance = Phaser.Math.Distance.Between(
                boomerang.startX, boomerang.startY, 
                boomerang.x, boomerang.y
            );
            
            if (!boomerang.returning && currentDistance >= boomerang.travelDistance) {
                // Start returning
                boomerang.returning = true;
            }
            
            if (boomerang.returning) {
                // Move towards player
                const angle = Phaser.Math.Angle.Between(
                    boomerang.x, boomerang.y, 
                    this.player.x, this.player.y
                );
                const velocity = new Phaser.Math.Vector2();
                velocity.setToPolar(angle, boomerang.speed);
                boomerang.setVelocity(velocity.x, velocity.y);
                
                // Check if boomerang reached player
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
        // Gradually reduce delay from 1000ms to 200ms based on score
        // At score 0: 1000ms, at score 100+: 200ms
        const minDelay = 200;
        const maxDelay = 1000;
        const scoreThreshold = 100; // Score needed to reach minimum delay
        
        const progress = Math.min(this.score / scoreThreshold, 1);
        return Math.max(minDelay, maxDelay - (maxDelay - minDelay) * progress);
    }

    onBulletHitImp(bullet, imp) {
        // Play hurt sound
        this.hurtSound.play();
        
        const explosion = this.add.sprite(imp.x, imp.y, 'blue-explosion');
        explosion.play('explosion');
        explosion.once('animationcomplete', () => {
            explosion.destroy();
        });
        
        // Only destroy bullet if bullet size upgrade count is 3 or less
        // If bullet size upgrade count > 3, bullet penetrates through enemies
        if (this.bulletSizeUpgradeCount <= 3) {
            bullet.destroy();
        }
        
        imp.destroy();
        
        // Update score
        this.score += 1;
        this.scoreText.setText('Score: ' + this.score);
        
        // Add experience points (10 per imp)
        this.addExperience(10);
        
        // Update spawn delay based on new score
        this.currentSpawnDelay = this.calculateSpawnDelay();
        this.spawnTimer.delay = this.currentSpawnDelay;
    }

    onBoomerangHitImp(boomerang, imp) {
        // Play hurt sound
        this.hurtSound.play();
        
        const explosion = this.add.sprite(imp.x, imp.y, 'blue-explosion');
        explosion.play('explosion');
        explosion.once('animationcomplete', () => {
            explosion.destroy();
        });
        
        imp.destroy();
        
        // Update score
        this.score += 1;
        this.scoreText.setText('Score: ' + this.score);
        
        // Add experience points (10 per imp)
        this.addExperience(10);
        
        // Update spawn delay based on new score
        this.currentSpawnDelay = this.calculateSpawnDelay();
        this.spawnTimer.delay = this.currentSpawnDelay;
    }

    onBigBoomHitImp(bigBoom, imp) {
        // Play hurt sound
        this.hurtSound.play();
        
        const explosion = this.add.sprite(imp.x, imp.y, 'blue-explosion');
        explosion.play('explosion');
        explosion.once('animationcomplete', () => {
            explosion.destroy();
        });
        
        imp.destroy();
        
        // Update score
        this.score += 1;
        this.scoreText.setText('Score: ' + this.score);
        
        // Add experience points (10 per imp)
        this.addExperience(10);
        
        // Update spawn delay based on new score
        this.currentSpawnDelay = this.calculateSpawnDelay();
        this.spawnTimer.delay = this.currentSpawnDelay;
    }

    cleanupBullets() {
        this.bullets.getChildren().forEach(bullet => {
            // Check if bullet is far outside the world bounds
            const buffer = 100; // Extra buffer to ensure bullets are truly out of range
            if (bullet.x < -buffer || 
                bullet.x > this.physics.world.bounds.width + buffer ||
                bullet.y < -buffer || 
                bullet.y > this.physics.world.bounds.height + buffer) {
                bullet.destroy();
            }
        });
    }

    update() {
        if (this.showingPowerUpDialog) return;
        
        // Handle game over state
        if (this.gameOver) {
            // Check for Enter key press to return to character selection
            if (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                console.log('Enter key detected in game over state, switching to character selection...');
                this.scene.start('CharacterSelection');
            }
            return; // Don't process game logic when game is over
        }
        
        // Clean up out-of-bounds bullets
        this.cleanupBullets();
        
        // Update boomerangs
        this.updateBoomerangs();
        
        // Auto-shoot boomerang every 5 seconds
        this.shootBoomerang();
        
        // Auto-shoot Big Boom every 5 seconds
        this.shootBigBoom();
        
        // Auto-fire bullets continuously
        this.shootBullet();
        
        // Player movement with W, A, S, D keys
        if (this.cursors.left.isDown || this.input.keyboard.checkDown(this.input.keyboard.addKey('A'))) {
            this.player.setVelocityX(-200);
            this.player.flipX = true; // Flip when moving left
        } else if (this.cursors.right.isDown || this.input.keyboard.checkDown(this.input.keyboard.addKey('D'))) {
            this.player.setVelocityX(200);
            this.player.flipX = false; // Don't flip when moving right
        } else {
            this.player.setVelocityX(0);
        }
        if (this.cursors.up.isDown || this.input.keyboard.checkDown(this.input.keyboard.addKey('W'))) {
            this.player.setVelocityY(-200);
        } else if (this.cursors.down.isDown || this.input.keyboard.checkDown(this.input.keyboard.addKey('S'))) {
            this.player.setVelocityY(200);
        } else {
            this.player.setVelocityY(0);
        }

        // Update imp movement
        this.imps.getChildren().forEach(imp => {
            // Calculate direction to player
            const angle = Phaser.Math.Angle.Between(imp.x, imp.y, this.player.x, this.player.y);
            const velocity = new Phaser.Math.Vector2();
            velocity.setToPolar(angle, 100);  // 100 is the speed

            imp.setVelocity(velocity.x, velocity.y);
            
            // Flip imp sprite based on movement direction
            imp.flipX = velocity.x < 0;
        });
    }
    
}
