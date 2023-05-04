import { Act } from "@aj/act/act";
import { MockGithub } from "@kie/mock-github";
import path from "path";

let github: MockGithub;
beforeEach(async () => {
  github = new MockGithub({
    repo: {
      publish: {
        files: [
          {
            src: path.resolve(__dirname, "..", "..", ".github"),
            dest: ".github",
          },
          {
            src: path.resolve(__dirname, "..", "..", "package.json"),
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
            src: path.resolve(__dirname, "..", "..", "test"),
            dest: "test",
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
});

afterEach(async () => {
  await github.teardown();
});

test("publish workflow", async () => {

  const act = new Act(github.repo.getPath("publish"));
  const result = await act.setSecret("NPM_TOKEN", "token").runJob("release", {
    mockSteps: {
      release: [
        {
          name: "Release",
          mockWith: "echo ran semantic-release"
        }
      ]
    },
    logFile: "t.log"
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
    { name: "Main Install packages", status: 0, output: expect.any(String) },
    { name: "Main Build package", status: 0, output: expect.any(String) },
    { name: "Main Release", status: 0, output: "ran semantic-release" },
    {
      name: "Post actions/setup-node@v3",
      output: "",
      status: 0,
    }
  ]);
});

