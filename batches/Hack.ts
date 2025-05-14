export async function main(ns: NS) {
    
  await ns.hack(ns.args[0].toString(),{
    additionalMsec: ns.args[1] as number
  })

  ns.atExit(() =>{
    //ns.getPortHandle(109).tryWrite(`Finished hacking ${ns.args[0]}`)
  })
}