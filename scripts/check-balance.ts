// /**
//  * Utility script to check your authority wallet balance
//  */

// import { getAuthorityFromEnv } from "./lib/blockchain/keypair";
// import { rpc } from "./lib/blockchain/client";

// async function checkBalance() {
//   try {
//     const authority = await getAuthorityFromEnv();
//     const address = authority.address;
    
//     console.log("Authority Address:", address);
    
//     const balance = await rpc.getBalance(address).send();
//     const solBalance = Number(balance.value) / 1e9;
    
//     console.log(`Balance: ${solBalance} SOL`);
    
//     if (solBalance < 0.1) {
//       console.error("\n⚠️  LOW BALANCE WARNING!");
//       console.log("You need at least ~0.1 SOL for rent + fees");
//       console.log(`\nAirdrop command:\nsolana airdrop 1 ${address} --url devnet`);
//     } else {
//       console.log("✅ Balance looks good!");
//     }
//   } catch (error) {
//     console.error("Error:", error);
//   }
// }

// checkBalance();
