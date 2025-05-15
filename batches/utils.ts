import * as all from "../batches/controller.ts"

let count = 0;

export async function main(ns: NS) {
}
export function isPrepped(ns: NS, server: string) {
  const minSecurity = ns.getServerMinSecurityLevel(server);
  const fixedSec = Math.abs(ns.getServerSecurityLevel(server) - minSecurity) < 0.0001;
  return (ns.getServerMoneyAvailable(server) === ns.getServerMaxMoney(server) && fixedSec) ? true : false;
}
export async function prep(ns: NS, hostname: string, ramBlocks: Map<string, all.RamBlock>) {
  ns.disableLog("ALL");
  const maxMoney = ns.getServerMaxMoney(hostname);
  const minSecurity = ns.getServerMinSecurityLevel(hostname);
  let curSec = 0;
  let availMoney = 0;
  while (!isPrepped(ns, hostname)) {
    let neededGrowThreads = 0;
    let neededWeakenThreads = 0;
    let neededWeakenTwoThreads = 0;
    let timeTos = {
      w: ns.getWeakenTime(hostname),
      g: ns.getGrowTime(hostname),
      h: ns.getHackTime(hostname)
    }
    curSec = ns.getServerSecurityLevel(hostname);
    availMoney = ns.getServerMoneyAvailable(hostname);

    if (curSec > minSecurity) {
      neededWeakenThreads = Math.ceil(curSec / 0.05)
    }
    if (availMoney < maxMoney) {
      neededGrowThreads = Math.ceil(ns.growthAnalyze(hostname, maxMoney / availMoney));
    }
    for (const [server, block] of ramBlocks) {

      if (server == "home") continue;
      ns.scp(["/batches/Grow.ts", "/batches/Weaken.ts"], server);
      let serverAvailThreads = Math.floor(block.usableRam / 1.75);
      if (serverAvailThreads == 0) continue;
      if (neededWeakenThreads > 0) {
        ns.exec("/batches/Weaken.ts", server, serverAvailThreads, hostname, 0)
        neededWeakenThreads -= serverAvailThreads;
      }else if (neededWeakenTwoThreads > 0){
        ns.exec("/batches/Weaken.ts",server, serverAvailThreads,hostname, 0)
        neededWeakenTwoThreads -= serverAvailThreads;
      } else if (neededGrowThreads > 0) {
        ns.exec("/batches/Grow.ts", server, serverAvailThreads, hostname, timeTos.w - timeTos.g)
        neededGrowThreads -= serverAvailThreads;
        neededWeakenTwoThreads += Math.ceil(ns.growthAnalyzeSecurity(serverAvailThreads) / 0.05);
      }
    }
    await ns.sleep(100);
  }
  ns.tprintRaw("Finished prepping " + hostname)
}