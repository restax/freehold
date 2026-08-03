# Security Policy

Freehold handles real estate transaction data: contracts, client records, and
stored credentials. We take reports seriously and we would rather hear about a
problem early and awkwardly than late and publicly.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover or suspect a security vulnerability in this project, please
report it through one of the following channels:

* **GitHub Private Advisory:** [Submit a security advisory](../../security/advisories/new) *(Preferred)*
* **Email:** Send details to `security@freeholdtc.dev`. If you use PGP or GPG,
  include your public key or a link to it and we will reply in kind.

### What to Include in Your Report

To help us triage and fix the issue quickly, please include:

* A description of the issue and potential impact.
* Step-by-step instructions (or a minimal proof-of-concept) to reproduce it.
* The specific version(s) affected.

### What to Expect

* **Acknowledgment:** We will acknowledge receipt of your report within **48 hours**.
* **Assessment:** We will verify the vulnerability and provide an estimated
  timeline for a fix within **5 business days**.
* **Fix & Disclosure:** Once a patch is ready, we will coordinate public
  disclosure alongside a new release. We aim to resolve critical issues within
  30 days.

## Self-Hosted Instances

Freehold is source-available and many installations are self-hosted. A fix
released here does not reach your server until you update it, so security
releases are tagged and noted in the changelog. If you run your own instance,
watch this repository for releases.

## Safe Harbour

We will not pursue or support legal action against anyone who reports a
vulnerability in good faith under this policy: who avoids privacy violations
and service disruption, who does not access or modify data belonging to
anyone else, and who gives us reasonable time to fix the issue before telling
the world about it. Testing against the public demo workspace at
`freeholdtc.dev/demo` is fine. Testing against another workspace's live data
is not.
