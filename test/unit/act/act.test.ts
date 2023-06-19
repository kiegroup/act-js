import path from "path";
import { Act } from "@aj/act/act";
import fs from "fs";
import fsp, { FileHandle } from "fs/promises";
import { homedir } from "os";
import { spawn } from "child_process";
import { ACT_BINARY } from "@aj/act/act.constants";
import { StepMocker } from "@aj/step-mocker/step-mocker";
import { Moctokit } from "@kie/mock-github";
import { ForwardProxy } from "@aj/proxy/proxy";
jest.mock("@aj/step-mocker/step-mocker");
jest.mock("@aj/proxy/proxy");
jest.mock("child_process");

const resources = "/path/to/some/workflow";
const spawnSpy = spawn as jest.Mock;

beforeEach(() => {
  spawnSpy.mockReturnValue({
    stdout: {
      on: (_event: string, _callBack: (chunk: unknown) => void) =>
        _callBack("chunk"),
    },
    stderr: {
      on: (_event: string, _callBack: (chunk: unknown) => void) =>
        _callBack("chunk"),
    },
    on: (_event: string, _callBack: (chunk: unknown) => void) => _callBack(0),
  });
});

describe("list", () => {
  beforeEach(() => {
    // to prevent creation of actrc during initialization
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
  });

  test("without event", async () => {
    const act = new Act();
    await act.list(undefined, undefined, resources);
    expect(spawnSpy).toHaveBeenCalledWith(ACT_BINARY, ["-W", resources, "-l"], {
      cwd: process.cwd(),
    });
  });

  test("with event", async () => {
    const act = new Act();
    await act.list("pull_request", __dirname, resources);
    expect(spawnSpy).toHaveBeenCalledWith(
      ACT_BINARY,
      ["pull_request", "-W", resources, "-l"],
      { cwd: __dirname }
    );
  });
});

describe("run", () => {
  beforeEach(() => {
    // to prevent creation of actrc during initialization
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
  });

  test("run with job", async () => {
    const act = new Act();
    await act.runJob("job", { workflowFile: resources, cwd: __dirname });
    expect(spawnSpy).toHaveBeenCalledWith(
      ACT_BINARY,
      [
        "-j",
        "job",
        "--env",
        "GITHUB_STEP_SUMMARY=/dev/stdout",
        "-W",
        resources,
      ],
      { cwd: __dirname }
    );
  });

  test("run with event", async () => {
    const act = new Act();
    await act.runEvent("pull_request", { workflowFile: resources });
    expect(spawnSpy).toHaveBeenCalledWith(
      ACT_BINARY,
      [
        "pull_request",
        "--env",
        "GITHUB_STEP_SUMMARY=/dev/stdout",
        "-W",
        resources,
      ],
      { cwd: process.cwd() }
    );
  });

  test("run with job and event", async () => {
    const act = new Act();
    await act.runEventAndJob("pull_request", "job", {
      workflowFile: resources,
    });
    expect(spawnSpy).toHaveBeenCalledWith(
      ACT_BINARY,
      [
        "pull_request",
        "-j",
        "job",
        "--env",
        "GITHUB_STEP_SUMMARY=/dev/stdout",
        "-W",
        resources,
      ],
      { cwd: process.cwd() }
    );
  });
});

describe("handle step mocking", () => {
  beforeEach(() => {
    // to prevent creation of actrc during initialization
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
  });

  test("workflow file passed in run opts", async () => {
    const act = new Act();
    const listSpy = jest.spyOn(act, "list").mockResolvedValueOnce([]);
    await act.runJob("job", {
      workflowFile: resources,
      mockSteps: {
        test: [
          {
            id: "step",
            mockWith: "echo hello",
          },
        ],
      },
    });
    expect(listSpy).toHaveBeenCalledTimes(0);
    expect(StepMocker).toHaveBeenCalledTimes(1);
    expect(StepMocker).toHaveBeenCalledWith(
      path.basename(resources),
      process.cwd()
    );
  });

  test("workflow file not passed in run opts but is different from current cwd", async () => {
    const act = new Act(undefined, resources);
    const listSpy = jest.spyOn(act, "list").mockResolvedValueOnce([]);
    await act.runJob("job", {
      mockSteps: {
        test: [
          {
            id: "step",
            mockWith: "echo hello",
          },
        ],
      },
      cwd: "cwd",
    });
    expect(listSpy).toHaveBeenCalledTimes(0);
    expect(StepMocker).toHaveBeenCalledTimes(1);
    expect(StepMocker).toHaveBeenCalledWith(path.basename(resources), "cwd");
  });

  test("get workflow files from list", async () => {
    const act = new Act();
    const listSpy = jest.spyOn(act, "list").mockResolvedValueOnce([
      {
        jobId: "job",
        jobName: "jobName",
        workflowName: "workflowName",
        workflowFile: "workflowFile",
        events: "events",
      },
    ]);
    await act.runJob("job", {
      mockSteps: {
        test: [
          {
            id: "step",
            mockWith: "echo hello",
          },
        ],
      },
    });
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(StepMocker).toHaveBeenCalledTimes(1);
    expect(StepMocker).toHaveBeenCalledWith("workflowFile", process.cwd());
  });
});

