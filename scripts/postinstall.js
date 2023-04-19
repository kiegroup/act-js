#!/usr/bin/env node

// Ref 1: https://github.com/supabase/cli/blob/main/scripts/postinstall.js
const binLinks = require("bin-links");
const fs = require("fs");
const path = require("path");
const tar = require("tar");
const zlib = require("zlib");
const { https } = require("follow-redirects");

// version
const VERSION = process.argv[2] ?? process.env.ACT_VERSION;

// Mapping between Node's `process.platform` to Golang's
const PLATFORM_MAPPING = {
  darwin: "Darwin",
  linux: "Linux",
  win32: "Windows",
};

// Mapping between Node's `process.platform` and `process.arch` to nektos/act compatible arch
const PLATFORM_TO_ARCH_MAPPING = {
  Darwin: {
    x64: "x86_64",
    arm64: "arm64",
  },
  Linux: {
    x64: "x86_64",
    arm64: "arm64",
    arm6: "armv6",
    arm7: "armv7",
  },
  Windows: {
    x64: "x86_64",
    arm64: "arm64",
    arm7: "armv7",
  },
};

const readPackageJson = async () => {
  const packageJsonPath = path.join(".", "package.json");
  const contents = await fs.promises.readFile(packageJsonPath);
  return JSON.parse(contents);
};

const getBinPath = () => {
  let binPath = path.join("bin", "act");
  if (process.platform == "win32") {
    binPath += ".exe";
  }
  return binPath;
};

const getDownloadUrl = () => {
  const platform = PLATFORM_MAPPING[process.platform];
  if (!platform) {
    throw Error(
      "Installation is not supported for this platform: " + process.platform
    );
  }

  let arch = PLATFORM_TO_ARCH_MAPPING[platform][process.arch];

  // see: https://github.com/nodejs/node/issues/9491
  const armVersion = process.config.variables.arm_version;
  if (arch === "arm") {
    arch += armVersion;
  }

  if (!arch) {
    throw Error(
      "Installation is not supported for this architecture: " + process.arch
    );
  }

  // Build the download url from package.json
  const pkgName = "act";
  const repo = "nektos/act";
  let extension = "tar.gz";

  if (process.platform == "win32") {
    extension = "zip";
  }

  return `https://github.com/${repo}/releases/download/v${VERSION}/${pkgName}_${platform}_${arch}.${extension}`;
};

const downloadWindows = async (url, binPath) => {
  // we have unzip for windows
  const unzip = zlib.createUnzip();
  const binDir = path.dirname(binPath);
  await fs.promises.mkdir(binDir, { recursive: true });
  const dest = fs.createWriteStream(binPath);

  console.info("Downloading", url);
  https
    .get(url, (res) => {
      res.pipe(unzip).pipe(dest);
    })
    .on("error", (err) => {
      console.log("Error: ", err.message);
      throw "Unable to install act. Set ACT_BINARY enn variable to point to the path of your locally installed act";
    });

  await new Promise((resolve, reject) => {
    unzip.on("error", reject);
    dest.on("error", reject);
    dest.on("end", () => resolve());
  });
};

const downloadOthers = async (url, binPath) => {
  // First we will Un-GZip, then we will untar.
  const ungz = zlib.createGunzip();
  const binName = path.basename(binPath);
  const binDir = path.dirname(binPath);
  await fs.promises.mkdir(binDir, { recursive: true });
  const untar = tar.x({ cwd: binDir }, [binName]);

  console.info("Downloading", url);

  https
    .get(url, (res) => {
      res.pipe(ungz).pipe(untar);
    })
    .on("error", (err) => {
      console.log("Error: ", err.message);
      throw "Unable to install act. Set ACT_BINARY enn variable to point to the path of your locally installed act";
    });

  await new Promise((resolve, reject) => {
    ungz.on("error", reject);
    untar.on("error", reject);
    untar.on("end", () => resolve());
  });
};

/**
 * Downloads the binary from package url and stores at
 * ./bin in the package's root.
 *
 *  See: https://docs.npmjs.com/files/package.json#bin
 */
async function main() {
  const yarnGlobal = JSON.parse(
    process.env.npm_config_argv || "{}"
  ).original?.includes("global");
  if (process.env.npm_config_global || yarnGlobal) {
    throw `Installing act-js CLI as a global module is not supported.
    Please directly install nektos/act from https://github.com/nektos/act#installation 
    `;
  }

  const pkg = await readPackageJson();
  const binPath = getBinPath();
  const url = getDownloadUrl();

  if (process.platform === "win32") {
    await downloadWindows(url, binPath);
  } else {
    await downloadOthers(url, binPath);
  }

  // Link the binaries in postinstall to support yarn
  await binLinks({
    path: path.resolve("."),
    pkg: { ...pkg, bin: { [pkg.name]: binPath } },
  });

  // TODO: verify checksums
  console.info("Installed act CLI successfully");
}

main();
