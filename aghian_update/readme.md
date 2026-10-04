# Arithmetic Asian benchmark

This experiment compares a deterministic moment-matched approximation with a
seeded Monte Carlo reference for a discretely monitored arithmetic Asian call.

## Model

Under the risk-neutral measure,

\[
dS_t = (r-q)S_t\,dt + \sigma S_t\,dW_t.
\]

Monitoring dates are equally spaced:

\[
t_i = \frac{iT}{n},
\qquad
i=1,\ldots,n.
\]

The initial spot at \(t=0\) is excluded.

The arithmetic average is

\[
A =
\frac{1}{n}
\sum_{i=1}^{n} S(t_i).
\]

The call payoff is

\[
(A-K)^+.
\]

## Deterministic method

The first moment is

\[
M_1
=
E[A]
=
\frac{1}{n}
\sum_{i=1}^{n}
S_0 e^{(r-q)t_i}.
\]

The second moment is obtained from

\[
E[S(t_i)S(t_j)]
=
S_0^2
\exp
\left(
(r-q)(t_i+t_j)
+
\sigma^2\min(t_i,t_j)
\right).
\]

Therefore,

\[
M_2
=
E[A^2]
=
\frac{1}{n^2}
\sum_{i=1}^{n}
\sum_{j=1}^{n}
E[S(t_i)S(t_j)].
\]

A lognormal distribution is then fitted to these two moments:

\[
\sigma_A^2
=
\ln
\left(
\frac{M_2}{M_1^2}
\right),
\]

\[
\mu_A
=
\ln(M_1)
-
\frac{1}{2}\sigma_A^2.
\]

The resulting approximation is

\[
E[(A-K)^+]
\approx
M_1\Phi(d_1)
-
K\Phi(d_2),
\]

where

\[
d_2
=
\frac{\mu_A-\ln K}{\sigma_A},
\qquad
d_1=d_2+\sigma_A.
\]

The value is discounted by

\[
e^{-rT}.
\]

The first two moments are analytical under the stated discrete GBM model.

The lognormal distributional assumption is an approximation.

## Monte Carlo reference

The simulation uses exact GBM transitions between monitoring dates:

\[
S_{t+\Delta t}
=
S_t
\exp
\left[
\left(
r-q-\frac{1}{2}\sigma^2
\right)\Delta t
+
\sigma\sqrt{\Delta t}Z
\right],
\]

with

\[
Z \sim N(0,1).
\]

This avoids Euler discretization error between monitoring dates.

Monte Carlo still contains sampling error.

For that reason every estimate is reported together with its standard error
and an approximate 95% confidence interval.

## Reproducibility

The benchmark fixes:

```text
scenario parameters
observation count
path count
random seed
PRNG algorithm
normal transformation
```

A scenario-specific seed is derived from the configured base seed.

The same source revision and runtime environment should therefore reproduce
the same simulated sample sequence.

Runtime measurements are inherently machine-dependent.

## Interpretation

A small deterministic-versus-Monte-Carlo difference is evidence about the
quality of the approximation for the tested scenario.

It is not evidence that the model itself describes market prices exactly.

Likewise:

```text
zero sampling error != zero model error
zero sampling error != zero approximation error
deterministic != exact
```

The benchmark is designed to keep those error sources separate.
