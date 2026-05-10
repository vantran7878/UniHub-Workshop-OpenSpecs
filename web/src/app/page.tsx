import Link from "next/link";

export default function Home() {
  return (
    <div className="relative isolate">
      {/* Background decoration */}
      <div
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        aria-hidden="true"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
            Empower Your Skills with UniHub Workshop
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Discover, register, and attend world-class workshops tailored for university students. 
            From AI to Soft Skills, we have everything you need to grow.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/workshops"
              className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Browse Workshops
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-50"
            >
              Sign In <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className="mt-16 flow-root sm:mt-24">
          <div className="-m-2 rounded-xl bg-zinc-900/5 p-2 ring-1 ring-inset ring-zinc-900/10 dark:bg-zinc-50/5 lg:-m-4 lg:rounded-2xl lg:p-4">
            <div className="rounded-md bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-zinc-900/10">
               {/* Decorative placeholder for a screenshot/UI preview */}
               <div className="p-12 text-center">
                  <div className="mx-auto h-64 w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <span className="text-zinc-400">Workshop Dashboard Preview</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature section */}
      <div className="mx-auto mt-32 max-w-7xl px-6 sm:mt-40 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">Faster Learning</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            Everything you need to manage your university workshops
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {[
              {
                name: 'Easy Registration',
                description: 'Sign up for any workshop with just one click. Instant confirmation and QR codes.',
              },
              {
                name: 'AI-Powered Summaries',
                description: 'Get concise summaries of workshop content powered by state-of-the-art AI.',
              },
              {
                name: 'Seamless Check-in',
                description: 'Use your unique QR code for quick and contactless check-in at the venue.',
              },
            ].map((feature) => (
              <div key={feature.name} className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-zinc-900 dark:text-zinc-50">
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-zinc-600 dark:text-zinc-400">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
