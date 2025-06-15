// Power-up system for the game
// Handles power-up dialog display, selection, and upgrades

export class PowerUpManager {
    constructor(scene) {
        this.scene = scene;
        this.showingDialog = false;
        this.selectedIndex = 0;
        this.availableOptions = [];

        // Dialog elements
        this.overlay = null;
        this.dialog = null;
        this.title = null;
        this.elements = [];
        this.keys = [];

        // Input handling
        this.gamepadTimer = null;
        this.currentHeldGamepadDirection = null;
        this.previousButtonStates = {};
        this.keyTimer = null;
        this.currentHeldKey = null;
    }

    showDialog() {
        if (this.showingDialog) return;

        // Don't show dialog if at max level (level 20)
        if (this.scene.level >= 20) return;

        this.showingDialog = true;
        this.scene.physics.pause(); // Pause the game

        // Pause the spawn timer to prevent monsters from spawning during power-up selection
        if (this.scene.spawnTimer) {
            this.scene.spawnTimer.paused = true;
        }

        this.createDialogUI();
        this.generatePowerUpOptions();
        this.initializeInputStates();
        this.updateSelection();
    }

    createDialogUI() {
        // Create semi-transparent overlay
        this.overlay = this.scene.add.rectangle(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0x000000,
            0.7
        );
        this.overlay.setScrollFactor(0);
        this.overlay.setDepth(2000);

        // Create dialog box
        this.dialog = this.scene.add.rectangle(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY,
            400,
            300,
            0x333333
        );
        this.dialog.setScrollFactor(0);
        this.dialog.setDepth(2001);
        this.dialog.setStrokeStyle(4, 0xffffff);

        // Title
        this.title = this.scene.add.text(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY - 100,
            "LEVEL UP!\nChoose a Power-Up:",
            {
                fontSize: "24px",
                fill: "#ffffff",
                align: "center",
            }
        );
        this.title.setOrigin(0.5);
        this.title.setScrollFactor(0);
        this.title.setDepth(2002);
    }

