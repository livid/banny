// Simple test to check which characters have regen > 0
const cacheBuster = new Date().getTime();
fetch(`assets/characters/characters.json?v=${cacheBuster}`)
    .then((response) => response.json())
    .then((characters) => {
        console.log("Characters with regen > 0:");
        characters.forEach((char, index) => {
            if (char.regen > 0) {
                console.log(
                    `${index}: ${char.name} - Regen: ${char.regen}/s, Health: ${char.health}`
                );
            }
        });

        const regenCharacters = characters.filter((char) => char.regen > 0);
        console.log(
            `\nTotal characters with regen: ${regenCharacters.length} out of ${characters.length}`
        );
    })
    .catch((error) => console.error("Error loading characters:", error));
