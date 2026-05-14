import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cortex',
  description: 'Vector storage for AI/LLM applications built with Effect and ZVec. Type-safe, pluggable, and designed for explicit memory management.',
};

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1 max-w-2xl mx-auto px-4">
      <h1 className="text-4xl font-bold mb-4">Cortex</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Developer-controlled context memory layer for Effect applications
      </p>
      <p className="text-muted-foreground mb-8">
        Vector storage for AI/LLM applications, built with Effect and ZVec.
        Type-safe, pluggable, and designed for explicit memory management.
      </p>
      <div className="flex gap-4 justify-center">
        <Link
          href="/docs"
          className="inline-flex items-center rounded-lg bg-foreground text-background px-4 py-2 font-medium"
        >
          Get Started
        </Link>
        <Link
          href="https://github.com/thaletto/cortex"
          className="inline-flex items-center rounded-lg border px-4 py-2 font-medium"
        >
          GitHub
        </Link>
      </div>
    </div>
  );
}