    generatePowerUpOptions() {
        // Collect all available power-up options
        const availablePowerUps = [];

        // Get the character's attack type
        const attackType = this.scene.selectedCharacter?.attackType || "bullet";

        // Attack speed option - bullet only
        if (attackType === "bullet") {
            const currentFireRateMs = this.scene.fireRate;
            const newFireRateMs = Math.max(100, this.scene.fireRate - 50);
            if (currentFireRateMs > 100) {
                availablePowerUps.push({
                    title: "Attack Speed +50ms",
                    description: `Fire rate: ${currentFireRateMs}ms → ${newFireRateMs}ms`,
                    type: 1,
                });
            }
        }

        // Boomerang option - available to all
        const boomerangCount = this.scene.boomerangCount;
        if (boomerangCount < 8) {
            availablePowerUps.push({
                title: "Extra Boomerang",
                description: `Boomerangs: ${boomerangCount} → ${Math.min(
                    8,
                    boomerangCount + 1
                )}`,
                type: 2,
            });
        }

        // Big boom option - available to all
        const bigBoomCount = this.scene.bigBoomCount;
        if (bigBoomCount < 5) {
            availablePowerUps.push({
                title: "Extra Big Boom",
                description: `Big Booms: ${bigBoomCount} → ${Math.min(
                    5,
                    bigBoomCount + 1
                )}`,
                type: 3,
            });
        }

        // Bullet size option - bullet only
        if (attackType === "bullet") {
            const bulletScale = this.scene.bulletScale;
            if (bulletScale < 4.0) {
                const newBulletScale = Math.min(4.0, bulletScale + 0.5);
                const nextUpgradeCount = this.scene.bulletSizeUpgradeCount + 1;
                let description = `Bullet size: ${bulletScale.toFixed(
                    2
                )}x → ${newBulletScale.toFixed(2)}x`;
                if (nextUpgradeCount > 3) {
                    description += ` (Penetrates enemies!)`;
                }
                availablePowerUps.push({
                    title: "Bigger Bullets",
                    description: description,
                    type: 4,
                });
            }
        }

        // Bullet damage upgrade option - bullet only
        if (attackType === "bullet") {
            if (this.scene.baseBulletDamage < 50) {
                const newDamage = Math.min(50, this.scene.baseBulletDamage + 5);
                availablePowerUps.push({
                    title: "Increased Bullet Damage",
                    description: `Damage: ${this.scene.baseBulletDamage} → ${newDamage}`,
                    type: 5,
                });
            }
        }

        // Flamethrower range upgrade - flamethrower only
        if (attackType === "flamethrower") {
            const currentRange = this.scene.flamethrowerRange || 300;
            const newRange = Math.min(1000, currentRange + 50);
            if (currentRange < 1000) {
                availablePowerUps.push({
                    title: "Increased Range",
                    description: `Range: ${currentRange}px → ${newRange}px`,
                    type: 7,
                });
            }
        }

        // Flamethrower damage upgrade - flamethrower only
        if (attackType === "flamethrower") {
            const currentDamage = this.scene.flamethrowerDamage || 2;
            const newDamage = Math.min(12, currentDamage + 1);
            if (currentDamage < 12) {
                availablePowerUps.push({
                    title: "Increased Flame Damage",
                    description: `Damage: ${currentDamage} → ${newDamage}`,
                    type: 8,
                });
            }
        }

        // Regeneration option - available to all
        if (this.scene.regenerationRate < 2.0) {
            const newRegenRate = Math.min(
                2.0,
                this.scene.regenerationRate + 0.2
            );
            availablePowerUps.push({
                title: "Health Regeneration",
                description: `Regen: ${this.scene.regenerationRate.toFixed(
                    1
                )}/s → ${newRegenRate.toFixed(1)}/s`,
                type: 6,
            });
        }

        // Randomly select up to 3 options from available power-ups
        const maxOptions = Math.min(3, availablePowerUps.length);
        const selectedPowerUps = Phaser.Utils.Array.Shuffle(
            availablePowerUps
        ).slice(0, maxOptions);

        // Store for navigation
        this.availableOptions = selectedPowerUps;
        this.selectedIndex = 0; // Reset to first option

        // Create power-up options with sequential numbering
        selectedPowerUps.forEach((powerUp, index) => {
            this.createOption(
                index + 1,
                powerUp.title,
                powerUp.description,
                powerUp.type
            );
        });
    }

