export class Start extends Phaser.Scene {

    constructor() {
        super('Start');
    }

    preload() {
        this.load.image('desert-tiles', 'assets/Desert Tileset.png');
        this.load.tilemapTiledJSON('desert-map', 'assets/Desert.json');
        this.load.image('jango', 'assets/jango.png');
        this.load.spritesheet('imp_red_walk', 'assets/monsters/imp_red_walk.png', { frameWidth: 50, frameHeight: 48 });
        
        this.load.image('background', 'assets/space.png');
        this.load.image('logo', 'assets/phaser.png');

        //  The ship sprite is CC0 from https://ansimuz.itch.io - check out his other work!
        this.load.spritesheet('ship', 'assets/spaceship.png', { frameWidth: 176, frameHeight: 96 });
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
        this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

        this.cursors = this.input.keyboard.createCursorKeys();

        // Add imp animation
        this.anims.create({
            key: 'imp_walk',
            frames: this.anims.generateFrameNumbers('imp_red_walk', { start: 0, end: 4 }),
            frameRate: 8,
            repeat: -1
        });

        // Create imp group
        this.imps = this.physics.add.group();

        // Start spawning imps
        this.time.addEvent({
            delay: 2000,  // Spawn every 2 seconds
            callback: this.spawnImp,
            callbackScope: this,
            loop: true
        });
    }

    spawnImp() {
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
    }

    update() {
        // Player movement with W, A, S, D keys
        if (this.cursors.left.isDown || this.input.keyboard.checkDown(this.input.keyboard.addKey('A'))) {
            this.player.setVelocityX(-200);
        } else if (this.cursors.right.isDown || this.input.keyboard.checkDown(this.input.keyboard.addKey('D'))) {
            this.player.setVelocityX(200);
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
