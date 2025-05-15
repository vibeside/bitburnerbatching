import { prep, isPrepped } from "../batches/utils.ts"


let loggingPort: NetscriptPort;
let dataPort: NetscriptPort;
let mainLoop = true;

export class RamBlock {
  maxRam: number;
  ram: number;
  constructor(maxRam: number, ram: number) {

    this.maxRam = maxRam;
    this.ram = ram;
  }
  get usableRam(): number {
    return this.maxRam - this.ram;
  }
}
const SCRIPTS = ["/batches/Hack.ts", "/batches/Weaken.ts", "/batches/Grow.ts"]
const COSTS = { hack: 1.7, weaken1: 1.75, grow: 1.75, weaken2: 1.75 };
const OFFSETS = { hack: 0, weaken1: 1, grow: 2, weaken2: 3 };
let count = 0;
const allServersAndRam: Map<string, RamBlock> = new Map();

export async function main(ns: NS) {
  allServersAndRam.clear();
  const target = ns.read("serverHack.txt")
  loggingPort = ns.getPortHandle(109)
  dataPort = ns.getPortHandle(2005)
  loggingPort.clear();
  dataPort.clear();
  ns.disableLog("ALL");
  await populateRamBlocks(ns, "home", new Set())
  while (mainLoop) {
    for (const [k, v] of allServersAndRam) {
      v.maxRam = ns.getServerMaxRam(k);
      v.ram = ns.getServerUsedRam(k);
    }
    if (!isPrepped(ns, target)) {
      await prep(ns, target, new Map([...allServersAndRam]))
    }
    await dispatchBatch(ns, target, new Map(allServersAndRam))
    await ns.sleep(10)
    await ns.sleep(ns.getWeakenTime(target));
  }
}
async function dispatchBatch(ns: NS, hostname: string, ramBlocks: Map<string, RamBlock>) {
  count++;
  for (const [k, v] of ramBlocks) {
    if (k == "home") continue;
    let timeTos = {
      w: ns.getWeakenTime(hostname),
      g: ns.getGrowTime(hostname),
      h: ns.getHackTime(hostname)
    }

    ns.scp(SCRIPTS, k)
    // figure out how many batches could theoretically run on this server.
    const hThreads = Math.floor(0.01 / ns.hackAnalyze(hostname));
    const wThreads = Math.ceil(ns.hackAnalyzeSecurity(hThreads) / 0.05)
    const gThreads = Math.ceil(ns.growthAnalyze(hostname, 1 / (1 - hThreads * ns.hackAnalyze(hostname))));
    const w2Threads = Math.ceil(ns.growthAnalyzeSecurity(gThreads) / 0.05)
    const predictedRam = (hThreads * 1.7) + ((wThreads + gThreads + w2Threads) * 1.75)
    while (v.usableRam - predictedRam > 0) {
    //if(v.usableRam - predictedRam < 0) continue;
    v.ram += predictedRam;
      ns.exec("/batches/Hack.ts", k, hThreads, hostname, timeTos.w - timeTos.h);
      ns.exec("/batches/Weaken.ts", k, wThreads, hostname, 0);
      ns.exec("/batches/Grow.ts", k, gThreads, hostname, timeTos.w - timeTos.g);
      ns.exec("/batches/Weaken.ts", k, w2Threads, hostname, 0);
      await ns.sleep(5);
    }

    // ns.exec("/batches/Hack.ts", k, theoreticalThreads, hostname,minTime)
    // ns.exec("/batches/Weaken.ts", k, theoreticalThreads, hostname,minTime)
    // ns.exec("/batches/Grow.ts", k, theoreticalThreads, hostname,minTime)
    // ns.exec("/batches/Weaken.ts", k, theoreticalThreads, hostname,minTime)
  }
}
async function populateRamBlocks(ns: NS, hostname: string, visited: Set<string>) {
  if (visited.has(hostname)) return;
  visited.add(hostname);
  const scanned = ns.scan(hostname);

  let maxPorts = 0;
  const portCrackers = new Map<string, boolean>([
    ["ssh", ns.fileExists("BruteSSH.exe")],
    ["ftp", ns.fileExists("FTPCrack.exe")],
    ["smtp", ns.fileExists("relaySMTP.exe")],
    ["http", ns.fileExists("HTTPWorm.exe")],
    ["sql", ns.fileExists("SQLInject.exe")]]
  )
  for (const [key, value] of portCrackers) {
    if (value) maxPorts++;
  }
  if (ns.getServerNumPortsRequired(hostname) <= maxPorts) {
    if (portCrackers.get("ssh")) ns.brutessh(hostname);
    if (portCrackers.get("ftp")) ns.ftpcrack(hostname);
    if (portCrackers.get("http")) ns.httpworm(hostname);
    if (portCrackers.get("sql")) ns.sqlinject(hostname);
    if (portCrackers.get("smtp")) ns.relaysmtp(hostname);
    if (!ns.hasRootAccess(hostname)) {
      ns.nuke(hostname);
    }
  }
  let existingRamblock = allServersAndRam.get(hostname);
  if (existingRamblock == undefined) {
    allServersAndRam.set(hostname,
      new RamBlock(
        ns.getServerMaxRam(hostname),
        ns.getServerUsedRam(hostname)
      ))
  } else {
    existingRamblock.ram = ns.getServerUsedRam(hostname);
  }
  for (const target of scanned) {
    await populateRamBlocks(ns, target, visited);
  }
}