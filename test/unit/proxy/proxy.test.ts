import { ForwardProxy } from "@aj/proxy/proxy";
import axios from "axios";
import { Octokit } from "@octokit/rest";
import { Mockapi, Moctokit } from "@kie/mock-github";
import { spawn } from "child_process";

afterEach(() => {
  delete process.env["http_proxy"];
  delete process.env["https_proxy"];
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
  test("mock", async () => {
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
    const moctokit = new Moctokit();

    const proxy = new ForwardProxy([
      mockapi.mock.google.root
        .get()
        .setResponse({ status: 200, data: { msg: "mocked_response" } }),
      moctokit.rest.repos
        .get()
        .setResponse({ status: 200, data: { full_name: "mocked_name" } }),
    ]);
    const ip = await proxy.start();
    process.env["http_proxy"] = `http://${ip}`;
    process.env["https_proxy"] = `http://${ip}`;

    const axiosResponse = await axios.get(`http://google.com/`);
    expect(axiosResponse.data).toStrictEqual({ msg: "mocked_response" });

    const octokit = new Octokit();
    const octokitResponse = await octokit.rest.repos.get({
      repo: "kiegroup",
      owner: "kiegroup",
    });
    expect(octokitResponse.data).toStrictEqual({ full_name: "mocked_name" });
    await proxy.stop();
  });

  test("do not mock", async () => {
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

    const proxy = new ForwardProxy([
      mockapi.mock.google.root
        .get()
        .setResponse({ status: 200, data: { msg: "mocked_response" } }),
    ]);
    const ip = await proxy.start();
    process.env["http_proxy"] = `http://${ip}`;
    process.env["https_proxy"] = `http://${ip}`;

    await expect(
      axios.get(`http://redhat.com/`, {
        maxRedirects: 0,
      })
    ).rejects.toThrowError("Request failed with status code 301");
    await proxy.stop();
  });
});

describe("https", () => {
  test("some clients send a CONNECT request, in which case don't mock it even if it matches", async () => {
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

    const proxy = new ForwardProxy([
      mockapi.mock.google.root
        .get()
        .setResponse({ status: 200, data: { msg: "mocked_response" } }),
    ]);
    const ip = await proxy.start();
    process.env["http_proxy"] = `http://${ip}`;
    process.env["https_proxy"] = `http://${ip}`;

    const response = await executeCurl(["-s", "https://google.com"]);
    expect(response).toMatch(/<HTML><HEAD>.+/);
    await proxy.stop();
  });

  test("some clients dont send a CONNECT request in which case mock it", async () => {
    const moctokit = new Moctokit();

    const proxy = new ForwardProxy([
      moctokit.rest.repos
        .get()
        .setResponse({ status: 200, data: { full_name: "mocked_name" } }),
    ]);
    const ip = await proxy.start();
    process.env["http_proxy"] = `http://${ip}`;
    process.env["https_proxy"] = `http://${ip}`;
    const octokit = new Octokit();
    const response = await octokit.rest.repos.get({
      repo: "kiegroup",
      owner: "kiegroup",
    });
    expect(response.data).toStrictEqual({ full_name: "mocked_name" });

    await proxy.stop();
  });
});

async function executeCurl(args: string[]) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn("curl", args);
    let data = "";
    let error = "";
    childProcess.stdout.on("data", (chunk) => {
      data += chunk.toString();
    });
    childProcess.stderr.on("data", (chunk) => {
      error += chunk.toString();
    });

    childProcess.on("close", (code) => {
      if (code === null) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}
