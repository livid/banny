export class Start extends Phaser.Scene {

    constructor() {
        super('Start');
        this.score = 0;
        this.lastShotTime = 0;
        this.fireRate = 500; // Milliseconds between shots
        this.currentSpawnDelay = 1000; // Start with 1 second delay
        this.health = 100; // Player health
        this.maxHealth = 100;
        this.gameOver = false;
    }

    preload() {
        // Load desert map
        this.load.image('desert-tiles', 'assets/Desert Tileset.png');
        this.load.tilemapTiledJSON('desert-map', 'assets/Desert.json');
        
        // Load player
        this.load.image('jango', 'assets/jango.png');

        // Load monster
        this.load.spritesheet('imp_red_walk', 'assets/monsters/imp_red_walk.png', { frameWidth: 50, frameHeight: 48 });
        
        // Load effects
        this.load.spritesheet('blue-explosion', 'assets/effects/blue-explosion.png', { frameWidth: 32, frameHeight: 32 });
        
        // Load sound effects
        this.load.audio('laser', 'assets/sfx/laser-1.wav');
        this.load.audio('hurt', 'assets/sfx/hurt-1.wav');
        this.load.audio('male-hurt', 'assets/sfx/male-hurt-1.wav');
        
        // Load background music
        this.load.audio('background-music', 'assets/music/twilight-of-the-dead.mp3');
    }

    create() {
        const map = this.make.tilemap({ key: 'desert-map', tileWidth: 24, tileHeight: 24 });
        const tileset = map.addTilesetImage("Desert Tileset", 'desert-tiles');
        const layer = map.createLayer('Ground', tileset, 0, 0);
        // add player to center of the screen
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setZoom(1);
        this.player = this.physics.add.sprite(640, 360, 'jango');
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

        // Add health bar
        this.createHealthBar();

        this.cursors = this.input.keyboard.createCursorKeys();

        // Add bullet group
        this.bullets = this.physics.add.group();
        
        // Create imp group (moved before collision setup)
        this.imps = this.physics.add.group();
        
        // Create animations
        this.anims.create({
            key: 'explosion',
            frames: this.anims.generateFrameNumbers('blue-explosion', { start: 0, end: 3 }),
            frameRate: 10,
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

        // Setup player-imp collision
        this.physics.add.overlap(this.player, this.imps, this.onPlayerHitImp, null, this);

        // Setup input handlers
        this.input.keyboard.on('keydown-ENTER', () => {
            if (this.gameOver) {
                this.restartGame();
            }
        });
        this.input.on('pointerdown', () => this.shootBullet());

        // Add space key for continuous input
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Create sound effects
        this.laserSound = this.sound.add('laser', { volume: 0.05 });
        this.hurtSound = this.sound.add('hurt', { volume: 0.75 });
        this.maleHurtSound = this.sound.add('male-hurt', { volume: 0.5 });

        // Add background music
        this.backgroundMusic = this.sound.add('background-music', { 
            volume: 0.3, 
            loop: true 
        });
        this.backgroundMusic.play();

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
        this.gameOverText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'GAME OVER\nPress ENTER to restart', {
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
