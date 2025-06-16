/**
 * Big Boom logic for the game
 * Handles shooting big boom projectiles and their collision with monsters
 */

/**
 * Shoots big boom projectiles around the player
 * @param {Phaser.Scene} scene - The game scene
 */
export function shootBigBoom(scene) {
    if (
        !scene.isGameActive() ||
        scene.bigBoomCount <= 0 ||
        !scene.isGroupValid(scene.bigBooms)
    )
        return;

    const currentTime = scene.time.now;
    if (currentTime - scene.lastBigBoomTime < scene.bigBoomCooldown) return;

    scene.lastBigBoomTime = currentTime;

    try {
        for (let i = 0; i < scene.bigBoomCount; i++) {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = 300;

            const x = scene.player.x + Math.cos(angle) * distance;
            const y = scene.player.y + Math.sin(angle) * distance;

            const bigBoom = scene.bigBooms.create(x, y, "big-boom");
            if (!bigBoom) continue;

            bigBoom.setScale(8);
            bigBoom.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
            bigBoom.play("big-boom");
            bigBoom.body.setSize(32, 32);

            // Add damage tracking properties
            bigBoom.damagePerSecond = scene.baseBulletDamage * 5; // Damage per second, not per frame

            bigBoom.once("animationcomplete", () => {
                if (bigBoom?.active) bigBoom.destroy();
            });
        }
    } catch (error) {
        console.warn("Error creating big boom:", error);
    }
}

/**
 * Handles collision between big boom and monster
 * @param {Phaser.GameObjects.Sprite} bigBoom - The big boom projectile
 * @param {Phaser.GameObjects.Sprite} monster - The monster that was hit
 * @param {Phaser.Scene} scene - The game scene
 */
export function onBigBoomHitMonster(bigBoom, monster, scene) {
    // Check if this big boom has already damaged this monster
    if (bigBoom.damagedMonsters && bigBoom.damagedMonsters.has(monster)) {
        return;
    }

    scene.playSoundSafe(scene.hurtSound);

    // Calculate damage based on the damage number
    const baseDamage = bigBoom.damagePerSecond || scene.baseBulletDamage * 5;
    const damage = scene.calculateDistanceBasedDamage(baseDamage, monster);

    // Apply damage to monster
    monster.currentHealth -= damage;

    // Track that this big boom damaged this monster (damage only once)
    if (!bigBoom.damagedMonsters) {
        bigBoom.damagedMonsters = new WeakSet();
    }
    bigBoom.damagedMonsters.add(monster);

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
