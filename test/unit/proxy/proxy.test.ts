import { ForwardProxy } from "@aj/proxy/proxy";
import { Mockapi } from "@aj/mockapi/mockapi";
import { Moctokit } from "@kie/mock-github";
import { SpawnOptionsWithoutStdio, spawn } from "child_process";
import path from "path";
import { rmSync, writeFileSync } from "fs";

const executeRequestFile = path.join(__dirname, "executeRequest.js");

// Test URL constants
const TEST_URLS = {
  GOOGLE: "http://google.com",
  GITHUB_API: "http://api.github.com",
  GMAIL: "http://gmail.com",
  REDHAT: "http://redhat.com",
} as const;

// Mock configuration helpers
function createGoogleMockApi() {
  return new Mockapi({
    google: {
      baseUrl: TEST_URLS.GOOGLE,
      endpoints: {
        root: {
          get: {
            path: "/",
            method: "get",
            parameters: {
              query: [],
              path: [],
              body: [],
            },
          },
        },
      },
    },
  });
}

function createGmailMockApi() {
  return new Mockapi({
    gmail: {
      baseUrl: TEST_URLS.GMAIL,
      endpoints: {
        root: {
          get: {
            path: "/",
            method: "get",
            parameters: {
              query: [],
              path: [],
              body: [],
            },
          },
        },
      },
    },
  });
}

function createGithubMoctokit() {
  return new Moctokit(TEST_URLS.GITHUB_API);
}

// Test script templates
function createDualRequestScript() {
  return `
    const axios = require("axios");
    const {getOctokit} = require("@actions/github")
    async function run() {
      const axiosResponse = await axios.get("${TEST_URLS.GOOGLE}/");
      const octokit = getOctokit("token");
      const octokitResponse = await octokit.rest.repos.get({
        repo: "kiegroup",
        owner: "kiegroup",
      });
      console.log(
        JSON.stringify({ axios: axiosResponse.data, octokit: octokitResponse.data })
      );
      process.exit(0);
    }
    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `;
}

function createSimpleGetScript(url: string) {
  return `
    const axios = require("axios");
    async function run() {
      const d = await axios.get("${url}");
      console.log(JSON.stringify({status: d.status}));
      process.exit(0);
    }
    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `;
}

function createOctokitGetScript() {
  return `
    const {getOctokit} = require("@actions/github")
    async function run() {
      const octokit = getOctokit("token");
      const data = await octokit.rest.repos.get({
        repo: "kiegroup",
        owner: "kiegroup",
      });
      console.log(JSON.stringify({status: data.status, data: data.data}));
      process.exit(0);
    }
    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `;
}

function createAxiosGetScript(url: string) {
  return `
    const axios = require("axios");
    async function run() {
      const d = await axios.get("${url}");
      console.log(JSON.stringify({status: d.status, data: d.data}));
      process.exit(0);
    }
    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `;
}

// Expected response constants
const EXPECTED_MOCK_RESPONSE = {
  axios: { msg: "mocked_response" },
  octokit: { full_name: "mocked_name" },
};

afterEach(async () => {
  delete process.env["http_proxy"];
  delete process.env["https_proxy"];
});

afterAll(() => {
  rmSync(executeRequestFile, { force: true });
});

describe("start", () => {
  test("success", async () => {
    const proxy = new ForwardProxy([]);
    const ip = await proxy.start();
    expect(ip).toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}/);
    await proxy.stop();
  });

  test("failure - proxy had already started", async () => {
    const proxy = new ForwardProxy([]);
    await proxy.start();
    await expect(proxy.start()).rejects.toThrowError();
    await proxy.stop();
  });
});

describe("stop", () => {
  test("success", async () => {
    const proxy = new ForwardProxy([]);
    await proxy.start();
    await expect(proxy.stop()).resolves.not.toThrowError();
  });

  test("failure - proxy was already stopped", async () => {
    const proxy = new ForwardProxy([]);
    await proxy.start();
    await proxy.stop();
    await expect(proxy.stop()).rejects.toThrowError();
  });
});

