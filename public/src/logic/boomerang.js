/**
 * Boomerang logic module
 * Handles boomerang creation, update, and collision logic
 */

/**
 * Shoots boomerangs based on the current boomerang count
 * @param {Phaser.Scene} scene - The game scene
 */
export function shootBoomerang(scene) {
    if (
        !scene.isGameActive() ||
        scene.boomerangCount <= 0 ||
        !scene.isGroupValid(scene.boomerangs)
    )
        return;

    const currentTime = scene.time.now;
    if (currentTime - scene.lastBoomerangTime < scene.boomerangCooldown) return;

    scene.lastBoomerangTime = currentTime;

    try {
        for (let i = 0; i < scene.boomerangCount; i++) {
            const boomerang = scene.boomerangs.create(
                scene.player.x,
                scene.player.y,
                "boomerang"
            );
            if (!boomerang) continue;

            boomerang.setScale(4);

            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);

            // Store boomerang properties
            Object.assign(boomerang, {
                startX: scene.player.x,
                startY: scene.player.y,
                angle: angle,
                travelDistance: 360,
                distanceTraveled: 0,
                returning: false,
                speed: 500,
                outboundHits: new WeakSet(), // Track monsters hit while going outbound
                returnHits: new WeakSet(), // Track monsters hit while returning
                damagePerSecond: scene.baseBulletDamage * 2, // Damage per second, not per frame
            });

            const velocity = new Phaser.Math.Vector2();
            velocity.setToPolar(angle, boomerang.speed);
            boomerang.setVelocity(velocity.x, velocity.y);
        }
    } catch (error) {
        console.warn("Error creating boomerang:", error);
    }
}

/**
 * Updates all boomerangs - handles movement, rotation, and return logic
 * @param {Phaser.Scene} scene - The game scene
 */
export function updateBoomerangs(scene) {
    if (
        !scene.isGroupValid(scene.boomerangs) ||
        !scene.isSpriteValid(scene.player)
    )
        return;

    scene.safeGroupForEach(scene.boomerangs, (boomerang) => {
        boomerang.rotation += 0.3;

        const currentDistance = Phaser.Math.Distance.Between(
            boomerang.startX,
            boomerang.startY,
            boomerang.x,
            boomerang.y
        );

        if (
            !boomerang.returning &&
            currentDistance >= boomerang.travelDistance
        ) {
            boomerang.returning = true;
        }

        if (boomerang.returning) {
            const angle = Phaser.Math.Angle.Between(
                boomerang.x,
                boomerang.y,
                scene.player.x,
                scene.player.y
            );
            const velocity = new Phaser.Math.Vector2();
            velocity.setToPolar(angle, boomerang.speed);
            boomerang.setVelocity(velocity.x, velocity.y);

            const distanceToPlayer = Phaser.Math.Distance.Between(
                boomerang.x,
                boomerang.y,
                scene.player.x,
                scene.player.y
            );

            if (distanceToPlayer < 30) {
                boomerang.destroy();
            }
        }
    });
}

/**
 * Handles collision between boomerang and monster
 * @param {Phaser.Physics.Arcade.Sprite} boomerang - The boomerang sprite
 * @param {Phaser.Physics.Arcade.Sprite} monster - The monster sprite
 * @param {Phaser.Scene} scene - The game scene
 */
export function onBoomerangHitMonster(boomerang, monster, scene) {
    // Initialize damage tracking WeakSets for this boomerang
    if (!boomerang.outboundHits) {
        boomerang.outboundHits = new WeakSet();
    }
    if (!boomerang.returnHits) {
        boomerang.returnHits = new WeakSet();
    }

    // Check if this monster has already been hit in the current phase
    let shouldDamage = false;

    if (boomerang.returning) {
        // Boomerang is returning - check if we've already hit this monster on return
        if (!boomerang.returnHits.has(monster)) {
            shouldDamage = true;
            boomerang.returnHits.add(monster);
        }
    } else {
        // Boomerang is going outbound - check if we've already hit this monster outbound
        if (!boomerang.outboundHits.has(monster)) {
            shouldDamage = true;
            boomerang.outboundHits.add(monster);
        }
    }

    if (!shouldDamage) {
        return;
    }

    scene.playSoundSafe(scene.hurtSound);

    // Calculate damage based on per-second rate
    const baseDamage = boomerang.damagePerSecond || scene.baseBulletDamage * 2;
    const damage = scene.calculateDistanceBasedDamage(baseDamage, monster);

    // Apply damage to monster
    monster.currentHealth -= damage;

    // Show damage number
    scene.showDamageNumber(monster.x, monster.y - 20, damage);

    // Create health bar if monster has taken damage and isn't at full health
    if (monster.currentHealth < monster.maxHealth) {
        scene.createMonsterHealthBar(monster);
    }

    // Update health bar
    scene.updateMonsterHealthBar(monster);

    // Check if monster is destroyed
    if (monster.currentHealth <= 0) {
        scene.createExplosion(monster.x, monster.y);
        scene.destroyMonsterHealthBar(monster);
        monster.destroy();
        scene.updateScore(monster);
    }
}
