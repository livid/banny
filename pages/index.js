import dynamic from 'next/dynamic';
import Head from 'next/head';

const PhaserGame = dynamic(() => import('../components/PhaserGame'), {
  ssr: false,
});

export default function Home() {
  return (
    <>
      <Head>
        <title>Banny</title>
      </Head>
      <PhaserGame />
    </>
  );
}
