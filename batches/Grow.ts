export async function main(ns: NS) {
  
  await ns.grow(ns.args[0].toString(),{
    additionalMsec: ns.args[1] as number
  });

  ns.atExit(() =>{
    //ns.getPortHandle(109).tryWrite(`Finished growing on ${ns.args[0]}`)
  })
}