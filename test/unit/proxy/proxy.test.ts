import { ForwardProxy } from "@aj/proxy/proxy";
import { Mockapi } from "@aj/mockapi/mockapi";
import { Moctokit } from "@kie/mock-github";
import { SpawnOptionsWithoutStdio, spawn } from "child_process";
import path from "path";
import { rmSync, writeFileSync } from "fs";

const executeRequestFile = path.join(__dirname, "executeRequest.js");

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

  test("mock without CONNECT request", async () => {
    const mockapi = new Mockapi({
      google: {
        baseUrl: "http://google.com",
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
    const moctokit = new Moctokit("http://api.github.com");

    proxy = new ForwardProxy([
      mockapi.mock.google.root
        .get()
        .setResponse({ status: 200, data: { msg: "mocked_response" } }),
      moctokit.rest.repos
        .get()
        .setResponse({ status: 200, data: { full_name: "mocked_name" } }),
    ]);
    const ip = await proxy.start();

    const response = await executeFile(`
    const axios = require("axios");
    const {getOctokit} = require("@actions/github")
    async function run() {
      const axiosResponse = await axios.get("http://google.com/");
      const octokit = getOctokit("token");
      const octokitResponse = await octokit.rest.repos.get({
        repo: "kiegroup",
        owner: "kiegroup",
      });
      console.log(
        JSON.stringify({ axios: axiosResponse.data, octokit: octokitResponse.data })
      );
    }
    run();
    `, {
      env: {
        http_proxy: `http://${ip}`,
        https_proxy: `http://${ip}`,
        GITHUB_API_URL: "http://api.github.com"
      }
    });

    expect(JSON.parse(response.trim())).toStrictEqual({
      axios: { msg: "mocked_response" },
      octokit: { full_name: "mocked_name" }
    });
  });

  test("do not mock", async () => {
    const mockapi = new Mockapi({
      gmail: {
        baseUrl: "http://gmail.com",
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

    proxy = new ForwardProxy([
      mockapi.mock.gmail.root
        .get()
        .setResponse({ status: 400, data: { msg: "mocked_response" } }),
    ]);
    const ip = await proxy.start();

    const response = await executeFile(`
    const axios = require("axios");
    axios.get("http://redhat.com/").then(d => console.log(d.status))
    `, {
      env: {
        http_proxy: `http://${ip}`,
        https_proxy: `http://${ip}`,
      }
    });

    expect(response.trim()).toBe("200");
  });

  test("mock with CONNECT request", async () => {
    const moctokit = new Moctokit("http://api.github.com");

    proxy = new ForwardProxy([
      moctokit.rest.repos
        .get()
        .setResponse({ status: 200, data: { full_name: "mocked_name" } }),
    ]);
    const ip = await proxy.start();

    const response = await executeFile(`
    const {getOctokit} = require("@actions/github")
    const octokit = getOctokit("token");
    octokit.rest.repos.get({
      repo: "kiegroup",
      owner: "kiegroup",
    }).then(data => console.log(JSON.stringify({status: data.status, data: data.data})));
    `, {
      env: {
        http_proxy: `http://${ip}`,
        https_proxy: `http://${ip}`,
        GITHUB_API_URL: "http://api.github.com"
      }
    });

    expect(JSON.parse(response.trim())).toStrictEqual({ status: 200, data: {full_name: "mocked_name"} });
  });
});

describe("https", () => {
  let mockapi: Mockapi;
  let proxy: ForwardProxy;

  beforeEach(() => {
    mockapi = new Mockapi({
      google: {
        baseUrl: "http://google.com",
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

    const response = await executeCurl(["-s", "https://google.com"], {
      env: {
        http_proxy: `http://${ip}`,
        https_proxy: `http://${ip}`
      }
    });
    expect(response).toMatch(/<HTML><HEAD>.+/);
  });

  test("mock when a CONNECT request is not sent", async () => {
    proxy = new ForwardProxy([
      mockapi.mock.google.root
        .get()
        .setResponse({ status: 200, data: { msg: "mocked_response" } }),
    ]);
    const ip = await proxy.start();
    
    const response = await executeFile(`
    const axios = require("axios");
    axios.get("https://google.com").then(d => console.log(JSON.stringify({status: d.status, data: d.data})))
    `, {
      env: {
        http_proxy: `http://${ip}`,
        https_proxy: `http://${ip}`,
      }
    });

    expect(JSON.parse(response.trim())).toStrictEqual({status: 200, data: {msg: "mocked_response"}});
  });
});

async function executeCurl(args: string[], options?: SpawnOptionsWithoutStdio) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn("curl", args, options);
    let data = "";
    let error = "";
    childProcess.stdout.on("data", chunk => {
      data += chunk.toString();
    });
    childProcess.stderr.on("data", chunk => {
      error += chunk.toString();
    });

    childProcess.on("close", code => {
      if (code === null) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

async function executeFile(request: string, options?: SpawnOptionsWithoutStdio): Promise<string> {
  writeFileSync(executeRequestFile, request);
  return new Promise((resolve, reject) => {
    const childProcess = spawn("node", [executeRequestFile], options);
    let data = "";
    let error = "";
    childProcess.stdout.on("data", chunk => {
      data += chunk.toString();
    });
    childProcess.stderr.on("data", chunk => {
      error += chunk.toString();
    });

    childProcess.on("close", code => {
      if (code === null) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}
