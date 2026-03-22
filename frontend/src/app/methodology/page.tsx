export default function MethodologyPage() {
  return (
    <main className="w-full max-w-6xl mx-auto px-8 pb-16 pt-6">
      <section className="glass-card p-10">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-0">
              Methodology
            </p>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4 mt-3">
              How the Model Works
            </h2>
          </div>
          <a
            href="#"
            className="glass px-5 py-3 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            View on GitHub
          </a>
        </div>
        <p className="text-lg text-white/50 max-w-2xl leading-relaxed">
          This platform combines multiple valuation approaches to estimate a
          company&apos;s intrinsic value and compare it to the current market
          price. Each method captures a different perspective on value.
        </p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
        <div className="glass-card p-8">
          <h3 className="text-xl font-semibold text-white mb-4">
            Discounted Cash Flow (DCF)
          </h3>
          <ul className="space-y-2 text-white/60 leading-relaxed list-disc list-outside pl-5">
            <li>Projects future free cash flows based on revenue growth, margins, and reinvestment</li>
            <li>Discounts cash flows using a cost of capital (WACC)</li>
            <li>Produces an intrinsic value based on fundamentals</li>
          </ul>
        </div>

        <div className="glass-card p-8">
          <h3 className="text-xl font-semibold text-white mb-4">
            Comparable Company Analysis (CCA)
          </h3>
          <ul className="space-y-2 text-white/60 leading-relaxed list-disc list-outside pl-5">
            <li>Benchmarks the company against similar public companies</li>
            <li>Uses valuation multiples such as EV/EBITDA, EV/REVENUE, and P/E</li>
            <li>Derives an implied valuation based on how peers are priced</li>
            <li>Anchors the model to current market conditions</li>
          </ul>
        </div>

        <div className="glass-card p-8">
          <h3 className="text-xl font-semibold text-white mb-4">
            Reverse DCF (Market-Implied Expectations)
          </h3>
          <ul className="space-y-2 text-white/60 leading-relaxed list-disc list-outside pl-5">
            <li>Starts with the current market price</li>
            <li>Solves for the revenue growth and terminal assumptions required to justify that price</li>
            <li>Highlights whether market expectations appear aggressive or conservative</li>
            <li>Provides context for interpreting valuation gaps</li>
          </ul>
        </div>

        <div className="glass-card p-8">
          <h3 className="text-xl font-semibold text-white mb-4">
            Monte Carlo Simulation
          </h3>
          <ul className="space-y-2 text-white/60 leading-relaxed list-disc list-outside pl-5">
            <li>Randomizes key assumptions such as revenue growth rates, terminal growth rates, and discount rates</li>
            <li>Runs many simulations to generate a distribution of outcomes</li>
            <li>Produces a probability-weighted valuation range instead of a single point estimate</li>
            <li>Helps quantify uncertainty and downside/upside risk</li>
          </ul>
        </div>

        <div className="glass-card p-8">
          <h3 className="text-xl font-semibold text-white mb-4">
            Combined Valuation Approach
          </h3>
          <ul className="space-y-2 text-white/60 leading-relaxed list-disc list-outside pl-5">
            <li>Integrates DCF, CCA, and Monte Carlo outputs</li>
            <li>Balances intrinsic value with market-based benchmarks</li>
            <li>Incorporates uncertainty through probabilistic simulation</li>
            <li>Outputs an expected share price and overall recommendation</li>
          </ul>
        </div>

        <div className="glass-card p-8">
          <h3 className="text-xl font-semibold text-white mb-4">
            Model Guardrails
          </h3>
          <ul className="space-y-2 text-white/60 leading-relaxed list-disc list-outside pl-5">
            <li>Terminal growth rates constrained to realistic long-term ranges</li>
            <li>Growth rates gradually converge toward sustainable levels</li>
            <li>Discount rates remain consistent with risk and market conditions and are always greater than the terminal growth rate</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
