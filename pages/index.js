import Head from 'next/head';
import { useEffect } from 'react';

export default function Home() {
    useEffect(() => {
        const phaser = document.createElement('script');
        phaser.src = '/phaser.js';
        phaser.onload = () => {
            const game = document.createElement('script');
            game.type = 'module';
            game.src = '/src/main.js';
            document.body.appendChild(game);
        };
        document.body.appendChild(phaser);
    }, []);

    return (
        <>
            <Head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Banny</title>
                <style>{`
                    *,
                    *::before,
                    *::after {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    html, body {
                        width: 100%;
                        height: 100%;
                    }
                    body {
                        line-height: 1;
                        font-family: Arial, sans-serif;
                        background-color: #040218;
                    }
                    ol, ul { list-style: none; }
                    img, video {
                        max-width: 100%;
                        height: auto;
                        display: block;
                    }
                    a {
                        text-decoration: none;
                        color: inherit;
                    }
                `}</style>
            </Head>
            <div id="game-container"></div>
        </>
    );
}
