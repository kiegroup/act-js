import { Act } from "@aj/act/act";
import { MockGithub } from "@kie/mock-github";
import axios from "axios";
import { readFileSync, writeFileSync } from "fs";
import { rm } from "fs/promises";
import path from "path";


describe("no version change", () => {
  let github: MockGithub;

  beforeEach(async () => {
    const json = await axios.get("https://unpkg.com/@kie/act-js@latest/package.json");
    const version = json.data.version;
    github = await setup(version);
  })

  afterEach(async () => teardown(github));

  test("publish workflow - no version change", async () => {
    const act = new Act(github.repo.getPath("publish"));
    const result = await act.setSecret("NPM_TOKEN", "fake_token").runJob("build");
  
    expect(result).toMatchObject([
      {
        name: "Main actions/checkout@v3",
        status: 0,
        output: "",
      },
      {
        name: "Main actions/setup-node@v3",
        output: expect.any(String),
        status: 0,
      },
      {
        name: "Main check for version change",
        status: 0,
        output: expect.any(String),
      },
      {
        name: 'Main echo "No version change detected in package.json. Won\'t publish"',
        status: 0,
        output: "No version change detected in package.json. Won't publish",
      },
      {
        name: "Post actions/setup-node@v3",
        output: "",
        status: 0,
      },
    ]);
  });
})

describe("version change", () => {
  let github: MockGithub;

  beforeEach(async () => {
    github = await setup("999.999.999");
  })

  afterEach(async () => teardown(github));

  test("publish workflow - version change", async () => {
    const act = new Act(github.repo.getPath("publish"));
    const result = await act
      .setSecret("NPM_TOKEN", "fake_token")
      .runJob("build", {
        mockSteps: {
          build: [
            {
              run: "npm publish --access public",
              mockWith:
                "echo Making sure that npm token is set - $NODE_AUTH_TOKEN",
            },
          ],
        },
      });
  
    expect(result).toMatchObject([
      {
        name: "Main actions/checkout@v3",
        status: 0,
        output: "",
      },
      {
        name: "Main actions/setup-node@v3",
        output: expect.any(String),
        status: 0,
      },
      {
        name: "Main check for version change",
        status: 0,
        output: expect.any(String),
      },
      {
        name: "Main npm ci",
        status: 0,
        output: expect.any(String),
      },
      {
        name: "Main npm run build",
        status: 0,
        output: expect.stringMatching(/tsc && tsc-alias/),
      },
      {
        name: "Main echo Making sure that npm token is set - $NODE_AUTH_TOKEN",
        status: 0,
        output: "Making sure that npm token is set - ***",
      },
      {
        name: "Post actions/setup-node@v3",
        output: "",
        status: 0,
      },
    ]);
  });
})

async function setup(version: string) {
  const packageJson = readFileSync(
    path.resolve(__dirname, "..", "..", "package.json"),
    "utf8"
  ).replace(/"version":\s"\d\.\d\.\d"/, `"version":"${version}"`);
  writeFileSync(path.join(__dirname, "package.json"), packageJson);
  
  const github = new MockGithub({
    repo: {
      publish: {
        files: [
          {
            src: path.resolve(__dirname, "..", "..", ".github"),
            dest: ".github",
          },
          {
            src: path.join(__dirname, "package.json"),
            dest: "package.json",
          },
          {
            src: path.resolve(__dirname, "..", "..", "package-lock.json"),
            dest: "package-lock.json",
          },
          {
            src: path.resolve(__dirname, "..", "..", "tsconfig.json"),
            dest: "tsconfig.json",
          },
          {
            src: path.resolve(__dirname, "..", "..", "src"),
            dest: "src",
          },
          {
            src: path.resolve(__dirname, "..", "..", "scripts"),
            dest: "scripts",
          },
        ],
      },
    },
  });
  
  await github.setup();
  return github;
}

async function teardown(github: MockGithub) {
  await Promise.all([github.teardown(), rm(path.join(__dirname, "package.json"))]);
}
