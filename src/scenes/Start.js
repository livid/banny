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
        // Boomerang properties
        this.lastBoomerangTime = 0;
        this.boomerangCooldown = 5000; // 5 seconds
        this.boomerangCount = 3; // Number of boomerangs to fire at once (1-5)
        // Big Boom properties
        this.lastBigBoomTime = 0;
        this.bigBoomCooldown = 5000; // 5 seconds
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
    }

    preload() {
        // Load desert map
        this.load.image('desert-tiles', 'assets/Desert Tileset.png');
        this.load.tilemapTiledJSON('desert-map', 'assets/Desert.json');
        
        // Load character images
        this.load.image('jango', 'assets/characters/jango.png');
        this.load.image('peri', 'assets/characters/peri.png');

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
        // Get selected character data
        this.selectedCharacter = this.registry.get('selectedCharacter');
        if (this.selectedCharacter) {
            this.fireRate = this.selectedCharacter.fireRate;
        } else {
            // Fallback to default character if none selected
            this.selectedCharacter = {
                name: "jango.eth",
                image: "jango.png",
                fireRate: 500
            };
            this.fireRate = 500;
        }

        const map = this.make.tilemap({ key: 'desert-map', tileWidth: 24, tileHeight: 24 });
        const tileset = map.addTilesetImage("Desert Tileset", 'desert-tiles');
        const layer = map.createLayer('Ground', tileset, 0, 0);
        // add player to center of the screen
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setZoom(1);
        
        // Use selected character sprite or default to jango
        const characterSprite = this.selectedCharacter ? this.selectedCharacter.image.replace('.png', '') : 'jango';
        this.player = this.physics.add.sprite(640, 360, characterSprite);
        this.player.setCollideWorldBounds(true);
        this.player.setScale(1);
        
        // Adjust player collision bounds to 50% of sprite size
        const playerWidth = this.player.width * 0.75;
        const playerHeight = this.player.height * 0.99;
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
            const fireRateDisplay = this.selectedCharacter.fireRate < 200 ? 'Very Fast' : 
                                  this.selectedCharacter.fireRate < 400 ? 'Fast' : 
                                  this.selectedCharacter.fireRate < 600 ? 'Medium' : 'Slow';
            this.characterInfoText = this.add.text(16, 56, `Character: ${this.selectedCharacter.name}\nFire Rate: ${fireRateDisplay}`, {
                fontSize: '16px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 1
            });
            this.characterInfoText.setScrollFactor(0);
        }

        // Add health bar
        this.createHealthBar();

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

        // Setup input handlers
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.enterKey.on('down', () => {
            if (this.gameOver) {
                this.scene.start('CharacterSelection');
            }
        });
        this.input.on('pointerdown', () => this.shootBullet());

        // Add space key for continuous input
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

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
        
        if (this.enterKey) {
            this.enterKey.removeAllListeners();
        }
        console.log('Start scene shutdown');
    }

    triggerGameOver() {
        this.gameOver = true;
        
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

        // Update UI
        this.scoreText.setText('Score: 0');
        this.updateHealthBar();

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
        if (this.gameOver) return;
        
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
        
        const currentTime = this.time.now;
        if (currentTime - this.lastBigBoomTime < this.bigBoomCooldown) {
            return;
        }

        this.lastBigBoomTime = currentTime;

        // Random angle around player
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const distance = 300;
        
        // Calculate position 200 pixels from player
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
        
        bullet.destroy();
        imp.destroy();
        
        // Update score
        this.score += 1;
        this.scoreText.setText('Score: ' + this.score);
        
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
        if (this.gameOver) return;
        
        // Clean up out-of-bounds bullets
        this.cleanupBullets();
        
        // Update boomerangs
        this.updateBoomerangs();
        
        // Auto-shoot boomerang every 5 seconds
        this.shootBoomerang();
        
        // Auto-shoot Big Boom every 5 seconds
        this.shootBigBoom();
        
        // Continuous shooting while space is held
        if (this.spaceKey.isDown) {
            this.shootBullet();
        }
        
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
