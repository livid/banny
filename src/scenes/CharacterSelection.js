export class CharacterSelection extends Phaser.Scene {
    constructor() {
        super("CharacterSelection");
        this.charactersData = null;
        this.selectedIndex = 0;
        this.characterSprites = [];
        this.characterFrames = [];
        this.nameTexts = [];
        this.statsTexts = [];
        this.cursors = null;
        this.enterKey = null;
        this.debugText = null;
        // Grid layout properties
        this.gridCols = 4;
        this.gridRows = 2;
        this.charactersPerPage = this.gridCols * this.gridRows;
        this.currentPage = 0;
        this.totalPages = 0;
        this.pageText = null;
        this.selectedCol = 0;
        this.selectedRow = 0;
        // Key repeat functionality
        this.keyRepeatTimer = null;
        this.keyRepeatDelay = 500; // Initial delay before repeat starts (ms)
        this.keyRepeatRate = 150; // Rate of repeat (ms between repeats)
        this.currentHeldKey = null;
        // Static text objects
        this.titleText = null;
        this.instructionsText = null;
        // Character selection tracking
        this.selectionCountsKey = "bannyCharacterSelectionCounts";
        // Gamepad support
        this.gamepad = null;
        this.gamepadRepeatTimer = null;
        this.gamepadRepeatDelay = 500;
        this.gamepadRepeatRate = 150;
        this.currentHeldGamepadDirection = null;
        this.lastButtonPressed = false;
        // Track previous button states for manual justDown detection
        this.previousButtonStates = {};
    }

    init() {
        // Reset state when scene starts
        this.selectedIndex = 0;
        this.characterSprites = [];
        this.characterFrames = [];
        this.nameTexts = [];
        this.statsTexts = [];
        this.currentPage = 0;
        this.selectedCol = 0;
        this.selectedRow = 0;
        // Reset key repeat state
        this.keyRepeatTimer = null;
        this.currentHeldKey = null;

        // Reset gamepad repeat state
        this.gamepad = null;
        this.gamepadRepeatTimer = null;
        this.currentHeldGamepadDirection = null;
        this.previousButtonStates = {};

        // Clear any existing text objects to prevent canvas context issues
        if (this.pageText) {
            this.pageText.destroy();
            this.pageText = null;
        }
        if (this.debugText) {
            this.debugText.destroy();
            this.debugText = null;
        }
        if (this.titleText) {
            this.titleText.destroy();
            this.titleText = null;
        }
        if (this.instructionsText) {
            this.instructionsText.destroy();
            this.instructionsText = null;
        }

        console.log("CharacterSelection scene initialized");
    }

    preload() {
        // Load characters data first
        this.load.json("characters-data", "assets/characters/characters.json");

        // Load background image
        this.load.image("space-background", "assets/bgs/space.png");

        // Load background music if not already loaded
        if (!this.cache.audio.exists("background-music")) {
            this.load.audio(
                "background-music",
                "assets/music/twilight-of-the-dead.mp3"
            );
        }
    }

    create() {
        // Load characters data
        this.charactersData = this.cache.json.get("characters-data");

        // Calculate total pages
        this.totalPages = Math.ceil(
            this.charactersData.length / this.charactersPerPage
        );

        // Load character images dynamically based on characters data
        const imagesToLoad = [];
        this.charactersData.forEach((character) => {
            const imageKey = character.image.replace(".png", "");
            if (!this.textures.exists(imageKey)) {
                imagesToLoad.push({
                    key: imageKey,
                    path: `assets/characters/${character.image}`,
                });
            }
        });

        // If there are images to load, load them before continuing
        if (imagesToLoad.length > 0) {
            let loadedCount = 0;
            imagesToLoad.forEach((image) => {
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
        console.log("Loaded characters:", this.charactersData);

        // Sort characters by selection count (most selected first)
        this.sortCharactersByUsage();

        // Add background image
        const background = this.add.image(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            "space-background"
        );
        background.setDisplaySize(
            this.cameras.main.width,
            this.cameras.main.height
        );
        background.setDepth(-1); // Ensure it's behind everything else

        // Add title
        this.titleText = this.add
            .text(this.cameras.main.centerX, 80, "SELECT CHARACTER", {
                fontSize: "48px",
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 3,
            })
            .setOrigin(0.5, 0.5);

        // Create character grid
        this.createCharacterGrid();

        // Add instructions
        this.instructionsText = this.add
            .text(
                this.cameras.main.centerX,
                this.cameras.main.height - 80,
                "Use ARROW KEYS or D-PAD/LEFT STICK to navigate • ENTER/START to select\nCharacters ordered by usage frequency",
                {
                    fontSize: "18px",
                    fill: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 2,
                    align: "center",
                }
            )
            .setOrigin(0.5, 0.5);

        // Add page indicator
        this.pageText = this.add
            .text(
                this.cameras.main.centerX,
                this.cameras.main.height - 40,
                "",
                {
                    fontSize: "18px",
                    fill: "#ffff00",
                    stroke: "#000000",
                    strokeThickness: 2,
                }
            )
            .setOrigin(0.5, 0.5);

        // Add debug text
        this.debugText = this.add.text(16, 16, "", {
            fontSize: "16px",
            fill: "#ffff00",
            stroke: "#000000",
            strokeThickness: 1,
        });
        this.debugText.setScrollFactor(0); // Set up input - use cursor keys for navigation
        this.cursors = this.input.keyboard.createCursorKeys();
        this.enterKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.ENTER
        );

        // Set up gamepad input (check if gamepad plugin is available)
        if (this.input.gamepad) {
            this.input.gamepad.start();
            this.input.gamepad.on("connected", (pad) => {
                console.log("Gamepad connected:", pad.id);
                console.log(
                    "Available buttons:",
                    pad.buttons ? pad.buttons.length : "No buttons array"
                );
                console.log("Gamepad object:", pad);
                this.gamepad = pad;
            });
            this.input.gamepad.on("disconnected", (pad) => {
                console.log("Gamepad disconnected:", pad.id);
                if (this.gamepad === pad) {
                    this.gamepad = null;
                    this.stopGamepadRepeat();
                }
            });

            // Check if gamepad is already connected
            if (this.input.gamepad.total > 0) {
                this.gamepad = this.input.gamepad.getPad(0);
                console.log("Gamepad already connected:", this.gamepad?.id);
                console.log(
                    "Available buttons:",
                    this.gamepad?.buttons
                        ? this.gamepad.buttons.length
                        : "No buttons array"
                );
            }
        } else {
            console.warn("Gamepad plugin not available");
        }
        console.log("Setting up keyboard input with cursor keys and ENTER");
        console.log(
            "Controller support: D-pad/Left stick for navigation, Start for selection"
        );

        // Ensure background music is playing
        let globalBackgroundMusic = this.registry.get("backgroundMusic");
        if (!globalBackgroundMusic || !globalBackgroundMusic.isPlaying) {
            // Stop any existing background music first
            if (globalBackgroundMusic) {
                globalBackgroundMusic.stop();
                globalBackgroundMusic.destroy();
            }

            globalBackgroundMusic = this.sound.add("background-music", {
                volume: 0.3,
                loop: true,
            });
            globalBackgroundMusic.play();

            // Store in global registry
            this.registry.set("backgroundMusic", globalBackgroundMusic);
        }

        // Initial selection highlight
        this.updateSelection();

        // Add periodic gamepad debug logging
        this.time.addEvent({
            delay: 2000,
            callback: () => {
                if (this.gamepad) {
                    console.log("Gamepad status check:", {
                        id: this.gamepad.id,
                        connected: this.gamepad.connected,
                        buttonsLength: this.gamepad.buttons?.length,
                        axesLength: this.gamepad.axes?.length,
                        timestamp: this.gamepad.timestamp,
                    });
                } else {
                    console.log("No gamepad detected");
                }
            },
            loop: true,
        });
    }

    // Character selection tracking methods
    getSelectionCounts() {
        try {
            const counts = localStorage.getItem(this.selectionCountsKey);
            return counts ? JSON.parse(counts) : {};
        } catch (error) {
            console.warn(
                "Error reading selection counts from localStorage:",
                error
            );
            return {};
        }
    }

    saveSelectionCounts(counts) {
        try {
            localStorage.setItem(
                this.selectionCountsKey,
                JSON.stringify(counts)
            );
        } catch (error) {
            console.warn(
                "Error saving selection counts to localStorage:",
                error
            );
        }
    }

    incrementSelectionCount(characterId) {
        const counts = this.getSelectionCounts();
        counts[characterId] = (counts[characterId] || 0) + 1;
        this.saveSelectionCounts(counts);
        console.log(
            `Character ${characterId} selected ${counts[characterId]} times`
        );
    }

    sortCharactersByUsage() {
        const selectionCounts = this.getSelectionCounts();

        // Sort characters by selection count (descending), then by name (ascending), with 0x names at the end
        this.charactersData.sort((a, b) => {
            const countA = selectionCounts[a.nft_id] || 0;
            const countB = selectionCounts[b.nft_id] || 0;

            // If counts are different, sort by count (descending)
            if (countA !== countB) {
                return countB - countA;
            }

            // If counts are the same, check for 0x names
            const aStartsWith0x = a.name.startsWith("0x");
            const bStartsWith0x = b.name.startsWith("0x");

            // If one starts with 0x and the other doesn't, put 0x at the end
            if (aStartsWith0x && !bStartsWith0x) {
                return 1; // a goes after b
            }
            if (!aStartsWith0x && bStartsWith0x) {
                return -1; // a goes before b
            }

            // If both have same 0x status, sort by name (ascending)
            return a.name.localeCompare(b.name);
        });

        console.log(
            "Characters sorted by usage (then name, 0x names last):",
            this.charactersData.map((char) => ({
                name: char.name,
                id: char.nft_id,
                count: selectionCounts[char.nft_id] || 0,
            }))
        );
    }

    update() {
        // Handle input in update loop for more reliable detection
        // Only process input if keys have been initialized
        if (!this.cursors || !this.enterKey) {
            return;
        }

        // Handle arrow key navigation with repeat support
        this.handleKeyNavigation();

        // Handle gamepad navigation
        this.handleGamepadNavigation();

        // Debug: Log any gamepad input activity
        if (this.gamepad) {
            // Check if gamepad object exists and has expected properties
            if (!this.gamepad.buttons && !this.gamepad.axes) {
                console.log("Gamepad connected but no buttons/axes detected");
            }

            // Log any button activity
            if (this.gamepad.buttons) {
                for (let i = 0; i < this.gamepad.buttons.length; i++) {
                    const button = this.gamepad.buttons[i];
                    if (
                        button &&
                        (button.pressed || button.justDown || button.value > 0)
                    ) {
                        console.log(
                            `Gamepad button ${i}: pressed=${button.pressed}, justDown=${button.justDown}, value=${button.value}`
                        );
                    }
                }
            }

            // Log any axis activity
            if (this.gamepad.axes) {
                for (let i = 0; i < this.gamepad.axes.length; i++) {
                    if (Math.abs(this.gamepad.axes[i]) > 0.1) {
                        console.log(
                            `Gamepad axis ${i}: ${this.gamepad.axes[i]}`
                        );
                    }
                }
            }
        }
        // Handle page navigation (Q/E keys) - REMOVED

        // Handle character selection (keyboard and gamepad)
        if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            console.log("Enter key pressed - selecting character");
            this.selectCharacter();
        }

        // Handle gamepad selection (Start button only)
        if (this.gamepad) {
            // Check for specific button presses based on your controller mapping
            if (this.gamepad.buttons) {
                // Button 9 = Start button on your controller
                const button9 = this.gamepad.buttons[9];

                // Manual justDown detection for button 9
                const button9WasPressed = this.previousButtonStates[9] || false;
                const button9IsPressed = button9 && button9.pressed;
                const button9JustPressed =
                    button9IsPressed && !button9WasPressed;

                // Update previous states
                this.previousButtonStates[9] = button9IsPressed;

                // Check for button press
                if (button9JustPressed || (button9 && button9.justDown)) {
                    console.log(
                        "Gamepad Start button (button 9) pressed - selecting character"
                    );
                    this.selectCharacter();
                }

                // Debug logging for button states
                if (button9IsPressed) {
                    console.log(
                        `Button states - 9: ${button9IsPressed} (was: ${button9WasPressed})`
                    );
                }
            }
        }
    }

    handleKeyNavigation() {
        let keyPressed = null;
        let deltaCol = 0;
        let deltaRow = 0;

        // Check which arrow key is currently pressed
        if (this.cursors.left.isDown) {
            keyPressed = "left";
            deltaCol = -1;
        } else if (this.cursors.right.isDown) {
            keyPressed = "right";
            deltaCol = 1;
        } else if (this.cursors.up.isDown) {
            keyPressed = "up";
            deltaRow = -1;
        } else if (this.cursors.down.isDown) {
            keyPressed = "down";
            deltaRow = 1;
        }

        if (keyPressed) {
            // If this is a new key press or different key
            if (this.currentHeldKey !== keyPressed) {
                this.currentHeldKey = keyPressed;
                // Move immediately on first press
                this.moveSelection(deltaCol, deltaRow);

                // Clear any existing timer
                if (this.keyRepeatTimer) {
                    this.keyRepeatTimer.destroy();
                }

                // Start repeat timer
                this.keyRepeatTimer = this.time.delayedCall(
                    this.keyRepeatDelay,
                    () => {
                        this.startKeyRepeat(deltaCol, deltaRow);
                    }
                );
            }
        } else {
            // No arrow key is pressed, stop repeat
            this.stopKeyRepeat();
        }
    }

    startKeyRepeat(deltaCol, deltaRow) {
        // Clear existing repeat timer
        if (this.keyRepeatTimer) {
            this.keyRepeatTimer.destroy();
        }

        // Create repeating timer
        this.keyRepeatTimer = this.time.addEvent({
            delay: this.keyRepeatRate,
            callback: () => {
                // Only continue if the key is still held down
                if (this.currentHeldKey && this.isKeyStillDown()) {
                    this.moveSelection(deltaCol, deltaRow);
                } else {
                    this.stopKeyRepeat();
                }
            },
            loop: true,
        });
    }

    isKeyStillDown() {
        switch (this.currentHeldKey) {
            case "left":
                return this.cursors.left.isDown;
            case "right":
                return this.cursors.right.isDown;
            case "up":
                return this.cursors.up.isDown;
            case "down":
                return this.cursors.down.isDown;
            default:
                return false;
        }
    }

    stopKeyRepeat() {
        if (this.keyRepeatTimer) {
            this.keyRepeatTimer.destroy();
            this.keyRepeatTimer = null;
        }
        this.currentHeldKey = null;
    }

    handleGamepadNavigation() {
        if (!this.gamepad) {
            return;
        }

        let directionPressed = null;
        let deltaCol = 0;
        let deltaRow = 0;
        const deadzone = 0.3; // Deadzone for analog stick

        // Check D-pad
        if (this.gamepad.left) {
            directionPressed = "left";
            deltaCol = -1;
        } else if (this.gamepad.right) {
            directionPressed = "right";
            deltaCol = 1;
        } else if (this.gamepad.up) {
            directionPressed = "up";
            deltaRow = -1;
        } else if (this.gamepad.down) {
            directionPressed = "down";
            deltaRow = 1;
        }
        // Check left analog stick if no D-pad input
        else if (this.gamepad.leftStick) {
            const x = this.gamepad.leftStick.x;
            const y = this.gamepad.leftStick.y;

            if (Math.abs(x) > deadzone || Math.abs(y) > deadzone) {
                // Determine primary direction
                if (Math.abs(x) > Math.abs(y)) {
                    if (x > deadzone) {
                        directionPressed = "right";
                        deltaCol = 1;
                    } else if (x < -deadzone) {
                        directionPressed = "left";
                        deltaCol = -1;
                    }
                } else {
                    if (y > deadzone) {
                        directionPressed = "down";
                        deltaRow = 1;
                    } else if (y < -deadzone) {
                        directionPressed = "up";
                        deltaRow = -1;
                    }
                }
            }
        }

        if (directionPressed) {
            // If this is a new direction or different direction
            if (this.currentHeldGamepadDirection !== directionPressed) {
                this.currentHeldGamepadDirection = directionPressed;
                // Move immediately on first press
                this.moveSelection(deltaCol, deltaRow);

                // Clear any existing timer
                if (this.gamepadRepeatTimer) {
                    this.gamepadRepeatTimer.destroy();
                }

                // Start repeat timer
                this.gamepadRepeatTimer = this.time.delayedCall(
                    this.gamepadRepeatDelay,
                    () => {
                        this.startGamepadRepeat(deltaCol, deltaRow);
                    }
                );
            }
        } else {
            // No direction is pressed, stop repeat
            this.stopGamepadRepeat();
        }
    }

    startGamepadRepeat(deltaCol, deltaRow) {
        // Clear existing repeat timer
        if (this.gamepadRepeatTimer) {
            this.gamepadRepeatTimer.destroy();
        }

        // Create repeating timer
        this.gamepadRepeatTimer = this.time.addEvent({
            delay: this.gamepadRepeatRate,
            callback: () => {
                // Only continue if the direction is still held down
                if (
                    this.currentHeldGamepadDirection &&
                    this.isGamepadDirectionStillDown()
                ) {
                    this.moveSelection(deltaCol, deltaRow);
                } else {
                    this.stopGamepadRepeat();
                }
            },
            loop: true,
        });
    }

    isGamepadDirectionStillDown() {
        if (!this.gamepad) {
            return false;
        }

        const deadzone = 0.3;

        switch (this.currentHeldGamepadDirection) {
            case "left":
                return (
                    this.gamepad.left ||
                    (this.gamepad.leftStick &&
                        this.gamepad.leftStick.x < -deadzone)
                );
            case "right":
                return (
                    this.gamepad.right ||
                    (this.gamepad.leftStick &&
                        this.gamepad.leftStick.x > deadzone)
                );
            case "up":
                return (
                    this.gamepad.up ||
                    (this.gamepad.leftStick &&
                        this.gamepad.leftStick.y < -deadzone)
                );
            case "down":
                return (
                    this.gamepad.down ||
                    (this.gamepad.leftStick &&
                        this.gamepad.leftStick.y > deadzone)
                );
            default:
                return false;
        }
    }

    stopGamepadRepeat() {
        if (this.gamepadRepeatTimer) {
            this.gamepadRepeatTimer.destroy();
            this.gamepadRepeatTimer = null;
        }
        this.currentHeldGamepadDirection = null;
    }

    createCharacterGrid() {
        // Clear existing sprites and frames
        this.characterSprites.forEach((sprite) => sprite.destroy());
        this.characterFrames.forEach((frame) => frame.destroy());
        this.nameTexts.forEach((text) => text.destroy());
        this.statsTexts.forEach((text) => text.destroy());

        this.characterSprites = [];
        this.characterFrames = [];
        this.nameTexts = [];
        this.statsTexts = [];

        // Calculate grid layout for 4x2 (8 characters per page)
        const cellWidth = 220;
        const cellHeight = 250;
        const gridWidth = this.gridCols * cellWidth;
        const gridHeight = this.gridRows * cellHeight;
        const startX =
            this.cameras.main.centerX - gridWidth / 2 + cellWidth / 2;
        const startY =
            this.cameras.main.centerY - gridHeight / 2 + cellHeight / 2;

        // Get characters for current page
        const startIndex = this.currentPage * this.charactersPerPage;
        const endIndex = Math.min(
            startIndex + this.charactersPerPage,
            this.charactersData.length
        );
        const pageCharacters = this.charactersData.slice(startIndex, endIndex);

        pageCharacters.forEach((character, index) => {
            const col = index % this.gridCols;
            const row = Math.floor(index / this.gridCols);
            const x = startX + col * cellWidth;
            const y = startY + row * cellHeight;

            // Create character frame (background) - larger for 8 per page
            const frame = this.add.rectangle(x, y, 200, 220, 0x333333);
            frame.setStrokeStyle(3, 0x666666);
            this.characterFrames.push(frame);

            // Load and display character image (400x400 -> 100x100)
            const charSprite = this.add.image(
                x,
                y - 30,
                character.image.replace(".png", "")
            );
            charSprite.setScale(0.25);
            this.characterSprites.push(charSprite);

            // Character name (use smaller font for longer names)
            const displayName = character.name;
            const fontSize = displayName.length > 12 ? "14px" : "18px";
            const nameText = this.add
                .text(x, y + 50, displayName, {
                    fontSize: fontSize,
                    fill: "#ffffff",
                    stroke: "#000000",
                    strokeThickness: 1,
                })
                .setOrigin(0.5, 0.5);
            this.nameTexts.push(nameText);

            // Character stats - show name, NFT ID, and selection count
            const selectionCounts = this.getSelectionCounts();
            const selectionCount = selectionCounts[character.nft_id] || 0;
            const countText = selectionCount > 0 ? ` (×${selectionCount})` : "";
            const statsText = this.add
                .text(x, y + 75, `${character.nft_id}${countText}`, {
                    fontSize: "12px",
                    fill: "#cccccc",
                    stroke: "#000000",
                    strokeThickness: 1,
                    align: "center",
                })
                .setOrigin(0.5, 0.5);
            this.statsTexts.push(statsText);
        });

        // Update page text
        this.updatePageText();
    }

    moveSelection(deltaCol, deltaRow) {
        const newCol = this.selectedCol + deltaCol;
        const newRow = this.selectedRow + deltaRow;

        // Check for page navigation when reaching edges
        if (newCol < 0) {
            // Moving left from leftmost column - go to previous page, rightmost column
            if (this.changePage(-1)) {
                this.selectedCol = this.gridCols - 1;
                this.selectedRow = Math.min(
                    this.selectedRow,
                    this.getLastRowOnPage()
                );
                this.selectedIndex =
                    this.currentPage * this.charactersPerPage +
                    this.selectedRow * this.gridCols +
                    this.selectedCol;
                this.updateSelection();
            }
            return;
        }

        if (newCol >= this.gridCols) {
            // Moving right from rightmost column - go to next page, leftmost column
            if (this.changePage(1)) {
                this.selectedCol = 0;
                this.selectedRow = Math.min(
                    this.selectedRow,
                    this.getLastRowOnPage()
                );
                this.selectedIndex =
                    this.currentPage * this.charactersPerPage +
                    this.selectedRow * this.gridCols +
                    this.selectedCol;
                this.updateSelection();
            }
            return;
        }

        if (newRow < 0) {
            // Moving up from top row - go to previous page, bottom row
            if (this.changePage(-1)) {
                this.selectedCol = Math.min(
                    this.selectedCol,
                    this.getLastColOnPage()
                );
                this.selectedRow = this.getLastRowOnPage();
                this.selectedIndex =
                    this.currentPage * this.charactersPerPage +
                    this.selectedRow * this.gridCols +
                    this.selectedCol;
                this.updateSelection();
            }
            return;
        }

        if (newRow >= this.gridRows) {
            // Moving down from bottom row - go to next page, top row
            if (this.changePage(1)) {
                this.selectedCol = Math.min(
                    this.selectedCol,
                    this.getLastColOnPage()
                );
                this.selectedRow = 0;
                this.selectedIndex =
                    this.currentPage * this.charactersPerPage +
                    this.selectedRow * this.gridCols +
                    this.selectedCol;
                this.updateSelection();
            }
            return;
        }

        // Normal movement within current page
        const newIndex = newRow * this.gridCols + newCol;
        const startIndex = this.currentPage * this.charactersPerPage;
        const pageCharacterCount = Math.min(
            this.charactersPerPage,
            this.charactersData.length - startIndex
        );

        // Only move if the new position has a character
        if (newIndex < pageCharacterCount) {
            this.selectedCol = newCol;
            this.selectedRow = newRow;
            this.selectedIndex = startIndex + newIndex;
            console.log(
                `New grid position: col=${this.selectedCol}, row=${this.selectedRow}, index=${this.selectedIndex}`
            );
            this.updateSelection();
        }
    }

    getLastRowOnPage() {
        const startIndex = this.currentPage * this.charactersPerPage;
        const pageCharacterCount = Math.min(
            this.charactersPerPage,
            this.charactersData.length - startIndex
        );
        return Math.floor((pageCharacterCount - 1) / this.gridCols);
    }

    getLastColOnPage() {
        const startIndex = this.currentPage * this.charactersPerPage;
        const pageCharacterCount = Math.min(
            this.charactersPerPage,
            this.charactersData.length - startIndex
        );
        const lastRowStartIndex =
            Math.floor((pageCharacterCount - 1) / this.gridCols) *
            this.gridCols;
        return pageCharacterCount - 1 - lastRowStartIndex;
    }

    changePage(direction) {
        const newPage = this.currentPage + direction;
        if (newPage >= 0 && newPage < this.totalPages) {
            this.currentPage = newPage;
            console.log(
                `Changed to page ${this.currentPage + 1}/${this.totalPages}`
            );
            this.createCharacterGrid();
            return true; // Successfully changed page
        }
        return false; // Could not change page (at boundary)
    }

    updatePageText() {
        if (this.pageText && this.pageText.scene && this.charactersData) {
            this.pageText.setText(
                `Page ${this.currentPage + 1} of ${this.totalPages} (${
                    this.charactersData.length
                } characters total)`
            );
        }
    }

    updateSelection() {
        console.log(`Updating selection to index: ${this.selectedIndex}`);

        // Update debug text
        if (this.debugText && this.debugText.scene && this.charactersData) {
            const character = this.charactersData[this.selectedIndex];
            const selectionCounts = this.getSelectionCounts();
            const selectionCount = selectionCounts[character?.nft_id] || 0;
            const countText =
                selectionCount > 0
                    ? ` (selected ${selectionCount}x)`
                    : " (never selected)";
            this.debugText.setText(
                `Selected: ${this.selectedIndex} (${
                    character?.name || "Unknown"
                })${countText} - Page ${this.currentPage + 1}/${
                    this.totalPages
                }`
            );
        }

        // Calculate local index on current page
        const localIndex =
            this.selectedIndex - this.currentPage * this.charactersPerPage;

        // Reset all frames
        this.characterFrames.forEach((frame, index) => {
            if (index === localIndex) {
                frame.setStrokeStyle(3, 0xffff00); // Highlight selected
                frame.setFillStyle(0x444444);
                console.log(
                    `Highlighting frame ${index} (global index ${this.selectedIndex})`
                );
            } else {
                frame.setStrokeStyle(3, 0x666666);
                frame.setFillStyle(0x333333);
            }
        });

        // Scale selected character (100x100 base, slightly larger when selected)
        this.characterSprites.forEach((sprite, index) => {
            if (index === localIndex) {
                sprite.setScale(0.3); // 120x120 when selected
            } else {
                sprite.setScale(0.25); // 100x100 normal
            }
        });
    }

    selectCharacter() {
        console.log("selectCharacter() method called");
        console.log("Selected index:", this.selectedIndex);
        console.log("Characters data length:", this.charactersData?.length);

        const selectedCharacter = this.charactersData[this.selectedIndex];
        console.log("Selected character:", selectedCharacter);

        if (!selectedCharacter) {
            console.error("No character found at index", this.selectedIndex);
            return;
        }

        // Increment selection count in localStorage
        this.incrementSelectionCount(selectedCharacter.nft_id);

        // Add a visual confirmation
        const confirmText = this.add
            .text(
                this.cameras.main.centerX,
                this.cameras.main.height - 100,
                `Selected: ${selectedCharacter.name}`,
                {
                    fontSize: "24px",
                    fill: "#00ff00",
                    stroke: "#000000",
                    strokeThickness: 2,
                }
            )
            .setOrigin(0.5, 0.5);

        console.log(
            "Added confirmation text, storing character in registry..."
        );

        // Store selected character data globally
        this.registry.set("selectedCharacter", selectedCharacter);

        console.log("Starting scene transition in 500ms...");

        // Small delay before transitioning to make selection feel responsive
        this.time.delayedCall(500, () => {
            console.log(
                "Scene transition delay complete, starting Start scene..."
            );

            // Set transitioning flag on current Start scene if it exists
            const currentStartScene = this.scene.get("Start");
            if (currentStartScene && currentStartScene.scene.isActive()) {
                console.log("Setting transitioning flag on Start scene");
                currentStartScene.sceneTransitioning = true;
            }

            console.log('Calling this.scene.start("Start")');
            this.scene.start("Start");
        });
    }

    shutdown() {
        // Clean up key repeat timer
        this.stopKeyRepeat();

        // Clean up gamepad repeat timer
        this.stopGamepadRepeat();

        // Clean up text objects to prevent canvas context issues
        if (this.pageText) {
            this.pageText.destroy();
            this.pageText = null;
        }
        if (this.debugText) {
            this.debugText.destroy();
            this.debugText = null;
        }
        if (this.titleText) {
            this.titleText.destroy();
            this.titleText = null;
        }
        if (this.instructionsText) {
            this.instructionsText.destroy();
            this.instructionsText = null;
        }

        // Clean up character grid elements
        this.characterSprites.forEach((sprite) => sprite.destroy());
        this.characterFrames.forEach((frame) => frame.destroy());
        this.nameTexts.forEach((text) => text.destroy());
        this.statsTexts.forEach((text) => text.destroy());

        this.characterSprites = [];
        this.characterFrames = [];
        this.nameTexts = [];
        this.statsTexts = [];
        // Clean up cursor keys
        if (this.cursors) {
            this.cursors = null;
        }
        if (this.enterKey) {
            this.enterKey = null;
        }
        console.log("CharacterSelection scene shutdown");
    }
}
