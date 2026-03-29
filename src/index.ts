import * as core from "@actions/core";
import axios, { AxiosError } from "axios";

const API_URL = "https://api.secureops.fr";

type CreateJobResponse = {
  job_id?: string;
  status?: string;
};

type StatusResponse = {
  job_id?: string;
  status?: "pending" | "running" | "completed" | "failed" | string;
  error?: { message?: string } | string;
};

type ScanResult = {
  score?: number;
  findings?: Array<{ severity?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function normalizeBaseUrl(input: string): string {
  return input.replace(/\/+$/, "");
}

function parseNumberInput(name: string, fallback: number): number {
  const raw = core.getInput(name);
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid input "${name}": "${raw}" is not a number`);
  }
  return n;
}

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const aerr = err as AxiosError;
    if (aerr.response) {
      return `API error: ${aerr.response.status} - ${JSON.stringify(aerr.response.data)}`;
    }
    if (aerr.request) {
      return "No response from SecureOps API";
    }
  }

  if (err instanceof Error) return err.message;
  return "Unknown error";
}

async function run(): Promise<void> {
  try {
    const url = core.getInput("url", { required: true });
    const apiKey = core.getInput("api_key", { required: true });

    const threshold = parseNumberInput("fail_on_score_below", 0);
    const baseUrl = normalizeBaseUrl(API_URL);

    const pollIntervalSeconds = parseNumberInput("poll_interval_seconds", 2);
    const maxWaitSeconds = parseNumberInput("max_wait_seconds", 180);

    const pollIntervalMs = Math.max(1, Math.floor(pollIntervalSeconds * 1000));
    const maxWaitMs = Math.max(1, Math.floor(maxWaitSeconds * 1000));

    core.info(`Starting SecureOps scan for: ${url}`);

    const headers = {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    };

    const createResponse = await axios.post<CreateJobResponse>(
      `${baseUrl}/scan/api/scan/async`,
      {
        url,
        scan_type: "frontend",
        input: {},
      },
      {
        headers,
        timeout: 30000,
      }
    );

    const jobId = createResponse.data?.job_id;
    if (!jobId) {
      throw new Error(
        `Invalid API response: missing job_id. Payload: ${JSON.stringify(createResponse.data)}`
      );
    }

    core.info(`Job created: ${jobId}`);

    const startedAt = Date.now();
    let lastStatus: string = createResponse.data?.status || "pending";

    while (Date.now() - startedAt < maxWaitMs) {
      await sleep(pollIntervalMs);

      const statusResponse = await axios.get<StatusResponse>(
        `${baseUrl}/scan/api/scan/async/${jobId}`,
        {
          headers,
          timeout: 30000,
        }
      );

      lastStatus = statusResponse.data?.status || "unknown";
      core.info(`Job status: ${lastStatus}`);

      if (lastStatus === "failed") {
        const err = statusResponse.data?.error;
        const message =
          typeof err === "string" ? err : err?.message || "Scan failed";
        throw new Error(`Scan failed: ${message}`);
      }

      if (lastStatus === "completed") {
        break;
      }
    }

    if (lastStatus !== "completed") {
      throw new Error(`Scan timeout after ${maxWaitSeconds}s`);
    }

    const resultResponse = await axios.get<{ result?: ScanResult } | ScanResult>(
      `${baseUrl}/scan/api/scan/async/${jobId}/result`,
      {
        headers,
        timeout: 30000,
      }
    );

    const rawData = resultResponse.data;
    const result: ScanResult =
      rawData && typeof rawData === "object" && "result" in rawData
        ? (rawData as { result?: ScanResult }).result || {}
        : (rawData as ScanResult);

    const score = Number(result.score);
    if (!Number.isFinite(score)) {
      throw new Error(
        `Invalid API response: score missing or invalid. Payload: ${JSON.stringify(resultResponse.data)}`
      );
    }

    const findings = Array.isArray(result.findings) ? result.findings : [];
    const criticalFindings = findings.filter(
      (f) => String(f?.severity || "").toLowerCase() === "critical"
    );

    core.setOutput("score", String(score));
    core.info(`Score: ${score}`);
    core.info(`Findings count: ${findings.length}`);

    if (criticalFindings.length > 0) {
      core.setFailed(`Critical vulnerabilities found: ${criticalFindings.length}`);
      return;
    }

    if (score < threshold) {
      core.setFailed(`Score ${score} is below threshold ${threshold}`);
      return;
    }

    core.info("SecureOps scan passed successfully");
  } catch (error: unknown) {
    core.setFailed(getErrorMessage(error));
  }
}

run();