    createOption(index, title, description, powerUpType) {
        const y = this.scene.cameras.main.centerY - 40 + (index - 1) * 60;

        // Option background
        const optionBg = this.scene.add.rectangle(
            this.scene.cameras.main.centerX,
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
        const optionText = this.scene.add.text(
            this.scene.cameras.main.centerX,
            y - 8,
            `${index}. ${title}`,
            {
                fontSize: "18px",
                fill: "#ffffff",
                fontStyle: "bold",
            }
        );
        optionText.setOrigin(0.5);
        optionText.setScrollFactor(0);
        optionText.setDepth(2002);

        // Description text
        const descText = this.scene.add.text(
            this.scene.cameras.main.centerX,
            y + 12,
            description,
            {
                fontSize: "12px",
                fill: "#cccccc",
            }
        );
        descText.setOrigin(0.5);
        descText.setScrollFactor(0);
        descText.setDepth(2002);

        // Store references for cleanup
        this.elements.push(optionBg, optionText, descText);

        // Store option background for selection highlighting
        optionBg.powerUpIndex = index - 1; // Store 0-based index

        // Add hover effects
        optionBg.on("pointerover", () => {
            optionBg.setFillStyle(0x666666);
        });

        optionBg.on("pointerout", () => {
            // Only reset color if not selected via gamepad
            if (this.selectedIndex !== optionBg.powerUpIndex) {
                optionBg.setFillStyle(0x555555);
            }
        });

        // Add click handler
        optionBg.on("pointerdown", () => {
            this.selectPowerUp(powerUpType);
        });

        // Add keyboard input and store reference for cleanup
        let keyCode;
        switch (index) {
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

        const key = this.scene.input.keyboard.addKey(keyCode);
        key.on("down", () => {
            this.selectPowerUp(powerUpType);
        });
        this.keys.push(key);
    }

    selectPowerUp(powerUpIndex) {
        switch (powerUpIndex) {
            case 1:
                // Attack Speed -50ms (minimum 100ms) - bullet only
                this.scene.fireRate = Math.max(100, this.scene.fireRate - 50);
                break;
            case 2:
                // Extra Boomerang
                this.scene.boomerangCount = Math.min(
                    8,
                    this.scene.boomerangCount + 1
                );
                break;
            case 3:
                // Extra Big Boom
                this.scene.bigBoomCount = Math.min(
                    5,
                    this.scene.bigBoomCount + 1
                );
                break;
            case 4:
                // Bigger Bullets - bullet only
                this.scene.bulletScale = Math.min(
                    4.0,
                    this.scene.bulletScale + 0.5
                );
                this.scene.bulletSizeUpgradeCount++;
                break;
            case 5:
                // Increased Bullet Damage - bullet only
                this.scene.baseBulletDamage = Math.min(
                    50,
                    this.scene.baseBulletDamage + 5
                );
                break;
            case 6:
                // Health Regeneration
                this.scene.regenerationRate = Math.min(
                    2.0,
                    this.scene.regenerationRate + 0.2
                );
                break;
            case 7:
                // Flamethrower Range - flamethrower only
                this.scene.flamethrowerRange = Math.min(
                    1000,
                    (this.scene.flamethrowerRange || 300) + 50
                );
                break;
            case 8:
                // Flamethrower Damage - flamethrower only
                this.scene.flamethrowerDamage = Math.min(
                    12,
                    (this.scene.flamethrowerDamage || 2) + 1
                );
                break;
        }

        // Update character info text to reflect new stats
        if (this.scene.selectedCharacter && this.scene.characterInfoText) {
            this.scene.characterInfoText.setText(
                this.scene.getCharacterInfoText()
            );
        }

        this.hideDialog();
    }

    hideDialog() {
        this.showingDialog = false;
        this.scene.physics.resume(); // Resume the game

        // Resume the spawn timer
        if (this.scene.spawnTimer) {
            this.scene.spawnTimer.paused = false;
        }

        // Clean up dialog elements
        if (this.overlay) {
            this.overlay.destroy();
            this.overlay = null;
        }

        if (this.dialog) {
            this.dialog.destroy();
            this.dialog = null;
        }

        if (this.title) {
            this.title.destroy();
            this.title = null;
        }

        if (this.elements) {
            this.elements.forEach((element) => element.destroy());
            this.elements = [];
        }

        // Remove power-up specific keyboard listeners
        if (this.keys) {
            this.keys.forEach((key) => {
                key.removeAllListeners();
                this.scene.input.keyboard.removeKey(key);
            });
            this.keys = [];
        }

        // Clean up input state
        this.cleanupInputStates();
    }

    initializeInputStates() {
        this.selectedIndex = 0;
        this.previousButtonStates = {};
        this.currentHeldGamepadDirection = null;
        this.currentHeldKey = null;
    }

    cleanupInputStates() {
        if (this.gamepadTimer) {
            this.gamepadTimer.destroy();
            this.gamepadTimer = null;
        }

        if (this.keyTimer) {
            this.keyTimer.destroy();
            this.keyTimer = null;
        }

        this.currentHeldGamepadDirection = null;
        this.previousButtonStates = {};
        this.currentHeldKey = null;
    }

    updateSelection() {
        if (!this.elements || this.elements.length === 0) return;

        // Update visual highlighting for all power-up options
        this.elements.forEach((element, elementIndex) => {
            // Only process background rectangles (every 3rd element: bg, text, desc)
            if (elementIndex % 3 === 0) {
                const optionBg = element;
                const optionIndex = Math.floor(elementIndex / 3);

                if (optionIndex === this.selectedIndex) {
                    // Highlight selected option
                    optionBg.setFillStyle(0x888888);
                    optionBg.setStrokeStyle(3, 0xffff00); // Yellow border for selected
                } else {
                    // Reset non-selected options
                    optionBg.setFillStyle(0x555555);
                    optionBg.setStrokeStyle(2, 0x888888); // Default border
                }
            }
        });
    }

    handleGamepadNavigation() {
        if (
            !this.scene.gamepad ||
            !this.showingDialog ||
            this.availableOptions.length === 0
        ) {
            return;
        }

        let directionPressed = null;
        let deltaIndex = 0;
        const deadzone = 0.3;

        // Check D-pad
        if (this.scene.gamepad.up) {
            directionPressed = "up";
            deltaIndex = -1;
        } else if (this.scene.gamepad.down) {
            directionPressed = "down";
            deltaIndex = 1;
        }
        // Check left analog stick if no D-pad input
        else if (this.scene.gamepad.leftStick) {
            const y = this.scene.gamepad.leftStick.y;

            if (Math.abs(y) > deadzone) {
                if (y < -deadzone) {
                    directionPressed = "up";
                    deltaIndex = -1;
                } else if (y > deadzone) {
                    directionPressed = "down";
                    deltaIndex = 1;
                }
            }
        }

        if (directionPressed) {
            // If this is a new direction or different direction
            if (this.currentHeldGamepadDirection !== directionPressed) {
                this.currentHeldGamepadDirection = directionPressed;
                // Move immediately on first press
                this.moveSelection(deltaIndex);

                // Clear any existing timer
                if (this.gamepadTimer) {
                    this.gamepadTimer.destroy();
                }

                // Start repeat timer
                this.gamepadTimer = this.scene.time.delayedCall(500, () => {
                    this.startGamepadRepeat(deltaIndex);
                });
            }
        } else {
            // No direction is pressed, stop repeat
            this.stopGamepadRepeat();
        }

        // Handle gamepad selection (button 0 = B button)
        if (this.scene.gamepad.buttons) {
            const button0 = this.scene.gamepad.buttons[0];

            // Manual justDown detection
            const button0WasPressed = this.previousButtonStates[0] || false;
            const button0IsPressed = button0 && button0.pressed;
            const button0JustPressed = button0IsPressed && !button0WasPressed;

            // Update previous state
            this.previousButtonStates[0] = button0IsPressed;

            // Check for button press
            if (button0JustPressed || (button0 && button0.justDown)) {
                console.log(
                    "Gamepad B button (button 0) pressed - selecting power-up"
                );
                this.selectCurrentPowerUp();
            }
        }
    }

    handleKeyNavigation() {
        if (!this.showingDialog || this.availableOptions.length === 0) {
            return;
        }

        let keyPressed = null;
        let deltaIndex = 0;

        // Check arrow keys
        if (this.scene.cursors.up.isDown) {
            keyPressed = "up";
            deltaIndex = -1;
        } else if (this.scene.cursors.down.isDown) {
            keyPressed = "down";
            deltaIndex = 1;
        }

        if (keyPressed) {
            // If this is a new key press or different key
            if (this.currentHeldKey !== keyPressed) {
                this.currentHeldKey = keyPressed;
                // Move immediately on first press
                this.moveSelection(deltaIndex);

                // Clear any existing timer
                if (this.keyTimer) {
                    this.keyTimer.destroy();
                }

                // Start repeat timer
                this.keyTimer = this.scene.time.delayedCall(500, () => {
                    this.startKeyRepeat(deltaIndex);
                });
            }
        } else {
            // No arrow key is pressed, stop repeat
            this.stopKeyRepeat();
        }

        // Handle Enter key selection
        if (
            this.scene.enterKey &&
            Phaser.Input.Keyboard.JustDown(this.scene.enterKey)
        ) {
            console.log("Enter key pressed - selecting power-up");
            this.selectCurrentPowerUp();
        }
    }

    moveSelection(deltaIndex) {
        if (this.availableOptions.length === 0) return;

        this.selectedIndex += deltaIndex;

        // Wrap around
        if (this.selectedIndex < 0) {
            this.selectedIndex = this.availableOptions.length - 1;
        } else if (this.selectedIndex >= this.availableOptions.length) {
            this.selectedIndex = 0;
        }

        console.log(`Power-up selection moved to index: ${this.selectedIndex}`);
        this.updateSelection();
    }

    startGamepadRepeat(deltaIndex) {
        // Clear existing repeat timer
        if (this.gamepadTimer) {
            this.gamepadTimer.destroy();
        }

        // Create repeating timer
        this.gamepadTimer = this.scene.time.addEvent({
            delay: 150,
            callback: () => {
                // Only continue if the direction is still held down
                if (
                    this.currentHeldGamepadDirection &&
                    this.isGamepadDirectionStillDown()
                ) {
                    this.moveSelection(deltaIndex);
                } else {
                    this.stopGamepadRepeat();
                }
            },
            loop: true,
        });
    }

    startKeyRepeat(deltaIndex) {
        // Clear existing repeat timer
        if (this.keyTimer) {
            this.keyTimer.destroy();
        }

        // Create repeating timer
        this.keyTimer = this.scene.time.addEvent({
            delay: 150,
            callback: () => {
                // Only continue if the key is still held down
                if (this.currentHeldKey && this.isKeyStillDown()) {
                    this.moveSelection(deltaIndex);
                } else {
                    this.stopKeyRepeat();
                }
            },
            loop: true,
        });
    }

    isGamepadDirectionStillDown() {
        if (!this.scene.gamepad) {
            return false;
        }

        const deadzone = 0.3;

        switch (this.currentHeldGamepadDirection) {
            case "up":
                return (
                    this.scene.gamepad.up ||
                    (this.scene.gamepad.leftStick &&
                        this.scene.gamepad.leftStick.y < -deadzone)
                );
            case "down":
                return (
                    this.scene.gamepad.down ||
                    (this.scene.gamepad.leftStick &&
                        this.scene.gamepad.leftStick.y > deadzone)
                );
            default:
                return false;
        }
    }

    isKeyStillDown() {
        if (!this.scene.cursors) {
            return false;
        }

        switch (this.currentHeldKey) {
            case "up":
                return this.scene.cursors.up.isDown;
            case "down":
                return this.scene.cursors.down.isDown;
            default:
                return false;
        }
    }

    stopGamepadRepeat() {
        if (this.gamepadTimer) {
            this.gamepadTimer.destroy();
            this.gamepadTimer = null;
        }
        this.currentHeldGamepadDirection = null;
    }

    stopKeyRepeat() {
        if (this.keyTimer) {
            this.keyTimer.destroy();
            this.keyTimer = null;
        }
        this.currentHeldKey = null;
    }

    selectCurrentPowerUp() {
        if (
            this.availableOptions.length === 0 ||
            this.selectedIndex < 0 ||
            this.selectedIndex >= this.availableOptions.length
        ) {
            return;
        }

        const selectedPowerUp = this.availableOptions[this.selectedIndex];
        console.log(
            `Selecting power-up: ${selectedPowerUp.title} (type: ${selectedPowerUp.type})`
        );
        this.selectPowerUp(selectedPowerUp.type);
    }
}

// Health regeneration utility function
export function updateRegeneration(scene) {
    if (scene.regenerationRate > 0 && scene.health < scene.maxHealth) {
        const currentTime = scene.time.now;
        if (currentTime - scene.lastRegenerationTime >= 1000) {
            // Every second
            const healAmount = scene.regenerationRate;
            scene.health = Math.min(scene.maxHealth, scene.health + healAmount);
            scene.updateHealthBar();
            scene.lastRegenerationTime = currentTime;
        }
    }
}
