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
2. SecureOps scans the target URL
3. The API returns:

   * Security score
   * Vulnerabilities
4. The action:

   * Fails if critical issues are found
   * Fails if score is below threshold

---

## ⚙️ Inputs

| Name                  | Description                       | Required | Default |
| --------------------- | --------------------------------- | -------- | ------- |
| `url`                 | Target URL to scan                | Yes      | —       |
| `api_key`             | SecureOps API key                 | Yes      | —       |
| `fail_on_score_below` | Fail if score is below this value | No       | `0`     |

---

## 📤 Outputs

| Name    | Description                          |
| ------- | ------------------------------------ |
| `score` | Security score returned by SecureOps |

---

## 📦 Usage

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

---

## ❌ When does it fail?

The action fails if:

* A **critical vulnerability** is found
* The **score is below the threshold**

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
Starting SecureOps scan for: https://example.com
Score: 82
Findings count: 3
SecureOps scan passed successfully
```

---

## 🛠 Requirements

* A valid SecureOps API key
* A reachable target URL

---

## 🔮 Roadmap

* [ ] GitHub annotations (inline vulnerabilities in PRs)
* [ ] Async scan support (polling)
* [ ] Detailed findings output
* [ ] SARIF export for GitHub Security tab

---

## 🏢 About

SecureOps is a security scanning platform designed to integrate seamlessly into modern CI/CD workflows.

---

## 📄 License

MIT License
