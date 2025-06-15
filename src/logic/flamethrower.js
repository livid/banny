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
    scene.flamethrowerRange = 200; // 200px range
    scene.flamethrowerDamage = 5; // 5 damage per tick

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
        return;
    }

    if (!scene.isGameActive() || !scene.isSpriteValid(scene.player)) {
        return;
    }

    const currentTime = scene.time.now;

    // Auto-fire - constantly shooting when character has flamethrower
    if (currentTime - scene.lastShotTime >= scene.fireRate) {
        scene.lastShotTime = currentTime;
        scene.isFlamethrowerActive = true;

        // Find target direction
        const nearestMonster = scene.findNearestMonster();
        let targetX = scene.player.x + scene.flamethrowerRange;
        let targetY = scene.player.y;

        if (nearestMonster) {
            targetX = nearestMonster.x;
            targetY = nearestMonster.y;
        } else {
            // Use player facing direction as fallback
            targetX =
                scene.player.x +
                (scene.player.flipX
                    ? -scene.flamethrowerRange
                    : scene.flamethrowerRange);
        }

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
    const angle = Phaser.Math.Angle.Between(
        player.x,
        player.y,
        targetX,
        targetY
    );
    const distance = Phaser.Math.Distance.Between(
        player.x,
        player.y,
        targetX,
        targetY
    );
    const maxDistance = Math.min(distance, scene.flamethrowerRange);

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
        const spreadAngle = angle + Phaser.Math.FloatBetween(-0.3, 0.3); // 30 degree spread
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
    if (!scene.isGroupValid(scene.monsters) || !scene.flyingParticles) return;

    // Check damage interval
    if (
        currentTime - scene.lastFlamethrowerDamageTime <
        scene.flamethrowerDamageInterval
    ) {
        return;
    }

    scene.lastFlamethrowerDamageTime = currentTime;

    // Check for particle-monster collisions
    scene.flyingParticles.forEach((particleData) => {
        if (!particleData.sprite || !particleData.sprite.active) return;

        const particle = particleData.sprite;

        scene.monsters.children.entries.forEach((monster) => {
            if (!scene.isSpriteValid(monster)) return;

            const distance = Phaser.Math.Distance.Between(
                particle.x,
                particle.y,
                monster.x,
                monster.y
            );

            // If particle is close to monster (within 20px), damage it
            if (distance <= 20) {
                onFlamethrowerHitMonster(scene, monster);
            }
        });
    });
}

/**
 * Handle flamethrower hit on monster
 * @param {Phaser.Scene} scene - The game scene
 * @param {Phaser.GameObjects.Sprite} monster - The monster hit
 */
export function onFlamethrowerHitMonster(scene, monster) {
    if (!scene.isSpriteValid(monster)) return;

    // Apply damage
    monster.health -= scene.flamethrowerDamage;

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
    if (monster.health <= 0) {
        scene.addScore(monster.points || 10);
        scene.addExperience(monster.experience || 5);

        // Create death explosion
        const explosion = scene.add.sprite(
            monster.x,
            monster.y,
            "blue-explosion"
        );
        if (explosion) {
            explosion.setScale(0.5);
            explosion.setTint(0xff4500); // Orange tint for fire effect
            explosion.play("explosion");
            explosion.once("animationcomplete", () => {
                if (explosion && explosion.active) {
                    explosion.destroy();
                }
            });
        }

        // Play death sound
        scene.playSoundSafe(scene.monsterDeathSound);

        // Remove monster
        if (monster.active) {
            monster.destroy();
        }
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
