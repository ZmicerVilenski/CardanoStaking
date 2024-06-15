import {
    Blockfrost,
    C,
    Data,
    Lucid,
    SpendingValidator,
    TxHash,
    fromHex,
    toHex,
  } from "https://deno.land/x/lucid@0.8.3/mod.ts";
import * as cbor from "https://deno.land/x/cbor@v1.4.1/index.js";
   
const lucid = await Lucid.new(
    new Blockfrost(
      "https://cardano-preview.blockfrost.io/api/v0",
      Deno.env.get("BLOCKFROST_API_KEY"),
    ),
    "Preview",
  );
   
lucid.selectWalletFromPrivateKey(await Deno.readTextFile("./beneficiary.sk"));
   
const beneficiaryPublicKeyHash = lucid.utils.getAddressDetails(
    await lucid.wallet.address()
  ).paymentCredential.hash;
   
const validator = await readValidator();
   
  // --- Supporting functions
   
async function readValidator(): Promise<SpendingValidator> {
    const validator = JSON.parse(await Deno.readTextFile("plutus.json")).validators[0];
    return {
      type: "PlutusV2",
      script: toHex(cbor.encode(fromHex(validator.compiledCode))),
    };
}

 
const scriptAddress = lucid.utils.validatorToAddress(validator);
 
// we get all the UTXOs sitting at the script address
const scriptUtxos = await lucid.utxosAt(scriptAddress);
console.log('scriptAddress', scriptAddress)
// console.log('scriptUtxos', scriptUtxos)
 
const Datum = Data.Object({
  lock_until: Data.BigInt, // timestamp
  owner: Data.String, // byte array or string
  beneficiary: Data.String, //--//--
  beneficiary2: Data.String, //--//--
  beneficiary3: Data.String, //--//--
});
 
type Datum = Data.Static<typeof Datum>;
 
const currentTime = new Date().getTime();
 
// filter out all the UTXOs by beneficiary and lock_until
const utxos = scriptUtxos.filter((utxo) => {
    // console.log('utxo', utxo)
    let datum = Data.from<Datum>(
      utxo.datum,
      Datum,
    );
    datum.lock_until
    console.log('datum.lock_until',datum.lock_until)
    console.log('currentTime',currentTime)

    return datum.beneficiary === beneficiaryPublicKeyHash &&
      datum.lock_until <= currentTime;
});
 
if (utxos.length === 0) {
  console.log("No redeemable utxo found. You need to wait a little longer...");
  Deno.exit(1);
}
 
console.log('utxos', utxos)

// empty redeemer
const redeemer = Data.empty();
 
const txUnlock = await unlock(utxos, currentTime, { from: validator, using: redeemer });
 
await lucid.awaitTx(txUnlock);
 
console.log(`1 tADA recovered from the contract
    Tx ID: ${txUnlock}
    Redeemer: ${redeemer}
`);
 
// --- Supporting funcs
 
async function unlock(utxos, currentTime, { from, using }): Promise<TxHash> {
  const laterTime = new Date(currentTime + 2 * 60 * 60 * 1000).getTime(); // add two hours (TTL: time to live)
 
  const tx = await lucid
    .newTx()
    .collectFrom(utxos, using)
    .addSigner(await lucid.wallet.address()) // this should be beneficiary address
    .validFrom(currentTime - 100000)
    .validTo(laterTime)
    .attachSpendingValidator(from)
    .complete();
 
  const signedTx = await tx
    .sign()
    .complete();
 
  return signedTx.submit();
}

// deno run --allow-net --allow-read --allow-env staking-unlock.ts 58f8c6dbf7369fb7c6b3dd5ad72266ddca3677ae03d9bff0578d189f6bf24211

