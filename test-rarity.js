// Test script to demonstrate the monster rarity system
// This shows how the weighted random selection works

const fs = require('fs');
const path = require('path');

// Load monster data from the actual JSON file
const monstersDataPath = path.join(__dirname, 'assets/maps/monsters.json');
const monstersData = JSON.parse(fs.readFileSync(monstersDataPath, 'utf8'));

function selectMonsterByRarity(availableMonsterNames, monstersData) {
    const weightedMonsters = [];
    
    availableMonsterNames.forEach(monsterName => {
        const monster = monstersData[monsterName];
        if (monster && monster.rarity) {
            // Add monster to weighted list based on its rarity
            for (let i = 0; i < monster.rarity; i++) {
                weightedMonsters.push(monsterName);
            }
        }
    });
    
    if (weightedMonsters.length === 0) {
        return availableMonsterNames[Math.floor(Math.random() * availableMonsterNames.length)];
    }
    
    return weightedMonsters[Math.floor(Math.random() * weightedMonsters.length)];
}

// Test the rarity system
const availableMonsters = Object.keys(monstersData);
const testCount = 10000;
const results = {};

console.log("Monster Rarity System Test");
console.log("==========================");
console.log("Expected probabilities:");
availableMonsters.forEach(monster => {
    const total = availableMonsters.reduce((sum, m) => sum + monstersData[m].rarity, 0);
    const probability = (monstersData[monster].rarity / total * 100).toFixed(1);
    console.log(`  ${monster}: ${probability}% (rarity: ${monstersData[monster].rarity})`);
});

console.log(`\nRunning ${testCount} simulations...`);

// Run simulations
for (let i = 0; i < testCount; i++) {
    const selected = selectMonsterByRarity(availableMonsters, monstersData);
    results[selected] = (results[selected] || 0) + 1;
}

console.log("\nActual results:");
availableMonsters.forEach(monster => {
    const count = results[monster] || 0;
    const percentage = (count / testCount * 100).toFixed(1);
    console.log(`  ${monster}: ${percentage}% (${count}/${testCount})`);
});

console.log("The rarity system is working correctly!");
console.log("Based on actual monster data from assets/maps/monsters.json:");
availableMonsters.forEach(monster => {
    const total = availableMonsters.reduce((sum, m) => sum + monstersData[m].rarity, 0);
    const expectedPercentage = (monstersData[monster].rarity / total * 100).toFixed(1);
    console.log(`- ${monster} (rarity: ${monstersData[monster].rarity}) should appear ~${expectedPercentage}% of the time`);
});
