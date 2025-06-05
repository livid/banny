export class CharacterSelection extends Phaser.Scene {
    constructor() {
        super('CharacterSelection');
        this.charactersData = null;
        this.selectedIndex = 0;
        this.characterSprites = [];
        this.characterFrames = [];
        this.nameTexts = [];
        this.statsTexts = [];
        this.cursors = null;
        this.enterKey = null;
        this.debugText = null;
    }

    init() {
        // Reset state when scene starts
        this.selectedIndex = 0;
        this.characterSprites = [];
        this.characterFrames = [];
        this.nameTexts = [];
        this.statsTexts = [];
        console.log('CharacterSelection scene initialized');
    }

    preload() {
        // Load characters data first
        this.load.json('characters-data', 'assets/characters/characters.json');
        
        // Load background music if not already loaded
        if (!this.cache.audio.exists('background-music')) {
            this.load.audio('background-music', 'assets/music/twilight-of-the-dead.mp3');
        }
    }

    create() {
        // Load characters data
        this.charactersData = this.cache.json.get('characters-data').characters;
        
        // Load character images dynamically based on characters data
        const imagesToLoad = [];
        this.charactersData.forEach(character => {
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
                        this.initializeScene();
                    }
                });
            });
            this.load.start();
        } else {
            // All images already loaded, proceed immediately
            this.initializeScene();
        }
    }
    
    initializeScene() {
        // Debug: log the characters data
        console.log('Loaded characters:', this.charactersData);
        
        // Add title
        this.add.text(this.cameras.main.centerX, 80, 'SELECT CHARACTER', {
            fontSize: '48px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0.5);

        // Create character grid
        this.createCharacterGrid();

        // Add instructions
        this.add.text(this.cameras.main.centerX, this.cameras.main.height - 60, 'Use ARROW KEYS to navigate • ENTER to select', {
            fontSize: '24px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0.5);

        // Add debug text
        this.debugText = this.add.text(16, 16, '', {
            fontSize: '16px',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 1
        });
        this.debugText.setScrollFactor(0);

        // Set up input - use only cursor keys for simplicity
        this.cursors = this.input.keyboard.createCursorKeys();
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        
        console.log('Setting up keyboard input with cursor keys and ENTER');

        // Ensure background music is playing
        let globalBackgroundMusic = this.registry.get('backgroundMusic');
        if (!globalBackgroundMusic || !globalBackgroundMusic.isPlaying) {
            // Stop any existing background music first
            if (globalBackgroundMusic) {
                globalBackgroundMusic.stop();
                globalBackgroundMusic.destroy();
            }
            
            globalBackgroundMusic = this.sound.add('background-music', { 
                volume: 0.3, 
                loop: true 
            });
            globalBackgroundMusic.play();
            
            // Store in global registry
            this.registry.set('backgroundMusic', globalBackgroundMusic);
        }

        // Initial selection highlight
        this.updateSelection();
    }

    update() {
        // Handle input in update loop for more reliable detection
        // Only process input if cursors and enterKey have been initialized
        if (!this.cursors || !this.enterKey) {
            return;
        }
        
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
            console.log('Left arrow pressed');
            this.moveSelection(-1);
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
            console.log('Right arrow pressed');
            this.moveSelection(1);
        }
        if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            console.log('Enter key pressed - selecting character');
            this.selectCharacter();
        }
    }

    createCharacterGrid() {
        const spacing = 300;
        const totalWidth = (this.charactersData.length - 1) * spacing;
        const startX = this.cameras.main.centerX - totalWidth / 2;
        const startY = this.cameras.main.centerY;

        this.charactersData.forEach((character, index) => {
            const x = startX + index * spacing;
            const y = startY;

            // Create character frame (background)
            const frame = this.add.rectangle(x, y, 200, 280, 0x333333);
            frame.setStrokeStyle(4, 0x666666);
            this.characterFrames.push(frame);

            // Load and display character image
            const charSprite = this.add.image(x, y - 40, character.image.replace('.png', ''));
            charSprite.setScale(2);
            this.characterSprites.push(charSprite);

            // Character name
            const nameText = this.add.text(x, y + 60, character.name, {
                fontSize: '24px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5, 0.5);
            this.nameTexts.push(nameText);

            // Character stats - show fire rate in a more user-friendly way
            const fireRateDisplay = character.fireRate < 200 ? 'Very Fast' : 
                                  character.fireRate < 400 ? 'Fast' : 
                                  character.fireRate < 600 ? 'Medium' : 'Slow';
            const statsText = this.add.text(x, y + 90, `Fire Rate: ${fireRateDisplay}\n(${character.fireRate}ms)`, {
                fontSize: '16px',
                fill: '#cccccc',
                stroke: '#000000',
                strokeThickness: 1,
                align: 'center'
            }).setOrigin(0.5, 0.5);
            this.statsTexts.push(statsText);
        });
    }

    moveSelection(direction) {
        console.log(`Moving selection: current=${this.selectedIndex}, direction=${direction}`);
        this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex + direction, 0, this.charactersData.length);
        console.log(`New selection: ${this.selectedIndex}`);
        this.updateSelection();
    }

    updateSelection() {
        console.log(`Updating selection to index: ${this.selectedIndex}`);
        
        // Update debug text
        if (this.debugText && this.charactersData) {
            this.debugText.setText(`Selected: ${this.selectedIndex} (${this.charactersData[this.selectedIndex]?.name || 'Unknown'})`);
        }
        
        // Reset all frames
        this.characterFrames.forEach((frame, index) => {
            if (index === this.selectedIndex) {
                frame.setStrokeStyle(4, 0xffff00); // Highlight selected
                frame.setFillStyle(0x444444);
                console.log(`Highlighting frame ${index}`);
            } else {
                frame.setStrokeStyle(4, 0x666666);
                frame.setFillStyle(0x333333);
            }
        });

        // Scale selected character
        this.characterSprites.forEach((sprite, index) => {
            if (index === this.selectedIndex) {
                sprite.setScale(2.2);
            } else {
                sprite.setScale(2);
            }
        });
    }

    selectCharacter() {
        const selectedCharacter = this.charactersData[this.selectedIndex];
        
        // Add a visual confirmation
        const confirmText = this.add.text(this.cameras.main.centerX, this.cameras.main.height - 100, 
            `Selected: ${selectedCharacter.name}`, {
            fontSize: '24px',
            fill: '#00ff00',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0.5);
        
        // Store selected character data globally
        this.registry.set('selectedCharacter', selectedCharacter);
        
        // Small delay before transitioning to make selection feel responsive
        this.time.delayedCall(500, () => {
            this.scene.start('Start');
        });
    }

    shutdown() {
        // Clean up cursor keys
        if (this.cursors) {
            this.cursors = null;
        }
        if (this.enterKey) {
            this.enterKey = null;
        }
        console.log('CharacterSelection scene shutdown');
    }
}