describe("http", () => {
  let proxy: ForwardProxy;

  afterEach(async () => {
    await proxy.stop();
  });

  test("mock without CONNECT request", async function testMockWithoutConnect() {
    const mockapi = createGoogleMockApi();
    const moctokit = createGithubMoctokit();

    proxy = new ForwardProxy([
      mockapi.mock.google.root
        .get()
        .setResponse({ status: 200, data: { msg: "mocked_response" } }),
      moctokit.rest.repos
        .get()
        .setResponse({ status: 200, data: { full_name: "mocked_name" } }),
    ]);
    const ip = await proxy.start();

    const response = await executeFile(
      createDualRequestScript(),
      ip,
      {
        GITHUB_API_URL: TEST_URLS.GITHUB_API,
      }
    );

    expect(JSON.parse(response.trim())).toStrictEqual(EXPECTED_MOCK_RESPONSE);
  });

  test("do not mock", async () => {
    const mockapi = createGmailMockApi();

    proxy = new ForwardProxy([
      mockapi.mock.gmail.root
        .get()
        .setResponse({ status: 400, data: { msg: "mocked_response" } }),
    ]);
    const ip = await proxy.start();

    const response = await executeFile(
      createSimpleGetScript(TEST_URLS.REDHAT),
      ip
    );
    
    expect(JSON.parse(response.trim())).toStrictEqual({
      status: 200
    });
  });

  test("mock with CONNECT request", async () => {
    const moctokit = createGithubMoctokit();

    proxy = new ForwardProxy([
      moctokit.rest.repos
        .get()
        .setResponse({ status: 200, data: { full_name: "mocked_name" } }),
    ]);
    const ip = await proxy.start();

    const response = await executeFile(
      createOctokitGetScript(),
      ip,
      { GITHUB_API_URL: TEST_URLS.GITHUB_API }
    );

    expect(JSON.parse(response.trim())).toStrictEqual({
      status: 200,
      data: { full_name: "mocked_name" },
    });
  });
});

describe("https", () => {
  let mockapi: Mockapi;
  let proxy: ForwardProxy;

  beforeEach(() => {
    mockapi = createGoogleMockApi();
  });

  afterEach(async () => {
    await proxy.stop();
  });

  test("don't mock when a CONNECT request is sent", async () => {
    proxy = new ForwardProxy([
      mockapi.mock.google.root
        .get()
        .setResponse({ status: 200, data: { msg: "mocked_response" } }),
    ]);
    const ip = await proxy.start();

    const response = await executeCurl(["-s", "https://google.com"], ip);
    expect(response).toMatch(/<HTML><HEAD>.+/);
  });

  test("mock when a CONNECT request is not sent", async () => {
    proxy = new ForwardProxy([
      mockapi.mock.google.root
        .get()
        .setResponse({ status: 200, data: { msg: "mocked_response" } }),
    ]);
    const ip = await proxy.start();

    const response = await executeFile(
      createAxiosGetScript("https://google.com"),
      ip
    );

    expect(JSON.parse(response.trim())).toStrictEqual({
      status: 200,
      data: { msg: "mocked_response" },
    });
  });
});

async function executeCurl(
  args: string[],
  ip: string,
  additionalEnv: SpawnOptionsWithoutStdio["env"] = {}
) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn("curl", args, {
      env: {
        ...process.env,
        ...additionalEnv,
        http_proxy: `http://${ip}`,
        https_proxy: `http://${ip}`,
      },
      detached: false,
    });
    let data = "";
    let error = "";
    
    const cleanup = () => {
      if (!childProcess.killed) {
        childProcess.kill();
      }
    };

    childProcess.stdout?.on("data", chunk => {
      data += chunk.toString();
    });
    childProcess.stderr?.on("data", chunk => {
      error += chunk.toString();
    });

    childProcess.on("close", code => {
      cleanup();
      if (code === null || code !== 0) {
        reject(error || `Process exited with code ${code}`);
      } else {
        resolve(data);
      }
    });

    childProcess.on("error", err => {
      cleanup();
      reject(err);
    });
  });
}

async function executeFile(
  request: string,
  ip: string,
  additionalEnv: SpawnOptionsWithoutStdio["env"] = {}
): Promise<string> {
  writeFileSync(executeRequestFile, request);
  return new Promise((resolve, reject) => {
    const childProcess = spawn("node", [executeRequestFile], {
      env: {
        ...process.env,
        ...additionalEnv,
        http_proxy: `http://${ip}`,
        https_proxy: `http://${ip}`,
      },
      detached: false,
    });
    let data = "";
    let error = "";
    
    const cleanup = () => {
      if (!childProcess.killed) {
        childProcess.kill();
      }
    };

    childProcess.stdout?.on("data", chunk => {
      data += chunk.toString();
    });
    childProcess.stderr?.on("data", chunk => {
      error += chunk.toString();
    });

    childProcess.on("close", code => {
      cleanup();
      if (code === null || code !== 0) {
        reject(error || `Process exited with code ${code}`);
      } else {
        resolve(data);
      }
    });

    childProcess.on("error", err => {
      cleanup();
      reject(err);
    });
  });
}
