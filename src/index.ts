import * as core from "@actions/core";
import axios from "axios";

const API_URL = "https://api.secureops.fr";

async function run() {
  try {
    // Inputs GitHub Action
    const url = core.getInput("url", { required: true });
    const apiKey = core.getInput("api_key", { required: true });
    const threshold = parseFloat(core.getInput("fail_on_score_below") || "0");

    core.info(`Starting SecureOps scan for: ${url}`);

    // Appel API SecureOps
    const response = await axios.post(
      `${API_URL}/scan/api/scan/async`,
      { url },
      {
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const data = response.data;

    const score: number = data.score;
    const findings: any[] = data.findings || [];

    core.setOutput("score", score);

    core.info(`Score: ${score}`);
    core.info(`Findings count: ${findings.length}`);

    // Détection vulnérabilités critiques
    const criticalFindings = findings.filter(
      (f) => f.severity === "critical"
    );

    if (criticalFindings.length > 0) {
      core.setFailed(
        `Critical vulnerabilities found: ${criticalFindings.length}`
      );
      return;
    }

    // Vérification score minimum
    if (score < threshold) {
      core.setFailed(
        `Score ${score} is below threshold ${threshold}`
      );
      return;
    }

    core.info("SecureOps scan passed successfully");

  } catch (error: any) {
    if (error.response) {
      core.setFailed(
        `API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    } else if (error.request) {
      core.setFailed("No response from SecureOps API");
    } else {
      core.setFailed(error.message);
    }
  }
}

run();
