"use client";

import Header from "../components/Header";
import PlanesView from "../components/PlanesView";

export default function PublicPlanesPage() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col transition-colors duration-300">
      <Header />
      <main className="container mx-auto px-4 py-8 flex-grow">
        <PlanesView />
      </main>
    </div>
  );
}
