const { Octokit } = require("@octokit/rest");
const fs = require("fs/promises");
const path = require("path");
const prettier = require("prettier");

async function getNewReleases(currentRelease) {
  const octokit = new Octokit();

  const newReleases = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.repos.listReleases,
    {
      owner: "nektos",
      repo: "act",
    }
  )) {
    let found = false;
    for (const release of response.data) {
      if (release.tag_name === currentRelease) {
        found = true;
        break;
      }
      // remove 'v' before adding the version
      newReleases.push(release.tag_name.slice(1));
    }
    if (found) {
      break;
    }
  }

  // reverse the array so that older releases are first
  return newReleases.reverse();
}

async function main() {
  const packageJSONPath = path.resolve(__dirname, "..", "package.json");
  const rawPackageJSON = await fs.readFile(packageJSONPath, "utf8");
  const packageJSON = JSON.parse(rawPackageJSON);

  // cant use process.env.npm_package_version since it will return undefined if we run the script directly and not as a npm script
  const currentRelease = `v${packageJSON.version}`;
  const newReleases = await getNewReleases(currentRelease);
  if (newReleases.length > 0) {
    const packageLockJSONPath = path.resolve(
      __dirname,
      "..",
      "package-lock.json"
    );
    const rawLockPackageJSON = await fs.readFile(packageLockJSONPath, "utf8");
    const packageLockJSON = JSON.parse(rawLockPackageJSON);

    packageJSON.version = newReleases[0];
    packageLockJSON.version = newReleases[0];
    packageLockJSON.packages[""].version = newReleases[0];

    await Promise.all([
      fs.writeFile(
        packageJSONPath,
        prettier.format(JSON.stringify(packageJSON), {
          parser: "json-stringify",
        })
      ),
      fs.writeFile(
        packageLockJSONPath,
        prettier.format(JSON.stringify(packageLockJSON), {
          parser: "json-stringify",
        })
      ),
    ]);

    console.log(newReleases[0]);
  } else {
    throw new Error("No new release");
  }
}

main();