describe("parse run opts", () => {
  test("setup mock api", async () => {
    const act = new Act();
    const moctokit = new Moctokit();
    const envSpy = jest.spyOn(act, "setEnv");
    await act.runJob("job", {
      mockApi: [
        moctokit.rest.repos.get().setResponse({ status: 200, data: {} }),
      ],
    });
    expect(ForwardProxy).toBeCalledTimes(1);
    expect(envSpy).toBeCalledTimes(4);
    expect(envSpy).toHaveBeenCalledWith(
      "http_proxy",
      expect.stringMatching(/http:\/\/.*/)
    );
    expect(envSpy).toHaveBeenCalledWith(
      "https_proxy",
      expect.stringMatching(/http:\/\/.*/)
    );
    expect(envSpy).toHaveBeenCalledWith(
      "HTTP_PROXY",
      expect.stringMatching(/http:\/\/.*/)
    );
    expect(envSpy).toHaveBeenCalledWith(
      "HTTPS_PROXY",
      expect.stringMatching(/http:\/\/.*/)
    );
  });

  test.each([
    [
      "artifact server",
      {
        artifactServer: {
          path: "path",
          port: "port",
        },
      },
      ["--artifact-server-path", "path", "--artifact-server-port", "port"],
    ],
    ["bind", { bind: true }, ["--bind"]],
    ["verbose", { verbose: true }, ["--verbose"]],
  ])("setup %p", async (_title, runOpts, expectedArgs) => {
    const act = new Act();
    await act.runJob("job", runOpts);
    expect(spawnSpy).toHaveBeenCalledWith(
      ACT_BINARY,
      [
        "-j",
        "job",
        "--env",
        "GITHUB_STEP_SUMMARY=/dev/stdout",
        ...expectedArgs,
        "-W",
        process.cwd(),
      ],
      { cwd: process.cwd() }
    );
  });

  test("setup container opts", async () => {
    const act = new Act();
    await act
      .setContainerArchitecture("val")
      .setContainerDaemonSocket("val")
      .setCustomContainerOpts("val")
      .runJob("job");
    expect(spawnSpy).toHaveBeenCalledWith(
      ACT_BINARY,
      [
        "-j",
        "job",
        "--env",
        "GITHUB_STEP_SUMMARY=/dev/stdout",
        "--container-architecture",
        "val",
        "--container-daemon-socket",
        "val",
        "--container-options",
        "val",
        "-W",
        process.cwd(),
      ],
      { cwd: process.cwd() }
    );
  });

  test("enable logging", async () => {
    const act = new Act();
    const openSpy = jest.spyOn(fsp, "open").mockResolvedValueOnce({
      createWriteStream: () => undefined
    } as unknown as FileHandle);
    await act.runJob("job", { logFile: "logFile" });
    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});

describe("initialization", () => {
  test("actrc exists", () => {
    jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
    expect(() => {
      new Act();
    }).not.toThrowError();
  });

  test.each([
    [
      "micro",
      "micro",
      "-P ubuntu-latest=node:16-buster-slim\n-P ubuntu-20.04=node:16-buster-slim\n-P ubuntu-18.04=node:16-buster-slim\n-P ubuntu-22.04=node:16-bullseye-slim",
    ],
    [
      "medium",
      "medium",
      "-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest\n-P ubuntu-20.04=ghcr.io/catthehacker/ubuntu:act-20.04\n-P ubuntu-18.04=ghcr.io/catthehacker/ubuntu:act-18.04\n-P ubuntu-22.04=ghcr.io/catthehacker/ubuntu:act-22.04",
    ],
    [
      "large",
      "large",
      "-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:full-latest\n-P ubuntu-20.04=ghcr.io/catthehacker/ubuntu:full-20.04\n-P ubuntu-18.04=ghcr.io/catthehacker/ubuntu:full-18.04",
    ],
    [
      "default",
      undefined,
      "-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest\n-P ubuntu-20.04=ghcr.io/catthehacker/ubuntu:act-20.04\n-P ubuntu-18.04=ghcr.io/catthehacker/ubuntu:act-18.04\n-P ubuntu-22.04=ghcr.io/catthehacker/ubuntu:act-22.04",
    ],
  ])(
    "actrc does not exist. make with - %p image",
    (_title: string, image: string | undefined, expected: string) => {
      jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);
      const writeMock = jest
        .spyOn(fs, "writeFileSync")
        .mockImplementationOnce((_file, data) => data);
      expect(() => {
        new Act(undefined, undefined, image);
      }).not.toThrowError();
      expect(writeMock).toHaveBeenCalledWith(
        path.join(homedir(), ".actrc"),
        expected
      );
    }
  );
});
