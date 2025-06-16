/**
 * Bullet logic module
 * Handles bullet creation, collision, and cleanup logic
 */

/**
 * Shoots bullets toward the nearest monster or in a random direction
 * @param {Phaser.Scene} scene - The game scene
 */
export function shootBullet(scene) {
    if (
        !scene.isGameActive() ||
        !scene.isGroupValid(scene.bullets) ||
        !scene.isSpriteValid(scene.player)
    )
        return;

    const currentTime = scene.time.now;
    if (currentTime - scene.lastShotTime < scene.fireRate) return;

    scene.lastShotTime = currentTime;
    scene.playSoundSafe(scene.laserSound);

    try {
        const bullet = scene.bullets.create(
            scene.player.x,
            scene.player.y,
            "blue-explosion"
        );
        if (!bullet) return;

        bullet.setFrame(0);
        bullet.setScale(scene.bulletScale);

        // Set collision body scale to 0.5
        bullet.body.setSize(bullet.width * 0.5, bullet.height * 0.5);

        // Add visual effect for penetrating bullets
        if (scene.bulletSizeUpgradeCount > 3) {
            bullet.setTint(0x7fff00);
            bullet.setBlendMode(Phaser.BlendModes.ADD);
        }

        const nearestMonster = scene.findNearestMonster();
        const angle = nearestMonster
            ? Phaser.Math.Angle.Between(
                  scene.player.x,
                  scene.player.y,
                  nearestMonster.x,
                  nearestMonster.y
              )
            : Phaser.Math.FloatBetween(0, Math.PI * 2);

        const velocity = new Phaser.Math.Vector2();
        velocity.setToPolar(angle, 300);
        bullet.setVelocity(velocity.x, velocity.y);
    } catch (error) {
        console.warn("Error creating bullet:", error);
    }
}

/**
 * Handles collision between bullet and monster
 * @param {Phaser.Physics.Arcade.Sprite} bullet - The bullet sprite
 * @param {Phaser.Physics.Arcade.Sprite} monster - The monster sprite
 * @param {Phaser.Scene} scene - The game scene
 */
export function onBulletHitMonster(bullet, monster, scene) {
    scene.playSoundSafe(scene.hurtSound);

    // Calculate damage with distance-based variation
    const damage = scene.calculateDistanceBasedDamage(
        scene.baseBulletDamage,
        monster
    );

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

    // Only destroy bullet if it doesn't penetrate
    if (scene.bulletSizeUpgradeCount <= 3) {
        bullet.destroy();
    }

    // Check if monster is destroyed
    if (monster.currentHealth <= 0) {
        scene.createExplosion(monster.x, monster.y);
        scene.destroyMonsterHealthBar(monster);
        monster.destroy();
        scene.updateScore(monster);
    }
}

/**
 * Cleans up bullets that have gone off-screen
 * @param {Phaser.Scene} scene - The game scene
 */
export function cleanupBullets(scene) {
    if (!scene.isGroupValid(scene.bullets)) return;

    const buffer = 100;
    const bounds = scene.physics.world.bounds;

    scene.safeGroupForEach(scene.bullets, (bullet) => {
        if (
            bullet.x < -buffer ||
            bullet.x > bounds.width + buffer ||
            bullet.y < -buffer ||
            bullet.y > bounds.height + buffer
        ) {
            bullet.destroy();
        }
    });
}
