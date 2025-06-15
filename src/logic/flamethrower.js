/**
 * Flamethrower logic module
 * Handles flamethrower creation, collision, and effects
 */

/**
 * Initialize flamethrower-related groups and variables for the scene
 * @param {Phaser.Scene} scene - The game scene
 */
export function initFlamethrower(scene) {
    // Create group for fire particles
    scene.fireParticles = scene.add.group();

    // Flamethrower state
    scene.isFlamethrowerActive = false;
    scene.lastFlamethrowerDamageTime = 0;
    scene.flamethrowerDamageInterval = 200; // 200ms damage interval
    scene.flamethrowerRange = 300; // 300px range
    scene.flamethrowerDamage = 2; // 2 damage per tick

    // Track flying particles
    scene.flyingParticles = [];

    // Track monsters currently being hit by flamethrower
    scene.flamethrowerHitMonsters = new Set();
}

/**
 * Update flamethrower logic - handle firing and particle effects
 * @param {Phaser.Scene} scene - The game scene
 */
export function updateFlamethrower(scene) {
    if (
        !scene.selectedCharacter ||
        scene.selectedCharacter.attackType !== "flamethrower"
    ) {
        // Not using flamethrower, reset state
        scene.isFlamethrowerActive = false;
        return;
    }

    if (!scene.isGameActive() || !scene.isSpriteValid(scene.player)) {
        return;
    }

    const currentTime = scene.time.now;

    // Flamethrower is active if character has it equipped and there are particles or we're in firing mode
    scene.isFlamethrowerActive =
        scene.flyingParticles.length > 0 ||
        currentTime - scene.lastShotTime < scene.fireRate;

    // Auto-fire - constantly shooting when character has flamethrower
    if (currentTime - scene.lastShotTime >= scene.fireRate) {
        scene.lastShotTime = currentTime;

        // Find target direction - always use full range
        const nearestMonster = scene.findNearestMonster();
        let angle;

        if (nearestMonster) {
            // Calculate direction to monster, but extend to full range
            angle = Phaser.Math.Angle.Between(
                scene.player.x,
                scene.player.y,
                nearestMonster.x,
                nearestMonster.y
            );
        } else {
            // Use player facing direction as fallback
            angle = scene.player.flipX ? Math.PI : 0;
        }

        // Always target at full range in the calculated direction
        const targetX =
            scene.player.x + Math.cos(angle) * scene.flamethrowerRange;
        const targetY =
            scene.player.y + Math.sin(angle) * scene.flamethrowerRange;

        // Create multiple flying particles
        createFlyingParticles(scene, targetX, targetY);

        // Play fire sound occasionally
        if (Math.random() < 0.3) {
            scene.playSoundSafe(scene.laserSound);
        }
    }

    // Update all flying particles
    updateFlyingParticles(scene, currentTime);

    // Handle damage to monsters in range
    handleFlamethrowerDamage(scene, currentTime);
}

/**
 * Create flying fire particles
 * @param {Phaser.Scene} scene - The game scene
 * @param {number} targetX - Target X position
 * @param {number} targetY - Target Y position
 */
function createFlyingParticles(scene, targetX, targetY) {
    if (!scene.fireParticles) return;

    const player = scene.player;
    const particleCount = 25; // More particles for better effect

    // Calculate direction to target
    const direction = Phaser.Math.Angle.Between(
        player.x,
        player.y,
        targetX,
        targetY
    );
    // Always use full flamethrower range
    const maxDistance = scene.flamethrowerRange;

    for (let i = 0; i < particleCount; i++) {
        // Create particle at player position
        const particle = scene.add.rectangle(
            player.x,
            player.y,
            6,
            6,
            0xff4500
        );

        // Add to group
        scene.fireParticles.add(particle);

        // Calculate travel distance for this particle (spread them out)
        const travelDistance =
            (maxDistance / particleCount) * (i + 1) +
            Phaser.Math.FloatBetween(-20, 20);
        const clampedDistance = Math.min(
            travelDistance,
            scene.flamethrowerRange
        );

        // Calculate end position with some spread
        const spreadAngle = direction + Phaser.Math.FloatBetween(-0.3, 0.3); // 30 degree spread
        const endX = player.x + Math.cos(spreadAngle) * clampedDistance;
        const endY = player.y + Math.sin(spreadAngle) * clampedDistance;

        // Store particle data
        const particleData = {
            sprite: particle,
            startX: player.x,
            startY: player.y,
            endX: endX,
            endY: endY,
            maxDistance: clampedDistance,
            startTime: scene.time.now,
            duration: 800, // 800ms travel time
            initialSize: 6,
        };

        scene.flyingParticles.push(particleData);

        // Set initial rotation
        particle.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
    }
}

/**
 * Update flying fire particles
 * @param {Phaser.Scene} scene - The game scene
 * @param {number} currentTime - Current time
 */
function updateFlyingParticles(scene, currentTime) {
    if (!scene.flyingParticles) return;

    // Update existing particles
    for (let i = scene.flyingParticles.length - 1; i >= 0; i--) {
        const particleData = scene.flyingParticles[i];
        const particle = particleData.sprite;

        if (!particle || !particle.active) {
            scene.flyingParticles.splice(i, 1);
            continue;
        }

        // Calculate progress (0 to 1)
        const elapsed = currentTime - particleData.startTime;
        const progress = Math.min(elapsed / particleData.duration, 1);

        if (progress >= 1) {
            // Particle reached end, destroy it
            particle.destroy();
            scene.flyingParticles.splice(i, 1);
            continue;
        }

        // Update position
        const currentX = Phaser.Math.Interpolation.Linear(
            [particleData.startX, particleData.endX],
            progress
        );
        const currentY = Phaser.Math.Interpolation.Linear(
            [particleData.startY, particleData.endY],
            progress
        );
        particle.setPosition(currentX, currentY);

        // Update alpha (1 to 0 as it travels)
        const alpha = 1 - progress;
        particle.setAlpha(alpha);

        // Update size (6 to 12 as it travels)
        const size = particleData.initialSize + progress * 6;
        particle.setSize(size, size);

        // Update rotation
        particle.rotation += 0.1;

        // Update color based on progress (orange to yellow)
        if (progress < 0.5) {
            // Stay orange for first half
            particle.setFillStyle(0xff4500); // Orange
        } else {
            // Fade to yellow for second half
            particle.setFillStyle(0xff8800); // Orange-yellow
        }
    }
}

