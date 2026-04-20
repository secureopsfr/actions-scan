<p align="center">
  <img src="assets/logo.png" alt="SecureOps Logo" width="120"/>
</p>

<h1 align="center">SecureOps GitHub Action</h1>

<p align="center">
  🔐 Automated security scanning directly in your CI/CD
</p>

<p align="center">
  <img src="https://img.shields.io/badge/SecureOps-security-blue" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
  <img src="https://img.shields.io/github/v/release/secureopsfr/actions-scan" />
</p>

---

## ⚡ Quick Start

```yaml
- uses: secureopsfr/actions-scan@v1
  with:
    url: "https://example.com"
    api_key: ${{ secrets.SECUREOPS_API_KEY }}
    fail_on_score_below: "80"
```

---

## ✨ Why SecureOps

* 🚀 Run security scans automatically in CI/CD
* 🔍 Detect critical vulnerabilities early
* 📉 Enforce minimum security score
* ⚡ Zero setup — just plug into GitHub Actions

---

## 🧠 How it works

1. Your pipeline triggers the action
2. The action creates an **async scan job** on SecureOps API
3. The action polls job status until completion (or timeout)
4. The API returns:

   * Security score
   * Vulnerabilities
5. The action:

   * Fails if critical issues are found
   * Fails if score is below threshold

---

## ⚙️ Inputs

| Name                  | Description                       | Required | Default |
| --------------------- | --------------------------------- | -------- | ------- |
| `url`                 | Single target URL to scan         | No       | —       |
| `urls`                | Multiple URLs (JSON/CSV/newline)  | No       | —       |
| `api_key`             | SecureOps API key                 | Yes      | —       |
| `fail_on_score_below` | Fail if score is below this value | No       | `0`     |
| `poll_interval_seconds` | Polling interval for async scan | No       | `2`     |
| `max_wait_seconds`    | Maximum wait time before timeout  | No       | `180`   |

Notes:

* Provide at least one of `url` or `urls`
* If both are provided, `urls` is used
* In multi mode, backend requires URLs from the same domain

---

## 📤 Outputs

| Name    | Description                          |
| ------- | ------------------------------------ |
| `score` | Security score (`score` or `score_global`) |

---

## 📦 Usage

### Single URL

```yaml
name: SecureOps Scan

on:
  push:
  pull_request:

jobs:
  security:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run SecureOps scan
        uses: secureopsfr/actions-scan@v1
        with:
          url: "https://example.com"
          api_key: ${{ secrets.SECUREOPS_API_KEY }}
          fail_on_score_below: "80"
```

### Multi URL

```yaml
name: SecureOps Multi Scan

on:
  push:

jobs:
  security:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Run SecureOps multi scan
        uses: secureopsfr/actions-scan@v1
        with:
          urls: |
            https://example.com
            https://example.com/pricing
            https://example.com/contact
          api_key: ${{ secrets.SECUREOPS_API_KEY }}
          fail_on_score_below: "80"
          poll_interval_seconds: "2"
          max_wait_seconds: "240"
```

---

## ❌ When does it fail?

The action fails if:

* A **critical vulnerability** is found
* The **score is below the threshold**
* The async job **fails** or **times out**

---

## 📊 Example Result

| Metric          | Value  |
| --------------- | ------ |
| Score           | 82     |
| Critical issues | 0      |
| Status          | Passed |

---

## 🔐 Setup

You must configure your SecureOps API key as a GitHub secret.

### Steps:

1. Go to your repository
2. Click **Settings**
3. Navigate to **Secrets and variables → Actions**
4. Click **New repository secret**
5. Add:

Name: SECUREOPS_API_KEY
Value: your_api_key_here

---

## 🧠 Example Logs

```
Starting SecureOps scan (single) for: https://example.com
Job created: 8b9a6e4e-xxxx-xxxx-xxxx-3d2d4a6c9f3a
Job status: pending
Job status: running
Job status: completed
Score: 82
Findings count: 3
Findings by severity: critical=0, high=1, medium=1, low=1, info=0, unknown=0
SecureOps scan passed successfully
```

---

## 🛠 Requirements

* A valid SecureOps API key
* A reachable target URL

---

## 🔮 Roadmap

* [ ] GitHub annotations (inline vulnerabilities in PRs)
* [x] Async scan support (polling)
* [x] Multi URL scan support
* [ ] Detailed findings output
* [ ] SARIF export for GitHub Security tab

---

## 🏢 About

SecureOps is a security scanning platform designed to integrate seamlessly into modern CI/CD workflows.

---

## 📄 License

MIT License
