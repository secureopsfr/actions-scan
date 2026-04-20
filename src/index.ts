import * as core from "@actions/core";
import axios, { AxiosError } from "axios";

const API_URL = "https://api.secureops.fr";
const RESULTS_LANG = "en";

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
  score_global?: number;
  findings?: Array<{
    severity?: string;
    title?: string;
    evidence?: string;
    path?: string;
    endpoint?: string;
    [key: string]: unknown;
  }>;
  page_results?: Array<{
    url?: string;
    score?: number;
    findings?: Array<{
      severity?: string;
      title?: string;
      evidence?: string;
      path?: string;
      endpoint?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  }>;
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

function parseUrlsInput(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // 1) JSON array: ["https://a", "https://b"]
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => String(v || "").trim())
          .filter(Boolean);
      }
    } catch {
      // fallback parsers below
    }
  }

  // 2) Newline-separated or CSV
  return trimmed
    .split(/[,\n]/)
    .map((u) => u.trim())
    .filter(Boolean);
}

function collectAllFindings(result: ScanResult): NonNullable<ScanResult["findings"]> {
  const rootFindings = Array.isArray(result.findings) ? result.findings : [];

  const pageFindings = Array.isArray(result.page_results)
    ? result.page_results.flatMap((p) => (Array.isArray(p.findings) ? p.findings : []))
    : [];

  return [...rootFindings, ...pageFindings];
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

function summarizeFindingsBySeverity(findings: ScanResult["findings"]): Record<string, number> {
  const summary: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0,
  };

  for (const finding of findings || []) {
    const sev = String(finding?.severity || "").toLowerCase();
    if (sev in summary) {
      summary[sev] += 1;
    } else {
      summary.unknown += 1;
    }
  }

  return summary;
}

function logTopFindings(findings: ScanResult["findings"], maxItems = 10): void {
  if (!findings || findings.length === 0) {
    core.info("No findings returned by API.");
    return;
  }

  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  const sorted = [...findings].sort((a, b) => {
    const sa = String(a?.severity || "unknown").toLowerCase();
    const sb = String(b?.severity || "unknown").toLowerCase();
    const oa = sa in severityOrder ? severityOrder[sa] : 5;
    const ob = sb in severityOrder ? severityOrder[sb] : 5;
    return oa - ob;
  });

  const top = sorted.slice(0, maxItems);
  core.info(`Top findings (${top.length}/${findings.length}):`);

  top.forEach((f, idx) => {
    const sev = String(f?.severity || "unknown").toUpperCase();
    const title = String(f?.title || f?.evidence || "Untitled finding");
    const target = String(f?.endpoint || f?.path || "n/a");
    const line = `${idx + 1}. [${sev}] ${title} (target: ${target})`;

    if (sev === "CRITICAL" || sev === "HIGH") {
      core.error(line);
    } else {
      core.warning(line);
    }
  });
}

async function run(): Promise<void> {
  try {
    const urlInput = core.getInput("url");
    const urlsInputRaw = core.getInput("urls");
    const urlsInput = parseUrlsInput(urlsInputRaw);
    const apiKey = core.getInput("api_key", { required: true });

    const threshold = parseNumberInput("fail_on_score_below", 0);
    const baseUrl = normalizeBaseUrl(API_URL);

    const pollIntervalSeconds = parseNumberInput("poll_interval_seconds", 2);
    const maxWaitSeconds = parseNumberInput("max_wait_seconds", 180);

    const pollIntervalMs = Math.max(1, Math.floor(pollIntervalSeconds * 1000));
    const maxWaitMs = Math.max(1, Math.floor(maxWaitSeconds * 1000));

    const finalUrls = urlsInput.length > 0
      ? urlsInput
      : (urlInput ? [urlInput.trim()] : []);

    if (finalUrls.length === 0) {
      throw new Error('Invalid input: provide "url" or "urls"');
    }

    const isMulti = finalUrls.length > 1;
    const modeLabel = isMulti ? "multi" : "single";
    core.info(`Starting SecureOps scan (${modeLabel}) for: ${finalUrls.join(", ")}`);

    const headers = {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    };

    const createEndpoint = isMulti
      ? `${baseUrl}/scan/api/scan/multi-async`
      : `${baseUrl}/scan/api/scan/async`;

    const createPayload = isMulti
      ? {
          urls: finalUrls,
          scan_type: "frontend",
          input: { lang: RESULTS_LANG },
        }
      : {
          url: finalUrls[0],
          scan_type: "frontend",
          input: { lang: RESULTS_LANG },
        };

    const createResponse = await axios.post<CreateJobResponse>(createEndpoint, createPayload, {
      headers,
      timeout: 30000,
    });

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

    const score = Number(isMulti ? result.score_global : result.score);
    if (!Number.isFinite(score)) {
      throw new Error(
        `Invalid API response: score missing or invalid. Payload: ${JSON.stringify(resultResponse.data)}`
      );
    }

    const findings = collectAllFindings(result);
    const criticalFindings = findings.filter(
      (f) => String(f?.severity || "").toLowerCase() === "critical"
    );
    const severitySummary = summarizeFindingsBySeverity(findings);

    core.setOutput("score", String(score));
    core.info(`Score: ${score}`);
    core.info(`Findings count: ${findings.length}`);
    if (isMulti) {
      core.info(`Pages scanned: ${Array.isArray(result.page_results) ? result.page_results.length : 0}`);
    }
    core.info(
      `Findings by severity: critical=${severitySummary.critical}, high=${severitySummary.high}, medium=${severitySummary.medium}, low=${severitySummary.low}, info=${severitySummary.info}, unknown=${severitySummary.unknown}`
    );
    logTopFindings(findings, findings.length);

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