/**
 * Handle damage to monsters within flamethrower range
 * @param {Phaser.Scene} scene - The game scene
 * @param {number} currentTime - Current time
 */
function handleFlamethrowerDamage(scene, currentTime) {
    if (!scene.isGroupValid(scene.monsters) || !scene.isFlamethrowerActive)
        return;

    // Check damage interval
    if (
        currentTime - scene.lastFlamethrowerDamageTime <
        scene.flamethrowerDamageInterval
    ) {
        return;
    }

    scene.lastFlamethrowerDamageTime = currentTime;

    // Clear hit monsters set periodically to allow re-hitting
    if (!scene.flamethrowerHitMonstersLastClear) {
        scene.flamethrowerHitMonstersLastClear = 0;
    }
    if (currentTime - scene.flamethrowerHitMonstersLastClear > 500) {
        scene.flamethrowerHitMonsters.clear();
        scene.flamethrowerHitMonstersLastClear = currentTime;
    }

    // Find target direction (same logic as particle creation) - always use full range
    const nearestMonster = scene.findNearestMonster();
    let flameAngle;

    if (nearestMonster) {
        // Calculate direction to monster
        flameAngle = Phaser.Math.Angle.Between(
            scene.player.x,
            scene.player.y,
            nearestMonster.x,
            nearestMonster.y
        );
    } else {
        // Use player facing direction as fallback
        flameAngle = scene.player.flipX ? Math.PI : 0;
    }

    // Calculate flamethrower cone direction
    const coneHalfAngle = 0.6; // ~35 degree cone (70 degrees total) - wider for better coverage
    const maxRange = scene.flamethrowerRange;

    // Check all monsters for cone collision
    const monstersHit = [];
    scene.monsters.children.entries.forEach((monster) => {
        if (!scene.isSpriteValid(monster)) return;

        const distanceToMonster = Phaser.Math.Distance.Between(
            scene.player.x,
            scene.player.y,
            monster.x,
            monster.y
        );

        // Check if monster is within range
        if (distanceToMonster <= maxRange) {
            // Calculate angle from player to monster
            const angleToMonster = Phaser.Math.Angle.Between(
                scene.player.x,
                scene.player.y,
                monster.x,
                monster.y
            );

            // Calculate angle difference
            let angleDiff = Math.abs(flameAngle - angleToMonster);
            // Normalize angle difference to be between 0 and PI
            if (angleDiff > Math.PI) {
                angleDiff = 2 * Math.PI - angleDiff;
            }

            // Check if monster is within the cone
            if (angleDiff <= coneHalfAngle) {
                monstersHit.push(monster);
            }
        }
    });

    // Damage all monsters hit by flamethrower
    monstersHit.forEach((monster) => {
        onFlamethrowerHitMonster(scene, monster);
    });
}

/**
 * Handle flamethrower hit on monster
 * @param {Phaser.Scene} scene - The game scene
 * @param {Phaser.GameObjects.Sprite} monster - The monster hit
 */
export function onFlamethrowerHitMonster(scene, monster) {
    if (!scene.isSpriteValid(monster)) return;

    scene.playSoundSafe(scene.hurtSound);

    // Calculate damage with distance-based variation (similar to other weapons)
    const baseDamage = scene.flamethrowerDamage;
    const damage = scene.calculateDistanceBasedDamage(baseDamage, monster);

    // Apply damage to monster using currentHealth (consistent with other weapons)
    monster.currentHealth -= damage;

    // Show damage number
    scene.showDamageNumber(monster.x, monster.y - 20, damage);

    // Create health bar if monster has taken damage and isn't at full health
    if (monster.currentHealth < monster.maxHealth) {
        scene.createMonsterHealthBar(monster);
    }

    // Update health bar
    scene.updateMonsterHealthBar(monster);

    // Create hit effect (small explosion)
    const hitEffect = scene.add.sprite(monster.x, monster.y, "blue-explosion");
    if (hitEffect) {
        hitEffect.setScale(0.3);
        hitEffect.setTint(0xff4500); // Orange tint for fire effect
        hitEffect.play("explosion");
        hitEffect.once("animationcomplete", () => {
            if (hitEffect && hitEffect.active) {
                hitEffect.destroy();
            }
        });
    }

    // Check if monster is dead
    if (monster.currentHealth <= 0) {
        scene.createExplosion(monster.x, monster.y);
        scene.destroyMonsterHealthBar(monster);
        monster.destroy();
        scene.updateScore(monster);
    }
}

/**
 * Clean up flamethrower resources
 * @param {Phaser.Scene} scene - The game scene
 */
export function cleanupFlamethrower(scene) {
    if (scene.fireParticles) {
        scene.fireParticles.clear(true, true);
    }
    if (scene.flyingParticles) {
        // Clean up flying particles
        scene.flyingParticles.forEach((particleData) => {
            if (particleData.sprite && particleData.sprite.active) {
                particleData.sprite.destroy();
            }
        });
        scene.flyingParticles = [];
    }
    if (scene.flamethrowerHitMonsters) {
        scene.flamethrowerHitMonsters.clear();
    }
}
