export class Victory extends Phaser.Scene {
    constructor() {
        super("Victory");
        this.gamepad = null;
        this.previousButtonStates = {};
        this.selectedMap = null;
    }

    init(data) {
        // Receive the selected map data from the previous scene
        this.selectedMap = data.selectedMap;
    }

    preload() {
        // Load victory assets based on the selected map
        if (this.selectedMap) {
            const mapName = this.selectedMap.name.toLowerCase();
            // Load the appropriate victory image
            this.load.image(
                `victory-${mapName}`,
                `assets/victory/${mapName}.png`
            );
        }
    }

    create() {
        // Get gamepad if available
        if (this.input.gamepad && this.input.gamepad.total > 0) {
            this.gamepad = this.input.gamepad.getPad(0);
        }

        // Create victory background
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Add victory image if available
        if (this.selectedMap) {
            const mapName = this.selectedMap.name.toLowerCase();
            const victoryImage = this.add.image(
                centerX,
                centerY,
                `victory-${mapName}`
            );

            // Disable pixel art rendering for the victory image specifically
            victoryImage.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

            // Scale the image to fit the screen nicely
            const scaleX = this.cameras.main.width / victoryImage.width;
            const scaleY = this.cameras.main.height / victoryImage.height;
            const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond original size
            victoryImage.setScale(scale);
        } else {
            // Fallback background if no map specified
            this.add.rectangle(
                centerX,
                centerY,
                this.cameras.main.width,
                this.cameras.main.height,
                0x000000
            );
        }

        // Add victory text with smooth rendering
        const victoryText = this.add.text(centerX, centerY - 100, "VICTORY!", {
            fontSize: "72px",
            fontFamily: "Arial",
            color: "#FFD700",
            stroke: "#000000",
            strokeThickness: 4,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: "#000000",
                blur: 5,
                fill: true,
            },
        });
        victoryText.setOrigin(0.5);

        // Apply smooth filtering to text texture if available
        if (victoryText.texture && victoryText.texture.setFilter) {
            victoryText.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        }

        // Add instruction text with smooth rendering
        const instructionText = this.add.text(
            centerX,
            centerY + 100,
            "Press B or ENTER to return to Character Selection",
            {
                fontSize: "24px",
                fontFamily: "Arial",
                color: "#FFFFFF",
                stroke: "#000000",
                strokeThickness: 2,
            }
        );
        instructionText.setOrigin(0.5);

        // Apply smooth filtering to instruction text texture if available
        if (instructionText.texture && instructionText.texture.setFilter) {
            instructionText.texture.setFilter(
                Phaser.Textures.FilterMode.LINEAR
            );
        }

        // Create keyboard input
        this.startKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.ENTER
        );

        // Add some particle effects for celebration
        this.createCelebrationEffect(centerX, centerY);
    }

    createCelebrationEffect(x, y) {
        // Create a simple colored rectangle texture for particles if it doesn't exist
        if (!this.textures.exists("victory-particle")) {
            this.add
                .graphics()
                .fillStyle(0xffd700)
                .fillRect(0, 0, 4, 4)
                .generateTexture("victory-particle", 4, 4);
        }

        // Create golden particles for celebration
        const particles = this.add.particles(x, y, "victory-particle", {
            speed: { min: 50, max: 150 },
            scale: { start: 0.5, end: 0 },
            blendMode: "ADD",
            lifespan: 2000,
            quantity: 2,
            frequency: 100,
            tint: [0xffd700, 0xffa500, 0xff6347],
        });
    }

    update() {
        // Handle keyboard input
        if (this.startKey && Phaser.Input.Keyboard.JustDown(this.startKey)) {
            this.returnToCharacterSelection();
        }

        // Handle gamepad input (button 0 = B button)
        if (this.gamepad && this.gamepad.buttons) {
            const button0 = this.gamepad.buttons[0];

            // Manual justDown detection for button 0 (B button)
            const button0WasPressed = this.previousButtonStates[0] || false;
            const button0IsPressed = button0 && button0.pressed;
            const button0JustPressed = button0IsPressed && !button0WasPressed;

            // Update previous state
            this.previousButtonStates[0] = button0IsPressed;

            // Check for button press
            if (button0JustPressed) {
                this.returnToCharacterSelection();
            }
        }
    }

    returnToCharacterSelection() {
        this.scene.start("CharacterSelection");
    }
}
