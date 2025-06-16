import Head from 'next/head';
import Script from 'next/script';

export default function Home() {
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
            <Script src="/phaser.js" />
            <Script type="module" src="/src/main.js" />
        </>
    );
}
