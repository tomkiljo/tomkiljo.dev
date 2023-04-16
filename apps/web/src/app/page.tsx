export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 w-full p-4 lg:static lg:w-auto font-mono font-bold text-lg text-lime-600">
          tom@dev:~$ <span className="animate-pulse">█</span>
        </p>
      </div>
    </main>
  );
}
